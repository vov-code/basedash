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
            masterGainRef.current.gain.value = 0.32
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

        // Smoother envelope — soft attack, long natural decay
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1.0, 0.008)
        gain.gain.setValueAtTime(0.9, dur * 0.3)
        gain.gain.exponentialRampToValueAtTime(0.001, dur + 0.1)

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + 0.15)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(() => { })

    }, [soundEnabled, initAudio])

    // =====================================================================
    // SFX — WARM, RELAXING, CRYSTAL-CLEAR SOUNDS
    // =====================================================================

    // JUMP — Soft bubble pop, gentle and satisfying
    const sfxJump = useCallback(() => {
        playTone(440, 'sine', 0.08, 0.08, 330)     // A4→E4 gentle drop
        playTone(880, 'sine', 0.01, 0.06)           // A5 tiny shimmer
    }, [playTone])

    // DOUBLE JUMP — Rising two-note wind chime
    const sfxDoubleJump = useCallback(() => {
        playTone(523, 'sine', 0.08, 0.08, 392)      // C5→G4
        setTimeout(() => playTone(784, 'sine', 0.04, 0.1), 60) // G5 bell
    }, [playTone])

    // DASH — Soft wind swoosh
    const sfxDash = useCallback(() => {
        playTone(196, 'triangle', 0.04, 0.18, 65)   // G3→low sweep
    }, [playTone])

    // COLLECT — Musical two-note bell chime (major 6th — warm interval)
    const sfxCollect = useCallback(() => {
        playTone(1046, 'sine', 0.06, 0.22)           // C6
        setTimeout(() => playTone(1568, 'sine', 0.04, 0.35), 65) // G6 — perfect 5th, long shimmer
    }, [playTone])

    // POWERUP — Ascending major arpeggio with sparkle (CMaj9)
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 988, 1174]   // C-E-G-B-D (CMaj9)
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.05 - i * 0.005, 0.2 + i * 0.05), i * 45)
        })
    }, [playTone])

    // DEATH — Gentle descending minor sweep (compassionate, not harsh)
    const sfxHit = useCallback(() => {
        playTone(349, 'triangle', 0.08, 0.4, 131)    // F4→C3 slow drop
        setTimeout(() => playTone(220, 'sine', 0.05, 0.3, 73), 120)  // A3→D2
    }, [playTone])

    // SELECT — Soft crystal tap
    const sfxSelect = useCallback(() => {
        playTone(880, 'sine', 0.04, 0.08, 784)
    }, [playTone])

    // COMBO — Ascending pentatonic scale, each combo higher
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [392, 440, 523, 587, 659, 784, 880, 988, 1046, 1174, 1318]
        const idx = Math.min(combo, pentatonic.length - 1)
        const note = pentatonic[idx]
        playTone(note, 'sine', 0.05, 0.18)
        setTimeout(() => playTone(note * 1.498, 'sine', 0.02, 0.22), 50) // Perfect 5th bell
    }, [playTone])

    // MILESTONE — Triumphant ascending chord (wider voicing, more space)
    const sfxMilestone = useCallback(() => {
        const seq = [
            { f: 523, d: 80 },   // C5
            { f: 659, d: 80 },   // E5
            { f: 784, d: 80 },   // G5
            { f: 988, d: 100 },  // B5
            { f: 1046, d: 300 }, // C6 — resolve with sustain
        ]
        let t = 0
        seq.forEach(({ f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.05, d / 1000 + 0.15), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP / NEW RECORD — Sparkling cascade
    const sfxLevelUp = useCallback(() => {
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.035, 0.16 + i * 0.03), i * 35)
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
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        // 3 oscillators: melody, pad, bass
        const oscMelody = ctx.createOscillator()
        const oscPad = ctx.createOscillator()
        const oscBass = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        // Warm sine for melody, detuned triangle for pad width
        oscMelody.type = 'sine'
        oscPad.type = 'triangle'
        oscPad.detune.value = 8   // Warm chorus effect
        oscBass.type = 'sine'

        // Softer low-pass — lo-fi warmth
        filter.type = 'lowpass'
        filter.frequency.value = 1000
        filter.Q.value = 0.5

        // Gentle fade-in over 3 seconds
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

        // === CHORD PROGRESSIONS PER WORLD — each has a unique emotional key ===
        const keyPatterns: number[][] = [
            // World 0–1: C major (warm, welcoming, simple)
            // CMaj7 → Am7 → FMaj7 → G
            [261.63, 329.63, 392.00, 493.88, 220.00, 261.63, 329.63, 440.00,
                174.61, 220.00, 261.63, 329.63, 196.00, 246.94, 293.66, 392.00],
            // World 2–3: D dorian (dreamy, slightly mysterious)
            // Dm9 → Em7 → CMaj7 → Am7
            [293.66, 349.23, 440.00, 523.25, 329.63, 392.00, 493.88, 587.33,
                261.63, 329.63, 392.00, 493.88, 220.00, 261.63, 329.63, 440.00],
            // World 4–5: E minor (deeper, driving)
            // Em7 → CMaj → G → Dsus
            [329.63, 392.00, 493.88, 587.33, 261.63, 329.63, 392.00, 523.25,
                196.00, 246.94, 293.66, 392.00, 293.66, 392.00, 440.00, 587.33],
            // World 6–7: Ab major (ethereal, expansive)
            // AbMaj7 → Fm7 → DbMaj7 → Eb
            [415.30, 523.25, 622.25, 783.99, 349.23, 415.30, 523.25, 698.46,
                277.18, 349.23, 415.30, 523.25, 311.13, 392.00, 466.16, 622.25],
            // World 8+: F# minor (climactic, transcendent)
            // F#m9 → DMaj → A → E
            [369.99, 440.00, 523.25, 659.26, 293.66, 369.99, 440.00, 587.33,
                220.00, 277.18, 329.63, 440.00, 329.63, 415.30, 493.88, 659.26],
        ]

        // Bass roots — one octave below chord root
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
        let nextNoteTime = ctx.currentTime + 0.6
        const BASE_INTERVAL = 0.32 // Slower tempo = more relaxed feel (was 0.26)

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const patternIdx = Math.min(Math.floor(currentTheme / 2), keyPatterns.length - 1)
            const pattern = keyPatterns[patternIdx]
            const bassLine = bassPatterns[patternIdx]

            // Tempo scales gently with speed — never frantic
            const tempoMult = 0.9 + currentSpeed * 0.1 // ranges from ~1.0 to ~1.2
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.0) {
                const note = pattern[noteIdx]
                const bass = bassLine[noteIdx]
                const isDownbeat = noteIdx % 4 === 0
                const isOffbeat = noteIdx % 2 !== 0

                // --- Layer volumes based on world progression ---
                let melodyVol = 0.038
                let padVol = 0.012      // Subtle pad from the start (warmth)
                let bassVol = 0.008     // Whisper of bass even in world 0

                // Pad harmony — octave above on even beats
                let padFreq = note * 0.5 // Default: octave below (gentle pad)
                let bassFreq = bass

                // World 0–1: Gentle melody + whisper pad
                if (currentTheme >= 1 && !isOffbeat) {
                    padFreq = note * 2    // Octave sparkle on downbeats
                    padVol = 0.018
                }

                // World 2–3: Bass becomes audible, pad fills in
                if (currentTheme >= 2) {
                    bassVol = isDownbeat ? 0.028 : 0.015
                    padVol = 0.022
                }

                // World 3+: Perfect 5th harmony on offbeats
                if (currentTheme >= 3 && isOffbeat) {
                    padFreq = note * 1.498
                    padVol = 0.025
                }

                // World 4+: Melody octave variation for interest
                let melodyFreq = note
                if (currentTheme >= 4) {
                    if (noteIdx % 8 >= 4) melodyFreq = note * 2
                    melodyVol = 0.035
                }

                // World 5+: Bass walks chromatically on beat 3
                if (currentTheme >= 5 && noteIdx % 4 === 2) {
                    bassFreq = bass * 1.189
                    bassVol = 0.025
                }

                // World 6+: Fuller arrangement
                if (currentTheme >= 6) {
                    padVol = 0.03
                    melodyVol = 0.04
                }

                // World 7+: Gentle detuning for dreamy width
                if (currentTheme >= 7 && noteIdx % 3 === 0) {
                    melodyFreq = note * 1.003
                }

                // --- Set frequencies with SMOOTH glide (legato!) ---
                const glideTime = NOTE_INTERVAL * 0.15  // 15% of note = smooth portamento
                oscMelody.frequency.setTargetAtTime(melodyFreq, nextNoteTime, glideTime)
                oscPad.frequency.setTargetAtTime(padFreq, nextNoteTime, glideTime)
                oscBass.frequency.setTargetAtTime(bassFreq, nextNoteTime, glideTime * 2) // Bass glides slower

                // --- Dynamic envelope — LEGATO (no hard cuts) ---
                const accentVol = isDownbeat ? 1.25 : 1.0
                const totalVol = melodyVol * accentVol

                // Smooth swell instead of staccato on/off
                gain.gain.setTargetAtTime(totalVol, nextNoteTime, 0.04)   // ~40ms attack
                gain.gain.setTargetAtTime(
                    totalVol * 0.6,                                        // Sustain at 60%
                    nextNoteTime + NOTE_INTERVAL * 0.5,
                    0.06
                )

                // Filter opens slightly on downbeats for brightness variation
                const cutoff = 900 + currentTheme * 100 + (isDownbeat ? 250 : 0)
                filter.frequency.setTargetAtTime(Math.min(cutoff, 2400), nextNoteTime, 0.05)

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
