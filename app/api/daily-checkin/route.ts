import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'

export const dynamic = 'force-dynamic'

/**
 * API endpoint для проверки статуса ежедневного check-in
 * Используется для предсказания состояния перед ончейн запросом
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
    const address = searchParams.get('address')
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter required' },
        { status: 400 }
      )
    }
    
    // Проверка адреса контракта
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { 
          error: 'Contract not deployed',
          checkInStatus: null
        },
        { status: 503 }
      )
    }
    
    // Получение статуса check-in из контракта
    const checkInStatus = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'getCheckInStatus',
      args: [address as `0x${string}`],
    })
    
    // Форматирование данных
    const [lastCheckIn, streak, isActive] = checkInStatus as [bigint, bigint, boolean]
    
    // Определение можно ли сделать check-in сегодня
    const now = Math.floor(Date.now() / 1000)
    const lastCheckInDay = Number(lastCheckIn / BigInt(86400))
    const today = Math.floor(now / 86400)
    const canCheckIn = today > lastCheckInDay
    
    return NextResponse.json({
      checkInStatus: {
        lastCheckIn: lastCheckIn.toString(),
        lastCheckInDay,
        streak: streak.toString(),
        isActive,
        canCheckIn,
        today,
      },
    })
  } catch (error) {
    console.error('Daily Check-in API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch check-in status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
