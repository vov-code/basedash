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

        // 4 oscillators for richer, more melodious sound
        const oscLead = ctx.createOscillator()     // Main melody — bright and catchy
        const oscArp = ctx.createOscillator()       // Arpeggio — sparkly movement
        const oscPad = ctx.createOscillator()        // Warm pad — harmonic bed
        const oscBass = ctx.createOscillator()       // Sub-bass — driving pulse
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscLead.type = 'sine'
        oscArp.type = 'sine'
        oscPad.type = 'triangle'
        oscPad.detune.value = 12       // Wider chorus for dreamy feel
        oscBass.type = 'sine'

        filter.type = 'lowpass'
        filter.frequency.value = 1800   // Warmer, more open filter
        filter.Q.value = 0.7

        // Smooth fade-in
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5)

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
        // MELODIES — Uplifting major-key hooks, Geometry Dash energy
        // ===============================================================
        // Each world uses a different key for emotional progression:
        //   World 0-1: C major — bright, welcoming, catchy
        //   World 2-3: G major — uplifting, soaring
        //   World 4-5: D major — energetic, driving
        //   World 6-7: A major — euphoric, intense
        //   World 8+:  E major — transcendent, triumphant

        const melodyPatterns: number[][] = [
            // C major — happy bouncy hook (C-E-G-A-G-E-C-D-E-G-A-C6-A-G-E-D)
            [523, 659, 784, 880, 784, 659, 523, 587,
                659, 784, 880, 1046, 880, 784, 659, 587],
            // G major — soaring anthem (G-B-D-E-D-B-G-A-B-D-E-G5-E-D-B-A)
            [784, 988, 1175, 1318, 1175, 988, 784, 880,
                988, 1175, 1318, 1568, 1318, 1175, 988, 880],
            // D major — driving energy (D-F#-A-B-A-F#-D-E-F#-A-B-D6-B-A-F#-E)
            [587, 740, 880, 988, 880, 740, 587, 659,
                740, 880, 988, 1175, 988, 880, 740, 659],
            // A major — euphoric rush (A-C#-E-F#-E-C#-A-B-C#-E-F#-A6-F#-E-C#-B)
            [880, 1108, 1318, 1480, 1318, 1108, 880, 988,
                1108, 1318, 1480, 1760, 1480, 1318, 1108, 988],
            // E major — triumphant finale (E-G#-B-C#-B-G#-E-F#-G#-B-C#-E6-C#-B-G#-F#)
            [659, 830, 988, 1108, 988, 830, 659, 740,
                830, 988, 1108, 1318, 1108, 988, 830, 740],
        ]

        // Arpeggio patterns — sparkling 16th-note movement
        const arpPatterns: number[][] = [
            // C major arps — twinkling high register
            [1046, 1318, 1568, 1318, 1046, 1568, 1318, 1046,
                1175, 1480, 1760, 1480, 1175, 1760, 1480, 1175],
            // G major arps
            [1568, 1975, 2349, 1975, 1568, 2349, 1975, 1568,
                1760, 2217, 2637, 2217, 1760, 2637, 2217, 1760],
            // D major arps
            [1175, 1480, 1760, 1480, 1175, 1760, 1480, 1175,
                1318, 1661, 1975, 1661, 1318, 1975, 1661, 1318],
            // A major arps
            [1760, 2217, 2637, 2217, 1760, 2637, 2217, 1760,
                1975, 2489, 2960, 2489, 1975, 2960, 2489, 1975],
            // E major arps
            [1318, 1661, 1975, 1661, 1318, 1975, 1661, 1318,
                1480, 1864, 2217, 1864, 1480, 2217, 1864, 1480],
        ]

        // Bass patterns — driving octave pulses
        const bassPatterns: number[][] = [
            // C major bass — root-five bounce
            [131, 131, 196, 196, 165, 165, 147, 147,
                131, 196, 131, 196, 165, 147, 131, 131],
            // G major bass
            [196, 196, 294, 294, 247, 247, 220, 220,
                196, 294, 196, 294, 247, 220, 196, 196],
            // D major bass
            [147, 147, 220, 220, 175, 175, 165, 165,
                147, 220, 147, 220, 175, 165, 147, 147],
            // A major bass
            [220, 220, 330, 330, 277, 277, 247, 247,
                220, 330, 220, 330, 277, 247, 220, 220],
            // E major bass
            [165, 165, 247, 247, 208, 208, 185, 185,
                165, 247, 165, 247, 208, 185, 165, 165],
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.5
        const BASE_INTERVAL = 0.22  // Fast, energetic tempo like Geometry Dash

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const patIdx = Math.min(Math.floor(currentTheme / 2), melodyPatterns.length - 1)
            const melody = melodyPatterns[patIdx]
            const arps = arpPatterns[patIdx]
            const bass = bassPatterns[patIdx]

            // Tempo syncs with game speed — alive and responsive
            const tempoMult = 0.9 + currentSpeed * 0.1
            const NOTE_INTERVAL = BASE_INTERVAL / tempoMult

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.2) {
                // Skip-ahead if tab was backgrounded
                if (nextNoteTime < audioCtxRef.current.currentTime - 0.5) {
                    nextNoteTime = audioCtxRef.current.currentTime + 0.05
                    gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    gain.gain.setTargetAtTime(0.035, audioCtxRef.current.currentTime + 0.05, 0.2)
                    continue
                }

                const melodyNote = melody[noteIdx % melody.length]
                const arpNote = arps[noteIdx % arps.length]
                const bassNote = bass[Math.floor(noteIdx / 2) % bass.length]
                const isDownbeat = noteIdx % 4 === 0
                const isHalfBeat = noteIdx % 2 === 0
                const isBarStart = noteIdx % 16 === 0

                // Progressive volume layers — music gets fuller with each world
                let leadVol = 0.028
                let arpVol = 0.006
                let padVol = 0.008
                let bassVol = 0.005

                // World 0-1: Light melody + soft pad — learning phase
                if (currentTheme >= 2) { padVol = 0.016; leadVol = 0.032; arpVol = 0.012 }
                // World 4-5: Full arpeggio + driving bass
                if (currentTheme >= 4) { bassVol = 0.02; leadVol = 0.035; arpVol = 0.018 }
                // World 6+: Everything cranked — euphoric full arrangement
                if (currentTheme >= 6) { leadVol = 0.04; padVol = 0.022; bassVol = 0.025; arpVol = 0.022 }

                // Pad — major 3rd above bass for warm harmony
                const padFreq = melodyNote * 0.75  // 4th below melody

                // Smooth portamento — short glides for punchy feel
                const glide = NOTE_INTERVAL * 0.12
                oscLead.frequency.setTargetAtTime(melodyNote, nextNoteTime, glide)
                oscArp.frequency.setTargetAtTime(arpNote, nextNoteTime, glide * 0.5) // Faster arp transitions
                oscPad.frequency.setTargetAtTime(padFreq, nextNoteTime, glide * 2)   // Slower pad = smoother
                oscBass.frequency.setTargetAtTime(bassNote, nextNoteTime, glide * 0.3) // Punchy bass

                // Rhythmic sidechain-style pumping — classic EDM bounce
                const accent = isBarStart ? 1.3 : (isDownbeat ? 1.15 : (isHalfBeat ? 1.0 : 0.8))
                const totalVol = (leadVol + arpVol + padVol + bassVol) * accent

                // Punchy envelope — quick attack, rhythmic release
                gain.gain.setTargetAtTime(totalVol, nextNoteTime, 0.025)
                gain.gain.setTargetAtTime(
                    totalVol * 0.45,
                    nextNoteTime + NOTE_INTERVAL * 0.55,
                    0.04
                )

                // Filter opens progressively — brighter with each world
                const cutoff = 1200 + currentTheme * 120 + (isDownbeat ? 300 : 0) + (isBarStart ? 400 : 0)
                filter.frequency.setTargetAtTime(Math.min(cutoff, 3200), nextNoteTime, 0.04)

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
