'use client'

import { useRef, useCallback } from 'react'

export interface AudioEngine {
    playTone: (freq: number, type: OscillatorType, dur: number, vol?: number, slideFreq?: number) => void
    sfxJump: () => void
    sfxDoubleJump: () => void
    sfxDash: () => void
    sfxCollect: () => void
    sfxPowerup: () => void
    sfxHit: () => void
    sfxSelect: () => void
    sfxCombo: (combo: number) => void
    sfxMilestone: () => void
    sfxLevelUp: () => void
    startBackgroundMusic: () => void
    stopBackgroundMusic: () => void
}

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const bgmOscRef = useRef<OscillatorNode | null>(null)
    const bgmGainRef = useRef<GainNode | null>(null)

    const initAudio = useCallback(() => {
        if (typeof window === 'undefined' || audioCtxRef.current) return
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) return
        audioCtxRef.current = new AudioContext()
        masterGainRef.current = audioCtxRef.current.createGain()
        masterGainRef.current.connect(audioCtxRef.current.destination)
        masterGainRef.current.gain.value = 0.5 // Master volume
    }, [])

    const playTone = useCallback((freq: number, type: OscillatorType, dur: number, vol = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return

        if (ctx.state === 'suspended') ctx.resume()

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        // Use sine for everything to keep it soft and bell-like
        osc.type = 'sine'

        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)
        }

        // Bell/Chime envelope (sharp attack, exponential decay)
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)

        osc.connect(gain)
        gain.connect(master)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + dur + 0.1)
    }, [soundEnabled, initAudio])

    // Soft kalimba-like plucks for actions
    const sfxJump = useCallback(() => playTone(392.00, 'sine', 0.15, 0.05, 440), [playTone]) // G4 to A4
    const sfxDoubleJump = useCallback(() => playTone(523.25, 'sine', 0.2, 0.05, 587.33), [playTone]) // C5 to D5
    const sfxDash = useCallback(() => playTone(261.63, 'sine', 0.3, 0.04, 196.00), [playTone]) // C4 to G3 (whoosh down)

    // Sparkly chime chord
    const sfxCollect = useCallback(() => {
        playTone(523.25, 'sine', 0.2, 0.04) // C5
        setTimeout(() => playTone(659.25, 'sine', 0.4, 0.04), 40) // E5
        setTimeout(() => playTone(783.99, 'sine', 0.6, 0.04), 80) // G5
    }, [playTone])

    // Heavenly harp glissando
    const sfxPowerup = useCallback(() => {
        [392.00, 440.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.4, 0.04), i * 50)
        })
    }, [playTone])

    // Soft, muffled thud (not a harsh electronic noise)
    const sfxHit = useCallback(() => {
        playTone(130.81, 'sine', 0.4, 0.1, 65.41)
        setTimeout(() => playTone(98.00, 'sine', 0.6, 0.1, 49.00), 40)
    }, [playTone])

    const sfxSelect = useCallback(() => playTone(523.25, 'sine', 0.2, 0.04, 659.25), [playTone])

    // Gentle musical combo counter (playing up a C Major Pentatonic scale)
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]
        const note = pentatonic[Math.min(combo, pentatonic.length - 1)]
        playTone(note, 'sine', 0.3, 0.04)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.4, 0.03), 80)
    }, [playTone])

    const sfxMilestone = useCallback(() => {
        playTone(392.00, 'sine', 0.4, 0.05) // G4
        setTimeout(() => playTone(523.25, 'sine', 0.4, 0.05), 150) // C5
        setTimeout(() => playTone(659.25, 'sine', 0.6, 0.05), 300) // E5
    }, [playTone])

    const sfxLevelUp = useCallback(() => {
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.6, 0.05), i * 120)
        })
    }, [playTone])

    // Background Music (Relaxing, Hypnotic Spa Melody)
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmOscRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'

        // Very soft constant presence
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 3)

        osc.connect(gain)
        gain.connect(master)

        // Use a very subtle chorus-like slow vibrato for relaxing vibe
        const vibrato = ctx.createOscillator()
        vibrato.type = 'sine'
        vibrato.frequency.value = 0.5 // 0.5Hz slow wobble
        const vibratoGain = ctx.createGain()
        vibratoGain.gain.value = 5 // +/- 5Hz pitch drift
        vibrato.connect(vibratoGain)
        vibratoGain.connect(osc.frequency)
        vibrato.start()

        osc.start()

        bgmOscRef.current = osc
        bgmGainRef.current = gain

        // C Major Pentatonic (C4, D4, E4, G4, A4) - relaxing intervals
        const notes = [
            261.63, 329.63, 392.00, 329.63,
            440.00, 392.00, 523.25, 392.00,
            261.63, 293.66, 329.63, 392.00
        ]
        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.1

        const schedulePattern = () => {
            if (!bgmOscRef.current || !audioCtxRef.current) return

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.0) {
                osc.frequency.setValueAtTime(notes[noteIdx], nextNoteTime)

                // Extremely soft attack and long decay (Harp/Pad like)
                gain.gain.setValueAtTime(0.005, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.015, nextNoteTime + 0.4) // Swell in
                gain.gain.exponentialRampToValueAtTime(0.005, nextNoteTime + 1.2) // long fade out

                noteIdx = (noteIdx + 1) % notes.length

                // Slow, hypnotic tempo (~50 BPM, 1.2 seconds per note)
                nextNoteTime += 1.2
            }
            setTimeout(schedulePattern, 800)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmOscRef.current && bgmGainRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmGainRef.current.gain.linearRampToValueAtTime(0, ct + 0.5)
            bgmOscRef.current.stop(ct + 0.5)
            bgmOscRef.current = null
            bgmGainRef.current = null
        }
    }, [])

    return {
        playTone,
        sfxJump,
        sfxDoubleJump,
        sfxDash,
        sfxCollect,
        sfxPowerup,
        sfxHit,
        sfxSelect,
        sfxCombo,
        sfxMilestone,
        sfxLevelUp,
        startBackgroundMusic,
        stopBackgroundMusic
    }
}
