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
            compressor.threshold.value = -20
            compressor.knee.value = 20
            compressor.ratio.value = 4
            compressor.attack.value = 0.005
            compressor.release.value = 0.15
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.20
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

        // === PREMIUM BGM ENGINE — Per-osc gain, anti-whistle, 64-step patterns ===
        const oscMelody = ctx.createOscillator()
        const oscChime = ctx.createOscillator()
        const oscPad1 = ctx.createOscillator()
        const oscPad2 = ctx.createOscillator()
        const oscBass = ctx.createOscillator()

        // Per-oscillator gain nodes — independent volume control
        const gainMel = ctx.createGain()
        const gainChm = ctx.createGain()
        const gainPad = ctx.createGain()
        const gainBas = ctx.createGain()
        const bgmGain = ctx.createGain()       // Master bus
        const bgmFilter = ctx.createBiquadFilter()
        const chimeFilter = ctx.createBiquadFilter()  // Extra LP on chime to kill whistle

        oscMelody.type = 'sine'
        oscChime.type = 'sine'
        oscPad1.type = 'triangle'
        oscPad2.type = 'triangle'
        oscPad2.detune.value = 8
        oscBass.type = 'sine'

        // Main filter — warm, never harsh
        bgmFilter.type = 'lowpass'
        bgmFilter.frequency.value = 1100
        bgmFilter.Q.value = 0.1

        // Chime anti-whistle filter — hard cutoff on highs
        chimeFilter.type = 'lowpass'
        chimeFilter.frequency.value = 900
        chimeFilter.Q.value = 0.1

        // Wiring: each osc → own gain → filter → master
        oscMelody.connect(gainMel)
        oscChime.connect(chimeFilter)   // chime gets extra filter
        chimeFilter.connect(gainChm)
        oscPad1.connect(gainPad)
        oscPad2.connect(gainPad)        // both pads share one gain
        oscBass.connect(gainBas)

        gainMel.connect(bgmFilter)
        gainChm.connect(bgmFilter)
        gainPad.connect(bgmFilter)
        gainBas.connect(bgmFilter)
        bgmFilter.connect(bgmGain)
        bgmGain.connect(master)

        // Initial volumes — melody quiet, pad warm, chime barely audible
        gainMel.gain.value = 0.014
        gainChm.gain.value = 0.004
        gainPad.gain.value = 0.010
        gainBas.gain.value = 0.005

        // Slow fade in — ramps master bus to 1.0 (per-osc gains handle volume)
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 4)

        oscMelody.start()
        oscChime.start()
        oscPad1.start()
        oscPad2.start()
        oscBass.start()

        bgmNodesRef.current = { oscs: [oscMelody, oscChime, oscPad1, oscPad2, oscBass], gain: bgmGain }

        // =================================================================
        // 64-STEP MELODIES — each world has unique contour & emotion
        // Pentatonic scales = always consonant, never dissonant
        // =================================================================

        // Helper: octave-adjusted frequencies for lower mids (no highs!)
        // All melody notes are in the 220-880Hz range = warm, no whistle

        const melodies: number[][] = [
            // World 0-1: Am pent — gentle wave, meditative
            // A3 C4 D4 E4 G4 A4 — slow rise & fall, lullaby-like
            [220, 262, 294, 330, 392, 330, 294, 262,
                220, 262, 330, 392, 440, 392, 330, 262,
                294, 330, 392, 440, 392, 330, 294, 262,
                220, 262, 294, 392, 330, 294, 262, 220,
                262, 294, 330, 392, 440, 523, 440, 392,
                330, 294, 262, 220, 262, 294, 330, 294,
                220, 262, 330, 440, 392, 330, 262, 294,
                330, 392, 330, 294, 262, 220, 262, 220],

            // World 2-3: C pent — warm, hopeful, rising phrases
            // C4 D4 E4 G4 A4 C5
            [262, 294, 330, 392, 440, 392, 330, 294,
                262, 330, 392, 440, 523, 440, 392, 330,
                294, 330, 392, 523, 440, 392, 330, 294,
                262, 294, 392, 440, 523, 440, 330, 262,
                294, 392, 440, 523, 440, 392, 330, 294,
                262, 330, 440, 523, 440, 330, 294, 262,
                330, 392, 440, 523, 440, 392, 294, 262,
                294, 330, 392, 440, 330, 294, 262, 262],

            // World 4-5: D pent — bright, energetic, playful
            // D4 E4 F#4 A4 B4 D5
            [294, 330, 370, 440, 494, 440, 370, 330,
                294, 370, 440, 494, 587, 494, 440, 370,
                330, 370, 494, 587, 494, 440, 370, 294,
                330, 370, 440, 587, 494, 440, 370, 330,
                294, 330, 440, 494, 587, 494, 370, 330,
                294, 370, 494, 587, 494, 370, 330, 294,
                330, 440, 494, 587, 494, 440, 330, 294,
                370, 440, 494, 440, 370, 330, 294, 294],

            // World 6-7: Eb pent — mystical, dreamy, wider intervals
            // Eb4 F4 G4 Bb4 C5 Eb5
            [311, 349, 392, 466, 523, 466, 392, 349,
                311, 392, 466, 523, 622, 523, 466, 392,
                349, 392, 523, 622, 523, 466, 349, 311,
                349, 466, 523, 622, 523, 392, 349, 311,
                392, 466, 523, 622, 523, 466, 392, 349,
                311, 349, 466, 622, 523, 466, 392, 311,
                349, 392, 523, 622, 523, 392, 349, 311,
                349, 466, 523, 466, 392, 349, 311, 311],

            // World 8+: G pent — triumphant, soaring, wide leaps
            // G3 A3 B3 D4 E4 G4
            [196, 220, 247, 294, 330, 294, 247, 220,
                196, 247, 294, 330, 392, 330, 294, 247,
                220, 294, 330, 392, 330, 294, 247, 220,
                196, 247, 330, 392, 330, 247, 220, 196,
                220, 294, 330, 392, 440, 392, 330, 294,
                247, 294, 392, 440, 392, 330, 247, 220,
                196, 247, 294, 392, 330, 294, 220, 196,
                220, 247, 330, 392, 294, 247, 220, 196],
        ]

        // Chime patterns — very low frequencies only (262-523Hz range)
        // No high-pitched notes! Warmth only.
        const chimes: number[][] = [
            // Am — soft
            [0, 0, 262, 0, 0, 0, 330, 0, 0, 392, 0, 0, 0, 262, 0, 0,
                0, 330, 0, 0, 0, 0, 392, 0, 0, 0, 262, 0, 0, 0, 0, 0,
                0, 0, 330, 0, 0, 262, 0, 0, 0, 392, 0, 0, 0, 0, 330, 0,
                0, 0, 262, 0, 0, 0, 0, 330, 0, 0, 392, 0, 0, 0, 0, 0],
            // C — brighter
            [0, 262, 0, 0, 330, 0, 0, 392, 0, 0, 0, 262, 0, 330, 0, 0,
                392, 0, 0, 440, 0, 0, 392, 0, 0, 330, 0, 0, 262, 0, 0, 0,
                0, 330, 0, 0, 392, 0, 262, 0, 0, 440, 0, 0, 330, 0, 0, 0,
                262, 0, 0, 392, 0, 0, 330, 0, 0, 262, 0, 0, 0, 0, 0, 0],
            // D — warm
            [0, 294, 0, 370, 0, 0, 440, 0, 0, 0, 370, 0, 0, 294, 0, 440,
                0, 0, 494, 0, 0, 440, 0, 0, 370, 0, 0, 294, 0, 0, 440, 0,
                0, 370, 0, 0, 294, 0, 440, 0, 0, 0, 494, 0, 0, 370, 0, 0,
                294, 0, 0, 0, 440, 0, 0, 370, 0, 0, 294, 0, 0, 0, 0, 0],
            // Eb — ethereal
            [0, 0, 311, 0, 0, 392, 0, 0, 466, 0, 0, 0, 311, 0, 392, 0,
                0, 0, 466, 0, 0, 523, 0, 0, 466, 0, 0, 392, 0, 0, 0, 311,
                0, 392, 0, 0, 466, 0, 0, 311, 0, 0, 523, 0, 0, 392, 0, 0,
                311, 0, 0, 466, 0, 0, 392, 0, 0, 0, 311, 0, 0, 0, 0, 0],
            // G — bold
            [196, 0, 0, 247, 0, 0, 294, 0, 0, 330, 0, 0, 247, 0, 0, 294,
                0, 330, 0, 0, 392, 0, 0, 330, 0, 0, 294, 0, 0, 247, 0, 0,
                0, 294, 0, 0, 330, 0, 247, 0, 0, 392, 0, 0, 294, 0, 0, 0,
                247, 0, 0, 330, 0, 0, 294, 0, 0, 247, 0, 0, 196, 0, 0, 0],
        ]

        // Pad — slow 4-chord progressions per world
        const padRoots: number[][] = [
            [110, 110, 131, 131, 147, 147, 110, 110],  // Am
            [131, 131, 147, 147, 165, 165, 131, 131],  // C
            [147, 147, 185, 185, 220, 220, 147, 147],  // D
            [156, 156, 196, 196, 233, 233, 156, 156],  // Eb
            [98, 98, 110, 110, 131, 131, 98, 98],       // G (sub)
        ]

        // Bass — deep, simple
        const bassNotes: number[][] = [
            [55, 55, 65, 65, 73, 73, 55, 55],
            [65, 65, 73, 73, 82, 82, 65, 65],
            [73, 73, 92, 92, 110, 110, 73, 73],
            [78, 78, 98, 98, 116, 116, 78, 78],
            [49, 49, 55, 55, 65, 65, 49, 49],
        ]

        let step = 0
        let nextTime = ctx.currentTime + 0.8
        const BASE_TEMPO = 0.26

        const tick = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const speed = bgmSpeedRef.current || 1
            const world = bgmThemeRef.current || 0

            const pi = Math.min(Math.floor(world / 2), melodies.length - 1)
            const mel = melodies[pi]
            const chm = chimes[pi]
            const pad = padRoots[pi]
            const bas = bassNotes[pi]

            // Speed affects tempo + filter + chime volume
            const tempoScale = 0.80 + speed * 0.20
            const interval = BASE_TEMPO / tempoScale

            while (nextTime < audioCtxRef.current.currentTime + 1.0) {
                if (nextTime < audioCtxRef.current.currentTime - 0.5) {
                    nextTime = audioCtxRef.current.currentTime + 0.05
                    bgmGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    bgmGain.gain.setTargetAtTime(1.0, audioCtxRef.current.currentTime + 0.1, 0.4)
                    continue
                }

                const melNote = mel[step % mel.length]
                const chmNote = chm[step % chm.length]
                const padNote = pad[Math.floor(step / 8) % pad.length]
                const basNote = bas[Math.floor(step / 8) % bas.length]

                const beat4 = step % 4 === 0
                const beat8 = step % 8 === 0
                const bar = step % 64 === 0

                // Smooth glide — long portamento
                const glide = interval * 0.4

                // Melody — always playing, purely warm low-mid tones
                oscMelody.frequency.setTargetAtTime(melNote, nextTime, glide)

                // Chime — only on non-zero notes
                if (chmNote > 0) {
                    oscChime.frequency.setTargetAtTime(chmNote, nextTime, glide * 0.5)
                }

                // Pad — very slow movement
                oscPad1.frequency.setTargetAtTime(padNote, nextTime, glide * 5)
                oscPad2.frequency.setTargetAtTime(padNote * 1.498, nextTime, glide * 5)

                // Bass — deep and slow
                oscBass.frequency.setTargetAtTime(basNote, nextTime, glide * 3)

                // === PER-OSC VOLUME — world + speed reactive ===
                let mV = 0.012   // melody — quiet
                let cV = 0.003   // chime — barely there
                let pV = 0.010   // pad — warm bed
                let bV = 0.004   // bass — felt not heard

                if (world >= 2) { mV = 0.014; cV = 0.005; pV = 0.013; bV = 0.006 }
                if (world >= 4) { mV = 0.016; cV = 0.007; pV = 0.015; bV = 0.008 }
                if (world >= 6) { mV = 0.018; cV = 0.009; pV = 0.017; bV = 0.010 }
                if (world >= 8) { mV = 0.020; cV = 0.011; pV = 0.019; bV = 0.012 }

                // Speed adds subtle brightness — chime gets louder at high speed
                cV *= (0.7 + speed * 0.3)

                // Gentle breathing accent
                const accent = bar ? 1.06 : (beat8 ? 1.03 : (beat4 ? 1.0 : 0.96))

                gainMel.gain.setTargetAtTime(mV * accent, nextTime, 0.10)
                gainChm.gain.setTargetAtTime((chmNote > 0 ? cV : 0) * accent, nextTime, 0.10)
                gainPad.gain.setTargetAtTime(pV * accent, nextTime, 0.12)
                gainBas.gain.setTargetAtTime(bV * accent, nextTime, 0.12)

                // Filter — warm, opens slightly with world + speed
                const baseCut = 900 + world * 40 + speed * 30
                const beatCut = beat4 ? 60 : 0
                const barCut = bar ? 120 : 0
                bgmFilter.frequency.setTargetAtTime(
                    Math.min(baseCut + beatCut + barCut, 1600),
                    nextTime, 0.10
                )

                // Chime anti-whistle filter tracks similarly but stays low
                chimeFilter.frequency.setTargetAtTime(
                    Math.min(700 + world * 20, 900),
                    nextTime, 0.10
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
