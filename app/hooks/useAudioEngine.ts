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
            compressor.threshold.value = -18
            compressor.knee.value = 15
            compressor.ratio.value = 6
            compressor.attack.value = 0.003
            compressor.release.value = 0.12
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.28
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

        // Evict oldest entries if cache grows too large
        if (toneCacheRef.current.size > 100) {
            const keys = Array.from(toneCacheRef.current.keys())
            for (let i = 0; i < 20; i++) toneCacheRef.current.delete(keys[i])
        }

        const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
        const tailLen = 0.15
        const renderLen = dur + tailLen
        const offlineCtx = new OfflineContext(1, ctx.sampleRate * renderLen, ctx.sampleRate)

        const osc = offlineCtx.createOscillator()
        const gain = offlineCtx.createGain()
        osc.type = type

        osc.frequency.setValueAtTime(freq, 0)
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, dur)
        }

        // Smooth envelope — fast but soft attack, natural decay
        const attackTime = Math.min(0.025, dur * 0.2)
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(0.85, attackTime)
        gain.gain.setValueAtTime(0.65, dur * 0.4)
        gain.gain.exponentialRampToValueAtTime(0.001, dur + tailLen)

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + tailLen)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(() => { })

    }, [soundEnabled, initAudio])

    // =====================================================================
    // SFX — ENERGETIC, CRISP, MUSICAL
    // =====================================================================

    // JUMP — Bright pluck, quick upward
    const sfxJump = useCallback(() => {
        playTone(523, 'sine', 0.07, 0.1, 784)        // C5→G5 snap up
    }, [playTone])

    // DOUBLE JUMP — Sparkle pair
    const sfxDoubleJump = useCallback(() => {
        playTone(659, 'sine', 0.06, 0.08, 988)       // E5→B5
        setTimeout(() => playTone(1046, 'sine', 0.04, 0.12), 60)  // C6 shimmer
    }, [playTone])

    // DASH — Whoosh with body
    const sfxDash = useCallback(() => {
        playTone(262, 'triangle', 0.05, 0.15, 131)   // C4→C3 whoosh
    }, [playTone])

    // COLLECT — Bright reward chime (major third)
    const sfxCollect = useCallback(() => {
        playTone(880, 'sine', 0.06, 0.15)             // A5
        setTimeout(() => playTone(1108, 'sine', 0.04, 0.2), 50)   // C#6 — major 3rd
    }, [playTone])

    // POWERUP — Fast ascending major arpeggio
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 1046, 1318]     // C-E-G-C-E
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.04 - i * 0.005, 0.15 + i * 0.03), i * 45)
        })
    }, [playTone])

    // DEATH — Dramatic descending minor
    const sfxHit = useCallback(() => {
        playTone(392, 'sine', 0.08, 0.3, 196)         // G4→G3
        setTimeout(() => playTone(262, 'triangle', 0.04, 0.4, 98), 100) // C4→G2
    }, [playTone])

    // SELECT — Quick tap
    const sfxSelect = useCallback(() => {
        playTone(784, 'sine', 0.04, 0.08, 659)        // G5→E5
    }, [playTone])

    // COMBO — Rising pentatonic with harmonics
    const sfxCombo = useCallback((combo: number) => {
        const scale = [523, 587, 659, 784, 880, 1046, 1174, 1318, 1568, 1760, 2093]
        const idx = Math.min(combo, scale.length - 1)
        const note = scale[idx]
        playTone(note, 'sine', 0.05, 0.15)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.025, 0.2), 50)  // Perfect 5th
    }, [playTone])

    // MILESTONE — Triumphant fanfare
    const sfxMilestone = useCallback(() => {
        const seq = [
            { f: 523, d: 60 },   // C5
            { f: 659, d: 60 },   // E5
            { f: 784, d: 60 },   // G5
            { f: 1046, d: 80 },  // C6
            { f: 1318, d: 250 }, // E6 sustain
        ]
        let t = 0
        seq.forEach(({ f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.04, d / 1000 + 0.1), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Bright cascading sparkle
    const sfxLevelUp = useCallback(() => {
        [523, 784, 1046, 1318, 1568, 2093].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.035, 0.12 + i * 0.03), i * 40)
        })
    }, [playTone])

    // =====================================================================
    // BGM — ENERGETIC SYNTH-POP WITH EVOLVING WORLD LAYERS
    // =====================================================================
    //
    // Architecture:
    //   Melody (sine)    — main hook, catchy pentatonic patterns
    //   Pad (triangle)   — harmonic bed, detuned for width
    //   Bass (sine)      — driving pulse, rhythmic root movement
    //
    // World progression:
    //   0-1: Light melody, sparse — learning phase
    //   2-3: Add synth pad harmonies, fuller sound
    //   4-5: Driving bass enters, energy builds
    //   6+:  Full arrangement, faster arpeggios, richer harmonics
    //
    // Tempo tracks game speed — feels alive and responsive

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { })
        }

        // 3 oscillators
        const oscMelody = ctx.createOscillator()
        const oscPad = ctx.createOscillator()
        const oscBass = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscMelody.type = 'sine'
        oscPad.type = 'triangle'
        oscPad.detune.value = 7      // Wider chorus
        oscBass.type = 'sine'

        filter.type = 'lowpass'
        filter.frequency.value = 1200
        filter.Q.value = 0.5

        // Smooth fade-in
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 3)

        oscMelody.connect(filter)
        oscPad.connect(filter)
        oscBass.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        oscMelody.start()
        oscPad.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscMelody, oscPad, oscBass], gain }

        // === CATCHY MELODIC PATTERNS — 16 notes per cycle ===
        const worldPatterns: number[][] = [
            // World 0-1: C major pentatonic — bright, bouncy
            [523, 587, 659, 784, 659, 587, 523, 784,
                659, 523, 587, 784, 523, 659, 784, 523],
            // World 2-3: D mixolydian — groovy, uplifting
            [587, 659, 740, 880, 784, 659, 587, 880,
                740, 587, 659, 880, 587, 740, 880, 659],
            // World 4-5: E minor pentatonic — intense, driving
            [659, 784, 880, 988, 880, 784, 659, 988,
                784, 659, 784, 988, 659, 880, 988, 784],
            // World 6-7: F# major — euphoric, high energy
            [740, 880, 988, 1108, 988, 880, 740, 1108,
                880, 740, 880, 1108, 740, 988, 1108, 880],
            // World 8+: Ab major — triumphant, transcendent
            [830, 988, 1108, 1244, 1108, 988, 830, 1244,
                988, 830, 988, 1244, 830, 1108, 1244, 988],
        ]

        // Bass patterns — rhythmic, driving
        const bassPatterns: number[][] = [
            [131, 131, 165, 165, 147, 147, 131, 131],   // C-C-E-E-D-D-C-C
            [147, 147, 175, 175, 165, 165, 147, 147],   // D-D-F-F-E-E-D-D
            [165, 165, 196, 196, 175, 175, 165, 165],   // E-E-G-G-F-F-E-E
            [185, 185, 220, 220, 196, 196, 185, 185],   // F#-A-G-F#
            [208, 208, 247, 247, 220, 220, 208, 208],   // Ab-B-A-Ab
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.5
        const BASE_INTERVAL = 0.32  // Faster, more energetic tempo

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const patIdx = Math.min(Math.floor(currentTheme / 2), worldPatterns.length - 1)
            const melodyPattern = worldPatterns[patIdx]
            const bassPattern = bassPatterns[patIdx]

            // Tempo accelerates with speed — feels alive
            const tempoMult = 0.85 + currentSpeed * 0.15
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.2) {
                // If we fell behind (tab was backgrounded), skip ahead — keep noteIdx, reset time
                if (nextNoteTime < audioCtxRef.current.currentTime - 0.5) {
                    nextNoteTime = audioCtxRef.current.currentTime + 0.05
                    // Smooth re-entry after pause
                    gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    gain.gain.setTargetAtTime(0.03, audioCtxRef.current.currentTime + 0.05, 0.2)
                    continue
                }
                const melodyNote = melodyPattern[noteIdx % melodyPattern.length]
                const bassNote = bassPattern[Math.floor(noteIdx / 2) % bassPattern.length]
                const isDownbeat = noteIdx % 4 === 0
                const isHalfBeat = noteIdx % 2 === 0

                // Progressive volume layering by world
                let melodyVol = 0.03
                let padVol = 0.008
                let bassVol = 0.006

                if (currentTheme >= 2) { padVol = 0.018; melodyVol = 0.035 }
                if (currentTheme >= 4) { bassVol = 0.022; melodyVol = 0.038 }
                if (currentTheme >= 6) { melodyVol = 0.042; padVol = 0.024; bassVol = 0.028 }

                // Pad plays 5th below melody for richness
                const padFreq = melodyNote * 0.667  // Perfect 5th below

                // Smooth portamento — shorter glide = more energetic
                const glideTime = NOTE_INTERVAL * 0.15
                oscMelody.frequency.setTargetAtTime(melodyNote, nextNoteTime, glideTime)
                oscPad.frequency.setTargetAtTime(padFreq, nextNoteTime, glideTime * 1.5)
                oscBass.frequency.setTargetAtTime(bassNote, nextNoteTime, glideTime * 0.5)

                // Rhythmic accent — gives bounce and energy
                const accent = isDownbeat ? 1.15 : (isHalfBeat ? 1.0 : 0.85)
                const totalVol = (melodyVol + padVol + bassVol) * accent

                // Quick attack, punchy release — energetic feel
                gain.gain.setTargetAtTime(totalVol, nextNoteTime, 0.04)
                gain.gain.setTargetAtTime(
                    totalVol * 0.55,
                    nextNoteTime + NOTE_INTERVAL * 0.6,
                    0.06
                )

                // Filter opens with worlds — brighter = more energy
                const cutoff = 900 + currentTheme * 100 + (isDownbeat ? 200 : 0)
                filter.frequency.setTargetAtTime(Math.min(cutoff, 2200), nextNoteTime, 0.05)

                noteIdx = (noteIdx + 1) % melodyPattern.length
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, NOTE_INTERVAL * 1000 * 0.5)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmNodesRef.current.gain.gain.cancelScheduledValues(ct)
            bgmNodesRef.current.gain.gain.setValueAtTime(bgmNodesRef.current.gain.gain.value, ct)
            bgmNodesRef.current.gain.gain.linearRampToValueAtTime(0, ct + 0.5)
            for (const osc of bgmNodesRef.current.oscs) {
                try { osc.stop(ct + 0.6) } catch { /* already stopped */ }
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
