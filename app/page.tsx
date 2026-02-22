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
// PARTICLE BACKGROUND — Enhanced & Optimized
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

    const updateSize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    updateSize()

    interface Dot {
      x: number; y: number
      vx: number; vy: number
      size: number
      baseAlpha: number
      pulse: number
      pulseSpeed: number
    }

    const COUNT = Math.min(40, Math.floor(w * h / 15000))
    const dots: Dot[] = []

    for (let i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        baseAlpha: 0.06 + Math.random() * 0.15,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.2 + Math.random() * 0.4,
      })
    }

    const draw = () => {
      if (document.hidden) { animId = requestAnimationFrame(draw); return }
      ctx.clearRect(0, 0, w, h)

      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        d.pulse += d.pulseSpeed * 0.016
        
        if (d.x < -10) d.x = w + 10
        if (d.x > w + 10) d.x = -10
        if (d.y < -10) d.y = h + 10
        if (d.y > h + 10) d.y = -10
        
        const alpha = d.baseAlpha + Math.sin(d.pulse) * 0.03
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 82, 255, ${alpha * opacity})`
        ctx.fill()
      }

      // Connections
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < 150 * 150) {
            const dist = Math.sqrt(distSq)
            const alpha = (1 - dist / 150) * 0.03
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(0, 82, 255, ${alpha * opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
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

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
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
  const [entryVisitCount, setEntryVisitCount] = useState(0)
  const [entryTimer, setEntryTimer] = useState<number | null>(null)
  
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()
  const { checkInStatus, canSubmitScore } = useDailyCheckin(address, activeTab === 'profile')
  const networkLabel = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'base sepolia' : 'base mainnet'
  const entryCanvasRef = useRef<HTMLCanvasElement>(null)
  const entryButtonsRef = useRef<HTMLDivElement>(null)

  // Check visit count on mount - runs ONCE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const count = parseInt(sessionStorage.getItem('bd_visit_count') || '0')
      setEntryVisitCount(count)
      const entered = sessionStorage.getItem('bd_entered')
      if (entered === '1') {
        setHasEntered(true)
      }
    }
  }, [])

  // iPad Pro & Touch bypass
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
      setDesktopBypass(true)
    }
  }, [])

  // Entry screen particle animation
  useEffect(() => {
    if (hasEntered) return
    const canvas = entryCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number
    let w = window.innerWidth, h = window.innerHeight
    canvas.width = w; canvas.height = h
    
    const dots: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; baseAlpha: number; pulse: number; pulseSpeed: number }[] = []
    const COUNT = Math.min(50, Math.floor(w * h / 12000))
    for (let i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
        size: 1.2 + Math.random() * 2.5,
        alpha: 0.08 + Math.random() * 0.22, baseAlpha: 0.08 + Math.random() * 0.22,
        pulse: Math.random() * Math.PI * 2, pulseSpeed: 0.3 + Math.random() * 0.8
      })
    }
    
    const draw = () => {
      if (document.hidden) { animId = requestAnimationFrame(draw); return }
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy; d.pulse += d.pulseSpeed * 0.016
        if (d.x < -10) d.x = w + 10; if (d.x > w + 10) d.x = -10
        if (d.y < -10) d.y = h + 10; if (d.y > h + 10) d.y = -10
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 82, 255, ${d.baseAlpha + Math.sin(d.pulse) * 0.06})`
        ctx.fill()
      }
      const SHOW_CONNECTIONS = COUNT <= 80
      const CONNECTION_DIST = w < 600 ? 100 : 140
      const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST
      if (SHOW_CONNECTIONS) {
        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y
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
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [hasEntered])

  // Auto-enter after timeout (20s first visit, 10s subsequent)
  useEffect(() => {
    if (hasEntered) return
    
    const isFirstVisit = entryVisitCount === 0
    const timeout = isFirstVisit ? 20000 : 10000
    
    const t = setTimeout(() => {
      handleEnter()
    }, timeout)
    setEntryTimer(t)
    
    return () => clearTimeout(t)
  }, [hasEntered, entryVisitCount])

  const { writeContractAsync } = useWriteContract()
  const [submitTxHash, setSubmitTxHash] = useState<`0x${string}` | undefined>()
  const { isSuccess: isScoreConfirmed } = useWaitForTransactionReceipt({ hash: submitTxHash })

  const handleConnect = useCallback(async () => {
    try { await connectWallet() } catch { }
  }, [connectWallet])

  const handleEnter = useCallback(() => {
    if (entryTimer) clearTimeout(entryTimer)
    setIsEntering(true)
    sessionStorage.setItem('bd_entered', '1')
    const newCount = entryVisitCount + 1
    sessionStorage.setItem('bd_visit_count', String(newCount))
    setEntryVisitCount(newCount)
    setTimeout(() => setHasEntered(true), 700)
  }, [entryVisitCount, entryTimer])

  const handleScoreSubmit = useCallback(async (score: number) => {
    if (!address) throw new Error('wallet not connected')
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') throw new Error('contract not deployed')

    const res = await fetch(`/api/score-sign?address=${address}&score=${score}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'server error' }))
      throw new Error(data.error || 'failed to sign score')
    }
    const { nonce, signature } = await res.json()

    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: GAME_LEADERBOARD_ABI,
      functionName: 'submitScore',
      args: [BigInt(score), BigInt(nonce), signature as `0x${string}`],
    })
    setSubmitTxHash(hash)
  }, [address, writeContractAsync])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
  }, [])

  // ========================================================================
  // ENTRY SCREEN
  // ========================================================================
  if (!hasEntered) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${isEntering ? 'opacity-0 scale-105' : 'opacity-100'}`}
        style={{ background: 'linear-gradient(145deg, #0A0B14 0%, #0D121C 40%, #111827 100%)' }}>
        <canvas ref={entryCanvasRef} className="absolute inset-0 pointer-events-none z-0" />
        <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.04]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
          backgroundSize: '100% 4px'
        }} />
        <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #0052FF 0, #0052FF 1px, transparent 1px, transparent 60px)'
        }} />
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(0,82,255,0.12) 0%, transparent 70%)'
        }} />

        <div className="relative z-20 text-center px-6 max-w-[340px] w-full" style={{ animation: 'entrySlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <h2 className="text-[14px] font-bold text-white/80 tracking-tight mb-8 leading-relaxed"
            style={{ fontFamily: 'var(--font-mono)', animation: 'fadeIn 1s ease-out 0.3s both' }}>
            ready to trade like<br /><span className="text-[#0052FF]">it&#39;s your first day again?</span>
          </h2>

          <div ref={entryButtonsRef} className="flex gap-3" style={{ animation: 'fadeIn 0.8s ease-out 0.5s both' }}>
            <button
              onClick={handleEnter}
              className="flex-1 py-3.5 text-white font-black uppercase tracking-[0.14em] text-[12px] transition-all active:scale-95 bg-[#0ECB81] border border-[#0ECB81]/30 rounded-none relative overflow-hidden group animate-glow-pulse"
              style={{ fontFamily: 'var(--font-mono)', boxShadow: '0 0 20px rgba(14,203,129,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
              <span className="relative z-10">yes / buy</span>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A9F68] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={handleEnter}
              className="flex-1 py-3.5 text-white font-black uppercase tracking-[0.14em] text-[12px] transition-all active:scale-95 bg-[#F6465D] border border-[#F6465D]/30 rounded-none relative overflow-hidden group animate-glow-pulse"
              style={{ fontFamily: 'var(--font-mono)', boxShadow: '0 0 20px rgba(246,70,93,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
              <span className="relative z-10">yes / sell</span>
              <div className="absolute inset-0 bg-gradient-to-t from-[#D63048] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <p className="mt-6 text-[9px] text-white/20 tracking-widest uppercase animate-pulse"
            style={{ fontFamily: 'var(--font-mono)' }}>
            {entryVisitCount === 0 ? 'auto-enter in 20s' : 'auto-enter in 10s'}
          </p>
        </div>
      </div>
    )
  }

  // ========================================================================
  // MAIN APP
  // ========================================================================
  return (
    <div className="h-[100dvh] w-full bg-white flex flex-col relative overflow-hidden">
      {/* GLOBAL PARTICLE BACKGROUND */}
      <ParticleChaos opacity={0.4} />

      {/* Desktop block gate */}
      <div className={`${!desktopBypass ? 'hidden lg:flex' : 'hidden'} relative z-50 h-full w-full items-center justify-center bg-[#F5F8FF] overflow-hidden`}>
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

      {/* Content layer - mobile/tablet only */}
      <div className={`relative z-20 flex flex-col h-full ${!desktopBypass ? 'lg:hidden' : ''}`}>

        {/* HEADER */}
        <header className="sticky top-0 z-40 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative">
          <div className="absolute inset-0 bg-white/90" />
          <ParticleChaos opacity={0.25} />
          
          <div className="relative z-10 mx-auto flex w-full max-w-5xl px-3 sm:px-5 pb-1">
            <div className="flex items-center justify-between w-full py-2.5">
              <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer flex-shrink-0" onClick={() => setActiveTab('game')}>
                <div className="relative h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 overflow-hidden border-2 border-[#0052FF]/80 rounded p-0.5 bg-white shadow-[0_0_12px_rgba(0,82,255,0.4)] animate-icon-float">
                  <Image src="/base-logo.png" alt="base dash logo" fill className="object-cover" priority />
                </div>
                <div className="block whitespace-nowrap">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-widest leading-none font-mono">base dash</h1>
                </div>
              </div>

              <div className="flex justify-end items-center flex-shrink-0">
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="h-9 px-4 flex items-center gap-2 bg-gradient-to-br from-[#0052FF] to-[#0040CC] text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-[0_4px_14px_rgba(0,82,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,82,255,0.45)] transition-all transform hover:-translate-y-0.5 active:scale-95"
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
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide">trade</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">PLAY DEMO</span>
              </button>

              <button onClick={() => handleTabChange('profile')} className={`relative px-1 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex flex-col items-center justify-center gap-0.5 flex-1 ${activeTab === 'profile' ? 'bg-white text-[#0052FF] shadow-[0_0_15px_rgba(0,82,255,0.5)] scale-100 ring-1 ring-[#0052FF]/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}`}>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 hidden sm:block" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide">wallet</span>
                </div>
                <span className="text-[7px] sm:text-[8px] font-semibold opacity-70">PROFILE</span>
              </button>

              <button onClick={() => handleTabChange('leaderboard')} className={`relative overflow-hidden px-1 sm:px-3 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all duration-200 group flex-1 ${activeTab === 'leaderboard' ? 'bg-gradient-to-r from-[#F0B90B] to-[#D4A002] text-white shadow-[0_0_15px_rgba(240,185,11,0.6)] scale-100 ring-1 ring-[#F0B90B]/80' : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-[#F0B90B]/20 hover:ring-[#F0B90B] hover:shadow-[0_4px_12px_rgba(240,185,11,0.4)]'}`}>
                {activeTab !== 'leaderboard' && <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent opacity-20 -translate-x-full animate-[shimmerSweep_2.5s_ease-in-out_infinite]" />}
                <div className="flex items-center gap-1 relative z-10">
                  <svg className={`w-3.5 h-3.5 hidden sm:block transition-transform duration-300 ${activeTab !== 'leaderboard' ? 'group-hover:scale-110 text-[#F0B90B]' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wide ${activeTab !== 'leaderboard' ? 'text-slate-800 group-hover:text-amber-600' : 'text-white'}`}>top 33</span>
                </div>
                <span className={`text-[7px] sm:text-[8px] font-semibold relative z-10 ${activeTab !== 'leaderboard' ? 'opacity-70 text-slate-500' : 'opacity-90 text-white'}`}>RANKS</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col min-h-0 w-full mb-auto relative z-20">
          <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col relative w-full">

            {/* GAME TAB */}
            {activeTab === 'game' && (
              <div className="flex flex-col h-full w-full">
                {!isConnected && (
                  <div className="p-3 border-b border-[#0052FF]/15 bg-gradient-to-r from-[#0052FF]/5 via-[#0052FF]/8 to-[#0052FF]/5 flex items-center justify-center gap-2">
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

                {/* Game Canvas - FIXED sizing */}
                <div className="w-full px-4 mt-4 mb-2">
                  <div className="w-full relative">
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

                {/* DEGEN CONSOLE - Minimalist Premium */}
                <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 pb-4 mt-2">
                  <div className="w-full bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-slate-200/60 shadow-lg relative overflow-hidden">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0052FF]/4 via-transparent to-[#0ECB81]/4 animate-gradient-shift" />
                    
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#0ECB81] rounded-full animate-pulse" />
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">online</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#0052FF] uppercase tracking-widest">base</span>
                      </div>

                      {/* Main text */}
                      <div className="text-center py-2">
                        <p className="text-[15px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                          don't get liquidated
                        </p>
                        <div className="flex items-center justify-center gap-2 text-[9px] font-bold">
                          <span className="px-2 py-0.5 bg-[#F6465D]/10 text-[#F6465D] rounded font-mono">reds = death</span>
                          <span className="text-slate-400">/</span>
                          <span className="px-2 py-0.5 bg-[#0ECB81]/10 text-[#0ECB81] rounded font-mono">greens = profit</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <div className="bg-slate-50/80 px-2 py-2 border border-slate-200/60 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-slate-400 uppercase mb-0.5">fps</p>
                          <p className="text-[9px] font-black text-slate-700">60</p>
                        </div>
                        <div className="bg-[#0052FF]/8 px-2 py-2 border border-[#0052FF]/15 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-[#0052FF]/60 uppercase mb-0.5">data</p>
                          <p className="text-[9px] font-black text-[#0052FF]">on-chain</p>
                        </div>
                        <div className="bg-amber-500/8 px-2 py-2 border border-amber-500/15 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-amber-500/60 uppercase mb-0.5">mode</p>
                          <p className="text-[9px] font-black text-amber-600">degen</p>
                        </div>
                        <div className="bg-slate-50/80 px-2 py-2 border border-slate-200/60 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-slate-400 uppercase mb-0.5">physics</p>
                          <p className="text-[9px] font-black text-[#F6465D]">arcade</p>
                        </div>
                        <div className="bg-emerald-500/8 px-2 py-2 border border-emerald-500/15 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-emerald-500/60 uppercase mb-0.5">market</p>
                          <p className="text-[9px] font-black text-emerald-600">live</p>
                        </div>
                        <div className="bg-slate-50/80 px-2 py-2 border border-slate-200/60 text-center rounded-lg">
                          <p className="text-[6px] font-mono text-slate-400 uppercase mb-0.5">gas</p>
                          <p className="text-[9px] font-black text-slate-700">0</p>
                        </div>
                      </div>
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
                      className="w-full bg-[#0052FF] text-white py-3.5 text-sm font-black tracking-wide uppercase hover:bg-[#0040CC] transition-all shadow-[0_8px_16px_rgba(0,82,255,0.2)] active:scale-[0.98] rounded-xl flex items-center justify-center gap-2"
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

        {/* FOOTER */}
        <footer className="mt-auto border-t border-[#e5e7eb] bg-[#f8fafc] backdrop-blur-md relative z-20">
          <div className="mx-auto w-full max-w-3xl px-6 py-4">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-500">built by <span className="text-[#0052FF]">vov</span>. © {new Date().getFullYear()} base dash.</span>
              <span className="text-slate-400/80 animate-[hintFade_4s_ease-in-out_infinite] tracking-wide">rewards soon.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
