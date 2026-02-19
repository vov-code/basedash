/**
 * ============================================================================
 * BASE DASH — Main Page Component
 * Premium landing page with tabs for game, leaderboard, and profile
 * 
 * Features:
 * - Clean, modern UI inspired by base.org design language
 * - Smooth animations and transitions
 * - Responsive design for all screen sizes
 * - Wallet integration with visual feedback
 * - Tabbed navigation with animated transitions
 * - Lowkey degen copy throughout
 * 
 * @version 3.0.0
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import GameEngine from './components/Game/GameEngine'
import Leaderboard from './components/Leaderboard/Leaderboard'
import DailyCheckinButton from './components/DailyCheckin/CheckinButton'
import { useWallet } from './hooks/useWallet'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type TabType = 'game' | 'leaderboard' | 'profile'

interface TabConfig {
  id: TabType
  label: string
  icon: string
  description: string
}

interface TipConfig {
  icon: string
  color: string
  title: string
  description: string
  hint: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TABS: TabConfig[] = [
  {
    id: 'game',
    label: 'Play',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    description: 'Run the charts, stay safe',
  },
  {
    id: 'leaderboard',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    label: 'Ranks',
    description: 'See who\'s top degen',
  },
  {
    id: 'profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    label: 'Profile',
    description: 'Your stats and check-ins',
  },
]

const HOW_TO_PLAY_TIPS: TipConfig[] = [
  {
    icon: '✦',
    color: '#16e79a',
    title: 'Jump',
    description: 'Tap, click, or space',
    hint: 'Hold for higher jumps',
  },
  {
    icon: '🕯️',
    color: '#ff6078',
    title: 'Avoid Red',
    description: 'Red candles = instant rekt',
    hint: 'They\'re everywhere',
  },
  {
    icon: '🕯️',
    color: '#16e79a',
    title: 'Collect Green',
    description: 'Green = chill mode + points',
    hint: 'Slows you down temporarily',
  },
  {
    icon: '⚡',
    color: '#3f7fff',
    title: 'Multi-Jump',
    description: 'Unlocks as you progress',
    hint: '120pts = double, 400pts = triple',
  },
]

const FEATURES = [
  {
    title: 'On-Chain Scores',
    description: 'Every run submitted to Base blockchain. Permanent. Immutable. Degen.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: '#0052FF',
  },
  {
    title: 'Daily Check-Ins',
    description: 'Come back daily for streak bonuses. Consistency pays.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#16e79a',
  },
  {
    title: 'World Progression',
    description: 'Unlock new worlds as you score higher. Each has unique vibes.',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    color: '#a16eff',
  },
]

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()

  // ──────────────────────────────────────────────────────────────────────────
  // MEMOIZED VALUES
  // ──────────────────────────────────────────────────────────────────────────

  const walletDisplay = useMemo(() => {
    if (!address) return null
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }, [address])

  // ──────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const handleTabChange = useCallback((tabId: TabType) => {
    setActiveTab(tabId)
  }, [])

  const handleConnectWallet = useCallback(async () => {
    try {
      await connectWallet()
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }, [connectWallet])

  const handleDisconnectWallet = useCallback(() => {
    disconnectWallet()
  }, [disconnectWallet])

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0a0b14]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-4">
            <div className="group relative">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0052FF] to-[#0033AA] shadow-lg shadow-blue-500/20 transition-all duration-300 group-hover:shadow-blue-500/30 group-hover:scale-105">
                <img src="/base-logo.png" alt="Base" className="h-11 w-11 object-cover" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-white/0 transition-all duration-300 group-hover:bg-white/10" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold text-white tracking-tight">basedash</h1>
              <p className="text-[11px] uppercase tracking-wider text-white/40">built on base</p>
            </div>
          </div>

          {/* Wallet Section */}
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 transition-all duration-300 hover:bg-green-500/15">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  <span className="font-mono text-xs text-green-400">{walletDisplay}</span>
                </div>
                <button
                  onClick={handleDisconnectWallet}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-white/60 transition-all duration-200 hover:border-white/10 hover:bg-white/10"
                  title="Disconnect wallet"
                  aria-label="Disconnect wallet"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                className="rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0033AA] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-[#0033AA] hover:to-[#0052FF] hover:scale-105 active:scale-95"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )

  const renderNavigation = () => (
    <nav className="border-b border-white/8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex gap-2 py-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`group relative flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <svg className={`h-4 w-4 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-blue-700" />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )

  const renderConnectBanner = () => (
    !isConnected && (
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/20">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0052FF] to-[#0033AA] shadow-lg shadow-blue-500/30">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Connect wallet</h2>
              <p className="text-xs text-white/40 mt-0.5">Save your runs on-chain, flex on the leaderboard</p>
            </div>
          </div>
          <button
            onClick={handleConnectWallet}
            className="shrink-0 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0033AA] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-[#0033AA] hover:to-[#0052FF] hover:scale-105"
          >
            Connect
          </button>
        </div>
      </div>
    )
  )

  const renderHowToPlay = () => (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
      <h3 className="mb-4 text-sm font-semibold text-white/80">How to Play</h3>
      <div className="grid gap-4 md:grid-cols-4">
        {HOW_TO_PLAY_TIPS.map((tip, index) => (
          <div
            key={index}
            className="group flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
          >
            <span className="text-xl" style={{ color: tip.color }}>{tip.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/80">{tip.title}</p>
              <p className="text-xs text-white/40 mt-0.5">{tip.description}</p>
              <p className="text-[10px] text-white/25 mt-1 italic">{tip.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderFeatures = () => (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {FEATURES.map((feature, index) => (
        <div
          key={index}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ background: `${feature.color}15` }}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: feature.color }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
        </div>
      ))}
    </div>
  )

  const renderGameTab = () => (
    <div className="space-y-6 animate-fade-in-up">
      <GameEngine />
      {renderHowToPlay()}
      {renderFeatures()}
    </div>
  )

  const renderLeaderboardTab = () => (
    <div className="animate-fade-in-up">
      <Leaderboard />
    </div>
  )

  const renderProfileTab = () => (
    <div className="animate-fade-in-up">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
        <h2 className="mb-6 flex items-center gap-2 text-base font-semibold text-white">
          <svg className="h-5 w-5 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profile
        </h2>
        {isConnected && address ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-black/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Connected Wallet</p>
              <p className="break-all font-mono text-sm text-white/80">{address}</p>
            </div>
            <DailyCheckinButton />
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
              <svg className="h-10 w-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="mb-6 text-sm text-white/50">Connect wallet to view profile and track your progress</p>
            <button
              onClick={handleConnectWallet}
              className="rounded-xl bg-gradient-to-r from-[#0052FF] to-[#0033AA] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-[#0033AA] hover:to-[#0052FF] hover:scale-105"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderFooter = () => (
    <footer className="mt-16 border-t border-white/8">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col items-center justify-between gap-6 text-xs text-white/30 sm:flex-row">
          <p className="font-medium">© 2026 basedash. built for degens, by degens.</p>
          <div className="flex gap-6">
            <a href="#" className="text-white/30 transition-colors duration-200 hover:text-white/60">Terms</a>
            <a href="#" className="text-white/30 transition-colors duration-200 hover:text-white/60">Privacy</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/30 transition-colors duration-200 hover:text-white/60"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-[#0a0b14] overflow-x-hidden">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0b14] via-[#0d0f1a] to-[#0a0b14]" />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 animate-pulse-glow rounded-full bg-[#0052FF]/10 blur-[120px]" />

      {/* Additional ambient glows */}
      <div className="pointer-events-none fixed bottom-0 left-1/4 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#0033AA]/5 blur-[100px]" />
      <div className="pointer-events-none fixed right-1/4 top-1/3 h-[250px] w-[350px] translate-x-1/2 rounded-full bg-[#0052FF]/5 blur-[80px]" />

      {/* Content */}
      <div className="relative z-10">
        {renderHeader()}
        {renderNavigation()}

        <div className="mx-auto max-w-7xl px-6 py-8">
          {renderConnectBanner()}

          {activeTab === 'game' && renderGameTab()}
          {activeTab === 'leaderboard' && renderLeaderboardTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </div>

        {renderFooter()}
      </div>
    </main>
  )
}
