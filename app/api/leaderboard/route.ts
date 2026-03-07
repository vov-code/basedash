import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS, PlayerScore } from '@/app/contracts'

export const dynamic = 'force-dynamic'

/**
 * API endpoint for fetching leaderboard data
 * Proxies on-chain data
 */

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const chain = isTestnet ? baseSepolia : base

const publicClient = createPublicClient({
  chain: chain,
  transport: http(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    // Verify contract is deployed
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        {
          error: 'Contract not deployed',
          leaderboard: []
        },
        { status: 503 }
      )
    }

    // Fetch leaderboard data from contract
    const leaderboard = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'getSortedLeaderboard',
      args: [BigInt(Math.min(limit, 100))],
    }) as PlayerScore[]

    // Format response data
    const formattedLeaderboard = leaderboard.map((entry: PlayerScore) => ({
      player: entry.player,
      score: entry.score.toString(),
      timestamp: entry.timestamp.toString(),
      streakDays: entry.streakDays.toString(),
    }))

    return NextResponse.json({
      leaderboard: formattedLeaderboard,
      count: formattedLeaderboard.length,
    })
  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
