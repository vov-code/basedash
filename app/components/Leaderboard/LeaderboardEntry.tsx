import { PlayerScore } from '@/app/contracts'
import { formatAddress, bigIntToNumber } from '@/app/lib/utils'
import React, { useState } from 'react'

interface RankMeta {
    label: string
    bg: string
    text: string
}

const RANK_META: Record<number, RankMeta> = {
    1: {
        label: '🥇',
        bg: 'bg-[#F0B90B]/10 border-[#F0B90B]/20',
        text: 'text-[#B78905]',
    },
    2: {
        label: '🥈',
        bg: 'bg-slate-100/60 border-slate-200/40',
        text: 'text-slate-500',
    },
    3: {
        label: '🥉',
        bg: 'bg-orange-50/60 border-orange-200/30',
        text: 'text-orange-500',
    },
}

export function LeaderboardEntry({ entry, rank, isSelf, selfRef }: { entry: PlayerScore; rank: number; isSelf: boolean; selfRef?: React.Ref<HTMLDivElement> }) {
    const score = bigIntToNumber(entry.score)
    const streak = bigIntToNumber(entry.streakDays)
    const meta = RANK_META[rank]

    const [copied, setCopied] = useState(false)
    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(entry.player)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Deterministic avatar color based on address
    const addrStr = entry.player.toLowerCase()
    const p1 = parseInt(addrStr.slice(2, 4), 16)
    const p2 = parseInt(addrStr.slice(4, 6), 16)
    const p3 = parseInt(addrStr.slice(6, 8), 16)

    return (
        <div
            ref={isSelf ? selfRef : undefined}
            className={`flex items-center justify-between py-2.5 sm:py-3 px-3 sm:px-4 transition-all ${isSelf
                ? 'bg-[#0052FF]/[0.04]'
                : 'hover:bg-slate-50/60'
                }`}
        >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                {/* Rank */}
                <div
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs sm:text-sm font-black ${rank <= 3 ? meta.bg + ' border' : 'text-slate-400'}`}
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                    {rank <= 3 ? meta.label : rank}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 transition-all text-left group py-0.5"
                        >
                            <div
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-black/5"
                                style={{ backgroundColor: `rgb(${p1}, ${p2}, ${p3})`, backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.05) 100%)` }}
                            />
                            <span className="font-mono text-[10px] sm:text-[11px] font-bold text-slate-600 truncate min-w-0 group-hover:text-[#0052FF] transition-colors">
                                {copied ? 'copied!' : formatAddress(entry.player)}
                            </span>
                            {copied ? (
                                <svg className="w-3 h-3 text-[#0ECB81] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-3 h-3 text-slate-300 group-hover:text-[#0052FF] group-hover:opacity-100 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            )}
                        </button>
                        {isSelf && (
                            <span className="bg-[#0052FF]/10 px-1.5 py-0.5 rounded-md text-[8px] uppercase tracking-wider font-black text-[#0052FF]" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                you
                            </span>
                        )}
                    </div>

                    {streak > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-[#D4A002]/80" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                            🔥 {streak} day{streak > 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

            <div className="ml-3 sm:ml-4 flex-shrink-0 text-right">
                <p className={`font-mono text-sm sm:text-[15px] font-black tracking-tight leading-none ${isSelf ? 'text-[#0052FF]' : 'text-slate-800'}`}>
                    ${score.toLocaleString()}
                </p>
            </div>
        </div>
    )
}
