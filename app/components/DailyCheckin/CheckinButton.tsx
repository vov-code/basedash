/**
 * ============================================================================
 * BASE DASH — Daily Check-in Component
 * Обновленный дизайн в стиле Base.org
 * ============================================================================
 */

'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useWallet } from '@/app/hooks/useWallet'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'

// ============================================================================
// TYPES
// ============================================================================

interface CheckInStatus {
  title: string
  description: string
  canCheckIn: boolean
  showStreak: boolean
}

// ============================================================================
// CONFIG
// ============================================================================

const STREAK_REWARDS = [
  { days: 1, bonus: '1x score multiplier' },
  { days: 3, bonus: '2x score multiplier' },
  { days: 7, bonus: '3x score multiplier + gold candles' },
  { days: 14, bonus: '4x score multiplier + rare items' },
  { days: 30, bonus: 'max multiplier + legendary status' },
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

  const getStatusConfig = (): CheckInStatus => {
    if (!address) {
      return {
        title: 'connect wallet',
        description: 'connect your wallet to start earning rewards',
        canCheckIn: false,
        showStreak: false,
      }
    }

    if (!isLinked) {
      return {
        title: 'link farcaster fid',
        description: 'link your farcaster id to enable daily check-ins',
        canCheckIn: false,
        showStreak: false,
      }
    }

    if (!canCheckIn) {
      return {
        title: 'already checked in',
        description: 'come back tomorrow for another reward',
        canCheckIn: false,
        showStreak: true,
      }
    }

    return {
      title: 'daily check-in',
      description: 'check in to keep your streak bonuses active',
      canCheckIn: true,
      showStreak: true,
    }
  }

  const statusConfig = getStatusConfig()

  // ============================================================================
  // RENDER: Not Connected
  // ============================================================================

  if (!address) {
    return (
      <div className=" border border-gray-200 p-6 bg-gradient-to-br from-gray-50 to-white text-center">
        <div className="w-14 h-14 mx-auto mb-4  bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{statusConfig.title}</h3>
        <p className="text-xs text-gray-500 mb-4">{statusConfig.description}</p>
        <button
          onClick={connectWallet}
          className="w-full px-5 py-3  text-sm font-semibold bg-gradient-to-r from-[#0052FF] to-[#0033AA] hover:from-[#0040CC] hover:to-[#002299] text-white transition-all shadow-sm shadow-blue-500/20"
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
      <div className=" border border-gray-200 p-6 bg-gradient-to-br from-blue-50 to-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10  bg-[#0052FF] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">link farcaster fid</h3>
            <p className="text-xs text-gray-500">required for daily check-ins</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">
          linking fid is needed for daily check-ins and streak tracking. score submit works with any connected wallet.
        </p>

        <div className="space-y-3">
          <div>
            <label htmlFor="fid-input" className="block text-xs font-medium text-gray-700 mb-1.5">
              farcaster fid
            </label>
            <input
              id="fid-input"
              type="text"
              inputMode="numeric"
              value={fidInput}
              onChange={(e) => setFidInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="enter your fid (e.g., 12345)"
              className="w-full  border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <button
            onClick={handleLinkWallet}
            disabled={isLinkPending || fidValue <= BigInt(0)}
            className={`w-full py-3.5  font-semibold transition-all ${isLinkPending || fidValue <= BigInt(0)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#0052FF] to-[#0033AA] text-white hover:scale-[1.01]'
              }`}
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
    <div className=" border border-gray-200 p-6 bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10  flex items-center justify-center flex-shrink-0 transition-all ${canCheckIn
              ? 'bg-gradient-to-br from-[#F0B90B] to-[#B8860B]'
              : 'bg-gradient-to-br from-green-500 to-green-600'
            }`}>
            {canCheckIn ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{statusConfig.title}</h3>
            <p className="text-xs text-gray-500">{statusConfig.description}</p>
          </div>
        </div>

        {/* Streak Display */}
        {statusConfig.showStreak && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 tracking-wide">streak</p>
            <p className="text-2xl font-bold text-green-600">{checkInStatus.streak}</p>
            <p className="text-[10px] text-gray-400">days</p>
          </div>
        )}
      </div>

      {/* Streak Progress */}
      {statusConfig.showStreak && checkInStatus.streak > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">current streak bonus</span>
            <span className="text-xs font-medium text-green-600">
              {checkInStatus.streak >= 30 ? 'max' : checkInStatus.streak >= 14 ? 'elite' : checkInStatus.streak >= 7 ? 'pro' : checkInStatus.streak >= 3 ? 'hot' : 'starting'}
            </span>
          </div>
          <div className="h-2 bg-gray-200  overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{
                width: `${Math.min(100, (checkInStatus.streak / 30) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Check-in Button */}
      <button
        onClick={dailyCheckIn}
        disabled={isCheckInPending || !canCheckIn}
        className={`w-full py-3.5  font-semibold transition-all flex items-center justify-center gap-2 ${isCheckInPending || !canCheckIn
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-[#F0B90B] to-[#B8860B] text-white hover:scale-[1.01] shadow-sm shadow-yellow-500/20'
          }`}
      >
        {isCheckInPending ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white  animate-spin" />
            confirming...
          </>
        ) : canCheckIn ? (
          <>
            check in now
          </>
        ) : (
          <>
            already checked in
          </>
        )}
      </button>

      {/* Status Info */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2  ${canSubmitScore ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-gray-500">
            score submission: <span className={canSubmitScore ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {canSubmitScore ? 'ready' : 'wallet required'}
            </span>
          </span>
        </div>
        <button
          onClick={() => setShowRewards(!showRewards)}
          className="text-[#0052FF] hover:text-[#0040CC] font-medium transition-colors"
        >
          {showRewards ? 'hide' : 'view'} rewards
        </button>
      </div>

      {/* Streak Rewards */}
      {showRewards && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-3">streak rewards</p>
          <div className="space-y-2">
            {STREAK_REWARDS.map((reward, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2  ${checkInStatus.streak >= reward.days
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200 opacity-60'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${checkInStatus.streak >= reward.days ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                    {reward.days} days
                  </span>
                </div>
                <span className="text-xs text-gray-600">{reward.bonus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
