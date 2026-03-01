/**
 * ============================================================================
 * BASE DASH — Daily Check-in Component
 * Premium design matching Base Dash game aesthetic
 * ============================================================================
 */

'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useWallet } from '@/app/hooks/useWallet'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'

// ============================================================================
// CONFIG
// ============================================================================

const STREAK_REWARDS = [
  { days: 1, bonus: '1x score multiplier' },
  { days: 3, bonus: '2x score multiplier' },
  { days: 7, bonus: '3x + gold candles' },
  { days: 14, bonus: '4x + rare items' },
  { days: 30, bonus: 'max multiplier + legend' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DailyCheckinButton() {
  const { address, connectWallet } = useWallet()
  const {
    checkInStatus,
    dailyCheckIn,
    isCheckInPending,
    canSubmitScore,
    canCheckIn,
    isLinked,
    linkWallet,
    isLinkPending,
  } = useDailyCheckin(address)

  const [fidInput, setFidInput] = useState('')
  const [showRewards, setShowRewards] = useState(false)

  const fidValue = useMemo(() => {
    if (!fidInput.trim()) return BigInt(0)
    if (!/^\d+$/.test(fidInput.trim())) return BigInt(0)
    return BigInt(fidInput.trim())
  }, [fidInput])

  const handleLinkWallet = useCallback(async () => {
    if (fidValue <= BigInt(0)) return
    await linkWallet(fidValue)
  }, [fidValue, linkWallet])

  const mono = { fontFamily: 'var(--font-mono, monospace)' }

  // ============================================================================
  // RENDER: Not Connected
  // ============================================================================

  if (!address) {
    return (
      <div className="rounded-2xl border border-slate-200/60 p-5 bg-gradient-to-br from-slate-50/80 to-white text-center backdrop-blur-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[#0052FF]/10 to-[#0052FF]/5 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-[11px] font-black text-slate-800 mb-1 lowercase tracking-wider" style={mono}>connect wallet</h3>
        <p className="text-[9px] text-slate-500 mb-4 font-medium" style={mono}>connect to start earning streak rewards</p>
        <button
          onClick={connectWallet}
          className="w-full px-4 py-2.5 rounded-xl text-[10px] font-black bg-gradient-to-r from-[#0052FF] to-[#003FCC] text-white transition-all active:scale-[0.98] shadow-[0_4px_12px_rgba(0,82,255,0.25)] lowercase tracking-widest"
          style={mono}
        >
          connect wallet
        </button>
      </div>
    )
  }

  // ============================================================================
  // RENDER: Not Linked
  // ============================================================================

  if (!isLinked) {
    return (
      <div className="rounded-2xl border border-[#0052FF]/15 p-5 bg-gradient-to-br from-[#0052FF]/[0.04] to-white backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#003FCC] flex items-center justify-center flex-shrink-0 shadow-[0_4px_8px_rgba(0,82,255,0.2)]">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-[11px] font-black text-slate-800 lowercase tracking-wider" style={mono}>link farcaster</h3>
            <p className="text-[8px] text-slate-400 font-medium" style={mono}>required for daily check-ins</p>
          </div>
        </div>

        <p className="text-[8px] text-slate-500 mb-3 leading-relaxed font-medium" style={mono}>
          link your farcaster fid to enable daily check-ins and streak tracking.
        </p>

        <div className="space-y-2.5">
          <input
            type="text"
            inputMode="numeric"
            value={fidInput}
            onChange={(e) => setFidInput(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="enter fid (e.g., 12345)"
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-[10px] text-slate-800 outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 transition-all font-bold"
            style={mono}
          />

          <button
            onClick={handleLinkWallet}
            disabled={isLinkPending || fidValue <= BigInt(0)}
            className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all lowercase tracking-widest ${isLinkPending || fidValue <= BigInt(0)
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#0052FF] to-[#003FCC] text-white active:scale-[0.98] shadow-[0_4px_12px_rgba(0,82,255,0.25)]'
              }`}
            style={mono}
          >
            {isLinkPending ? 'linking...' : 'link wallet'}
          </button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: Linked (Check-in Available)
  // ============================================================================

  return (
    <div className="rounded-2xl border border-slate-200/60 p-5 bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${canCheckIn
            ? 'bg-gradient-to-br from-[#F0B90B] to-[#D4A002] shadow-[0_4px_8px_rgba(240,185,11,0.25)]'
            : 'bg-gradient-to-br from-[#0ECB81] to-[#059669] shadow-[0_4px_8px_rgba(14,203,129,0.2)]'
            }`}>
            {canCheckIn ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-black text-slate-800 lowercase tracking-wider" style={mono}>
              {canCheckIn ? 'daily check-in' : 'checked in ✓'}
            </h3>
            <p className="text-[8px] text-slate-400 font-medium" style={mono}>
              {canCheckIn ? 'keep your streak alive' : 'come back tomorrow'}
            </p>
          </div>
        </div>

        {/* Streak Badge */}
        <div className="text-center px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-[#0ECB81]/10 to-[#0ECB81]/5 border border-[#0ECB81]/15">
          <p className="text-[18px] font-black text-[#0ECB81] leading-none" style={mono}>{checkInStatus.streak}</p>
          <p className="text-[6px] font-bold text-[#0ECB81]/60 uppercase tracking-widest mt-0.5" style={mono}>streak</p>
        </div>
      </div>

      {/* Progress Bar */}
      {checkInStatus.streak > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider" style={mono}>streak progress</span>
            <span className="text-[7px] font-black text-[#0ECB81] uppercase tracking-wider" style={mono}>
              {checkInStatus.streak >= 30 ? 'max' : checkInStatus.streak >= 14 ? 'elite' : checkInStatus.streak >= 7 ? 'pro' : checkInStatus.streak >= 3 ? 'hot' : 'start'}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0ECB81] to-[#059669] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (checkInStatus.streak / 30) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Check-in Button */}
      <button
        onClick={dailyCheckIn}
        disabled={isCheckInPending || !canCheckIn}
        className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 lowercase tracking-widest ${isCheckInPending || !canCheckIn
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-[#F0B90B] to-[#D4A002] text-white active:scale-[0.98] shadow-[0_4px_12px_rgba(240,185,11,0.25)]'
          }`}
        style={mono}
      >
        {isCheckInPending ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            confirming...
          </>
        ) : canCheckIn ? 'check in now' : 'already checked in'}
      </button>

      {/* Status + Rewards Toggle */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${canSubmitScore ? 'bg-[#0ECB81] animate-pulse shadow-[0_0_4px_rgba(14,203,129,0.5)]' : 'bg-slate-300'}`} />
          <span className="text-[7px] font-bold text-slate-400" style={mono}>
            scores: <span className={canSubmitScore ? 'text-[#0ECB81]' : 'text-slate-400'}>{canSubmitScore ? 'ready' : 'wallet required'}</span>
          </span>
        </div>
        <button
          onClick={() => setShowRewards(!showRewards)}
          className="text-[7px] font-black text-[#0052FF] hover:text-[#003FCC] transition-colors lowercase tracking-wider"
          style={mono}
        >
          {showRewards ? 'hide' : 'view'} rewards
        </button>
      </div>

      {/* Streak Rewards Table */}
      {showRewards && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[8px] font-black text-slate-500 mb-2 lowercase tracking-wider" style={mono}>streak rewards</p>
          <div className="space-y-1">
            {STREAK_REWARDS.map((reward, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${checkInStatus.streak >= reward.days
                  ? 'bg-[#0ECB81]/8 border border-[#0ECB81]/15'
                  : 'bg-slate-50 border border-slate-100 opacity-50'
                  }`}
              >
                <span className={`text-[8px] font-bold ${checkInStatus.streak >= reward.days ? 'text-slate-700' : 'text-slate-400'}`} style={mono}>
                  {reward.days}d
                </span>
                <span className="text-[7px] font-medium text-slate-500" style={mono}>{reward.bonus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
