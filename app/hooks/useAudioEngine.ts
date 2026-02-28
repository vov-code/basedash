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
    const fxNodeRef = useRef<GainNode | null>(null)
    const bgmOscRef = useRef<OscillatorNode | null>(null)
    const bgmGainRef = useRef<GainNode | null>(null)
    const bgmIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            audioCtxRef.current = new AudioContext()

            // Limiter compressor — keeps everything punchy without clipping
            const compressor = audioCtxRef.current.createDynamicsCompressor()
            compressor.threshold.value = -8
            compressor.knee.value = 6
            compressor.ratio.value = 8
            compressor.attack.value = 0.002
            compressor.release.value = 0.15
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.55
            masterGainRef.current.connect(compressor)

            // Tiny slapback delay — gives sounds character without echo
            fxNodeRef.current = audioCtxRef.current.createGain()
            fxNodeRef.current.gain.value = 0
            fxNodeRef.current.connect(masterGainRef.current)
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

    // === CORE TONE PLAYER (with offline cache) ===
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

        // Cache hit
        if (toneCacheRef.current.has(cacheKey)) {
            playBuffer(toneCacheRef.current.get(cacheKey)!)
            return
        }

        // Cache miss — render offline
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

        // Punchy chip-tune envelope: fast attack, shaped decay
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1.0, 0.008)     // 8ms attack — SNAPPY
        gain.gain.setValueAtTime(0.85, 0.008)              // tiny sustain dip
        gain.gain.exponentialRampToValueAtTime(0.001, dur)  // smooth tail

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + 0.1)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(err => console.error("Audio offline render failed", err))

    }, [soundEnabled, initAudio])

    // =====================================================================
    // SFX — ICONIC DEGEN SOUNDS (addictive, memorable, chip-tune with soul)
    // =====================================================================

    // JUMP — Rising "bwip!" (square wave chirp, very Geometry Dash)
    const sfxJump = useCallback(() => {
        playTone(280, 'square', 0.08, 0.08, 560)  // fast octave rise
    }, [playTone])

    // DOUBLE JUMP — Higher "bweeep!" (triangle harmonic, satisfying pitch shift)
    const sfxDoubleJump = useCallback(() => {
        playTone(420, 'square', 0.07, 0.1, 840)
        setTimeout(() => playTone(630, 'triangle', 0.04, 0.06), 30) // sparkle layer
    }, [playTone])

    // DASH — "Woooosh" swoosh (descending saw, feels fast)
    const sfxDash = useCallback(() => {
        playTone(300, 'sawtooth', 0.08, 0.12, 100)
    }, [playTone])

    // COLLECT — Iconic "ding-ding!" (two quick notes, instant dopamine)
    const sfxCollect = useCallback(() => {
        playTone(988, 'square', 0.06, 0.04)       // B5 high ping
        setTimeout(() => playTone(1319, 'square', 0.08, 0.08), 50)  // E6 resolution
    }, [playTone])

    // POWERUP — Ascending fanfare "do-re-mi-FA!" (gets you hyped)
    const sfxPowerup = useCallback(() => {
        const fanfare = [523, 659, 784, 1047] // C5-E5-G5-C6 major chord arpeggio
        fanfare.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'square', 0.06 + i * 0.02, 0.08 + i * 0.02), i * 40)
        })
    }, [playTone])

    // DEATH — "wah-wah-waaah" descending (sad trombone chip-tune, memorable)
    const sfxHit = useCallback(() => {
        playTone(440, 'square', 0.12, 0.12, 220)    // first drop
        setTimeout(() => playTone(330, 'square', 0.1, 0.15, 110), 120) // deeper drop
        setTimeout(() => playTone(165, 'sawtooth', 0.15, 0.4, 55), 250) // final bass groan
    }, [playTone])

    // SELECT — Quick "blip" (clean UI feedback)
    const sfxSelect = useCallback(() => {
        playTone(784, 'square', 0.05, 0.06, 1047)  // G5 to C6
    }, [playTone])

    // COMBO — Rising pentatonic scale (higher combo = higher pitch = more hype)
    const sfxCombo = useCallback((combo: number) => {
        // Pentatonic minor — sounds "degen" and eastern
        const scale = [262, 311, 349, 415, 466, 523, 622, 698, 831, 932, 1047]
        const note = scale[Math.min(combo, scale.length - 1)]
        playTone(note, 'square', 0.06, 0.06)
        setTimeout(() => playTone(note * 1.5, 'triangle', 0.05, 0.08), 35) // harmonic overlay
    }, [playTone])

    // MILESTONE — Victory jingle "da-da-da-DUM!" (sticks in your head)
    const sfxMilestone = useCallback(() => {
        const jingle = [
            { f: 523, d: 60 },   // C
            { f: 659, d: 60 },   // E
            { f: 784, d: 60 },   // G
            { f: 1047, d: 180 }, // C (high, held longer)
        ]
        let t = 0
        jingle.forEach(({ f, d }, i) => {
            setTimeout(() => playTone(f, 'square', 0.07 + i * 0.015, d / 1000 + 0.05), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Quick ascending arpeggio burst
    const sfxLevelUp = useCallback(() => {
        const burst = [262, 330, 392, 523, 659]
        burst.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'square', 0.06, 0.07), i * 35)
        })
    }, [playTone])

    // =====================================================================
    // BGM — HYPNOTIC DEGEN LO-FI ARPEGGIO (addictive loop)
    // =====================================================================
    // Minor key, fast 16th note pulse, slight detune for warmth
    // Inspired by: cookie clicker + geometry dash + crypto vibes

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmOscRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        // Two detuned oscillators for thick analog sound
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        osc1.type = 'square'
        osc2.type = 'sawtooth'
        osc2.detune.value = 7  // Subtle detune — analog warmth

        // Lo-pass filter — keeps it mellow and non-fatiguing
        filter.type = 'lowpass'
        filter.frequency.value = 1800
        filter.Q.value = 1.5

        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2) // Fade in over 2 seconds

        osc1.connect(filter)
        osc2.connect(filter)
        filter.connect(gain)
        gain.connect(master)

        osc1.start()
        osc2.start()

        bgmOscRef.current = osc1
        bgmGainRef.current = gain

        // === HYPNOTIC ARPEGGIO PATTERN ===
        // Am → F → C → G (classic degen loop, minor → resolved, very addictive)
        // Each chord as 4 ascending 16th-notes
        const pattern = [
            // Am chord: A C E A
            220.00, 261.63, 329.63, 440.00,
            // F chord: F A C F  
            174.61, 220.00, 261.63, 349.23,
            // C chord: C E G C
            261.63, 329.63, 392.00, 523.25,
            // Em chord: E G B E (darker resolution — more degen)
            164.81, 196.00, 246.94, 329.63,
        ]

        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.3

        // BPM ~140 = 16ths at 0.107s each (fast, hypnotic pulse)
        const NOTE_INTERVAL = 0.107

        const schedulePattern = () => {
            if (!bgmOscRef.current || !audioCtxRef.current) return

            while (nextNoteTime < audioCtxRef.current.currentTime + 0.5) {
                const note = pattern[noteIdx]

                osc1.frequency.setValueAtTime(note, nextNoteTime)
                osc2.frequency.setValueAtTime(note, nextNoteTime)

                // Envelope: plucky attack, clean decay (like a kalimba)
                gain.gain.setValueAtTime(0.01, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.065, nextNoteTime + 0.008)  // snap attack
                gain.gain.exponentialRampToValueAtTime(0.015, nextNoteTime + 0.09) // quick decay

                // Every 4th note (new chord) — accent slightly louder
                if (noteIdx % 4 === 0) {
                    gain.gain.linearRampToValueAtTime(0.08, nextNoteTime + 0.008)
                }

                noteIdx = (noteIdx + 1) % pattern.length
                nextNoteTime += NOTE_INTERVAL
            }
            bgmIntervalRef.current = setTimeout(schedulePattern, 180)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmOscRef.current && bgmGainRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmGainRef.current.gain.linearRampToValueAtTime(0, ct + 0.5)
            bgmOscRef.current.stop(ct + 0.6)
            bgmOscRef.current = null
            bgmGainRef.current = null
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
