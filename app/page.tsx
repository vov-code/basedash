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

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import GameEngine from './components/Game/GameEngine'
import Leaderboard from './components/Leaderboard/Leaderboard'
import DailyCheckinButton from './components/DailyCheckin/CheckinButton'
import { useWallet } from './hooks/useWallet'
import { useDailyCheckin } from './hooks/useDailyCheckin'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from './contracts'

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

    const COUNT = Math.min(120, Math.floor(w * h / 8000))
    const CONNECTION_DIST = w < 600 ? 100 : 140
    const SHOW_CONNECTIONS = COUNT <= 80
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

      // Draw connections between nearby particles (skip on mobile for perf)
      if (SHOW_CONNECTIONS) for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
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
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()
  const { checkInStatus, canSubmitScore } = useDailyCheckin(address)
  const networkLabel = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'base sepolia' : 'base mainnet'

  const walletDisplay = useMemo(() => {
    if (!address) return null
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  const handleConnect = useCallback(async () => {
    try { await connectWallet() } catch { }
  }, [connectWallet])

  // ========================================================================
  // SCORE SUBMISSION — Game → API sign → Contract submitScore
  // ========================================================================

  const { writeContractAsync } = useWriteContract()
  const [submitTxHash, setSubmitTxHash] = useState<`0x${string}` | undefined>()
  const { isSuccess: isScoreConfirmed } = useWaitForTransactionReceipt({ hash: submitTxHash })

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
  // PWA INSTALL PROMPT (Improvement #8)
  // ========================================================================

  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promptEvent = deferredPrompt as any
    promptEvent.prompt()
    await promptEvent.userChoice
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }, [deferredPrompt])

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Particle background */}
      <ParticleChaos />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col flex-1">

        {/* ============ HEADER ============ */}
        <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/90 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-5 h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 bg-[#0052FF] flex items-center justify-center animate-[pulseGlow_3s_ease-in-out_infinite] transition-transform duration-300 hover:scale-110 cursor-pointer"
                style={{ borderRadius: '6px' }}
              >
                <img src="/base-logo.png" alt="" className="w-8 h-8 object-cover" />
              </div>
              <span 
                className="text-[15px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] via-[#3378FF] to-[#0052FF] bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite] hover:scale-105 transition-transform duration-300"
                style={{ fontFamily: 'var(--font-brand)' }}
              >
                base dash
              </span>
            </div>

            {/* Wallet */}
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f0fdf4] border border-[#bbf7d0]">
                  <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
                  <span className="font-mono text-xs text-[#15803d]">{walletDisplay}</span>
                </div>
                <button
                  onClick={() => disconnectWallet()}
                  className="p-1.5 text-[#9ca3af] hover:text-[#1a2030] transition-colors"
                  title="disconnect"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="px-4 py-1.5 bg-[#0052FF] text-white text-xs font-medium hover:bg-[#0040CC] transition-colors"
              >
                connect
              </button>
            )}
          </div>
        </header>

        {/* ============ NAVIGATION ============ */}
        <nav className="border-b border-[#e5e7eb] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-5">
            <div className="flex items-center gap-0 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-xs font-medium transition-colors border-b-2 ${activeTab === tab.id
                    ? 'text-[#0052FF] border-[#0052FF]'
                    : 'text-[#9ca3af] border-transparent hover:text-[#1a2030]'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ============ MAIN CONTENT ============ */}
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-5 py-8">

            {/* Connect banner */}
            {!isConnected && (
              <div className="mb-8 p-5 border border-[#0052FF]/15 bg-[#f8faff]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#0052FF] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1a2030]">connect wallet</p>
                      <p className="text-xs text-[#9ca3af]">save scores on-chain and join the leaderboard</p>
                    </div>
                  </div>
                  <button
                    onClick={handleConnect}
                    className="px-4 py-2 bg-[#0052FF] text-white text-xs font-medium hover:bg-[#0040CC] transition-colors flex-shrink-0"
                  >
                    connect
                  </button>
                </div>
              </div>
            )}

            {/* ---- GAME TAB ---- */}
            {activeTab === 'game' && (
              <div>
                <GameEngine
                  storageKey="basedash_highscore_v2"
                  onScoreSubmit={handleScoreSubmit}
                  isConnected={isConnected}
                  canSubmitScore={canSubmitScore}
                  connectWallet={handleConnect}
                  isScoreConfirmed={isScoreConfirmed}
                  submitTxHash={submitTxHash}
                />

                {/* How to play section */}
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#FFF0F2] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#F6465D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#1a2030] mb-1">avoid red candles</p>
                    <p className="text-xs text-[#9ca3af]">red = bearish. hit one and you're rekt.</p>
                  </div>
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#e8f8f0] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#1a2030] mb-1">collect green candles</p>
                    <p className="text-xs text-[#9ca3af]">green = bullish. +25 points + chill mode slowdown.</p>
                  </div>
                  <div className="p-5 border border-[#e5e7eb] bg-white">
                    <div className="w-8 h-8 bg-[#eef4ff] flex items-center justify-center mb-3">
                      <svg className="w-4 h-4 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#1a2030] mb-1">send it on-chain</p>
                    <p className="text-xs text-[#9ca3af]">submit your score to the base leaderboard.</p>
                  </div>
                </div>

                {/* Features */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: '10 worlds', value: 'explore' },
                    { label: '9 speed tiers', value: 'survive' },
                    { label: 'on-chain scores', value: 'compete' },
                    { label: 'daily check-in', value: 'streak' },
                  ].map((f) => (
                    <div key={f.label} className="p-3 border border-[#e5e7eb] bg-[#f8f9fc] text-center">
                      <p className="text-[10px] text-[#9ca3af] mb-0.5">{f.value}</p>
                      <p className="text-xs font-medium text-[#1a2030]">{f.label}</p>
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
              <div>
                {isConnected && address ? (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-[#1a2030]">profile</h2>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="p-4 border border-[#e5e7eb] bg-white">
                        <p className="text-[11px] text-[#9ca3af] mb-2">wallet</p>
                        <p className="break-all font-mono text-sm text-[#1a2030]">{address}</p>
                      </div>
                      <div className="p-4 border border-[#e5e7eb] bg-white">
                        <p className="text-[11px] text-[#9ca3af] mb-2">network</p>
                        <p className="text-sm font-medium text-[#1a2030]">{networkLabel}</p>
                        <p className="mt-2 text-xs text-[#9ca3af]">
                          score submit:{' '}
                          <span className={canSubmitScore ? 'text-[#0ECB81]' : 'text-[#9ca3af]'}>
                            {canSubmitScore ? 'ready' : 'not ready'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="p-4 border border-[#e5e7eb] bg-white">
                        <p className="text-[11px] text-[#9ca3af]">streak days</p>
                        <p className="mt-1 text-2xl font-semibold text-[#1a2030]">{checkInStatus.streak}</p>
                      </div>
                      <div className="p-4 border border-[#e5e7eb] bg-white">
                        <p className="text-[11px] text-[#9ca3af]">farcaster</p>
                        <p className="mt-1 text-sm font-medium text-[#1a2030]">
                          {checkInStatus.isLinked ? `linked #${checkInStatus.linkedFid.toString()}` : 'not linked'}
                        </p>
                      </div>
                      <div className="p-4 border border-[#e5e7eb] bg-white">
                        <p className="text-[11px] text-[#9ca3af]">daily status</p>
                        <p className="mt-1 text-sm font-medium text-[#1a2030]">
                          {checkInStatus.canCheckIn ? 'ready to check in' : 'checked in today'}
                        </p>
                      </div>
                    </div>

                    <DailyCheckinButton />
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-[#f8f9fc] border border-[#e5e7eb] flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-[#9ca3af] text-sm mb-5">connect wallet to view your profile</p>
                    <button
                      onClick={handleConnect}
                      className="bg-[#0052FF] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0040CC] transition-colors"
                    >
                      connect wallet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        {/* ============ PWA INSTALL BANNER ============ */}
        {showInstallBanner && (
          <div className="border-t border-[#0052FF]/15 bg-[#f8faff]">
            <div className="mx-auto max-w-3xl px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0052FF] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a2030]">add to home screen</p>
                    <p className="text-xs text-[#9ca3af]">install base dash for the best experience</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleInstall}
                    className="px-3 py-1.5 bg-[#0052FF] text-white text-xs font-medium hover:bg-[#0040CC] transition-colors"
                  >
                    install
                  </button>
                  <button
                    onClick={() => setShowInstallBanner(false)}
                    className="p-1 text-[#9ca3af] hover:text-[#1a2030] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ FOOTER ============ */}
        <footer className="border-t border-[#e5e7eb] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-[#9ca3af]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a href="#" className="hover:text-[#1a2030] transition-colors">terms</a>
                <a href="#" className="hover:text-[#1a2030] transition-colors">privacy</a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#1a2030] transition-colors flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  github
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span className="inline-block animate-pulse">🔜</span>
                  <span>score-to-token rewards coming soon</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">© 2026 base dash. built by vov.</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
