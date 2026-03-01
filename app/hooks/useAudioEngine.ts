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
            compressor.threshold.value = -10
            compressor.knee.value = 8
            compressor.ratio.value = 6
            compressor.attack.value = 0.003
            compressor.release.value = 0.15
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.4
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

        // Punchy envelope
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1.0, 0.006)
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
    // SFX — MODERN RELAXING 'CRYSTAL/BUBBLE' AESTHETIC
    // =====================================================================

    // JUMP — Soft, resonant "bloop" (drop-like)
    const sfxJump = useCallback(() => {
        playTone(480, 'sine', 0.08, 0.12, 280) // Smooth drop
        playTone(960, 'sine', 0.02, 0.15)      // Tiny glass resonance
    }, [playTone])

    // DOUBLE JUMP — Higher, slightly faster double bloop
    const sfxDoubleJump = useCallback(() => {
        playTone(600, 'sine', 0.08, 0.12, 350)
        setTimeout(() => playTone(800, 'sine', 0.06, 0.1, 500), 40)
    }, [playTone])

    // DASH — Smooth wind sweep
    const sfxDash = useCallback(() => {
        playTone(220, 'triangle', 0.06, 0.18, 50)
    }, [playTone])

    // COLLECT — Distinctive glassy chime "tink-ling!"
    const sfxCollect = useCallback(() => {
        playTone(1318, 'sine', 0.04, 0.15)       // E6
        setTimeout(() => playTone(1567, 'sine', 0.05, 0.25), 60) // G6 with longer tail
    }, [playTone])

    // POWERUP — Gentle ascending celestial chord
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 1047] // C Major
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.06, 0.2 + i * 0.05), i * 45)
        })
    }, [playTone])

    // DEATH — Sad but gentle "power down" sweep, less harsh than chip-tune
    const sfxHit = useCallback(() => {
        playTone(330, 'triangle', 0.12, 0.5, 110) // Long E -> A drop
        setTimeout(() => playTone(220, 'sine', 0.08, 0.4, 55), 100)
    }, [playTone])

    // SELECT — Crystal tap
    const sfxSelect = useCallback(() => {
        playTone(1046, 'sine', 0.05, 0.08, 880)
    }, [playTone])

    // COMBO — Ethereal ascending scale
    const sfxCombo = useCallback((combo: number) => {
        const scale = [392, 440, 493, 523, 587, 659, 740, 784, 880, 987, 1046]
        const note = scale[Math.min(combo, scale.length - 1)]
        playTone(note, 'sine', 0.06, 0.18)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.03, 0.25), 40) // Harmonic tail
    }, [playTone])

    // MILESTONE — Relaxing victory chord
    const sfxMilestone = useCallback(() => {
        const notes = [
            { f: 523, d: 80 }, { f: 659, d: 80 },
            { f: 784, d: 80 }, { f: 1047, d: 250 },
        ]
        let t = 0
        notes.forEach(({ f, d }, i) => {
            setTimeout(() => playTone(f, 'sine', 0.07, d / 1000 + 0.1), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Smooth cascade
    const sfxLevelUp = useCallback(() => {
        [523, 659, 784, 1047, 1318].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.05, 0.15), i * 35)
        })
    }, [playTone])

    // =====================================================================
    // BGM — LUSH AMBIENT LO-FI ARPEGGIO
    // =====================================================================

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        // Soft, dreamy synth pads using dual sine/triangle layering
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc1.type = 'sine'      // Very smooth, no harsh harmonics
        osc2.type = 'triangle'  // Adds just enough timbre
        osc2.detune.value = 8   // Lush chorus effect

        filter.type = 'lowpass'
        filter.frequency.value = 1100 // Deep, muffled "underwater/lofi" tone
        filter.Q.value = 0.8

        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 3.0) // Long, slow fade in

        osc1.connect(filter)
        osc2.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        osc1.start()
        osc2.start()

        bgmNodesRef.current = { oscs: [osc1, osc2], gain }

        // === RELAXING JAZZ-HOP CHORD PROGRESSION ===
        // CMaj7 → Am9 → FMaj7 → G6 (lush, dreamy, emotional but calming)
        const pattern = [
            // CMaj7: C E G B (warm, floating)
            261.63, 329.63, 392.00, 493.88,
            // Am9: A C E B (slightly melancholic but resolved)
            220.00, 261.63, 329.63, 493.88,
            // FMaj7: F A C E (dreamy, expansive)
            174.61, 220.00, 261.63, 329.63,
            // G6: G B D E (smooth turnaround)
            196.00, 246.94, 293.66, 329.63,
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.5
        const BASE_INTERVAL = 0.28 // SLOW, relaxing tempo (~107 BPM 8th notes)

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            // Dynamically scale interval based on game speed (faster = shorter interval)
            // If speed multiplier is 1.5, music plays 1.5x faster
            const currentSpeed = bgmSpeedRef.current || 1
            const currentTheme = bgmThemeRef.current || 0

            const NOTE_INTERVAL = BASE_INTERVAL / currentSpeed

            while (nextNoteTime < audioCtxRef.current.currentTime + 0.8) {
                const note = pattern[noteIdx]

                // Dynamic variety based on world theme progression
                let freq1 = note
                let freq2 = note

                // 2nd World: Add upper octave sparkle to triangle wave every 2nd note
                if (currentTheme >= 1 && noteIdx % 2 === 0) freq2 = note * 2
                // 3rd World+: Add deep sub-bass to sine wave on chord roots
                if (currentTheme >= 2 && noteIdx % 4 === 0) freq1 = note / 2
                // 4th World+: Create a 5th harmony on the triangle wave off-beats
                if (currentTheme >= 3 && noteIdx % 2 !== 0) freq2 = note * 1.5

                osc1.frequency.setValueAtTime(freq1, nextNoteTime)
                osc2.frequency.setValueAtTime(freq2, nextNoteTime)

                // Soft bell-like envelope with long decay
                gain.gain.setValueAtTime(0.005, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.05, nextNoteTime + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.01, nextNoteTime + Math.max(0.1, 0.22 / currentSpeed))

                noteIdx = (noteIdx + 1) % pattern.length
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, NOTE_INTERVAL * 1000 * 0.7)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        // Stop ALL oscillators — this is the critical fix for the buzzing bug
        if (bgmNodesRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmNodesRef.current.gain.gain.cancelScheduledValues(ct)
            bgmNodesRef.current.gain.gain.setValueAtTime(bgmNodesRef.current.gain.gain.value, ct)
            bgmNodesRef.current.gain.gain.linearRampToValueAtTime(0, ct + 0.3)
            // Stop EVERY oscillator
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
