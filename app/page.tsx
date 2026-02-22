/**
 * ============================================================================
 * BASE DASH — Main Page
 * ============================================================================
 * Design inspired by base.org — minimalist white + #0052FF blue
 * Degen lowercase style, square elements, centered layout
 * Canvas-based chaotic blue particle background
 * ============================================================================
 */

'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import dynamic from 'next/dynamic'
import GameEngine from './components/Game/GameEngine'
import DailyCheckinButton from './components/DailyCheckin/CheckinButton'
import { useWallet } from './hooks/useWallet'
import { useDailyCheckin } from './hooks/useDailyCheckin'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from './contracts'

// Lazy load heavy components
const Leaderboard = dynamic(
  () => import('./components/Leaderboard/Leaderboard'),
  {
    loading: () => (
      <div className="flex items-center justify-center border border-slate-200 bg-white p-8 py-14 shadow-sm rounded-2xl">
        <div className="h-10 w-10 animate-spin border-4 border-[#0052FF]/20 border-t-[#0052FF]" />
        <span className="ml-4 text-sm text-slate-500">loading leaderboard...</span>
      </div>
    ),
    ssr: false,
  }
)
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet'
import {
  Address,
  Avatar,
  Name,
  Identity,
} from '@coinbase/onchainkit/identity'

// ============================================================================
// CANVAS PARTICLE BACKGROUND — Blue chaos on white
// ============================================================================

