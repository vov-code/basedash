import React from 'react'
import Image from 'next/image'

interface HeaderProps {
    isConnected: boolean;
    address: string | null;
    handleConnect: () => void;
    disconnectWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, address, handleConnect, disconnectWallet }) => {
    return (
        <header className="w-full bg-white/50 backdrop-blur-md relative z-[40] flex-shrink-0 h-[46px] sm:h-[56px]">
            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 h-full flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 overflow-hidden border-2 border-[#0052FF]/80 rounded p-0.5 bg-white shadow-[0_0_12px_rgba(0,82,255,0.4)] animate-icon-float">
                        <Image src="/base-logo.png" alt="base dash logo" fill className="object-cover" priority />
                    </div>
                    <div className="block whitespace-nowrap flex items-center">
                        <span className="font-black text-[15px] sm:text-[17px] tracking-tight leading-none text-slate-800">
                            base dash
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isConnected ? (
                        <button
                            onClick={handleConnect}
                            className="h-7 sm:h-8 w-7 sm:w-8 aspect-square min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#0052FF] to-[#0040CC] text-white rounded-md shadow-[0_4px_14px_rgba(0,82,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,82,255,0.45)] transition-all transform hover:-translate-y-0.5 active:scale-95"
                        >
                            <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.75 sm:py-1 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg shadow-sm">
                                <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />
                                <span className="font-mono text-[8px] sm:text-[9px] font-bold text-[#15803d]">
                                    {address?.slice(0, 4)}..{address?.slice(-4)}
                                </span>
                            </div>
                            <button onClick={() => disconnectWallet()} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="Disconnect">
                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
