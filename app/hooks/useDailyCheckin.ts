'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SECONDS_IN_DAY = BigInt(86400)

export function useDailyCheckin(address: `0x${string}` | undefined) {
  const [streak, setStreak] = useState(0)
  const [lastCheckIn, setLastCheckIn] = useState<bigint>(BigInt(0))

  const isContractReady = CONTRACT_ADDRESS !== ZERO_ADDRESS

  const { data: linkedFid, refetch: refetchLinkedFid } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'addressToFid',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isContractReady,
      refetchInterval: 60000,
    },
  })

  const { data: checkInData, refetch: refetchCheckIn } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getCheckInStatus',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isContractReady,
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

  const canSubmitScore = useMemo(() => {
    if (!isLinked) return false
    if (!checkInData || !Array.isArray(checkInData)) return false
    const [, , isActive] = checkInData as [bigint, bigint, boolean]
    return isActive
  }, [isLinked, checkInData])

  const linkWallet = useCallback(
    async (fid: bigint) => {
      if (!address || !isContractReady) return
      if (fid <= BigInt(0)) return

      writeLinkWallet({
        address: CONTRACT_ADDRESS,
        abi: GAME_LEADERBOARD_ABI,
        functionName: 'linkWallet',
        args: [fid],
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
      isActive: canSubmitScore,
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
  }
}
