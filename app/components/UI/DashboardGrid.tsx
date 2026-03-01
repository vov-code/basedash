import React from 'react'

interface DashboardGridProps {
    score: number;
    combo: number;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ score, combo }) => {
    return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-[1.08fr_1fr_1fr] gap-2 sm:gap-2.5 max-w-lg mx-auto">
            {/* Liquidation Watch — full width */}
            <div className="col-span-2 flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border border-[#F6465D]/12 flex items-center justify-between group hover:border-[#F6465D]/25 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(246,70,93,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-28 h-full bg-gradient-to-l from-[#F6465D]/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-2 min-w-0 z-10 w-full justify-between">
                    <div className="flex flex-col min-w-0 justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-[#F6465D] rounded-full animate-pulse shadow-[0_0_6px_rgba(246,70,93,0.5)] flex-shrink-0" />
                            <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-slate-700 leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Liquidation Watch</span>
                        </div>
                        <span className="text-[8px] sm:text-[9px] text-slate-400 leading-none font-medium" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Live Market Feed</span>
                    </div>
                    <div className="flex flex-col items-end z-10 flex-shrink-0 gap-1">
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#F6465D] tracking-wide leading-none px-2 py-1 bg-[#F6465D]/8 rounded-lg border border-[#F6465D]/15" style={{ fontFamily: 'var(--font-mono, monospace)' }}>High Risk</span>
                        <span className="text-[7px] sm:text-[8px] text-slate-400 text-right leading-none font-medium" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Volatility Active</span>
                    </div>
                </div>
            </div>

            {/* Chain Status */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#0052FF]/8 flex flex-col justify-between group hover:border-[#0052FF]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(0,82,255,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 w-14 h-14 bg-[#0052FF]/5 rounded-full blur-2xl group-hover:bg-[#0052FF]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Network</span>
                    <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-full animate-pulse shadow-[0_0_6px_rgba(0,82,255,0.5)] flex-shrink-0" />
                </div>
                <div className="flex flex-col z-10 mt-1.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Base L2</span>
                    <span className="text-[7px] sm:text-[8px] text-[#0052FF]/70 mt-1 font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Optimistic</span>
                </div>
            </div>

            {/* Volatility */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#F0B90B]/8 flex flex-col justify-between group hover:border-[#F0B90B]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(240,185,11,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -bottom-2 w-14 h-14 bg-[#F0B90B]/5 rounded-full blur-2xl group-hover:bg-[#F0B90B]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Risk Level</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-[#D4A002] leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{combo > 0 ? `${100 * combo}X` : '100X'}</span>
                </div>
                <div className="flex flex-col gap-1.5 z-10 mt-1.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Degen Mode</span>
                    <div className="w-full h-[3px] bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-gradient-to-r from-[#F0B90B] to-[#F6465D] w-[85%] rounded-full relative">
                            <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* On-Chain Scores */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-slate-200/50 flex flex-col justify-between group hover:border-[#0ECB81]/15 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(14,203,129,0.06)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -left-2 -bottom-2 w-14 h-14 bg-[#0ECB81]/5 rounded-full blur-2xl group-hover:bg-[#0ECB81]/8 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 tracking-[0.15em] uppercase font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Security</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-[#0ECB81] uppercase leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>OK</span>
                </div>
                <div className="flex flex-col z-10 mt-1.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-slate-800 leading-none tracking-tight" style={{ fontFamily: 'var(--font-mono, monospace)' }}>On-Chain</span>
                    <span className="text-[7px] sm:text-[8px] text-slate-400 mt-1 font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Verified</span>
                </div>
            </div>

            {/* Rewards */}
            <div className="flex-1 bg-gradient-to-br from-white/80 to-[#8B5CF6]/5 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-[#8B5CF6]/12 flex flex-col justify-between group hover:border-[#8B5CF6]/25 hover:shadow-[0_8px_30px_rgba(139,92,246,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-16 bg-[#8B5CF6]/8 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[7px] sm:text-[8px] text-[#8B5CF6]/60 tracking-[0.15em] uppercase font-bold leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Award Pool</span>
                    <div className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full animate-ping shadow-[0_0_6px_rgba(139,92,246,0.5)] flex-shrink-0" />
                </div>
                <div className="flex flex-col relative z-10 mt-1.5">
                    <span className="text-[11px] sm:text-[12px] font-black text-[#8B5CF6] leading-none tracking-tight" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Rewards</span>
                    <span className="text-[7px] sm:text-[8px] text-[#8B5CF6]/60 mt-1 font-bold animate-[pulse_2s_infinite] leading-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Coming Soon</span>
                </div>
            </div>
        </div>
    )
}
