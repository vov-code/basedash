'use client'

import { useRef, useCallback } from 'react'

export interface AudioEngine {
    playTone: (freq: number, type: OscillatorType, vol?: number, dur?: number, slideFreq?: number) => void
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
    updateAudioParams: (speedMultiplier: number, themeIndex: number) => void
    unlockAudio: () => void
}

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const bgmNodesRef = useRef<{ oscs: OscillatorNode[], gain: GainNode } | null>(null)
    const bgmIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

    const updateAudioParams = useCallback((speedMultiplier: number, themeIndex: number) => {
        bgmSpeedRef.current = speedMultiplier
        bgmThemeRef.current = themeIndex
    }, [])

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            audioCtxRef.current = new AudioContext()

            const compressor = audioCtxRef.current.createDynamicsCompressor()
            compressor.threshold.value = -14
            compressor.knee.value = 12
            compressor.ratio.value = 4
            compressor.attack.value = 0.005
            compressor.release.value = 0.15
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.22
            masterGainRef.current.connect(compressor)
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

    // === CORE TONE PLAYER (offline-rendered + cached) ===
    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || !toneCacheRef.current) return

        const cacheKey = `${freq}-${type}-${dur}-${slideFreq || 'x'}`

        const playBuffer = (buffer: AudioBuffer) => {
            const source = ctx.createBufferSource()
            source.buffer = buffer
            const gain = ctx.createGain()
            gain.gain.value = vol
            source.connect(gain)
            gain.connect(master)
            source.start(ctx.currentTime)
        }

        if (toneCacheRef.current.has(cacheKey)) {
            playBuffer(toneCacheRef.current.get(cacheKey)!)
            return
        }

        const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
        const renderLen = dur + 0.2
        const offlineCtx = new OfflineContext(1, ctx.sampleRate * renderLen, ctx.sampleRate)

        const osc = offlineCtx.createOscillator()
        const gain = offlineCtx.createGain()
        osc.type = type

        osc.frequency.setValueAtTime(freq, 0)
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, dur)
        }

        // Very smooth envelope — slow attack, gradual decay, no clicks
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(0.9, Math.min(0.04, dur * 0.3))
        gain.gain.setValueAtTime(0.7, dur * 0.5)
        gain.gain.exponentialRampToValueAtTime(0.001, dur + 0.2)

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + 0.2)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(() => { })

    }, [soundEnabled, initAudio])

    // JUMP — Soft, rounded pop
    const sfxJump = useCallback(() => {
        playTone(392, 'sine', 0.05, 0.15, 294)      // G4→D4 gentle
    }, [playTone])

    // DOUBLE JUMP — Two soft chimes
    const sfxDoubleJump = useCallback(() => {
        playTone(440, 'sine', 0.05, 0.15, 349)       // A4→F4
        setTimeout(() => playTone(659, 'sine', 0.03, 0.2), 80)
    }, [playTone])

    // DASH — Soft wind
    const sfxDash = useCallback(() => {
        playTone(196, 'triangle', 0.03, 0.25, 98)    // G3→G2
    }, [playTone])

    // COLLECT — Warm bell chime
    const sfxCollect = useCallback(() => {
        playTone(784, 'sine', 0.04, 0.3)              // G5 — long, warm
        setTimeout(() => playTone(1046, 'sine', 0.025, 0.4), 80) // C6 shimmer
    }, [playTone])

    // POWERUP — Gentle ascending arpeggio
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 988, 1174]
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.03 - i * 0.003, 0.25 + i * 0.05), i * 60)
        })
    }, [playTone])

    // DEATH — Very soft descending tone
    const sfxHit = useCallback(() => {
        playTone(294, 'sine', 0.06, 0.5, 131)         // D4→C3 slow
        setTimeout(() => playTone(196, 'triangle', 0.03, 0.4, 65), 150)
    }, [playTone])

    // SELECT — Soft tap
    const sfxSelect = useCallback(() => {
        playTone(659, 'sine', 0.03, 0.12, 587)
    }, [playTone])

    // COMBO — Ascending pentatonic, soft
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [392, 440, 523, 587, 659, 784, 880, 988, 1046, 1174, 1318]
        const idx = Math.min(combo, pentatonic.length - 1)
        const note = pentatonic[idx]
        playTone(note, 'sine', 0.03, 0.25)
        setTimeout(() => playTone(note * 1.498, 'sine', 0.015, 0.3), 70)
    }, [playTone])

    // MILESTONE — Gentle ascending chord
    const sfxMilestone = useCallback(() => {
        const seq = [
            { f: 523, d: 100 },
            { f: 659, d: 100 },
            { f: 784, d: 100 },
            { f: 988, d: 120 },
            { f: 1046, d: 400 },
        ]
        let t = 0
        seq.forEach(({ f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.03, d / 1000 + 0.2), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Soft sparkling cascade
    const sfxLevelUp = useCallback(() => {
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.025, 0.2 + i * 0.04), i * 50)
        })
    }, [playTone])

    // =====================================================================
    // BGM — DREAMY LO-FI AMBIENT WITH EVOLVING LAYERS
    // =====================================================================
    //
    // Uses longer, legato notes with smooth crossfades between pitches.
    // The 3-oscillator setup (melody/pad/bass) creates a rich, warm bed:
    //
    // ── Melody (sine): plays the main arpeggio notes with soft attack
    // ── Pad (triangle, detuned): sustained harmony, creates width
    // ── Bass (sine): root notes, anchors the tonality
    //
    // World progression adds layers:
    //   0–1: Melody only, gentle and sparse
    //   2–3: Add soft pad harmonies
    //   4–5: Add bass pedal, richer voicings
    //   6+:  Full arrangement with counter-melodies
    //
    // Tempo smoothly accelerates with game speed (never feels rushed).

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return

        // Ensure AudioContext exists
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current

        // Critical Fix: If nodes already exist, don't create overlapping loops 
        if (!ctx || !master || bgmNodesRef.current) return

        // Wait to actually start generating sound until the context is running
        // iOS will keep it 'suspended' until an interaction happens
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { })
        }

        // 3 oscillators: melody, pad, bass
        const oscMelody = ctx.createOscillator()
        const oscPad = ctx.createOscillator()
        const oscBass = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        // Warm sine for melody, detuned triangle for pad width
        oscMelody.type = 'sine'
        oscPad.type = 'triangle'
        oscPad.detune.value = 5   // Subtle chorus effect
        oscBass.type = 'sine'

        // Warm low-pass — lo-fi smooth tone
        filter.type = 'lowpass'
        filter.frequency.value = 800
        filter.Q.value = 0.3

        // Gentle fade-in over 4 seconds
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 4)

        oscMelody.connect(filter)
        oscPad.connect(filter)
        oscBass.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        oscMelody.start()
        oscPad.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscMelody, oscPad, oscBass], gain }

        // === SIMPLE, RELAXING MELODY — 8-note pentatonic waves ===
        const keyPatterns: number[][] = [
            // World 0–1: C pentatonic — gentle wave
            [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00],
            // World 2–3: D pentatonic — warmer
            [293.66, 349.23, 440.00, 523.25, 440.00, 349.23, 293.66, 220.00],
            // World 4–5: E minor pentatonic — emotional
            [329.63, 392.00, 493.88, 659.25, 493.88, 392.00, 329.63, 246.94],
            // World 6–7: F lydian — ethereal
            [349.23, 440.00, 523.25, 698.46, 523.25, 440.00, 349.23, 261.63],
            // World 8+: G pentatonic — transcendent
            [392.00, 493.88, 587.33, 783.99, 587.33, 493.88, 392.00, 293.66],
        ]

        // Bass — single sustained root per world
        const bassRoots: number[] = [130.81, 146.83, 164.81, 174.61, 196.00]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.8
        const BASE_INTERVAL = 0.48 // Slow meditative tempo

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const patternIdx = Math.min(Math.floor(currentTheme / 2), keyPatterns.length - 1)
            const pattern = keyPatterns[patternIdx]
            const bassRoot = bassRoots[patternIdx]

            // Tempo gently follows speed — never rushes
            const tempoMult = 0.95 + currentSpeed * 0.05
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.0) {
                const note = pattern[noteIdx]
                const isDownbeat = noteIdx % 4 === 0

                // Simple layering by world
                let melodyVol = 0.025
                const padVol = currentTheme >= 2 ? 0.012 : 0.004
                const bassVol = currentTheme >= 3 ? 0.015 : 0.004
                const padFreq = note * 0.5
                const bassFreq = bassRoot

                // World 5+: slightly richer
                if (currentTheme >= 5) melodyVol = 0.028

                // Smooth legato glide
                const glideTime = NOTE_INTERVAL * 0.25  // 25% portamento — dreamier
                oscMelody.frequency.setTargetAtTime(note, nextNoteTime, glideTime)
                oscPad.frequency.setTargetAtTime(padFreq, nextNoteTime, glideTime)
                oscBass.frequency.setTargetAtTime(bassFreq, nextNoteTime, glideTime * 3)

                // Very gentle breathing envelope — almost constant volume
                const accentVol = isDownbeat ? 1.08 : 1.0
                const totalVol = melodyVol * accentVol

                gain.gain.setTargetAtTime(totalVol, nextNoteTime, 0.1)      // Slow attack
                gain.gain.setTargetAtTime(
                    totalVol * 0.65,                                         // Gentle dip
                    nextNoteTime + NOTE_INTERVAL * 0.7,
                    0.12                                                     // Very slow decay
                )

                // Warm filter — never harsh
                const cutoff = 700 + currentTheme * 60 + (isDownbeat ? 100 : 0)
                filter.frequency.setTargetAtTime(Math.min(cutoff, 1400), nextNoteTime, 0.1)

                noteIdx = (noteIdx + 1) % pattern.length
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, NOTE_INTERVAL * 1000 * 0.6)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmNodesRef.current.gain.gain.cancelScheduledValues(ct)
            bgmNodesRef.current.gain.gain.setValueAtTime(bgmNodesRef.current.gain.gain.value, ct)
            bgmNodesRef.current.gain.gain.linearRampToValueAtTime(0, ct + 0.4) // Slower fade-out
            for (const osc of bgmNodesRef.current.oscs) {
                try { osc.stop(ct + 0.5) } catch { /* already stopped */ }
            }
            bgmNodesRef.current = null
        }
        if (bgmIntervalRef.current) {
            clearTimeout(bgmIntervalRef.current)
            bgmIntervalRef.current = null
        }
    }, [])

    return {
        playTone,
        updateAudioParams,
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
        stopBackgroundMusic,
        unlockAudio: initAudio
    }
}
