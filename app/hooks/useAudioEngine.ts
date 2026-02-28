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
    const bgmNodesRef = useRef<{ oscs: OscillatorNode[], gain: GainNode } | null>(null)
    const bgmIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

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
    // SFX — UNIQUE DEGEN CRYPTO SOUNDS
    // =====================================================================

    // JUMP — "bwip!" rising chirp with harmonic
    const sfxJump = useCallback(() => {
        playTone(330, 'square', 0.06, 0.07, 660)
        playTone(660, 'sine', 0.02, 0.05, 990) // sparkle harmonic
    }, [playTone])

    // DOUBLE JUMP — Higher dual chirp "bweee-ip!"
    const sfxDoubleJump = useCallback(() => {
        playTone(440, 'square', 0.06, 0.08, 880)
        setTimeout(() => playTone(880, 'triangle', 0.03, 0.06, 1320), 25)
    }, [playTone])

    // DASH — Fast descending swoosh
    const sfxDash = useCallback(() => {
        playTone(350, 'sawtooth', 0.07, 0.1, 120)
    }, [playTone])

    // COLLECT — Iconic 2-note "ka-ching!" (crypto money sound)
    const sfxCollect = useCallback(() => {
        playTone(1047, 'square', 0.05, 0.04)       // C6 ping
        setTimeout(() => playTone(1319, 'triangle', 0.06, 0.08), 45) // E6 resolution
    }, [playTone])

    // POWERUP — Major arpeggio fanfare "do-mi-sol-DO!"
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 1047]
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'square', 0.05 + i * 0.015, 0.07 + i * 0.02), i * 40)
        })
    }, [playTone])

    // DEATH — Memorable 3-note descending "bwaa-bwa-bwaaaa" 
    const sfxHit = useCallback(() => {
        playTone(392, 'square', 0.1, 0.1, 220)
        setTimeout(() => playTone(294, 'square', 0.08, 0.12, 147), 110)
        setTimeout(() => playTone(165, 'sawtooth', 0.12, 0.35, 65), 230)
    }, [playTone])

    // SELECT — Quick "blip"
    const sfxSelect = useCallback(() => {
        playTone(784, 'square', 0.04, 0.05, 1047)
    }, [playTone])

    // COMBO — Rising pentatonic (higher combo = higher pitch)
    const sfxCombo = useCallback((combo: number) => {
        const scale = [262, 311, 349, 415, 466, 523, 622, 698, 831, 932, 1047]
        const note = scale[Math.min(combo, scale.length - 1)]
        playTone(note, 'square', 0.05, 0.05)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.03, 0.06), 30)
    }, [playTone])

    // MILESTONE — Victory jingle "da-da-da-DUM!"
    const sfxMilestone = useCallback(() => {
        const notes = [
            { f: 523, d: 55 }, { f: 659, d: 55 },
            { f: 784, d: 55 }, { f: 1047, d: 160 },
        ]
        let t = 0
        notes.forEach(({ f, d }, i) => {
            setTimeout(() => playTone(f, 'square', 0.06 + i * 0.01, d / 1000 + 0.04), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Quick ascending burst
    const sfxLevelUp = useCallback(() => {
        [262, 330, 392, 523, 659].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'square', 0.05, 0.06), i * 30)
        })
    }, [playTone])

    // =====================================================================
    // BGM — HYPNOTIC LO-FI CRYPTO ARPEGGIO
    // =====================================================================

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        // Two detuned oscillators for warm analog feel
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc1.type = 'square'
        osc2.type = 'triangle' // triangle instead of sawtooth = softer, less buzzy
        osc2.detune.value = 6

        filter.type = 'lowpass'
        filter.frequency.value = 1400 // lower cutoff = warmer, less harsh
        filter.Q.value = 1.0

        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5)

        osc1.connect(filter)
        osc2.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        osc1.start()
        osc2.start()

        // Store ALL oscillators so we can stop them ALL
        bgmNodesRef.current = { oscs: [osc1, osc2], gain }

        // 32-note arpeggio pattern across 8 chords
        const pattern = [
            // Am: A C E A
            220.00, 261.63, 329.63, 440.00,
            // F: F A C F  
            174.61, 220.00, 261.63, 349.23,
            // C: C E G C
            261.63, 329.63, 392.00, 523.25,
            // Em: E G B E
            164.81, 196.00, 246.94, 329.63,
            // Dm: D F A D
            146.83, 174.61, 220.00, 293.66,
            // G: G B D G
            196.00, 246.94, 293.66, 392.00,
            // Am (high): A C E A
            440.00, 523.25, 659.25, 880.00,
            // E: E G# B E (tension → resolve)
            164.81, 207.65, 246.94, 329.63,
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.3
        const NOTE_INTERVAL = 0.115 // ~130 BPM 16th notes

        const schedulePattern = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            while (nextNoteTime < audioCtxRef.current.currentTime + 0.5) {
                const note = pattern[noteIdx]

                osc1.frequency.setValueAtTime(note, nextNoteTime)
                osc2.frequency.setValueAtTime(note, nextNoteTime)

                // Plucky kalimba envelope
                gain.gain.setValueAtTime(0.008, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.045, nextNoteTime + 0.006)
                gain.gain.exponentialRampToValueAtTime(0.008, nextNoteTime + 0.08)

                // Accent every chord root (first of 4 notes)
                if (noteIdx % 4 === 0) {
                    gain.gain.linearRampToValueAtTime(0.06, nextNoteTime + 0.006)
                }

                noteIdx = (noteIdx + 1) % pattern.length
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, 180)
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
