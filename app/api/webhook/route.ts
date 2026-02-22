import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

// Simple in-memory store for recent transactions (in production, use Redis)
const processedTransactions = new Map<string, number>()
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret'

/**
 * Verify webhook signature (Base Mini App webhook validation)
 */
function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = createHash('sha256')
    .update(payload + WEBHOOK_SECRET)
    .digest('hex')
  return signature === expectedSignature
}

/**
 * Webhook для обработки транзакций Base Mini App
 * Handles: score submissions, check-ins, and other on-chain events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-webhook-signature') || ''
    
    // Verify signature if provided (production)
    if (process.env.NODE_ENV === 'production' && signature) {
      const isValid = verifySignature(rawBody, signature)
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const body = JSON.parse(rawBody)
    const { event, transactionHash, status, type, data } = body

    // Prevent duplicate processing
    if (transactionHash) {
      const now = Date.now()
      const lastProcessed = processedTransactions.get(transactionHash) || 0
      if (now - lastProcessed < 60000) { // 1 minute cooldown
        console.log('Duplicate transaction ignored:', transactionHash)
        return NextResponse.json({ success: true, message: 'Already processed' })
      }
      processedTransactions.set(transactionHash, now)
      
      // Cleanup old entries (keep last 5 minutes)
      if (processedTransactions.size > 100) {
        const entries = Array.from(processedTransactions.entries())
        for (const [hash, time] of entries) {
          if (now - time > 300000) {
            processedTransactions.delete(hash)
          }
        }
      }
    }

    console.log('Webhook received:', { event, type, status, transactionHash })

    if (status === 'success') {
      // Handle different event types
      switch (type) {
        case 'score_submission':
          console.log('Score submitted:', {
            player: data?.player,
            score: data?.score,
            tx: transactionHash
          })
          // TODO: Invalidate leaderboard cache
          break

        case 'daily_checkin':
          console.log('Daily check-in completed:', {
            player: data?.player,
            streak: data?.streak,
            tx: transactionHash
          })
          break

        case 'contract_interaction':
          console.log('Contract interaction:', {
            event,
            tx: transactionHash
          })
          break

        default:
          console.log('Unknown event type:', type || 'undefined')
      }

      // Analytics tracking point
      if (process.env.VERCEL_ANALYTICS_ID) {
        // Send to Vercel Analytics or your preferred service
        console.log('Analytics: on-chain event tracked')
      }
    } else if (status === 'failed') {
      console.error('Transaction failed:', {
        event,
        tx: transactionHash,
        error: data?.error
      })
      // TODO: Implement retry logic or notify user
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      processed: status === 'success'
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Base Dash webhook endpoint is ready',
    version: '1.0.0',
    supportedEvents: ['score_submission', 'daily_checkin', 'contract_interaction']
  })
}
