import React from 'react'
import Image from 'next/image'

interface HeaderProps {
    isConnected: boolean;
    address: string | null;
    handleConnect: () => void;
    disconnectWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, address, handleConnect, disconnectWallet }) => {
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <header className="w-full bg-white border-b-2 border-slate-900 relative z-[40] flex-shrink-0 h-[40px] sm:h-[48px]">
            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 h-full flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 overflow-hidden border-2 border-slate-900 p-0.5 bg-white shadow-[2px_2px_0_#0F172A] hover:bg-slate-50 transition-colors">
                        <Image src="/base-logo.png" alt="base dash logo" fill className="object-cover" priority />
                    </div>
                    <div className="block whitespace-nowrap flex items-center">
                        <span className="font-black text-[15px] sm:text-[17px] tracking-tight leading-none text-slate-900 uppercase">
                            base dash
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {mounted ? (
                        !isConnected ? (
                            <button
                                onClick={handleConnect}
                                className="h-6 sm:h-7 px-3 flex-shrink-0 flex items-center justify-center bg-[#0052FF] text-white font-black text-[10px] tracking-widest uppercase border border-slate-900 shadow-[2px_2px_0_#0F172A] transition-transform active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                            >
                                <span className="hidden sm:inline-block mr-1">connect</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 bg-white border border-slate-900 shadow-[2px_2px_0_#0F172A]">
                                    <span className="w-1.5 h-1.5 bg-[#0ECB81] border border-slate-900" />
                                    <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-widest text-slate-900">
                                        {address?.slice(0, 4)}..{address?.slice(-4)}
                                    </span>
                                </div>
                                <button onClick={() => disconnectWallet()} className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-slate-100 active:bg-slate-200 rounded-none transition-colors" title="Disconnect">
                                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 opacity-0" />
                    )}
                </div>
            </div>
        </header>
    )
}
