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

export async function GET(request: NextRequest) {
  try {
    const pk = process.env.SCORE_SIGNER_PRIVATE_KEY
    if (!pk) {
      return NextResponse.json({ error: 'SCORE_SIGNER_PRIVATE_KEY not configured' }, { status: 503 })
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

    // “верхний предел” — не защита от всего, но режет очевидные абузы
    if (score > 1_000_000) {
      return NextResponse.json({ error: 'score too large' }, { status: 400 })
    }

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
    return NextResponse.json(
      { error: 'Failed to sign score', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

