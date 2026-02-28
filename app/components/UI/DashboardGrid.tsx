import React from 'react'

interface DashboardGridProps {
    score: number;
    combo: number;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ score, combo }) => {
    return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-[1.08fr_1fr_1fr] gap-2.5 sm:gap-3 max-w-lg mx-auto">
            {/* Liquidation Watch — full width */}
            <div className="col-span-2 flex-1 bg-white/70 backdrop-blur-md rounded-[16px] sm:rounded-[20px] px-2.5 py-1.5 sm:px-3 sm:py-2.5 border border-[#F6465D]/15 flex items-center justify-between group hover:border-[#F6465D]/30 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(246,70,93,0.1)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-[#F6465D]/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10 w-full justify-between">
                    <div className="flex flex-col min-w-0 justify-center">
                        <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5">
                            <div className="w-1.5 h-1.5 bg-[#F6465D] rounded-full animate-pulse shadow-[0_0_8px_rgba(246,70,93,0.6)] flex-shrink-0" />
                            <span className="text-[11px] sm:text-[12px] font-medium tracking-wide text-slate-700 leading-none">Liquidation Watch</span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-slate-500 leading-none">Live Market Feed</span>
                    </div>
                    <div className="flex flex-col items-end z-10 flex-shrink-0">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#F6465D] tracking-wide leading-none px-2 py-1 bg-[#F6465D]/10 rounded-md border border-[#F6465D]/20">High Risk</span>
                        <span className="text-[8px] sm:text-[9px] text-slate-400 mt-1.5 text-right leading-none">Volatility Active</span>
                    </div>
                </div>
            </div>

            {/* Chain Status */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-[16px] sm:rounded-[20px] px-2.5 py-1.5 sm:p-3 border border-[#0052FF]/10 flex flex-col justify-between group hover:border-[#0052FF]/25 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(0,82,255,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-[#0052FF]/5 rounded-full blur-2xl group-hover:bg-[#0052FF]/10 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[8px] sm:text-[9px] text-slate-400 tracking-wide uppercase font-medium">Network</span>
                    <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-full animate-pulse shadow-[0_0_8px_rgba(0,82,255,0.6)] flex-shrink-0" />
                </div>
                <div className="flex flex-col z-10 mt-1 sm:mt-2">
                    <span className="text-[11px] sm:text-[13px] font-semibold text-slate-800 leading-none tracking-tight">Base L2</span>
                    <span className="text-[8px] sm:text-[9px] text-[#0052FF] mt-1">Optimistic</span>
                </div>
            </div>

            {/* Volatility */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-[16px] sm:rounded-[20px] px-2.5 py-1.5 sm:p-3 border border-[#F0B90B]/10 flex flex-col justify-between group hover:border-[#F0B90B]/25 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(240,185,11,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-[#F0B90B]/5 rounded-full blur-2xl group-hover:bg-[#F0B90B]/10 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[8px] sm:text-[9px] text-slate-400 tracking-wide uppercase font-medium">Risk Level</span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#F0B90B]">{combo > 0 ? `${100 * combo}X` : '100X'}</span>
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2 z-10 mt-1 sm:mt-2">
                    <span className="text-[11px] sm:text-[13px] font-semibold text-slate-800 leading-none tracking-tight">Degen Mode</span>
                    <div className="w-full h-[3px] sm:h-[4px] bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-gradient-to-r from-[#F0B90B] to-[#F6465D] w-[85%] rounded-full relative">
                            <div className="absolute inset-0 bg-white/50 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* On-Chain Scores */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-[16px] sm:rounded-[20px] px-2.5 py-1.5 sm:p-3 border border-slate-200/60 flex flex-col justify-between group hover:border-[#0ECB81]/20 hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(14,203,129,0.08)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute -left-2 -bottom-2 w-16 h-16 bg-[#0ECB81]/5 rounded-full blur-2xl group-hover:bg-[#0ECB81]/10 transition-colors" />
                <div className="flex items-center justify-between w-full z-10">
                    <span className="text-[8px] sm:text-[9px] text-slate-400 tracking-wide uppercase font-medium">Security</span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#0ECB81] uppercase">OK</span>
                </div>
                <div className="flex flex-col z-10 mt-1 sm:mt-2">
                    <span className="text-[11px] sm:text-[13px] font-semibold text-slate-800 leading-none tracking-tight">On-Chain</span>
                    <span className="text-[8px] sm:text-[9px] text-slate-400 mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap">Verified</span>
                </div>
            </div>

            {/* Rewards */}
            <div className="flex-1 bg-gradient-to-br from-white/80 to-[#8B5CF6]/5 backdrop-blur-md rounded-[16px] sm:rounded-[20px] px-2.5 py-1.5 sm:p-3 border border-[#8B5CF6]/15 flex flex-col justify-between group hover:border-[#8B5CF6]/30 hover:to-[#8B5CF6]/10 hover:shadow-[0_8px_30px_rgba(139,92,246,0.1)] transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-20 h-20 bg-[#8B5CF6]/10 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[8px] sm:text-[9px] text-[#8B5CF6]/70 tracking-wide uppercase font-medium">Award Pool</span>
                    <div className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full animate-ping shadow-[0_0_8px_rgba(139,92,246,0.6)] flex-shrink-0" />
                </div>
                <div className="flex flex-col relative z-10 mt-1 sm:mt-2">
                    <span className="text-[11px] sm:text-[13px] font-semibold text-[#8B5CF6] leading-none tracking-tight">Rewards</span>
                    <span className="text-[8px] sm:text-[9px] text-[#8B5CF6]/70 mt-1 animate-[pulse_2s_infinite] w-full overflow-hidden text-ellipsis whitespace-nowrap">Coming Soon</span>
                </div>
            </div>
        </div>
    )
}
