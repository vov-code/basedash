'use client'

import { useEffect, useState } from 'react'

export default function OrientationLock() {
  const [isPortrait, setIsPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Проверяем соотношение сторон для более точного определения
      const width = window.innerWidth
      const height = window.innerHeight
      setIsPortrait(height > width || width < 600)
    }

    checkOrientation()
    window.addEventListener('orientationchange', checkOrientation)
    window.addEventListener('resize', checkOrientation)

    return () => {
      window.removeEventListener('orientationchange', checkOrientation)
      window.removeEventListener('resize', checkOrientation)
    }
  }, [])

  if (!isPortrait || dismissed) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-lg">
      <div className="mx-4 max-w-md w-full">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[var(--base-blue)]/90 to-[#0033AA]/90 p-8 text-center shadow-2xl">
          {/* Анимированные частицы на фоне */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
          
          <div className="relative z-10">
            {/* Иконка поворота */}
            <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-float">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>

            {/* Заголовок */}
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Rotate Your Device
            </h2>
            
            <p className="text-white/90 text-sm mb-6 font-medium leading-relaxed">
              For the best gaming experience, please turn your phone sideways to landscape mode.
            </p>

            {/* Визуальная подсказка */}
            <div className="mx-auto mb-6 w-32 h-20 border-2 border-white/40 rounded-lg flex items-center justify-center bg-white/10">
              <div className="w-16 h-10 border-2 border-white/60 rounded bg-white/20 flex items-center justify-center">
                <div className="w-8 h-8 bg-white rounded-md shadow-lg"></div>
              </div>
            </div>

            {/* Кнопка OK */}
            <button
              onClick={() => setDismissed(true)}
              className="w-full py-3.5 px-6 rounded-xl bg-white text-[var(--base-blue)] font-bold text-sm hover:bg-white/90 active:scale-95 transition-all duration-200 shadow-lg"
            >
              Got it
            </button>

            <p className="text-white/60 text-xs mt-4">
              You can continue in portrait mode, but landscape is recommended
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
