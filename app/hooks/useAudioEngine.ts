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

        // === 5 OSCILLATORS — Lo-fi Chillwave Engine ===
        const oscMelody = ctx.createOscillator()    // Lead melody — pentatonic, dreamy
        const oscChime = ctx.createOscillator()     // High chime — bell-like sparkle
        const oscPad1 = ctx.createOscillator()       // Pad layer 1 — warm bed
        const oscPad2 = ctx.createOscillator()       // Pad layer 2 — detuned chorus
        const oscBass = ctx.createOscillator()       // Sub bass — deep warmth

        const bgmGain = ctx.createGain()
        const bgmFilter = ctx.createBiquadFilter()

        // === SIGNAL CHAIN ===
        oscMelody.type = 'sine'
        oscChime.type = 'sine'
        oscPad1.type = 'triangle'
        oscPad2.type = 'triangle'
        oscPad2.detune.value = 6  // subtle chorus width
        oscBass.type = 'sine'

        bgmFilter.type = 'lowpass'
        bgmFilter.frequency.value = 1800
        bgmFilter.Q.value = 0.3  // zero resonance — pure warmth

        // Slow fade in over 4 seconds
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(0.032, ctx.currentTime + 4)

        // Wire everything through filter → gain → master
        oscMelody.connect(bgmFilter)
        oscChime.connect(bgmFilter)
        oscPad1.connect(bgmFilter)
        oscPad2.connect(bgmFilter)
        oscBass.connect(bgmFilter)
        bgmFilter.connect(bgmGain)
        bgmGain.connect(master)

        oscMelody.start()
        oscChime.start()
        oscPad1.start()
        oscPad2.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscMelody, oscChime, oscPad1, oscPad2, oscBass], gain: bgmGain }

        // =================================================================
        // COMPOSITION — 5 distinct world moods, pentatonic melodies
        // =================================================================
        //
        // The music uses pentatonic scales (5 notes, no semitones = never
        // sounds dissonant, always pleasant). Each world changes key AND
        // character:
        //
        // World 0-1: Am pentatonic — ambient, meditative (A C D E G)
        // World 2-3: C  pentatonic — warm, hopeful     (C D E G A)
        // World 4-5: D  pentatonic — ethereal, bright   (D E F# A B)
        // World 6-7: E  pentatonic — mystical, intense  (E F# G# B C#)
        // World 8+:  G  pentatonic — triumphant, open   (G A B D E)
        //
        // Melody uses 32-step looping patterns with rest notes (0 = silence)
        // to create breathing musical phrases, not constant noise.

        const melodies: number[][] = [
            // Am pentatonic — flowing ambient, minimal rests
            [440, 523, 587, 659, 784, 659, 587, 523,
                440, 523, 587, 784, 659, 523, 587, 440,
                523, 659, 784, 659, 587, 523, 440, 523,
                587, 659, 784, 880, 784, 659, 587, 523],
            // C pentatonic — warm continuous rising
            [523, 587, 659, 784, 880, 784, 659, 587,
                523, 587, 659, 784, 880, 1046, 880, 784,
                659, 587, 523, 587, 659, 784, 880, 784,
                659, 784, 880, 1046, 880, 784, 659, 587],
            // D pentatonic — bright flowing shimmer
            [587, 659, 740, 880, 988, 880, 740, 659,
                587, 659, 740, 880, 988, 1175, 988, 880,
                740, 659, 587, 659, 740, 880, 988, 880,
                740, 880, 988, 1175, 988, 880, 740, 659],
            // E pentatonic — mystical flowing
            [659, 740, 830, 988, 1108, 988, 830, 740,
                659, 740, 830, 988, 1108, 1318, 1108, 988,
                830, 740, 659, 740, 830, 988, 1108, 988,
                830, 988, 1108, 1318, 1108, 988, 830, 740],
            // G pentatonic — soaring triumph
            [784, 880, 988, 1175, 1318, 1175, 988, 880,
                784, 880, 988, 1175, 1318, 1568, 1318, 1175,
                988, 880, 784, 880, 988, 1175, 1318, 1175,
                988, 1175, 1318, 1568, 1318, 1175, 988, 880],
        ]

        // Chime patterns — gentle bells, sparse but present
        const chimes: number[][] = [
            // Am — soft bell accents
            [0, 0, 1046, 0, 0, 1318, 0, 0,
                1568, 0, 0, 1046, 0, 0, 1318, 0,
                0, 1568, 0, 0, 1046, 0, 0, 1318,
                0, 0, 1568, 0, 1046, 0, 0, 0],
            // C — brighter bells
            [0, 1046, 0, 0, 1318, 0, 1568, 0,
                0, 1046, 0, 1318, 0, 0, 1568, 0,
                1046, 0, 0, 2093, 0, 1568, 0, 0,
                1318, 0, 1046, 0, 0, 1568, 0, 0],
            // D — crystalline
            [0, 1175, 0, 1480, 0, 1760, 0, 0,
                1480, 0, 0, 1175, 0, 1760, 0, 0,
                1175, 0, 2349, 0, 1760, 0, 0, 1480,
                0, 1175, 0, 0, 1760, 0, 0, 0],
            // E — ethereal
            [0, 1318, 0, 0, 1661, 0, 1975, 0,
                0, 1318, 0, 1661, 0, 0, 1975, 0,
                1318, 0, 0, 2637, 0, 1975, 0, 0,
                1661, 0, 1318, 0, 0, 1975, 0, 0],
            // G — triumphant
            [1568, 0, 0, 1975, 0, 2349, 0, 0,
                1975, 0, 1568, 0, 0, 1975, 0, 0,
                2349, 0, 0, 2637, 0, 2349, 0, 0,
                1975, 0, 1568, 0, 0, 1975, 0, 0],
        ]

        // Pad root notes — slow chord changes (1 per 8 steps)
        const padRoots: number[][] = [
            [220, 220, 262, 262, 294, 294, 220, 220],  // Am: A-C-D-A
            [262, 262, 294, 294, 330, 330, 262, 262],  // C:  C-D-E-C
            [294, 294, 370, 370, 440, 440, 294, 294],  // D:  D-F#-A-D
            [330, 330, 415, 415, 494, 494, 330, 330],  // E:  E-G#-B-E
            [392, 392, 440, 440, 494, 494, 392, 392],  // G:  G-A-B-G
        ]

        // Bass patterns — root notes only, very simple
        const bassNotes: number[][] = [
            [110, 110, 131, 131, 147, 147, 110, 110],
            [131, 131, 147, 147, 165, 165, 131, 131],
            [147, 147, 185, 185, 220, 220, 147, 147],
            [165, 165, 208, 208, 247, 247, 165, 165],
            [196, 196, 220, 220, 247, 247, 196, 196],
        ]

        let step = 0
        let nextTime = ctx.currentTime + 0.8
        const BASE_TEMPO = 0.28  // base note interval

        const tick = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const speed = bgmSpeedRef.current || 1
            const world = bgmThemeRef.current || 0

            const pi = Math.min(Math.floor(world / 2), melodies.length - 1)
            const mel = melodies[pi]
            const chm = chimes[pi]
            const pad = padRoots[pi]
            const bas = bassNotes[pi]

            // Tempo reacts clearly to game speed
            const tempoScale = 0.85 + speed * 0.15
            const interval = BASE_TEMPO / tempoScale

            while (nextTime < audioCtxRef.current.currentTime + 1.0) {
                // Skip-ahead recovery for background tabs
                if (nextTime < audioCtxRef.current.currentTime - 0.5) {
                    nextTime = audioCtxRef.current.currentTime + 0.05
                    bgmGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    bgmGain.gain.setTargetAtTime(0.028, audioCtxRef.current.currentTime + 0.1, 0.4)
                    continue
                }

                const melNote = mel[step % mel.length]
                const chmNote = chm[step % chm.length]
                const padNote = pad[Math.floor(step / 4) % pad.length]
                const basNote = bas[Math.floor(step / 4) % bas.length]

                const beat4 = step % 4 === 0
                const beat8 = step % 8 === 0
                const bar = step % 32 === 0

                // === VOLUME LAYERS — world-progressive ===
                let melVol = 0.020
                let chmVol = 0.003
                let padVol = 0.008
                let basVol = 0.003

                // World 2+: warmer, chimes come in
                if (world >= 2) { melVol = 0.024; chmVol = 0.007; padVol = 0.012 }
                // World 4+: full shimmer
                if (world >= 4) { melVol = 0.027; chmVol = 0.010; basVol = 0.010; padVol = 0.015 }
                // World 6+: lush everything
                if (world >= 6) { melVol = 0.030; chmVol = 0.013; basVol = 0.014; padVol = 0.018 }
                // World 8+: maximal richness
                if (world >= 8) { melVol = 0.033; chmVol = 0.015; basVol = 0.016; padVol = 0.020 }

                // === MELODY — only plays if note > 0 (rests = silence) ===
                const glide = interval * 0.15
                if (melNote > 0) {
                    oscMelody.frequency.setTargetAtTime(melNote, nextTime, glide)
                }

                // === CHIME — sparkle on non-zero notes ===
                if (chmNote > 0) {
                    oscChime.frequency.setTargetAtTime(chmNote, nextTime, glide * 0.3)
                }

                // === PAD — slow chord movement ===
                oscPad1.frequency.setTargetAtTime(padNote, nextTime, glide * 4)
                oscPad2.frequency.setTargetAtTime(padNote * 1.498, nextTime, glide * 4) // perfect 5th

                // === BASS — deep, slow ===
                oscBass.frequency.setTargetAtTime(basNote, nextTime, glide * 2)

                // === DYNAMICS — gentle breathing ===
                const hasMelody = melNote > 0
                const hasChime = chmNote > 0
                const accentMult = bar ? 1.12 : (beat8 ? 1.05 : (beat4 ? 1.0 : 0.92))

                const totalVol = (
                    (hasMelody ? melVol : melVol * 0.15) +
                    (hasChime ? chmVol : 0) +
                    padVol +
                    basVol
                ) * accentMult

                // Smooth envelope — long attack for lo-fi feel
                bgmGain.gain.setTargetAtTime(totalVol, nextTime, 0.05)
                bgmGain.gain.setTargetAtTime(
                    totalVol * 0.65,
                    nextTime + interval * 0.65,
                    0.07
                )

                // Filter — opens with worlds, breathes on beats
                const baseCut = 1400 + world * 100
                const beatCut = beat4 ? 200 : (beat8 ? 300 : 0)
                const barCut = bar ? 400 : 0
                bgmFilter.frequency.setTargetAtTime(
                    Math.min(baseCut + beatCut + barCut, 3000),
                    nextTime, 0.05
                )

                step++
                nextTime += interval
            }

            bgmIntervalRef.current = setTimeout(tick, interval * 1000 * 0.45)
        }
        tick()

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
