/**
 * ============================================================================
 * BASE DASH — Main Page
 * ============================================================================
 */

'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import GameEngine from './components/Game/GameEngine'
import DailyCheckinButton from './components/DailyCheckin/CheckinButton'
import { useWallet } from './hooks/useWallet'
import { useDailyCheckin } from './hooks/useDailyCheckin'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from './contracts'
import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet'
import { Avatar, Name } from '@coinbase/onchainkit/identity'
import Leaderboard from './components/Leaderboard/Leaderboard'

import ParticleChaos from './components/Background/ParticleChaos'
import { Header } from './components/UI/Header'
import { DashboardGrid } from './components/UI/DashboardGrid'

// ============================================================================
// MAIN PAGE
// ============================================================================

type TabType = 'game' | 'leaderboard' | 'profile'

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [desktopBypass, setDesktopBypass] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const [hasPlayedChime, setHasPlayedChime] = useState(false)
  const [isClientLoaded, setIsClientLoaded] = useState(false)

  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()
  const { checkInStatus, canSubmitScore } = useDailyCheckin(address, activeTab === 'profile')
  const networkLabel = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'base sepolia' : 'base mainnet'

  // Run only on client side after hydration
  useEffect(() => {
    setIsClientLoaded(true)

    // Check if new user
    const hasVisited = localStorage.getItem('bd_visited') === '1'
    const chimePlayed = localStorage.getItem('bd_played_chime') === '1'
    setHasPlayedChime(chimePlayed)

    // Touch bypass logic
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || (navigator.maxTouchPoints > 0)

    if (isTouch) {
      setDesktopBypass(true)
    } else {
      // Desktop skips intro overlay after a very short delay
      setTimeout(() => setHasEntered(true), 150)
    }

    // Auto-enter fallback for mobile
    if (!hasVisited && isTouch) {
      const timeoutId = setTimeout(() => handleEnterRef.current(), 15000) // 15s auto-enter for new users
      return () => clearTimeout(timeoutId)
    } else if (hasVisited && isTouch) {
      const timeoutId = setTimeout(() => handleEnterRef.current(), 6000) // Fast auto-enter for returning
      return () => clearTimeout(timeoutId)
    }
  }, [])

  // Stable enter function via ref (prevents stale closure)
  const handleEnterRef = useRef<() => void>(() => { })
  handleEnterRef.current = () => {
    if (hasEntered || isEntering) return
    setIsEntering(true)
    localStorage.setItem('bd_visited', '1')
    if (!hasPlayedChime) {
      localStorage.setItem('bd_played_chime', '1')
      setHasPlayedChime(true)
    }
    setTimeout(() => setHasEntered(true), 400)
  }
  const handleEnter = useCallback(() => handleEnterRef.current(), [])

  const { writeContractAsync } = useWriteContract()
  const [submitTxHash, setSubmitTxHash] = useState<`0x${string}` | undefined>()
  const { isSuccess: isScoreConfirmed } = useWaitForTransactionReceipt({ hash: submitTxHash })

  const handleConnect = useCallback(async () => {
    try { await connectWallet() } catch { }
  }, [connectWallet])

  const handleScoreSubmit = useCallback(async (score: number) => {
    if (!address) throw new Error('wallet not connected')
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') throw new Error('contract not deployed')

    // Используем GASLESS отправку через POST endpoint
    const res = await fetch('/api/score-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, score }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'server error' }))
      throw new Error(data.error || 'failed to submit score')
    }

    const result = await res.json()

    if (result.gasless && result.hash) {
      // Gasless транзакция отправлена владельцем
      setSubmitTxHash(result.hash)
    } else {
      // Fallback на обычную отправку (юзер платит газ)
      const { nonce, signature } = result
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: GAME_LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(score), BigInt(nonce), signature as `0x${string}`],
      })
      setSubmitTxHash(hash)
    }
  }, [address, writeContractAsync])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
  }, [])

  // ========================================================================
  // MAIN APP (always renders — entry popup is overlay on top)
  // ========================================================================
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#FAFAFA] text-slate-900 font-sans selection:bg-[#0052FF]/10 selection:text-[#0052FF] overflow-hidden flex flex-col">
      {/* GLOBAL PARTICLE BACKGROUND - z-0, covers full length of site */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
        <ParticleChaos />
      </div>

      {/* HEADER BACKGROUND BLUR AND GRID */}
      <div className="fixed top-0 left-0 right-0 h-28 bg-white/60 backdrop-blur-xl z-[1] pointer-events-none mask-image-b" style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent)' }} />
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 80px)'
      }} />

      {/* ENTRY POPUP OVERLAY - Rendered on SSR, hidden on desktop via CSS */}
      {!hasEntered && (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-400 lg:hidden ${isEntering ? 'opacity-0 scale-105' : 'opacity-100'}`}
          style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.97) 0%, rgba(245,248,255,0.96) 35%, rgba(235,240,255,0.95) 65%, rgba(224,234,255,0.94) 100%)' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[15%] left-[10%] w-48 h-48 bg-[#0052FF]/[0.08] rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
            <div className="absolute bottom-[20%] right-[15%] w-64 h-64 bg-[#0052FF]/[0.06] rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite_reverse]" />
            <div className="absolute top-[50%] left-[50%] w-40 h-40 bg-[#0ECB81]/[0.06] rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_2s]" />
          </div>
          <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.05]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 80px)'
          }} />

          <div className="relative z-20 text-center px-6 max-w-[340px] w-full"
            style={{ opacity: 0, animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both' }}>
            <h2 className="text-[13px] font-medium text-slate-700 tracking-wide mb-8 leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)', opacity: 0, animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both' }}>
              ready to trade like<br /><span className="text-[#0052FF] font-semibold">it&#39;s your first day again?</span>
            </h2>

            <div className="flex gap-2" style={{ opacity: 0, animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both' }}>
              <button
                onClick={handleEnter}
                className="flex-1 py-1.5 text-white font-semibold tracking-wide text-[10px] transition-all duration-200 hover:scale-105 active:scale-95 bg-[#0ECB81] relative overflow-hidden group cursor-pointer rounded-md uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 4px 12px rgba(14,203,129,0.25)',
                }}
              >
                <span className="relative z-10">Yes</span>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              </button>
              <button
                onClick={handleEnter}
                className="flex-1 py-1.5 text-white font-semibold tracking-wide text-[10px] transition-all duration-200 hover:scale-105 active:scale-95 bg-[#F6465D] relative overflow-hidden group cursor-pointer rounded-md uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 4px 12px rgba(246,70,93,0.25)',
                }}
              >
                <span className="relative z-10">Yes</span>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              </button>
            </div>

            <p className="mt-6 text-[8px] text-slate-400 tracking-widest animate-pulse"
              style={{ fontFamily: 'var(--font-mono)', opacity: 0, animation: 'fadeIn 0.6s ease 0.9s both' }}>
              AUTO-ENTER SOON
            </p>
          </div>
        </div>
      )}

      {/* Desktop block gate - z-50 */}
      <div className={`${!desktopBypass ? 'hidden lg:flex' : 'hidden'} relative z-50 h-full w-full items-center justify-center bg-[#F5F8FF] overflow-hidden`} suppressHydrationWarning>
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[20%] left-[20%] w-64 h-64 bg-[#0052FF]/8 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[20%] right-[20%] w-80 h-80 bg-[#0ecb81]/5 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_reverse]" />
          <div className="absolute top-[40%] right-[30%] w-48 h-48 bg-[#f0b90b]/8 rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite_1s]" />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[100px]" />
        </div>

        <div className="relative z-10 text-center px-10 py-12 max-w-md">
          <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center animate-[float_4s_ease-in-out_infinite]">
            <svg className="w-32 h-32 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}>
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">mobile only.</h2>
          <p className="text-[16px] text-slate-600 mb-10 leading-relaxed font-medium">base dash is a hyper-optimized mobile experience. open this app on your phone to trade.</p>
          <div className="inline-flex items-center gap-3 bg-white border border-slate-200 px-5 py-3.5 rounded-none shadow-[0_8px_24px_rgba(0,82,255,0.12)] transition-transform hover:scale-105 cursor-default mt-6">
            <svg className="w-5 h-5 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="text-[14px] font-bold text-slate-700">switch device to play</span>
          </div>
        </div>
      </div>

      {/* 
        CRITICAL FIX: 
        1. Remove touch-none from global to allow scrolling on Wallet/Leaderboard.
        2. Set min-h-[100dvh] so it takes up exactly the visible browser screen
      */}
      <div className="absolute inset-0 z-10 flex flex-col h-[100dvh] overflow-hidden lg:hidden select-none">

        <Header
          isConnected={isConnected}
          address={address ?? null}
          handleConnect={handleConnect}
          disconnectWallet={disconnectWallet}
        />

        {/* MAIN CONTENT - z-[20], under header but above background */}
        <main className="flex-1 flex flex-col overflow-hidden h-full min-h-0 w-full relative z-[20]">
          <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col relative w-full h-full min-h-0">

            {/* TAB NAVIGATION - Always visible */}
            <div className="w-full px-3 sm:px-4 py-1.5 sm:py-2 relative z-20 flex-shrink-0">
              <div className="flex justify-center items-center gap-1 p-0.5 bg-white/60 backdrop-blur-md rounded-xl border border-slate-200/50 shadow-inner">
                <button onClick={() => setActiveTab('game')} className={`relative px-1.5 sm:px-2 h-[22px] sm:h-[24px] rounded-lg transition-all duration-200 flex flex-col items-center justify-center flex-1 ${(activeTab as string) === 'game' ? 'bg-white text-[#0052FF] shadow-[0_0_15px_rgba(0,82,255,0.5)] scale-100 ring-1 ring-[#0052FF]/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}`}>
                  <div className="flex items-center gap-0.5">
                    <svg className="w-2.5 h-2.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                    <span className="text-[9px] sm:text-[10px] font-black tracking-wide leading-none">trade</span>
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-semibold opacity-70 leading-none mt-[1px]">play demo</span>
                </button>

                <button onClick={() => setActiveTab('profile')} className={`relative px-1.5 sm:px-2 h-[22px] sm:h-[24px] rounded-lg transition-all duration-200 flex flex-col items-center justify-center flex-1 ${(activeTab as string) === 'profile' ? 'bg-white text-[#0052FF] shadow-[0_0_15px_rgba(0,82,255,0.5)] scale-100 ring-1 ring-[#0052FF]/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}`}>
                  <div className="flex items-center gap-0.5">
                    <svg className="w-2.5 h-2.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    <span className="text-[9px] sm:text-[10px] font-black tracking-wide leading-none">wallet</span>
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-semibold opacity-70 leading-none mt-[1px]">profile</span>
                </button>

                <button onClick={() => setActiveTab('leaderboard')} className={`relative overflow-hidden px-1.5 sm:px-2 h-[22px] sm:h-[24px] flex flex-col items-center justify-center rounded-lg transition-all duration-200 group flex-1 ${(activeTab as string) === 'leaderboard' ? 'bg-gradient-to-r from-[#F0B90B] to-[#D4A002] text-white shadow-[0_0_15px_rgba(240,185,11,0.6)] scale-100 ring-1 ring-[#F0B90B]/80' : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-[#F0B90B]/20 hover:ring-[#F0B90B] hover:shadow-[0_4px_12px_rgba(240,185,11,0.4)]'}`}>
                  {activeTab !== 'leaderboard' && <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent opacity-20 -translate-x-full animate-[shimmerSweep_2.5s_ease-in-out_infinite]" />}
                  <div className="flex items-center gap-0.5 relative z-10">
                    <svg className={`w-2.5 h-2.5 hidden sm:block transition-transform duration-300 ${(activeTab as string) !== 'leaderboard' ? 'group-hover:scale-110 text-[#F0B90B]' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <span className={`${(activeTab as string) !== 'leaderboard' ? 'text-slate-800 group-hover:text-amber-600' : 'text-white'} text-[9px] sm:text-[10px] font-black tracking-wide leading-none`}>top 33</span>
                  </div>
                  <span className={`${(activeTab as string) !== 'leaderboard' ? 'opacity-70 text-slate-500' : 'opacity-90 text-white'} text-[6px] sm:text-[7px] font-semibold relative z-10 leading-none mt-[1px]`}>ranks</span>
                </button>
              </div>
            </div>

            {/* GAME TAB */}
            {activeTab === 'game' && (
              <div className="flex flex-col flex-1 w-full min-h-0">
                {/* CONNECT WALLET BANNER - with spacing from header and canvas */}
                {!isConnected && (
                  <div className="p-1.5 sm:p-2 mt-0.5 mb-0.5 bg-gradient-to-r from-[#0052FF]/5 via-[#0052FF]/8 to-[#0052FF]/5 flex items-center justify-center gap-2 flex-shrink-0">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#0052FF] flex items-center justify-center flex-shrink-0 rounded-lg">
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#1a2030] text-center" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                      connect wallet to save scores on-chain
                    </p>
                  </div>
                )}

                {/* GAME HINTS — tap to jump blocks */}
                <div className="w-full px-2 sm:px-3 py-1 relative z-20 flex-shrink-0">
                  <div className="flex items-stretch gap-1 sm:gap-2 mx-auto">
                    <div className="flex-1 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-slate-200/60 min-w-0 justify-center shadow-sm">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#0052FF]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0052FF]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 lowercase tracking-wider truncate text-center">tap to jump</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/60 backdrop-blur-sm rounded-lg border border-[#F6465D]/15 min-w-0 justify-center shadow-sm">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#F6465D]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F6465D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 lowercase tracking-wider truncate text-center">dodge <span className="text-[#F6465D]">red</span></span>
                    </div>
                    <div className="flex-1 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/60 backdrop-blur-sm rounded-lg border border-[#0ECB81]/15 min-w-0 justify-center shadow-sm">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#0ECB81]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0ECB81]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 lowercase tracking-wider truncate text-center">collect <span className="text-[#0ECB81]">green</span></span>
                    </div>
                  </div>
                </div>

                {/* Game Canvas — Proportional flex: canvas dominates, dashboard is secondary */}
                <div className="w-full px-0 sm:px-0 mt-0.5 sm:mt-1 mb-0.5 sm:mb-1 flex-[5] min-h-[140px] max-h-[450px] relative z-20 flex flex-col items-center justify-center fade-in">
                  <div
                    className="relative w-full h-full max-w-[600px] sm:rounded-[20px] overflow-hidden border-y sm:border-x border-[#0052FF]/10 bg-white mx-auto shadow-[0_8px_30px_rgba(0,0,0,0.12)] touch-none"
                  >
                    <GameEngine
                      storageKey="basedash_highscore_v2"
                      onScoreSubmit={handleScoreSubmit}
                      isConnected={isConnected}
                      canSubmitScore={canSubmitScore}
                      connectWallet={handleConnect}
                      isScoreConfirmed={isScoreConfirmed}
                      submitTxHash={submitTxHash}
                    />
                  </div>
                </div>

                <div className="w-full px-2 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-2 flex-[2] relative z-20 flex flex-col min-h-[80px]">
                  {/* Note: In a future PR we will pull score/combo state UP to page.tsx via Zustand, for now passing 0/0 to initial mount layout */}
                  <DashboardGrid score={0} combo={0} />
                </div>
              </div>
            )}


            {/* LEADERBOARD TAB */}
            {activeTab === 'leaderboard' && <Leaderboard />}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="px-4 py-6">
                {isConnected && address ? (
                  <div className="space-y-4 max-w-xl mx-auto">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">your wallet</h2>
                    <div className="p-5 sm:p-6 bg-gradient-to-br from-[#0052FF] to-[#0040CC] shadow-[0_12px_24px_rgba(0,82,255,0.2)] text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
                      <div className="relative z-10 flex flex-col justify-between sm:flex-row sm:items-end gap-5">
                        <div>
                          <p className="text-[10px] font-bold text-white/60 lowercase tracking-widest mb-1.5">connected wallet</p>
                          <p className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight leading-none">{address.slice(0, 6)}...{address.slice(-4)}</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="bg-white/10 backdrop-blur-md px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-bold text-white/50 lowercase tracking-widest mb-1">network</p>
                            <p className="text-[11px] font-black text-white flex items-center gap-1.5 leading-none">
                              <span className="w-1.5 h-1.5 bg-[#0ECB81] animate-pulse shadow-[0_0_4px_#0ECB81]" />
                              {networkLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="p-3 sm:p-4 border border-[#0ECB81]/10 bg-[#0ECB81]/[0.03] shadow-sm flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] font-bold text-slate-400 lowercase tracking-widest">time in game</p>
                        <p className="mt-1 text-xl sm:text-2xl font-black text-[#0ECB81] leading-none">
                          {typeof window !== 'undefined' ? (parseInt(localStorage.getItem('base_dash_time') || '0') / 60).toFixed(1) : 0}m
                        </p>
                      </div>
                      <div className="p-3 sm:p-4 border border-[#0052FF]/10 bg-[#0052FF]/[0.03] shadow-sm flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] font-bold text-slate-400 lowercase tracking-widest">streak</p>
                        <p className="mt-1 text-xl sm:text-2xl font-black text-[#0052FF] leading-none">{checkInStatus.streak}</p>
                      </div>
                    </div>
                    <div className="pt-2"><DailyCheckinButton /></div>
                  </div>
                ) : (
                  <div className="py-16 text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-[#0052FF] to-[#0040CC] shadow-[0_12px_24px_rgba(0,82,255,0.25)] flex items-center justify-center animate-[float_4s_ease-in-out_infinite]">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">connect wallet</h3>
                    <p className="text-slate-500 text-[13px] font-medium mb-6 leading-relaxed">save your session on-chain, access the leaderboard, and claim your rewards.</p>
                    <button
                      onClick={handleConnect}
                      className="w-full bg-[#0052FF] text-white py-3.5 text-sm font-black tracking-wide hover:bg-[#0040CC] transition-all shadow-[0_8px_16px_rgba(0,82,255,0.2)] active:scale-[0.98] rounded-xl flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      connect wallet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* FOOTER - z-[40], solid white background */}
        <footer className="mt-auto bg-white relative z-[40] flex-shrink-0 w-full flex flex-col justify-end min-h-[30px] sm:min-h-[36px] pb-[max(env(safe-area-inset-bottom),_6px)]">
          <div className="mx-auto w-full max-w-3xl px-4 border-t border-slate-100/50 flex flex-row items-center justify-between h-[24px] sm:h-[28px]">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] font-medium text-slate-400 font-mono leading-none m-0 p-0">© {new Date().getFullYear()} base dash</span>
            <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] font-medium text-slate-400 font-mono leading-none m-0 p-0">built by <span className="font-black text-[#0052FF] ml-0.5">vov</span></span>
          </div>
        </footer>
      </div>
    </div>
  )
}
