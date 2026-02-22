'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS, PlayerScore } from '@/app/contracts'
import { formatAddress, bigIntToNumber } from '@/app/lib/utils'
import { useWallet } from '@/app/hooks/useWallet'
import { Identity, Avatar, Name } from '@coinbase/onchainkit/identity'

interface RankMeta {
  label: string
  tone: string
  border: string
  text: string
}

const RANK_META: Record<number, RankMeta> = {
  1: {
    label: '1',
    tone: 'bg-[#fff8dd]',
    border: 'border-[#f8da7f]',
    text: 'text-[#b78905]',
  },
  2: {
    label: '2',
    tone: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-600',
  },
  3: {
    label: '3',
    tone: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
  },
}

function Entry({ entry, rank, isSelf, selfRef }: { entry: PlayerScore; rank: number; isSelf: boolean; selfRef?: React.Ref<HTMLDivElement> }) {
  const score = bigIntToNumber(entry.score)
  const streak = bigIntToNumber(entry.streakDays)
  const meta = RANK_META[rank]

  return (
    <div
      ref={isSelf ? selfRef : undefined}
      className={`flex items-center justify-between p-3 sm:p-4 mb-2 rounded-2xl transition-all border ${isSelf
        ? 'border-[#0052FF]/30 bg-[#0052FF]/5 shadow-[0_8px_16px_rgba(0,82,255,0.08)]'
        : rank <= 3
          ? `${meta.tone} ${meta.border} shadow-sm`
          : 'border-slate-200/60 bg-white hover:border-slate-300 shadow-sm'
        }`}
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl border text-xs sm:text-sm font-black shadow-inner ${rank <= 3 ? `${meta.tone} ${meta.border} ${meta.text}` : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
        >
          {rank <= 3 ? meta.label : `#${rank}`}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Identity
              address={entry.player as `0x${string}`}
              className="inline-flex items-center gap-1.5 border border-slate-200/60 bg-white/50 px-2 py-1 rounded-lg shadow-sm"
              hasCopyAddressOnClick
            >
              <Avatar className="w-4 h-4 sm:w-5 sm:h-5 bg-blue-100" />
              <Name className="font-mono text-[10px] sm:text-xs font-bold text-slate-700 truncate min-w-0" />
            </Identity>
            {isSelf && (
              <span className="border border-[#0052FF]/20 bg-[#0052FF]/10 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-[#0052FF]">
                you
              </span>
            )}
          </div>

          {streak > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] text-orange-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3c1 2-1 3-1 5 0 2 2 2 2 4a3 3 0 0 1-6 0c0-4 3-5 5-9z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 10c1 1 3 2 3 5a5 5 0 0 1-10 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {streak} day streak
            </div>
          )}
        </div>
      </div>

      <div className="ml-3 sm:ml-4 flex-shrink-0 text-right">
        <p className="font-mono text-lg sm:text-xl font-black text-slate-900 tracking-tight">{score.toLocaleString()}</p>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#0ECB81] mt-0.5">pnl</p>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const { address } = useWallet()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const selfEntryRef = useRef<HTMLDivElement>(null)

  const { data: leaderboard, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getLeaderboard',
    args: [BigInt(33)],
    query: {
      enabled: CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
    },
  })

  const scores = useMemo(() => {
    const data = (leaderboard as unknown as PlayerScore[]) || []
    return data.filter((s) => s.player !== '0x0000000000000000000000000000000000000000')
  }, [leaderboard])

  // Find user's rank
  const userRank = useMemo(() => {
    if (!address) return null
    const idx = scores.findIndex(s => s.player.toLowerCase() === address.toLowerCase())
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
      <div className="border border-slate-200 bg-white p-8 text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-yellow-300 bg-yellow-50 text-yellow-600">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="mb-2 font-semibold text-slate-900">contract not deployed</p>
        <p className="text-sm text-slate-500">deploy contract to enable on-chain leaderboard</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center border border-slate-200 bg-white p-8 py-14 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="h-10 w-10 animate-spin border-4 border-[#0052FF]/20 border-t-[#0052FF]" />
        <span className="ml-4 text-sm text-slate-500">loading leaderboard...</span>
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <div className="border border-slate-200 bg-white p-8 text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-[#bcd4ff] bg-[#edf4ff] text-[#0052FF]">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M7 20v-7M12 20V6M17 20v-4" />
          </svg>
        </div>
        <p className="mb-2 font-semibold text-slate-900">no scores yet</p>
        <p className="mb-1 text-sm text-slate-500">be first in base dash leaderboard</p>
        <p className="text-xs text-slate-400">play run and submit score on-chain</p>
      </div>
    )
  }

  return (
    <div className="border border-[#e5e7eb]/80 bg-white/80 backdrop-blur-xl p-3 sm:p-6 shadow-sm rounded-2xl sm:rounded-3xl mx-2 sm:mx-0 animate-[fadeInUp_0.4s_ease-out] mb-6">
      <div className="mb-5 sm:mb-6 flex flex-row items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 tracking-tight">
            <svg className="h-5 w-5 text-[#F0B90B]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.8-6.3 4.8 2.3-7.4-6-4.6h7.6z" />
            </svg>
            leaderboard
          </h2>
          <p className="mt-1 text-[11px] font-medium text-slate-500">auto refresh every 30s</p>
        </div>

        <button
          onClick={() => void handleRefresh()}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm active:scale-95"
        >
          <svg className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isRefreshing ? 'animate-spin text-[#0052FF]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">refresh</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="border border-slate-200/60 bg-white p-2.5 sm:p-3 text-center rounded-2xl shadow-sm">
          <p className="text-lg sm:text-2xl font-black text-slate-900">{scores.length}</p>
          <p className="mt-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">players</p>
        </div>

        <div className="border border-[#0052FF]/20 bg-[#0052FF]/5 p-2.5 sm:p-3 text-center rounded-2xl shadow-sm">
          <p className="text-lg sm:text-2xl font-black text-[#0052FF] font-mono">{topScore.toLocaleString()}</p>
          <p className="mt-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-[#0052FF]/70">top score</p>
        </div>

        <div className="border border-[#F0B90B]/20 bg-[#F0B90B]/5 p-2.5 sm:p-3 text-center rounded-2xl shadow-sm">
          <p className="text-lg sm:text-2xl font-black text-[#D4A002]">{maxStreak}</p>
          <p className="mt-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-[#D4A002]/70">best streak</p>
        </div>
      </div>

      <div className="space-y-2">
        {scores.map((entry, i) => (
          <Entry
            key={`${entry.player}-${i}`}
            entry={entry}
            rank={i + 1}
            isSelf={!!address && entry.player.toLowerCase() === address.toLowerCase()}
            selfRef={selfEntryRef}
          />
        ))}
      </div>

      {/* User rank indicator (Improvement #3) */}
      {userRank && (
        <div className="mt-4 flex items-center justify-center gap-2 border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-black text-[#0052FF] uppercase tracking-wide">your rank: #{userRank}</span>
        </div>
      )}

      <div className="mt-6 border-t border-slate-100 pt-4 text-center">
        <p className="text-xs text-slate-400">scores are stored on-chain on base network</p>
      </div>
    </div>
  )
}
