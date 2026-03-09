import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Simple in-memory session store (survives within a single serverless invocation)
// For production, use Redis via process.env.REDIS_URL
let Redis: any = null
let redis: any = null

try {
    Redis = require('ioredis')
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL
    if (redisUrl) redis = new Redis(redisUrl)
} catch {
    // ioredis not available, sessions won't persist across cold starts
}

/**
 * POST /api/session/start
 * 
 * Called when the player starts a new game.
 * Returns a unique sessionId that must be sent back with the score submission.
 * 
 * Body: { address?: string }
 * Response: { sessionId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const address = body.address || 'anonymous'

        // Generate a unique session ID
        const sessionId = crypto.randomBytes(16).toString('hex')
        const now = Date.now()

        const sessionData = JSON.stringify({
            address: address.toLowerCase(),
            startTime: now,
            score: null, // Will be set by client on death
        })

        if (redis) {
            // Store in Redis with 10-minute TTL (game sessions shouldn't last longer)
            await redis.set(`session:${sessionId}`, sessionData, 'EX', 600)
        }

        return NextResponse.json({
            sessionId,
            timestamp: now,
        })
    } catch (error) {
        console.error('Session start error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
