import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameMode } from '../components/Game/gameConfig'

export interface GameHistoryEntry {
    id: string
    score: number
    time: number
    dodged: number
    buys: number
    jumps: number
    combo: number
    date: number // timestamp
}

interface GameState {
    score: number
    combo: number
    mode: GameMode
    soundEnabled: boolean
    gameHistory: GameHistoryEntry[]
    setScore: (score: number) => void
    setCombo: (combo: number) => void
    setMode: (mode: GameMode | ((prev: GameMode) => GameMode)) => void
    setSoundEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
    addGameToHistory: (entry: GameHistoryEntry) => void
    clearHistory: () => void
}

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            score: 0,
            combo: 0,
            mode: 'menu',
            soundEnabled: true,
            gameHistory: [],
            setScore: (score) => set({ score }),
            setCombo: (combo) => set({ combo }),
            setMode: (mode) => set((state) => ({
                mode: typeof mode === 'function' ? mode(state.mode) : mode
            })),
            setSoundEnabled: (enabled) => set((state) => ({
                soundEnabled: typeof enabled === 'function' ? enabled(state.soundEnabled) : enabled
            })),
            addGameToHistory: (entry) => set((state) => ({
                gameHistory: [entry, ...state.gameHistory].slice(0, 5) // Keep last 5
            })),
            clearHistory: () => set({ gameHistory: [] }),
        }),
        {
            name: 'bd_store_v3',
            partialize: (state) => ({
                soundEnabled: state.soundEnabled,
                gameHistory: state.gameHistory,
            }),
        }
    )
)
