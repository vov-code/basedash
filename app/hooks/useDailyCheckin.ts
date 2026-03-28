'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SECONDS_IN_DAY = BigInt(86400)
const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const activeChainId = isTestnet ? baseSepolia.id : base.id

// ============================================================================
// STREAK MULTIPLIER TIERS
// ============================================================================
export const STREAK_TIERS = [
  { days: 0, multiplier: 1.0, label: 'No Streak', emoji: '💤', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  { days: 1, multiplier: 1.1, label: 'Warming Up', emoji: '🔥', color: '#F0B90B', bg: 'rgba(240,185,11,0.08)' },
  { days: 3, multiplier: 1.25, label: 'On Fire', emoji: '⚡', color: '#F6465D', bg: 'rgba(246,70,93,0.08)' },
  { days: 7, multiplier: 1.5, label: 'Diamond Hands', emoji: '💎', color: '#0052FF', bg: 'rgba(0,82,255,0.08)' },
  { days: 14, multiplier: 2.0, label: 'Legendary', emoji: '👑', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
] as const

export type StreakTier = typeof STREAK_TIERS[number]

export function getStreakTier(streak: number): StreakTier {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].days) return STREAK_TIERS[i]
  }
  return STREAK_TIERS[0]
}

export function getNextStreakTier(streak: number): StreakTier | null {
  for (const tier of STREAK_TIERS) {
    if (tier.days > streak) return tier
  }
  return null // Already at max
}

export function getStreakMultiplier(streak: number): number {
  return getStreakTier(streak).multiplier
}

export function useDailyCheckin(address: `0x${string}` | undefined, enabled = true) {
  const [streak, setStreak] = useState(0)
  const [lastCheckIn, setLastCheckIn] = useState<bigint>(BigInt(0))

  const isContractReady = CONTRACT_ADDRESS !== ZERO_ADDRESS

  const { data: linkedFid, refetch: refetchLinkedFid } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'addressToFid',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isContractReady && enabled,
      refetchInterval: 60000,
    },
  })

  const { data: checkInData, refetch: refetchCheckIn } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getCheckInStatus',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isContractReady && enabled,
      refetchInterval: 60000,
    },
  })

  const {
    writeContract: writeLinkWallet,
    data: linkHash,
    isPending: isLinkPending,
  } = useWriteContract()
  const {
    writeContract: writeDailyCheckIn,
    data: checkInHash,
    isPending: isCheckInPending,
  } = useWriteContract()

  const { isSuccess: isLinkConfirmed } = useWaitForTransactionReceipt({ hash: linkHash })
  const { isSuccess: isCheckInConfirmed } = useWaitForTransactionReceipt({ hash: checkInHash })

  const isLinked = useMemo(() => {
    if (!linkedFid || typeof linkedFid !== 'bigint') return false
    return linkedFid > BigInt(0)
  }, [linkedFid])

  const canCheckIn = useMemo(() => {
    if (!isLinked) return false
    const today = BigInt(Math.floor(Date.now() / 1000)) / SECONDS_IN_DAY
    const lastDay = lastCheckIn / SECONDS_IN_DAY
    return today > lastDay
  }, [isLinked, lastCheckIn])

  const isCheckInActive = useMemo(() => {
    if (!checkInData || !Array.isArray(checkInData)) return false
    const [, , isActive] = checkInData as [bigint, bigint, boolean]
    return isActive
  }, [checkInData])

  const canSubmitScore = useMemo(() => {
    if (!address) return false
    if (!isContractReady) return false
    return true
  }, [address, isContractReady])

  // Streak multiplier calculations
  const streakMultiplier = useMemo(() => getStreakMultiplier(streak), [streak])
  const streakTier = useMemo(() => getStreakTier(streak), [streak])
  const nextTier = useMemo(() => getNextStreakTier(streak), [streak])

  const linkWallet = useCallback(
    async (fid: bigint) => {
      if (!address || !isContractReady) return
      if (fid <= BigInt(0)) return

      writeLinkWallet({
        address: CONTRACT_ADDRESS,
        abi: GAME_LEADERBOARD_ABI,
        functionName: 'linkWallet',
        args: [fid],
        chainId: activeChainId,
      })
    },
    [address, isContractReady, writeLinkWallet]
  )

  const dailyCheckIn = useCallback(async () => {
    if (!address || !canCheckIn || !isContractReady) return

    writeDailyCheckIn({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'dailyCheckIn',
      chainId: activeChainId,
    })
  }, [address, canCheckIn, isContractReady, writeDailyCheckIn])

  useEffect(() => {
    if (checkInData && Array.isArray(checkInData)) {
      const [lastCheckInTs, streakDays] = checkInData as [bigint, bigint, boolean]
      setLastCheckIn(lastCheckInTs)
      setStreak(Number(streakDays))
    }
  }, [checkInData])

  useEffect(() => {
    if (isLinkConfirmed || isCheckInConfirmed) {
      void refetchLinkedFid()
      void refetchCheckIn()
    }
  }, [isLinkConfirmed, isCheckInConfirmed, refetchLinkedFid, refetchCheckIn])

  return {
    checkInStatus: {
      streak,
      isActive: isCheckInActive,
      canCheckIn,
      isLinked,
      linkedFid: isLinked && typeof linkedFid === 'bigint' ? linkedFid : BigInt(0),
      lastCheckIn,
    },
    isLinked,
    linkWallet,
    isLinkPending,
    isLinkConfirmed,
    dailyCheckIn,
    isCheckInPending,
    isCheckInConfirmed,
    canCheckIn,
    canSubmitScore,
    // Streak multiplier data
    streakMultiplier,
    streakTier,
    nextTier,
  }
}

