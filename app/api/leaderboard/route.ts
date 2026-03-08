import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS, PlayerScore } from '@/app/contracts'
import Redis from 'ioredis'

export const dynamic = 'force-dynamic'

/**
 * Leaderboard API — proxies on-chain data with Redis caching.
 * 
 * Performance optimization:
 * - Redis cache with 30-second TTL avoids redundant RPC calls
 * - getSortedLeaderboard runs O(n²) sort in-memory on the RPC node,
 *   so caching prevents this from running on every page view
 * - Cache key includes limit to avoid serving wrong-sized results
 */

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const chain = isTestnet ? baseSepolia : base

const publicClient = createPublicClient({
  chain,
  transport: http(),
})

const redisUrl = process.env.REDIS_URL || process.env.KV_URL
const redis = redisUrl ? new Redis(redisUrl) : null

const CACHE_TTL_SECONDS = 30

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)

    // Verify contract is deployed
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { error: 'Contract not deployed', leaderboard: [] },
        { status: 503 }
      )
    }

    // Check Redis cache first
    const cacheKey = `lb:sorted:${limit}`
    if (redis) {
      try {
        const cached = await redis.get(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          return NextResponse.json({
            leaderboard: parsed,
            count: parsed.length,
            cached: true,
          })
        }
      } catch (err) {
        console.error('Redis cache read error:', err)
      }
    }

    // Cache miss — fetch from chain
    const leaderboard = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'getSortedLeaderboard',
      args: [BigInt(limit)],
    }) as PlayerScore[]

    // Format response data
    const formattedLeaderboard = leaderboard.map((entry: PlayerScore) => ({
      player: entry.player,
      score: entry.score.toString(),
      timestamp: entry.timestamp.toString(),
      streakDays: entry.streakDays.toString(),
    }))

    // Write to Redis cache with TTL
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(formattedLeaderboard), 'EX', CACHE_TTL_SECONDS)
      } catch (err) {
        console.error('Redis cache write error:', err)
      }
    }

    return NextResponse.json({
      leaderboard: formattedLeaderboard,
      count: formattedLeaderboard.length,
      cached: false,
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
