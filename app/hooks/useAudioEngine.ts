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
    updateAudioParams: (speedMultiplier: number, themeIndex: number) => void
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
            compressor.threshold.value = -12
            compressor.knee.value = 10
            compressor.ratio.value = 5
            compressor.attack.value = 0.003
            compressor.release.value = 0.12
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.35
            masterGainRef.current.connect(compressor)
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

    // === CORE TONE PLAYER (offline-rendered + cached) ===
    const playTone = useCallback((freq: number, type: OscillatorType = 'square', vol = 0.1, dur = 0.1, slideFreq?: number) => {
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
        const renderLen = dur + 0.15
        const offlineCtx = new OfflineContext(1, ctx.sampleRate * renderLen, ctx.sampleRate)

        const osc = offlineCtx.createOscillator()
        const gain = offlineCtx.createGain()
        osc.type = type

        osc.frequency.setValueAtTime(freq, 0)
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, dur)
        }

        // Smooth envelope — fast attack, natural decay
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1.0, 0.005)
        gain.gain.exponentialRampToValueAtTime(0.001, dur)

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + 0.1)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(() => { })

    }, [soundEnabled, initAudio])

    // =====================================================================
    // SFX — CLEAN, HARMONIOUS, CRYSTAL-CLEAR SOUNDS
    // =====================================================================

    // JUMP — Soft crystalline "pop" with harmonic overtone
    const sfxJump = useCallback(() => {
        playTone(523, 'sine', 0.06, 0.1, 349)    // C5→F4 smooth drop
        playTone(1046, 'sine', 0.015, 0.12)       // C6 crystal shimmer
    }, [playTone])

    // DOUBLE JUMP — Rising two-note chime
    const sfxDoubleJump = useCallback(() => {
        playTone(659, 'sine', 0.06, 0.1, 440)     // E5→A4
        setTimeout(() => playTone(880, 'sine', 0.04, 0.12, 587), 50) // A5→D5
    }, [playTone])

    // DASH — Smooth wind whoosh
    const sfxDash = useCallback(() => {
        playTone(196, 'triangle', 0.05, 0.2, 55)  // G3→low sweep
    }, [playTone])

    // COLLECT — Distinctive two-note bell chime (pure intervals)
    const sfxCollect = useCallback(() => {
        playTone(1318, 'sine', 0.05, 0.18)         // E6
        setTimeout(() => playTone(1760, 'sine', 0.04, 0.3), 70) // A6 — perfect 4th, long tail
    }, [playTone])

    // POWERUP — Ascending major 7th arpeggio with sparkle
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 988, 1318] // C-E-G-B-E (CMaj7 + octave)
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.05, 0.18 + i * 0.04), i * 40)
        })
    }, [playTone])

    // DEATH — Gentle descending minor sweep
    const sfxHit = useCallback(() => {
        playTone(392, 'triangle', 0.1, 0.5, 130)   // G4→C3 long drop
        setTimeout(() => playTone(261, 'sine', 0.06, 0.35, 65), 100) // C4→C2
    }, [playTone])

    // SELECT — Quick crystal tap
    const sfxSelect = useCallback(() => {
        playTone(1046, 'sine', 0.04, 0.08, 880)
    }, [playTone])

    // COMBO — Ascending pentatonic scale with harmonic fifth
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [392, 440, 523, 587, 659, 784, 880, 988, 1046, 1174, 1318]
        const idx = Math.min(combo, pentatonic.length - 1)
        const note = pentatonic[idx]
        playTone(note, 'sine', 0.05, 0.15)
        setTimeout(() => playTone(note * 1.498, 'sine', 0.025, 0.2), 45) // Perfect 5th harmonic
    }, [playTone])

    // MILESTONE — Triumphant ascending chord with suspended 4th resolution
    const sfxMilestone = useCallback(() => {
        const sequence = [
            { f: 523, d: 70 },  // C5
            { f: 659, d: 70 },  // E5
            { f: 784, d: 70 },  // G5
            { f: 988, d: 90 },  // B5
            { f: 1046, d: 250 }, // C6 — resolve
        ]
        let t = 0
        sequence.forEach(({ f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.06, d / 1000 + 0.12), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Sparkling cascade with octave leap
    const sfxLevelUp = useCallback(() => {
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.04, 0.14 + i * 0.02), i * 30)
        })
    }, [playTone])

    // =====================================================================
    // BGM — EVOLVING AMBIENT LO-FI WITH DYNAMIC KEY CHANGES
    // =====================================================================
    //
    // 4-chord progression that changes KEY based on the current world theme.
    // Tempo increases with game speed. Additional harmonic layers unlock
    // as the player progresses through worlds, creating a sense of musical
    // evolution that pulls the player deeper into the experience.
    //
    // World 0-1: Simple pentatonic arpeggios (calm, inviting)
    // World 2-3: Add 7th chords + octave doublings (richer texture)
    // World 4-5: Add bass pedal + 5th harmonics (driving energy)
    // World 6+:  Full arrangement with counter-melody (epic, immersive)

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        // Main melody oscillator + harmony oscillator + bass
        const oscMelody = ctx.createOscillator()
        const oscHarmony = ctx.createOscillator()
        const oscBass = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscMelody.type = 'sine'
        oscHarmony.type = 'triangle'
        oscHarmony.detune.value = 6  // Subtle chorus
        oscBass.type = 'sine'

        filter.type = 'lowpass'
        filter.frequency.value = 1200
        filter.Q.value = 0.6

        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5)

        oscMelody.connect(filter)
        oscHarmony.connect(filter)
        oscBass.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        oscMelody.start()
        oscHarmony.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscMelody, oscHarmony, oscBass], gain }

        // === KEY PROGRESSIONS PER WORLD ===
        // Each world gets a unique key/mood to make progression feel fresh
        const keyPatterns: number[][] = [
            // World 0–1: C major pentatonic (warm, welcoming)
            // CMaj7 → Am7 → FMaj7 → G
            [261.63, 329.63, 392.00, 493.88, 220.00, 261.63, 329.63, 440.00,
                174.61, 220.00, 261.63, 329.63, 196.00, 246.94, 293.66, 392.00],
            // World 2–3: D dorian (slightly mysterious, cool)
            // Dm7 → Em7 → CMaj7 → Am7
            [293.66, 349.23, 440.00, 523.25, 329.63, 392.00, 493.88, 587.33,
                261.63, 329.63, 392.00, 493.88, 220.00, 261.63, 329.63, 440.00],
            // World 4–5: E minor (darker, intense)
            // Em → CMaj → G → D
            [329.63, 392.00, 493.88, 587.33, 261.63, 329.63, 392.00, 523.25,
                196.00, 246.94, 293.66, 392.00, 293.66, 349.23, 440.00, 587.33],
            // World 6–7: Ab major (ethereal, epic)
            // AbMaj7 → Fm → DbMaj7 → Eb
            [415.30, 523.25, 622.25, 783.99, 349.23, 415.30, 523.25, 698.46,
                277.18, 349.23, 415.30, 523.25, 311.13, 392.00, 466.16, 622.25],
            // World 8+: F# minor (triumphant, climactic)
            // F#m → DMaj → A → E
            [369.99, 440.00, 523.25, 659.26, 293.66, 369.99, 440.00, 587.33,
                220.00, 277.18, 329.63, 440.00, 329.63, 415.30, 493.88, 659.26],
        ]

        // Bass note for each chord (root notes, one octave below)
        const bassPatterns: number[][] = [
            [130.81, 130.81, 130.81, 130.81, 110.00, 110.00, 110.00, 110.00,
                87.31, 87.31, 87.31, 87.31, 98.00, 98.00, 98.00, 98.00],
            [146.83, 146.83, 146.83, 146.83, 164.81, 164.81, 164.81, 164.81,
                130.81, 130.81, 130.81, 130.81, 110.00, 110.00, 110.00, 110.00],
            [164.81, 164.81, 164.81, 164.81, 130.81, 130.81, 130.81, 130.81,
                98.00, 98.00, 98.00, 98.00, 146.83, 146.83, 146.83, 146.83],
            [207.65, 207.65, 207.65, 207.65, 174.61, 174.61, 174.61, 174.61,
                138.59, 138.59, 138.59, 138.59, 155.56, 155.56, 155.56, 155.56],
            [184.99, 184.99, 184.99, 184.99, 146.83, 146.83, 146.83, 146.83,
                110.00, 110.00, 110.00, 110.00, 164.81, 164.81, 164.81, 164.81],
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.5
        let patternCycle = 0
        const BASE_INTERVAL = 0.26

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            // Select key progression based on world (cycles through available patterns)
            const patternIdx = Math.min(Math.floor(currentTheme / 2), keyPatterns.length - 1)
            const pattern = keyPatterns[patternIdx]
            const bassLine = bassPatterns[patternIdx]

            // Dynamic tempo — scales smoothly with speed, feels natural
            const tempoMult = 0.85 + currentSpeed * 0.15 // ranges from ~1.0 to ~1.3
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 0.8) {
                const note = pattern[noteIdx]
                const bass = bassLine[noteIdx]

                let melodyFreq = note
                let harmonyFreq = note
                let bassFreq = bass
                let melodyVol = 0.04
                let harmonyVol = 0.025
                let bassVol = 0

                // World 0-1: Simple melody only
                if (currentTheme >= 1 && noteIdx % 2 === 0) {
                    harmonyFreq = note * 2 // Octave sparkle on even beats
                    harmonyVol = 0.02
                }

                // World 2-3: Add bass pedal tones on downbeats
                if (currentTheme >= 2) {
                    bassVol = noteIdx % 4 === 0 ? 0.03 : 0.015
                    bassFreq = bass
                }

                // World 3+: Fifth harmony on offbeats
                if (currentTheme >= 3 && noteIdx % 2 !== 0) {
                    harmonyFreq = note * 1.498 // Perfect 5th
                    harmonyVol = 0.022
                }

                // World 4+: Melody gets octave variation for interest
                if (currentTheme >= 4) {
                    if (noteIdx % 8 >= 4) melodyFreq = note * 2
                    melodyVol = 0.035
                }

                // World 5+: Counter-melody — bass walks chromatically
                if (currentTheme >= 5 && noteIdx % 4 === 2) {
                    bassFreq = bass * 1.189 // Minor 3rd walk
                    bassVol = 0.025
                }

                // World 6+: Arpeggio becomes denser, shorter notes
                if (currentTheme >= 6) {
                    harmonyVol = 0.03
                    melodyVol = 0.04
                }

                // World 7+: Add reverb-like double note
                if (currentTheme >= 7 && noteIdx % 3 === 0) {
                    // Delayed ghost note via frequency slide
                    melodyFreq = note * 1.002 // Slight detuning for width
                }

                // Set oscillator frequencies
                oscMelody.frequency.setValueAtTime(melodyFreq, nextNoteTime)
                oscHarmony.frequency.setValueAtTime(harmonyFreq, nextNoteTime)
                oscBass.frequency.setValueAtTime(bassFreq, nextNoteTime)

                // Dynamic envelope — varies with pattern position for groove
                const isDownbeat = noteIdx % 4 === 0
                const accentVol = isDownbeat ? 1.3 : 1.0
                const totalVol = melodyVol * accentVol

                gain.gain.setValueAtTime(0.003, nextNoteTime)
                gain.gain.linearRampToValueAtTime(totalVol, nextNoteTime + 0.015)
                gain.gain.exponentialRampToValueAtTime(
                    0.008,
                    nextNoteTime + Math.max(0.08, 0.2 / tempoMult)
                )

                // Update filter cutoff based on world (brighter in later worlds)
                const cutoff = 1000 + currentTheme * 120
                filter.frequency.setValueAtTime(Math.min(cutoff, 2800), nextNoteTime)

                noteIdx = (noteIdx + 1) % pattern.length
                patternCycle++
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, NOTE_INTERVAL * 1000 * 0.7)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmNodesRef.current.gain.gain.cancelScheduledValues(ct)
            bgmNodesRef.current.gain.gain.setValueAtTime(bgmNodesRef.current.gain.gain.value, ct)
            bgmNodesRef.current.gain.gain.linearRampToValueAtTime(0, ct + 0.3)
            for (const osc of bgmNodesRef.current.oscs) {
                try { osc.stop(ct + 0.4) } catch { /* already stopped */ }
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
        stopBackgroundMusic
    }
}