function ParticleChaos() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = window.innerWidth
    let h = window.innerHeight
    canvas.width = w
    canvas.height = h

    const IS_MOBILE_PAGE = w < 768

    // Particle definition
    interface Dot {
      x: number; y: number
      vx: number; vy: number
      size: number
      alpha: number
      baseAlpha: number
      pulse: number
      pulseSpeed: number
    }

    const COUNT = Math.min(IS_MOBILE_PAGE ? 40 : 120, Math.floor(w * h / 8000))
    const CONNECTION_DIST = w < 600 ? 100 : 140
    const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST
    const SHOW_CONNECTIONS = COUNT <= 80 && !IS_MOBILE_PAGE
    const dots: Dot[] = []

    for (let i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: 1.2 + Math.random() * 2.5,
        alpha: 0.08 + Math.random() * 0.22,
        baseAlpha: 0.08 + Math.random() * 0.22,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.3 + Math.random() * 0.8,
      })
    }

    const draw = () => {
      // Skip rendering when tab is hidden
      if (document.hidden) { animId = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, w, h)

      // Update & draw particles
      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        d.pulse += d.pulseSpeed * 0.016

        // Wrap around edges
        if (d.x < -10) d.x = w + 10
        if (d.x > w + 10) d.x = -10
        if (d.y < -10) d.y = h + 10
        if (d.y > h + 10) d.y = -10

        // Pulsating alpha
        d.alpha = d.baseAlpha + Math.sin(d.pulse) * 0.06

        // Draw dot
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 82, 255, ${d.alpha})`
        ctx.fill()
      }

      // Draw connections — use dist² to avoid sqrt (fix #14)
      if (SHOW_CONNECTIONS) for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < CONNECTION_DIST_SQ) {
            const dist = Math.sqrt(distSq)
            const alpha = (1 - dist / CONNECTION_DIST) * 0.06
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(0, 82, 255, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    const handleResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

// ============================================================================
// TAB CONFIGURATION
// ============================================================================

type TabType = 'game' | 'leaderboard' | 'profile'

const TABS: { id: TabType; label: string }[] = [
  { id: 'game', label: 'play' },
  { id: 'leaderboard', label: 'leaderboard' },
  { id: 'profile', label: 'profile' },
]

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [desktopBypass, setDesktopBypass] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()
  const { checkInStatus, canSubmitScore } = useDailyCheckin(address)
  const networkLabel = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'base sepolia' : 'base mainnet'

  // ========================================================================
  // SCORE SUBMISSION — Game → API sign → Contract submitScore
  // ========================================================================

  const { writeContractAsync } = useWriteContract()
  const [submitTxHash, setSubmitTxHash] = useState<`0x${string}` | undefined>()
  const { isSuccess: isScoreConfirmed } = useWaitForTransactionReceipt({ hash: submitTxHash })

  const walletDisplay = useMemo(() => {
    if (!address) return null
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  const handleConnect = useCallback(async () => {
    try { await connectWallet() } catch { }
  }, [connectWallet])

  const handleEnter = useCallback(() => {
    setIsEntering(true)
    setTimeout(() => {
      setHasEntered(true)
    }, 600)
  }, [])

  const handleScoreSubmit = useCallback(async (score: number) => {
    if (!address) throw new Error('wallet not connected')
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') throw new Error('contract not deployed')

    // 1. Get signature from backend API
    const res = await fetch(`/api/score-sign?address=${address}&score=${score}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'server error' }))
      throw new Error(data.error || 'failed to sign score')
    }
    const { nonce, signature } = await res.json()

    // 2. Submit to contract
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'submitScore',
      args: [BigInt(score), BigInt(nonce), signature as `0x${string}`],
    })
    setSubmitTxHash(hash)
  }, [address, writeContractAsync])

  // ========================================================================
  // ENTRY POPUP — Ready to trade again (MINIMAL)
  // ========================================================================
  if (!hasEntered) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white overflow-hidden">
        {/* Subtle animated gradient background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,82,255,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(14,203,129,0.05) 0%, transparent 60%)'
        }} />
        {/* Animated grid lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 48px)'
        }} />

        <div className="relative text-center px-8 max-w-sm w-full" style={{ animation: 'entrySlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>

          {/* Bouncing logo block */}
          <div className="mx-auto mb-8 relative" style={{ width: 56, height: 56, animation: 'entryBounce 2.8s ease-in-out 0.6s infinite' }}>
            <div className="w-14 h-14 bg-[#0052FF] flex items-center justify-center shadow-[0_12px_32px_rgba(0,82,255,0.4)]">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="8" height="20" fill="white" />
                <rect x="12" y="4" width="12" height="6" fill="white" />
                <rect x="12" y="11" width="10" height="5" fill="white" />
                <rect x="12" y="18" width="12" height="6" fill="white" />
              </svg>
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 bg-[#0052FF]/20 blur-xl -z-10" />
          </div>

          {/* Title */}
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-4"
            style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>
            base dash
          </p>

          {/* Main question */}
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight mb-10 leading-snug"
            style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)', letterSpacing: '-0.03em' }}>
            ready to trade like<br />it&#39;s your first day again?
          </h1>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleEnter}
              className="flex-1 py-4 text-white font-black uppercase tracking-[0.14em] text-[11px] transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0ECB81 0%, #0A9F68 100%)',
                boxShadow: '0 8px 24px rgba(14,203,129,0.35)',
                animation: 'entryButtonPulse 3s ease-in-out 1.2s infinite',
                fontFamily: 'var(--font-space, Space Grotesk, system-ui)',
              }}
            >
              yes / buy
            </button>
            <button
              onClick={handleEnter}
              className="flex-1 py-4 text-white font-black uppercase tracking-[0.14em] text-[11px] transition-all hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #F6465D 0%, #D63048 100%)',
                boxShadow: '0 8px 24px rgba(246,70,93,0.3)',
                fontFamily: 'var(--font-space, Space Grotesk, system-ui)',
              }}
            >
              yes / sell
            </button>
          </div>

          {/* Subtext */}
          <p className="mt-6 text-[10px] text-slate-400 font-medium">
            built on <span className="text-[#0052FF] font-bold">base</span> · on-chain leaderboard
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] w-full bg-white flex flex-col relative overflow-hidden animate-[fadeIn_0.5s_ease-out_forwards]">
      {/* Particle background */}
      <ParticleChaos />

      {/* Desktop block gate - Premium Animated */}
      <div className={`${!desktopBypass ? 'hidden lg:flex' : 'hidden'} relative z-50 h-full w-full items-center justify-center bg-[#F5F8FF] overflow-hidden`}>
        {/* Floating background elements for premium feel */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[20%] left-[20%] w-64 h-64 bg-[#0052FF]/8 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[20%] right-[20%] w-80 h-80 bg-[#0ecb81]/5 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_reverse]" />
          <div className="absolute top-[40%] right-[30%] w-48 h-48 bg-[#f0b90b]/8 rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite_1s]" />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[100px]" />
        </div>

        <div className="relative z-10 text-center px-10 py-12 max-w-md animate-[fadeInUp_0.8s_ease-out_forwards]">
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

      {/* Content layer — mobile/tablet only */}
      <div className={`relative z-10 flex flex-col h-full ${!desktopBypass ? 'lg:hidden' : ''}`}>

        {/* ============ HEADER ============ */}
        <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white/95 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative">
          <div className="mx-auto flex w-full max-w-3xl px-3 sm:px-5">

            {/* Top row - Logo left, Wallet right */}
            <div className="flex items-center justify-between w-full py-2.5">
              {/* Logo - Left */}
              <div className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer flex-shrink-0" onClick={() => setActiveTab('game')}>
                <div className="relative h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 bg-[#0052FF] overflow-hidden shadow-[0_4px_12px_rgba(0,82,255,0.2)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                  <div className="absolute inset-0 border border-white/20">
                    <Image src="/base-logo.png" alt="base dash logo" fill className="object-cover transition-transform duration-700 group-hover:scale-110" priority />
                  </div>
                </div>
                <div className="block whitespace-nowrap">
                  <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight leading-none">base dash</h1>
                </div>
              </div>

              {/* Wallet - Right */}
              <div className="flex justify-end items-center flex-shrink-0">
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-[#0052FF] to-[#0040CC] rounded-xl shadow-[0_4px_14px_rgba(0,82,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,82,255,0.45)] transition-all transform hover:-translate-y-0.5 active:scale-95"
                    title="Connect Wallet"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl shadow-sm">
                      <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />
                      <span className="font-mono text-[10px] font-bold text-[#15803d]">
                        {address?.slice(0, 4)}..{address?.slice(-4)}
                      </span>
                    </div>
                    <button
                      onClick={() => disconnectWallet()}
                      className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      title="Disconnect"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row - Centered Tabs */}
          <div className="mx-auto w-full max-w-3xl px-3 sm:px-5 pb-2">
            <div className="flex justify-center items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/50 shadow-inner min-w-0">
              {/* Play */}
              <button onClick={() => setActiveTab('game')} className={`relative px-1 sm:px-3 py-1.5 rounded-lg transition-all duration-300 flex flex-col items-center justify-center gap-0.5 flex-1 ${activeTab === 'game' ? 'bg-white text-[#0052FF] shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-100 ring-1 ring-[#0052FF]/20' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50 scale-[0.98]'}`}>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide">trade</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">PLAY DEMO</span>
              </button>

              {/* Wallet / Profile */}
              <button onClick={() => setActiveTab('profile')} className={`relative px-1 sm:px-3 py-1.5 rounded-lg transition-all duration-300 flex flex-col items-center justify-center gap-0.5 flex-1 ${activeTab === 'profile' ? 'bg-white text-[#0052FF] shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-100 ring-1 ring-[#0052FF]/20' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50 scale-[0.98]'}`}>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide">wallet</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">PROFILE</span>
              </button>

              {/* Rankings */}
              <button onClick={() => setActiveTab('leaderboard')} className={`relative overflow-hidden px-1 sm:px-3 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all duration-300 group flex-1 ${activeTab === 'leaderboard' ? 'bg-gradient-to-r from-[#F0B90B] to-[#D4A002] text-white shadow-[0_2px_10px_rgba(240,185,11,0.4)] scale-100 ring-1 ring-[#F0B90B]/50' : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-[#F0B90B]/20 hover:ring-[#F0B90B] hover:shadow-[0_4px_12px_rgba(240,185,11,0.2)] hover:-translate-y-0.5 scale-[0.98]'}`}>
                {activeTab !== 'leaderboard' && (
                  <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent opacity-20 -translate-x-full animate-[shimmerSweep_2.5s_ease-in-out_infinite]" />
                )}
                <div className="flex items-center gap-1 relative z-10">
                  <svg className={`w-3.5 h-3.5 hidden sm:block transition-transform duration-300 ${activeTab !== 'leaderboard' ? 'group-hover:scale-110 text-[#F0B90B] animate-[pulseGlowText_3s_ease-in-out_infinite]' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wide ${activeTab !== 'leaderboard' ? 'text-slate-800 group-hover:text-amber-600' : 'text-white'}`}>top 33</span>
                </div>
                <span className={`text-[7px] sm:text-[8px] font-semibold relative z-10 ${activeTab !== 'leaderboard' ? 'opacity-70 text-slate-500' : 'opacity-90 text-white'}`}>RANKS</span>
              </button>
            </div>
          </div>
        </header>

        {/* ============ MAIN CONTENT ============ */}
        <main className="flex-1 flex flex-col min-h-0 w-full mb-auto pb-safe">
          <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col relative w-full">

            {/* ---- GAME TAB ---- */}
            {activeTab === 'game' && (
              <div className="flex flex-col h-full w-full">
                {/* Connect wallet banner — sits directly under header, no extra margin */}
                {!isConnected && (
                  <div className="mx-0 mt-0 mb-0.5 p-2.5 border border-[#0052FF]/15 bg-gradient-to-r from-[#0052FF]/5 to-[#0052FF]/8 flex items-center justify-between gap-2 animate-[fadeInUp_0.5s_ease-out_forwards]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#0052FF] flex items-center justify-center flex-shrink-0 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#1a2030]" style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>connect wallet</p>
                        <p className="text-[8px] text-[#6B7280]">save scores on-chain</p>
                      </div>
                    </div>
                    <button
                      onClick={handleConnect}
                      className="px-2.5 py-1.5 bg-[#0052FF] text-white text-[9px] font-bold uppercase tracking-wider hover:bg-[#0040CC] transition-colors flex-shrink-0 rounded-lg shadow-sm"
                      style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}
                    >
                      connect
                    </button>
                  </div>
                )}

                {/* Game Engine — takes all remaining space, no extra wrapper margins */}
                <div className="w-full flex-1 min-h-0 overflow-hidden">
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

                {/* Description texts — tight spacing */}
                <div className="px-4 sm:px-6 mt-1 mb-1 max-w-xl mx-auto flex flex-col items-center justify-center text-center animate-[fadeInUp_0.5s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.1s' }}>
                  <p className="text-[12px] font-black tracking-tight text-slate-800 leading-snug mb-1 uppercase">
                    don't get liquidated. <span className="text-[#0052FF]">hold the line.</span>
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                    jump <strong className="text-[#F6465D]">reds</strong> (+7), stack <strong className="text-[#0ECB81]">greens</strong> (+33). on-chain survival.
                  </p>
                </div>

                {/* How to play — compact degen trading cards for mobile */}
                <div className="mt-3 px-3 grid grid-cols-3 gap-2">
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#FFF0F2] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#F6465D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-[11px] font-semibold text-[#1a2030] mb-0.5">dodge reds</p>
                    <p className="text-[9px] text-[#9ca3af]">bearish candles = rekt</p>
                  </div>
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#e8f8f0] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-[11px] font-semibold text-[#1a2030] mb-0.5">grab greens</p>
                    <p className="text-[9px] text-[#9ca3af]">bullish candles = profit</p>
                  </div>
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#eef4ff] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-[11px] font-semibold text-[#1a2030] mb-0.5">send on-chain</p>
                    <p className="text-[9px] text-[#9ca3af]">save your high score to base</p>
                  </div>
                </div>

                {/* Features — compact pills */}
                <div className="mt-3 px-3 grid grid-cols-4 gap-2">
                  {[
                    { label: '10 markets', value: 'explore' },
                    { label: '9 tiers', value: 'survive' },
                    { label: 'on-chain', value: 'compete' },
                    { label: 'daily', value: 'streak' },
                  ].map((f) => (
                    <div key={f.label} className="p-2 border border-[#e5e7eb] bg-[#f8f9fc] text-center rounded-lg">
                      <p className="text-[8px] text-[#9ca3af] mb-0">{f.value}</p>
                      <p className="text-[10px] font-semibold text-[#1a2030]">{f.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- LEADERBOARD TAB ---- */}
            {activeTab === 'leaderboard' && (
              <Leaderboard />
            )}

            {/* ---- PROFILE TAB ---- */}
            {activeTab === 'profile' && (
              <div className="px-4 py-6 animate-[fadeInUp_0.3s_ease-out]">
                {isConnected && address ? (
                  <div className="space-y-4 max-w-xl mx-auto">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">your wallet</h2>

                    <div className="p-5 sm:p-6 bg-gradient-to-br from-[#0052FF] to-[#0040CC] shadow-[0_12px_24px_rgba(0,82,255,0.2)] text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
                      <div className="relative z-10 flex flex-col justify-between sm:flex-row sm:items-end gap-5">
                        <div>
                          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">connected wallet</p>
                          <p className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight leading-none">{address.slice(0, 6)}...{address.slice(-4)}</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="bg-white/10 backdrop-blur-md px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-bold text-white/50 uppercase tracking-widest mb-1">network</p>
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
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">time in game</p>
                        <p className="mt-1 text-xl sm:text-2xl font-black text-[#0ECB81] leading-none">
                          {typeof window !== 'undefined' ? (parseInt(localStorage.getItem('base_dash_time') || '0') / 60).toFixed(1) : 0}m
                        </p>
                      </div>
                      <div className="p-3 sm:p-4 border border-[#0052FF]/10 bg-[#0052FF]/[0.03] shadow-sm flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">streak</p>
                        <p className="mt-1 text-xl sm:text-2xl font-black text-[#0052FF] leading-none">{checkInStatus.streak}</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <DailyCheckinButton />
                    </div>
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
                    <Wallet>
                      <ConnectWallet
                        className="bg-[#0052FF] w-full py-3.5 text-sm font-black tracking-wide uppercase text-white hover:bg-[#0040CC] transition-all shadow-[0_8px_16px_rgba(0,82,255,0.2)] active:scale-[0.98] rounded-xl flex items-center justify-center"
                      >
                        <Avatar className="h-6 w-6" />
                        <Name />
                      </ConnectWallet>
                    </Wallet>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ============ FOOTER ============ */}
        <footer className="mt-auto border-t border-[#e5e7eb] bg-[#f8fafc] backdrop-blur-md">
          <div className="mx-auto w-full max-w-3xl px-6 py-4">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-500">
                built by <span className="text-[#0052FF]">vov</span>. © {new Date().getFullYear()} base dash.
              </span>
              <span className="text-slate-400/80 animate-[hintFade_4s_ease-in-out_infinite] tracking-wide">
                rewards soon.
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
