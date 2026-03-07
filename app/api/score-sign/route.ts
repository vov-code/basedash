import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, encodePacked, keccak256, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'
import Redis from 'ioredis'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

const redisUrl = process.env.REDIS_URL || process.env.KV_URL
const redis = redisUrl ? new Redis(redisUrl) : null

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const chain = isTestnet ? baseSepolia : base

const publicClient = createPublicClient({
  chain,
  transport: http(),
})

// Wallet client for gasless transactions
let walletClient: ReturnType<typeof createWalletClient> | null = null

function getWalletClient() {
  if (!walletClient) {
    const pk = process.env.SCORE_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!pk) {
      throw new Error('PRIVATE_KEY or SCORE_SIGNER_PRIVATE_KEY not configured')
    }
    if (!process.env.SCORE_SIGNER_PRIVATE_KEY && process.env.NODE_ENV === 'production') {
      console.warn('[SECURITY] SCORE_SIGNER_PRIVATE_KEY not set, falling back to PRIVATE_KEY. Use a dedicated signer key in production.')
    }
    const account = privateKeyToAccount(pk as `0x${string}`)
    walletClient = createWalletClient({
      chain,
      transport: http(),
      account,
    })
  }
  return walletClient
}

// ============================================================================
// ANTI-CHEAT: Redis-backed rate limiting & HMAC-SHA256 challenges
// Survives serverless deploys, scales across instances, no memory leaks
// ============================================================================

// HMAC secret — MUST be set via CHALLENGE_SECRET env var in production
const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET || ''
if (!CHALLENGE_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY] CHALLENGE_SECRET not set! Anti-cheat challenge verification is disabled.')
}

function generateChallenge(ip: string): string {
  if (!CHALLENGE_SECRET) return ''
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', CHALLENGE_SECRET)
    .update(`${ip}:${timestamp}`)
    .digest('hex')
  return `${timestamp}.${hmac}`
}

