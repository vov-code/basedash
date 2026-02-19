'use client'

import React from 'react'

interface ScoreProps {
  score: number
  highScore: number
  className?: string
}

export default function Score({ score, highScore, className = '' }: ScoreProps) {
  return (
    <div className={`flex justify-between items-center py-3 ${className}`}>
      <div className="bg-blue-900/30 px-5 py-2.5 rounded-lg">
        <p className="text-xs text-gray-400">current</p>
        <p className="text-2xl font-medium text-white/80">{score.toLocaleString()}</p>
      </div>

      <div className="bg-yellow-900/30 px-5 py-2.5 rounded-lg">
        <p className="text-xs text-gray-400">best</p>
        <p className="text-2xl font-medium text-yellow-400/80">{highScore.toLocaleString()}</p>
      </div>
    </div>
  )
}
