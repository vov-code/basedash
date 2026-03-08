import React from 'react'
import { StreakTier } from '@/app/hooks/useDailyCheckin'

interface DashboardGridProps {
    score: number;
    combo: number;
    streak: number;
    streakTier: StreakTier;
    streakMultiplier: number;
    nextTier: StreakTier | null;
}

const mono = { fontFamily: 'var(--font-mono, monospace)' }

export const DashboardGrid: React.FC<DashboardGridProps> = ({ score, combo, streak, streakTier, streakMultiplier, nextTier }) => {
    // Progress to next tier (0-100%)
    const prevTierDays = streakTier.days
    const nextTierDays = nextTier ? nextTier.days : streakTier.days
    const progress = nextTier
        ? Math.min(100, ((streak - prevTierDays) / (nextTierDays - prevTierDays)) * 100)
        : 100

    return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-[auto_1fr_1fr] gap-1.5 sm:gap-2 max-w-lg mx-auto">
            {/* STREAK MULTIPLIER — full width hero block */}
            <div className="col-span-2 flex-1 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border flex items-center justify-between group hover:shadow-lg transition-all duration-300 relative overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, white 0%, ${streakTier.bg} 100%)`,
                    borderColor: `${streakTier.color}20`,
                }}>
                {/* Glow accent */}
                <div className="absolute right-0 top-0 w-32 h-full pointer-events-none" style={{ background: `linear-gradient(to left, ${streakTier.color}08, transparent)` }} />

                {/* Left: streak info */}
                <div className="flex items-center gap-2.5 min-w-0 z-10">
                    {/* Emoji badge with pulse */}
                    <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg"
                            style={{ background: streakTier.bg, boxShadow: `0 4px 12px ${streakTier.color}15` }}>
                            {streakTier.emoji}
                        </div>
                        {streak > 0 && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: streakTier.color, boxShadow: `0 0 6px ${streakTier.color}80` }} />}
                    </div>

                    <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] sm:text-[11px] font-black tracking-wide leading-none" style={{ ...mono, color: streakTier.color }}>
                                {streakTier.label}
                            </span>
                            {streak > 0 && (
                                <span className="text-[7px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-none" style={{ ...mono, background: streakTier.bg, color: streakTier.color }}>
                                    {streak}d
                                </span>
                            )}
                        </div>
                        {/* Progress bar to next tier */}
                        {nextTier ? (
                            <div className="flex items-center gap-1.5">
                                <div className="w-16 sm:w-20 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700 ease-out relative"
                                        style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${streakTier.color}, ${nextTier.color})` }}>
                                        <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                                <span className="text-[7px] font-bold text-slate-400 leading-none whitespace-nowrap" style={mono}>
                                    {nextTier.days - streak}d → {nextTier.emoji}×{nextTier.multiplier}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[7px] font-bold leading-none" style={{ ...mono, color: `${streakTier.color}99` }}>
                                Max tier reached!
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: multiplier badge */}
                <div className="flex flex-col items-end z-10 flex-shrink-0 gap-0.5">
                    <span className="text-[16px] sm:text-[18px] font-black leading-none tracking-tight" style={{ ...mono, color: streakTier.color }}>
                        ×{streakMultiplier.toFixed(streakMultiplier % 1 === 0 ? 0 : streakMultiplier === 1.25 ? 2 : 1)}
                    </span>
                    <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none px-1.5 py-0.5 rounded-md" style={{ ...mono, background: `${streakTier.color}12`, color: streakTier.color }}>
                        Score Boost
                    </span>
                </div>
            </div>

            {/* Chain Status */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#0052FF]/8 flex flex-col justify-between group hover:border-[#0052FF]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(0,82,255,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 w-14 h-14 bg-[#0052FF]/5 rounded-full blur-2xl group-hover:bg-[#0052FF]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Network</span>
                    <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-full animate-pulse shadow-[0_0_6px_rgba(0,82,255,0.5)] flex-shrink-0" />
                </div>
                <div className="flex flex-col z-10 gap-0.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={mono}>Base L2</span>
                    <span className="text-[7px] sm:text-[8px] text-[#0052FF]/70 mt-1 font-bold leading-none" style={mono}>Optimistic</span>
                </div>
            </div>

            {/* Volatility */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#F0B90B]/8 flex flex-col justify-between group hover:border-[#F0B90B]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(240,185,11,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -bottom-2 w-14 h-14 bg-[#F0B90B]/5 rounded-full blur-2xl group-hover:bg-[#F0B90B]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Risk Level</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-[#D4A002] leading-none" style={mono}>{combo > 0 ? `${100 * combo}X` : '100X'}</span>
                </div>
                <div className="flex flex-col gap-1 z-10 mt-1">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={mono}>Degen Mode</span>
                    <div className="w-full h-[3px] bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-gradient-to-r from-[#F0B90B] to-[#F6465D] w-[85%] rounded-full relative">
                            <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* On-Chain Security */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-slate-200/50 flex flex-col justify-between group hover:border-[#0ECB81]/15 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(14,203,129,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -left-2 -bottom-2 w-14 h-14 bg-[#0ECB81]/5 rounded-full blur-2xl group-hover:bg-[#0ECB81]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Security</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-[#0ECB81] uppercase leading-none" style={mono}>OK</span>
                </div>
                <div className="flex flex-col z-10 gap-0.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={mono}>On-Chain</span>
                    <span className="text-[7px] sm:text-[8px] text-slate-400 mt-1 font-bold leading-none" style={mono}>Verified</span>
                </div>
            </div>

            {/* Rewards & Tiers */}
            <div className="flex-1 bg-gradient-to-br from-white/80 to-[#8B5CF6]/5 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#8B5CF6]/12 flex flex-col justify-between group hover:border-[#8B5CF6]/25 hover:shadow-[0_8px_30px_rgba(139,92,246,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-16 bg-[#8B5CF6]/8 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[7px] sm:text-[8px] text-[#8B5CF6]/60 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Rewards</span>
                    <div className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full animate-ping shadow-[0_0_6px_rgba(139,92,246,0.5)] flex-shrink-0" />
                </div>
                <div className="flex flex-col relative z-10 gap-1 mt-0.5">
                    <span className="text-[9px] sm:text-[10px] font-black text-[#8B5CF6] leading-none tracking-tight" style={mono}>Token Airdrop</span>
                    <span className="text-[6px] sm:text-[7px] text-[#8B5CF6]/50 font-bold leading-tight" style={mono}>
                        Best score → future token airdrop. Streak boosts your rank.
                    </span>
                </div>
            </div>
        </div>
    )
}
