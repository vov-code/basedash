import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, encodePacked, keccak256, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'

export const dynamic = 'force-dynamic'

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const chain = isTestnet ? baseSepolia : base

const publicClient = createPublicClient({
  chain,
  transport: http(),
})

// ============================================================================
// ANTI-CHEAT: Multi-layer rate limiting & abuse prevention
// ============================================================================

// Layer 1: IP-based rate limiting (sliding window)
interface IPRateLimit {
  count: number
  resetTime: number
  blockedUntil?: number
}
const ipRateLimitMap = new Map<string, IPRateLimit>()

// Layer 2: Address-based cooldown
const addressCooldown = new Map<string, number>()

// Layer 3: Suspicious pattern detection
const suspiciousPatterns = new Map<string, { count: number; lastSeen: number }>()

// Layer 4: Simple CAPTCHA-like challenge (time-based)
const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET || 'default-challenge-secret'

function generateChallenge(ip: string): string {
  const timestamp = Date.now()
  const challenge = `${ip}-${timestamp}-${CHALLENGE_SECRET}`
  return Buffer.from(challenge).toString('base64')
}

function verifyChallenge(ip: string, challenge: string): boolean {
  try {
    const decoded = Buffer.from(challenge, 'base64').toString('utf-8')
    const [challengeIP, timestamp] = decoded.split('-')
    const age = Date.now() - parseInt(timestamp)
    return challengeIP === ip && age < 300000 // 5 minutes validity
  } catch {
    return false
  }
}

function checkRateLimit(ip: string, address: string): { allowed: boolean; challenge?: string; retryAfter?: number } {
  const now = Date.now()
  
  // Check for suspicious patterns
  const pattern = suspiciousPatterns.get(ip)
  if (pattern && pattern.count > 50 && now - pattern.lastSeen < 300000) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((300000 - (now - pattern.lastSeen)) / 1000) 
    }
  }

  // Get or create IP record
  const record = ipRateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 })
    return { allowed: true }
  }

  // Check if IP is temporarily blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000) 
    }
  }

  // Progressive rate limiting
  if (record.count >= 5 && record.count < 10) {
    // Require challenge after 5 requests
    return { allowed: true, challenge: generateChallenge(ip) }
  }

  if (record.count >= 10 && record.count < 20) {
    // Stricter limits - require valid challenge
    return { allowed: false, retryAfter: 30 }
  }

  if (record.count >= 20) {
    // Block IP temporarily
    record.blockedUntil = now + 300000 // 5 minutes
    ipRateLimitMap.set(ip, record)
    
    // Mark as suspicious
    suspiciousPatterns.set(ip, { count: (pattern?.count || 0) + 1, lastSeen: now })
    
    return { 
      allowed: false, 
      retryAfter: 300 
    }
  }

  record.count++
  ipRateLimitMap.set(ip, record)
  return { allowed: true }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  // Convert to array for iteration compatibility
  const ipEntries = Array.from(ipRateLimitMap.entries())
  const addressEntries = Array.from(addressCooldown.entries())
  
  for (const [ip, record] of ipEntries) {
    if (now > record.resetTime + 300000) {
      ipRateLimitMap.delete(ip)
    }
  }
  for (const [addr, time] of addressEntries) {
    if (now - time > 300000) {
      addressCooldown.delete(addr)
    }
  }
}, 60000) // Run every minute

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

    // Check rate limit with challenge support
    const rateLimitResult = checkRateLimit(ip, address)
    
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

    // Anti-cheat: per-address cooldown (30 seconds)
    const addrLower = address.toLowerCase()
    const lastSubmit = addressCooldown.get(addrLower) || 0
    if (Date.now() - lastSubmit < 30_000) {
      return NextResponse.json(
        { 
          error: 'please wait between submissions',
          retryAfter: 30 - Math.floor((Date.now() - lastSubmit) / 1000)
        },
        { status: 429 }
      )
    }
    addressCooldown.set(addrLower, Date.now())

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
    })
  } catch (error) {
    console.error('Score signing error:', error)
    return NextResponse.json(
      { error: 'Failed to sign score', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

