import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, encodePacked, keccak256 } from 'viem'
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

// Anti-cheat: track recent requests per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
// Anti-cheat: per-address cooldown (30 seconds between submissions)
const addressCooldown = new Map<string, number>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 })
    return true
  }

  if (record.count >= 10) {
    return false
  }

  record.count++
  return true
}

// Anti-cheat: validate score progression
const maxScoreIncrease = 2.5 // max 2.5x previous best

export async function GET(request: NextRequest) {
  try {
    const pk = process.env.SCORE_SIGNER_PRIVATE_KEY
    if (!pk) {
      return NextResponse.json({ error: 'SCORE_SIGNER_PRIVATE_KEY not configured' }, { status: 503 })
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const scoreStr = searchParams.get('score')

    if (!address || !scoreStr) {
      return NextResponse.json({ error: 'address and score are required' }, { status: 400 })
    }

    const score = Number(scoreStr)
    if (!Number.isFinite(score) || score <= 0) {
      return NextResponse.json({ error: 'invalid score' }, { status: 400 })
    }

    // Anti-cheat: reasonable score limits (max 50K)
    if (score > 50_000) {
      return NextResponse.json({ error: 'score too large' }, { status: 400 })
    }

    // Anti-cheat: per-address cooldown (30 seconds)
    const addrLower = address.toLowerCase()
    const lastSubmit = addressCooldown.get(addrLower) || 0
    if (Date.now() - lastSubmit < 30_000) {
      return NextResponse.json({ error: 'please wait 30 seconds between submissions' }, { status: 429 })
    }
    addressCooldown.set(addrLower, Date.now())

    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Contract not deployed' }, { status: 503 })
    }

    const nonce = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'scoreNonces',
      args: [address as `0x${string}`],
    })

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
    })
  } catch (error) {
    console.error('Score signing error:', error)
    return NextResponse.json(
      { error: 'Failed to sign score', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