function verifyChallenge(ip: string, challenge: string): boolean {
  if (!CHALLENGE_SECRET) return true
  try {
    const dotIdx = challenge.indexOf('.')
    if (dotIdx < 1) return false
    const timestamp = challenge.slice(0, dotIdx)
    const receivedHmac = challenge.slice(dotIdx + 1)
    const age = Date.now() - parseInt(timestamp)
    if (age > 300_000 || age < 0 || isNaN(age)) return false
    const expectedHmac = createHmac('sha256', CHALLENGE_SECRET)
      .update(`${ip}:${timestamp}`)
      .digest('hex')
    // Constant-time comparison
    if (expectedHmac.length !== receivedHmac.length) return false
    let mismatch = 0
    for (let i = 0; i < expectedHmac.length; i++) {
      mismatch |= expectedHmac.charCodeAt(i) ^ receivedHmac.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}

// Redis-backed rate limiting (no in-memory Maps, no setInterval)
async function checkRateLimit(ip: string): Promise<{ allowed: boolean; challenge?: string; retryAfter?: number }> {
  if (!redis) return { allowed: true }
  try {
    const blockKey = `rl:block:${ip}`
    const blocked = await redis.get(blockKey)
    if (blocked) {
      const ttl = await redis.ttl(blockKey)
      return { allowed: false, retryAfter: Math.max(ttl, 1) }
    }
    const ipKey = `rl:ip:${ip}`
    const count = await redis.incr(ipKey)
    if (count === 1) await redis.expire(ipKey, 60)
    if (count >= 20) {
      await redis.set(blockKey, '1', 'EX', 300)
      return { allowed: false, retryAfter: 300 }
    }
    if (count >= 10) return { allowed: false, retryAfter: 30 }
    if (count >= 5) {
      const ch = generateChallenge(ip)
      return { allowed: true, challenge: ch || undefined }
    }
    return { allowed: true }
  } catch (err) {
    console.error('[RateLimit] Redis error:', err)
    return { allowed: true } // Fail open
  }
}

async function checkAddressCooldown(address: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!redis) return { allowed: true }
  try {
    const key = `rl:addr:${address.toLowerCase()}`
    const exists = await redis.get(key)
    if (exists) {
      const ttl = await redis.ttl(key)
      return { allowed: false, retryAfter: Math.max(ttl, 1) }
    }
    await redis.set(key, '1', 'EX', 30)
    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export async function GET(request: NextRequest) {
  try {
    const pk = process.env.SCORE_SIGNER_PRIVATE_KEY
    if (!pk) {
      return NextResponse.json({ error: 'SCORE_SIGNER_PRIVATE_KEY not configured' }, { status: 503 })
    }

    // Get client identifiers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const scoreStr = searchParams.get('score')
    const challenge = searchParams.get('challenge')

    // Validate address first
    if (!address || !scoreStr) {
      return NextResponse.json({ error: 'address and score are required' }, { status: 400 })
    }

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'invalid address format' }, { status: 400 })
    }

    // Check rate limit (Redis-backed, async)
    const rateLimitResult = await checkRateLimit(ip)

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.retryAfter) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter,
            message: rateLimitResult.retryAfter > 60
              ? 'Too many requests. Please wait before trying again.'
              : 'Please wait a moment before submitting another score.'
          },
          {
            status: 429,
            headers: { 'Retry-After': rateLimitResult.retryAfter.toString() }
          }
        )
      }
      if (rateLimitResult.challenge) {
        return NextResponse.json({
          requiresChallenge: true,
          challenge: rateLimitResult.challenge,
          message: 'Additional verification required'
        })
      }
    }

    // Verify challenge if provided
    if (challenge && !verifyChallenge(ip, challenge)) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 403 })
    }

    const score = Number(scoreStr)
    if (!Number.isFinite(score) || score <= 0) {
      return NextResponse.json({ error: 'invalid score' }, { status: 400 })
    }

    // ========================================================================
    // ANTI-CHEAT: Score validation heuristics
    // ========================================================================

    // Check for impossible scores
    if (score > 50_000) {
      console.warn(`Suspicious score detected: ${score} from ${address}`)
      return NextResponse.json({ error: 'score exceeds maximum allowed value' }, { status: 400 })
    }

    // Check for suspicious patterns (scores that are too round)
    if (score > 10000 && score % 1000 === 0) {
      console.warn(`Potentially manipulated score: ${score} from ${address}`)
      // Log but allow - could be legitimate
    }

    // Anti-cheat: per-address cooldown (Redis-backed)
    const cooldownResult = await checkAddressCooldown(address)
    if (!cooldownResult.allowed) {
      return NextResponse.json(
        { error: 'please wait between submissions', retryAfter: cooldownResult.retryAfter },
        { status: 429 }
      )
    }

    // Verify contract is deployed
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Contract not deployed' }, { status: 503 })
    }

    // Get current nonce
    const nonce = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'scoreNonces',
      args: [address as `0x${string}`],
    })

    // Generate signature
    const msgHash = keccak256(
      encodePacked(
        ['address', 'uint256', 'address', 'uint256', 'uint256'],
        [CONTRACT_ADDRESS, BigInt(chain.id), address as `0x${string}`, BigInt(score), nonce as bigint]
      )
    )

    const account = privateKeyToAccount(pk as `0x${string}`)
    const signature = await account.signMessage({ message: { raw: msgHash } })

    return NextResponse.json({
      nonce: (nonce as bigint).toString(),
      signature,
      signer: account.address,
      timestamp: Date.now(),
      gasless: false, // Default: return signature for user to submit
    })
  } catch (error) {
    console.error('Score signing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST endpoint for GASLESS score submission (Relayer)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, score, sessionId } = body

    // Get client identifiers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // Validate
    if (!address || !score) {
      return NextResponse.json({ error: 'address and score are required' }, { status: 400 })
    }

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'invalid address format' }, { status: 400 })
    }

    const scoreNum = Number(score)
    if (!Number.isFinite(scoreNum) || scoreNum <= 0 || scoreNum > 50_000) {
      return NextResponse.json({ error: 'invalid score' }, { status: 400 })
    }

    // ========================================================================
    // ANTI-CHEAT: Session ID Validation against Redis store
    // ========================================================================
    if (redis && sessionId) {
      try {
        const sessionStr = await redis.get(`session:${sessionId}`)
        if (!sessionStr) {
          console.warn(`[Anti-Cheat] Invalid or expired session ID: ${sessionId} for address: ${address}`)
          return NextResponse.json({ error: 'invalid or expired game session' }, { status: 403 })
        }

        const session = JSON.parse(sessionStr)
        if (session.score !== scoreNum) {
          console.warn(`[Anti-Cheat] Score mismatch! Submitted: ${scoreNum}, Session: ${session.score} for ${address}`)
          return NextResponse.json({ error: 'score mismatch with game session' }, { status: 403 })
        }
        if (session.address?.toLowerCase() !== address.toLowerCase()) {
          console.warn(`[Anti-Cheat] Address mismatch! Submitted: ${address}, Session: ${session.address}`)
          return NextResponse.json({ error: 'address mismatch with game session' }, { status: 403 })
        }

        // Optionally mark session as used so it cannot be reused
        await redis.del(`session:${sessionId}`)
      } catch (err) {
        console.error('Redis session validation failed:', err)
      }
    } else if (redis && !sessionId && scoreNum > 0) {
      // Disallow positive scores lacking a verifiable session when Redis is available
      console.warn(`[Anti-Cheat] Missing session ID for score ${scoreNum} from ${address}`)
      return NextResponse.json({ error: 'missing game session verifier' }, { status: 403 })
    }

    // Check rate limit (Redis-backed, async)
    const rateLimitResult = await checkRateLimit(ip)
    if (!rateLimitResult.allowed && rateLimitResult.retryAfter) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Anti-cheat cooldown (Redis-backed)
    const cooldownResult = await checkAddressCooldown(address)
    if (!cooldownResult.allowed) {
      return NextResponse.json(
        { error: 'please wait between submissions', retryAfter: cooldownResult.retryAfter },
        { status: 429 }
      )
    }

    // Verify contract is deployed
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Contract not deployed' }, { status: 503 })
    }

    // Get wallet client (owner account for gasless)
    const walletClient = getWalletClient()

    // Get current nonce
    const nonce = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'scoreNonces',
      args: [address as `0x${string}`],
    })

    // Generate signature
    const pk = process.env.SCORE_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY
    const account = privateKeyToAccount(pk as `0x${string}`)

    const msgHash = keccak256(
      encodePacked(
        ['address', 'uint256', 'address', 'uint256', 'uint256'],
        [CONTRACT_ADDRESS, BigInt(chain.id), address as `0x${string}`, BigInt(scoreNum), nonce as bigint]
      )
    )

    const signature = await account.signMessage({ message: { raw: msgHash } })

    // Submit transaction via relayer (owner pays gas)
    const hash = await walletClient.writeContract({
      chain,
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'submitScoreFor',
      args: [address as `0x${string}`, BigInt(scoreNum), nonce as bigint, signature as `0x${string}`],
      account,
    })

    console.log(`Gasless score submitted: ${address} - ${scoreNum}, tx: ${hash}`)

    return NextResponse.json({
      success: true,
      hash,
      score: scoreNum,
      address,
      gasless: true,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Gasless score submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit score' },
      { status: 500 }
    )
  }
}

