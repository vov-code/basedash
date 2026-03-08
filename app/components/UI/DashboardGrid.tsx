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
            <div className="col-span-2 flex-1 bg-white/70 backdrop-blur-md rounded-none px-3 py-2 sm:px-4 sm:py-2.5 border flex items-center justify-between group hover:bg-white/90 transition-all duration-300 relative overflow-hidden"
                style={{
                    borderColor: `${streakTier.color}20`,
                    boxShadow: `0 8px 30px ${streakTier.color}08`
                }}>
                {/* Subtle side glow */}
                <div className="absolute right-0 top-0 w-32 h-full pointer-events-none transition-opacity duration-300 opacity-50 group-hover:opacity-100" style={{ background: `linear-gradient(to left, ${streakTier.color}15, transparent)` }} />

                {/* Left: streak info */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 z-10">
                    {/* SVG flame icon container */}
                    <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-none flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                            style={{ background: `${streakTier.color}12`, color: streakTier.color }}>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.037 2.211-5.561 3.667-7.333C10 7.167 11.333 5.333 11.667 3c.167.333 1.333 2.667 1.333 2.667C14.333 3 15.667 1 16 0c.333 1 1 3.333 1 3.333S20 6.333 20 10c0 1.5-.333 2.833-1 4-.667 1.167-1.5 2-2.5 2.833C15.167 18 14 19.5 14 21c0 1.083-.917 2-2 2z" />
                            </svg>
                        </div>
                        {streak > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-none animate-pulse" style={{ background: streakTier.color, boxShadow: `0 0 8px ${streakTier.color}` }} />}
                    </div>

                    <div className="flex flex-col min-w-0 gap-0.5 justify-center">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] sm:text-[12px] font-black tracking-wide leading-none text-slate-800" style={mono}>
                                {streakTier.label}
                            </span>
                            {streak > 0 && (
                                <span className="text-[7.5px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-none leading-none tracking-widest uppercase" style={{ ...mono, background: `${streakTier.color}15`, color: streakTier.color }}>
                                    {streak} DAY{streak !== 1 ? 'S' : ''}
                                </span>
                            )}
                        </div>
                        {nextTier ? (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-16 sm:w-24 h-[4px] bg-slate-100 rounded-none overflow-hidden border border-slate-200/50">
                                    <div className="h-full rounded-none transition-all duration-700 ease-out relative"
                                        style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${streakTier.color}, ${nextTier.color})` }}>
                                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                                <span className="text-[7.5px] font-bold text-slate-400 leading-none whitespace-nowrap uppercase tracking-wider" style={mono}>
                                    {nextTier.days - streak}d TO ×{nextTier.multiplier}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[8px] font-bold leading-none uppercase tracking-widest mt-1" style={{ ...mono, color: `${streakTier.color}99` }}>
                                Max level reached
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: multiplier badge */}
                <div className="flex flex-col items-end z-10 flex-shrink-0 justify-center">
                    <span className="text-[18px] sm:text-[22px] font-black leading-none tracking-tighter" style={{ ...mono, color: streakTier.color }}>
                        ×{streakMultiplier.toFixed(streakMultiplier % 1 === 0 ? 0 : streakMultiplier === 1.25 ? 2 : 1)}
                    </span>
                    <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest leading-none mt-1 text-slate-400" style={mono}>
                        Score Boost
                    </span>
                </div>
            </div>

            {/* Chain Status */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-none px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#0052FF]/8 flex flex-col justify-between group hover:border-[#0052FF]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(0,82,255,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 w-14 h-14 bg-[#0052FF]/5 rounded-none blur-2xl group-hover:bg-[#0052FF]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Network</span>
                    <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-none animate-pulse shadow-[0_0_6px_rgba(0,82,255,0.5)] flex-shrink-0" />
                </div>
                <div className="flex flex-col z-10 gap-0.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={mono}>Base L2</span>
                    <span className="text-[7px] sm:text-[8px] text-[#0052FF]/70 mt-1 font-bold leading-none" style={mono}>Optimistic</span>
                </div>
            </div>

            {/* Volatility */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-none px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#F0B90B]/8 flex flex-col justify-between group hover:border-[#F0B90B]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(240,185,11,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -bottom-2 w-14 h-14 bg-[#F0B90B]/5 rounded-none blur-2xl group-hover:bg-[#F0B90B]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Risk Level</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-[#D4A002] leading-none" style={mono}>{combo > 0 ? `${100 * combo}X` : '100X'}</span>
                </div>
                <div className="flex flex-col gap-1 z-10 mt-1">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={mono}>Degen Mode</span>
                    <div className="w-full h-[3px] bg-slate-100 rounded-none overflow-hidden flex-shrink-0">
                        <div className="h-full bg-gradient-to-r from-[#F0B90B] to-[#F6465D] w-[85%] rounded-none relative">
                            <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* On-Chain Security */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-none px-3 py-2 sm:px-3.5 sm:py-2.5 border border-slate-200/50 flex flex-col justify-between group hover:border-[#0ECB81]/15 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(14,203,129,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -left-2 -bottom-2 w-14 h-14 bg-[#0ECB81]/5 rounded-none blur-2xl group-hover:bg-[#0ECB81]/8 transition-colors" />
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
            <div className="flex-1 bg-gradient-to-br from-white/80 to-[#8B5CF6]/5 backdrop-blur-md rounded-none px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#8B5CF6]/12 flex flex-col justify-between group hover:border-[#8B5CF6]/25 hover:shadow-[0_8px_30px_rgba(139,92,246,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-16 bg-[#8B5CF6]/8 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[7px] sm:text-[8px] text-[#8B5CF6]/60 tracking-[0.15em] uppercase font-bold leading-none" style={mono}>Rewards</span>
                    <div className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-none animate-ping shadow-[0_0_6px_rgba(139,92,246,0.5)] flex-shrink-0" />
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
