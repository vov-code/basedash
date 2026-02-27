import { PlayerScore } from '@/app/contracts'
import { formatAddress, bigIntToNumber } from '@/app/lib/utils'
import React, { useState } from 'react'

interface RankMeta {
    label: string
    tone: string
    border: string
    text: string
}

const RANK_META: Record<number, RankMeta> = {
    1: {
        label: '🥇',
        tone: 'bg-[#fff8dd]',
        border: 'border-[#f8da7f]',
        text: 'text-[#b78905]',
    },
    2: {
        label: '🥈',
        tone: 'bg-slate-100',
        border: 'border-slate-300',
        text: 'text-slate-600',
    },
    3: {
        label: '🥉',
        tone: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-700',
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
            className={`flex items-center justify-between p-3 sm:p-4 mb-2 rounded-2xl transition-all border ${isSelf
                ? 'border-[#0052FF]/30 bg-[#0052FF]/5 shadow-[0_8px_16px_rgba(0,82,255,0.08)]'
                : rank <= 3
                    ? `${meta.tone} ${meta.border} shadow-sm`
                    : 'border-slate-200/60 bg-white hover:border-slate-300 shadow-sm'
                }`}
        >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl border text-xs sm:text-sm font-black shadow-inner ${rank <= 3 ? `${meta.tone} ${meta.border} ${meta.text}` : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                >
                    {rank <= 3 ? meta.label : `#${rank}`}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 border border-slate-200/60 bg-white/50 hover:bg-slate-50 active:scale-95 transition-all text-left px-2 py-1 rounded-lg shadow-sm group"
                        >
                            <div
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 shadow-inner"
                                style={{ backgroundColor: `rgb(${p1}, ${p2}, ${p3})`, backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.1) 100%)` }}
                            />
                            <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-700 truncate min-w-0 group-hover:text-[#0052FF] transition-colors">
                                {copied ? 'copied!' : formatAddress(entry.player)}
                            </span>
                            {copied ? (
                                <svg className="w-3 h-3 text-[#0ECB81] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-[#0052FF] opacity-50 group-hover:opacity-100 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            )}
                        </button>
                        {isSelf && (
                            <span className="border border-[#0052FF]/20 bg-[#0052FF]/10 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] lowercase tracking-wider font-black text-[#0052FF]">
                                you
                            </span>
                        )}
                    </div>

                    {streak > 0 && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] text-orange-700">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3c1 2-1 3-1 5 0 2 2 2 2 4a3 3 0 0 1-6 0c0-4 3-5 5-9z" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M14 10c1 1 3 2 3 5a5 5 0 0 1-10 0" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {streak} day streak
                        </div>
                    )}
                </div>
            </div>

            <div className="ml-3 sm:ml-4 flex-shrink-0 text-right">
                <p className="font-mono text-lg sm:text-xl font-black text-slate-900 tracking-tight">${score.toLocaleString()}</p>
                <p className="text-[9px] sm:text-[10px] font-bold lowercase tracking-widest text-[#0ECB81] mt-0.5">pnl</p>
            </div>
        </div>
    )
}
