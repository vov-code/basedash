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

        // 4 oscillators for smooth, dreamy sound
        const oscLead = ctx.createOscillator()     // Main melody — warm and lyrical
        const oscArp = ctx.createOscillator()       // Arpeggio — crystalline shimmer
        const oscPad = ctx.createOscillator()        // Warm pad — lush harmonic bed
        const oscBass = ctx.createOscillator()       // Sub-bass — gentle pulse
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscLead.type = 'sine'
        oscArp.type = 'sine'
        oscPad.type = 'triangle'
        oscPad.detune.value = 8        // Gentle chorus for dreamy warmth
        oscBass.type = 'sine'

        filter.type = 'lowpass'
        filter.frequency.value = 2200   // Warm, open filter — no harshness
        filter.Q.value = 0.5

        // Smooth fade-in
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 3.5)

        oscLead.connect(filter)
        oscArp.connect(filter)
        oscPad.connect(filter)
        oscBass.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        oscLead.start()
        oscArp.start()
        oscPad.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscLead, oscArp, oscPad, oscBass], gain }

        // ===============================================================
        // MELODIES — Dreamy, relaxing, major-key lullabies
        // ===============================================================
        // Smooth flowing melodies using stepwise motion and gentle intervals.
        // Each world uses ascending keys for emotional lift:
        //   World 0-1: C major — peaceful, welcoming
        //   World 2-3: D major — warm, uplifting
        //   World 4-5: E major — bright, euphoric
        //   World 6-7: F major — lush, nostalgic
        //   World 8+:  G major — soaring, transcendent

        const melodyPatterns: number[][] = [
            // C major — peaceful flowing (C-E-G-C6-B-G-E-D-C-D-E-G-A-G-E-C)
            [523, 659, 784, 1046, 988, 784, 659, 587,
                523, 587, 659, 784, 880, 784, 659, 523],
            // D major — warm ascending (D-F#-A-D6-C#6-A-F#-E-D-E-F#-A-B-A-F#-D)
            [587, 740, 880, 1175, 1108, 880, 740, 659,
                587, 659, 740, 880, 988, 880, 740, 587],
            // E major — bright shimmer (E-G#-B-E6-D#6-B-G#-F#-E-F#-G#-B-C#6-B-G#-E)
            [659, 830, 988, 1318, 1244, 988, 830, 740,
                659, 740, 830, 988, 1108, 988, 830, 659],
            // F major — lush nostalgic (F-A-C6-F6-E6-C6-A-G-F-G-A-C6-D6-C6-A-F)
            [349, 440, 523, 698, 659, 523, 440, 392,
                349, 392, 440, 523, 587, 523, 440, 349],
            // G major — soaring (G-B-D6-G6-F#6-D6-B-A-G-A-B-D6-E6-D6-B-G)
            [392, 494, 587, 784, 740, 587, 494, 440,
                392, 440, 494, 587, 659, 587, 494, 392],
        ]

        // Arpeggio patterns — gentle high-register tinkling
        const arpPatterns: number[][] = [
            // C major — crystalline (C6-E6-G6-E6 | D6-F6-A6-F6)
            [1046, 1318, 1568, 1318, 1046, 1568, 1318, 1046,
                1175, 1397, 1760, 1397, 1175, 1760, 1397, 1175],
            // D major arps
            [1175, 1480, 1760, 1480, 1175, 1760, 1480, 1175,
                1318, 1568, 1975, 1568, 1318, 1975, 1568, 1318],
            // E major arps
            [1318, 1661, 1975, 1661, 1318, 1975, 1661, 1318,
                1480, 1864, 2217, 1864, 1480, 2217, 1864, 1480],
            // F major arps
            [1397, 1760, 2093, 1760, 1397, 2093, 1760, 1397,
                1568, 1975, 2349, 1975, 1568, 2349, 1975, 1568],
            // G major arps
            [1568, 1975, 2349, 1975, 1568, 2349, 1975, 1568,
                1760, 2217, 2637, 2217, 1760, 2637, 2217, 1760],
        ]

        // Bass patterns — gentle root-third movement (not driving octaves)
        const bassPatterns: number[][] = [
            // C major bass — soft root-third
            [131, 131, 165, 165, 147, 147, 131, 131,
                131, 165, 147, 131, 165, 147, 131, 131],
            // D major bass
            [147, 147, 185, 185, 165, 165, 147, 147,
                147, 185, 165, 147, 185, 165, 147, 147],
            // E major bass
            [165, 165, 208, 208, 185, 185, 165, 165,
                165, 208, 185, 165, 208, 185, 165, 165],
            // F major bass
            [175, 175, 220, 220, 196, 196, 175, 175,
                175, 220, 196, 175, 220, 196, 175, 175],
            // G major bass
            [196, 196, 247, 247, 220, 220, 196, 196,
                196, 247, 220, 196, 247, 220, 196, 196],
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.5
        const BASE_INTERVAL = 0.32  // Relaxed tempo — smooth and dreamy

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const patIdx = Math.min(Math.floor(currentTheme / 2), melodyPatterns.length - 1)
            const melody = melodyPatterns[patIdx]
            const arps = arpPatterns[patIdx]
            const bass = bassPatterns[patIdx]

            // Gentle tempo sync — less aggressive than before
            const tempoMult = 0.95 + currentSpeed * 0.05
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.2) {
                // Skip-ahead if tab was backgrounded
                if (nextNoteTime < audioCtxRef.current.currentTime - 0.5) {
                    nextNoteTime = audioCtxRef.current.currentTime + 0.05
                    gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    gain.gain.setTargetAtTime(0.03, audioCtxRef.current.currentTime + 0.05, 0.3)
                    continue
                }

                const melodyNote = melody[noteIdx % melody.length]
                const arpNote = arps[noteIdx % arps.length]
                const bassNote = bass[Math.floor(noteIdx / 2) % bass.length]
                const isDownbeat = noteIdx % 4 === 0
                const isHalfBeat = noteIdx % 2 === 0
                const isBarStart = noteIdx % 16 === 0

                // Softer, more balanced volume layers
                let leadVol = 0.022
                let arpVol = 0.004
                let padVol = 0.010
                let bassVol = 0.004

                // World 0-1: Gentle melody + warm pad — welcoming
                if (currentTheme >= 2) { padVol = 0.014; leadVol = 0.025; arpVol = 0.008 }
                // World 4-5: Arpeggios shimmer in
                if (currentTheme >= 4) { bassVol = 0.012; leadVol = 0.028; arpVol = 0.012 }
                // World 6+: Full lush arrangement
                if (currentTheme >= 6) { leadVol = 0.032; padVol = 0.018; bassVol = 0.016; arpVol = 0.016 }

                // Pad — 4th below melody for warm consonance
                const padFreq = melodyNote * 0.75

                // Smooth portamento — longer glides for dreamy feel
                const glide = NOTE_INTERVAL * 0.18
                oscLead.frequency.setTargetAtTime(melodyNote, nextNoteTime, glide)
                oscArp.frequency.setTargetAtTime(arpNote, nextNoteTime, glide * 0.7)
                oscPad.frequency.setTargetAtTime(padFreq, nextNoteTime, glide * 3)   // Very slow pad = lush
                oscBass.frequency.setTargetAtTime(bassNote, nextNoteTime, glide * 0.4)

                // Gentle breathing rhythm — much softer than EDM pump
                const accent = isBarStart ? 1.15 : (isDownbeat ? 1.08 : (isHalfBeat ? 1.0 : 0.88))
                const totalVol = (leadVol + arpVol + padVol + bassVol) * accent

                // Smooth envelope — slower attack, gentler release
                gain.gain.setTargetAtTime(totalVol, nextNoteTime, 0.04)
                gain.gain.setTargetAtTime(
                    totalVol * 0.6,
                    nextNoteTime + NOTE_INTERVAL * 0.6,
                    0.06
                )

                // Filter — warm and open, opens slightly more with worlds
                const cutoff = 1600 + currentTheme * 80 + (isDownbeat ? 150 : 0) + (isBarStart ? 200 : 0)
                filter.frequency.setTargetAtTime(Math.min(cutoff, 2800), nextNoteTime, 0.06)

                noteIdx = (noteIdx + 1) % melody.length
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
