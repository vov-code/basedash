import { create } from 'zustand'

export type GameMode = 'menu' | 'playing' | 'paused' | 'gameover'

interface GameState {
    score: number;
    best: number;
    mode: GameMode;
    soundEnabled: boolean;
    scoreSubmitStatus: 'idle' | 'submitting' | 'success' | 'error';
    setScore: (score: number) => void;
    setBest: (best: number) => void;
    setMode: (mode: GameMode) => void;
    setSoundEnabled: (enabled: boolean) => void;
    setScoreSubmitStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
    resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    score: 0,
    best: 0,
    mode: 'menu',
    soundEnabled: true, // We keep soundEnabled in store as requested by "replace heavy prop drilling", but we won't do the "Sound toggle refinement" (point 3.2.3) which implies moving the physical button out.
    scoreSubmitStatus: 'idle',

    setScore: (score) => set({ score }),
    // When setting best, also sync with localStorage for persistence
    setBest: (best) => {
        set({ best })
        try {
            localStorage.setItem('basedash_highscore_v2', best.toString())
        } catch (e) {
            console.error('Failed to save best score:', e)
        }
    },
    setMode: (mode) => set({ mode }),
    setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    setScoreSubmitStatus: (status) => set({ scoreSubmitStatus: status }),

    resetGame: () => set({ score: 0, mode: 'playing', scoreSubmitStatus: 'idle' }),
}))
