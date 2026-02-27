import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameMode } from '../components/Game/gameConfig'

interface GameState {
    score: number
    mode: GameMode
    soundEnabled: boolean
    setScore: (score: number) => void
    setMode: (mode: GameMode | ((prev: GameMode) => GameMode)) => void
    setSoundEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
}

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            score: 0,
            mode: 'menu',
            soundEnabled: true,
            setScore: (score) => set({ score }),
            setMode: (mode) => set((state) => ({
                mode: typeof mode === 'function' ? mode(state.mode) : mode
            })),
            setSoundEnabled: (enabled) => set((state) => ({
                soundEnabled: typeof enabled === 'function' ? enabled(state.soundEnabled) : enabled
            })),
        }),
        {
            name: 'bd_store_v2', // unique name
            partialize: (state) => ({ soundEnabled: state.soundEnabled }), // Only persist sound settings
        }
    )
)
