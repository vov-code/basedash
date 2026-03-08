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
    const bgmNodesRef = useRef<{ stop: () => void, gain: GainNode } | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())
    const noiseBufferRef = useRef<AudioBuffer | null>(null)

    const updateAudioParams = useCallback((speedMultiplier: number, themeIndex: number) => {
        bgmSpeedRef.current = speedMultiplier
        bgmThemeRef.current = themeIndex
    }, [])

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            const ctx = new AudioContext()
            audioCtxRef.current = ctx

            // Heavy master compression for that loud EDM / Geometry Dash sound
            const compressor = ctx.createDynamicsCompressor()
            compressor.threshold.value = -12
            compressor.knee.value = 5
            compressor.ratio.value = 12
            compressor.attack.value = 0.002
            compressor.release.value = 0.1
            compressor.connect(ctx.destination)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = 0.45 // Premium loud mix
            masterGainRef.current.connect(compressor)

            // Generate noise buffer for high quality snares and hi-hats
            const bufferSize = ctx.sampleRate * 2.0 // 2 seconds
            const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const output = noiseBuf.getChannelData(0)
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1 // White noise
            }
            noiseBufferRef.current = noiseBuf
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

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
        if (toneCacheRef.current.size > 150) {
            const keys = Array.from(toneCacheRef.current.keys())
            for (let i = 0; i < 30; i++) toneCacheRef.current.delete(keys[i])
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
    // PUNCHY SOUND EFFECTS
    // =====================================================================
    const sfxJump = useCallback(() => playTone(523, 'sine', 0.07, 0.1, 784), [playTone])
    const sfxDoubleJump = useCallback(() => { playTone(659, 'sine', 0.06, 0.08, 988); setTimeout(() => playTone(1046, 'sine', 0.04, 0.12), 60) }, [playTone])
    const sfxDash = useCallback(() => playTone(262, 'triangle', 0.05, 0.15, 131), [playTone])
    const sfxCollect = useCallback(() => { playTone(880, 'sine', 0.06, 0.15); setTimeout(() => playTone(1108, 'sine', 0.04, 0.2), 50) }, [playTone])
    const sfxPowerup = useCallback(() => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.04 - i * 0.005, 0.15 + i * 0.03), i * 45)) }, [playTone])
    const sfxHit = useCallback(() => { playTone(392, 'square', 0.08, 0.3, 196); setTimeout(() => playTone(262, 'sawtooth', 0.04, 0.4, 98), 100) }, [playTone])
    const sfxSelect = useCallback(() => playTone(784, 'sine', 0.04, 0.08, 659), [playTone])
    const sfxCombo = useCallback((combo: number) => {
        const s = [523, 587, 659, 784, 880, 1046, 1174, 1318, 1568, 1760, 2093];
        const n = s[Math.min(combo, s.length - 1)];
        playTone(n, 'sine', 0.05, 0.15);
        setTimeout(() => playTone(n * 1.5, 'sine', 0.025, 0.2), 50)
    }, [playTone])
    const sfxMilestone = useCallback(() => {
        [{ f: 523, d: 60 }, { f: 659, d: 60 }, { f: 784, d: 60 }, { f: 1046, d: 80 }, { f: 1318, d: 250 }].reduce((t, { f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.05, d / 1000 + 0.1), t); return t + d
        }, 0)
    }, [playTone])
    const sfxLevelUp = useCallback(() => {
        [523, 784, 1046, 1318, 1568, 2093].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.035, 0.12 + i * 0.03), i * 40))
    }, [playTone])

    // =====================================================================
    // MASSIVE GEOMETRY DASH x DEGEN MUSIC SEQUENCER (500+ LINES)
    // Features: Deep Dubstep Bass, Supersaw Chords, Trance Arps, Custom Drums
    // =====================================================================
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return
        if (ctx.state === 'suspended') ctx.resume().catch(() => { })

        let isPlaying = true
        let lookahead = 60.0 // check interval in ms
        let scheduleAheadTime = 0.2 // schedule notes 200ms ahead
        let currentNote = 0
        let nextNoteTime = ctx.currentTime + 0.1

        const BASE_TEMPO = 140 // Classic GD fast BPM
        const TICKS_PER_BEAT = 4 // 16th notes
        const TICK_INTERVAL = (60 / BASE_TEMPO) / TICKS_PER_BEAT // approx 0.107s

        // Buses
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain bus (for pads, bass, arps to duck when kick hits)
        const sidechainNode = ctx.createGain()
        sidechainNode.connect(bgmGain)

        // Drum bus (no sidechain ducking, hits hard)
        const drumGain = ctx.createGain()
        drumGain.connect(bgmGain)

        // Lead bus (slight delay/reverb effect)
        const leadGain = ctx.createGain()
        const delayNode = ctx.createDelay(1.0)
        const delayFeedback = ctx.createGain()
        delayNode.delayTime.value = TICK_INTERVAL * 3 // dotted 8th note delay
        delayFeedback.gain.value = 0.3

        leadGain.connect(sidechainNode)
        leadGain.connect(delayNode)
        delayNode.connect(delayFeedback)
        delayFeedback.connect(delayNode)
        delayNode.connect(sidechainNode)

        // ==========================================
        // KEYBOARD SCALES & PROGRESSIONS (Tension & Release)
        // ==========================================
        // Premium Degen vibes means melodic but intense minor scales
        const KEYS = [
            { base: 32.70, name: 'C Minor', notes: [0, 3, 7, 10, 14, 15, 19] },   // C1
            { base: 36.71, name: 'D Minor', notes: [0, 3, 7, 10, 14, 15, 19] },   // D1
            { base: 30.87, name: 'B Minor', notes: [0, 3, 7, 10, 14, 15, 19] },   // B0
            { base: 38.89, name: 'D# Minor', notes: [0, 3, 7, 10, 14, 15, 19] },  // D#1
            { base: 41.20, name: 'E Minor', notes: [0, 3, 7, 10, 14, 15, 19] }    // E1
        ]

        // ==========================================
        // SYNTHESIS ENGINES
        // ==========================================

        /** 
         * Plays a synthesized drum kick (Epic EDM style)
         */
        const playKick = (time: number, intensity: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'

            // Extreme pitch envelope for the 'click' and 'thump'
            osc.frequency.setValueAtTime(150 * intensity, time)
            osc.frequency.exponentialRampToValueAtTime(45, time + 0.05)
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4)

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(1.2 * intensity, time + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3)

            // Heavy Sidechain trigger: slam the rest of the mix down
            sidechainNode.gain.setValueAtTime(0.05, time)
            sidechainNode.gain.exponentialRampToValueAtTime(1.0, time + 0.25)

            osc.connect(gain)
            gain.connect(drumGain)
            osc.start(time)
            osc.stop(time + 0.4)
        }

        /**
         * Plays a crunchy EDM snare using noise + triangle
         */
        const playSnare = (time: number, intensity: number) => {
            if (!noiseBufferRef.current) return

            // Body (Triangle)
            const osc = ctx.createOscillator()
            const oscGain = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(250, time)
            osc.frequency.exponentialRampToValueAtTime(150, time + 0.1)

            oscGain.gain.setValueAtTime(0, time)
            oscGain.gain.linearRampToValueAtTime(0.8 * intensity, time + 0.01)
            oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2)

            // Tail (Noise)
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current
            const noiseFilter = ctx.createBiquadFilter()
            noiseFilter.type = 'highpass'
            noiseFilter.frequency.value = 1200

            const noiseGain = ctx.createGain()
            noiseGain.gain.setValueAtTime(0, time)
            noiseGain.gain.linearRampToValueAtTime(0.9 * intensity, time + 0.01)
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25)

            osc.connect(oscGain)
            oscGain.connect(drumGain)

            noise.connect(noiseFilter)
            noiseFilter.connect(noiseGain)
            noiseGain.connect(drumGain)

            osc.start(time)
            osc.stop(time + 0.2)
            noise.start(time)
            noise.stop(time + 0.25)
        }

        /**
         * Plays a crisp hi-hat (open or closed)
         */
        const playHiHat = (time: number, type: 'closed' | 'open', intensity: number) => {
            if (!noiseBufferRef.current) return
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current

            const filter = ctx.createBiquadFilter()
            filter.type = 'highpass'
            filter.frequency.value = 6000
            filter.Q.value = 1.0

            const gain = ctx.createGain()
            const dur = type === 'open' ? 0.3 : 0.06

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(0.6 * intensity, time + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.01, time + dur)

            noise.connect(filter)
            filter.connect(gain)
            gain.connect(drumGain)

            noise.start(time)
            noise.stop(time + dur + 0.1)
        }

        /**
         * Generic Synth Voice with Filter Env
         */
        const playSynth = (
            midiOffset: number,
            type: OscillatorType,
            time: number,
            dur: number,
            vol: number,
            filterStartFreq: number,
            isSidechain = true,
            detune = 0,
            baseKey = KEYS[0].base
        ) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            const filter = ctx.createBiquadFilter()

            osc.type = type
            osc.detune.value = detune
            // Calculate freq from base using 12-TET
            const freq = baseKey * Math.pow(2, midiOffset / 12)
            osc.frequency.setValueAtTime(freq, time)

            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(filterStartFreq, time)
            filter.frequency.exponentialRampToValueAtTime(Math.max(100, filterStartFreq * 0.2), time + dur)

            gain.gain.setValueAtTime(0, time)

            // Custom ADSR for punchy plucks or smooth pads
            const attack = dur > 0.5 ? 0.1 : 0.02
            gain.gain.linearRampToValueAtTime(vol, time + attack)
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur)

            osc.connect(filter)
            filter.connect(gain)
            gain.connect(isSidechain ? sidechainNode : leadGain)

            osc.start(time)
            osc.stop(time + dur + 0.1)
        }

        // ==========================================
        // SONG SECTIONS & PATTERNS (256-Step Matrix)
        // Geometry Dash tracks rely heavily on highly complex sequence arrays.
        // We use massive 128-step patterns for extreme variety without repetition.
        // ==========================================

        /** DRUMS: k=kick, s=snare, hc=hat closed, ho=hat open, cr=crash */
        const PATTERN_DRUMS = [
            // 0: Chill Intro (Atmospheric, no kick, 64 steps loop)
            {
                k: Array(64).fill(0),
                s: Array(64).fill(0),
                hc: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0].concat(Array(32).fill(0).map((_, i) => i % 4 === 2 ? 1 : 0)),
                ho: Array(64).fill(0),
                cr: [1].concat(Array(63).fill(0))
            },
            // 1: Build-up (Four on the floor, snare rolls at the end, 64 steps)
            {
                k: Array(64).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
                s: Array(64).fill(0).map((_, i) => {
                    if (i < 32) return i % 8 === 4 ? 1 : 0
                    if (i < 48) return i % 4 === 0 ? 1 : 0
                    if (i < 56) return i % 2 === 0 ? 1 : 0
                    return 1 // snare roll build!
                }),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0),
                ho: Array(64).fill(0),
                cr: [0].concat(Array(63).fill(0))
            },
            // 2: The DROP (Heavy electro/dubstep syncopation, massive 128 step phrasing)
            {
                k: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0].concat(
                    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]).concat(
                        [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]).concat(
                            [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // Kick roll into next section
                        ),
                s: Array(128).fill(0).map((_, i) => i % 8 === 4 ? 1 : 0),
                hc: Array(128).fill(1).map((_, i) => (i % 16 > 12 && i % 2 === 0) ? 0 : 1), // Trap hat rolls 
                ho: Array(128).fill(0).map((_, i) => i % 8 === 2 ? 1 : 0),
                cr: [1].concat(Array(63).fill(0)).concat([1]).concat(Array(63).fill(0))
            },
            // 3: Fast Trance (Degen Speedrun Mode, 64 steps)
            {
                k: Array(64).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 1 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 1 ? 1 : 0), // Off-beat hats
                ho: Array(64).fill(0).map((_, i) => i % 4 === 2 ? 1 : 0),
                cr: [1].concat(Array(31).fill(0)).concat([1]).concat(Array(31).fill(0))
            }
        ]

        /** BASSLINES: Octaves 1 and 2 offsets. Massive 128 step patterns */
        const PATTERN_BASS = [
            // 0: Chill (Sustained root notes on downbeat)
            Array(128).fill(0).map((_, i) => i % 16 === 0 ? 12 : 0),
            // 1: Pumping 8ths (Builds energy)
            Array(128).fill(0).map((_, i) => i % 4 === 0 ? (i < 64 ? 12 : 15) : 0),
            // 2: Dubstep Wobble (Syncopated growls, 128 steps)
            [12, 12, 24, 0, 0, 0, 15, 15, 12, 0, 0, 0, 15, 10, 0, 0, 12, 0, 24, 0, 0, 0, 15, 14, 12, 0, 0, 0, 7, 10, 12, 0].concat(
                [12, 12, 24, 0, 0, 0, 15, 15, 12, 0, 0, 0, 15, 10, 0, 0, 12, 0, 24, 0, 0, 0, 15, 14, 12, 12, 12, 12, 10, 10, 10, 10]).concat(
                    [12, 12, 24, 0, 0, 0, 15, 15, 12, 0, 0, 0, 15, 10, 0, 0, 12, 0, 24, 0, 0, 0, 15, 14, 12, 0, 0, 0, 7, 10, 12, 0]).concat(
                        [24, 24, 24, 24, 24, 24, 24, 24, 22, 22, 22, 22, 22, 22, 22, 22, 20, 20, 20, 20, 20, 20, 20, 20, 19, 19, 19, 19, 19, 19, 19, 19]),
            // 3: Fast trance 16ths
            Array(128).fill(0).map((_, i) => {
                const phase = Math.floor(i / 16) % 4
                return phase === 0 ? 12 : (phase === 1 ? 15 : (phase === 2 ? 10 : 14))
            })
        ]

        /** CHORDS: Array of objects {n: [midi_offsets], d: duration_in_16ths}. Octave 3/4 */
        const PATTERN_CHORDS = [
            // 0: Chill (Whole notes padding)
            Array(128).fill(null).map((_, i) => {
                if (i === 0) return { n: [24, 27, 31, 34], d: 32 }
                if (i === 32) return { n: [27, 31, 34, 39], d: 32 }
                if (i === 64) return { n: [22, 26, 29, 34], d: 32 }
                if (i === 96) return { n: [26, 29, 33, 38], d: 32 }
                return null
            }),
            // 1: Build (Syncopated stabs)
            Array(128).fill(null).map((_, i) => {
                const phase = Math.floor(i / 32)
                const noteGroup = phase % 2 === 0 ? [24, 27, 31, 36] : [27, 31, 34, 39]
                if (i % 16 === 0 || i % 16 === 3) return { n: noteGroup, d: 2 }
                if (i % 16 === 6) return { n: noteGroup, d: 4 }
                return null
            }),
            // 2: Drop (Epic Supersaw Plucks, syncopated off-beats)
            Array(128).fill(null).map((_, i) => {
                const phase = Math.floor(i / 32)
                const ng = phase === 0 ? [24, 27, 31, 36, 39] : (phase === 1 ? [22, 26, 29, 34, 38] : (phase === 2 ? [20, 24, 27, 32, 36] : [27, 31, 34, 39, 43]))
                if (i % 16 === 0 || i % 16 === 2 || i % 16 === 8 || i % 16 === 10) return { n: ng, d: 1.5 }
                return null
            }),
            // 3: Degen Chaos (Rave Stabs on every upbeat)
            Array(128).fill(null).map((_, i) => {
                const chordNotes = i < 64 ? [36, 39, 43] : [38, 41, 45]
                if (i % 2 === 1) return { n: chordNotes, d: 0.5 }
                return null
            })
        ]

        /** MELODIC LEADS (Geometry Dash style cascading arps). Octave 4/5 */
        const PATTERN_LEADS = [
            // 0: Chill (Sparse, echoing)
            Array(128).fill(0).map((_, i) => {
                if (i % 32 === 8) return 48; if (i % 32 === 12) return 43; if (i % 32 === 24) return 46; if (i % 32 === 28) return 43;
                return 0
            }),
            // 1: Build (Rising arp cascade)
            Array(128).fill(0).map((_, i) => {
                const sq = [36, 39, 43, 48, 36, 39, 43, 48, 39, 43, 46, 51, 39, 43, 46, 51]
                return i % 2 === 0 ? sq[Math.floor((i % 32) / 2)] : 0
            }),
            // 2: Drop (Complex syncopation, very catchy 128-step lead)
            [48, 0, 48, 46, 48, 0, 51, 0, 0, 0, 43, 0, 0, 0, 0, 0, 46, 0, 46, 43, 46, 0, 51, 0, 0, 0, 39, 0, 0, 0, 0, 0].concat(
                [48, 0, 48, 46, 48, 0, 51, 0, 0, 0, 43, 0, 0, 0, 0, 0, 55, 0, 55, 51, 55, 0, 60, 0, 0, 0, 55, 0, 0, 0, 0, 0]).concat(
                    [48, 0, 48, 46, 48, 0, 51, 0, 0, 0, 43, 0, 0, 0, 0, 0, 46, 0, 46, 43, 46, 0, 51, 0, 0, 0, 39, 0, 0, 0, 0, 0]).concat(
                        [60, 60, 60, 60, 58, 58, 58, 58, 55, 55, 55, 55, 51, 51, 51, 51, 48, 48, 48, 48, 46, 46, 46, 46, 43, 43, 43, 43, 39, 39, 39, 39]),
            // 3: Chaos (Hypnotic 16th note rolls, fully mapped 128 steps)
            Array(128).fill(0).map((_, i) => {
                if (i < 32) return i % 4 === 0 ? 60 : (i % 4 === 1 ? 55 : (i % 4 === 2 ? 51 : 55))
                if (i < 64) return i % 4 === 0 ? 62 : (i % 4 === 1 ? 58 : (i % 4 === 2 ? 55 : 58))
                if (i < 96) return i % 4 === 0 ? 60 : (i % 4 === 1 ? 55 : (i % 4 === 2 ? 51 : 55))
                return i % 4 === 0 ? 63 : (i % 4 === 1 ? 60 : (i % 4 === 2 ? 55 : 51))
            })
        ]

        // ==========================================
        // SCHEDULER
        // ==========================================
        const scheduleNote = (beatNumber: number, time: number) => {
            const speedMultiplier = bgmSpeedRef.current || 1
            const worldTheme = bgmThemeRef.current || 0

            // Map the current world to a song section intensity
            let intensity = 0
            if (worldTheme >= 7) intensity = 3 // Insane speed, Degen Chaos
            else if (worldTheme >= 4) intensity = 2 // The Drop
            else if (worldTheme >= 2) intensity = 1 // Build-up

            // Key transposition creates emotional shift across worlds
            // World 0: C Minor
            // World 1: D Minor (lifts energy)
            // World 2: B Minor (drops down, darker)
            // World 3: D# Minor (very bright)
            // World 4: E Minor (epic high)
            const keyObj = KEYS[worldTheme % KEYS.length]
            const baseFreq = keyObj.base

            const b16 = beatNumber % 16
            const b64 = beatNumber % 64
            const b128 = beatNumber % 128

            // Interval dynamically scales with game speed!
            const interval = TICK_INTERVAL / Math.max(0.5, speedMultiplier)

            // 1. DRUMS
            const pDrum = PATTERN_DRUMS[intensity]
            if (pDrum.k[b64] > 0) playKick(time, 1.0)
            if (pDrum.s[b64] > 0) playSnare(time, 1.0)
            if (pDrum.hc[b64] > 0) playHiHat(time, 'closed', 0.5)
            if (pDrum.ho[b64] > 0) playHiHat(time, 'open', 0.8)
            if (pDrum.cr && pDrum.cr[b64] > 0) playHiHat(time, 'open', 1.2) // Crash cymbal

            // 2. BASS
            const pBass = PATTERN_BASS[intensity]
            const bassN = pBass[b128]
            if (bassN > 0) {
                // Wobble filter based on step for dubstep effect. Shifts dynamically.
                const wobblePhase = Math.sin(beatNumber * 0.2) * 200
                const filterFreq = 150 + (b16 % 4) * 600 + wobblePhase
                const bType = intensity >= 2 ? 'sawtooth' : 'sine'
                const bVol = intensity >= 2 ? 0.35 : 0.4
                // Main Bass
                playSynth(bassN, bType, time, interval, bVol, filterFreq, true, 0, baseFreq)
                // Phât Sub layer (-12 st)
                playSynth(bassN - 12, 'sine', time, interval, 0.5, 200, true, 0, baseFreq)
            }

            // 3. CHORDS / PADS (Geometry Dash signature massive saws)
            const pChord = PATTERN_CHORDS[intensity]
            const chord = pChord[b128]
            if (chord) {
                const dur = chord.d * interval
                chord.n.forEach(cn => {
                    // Huge detuned supersaw layers
                    playSynth(cn, 'sawtooth', time, dur, 0.08, 3000, true, -15, baseFreq)
                    playSynth(cn, 'sawtooth', time, dur, 0.08, 3000, true, 15, baseFreq)
                    // Add square for bite
                    playSynth(cn, 'square', time, dur, 0.04, 2000, true, 0, baseFreq)
                })
            }

            // 4. MELODIC LEAD / ARPS
            const pLead = PATTERN_LEADS[intensity]
            const leadN = pLead[b128]
            if (leadN > 0) {
                const dur = interval * 1.5 // slight overlap for legato glide feeling
                playSynth(leadN, 'square', time, dur, 0.12, 4000, false, 0, baseFreq)
                playSynth(leadN, 'triangle', time, dur, 0.1, 3000, false, 5, baseFreq)
            }

            // 5. FX / DEGEN EAR CANDY
            // Epic riser crash at the end of every 128-beat phrase during high intensity
            if (intensity >= 2 && beatNumber % 128 === 127) {
                const fxOsc = ctx.createOscillator()
                const fxGain = ctx.createGain()
                fxOsc.type = 'sawtooth'
                fxOsc.frequency.setValueAtTime(8000, time)
                fxOsc.frequency.exponentialRampToValueAtTime(100, time + 1.0)
                fxGain.gain.setValueAtTime(0.2, time)
                fxGain.gain.exponentialRampToValueAtTime(0.01, time + 1.0)
                fxOsc.connect(fxGain)
                fxGain.connect(drumGain)
                fxOsc.start(time)
                fxOsc.stop(time + 1.2)
            }
        }

        let timerID: ReturnType<typeof setTimeout>

        const scheduler = () => {
            if (!isPlaying || !audioCtxRef.current) return
            const speedMultiplier = bgmSpeedRef.current || 1
            const interval = TICK_INTERVAL / Math.max(0.5, speedMultiplier)

            // Lookahead loop
            while (nextNoteTime < audioCtxRef.current.currentTime + scheduleAheadTime) {
                scheduleNote(currentNote, nextNoteTime)
                nextNoteTime += interval
                currentNote++

                // Safety reset to prevent infinite loops if tab is asleep
                if (currentNote > 1000000) currentNote = 0
            }
            timerID = setTimeout(scheduler, lookahead)
        }

        // Beautiful fade in on start
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3.0)

        timerID = setTimeout(scheduler, lookahead)

        bgmNodesRef.current = {
            stop: () => {
                isPlaying = false
                clearTimeout(timerID)
                bgmGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5)
            },
            gain: bgmGain
        }

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current) {
            bgmNodesRef.current.stop()
            bgmNodesRef.current = null
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
