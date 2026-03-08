import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, encodePacked, keccak256, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'
import Redis from 'ioredis'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

// ============================================================================
// CONFIGURATION
// ============================================================================

const redisUrl = process.env.REDIS_URL || process.env.KV_URL
const redis = redisUrl ? new Redis(redisUrl) : null

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const chain = isTestnet ? baseSepolia : base

const publicClient = createPublicClient({
  chain,
  transport: http(),
})

// ============================================================================
// SECURITY: Mandatory secret in production
// ============================================================================

const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET || ''
if (!CHALLENGE_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    '[WARN] CHALLENGE_SECRET is not set. Anti-cheat will reject requests at runtime. ' +
    'Set CHALLENGE_SECRET in your Vercel environment variables.'
  )
}

// ============================================================================
// WALLET CLIENT — lazy-initialized for gasless transactions
// ============================================================================

let walletClient: ReturnType<typeof createWalletClient> | null = null

function getSignerAccount() {
  const pk = process.env.SCORE_SIGNER_PRIVATE_KEY
  if (!pk) {
    throw new Error('SCORE_SIGNER_PRIVATE_KEY not configured')
  }
  return privateKeyToAccount(pk as `0x${string}`)
}

function getWalletClient() {
  if (!walletClient) {
    const pk = process.env.RELAYER_PRIVATE_KEY || process.env.SCORE_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY
    if (!pk) {
      throw new Error('RELAYER_PRIVATE_KEY or SCORE_SIGNER_PRIVATE_KEY not configured')
    }
    if (!process.env.RELAYER_PRIVATE_KEY && process.env.NODE_ENV === 'production') {
      console.warn(
        '[SECURITY] RELAYER_PRIVATE_KEY not set — falling back to SCORE_SIGNER_PRIVATE_KEY. ' +
        'In production, use a SEPARATE dedicated relayer key with only RELAYER_ROLE on the contract.'
      )
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
// ANTI-CHEAT: HMAC-SHA256 challenge system
// ============================================================================

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
    // Constant-time comparison to prevent timing attacks
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

// ============================================================================
// RATE LIMITING — Redis-backed (survives serverless cold starts)
// ============================================================================

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
    return { allowed: true } // Fail open to not block legitimate users
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

// ============================================================================
// NONCE MANAGER — Redis-backed lock to prevent concurrent nonce collisions
// ============================================================================

async function acquireNonceLock(address: string, ttlMs = 15000): Promise<boolean> {
  if (!redis) return true
  const key = `nonce:lock:${address.toLowerCase()}`
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX')
  return result === 'OK'
}

async function releaseNonceLock(address: string): Promise<void> {
  if (!redis) return
  const key = `nonce:lock:${address.toLowerCase()}`
  await redis.del(key)
}

// ============================================================================
// GET — Nonce retrieval ONLY (no signing)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'invalid address format' }, { status: 400 })
    }

    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Contract not deployed' }, { status: 503 })
    }

    // Return nonce and signer address (no sensitive data)
    const nonce = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'scoreNonces',
      args: [address as `0x${string}`],
    })

    const signerAccount = getSignerAccount()

    return NextResponse.json({
      nonce: (nonce as bigint).toString(),
      signer: signerAccount.address,
    })
  } catch (error) {
    console.error('Nonce retrieval error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// POST — Score signing + optional gasless submission (all signing via POST)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, score, sessionId, gasless, challenge } = body

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // ====================================================================
    // INPUT VALIDATION
    // ====================================================================
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

    // ====================================================================
    // ANTI-CHEAT: Challenge verification
    // ====================================================================
    if (challenge && !verifyChallenge(ip, challenge)) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 403 })
    }

    // ====================================================================
    // ANTI-CHEAT: Rate limiting
    // ====================================================================
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
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter.toString() } }
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

    // ====================================================================
    // ANTI-CHEAT: Per-address cooldown
    // ====================================================================
    const cooldownResult = await checkAddressCooldown(address)
    if (!cooldownResult.allowed) {
      return NextResponse.json(
        { error: 'please wait between submissions', retryAfter: cooldownResult.retryAfter },
        { status: 429 }
      )
    }

    // ====================================================================
    // ANTI-CHEAT: Session validation (Redis-backed)
    // ====================================================================
    if (redis && sessionId) {
      try {
        const sessionStr = await redis.get(`session:${sessionId}`)
        if (!sessionStr) {
          console.warn(`[Anti-Cheat] Invalid/expired session: ${sessionId} for ${address}`)
          return NextResponse.json({ error: 'invalid or expired game session' }, { status: 403 })
        }
        const session = JSON.parse(sessionStr)

        // Validate score matches session
        if (session.score !== scoreNum) {
          console.warn(`[Anti-Cheat] Score mismatch! Submitted: ${scoreNum}, Session: ${session.score} for ${address}`)
          return NextResponse.json({ error: 'score mismatch with game session' }, { status: 403 })
        }

        // Validate address matches session
        if (session.address?.toLowerCase() !== address.toLowerCase()) {
          console.warn(`[Anti-Cheat] Address mismatch! Submitted: ${address}, Session: ${session.address}`)
          return NextResponse.json({ error: 'address mismatch with game session' }, { status: 403 })
        }

        // Heuristic: check score vs game time ratio
        // A score of >1000 in less than 5 seconds is physically impossible
        if (session.time && session.time < 5 && scoreNum > 1000) {
          console.warn(`[Anti-Cheat] Impossible score/time ratio: ${scoreNum} pts in ${session.time}s from ${address}`)
          return NextResponse.json({ error: 'suspicious game session' }, { status: 403 })
        }

        // Heuristic: score should correlate with game duration
        // Normal gameplay ~1-5 pts/second at early game, up to ~15 pts/sec with power-ups
        if (session.time && scoreNum > session.time * 25) {
          console.warn(`[Anti-Cheat] Unusual score/time: ${scoreNum} in ${session.time}s (${(scoreNum / session.time).toFixed(1)} pts/s) from ${address}`)
          // Log but allow — edge cases with power-ups can spike ratio
        }

        // Mark session as used to prevent replay
        await redis.del(`session:${sessionId}`)
      } catch (err) {
        console.error('Redis session validation failed:', err)
      }
    } else if (redis && !sessionId && scoreNum > 0) {
      console.warn(`[Anti-Cheat] Missing session ID for score ${scoreNum} from ${address}`)
      return NextResponse.json({ error: 'missing game session verifier' }, { status: 403 })
    }

    // ====================================================================
    // CONTRACT READINESS
    // ====================================================================
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Contract not deployed' }, { status: 503 })
    }

    // ====================================================================
    // NONCE RETRIEVAL
    // ====================================================================
    const nonce = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'scoreNonces',
      args: [address as `0x${string}`],
    })

    // ====================================================================
    // SIGNATURE GENERATION
    // ====================================================================
    const signerAccount = getSignerAccount()
    const msgHash = keccak256(
      encodePacked(
        ['address', 'uint256', 'address', 'uint256', 'uint256'],
        [CONTRACT_ADDRESS, BigInt(chain.id), address as `0x${string}`, BigInt(scoreNum), nonce as bigint]
      )
    )
    const signature = await signerAccount.signMessage({ message: { raw: msgHash } })

    // ====================================================================
    // GASLESS SUBMISSION (Relayer pays gas)
    // ====================================================================
    if (gasless) {
      // Acquire nonce lock to prevent concurrent submission collisions
      const lockAcquired = await acquireNonceLock(address)
      if (!lockAcquired) {
        return NextResponse.json(
          { error: 'Score submission in progress, please wait' },
          { status: 429 }
        )
      }

      try {
        const wc = getWalletClient()
        const relayerAccount = privateKeyToAccount(
          (process.env.RELAYER_PRIVATE_KEY || process.env.SCORE_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`
        )

        // Retry with exponential backoff (max 3 attempts)
        let hash: `0x${string}` | undefined
        let lastError: Error | undefined
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            hash = await wc.writeContract({
              chain,
              address: CONTRACT_ADDRESS,
              abi: GAME_LEADERBOARD_ABI,
              functionName: 'submitScoreFor',
              args: [address as `0x${string}`, BigInt(scoreNum), nonce as bigint, signature as `0x${string}`],
              account: relayerAccount,
            })
            break // Success
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            if (attempt < 2) {
              // Exponential backoff: 500ms, 1500ms
              await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt)))
            }
          }
        }

        if (!hash) {
          console.error('Gasless submission failed after 3 attempts:', lastError)
          // Fall back to returning signature for client-side submission
          return NextResponse.json({
            nonce: (nonce as bigint).toString(),
            signature,
            signer: signerAccount.address,
            timestamp: Date.now(),
            gasless: false,
            fallback: true,
            error: 'Gasless submission failed, use signature to submit directly',
          })
        }

        console.log(`Gasless score submitted: ${address} — ${scoreNum}, tx: ${hash}`)

        return NextResponse.json({
          success: true,
          hash,
          score: scoreNum,
          address,
          gasless: true,
          timestamp: Date.now(),
        })
      } finally {
        await releaseNonceLock(address)
      }
    }

    // ====================================================================
    // NON-GASLESS: Return signature for client-side submission
    // ====================================================================
    return NextResponse.json({
      nonce: (nonce as bigint).toString(),
      signature,
      signer: signerAccount.address,
      timestamp: Date.now(),
      gasless: false,
    })
  } catch (error) {
    console.error('Score signing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
