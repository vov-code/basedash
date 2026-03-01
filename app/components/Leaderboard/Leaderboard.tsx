'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS, PlayerScore } from '@/app/contracts'
import { bigIntToNumber } from '@/app/lib/utils'
import { useWallet } from '@/app/hooks/useWallet'
import { LeaderboardEntry } from './LeaderboardEntry'

export default function Leaderboard() {
  const { address } = useWallet()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const selfEntryRef = useRef<HTMLDivElement>(null)

  const { data: leaderboard, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getSortedLeaderboard',
    args: [BigInt(33)],
    query: {
      enabled: CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
    },
  })

  // Get player's on-chain rank (works even outside top 33) — item 18
  const { data: playerRankData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getPlayerRank',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 30000,
    },
  })

  const scores = useMemo(() => {
    const data = (leaderboard as unknown as PlayerScore[]) || []
    if (!Array.isArray(data)) return []
    return data.filter((s) => s && s.player && s.player !== '0x0000000000000000000000000000000000000000')
  }, [leaderboard])

  // Find user's rank
  const userRank = useMemo(() => {
    if (!address) return null
    const idx = scores.findIndex(s => s && s.player && s.player.toLowerCase() === address.toLowerCase())
    return idx >= 0 ? idx + 1 : null
  }, [scores, address])

  // Auto-scroll to user's entry (Improvement #3)
  useEffect(() => {
    if (selfEntryRef.current && userRank && userRank > 5) {
      selfEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [userRank, scores])

  const topScore = scores.length > 0 ? bigIntToNumber(scores[0].score) : 0
  const maxStreak = scores.reduce((max, s) => Math.max(max, bigIntToNumber(s.streakDays)), 0)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-50 text-yellow-500">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-black text-slate-800 lowercase tracking-wide" style={{ fontFamily: 'var(--font-mono, monospace)' }}>contract not deployed</p>
        <p className="text-[11px] text-slate-400 font-medium">deploy contract to enable on-chain leaderboard</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-lg mx-auto py-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 animate-pulse">
              <div className="w-8 h-8 bg-slate-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
                <div className="h-2 bg-slate-50 rounded-lg w-1/3" />
              </div>
              <div className="w-16 h-5 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0052FF]/15 bg-[#0052FF]/5 text-[#0052FF]">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M7 20v-7M12 20V6M17 20v-4" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-black text-slate-800 lowercase tracking-wide" style={{ fontFamily: 'var(--font-mono, monospace)' }}>no scores yet</p>
        <p className="text-[11px] text-slate-400 font-medium mb-0.5">be first in base dash leaderboard</p>
        <p className="text-[10px] text-slate-300 font-medium">play a round and submit your score on-chain</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto py-3 sm:py-4 animate-[fadeInUp_0.4s_ease-out] mb-6">
      {/* Header */}
      <div className="mb-4 sm:mb-5 flex flex-row items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight lowercase" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
            <svg className="h-3.5 w-3.5 text-[#0052FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
            leaderboard
          </h2>
          <p className="mt-0.5 text-[10px] font-medium text-slate-400" style={{ fontFamily: 'var(--font-mono, monospace)' }}>auto refresh every 30s</p>
        </div>

        <button
          onClick={() => void handleRefresh()}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-all bg-white/60 hover:bg-white/90 border border-slate-200/50 active:scale-95"
          style={{ fontFamily: 'var(--font-mono, monospace)' }}
        >
          <svg className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isRefreshing ? 'animate-spin text-[#0052FF]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">refresh</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="bg-white/60 backdrop-blur-sm py-3 text-center rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <p className="text-lg font-black text-slate-800 leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{scores.length}</p>
          <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400" style={{ fontFamily: 'var(--font-mono, monospace)' }}>players</p>
        </div>

        <div className="bg-[#0052FF]/[0.04] backdrop-blur-sm py-3 text-center rounded-2xl border border-[#0052FF]/10 shadow-[0_2px_8px_rgba(0,82,255,0.04)]">
          <p className="text-lg font-black text-[#0052FF] leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{topScore.toLocaleString()}</p>
          <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-[#0052FF]/60" style={{ fontFamily: 'var(--font-mono, monospace)' }}>top score</p>
        </div>

        <div className="bg-[#F0B90B]/[0.04] backdrop-blur-sm py-3 text-center rounded-2xl border border-[#F0B90B]/10 shadow-[0_2px_8px_rgba(240,185,11,0.04)]">
          <p className="text-lg font-black text-[#D4A002] leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{maxStreak}</p>
          <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-[#D4A002]/60" style={{ fontFamily: 'var(--font-mono, monospace)' }}>best streak</p>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100/80">
          {scores.map((entry, i) => (
            <LeaderboardEntry
              key={`${entry.player}-${i}`}
              entry={entry}
              rank={i + 1}
              isSelf={!!address && entry.player.toLowerCase() === address.toLowerCase()}
              selfRef={selfEntryRef}
            />
          ))}
        </div>
      </div>

      {/* User rank indicator — shows for all connected wallets (item 18) */}
      {address && (
        <div className="mt-4 flex items-center justify-center gap-2 py-2.5 bg-[#0052FF]/[0.04] rounded-2xl border border-[#0052FF]/10">
          <span className="text-[10px] font-black text-slate-600 lowercase tracking-widest" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
            {userRank
              ? `your rank: #${userRank} of ${scores.length}`
              : (playerRankData && typeof playerRankData === 'bigint')
                ? `your position: #${bigIntToNumber(playerRankData as bigint)} of ${scores.length}+`
                : 'play to rank'}
          </span>
        </div>
      )}

      <div className="mt-5 pt-3 text-center">
        <p className="text-[10px] font-medium text-slate-300" style={{ fontFamily: 'var(--font-mono, monospace)' }}>scores stored on-chain · base network</p>
      </div>
    </div>
  )
}
