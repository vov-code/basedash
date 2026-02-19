'use client'

import React from 'react'
import { useReadContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS, PlayerScore } from '@/app/contracts'
import { formatAddress, bigIntToNumber } from '@/app/lib/utils'

export default function Leaderboard() {
  const { data: leaderboard, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GAME_LEADERBOARD_ABI,
    functionName: 'getLeaderboard',
    args: [BigInt(10)],
    query: { enabled: CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="rounded-2xl border border-white/10 p-8 bg-white/[0.02] text-center">
        <p className="text-[#F0B90B] font-semibold mb-2">Contract not deployed</p>
        <p className="text-white/40 text-sm">Deploy smart contract to enable scores</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 p-8 bg-white/[0.02] flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-[#0052FF]/20 rounded-full animate-spin border-t-[#0052FF]" />
        <span className="ml-4 text-white/50 text-sm">Loading ranks...</span>
      </div>
    )
  }

  const scores = ((leaderboard as unknown as PlayerScore[]) || []).filter(s => s.player !== '0x0000000000000000000000000000000000000000')

  return (
    <div className="rounded-2xl border border-white/10 p-8 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Global Ranks</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 rounded-lg bg-[#0052FF]/10 hover:bg-[#0052FF]/20 text-[#6B7FFF] text-xs font-semibold transition-colors">
          Refresh
        </button>
      </div>

      {scores.length > 0 ? (
        <div className="space-y-2">
          {scores.map((entry, i) => (
            <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${
              i === 0 ? 'bg-[#FFD700]/10 border-[#FFD700]/30' :
              i === 1 ? 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30' :
              i === 2 ? 'bg-[#CD7F32]/10 border-[#CD7F32]/30' :
              'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                  i === 1 ? 'bg-[#C0C0C0]/20 text-[#C0C0C0]' :
                  i === 2 ? 'bg-[#CD7F32]/20 text-[#CD7F32]' :
                  'bg-white/10 text-white/60'
                }`}>#{i + 1}</span>
                <span className="font-mono text-xs text-white/70 bg-black/40 px-3 py-1.5 rounded-lg">{formatAddress(entry.player)}</span>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${i < 3 ? 'text-[#F0B90B]' : 'text-white/80'}`}>
                  {bigIntToNumber(entry.score).toLocaleString()} pts
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-white/80 font-semibold mb-2">No scores yet</p>
          <p className="text-white/40 text-sm">Be the first to claim #1</p>
        </div>
      )}
    </div>
  )
}
