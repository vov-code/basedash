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

// ============================================================================
// PARTICLE BACKGROUND — Minimalist Crypto Network
// ============================================================================

function ParticleChaos({ opacity = 0.4 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = window.innerWidth
    let h = window.innerHeight

    // Detect low-end devices
    const isLowEnd = typeof navigator !== 'undefined' && (
      navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2 ||
      (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4
    )

    const updateSize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    updateSize()

    interface Bar {
      x: number
      y: number
      bodyH: number
      wickH: number
      isGreen: boolean
      speed: number
      alpha: number
    }

    // Scrolling candlestick bars — the signature look (enhanced visibility)
    const barCount = isLowEnd ? 20 : 40
    const bars: Bar[] = []
    for (let i = 0; i < barCount; i++) {
      const isGreen = Math.random() > 0.45
      bars.push({
        x: Math.random() * w * 1.5,
        y: h * 0.15 + Math.random() * h * 0.7,
        bodyH: 15 + Math.random() * 40,
        wickH: 8 + Math.random() * 18,
        isGreen,
        speed: 0.2 + Math.random() * 0.4,
        alpha: 0.08 + Math.random() * 0.06,
      })
    }

    // Price line data points
    const pricePoints = 60
    const priceData: number[] = []
    let pp = h * 0.5
    for (let i = 0; i < pricePoints; i++) {
      pp += (Math.random() - 0.48) * 8
      pp = Math.max(h * 0.25, Math.min(h * 0.75, pp))
      priceData.push(pp)
    }

    let tick = 0

    const draw = () => {
      if (document.hidden) { animId = requestAnimationFrame(draw); return }
      ctx.clearRect(0, 0, w, h)
      tick++

      // === SCROLLING CANDLESTICK BARS ===
      const barW = isLowEnd ? 6 : 8
      for (const bar of bars) {
        bar.x -= bar.speed
        if (bar.x < -barW * 2) {
          bar.x = w + barW * 2 + Math.random() * 60
          bar.y = h * 0.15 + Math.random() * h * 0.7
          bar.isGreen = Math.random() > 0.45
          bar.bodyH = 10 + Math.random() * 30
          bar.wickH = 5 + Math.random() * 15
          bar.alpha = 0.03 + Math.random() * 0.04
        }

        const color = bar.isGreen ? '#0ECB81' : '#F6465D'

        // Wick — sharp line
        ctx.globalAlpha = bar.alpha * opacity * 1.5
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.moveTo(bar.x, bar.y - bar.wickH)
        ctx.lineTo(bar.x, bar.y + bar.bodyH + bar.wickH)
        ctx.stroke()

        // Body — Sharp terminal block
        ctx.fillStyle = color
        ctx.fillRect(bar.x - barW / 2, bar.y, barW, bar.bodyH)

        // Inner bright streak for "neon screen" effect
        ctx.fillStyle = '#FFFFFF'
        ctx.globalAlpha = bar.alpha * opacity * 0.4
        ctx.fillRect(bar.x - barW / 4 + 0.5, bar.y, barW / 2, bar.bodyH)
        ctx.globalAlpha = 1
      }

      // === FLOATING PRICE LINE ===
      ctx.globalAlpha = opacity * 0.08
      ctx.strokeStyle = '#0052FF'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const segW = w / (pricePoints - 1)
      const timeOff = tick * 0.3
      for (let i = 0; i < pricePoints; i++) {
        const idx = (i + Math.floor(timeOff)) % pricePoints
        const px = i * segW
        const py = priceData[idx] + Math.sin(tick * 0.01 + i * 0.2) * 5
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Price line glow
      ctx.globalAlpha = opacity * 0.03
      ctx.lineWidth = 4
      ctx.stroke()

      // === SUBTLE GRID DOTS ===
      if (!isLowEnd) {
        ctx.globalAlpha = opacity * 0.04
        ctx.fillStyle = '#0052FF'
        const dotGap = 40
        for (let gx = 0; gx < w; gx += dotGap) {
          for (let gy = 0; gy < h; gy += dotGap) {
            ctx.fillRect(gx, gy, 1, 1)
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    const handleResize = () => updateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [opacity])

  return <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none w-full h-full ${opacity === 0.6 ? 'z-[2]' : 'z-[1]'}`} style={{ maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' }} suppressHydrationWarning />
}

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
    <div className="h-[100dvh] w-full bg-white flex flex-col relative overflow-hidden">
      {/* GLOBAL PARTICLE BACKGROUND - z-0, covers full length of site */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <ParticleChaos opacity={0.6} />
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
            <h2 className="text-[15px] font-bold text-slate-700 tracking-tight mb-10 leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)', opacity: 0, animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both' }}>
              ready to trade like<br /><span className="text-[#0052FF] font-black">it&#39;s your first day again?</span>
            </h2>

            <div className="flex gap-2" style={{ opacity: 0, animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both' }}>
              <button
                onClick={handleEnter}
                className="flex-1 py-2.5 text-white font-bold tracking-[0.12em] text-[11px] transition-all duration-200 hover:scale-105 active:scale-95 bg-[#0ECB81] relative overflow-hidden group cursor-pointer rounded-md"
                style={{
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 4px 12px rgba(14,203,129,0.25)',
                  textTransform: 'lowercase'
                }}
              >
                <span className="relative z-10">yes</span>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              </button>
              <button
                onClick={handleEnter}
                className="flex-1 py-2.5 text-white font-bold tracking-[0.12em] text-[11px] transition-all duration-200 hover:scale-105 active:scale-95 bg-[#F6465D] relative overflow-hidden group cursor-pointer rounded-md"
                style={{
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 4px 12px rgba(246,70,93,0.25)',
                  textTransform: 'lowercase'
                }}
              >
                <span className="relative z-10">yes</span>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              </button>
            </div>

            <p className="mt-8 text-[9px] text-slate-400/60 tracking-widest animate-pulse"
              style={{ fontFamily: 'var(--font-mono)', textTransform: 'lowercase', opacity: 0, animation: 'fadeIn 0.6s ease 0.9s both' }}>
              auto-enter soon
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

      {/* Content layer - mobile/tablet only - z-50 */}
      <div className={`relative z-50 flex flex-col h-full ${!desktopBypass ? 'lg:hidden' : ''}`}>

        {/* HEADER - z-[60], above background */}
        <header className="sticky top-0 z-[60] relative overflow-hidden">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xl" />
          <ParticleChaos opacity={0.25} />

          <div className="relative z-10 mx-auto flex w-full max-w-5xl px-3 sm:px-5 pb-1 mt-1">
            <div className="flex items-center justify-between w-full py-2.5">
              <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer flex-shrink-0" onClick={() => setActiveTab('game')}>
                <div className="relative h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 overflow-hidden border-2 border-[#0052FF]/80 rounded p-0.5 bg-white shadow-[0_0_12px_rgba(0,82,255,0.4)] animate-icon-float">
                  <Image src="/base-logo.png" alt="base dash logo" fill className="object-cover" priority />
                </div>
                <div className="block whitespace-nowrap">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-widest leading-none font-mono">base dash</h1>
                </div>
              </div>

              <div className="flex justify-end items-center flex-shrink-0">
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="h-9 px-4 flex items-center gap-2 bg-gradient-to-br from-[#0052FF] to-[#0040CC] text-white text-[11px] font-black tracking-wider rounded-xl shadow-[0_4px_14px_rgba(0,82,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,82,255,0.45)] transition-all transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="hidden sm:inline">connect</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl shadow-sm">
                      <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />
                      <span className="font-mono text-[10px] font-bold text-[#15803d]">
                        {address?.slice(0, 4)}..{address?.slice(-4)}
                      </span>
                    </div>
                    <button onClick={() => disconnectWallet()} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors" title="Disconnect">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="relative z-10 mx-auto w-full max-w-3xl px-3 sm:px-5 pb-1">
            <div className="flex justify-center items-center gap-1 p-1 bg-white/60 backdrop-blur-md rounded-xl border border-slate-200/50 shadow-inner">
              <button onClick={() => handleTabChange('game')} className={`relative px-1 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex flex-col items-center justify-center gap-0.5 flex-1 ${activeTab === 'game' ? 'bg-white text-[#0052FF] shadow-[0_0_15px_rgba(0,82,255,0.5)] scale-100 ring-1 ring-[#0052FF]/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}`}>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] sm:text-xs font-black tracking-wide">trade</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">play demo</span>
              </button>

              <button onClick={() => handleTabChange('profile')} className={`relative px-1 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex flex-col items-center justify-center gap-0.5 flex-1 ${activeTab === 'profile' ? 'bg-white text-[#0052FF] shadow-[0_0_15px_rgba(0,82,255,0.5)] scale-100 ring-1 ring-[#0052FF]/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}`}>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] sm:text-xs font-black tracking-wide">wallet</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">profile</span>
              </button>

              <button onClick={() => handleTabChange('leaderboard')} className={`relative overflow-hidden px-1 sm:px-3 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all duration-200 group flex-1 ${activeTab === 'leaderboard' ? 'bg-gradient-to-r from-[#F0B90B] to-[#D4A002] text-white shadow-[0_0_15px_rgba(240,185,11,0.6)] scale-100 ring-1 ring-[#F0B90B]/80' : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-[#F0B90B]/20 hover:ring-[#F0B90B] hover:shadow-[0_4px_12px_rgba(240,185,11,0.4)]'}`}>
                {activeTab !== 'leaderboard' && <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent opacity-20 -translate-x-full animate-[shimmerSweep_2.5s_ease-in-out_infinite]" />}
                <div className="flex items-center gap-1 relative z-10">
                  <svg className={`w-3.5 h-3.5 hidden sm:block transition-transform duration-300 ${activeTab !== 'leaderboard' ? 'group-hover:scale-110 text-[#F0B90B]' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className={`text-[10px] sm:text-xs font-black tracking-wide ${activeTab !== 'leaderboard' ? 'text-slate-800 group-hover:text-amber-600' : 'text-white'}`}>top 33</span>
                </div>
                <span className={`text-[7px] sm:text-[8px] font-semibold relative z-10 ${activeTab !== 'leaderboard' ? 'opacity-70 text-slate-500' : 'opacity-90 text-white'}`}>ranks</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT - z-[20], under header but above background */}
        <main className="flex-1 flex flex-col min-h-0 w-full mb-auto relative z-[20]">
          <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col relative w-full">

            {/* GAME TAB */}
            {activeTab === 'game' && (
              <div className="flex flex-col h-full w-full">
                {!isConnected && (
                  <div className="p-3 mt-2 border-[#0052FF]/15 bg-gradient-to-r from-[#0052FF]/5 via-[#0052FF]/8 to-[#0052FF]/5 flex items-center justify-center gap-2">
                    <div className="w-6 h-6 bg-[#0052FF] flex items-center justify-center flex-shrink-0 rounded-lg">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-bold text-[#1a2030] text-center" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                      connect wallet to save scores on-chain
                    </p>
                  </div>
                )}

                {/* GAME HINT — Styled cards above canvas */}
                <div className="w-full px-3 py-4 relative z-20">
                  <div className="flex items-stretch gap-2 mx-auto">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-slate-200/60">
                      <div className="w-5 h-5 bg-[#0052FF]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-[#0052FF]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-500 lowercase tracking-wider">tap to jump</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-[#F6465D]/15">
                      <div className="w-5 h-5 bg-[#F6465D]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-[#F6465D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-500 lowercase tracking-wider">dodge <span className="text-[#F6465D]">red</span></span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-[#0ECB81]/15">
                      <div className="w-5 h-5 bg-[#0ECB81]/10 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-[#0ECB81]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-500 lowercase tracking-wider">collect <span className="text-[#0ECB81]">green</span></span>
                    </div>
                  </div>
                </div>

                {/* Game Canvas */}
                <div className="w-full px-0 sm:px-0 mb-0 flex flex-col items-center justify-center relative z-20" style={{ maxHeight: '50vh' }}>
                  <div className="w-full relative shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:rounded-lg overflow-hidden border-y sm:border-x border-slate-200/50 flex-shrink-0 bg-white">
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

                {/* BOTTOM INFO GRID — Fills space between canvas and footer */}
                <div className="w-full px-3 sm:px-4 py-3 flex-1 flex flex-col relative z-20">
                  <div className="w-full flex-1 grid grid-cols-2 gap-2.5 max-w-lg mx-auto auto-rows-min content-center">

                    {/* Liquidation Watch — full width */}
                    <div className="col-span-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-[#F6465D]/15 flex items-center justify-between group hover:border-[#F6465D]/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-2 h-2 bg-[#F6465D] rounded-full" />
                          <div className="absolute inset-0 w-2 h-2 bg-[#F6465D] rounded-full animate-ping opacity-40" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-black text-slate-800 lowercase tracking-wider">liquidation watch</span>
                          <span className="text-[8px] font-mono text-slate-400 lowercase">don&apos;t get rekt</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-[#F6465D] lowercase px-2 py-1 bg-[#F6465D]/8 rounded-md border border-[#F6465D]/15">high risk</span>
                    </div>

                    {/* Chain Status */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-[#0052FF]/10 flex flex-col gap-2 hover:border-[#0052FF]/25 transition-colors">
                      <span className="text-[7px] font-mono font-bold text-slate-400 lowercase tracking-widest">network</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#0052FF] rounded-full animate-pulse" />
                        <span className="text-[14px] font-black font-mono text-slate-800 lowercase leading-none">base</span>
                      </div>
                      <span className="text-[7px] font-mono text-[#0ECB81] lowercase">● mainnet live</span>
                    </div>

                    {/* Volatility */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-[#F0B90B]/10 flex flex-col gap-2 hover:border-[#F0B90B]/25 transition-colors">
                      <span className="text-[7px] font-mono font-bold text-slate-400 lowercase tracking-widest">volatility</span>
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#F0B90B]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                        <span className="text-[14px] font-black font-mono text-[#F0B90B] lowercase leading-none">extreme</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#F0B90B] to-[#F6465D] rounded-full" style={{ width: '85%', animation: 'pulse 2s ease-in-out infinite' }} />
                      </div>
                    </div>

                    {/* On-Chain Scores */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200/60 flex flex-col gap-2 hover:border-[#0052FF]/20 transition-colors">
                      <span className="text-[7px] font-mono font-bold text-slate-400 lowercase tracking-widest">scoring</span>
                      <span className="text-[10px] font-mono font-bold text-slate-700 lowercase leading-tight">on-chain verified</span>
                      <span className="text-[7px] font-mono text-slate-400 lowercase">scores saved to base</span>
                    </div>

                    {/* Rewards */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-[#8B5CF6]/15 flex flex-col gap-2 hover:border-[#8B5CF6]/30 transition-colors">
                      <span className="text-[7px] font-mono font-bold text-slate-400 lowercase tracking-widest">rewards</span>
                      <span className="text-[10px] font-mono font-black text-[#8B5CF6] lowercase leading-tight">coming soon</span>
                      <span className="text-[7px] font-mono text-slate-400 lowercase">play now, earn later</span>
                    </div>

                  </div>
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

        {/* FOOTER - z-[40] */}
        <footer className="mt-auto bg-white/50 backdrop-blur-md relative z-[40]">
          <div className="mx-auto w-full max-w-3xl px-6 py-4 border-t border-slate-100/50">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="text-slate-400/80">© {new Date().getFullYear()} base dash</span>
              <span className="text-slate-400/80">built by <span className="font-black text-[#0052FF]">vov</span></span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
