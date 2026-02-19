/**
 * ============================================================================
 * BASE DASH — Clean Base.org Design
 * Minimal, professional, beautiful
 * ============================================================================
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import GameEngine from './components/Game/GameEngine'
import Leaderboard from './components/Leaderboard/Leaderboard'
import DailyCheckinButton from './components/DailyCheckin/CheckinButton'
import { useWallet } from './hooks/useWallet'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TabType = 'game' | 'leaderboard' | 'profile'

interface TabConfig {
  id: TabType
  label: string
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TABS: TabConfig[] = [
  { id: 'game', label: 'Play' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'profile', label: 'Profile' },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet()

  const walletDisplay = useMemo(() => {
    if (!address) return null
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }, [address])

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

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
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0052FF] flex items-center justify-center overflow-hidden">
                <img src="/base-logo.png" alt="Base" className="w-10 h-10 object-cover" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Base Dash</h1>
                <p className="text-xs text-gray-500">Built on Base</p>
              </div>
            </div>

            {/* Wallet */}
            <div className="flex items-center gap-3">
              {isConnected && address ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-mono text-xs text-green-700">{walletDisplay}</span>
                  </div>
                  <button
                    onClick={handleDisconnectWallet}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Disconnect"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="px-4 py-2 rounded-lg bg-[#0052FF] hover:bg-[#0040CC] text-white text-sm font-medium transition-all"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Connect Banner */}
        {!isConnected && (
          <div className="mb-6 p-5 rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0052FF] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Connect wallet</h2>
                  <p className="text-xs text-gray-600">Save your scores on-chain</p>
                </div>
              </div>
              <button
                onClick={handleConnectWallet}
                className="px-4 py-2 rounded-lg bg-[#0052FF] hover:bg-[#0040CC] text-white text-sm font-medium transition-all"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'game' && (
          <div className="space-y-6 animate-fade-in-up">
            <GameEngine />
            
            {/* How to Play */}
            <div className="rounded-2xl border border-gray-200 p-6 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">How to Play</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl">⌨️</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Jump</p>
                    <p className="text-xs text-gray-600">Space, W, or tap</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl">🔴</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Avoid Red</p>
                    <p className="text-xs text-gray-600">Bear candles = game over</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl">🟢</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Collect Green</p>
                    <p className="text-xs text-gray-600">Slows speed + points</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl">⚡</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Multi-Jump</p>
                    <p className="text-xs text-gray-600">Unlocks at 150 pts</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Fast Gameplay</h4>
                <p className="text-xs text-gray-600">Smooth 60 FPS with optimized physics</p>
              </div>
              <div className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">On-Chain Scores</h4>
                <p className="text-xs text-gray-600">All scores saved to Base blockchain</p>
              </div>
              <div className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">7 Unique Worlds</h4>
                <p className="text-xs text-gray-600">Unlock new themes as you progress</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="animate-fade-in-up">
            <Leaderboard />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-fade-in-up">
            <div className="rounded-2xl border border-gray-200 p-8 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile</h2>
              {isConnected && address ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Connected Wallet</p>
                    <p className="font-mono text-sm text-gray-900 break-all">{address}</p>
                  </div>
                  <DailyCheckinButton />
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">Connect wallet to view your profile</p>
                  <button
                    onClick={handleConnectWallet}
                    className="px-5 py-2.5 rounded-lg bg-[#0052FF] hover:bg-[#0040CC] text-white text-sm font-medium transition-all"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>© 2026 Base Dash. Built on Base.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-gray-900 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
