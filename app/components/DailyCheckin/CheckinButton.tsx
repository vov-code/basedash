'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useWallet } from '@/app/hooks/useWallet'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'

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

  const fidValue = useMemo(() => {
    if (!fidInput.trim()) return BigInt(0)
    if (!/^\d+$/.test(fidInput.trim())) return BigInt(0)
    return BigInt(fidInput.trim())
  }, [fidInput])

  const handleLinkWallet = useCallback(async () => {
    if (fidValue <= BigInt(0)) return
    await linkWallet(fidValue)
  }, [fidValue, linkWallet])

  if (!address) {
    return (
      <div className="rounded-xl border border-white/10 p-6 bg-white/[0.02] text-center">
        <p className="text-white/80 font-semibold mb-3">Connect Wallet</p>
        <button onClick={connectWallet} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0052FF] hover:bg-[#0033AA] transition-colors">
          Connect
        </button>
      </div>
    )
  }

  if (!isLinked) {
    return (
      <div className="rounded-xl border border-white/10 p-6 bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-white mb-3">Link Wallet to Farcaster FID</h3>
        <p className="text-xs text-white/50 mb-4">
          Contract requires linked wallet before daily check-in and score submit.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            value={fidInput}
            onChange={(e) => setFidInput(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Enter your FID"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#0052FF]"
          />
          <button
            onClick={handleLinkWallet}
            disabled={isLinkPending || fidValue <= BigInt(0)}
            className={`w-full py-3.5 rounded-xl font-semibold transition-all ${
              isLinkPending || fidValue <= BigInt(0)
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#0052FF] to-[#0033AA] text-white hover:scale-[1.01]'
            }`}
          >
            {isLinkPending ? 'Linking...' : 'Link Wallet'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 p-6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${canSubmitScore ? 'bg-[#0ECB81] animate-pulse' : 'bg-[#F0B90B]'}`} />
          <h3 className="text-sm font-semibold text-white">Daily Check-in</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase">Streak</p>
          <p className="text-xl font-bold text-[#0ECB81]">{checkInStatus.streak} days</p>
        </div>
      </div>

      <button
        onClick={dailyCheckIn}
        disabled={isCheckInPending || !canCheckIn}
        className={`w-full py-3.5 rounded-xl font-semibold transition-all ${
          isCheckInPending || !canCheckIn
            ? 'bg-white/10 text-white/40 cursor-not-allowed'
            : 'bg-gradient-to-r from-[#F0B90B] to-[#B8860B] text-white hover:scale-105'
        }`}
      >
        {isCheckInPending ? 'Confirming...' : canCheckIn ? 'Check In' : 'Already Checked In'}
      </button>
      <p className="text-[11px] text-white/45 mt-3">
        Score submission: {canSubmitScore ? 'active' : 'inactive'}.
      </p>
    </div>
  )
}
