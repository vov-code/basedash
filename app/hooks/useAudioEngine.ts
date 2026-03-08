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

        // Sidechain bus (very gentle pumping)
        const sidechainNode = ctx.createGain()
        sidechainNode.connect(bgmGain)

        // Drum bus 
        const drumGain = ctx.createGain()
        drumGain.connect(bgmGain)

        // Lush Delay/Reverb Bus for atmospheric space
        const leadGain = ctx.createGain()
        const delayNode = ctx.createDelay(2.0)
        const delayFeedback = ctx.createGain()
        const delayFilter = ctx.createBiquadFilter()

        delayNode.delayTime.value = TICK_INTERVAL * 6 // Dotted quarter note delay for huge space
        delayFeedback.gain.value = 0.45 // Long lush echoes
        delayFilter.type = 'lowpass'
        delayFilter.frequency.value = 1500 // Warm dark echoes

        leadGain.connect(sidechainNode)
        leadGain.connect(delayNode)
        delayNode.connect(delayFilter)
        delayFilter.connect(delayFeedback)
        delayFeedback.connect(delayNode)
        delayNode.connect(sidechainNode)

        // ==========================================
        // KEYBOARD SCALES & PROGRESSIONS (Lush, Emotional, Relaxing)
        // ==========================================
        // Using beautiful extended chords (Major 7ths, add9s) for a premium chill vibe
        const KEYS = [
            { base: 32.70, name: 'C Major 7', notes: [0, 2, 4, 7, 9, 11, 14] },   // C major (warm, pure)
            { base: 34.65, name: 'C# Minor 9', notes: [0, 2, 3, 7, 8, 10, 14] },  // C# minor (emotional, deep)
            { base: 41.20, name: 'E Lydian', notes: [0, 2, 4, 6, 7, 9, 11] },     // E Lydian (dreamy, floating)
            { base: 36.71, name: 'D Minor 7', notes: [0, 2, 3, 7, 9, 10, 14] },   // D minor (reflective)
            { base: 38.89, name: 'Eb Major 9', notes: [0, 2, 4, 7, 10, 11, 14] }  // Eb major (triumphant but soft)
        ]

        // ==========================================
        // SYNTHESIS ENGINES (Soft, Ambient, High Quality)
        // ==========================================

        /** 
         * Plays a deep, soft pulse kick (Lo-Fi / Chillwave style)
         */
        const playKick = (time: number, intensity: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'

            // Soft pitch envelope, no harsh click
            osc.frequency.setValueAtTime(80 * intensity, time)
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.1)
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4)

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(0.9 * intensity, time + 0.05) // Slower attack
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4)

            // Very gentle sidechain pumping for groove, not aggressive sucking
            sidechainNode.gain.setValueAtTime(0.3, time)
            sidechainNode.gain.exponentialRampToValueAtTime(1.0, time + 0.4)

            osc.connect(gain)
            gain.connect(drumGain)
            osc.start(time)
            osc.stop(time + 0.5)
        }

        /**
         * Plays a soft lo-fi clap / rimshot
         */
        const playSnare = (time: number, intensity: number) => {
            if (!noiseBufferRef.current) return

            // Body (Low pitched sine for weight)
            const osc = ctx.createOscillator()
            const oscGain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(300, time)
            osc.frequency.exponentialRampToValueAtTime(100, time + 0.1)

            oscGain.gain.setValueAtTime(0, time)
            oscGain.gain.linearRampToValueAtTime(0.4 * intensity, time + 0.01)
            oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15)

            // Tail (Filtered Noise)
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current
            const noiseFilter = ctx.createBiquadFilter()
            noiseFilter.type = 'bandpass'
            noiseFilter.frequency.value = 2500 // Soft midrange clap
            noiseFilter.Q.value = 1.5

            const noiseGain = ctx.createGain()
            noiseGain.gain.setValueAtTime(0, time)
            noiseGain.gain.linearRampToValueAtTime(0.5 * intensity, time + 0.02)
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.3)

            osc.connect(oscGain)
            oscGain.connect(drumGain)

            noise.connect(noiseFilter)
            noiseFilter.connect(noiseGain)
            noiseGain.connect(drumGain)

            osc.start(time)
            osc.stop(time + 0.2)
            noise.start(time)
            noise.stop(time + 0.35)
        }

        /**
         * Plays a delicate, airy hi-hat
         */
        const playHiHat = (time: number, type: 'closed' | 'open', intensity: number) => {
            if (!noiseBufferRef.current) return
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current

            const filter = ctx.createBiquadFilter()
            filter.type = 'highpass'
            filter.frequency.value = 8000 // Very high, whispering air

            const gain = ctx.createGain()
            const dur = type === 'open' ? 0.4 : 0.08

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(0.35 * intensity, time + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.01, time + dur)

            noise.connect(filter)
            filter.connect(gain)
            gain.connect(drumGain)

            noise.start(time)
            noise.stop(time + dur + 0.1)
        }

        /**
         * Lush Pad / Pluck Voice with Warm Filter Envelope
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
            const freq = baseKey * Math.pow(2, midiOffset / 12)
            osc.frequency.setValueAtTime(freq, time)

            filter.type = 'lowpass'
            // Very smooth, warm filter sweeps
            filter.frequency.setValueAtTime(filterStartFreq, time)
            filter.frequency.exponentialRampToValueAtTime(Math.max(200, filterStartFreq * 0.4), time + dur)

            gain.gain.setValueAtTime(0, time)

            // Slow, relaxing ADSR (Ambient style)
            const attack = dur > 1.0 ? 0.3 : (dur > 0.4 ? 0.1 : 0.03)
            gain.gain.linearRampToValueAtTime(vol, time + attack)
            gain.gain.setTargetAtTime(vol * 0.7, time + attack, 0.2) // Sustain
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur) // Long beautiful release

            osc.connect(filter)
            filter.connect(gain)
            gain.connect(isSidechain ? sidechainNode : leadGain)

            osc.start(time)
            // Add extra time to let the release tail ring out natively
            osc.stop(time + dur + 0.5)
        }

        // ==========================================
        // SONG SECTIONS & PATTERNS (Ambient & Harmonic 256-Step Matrix)
        // Highly melodic, non-repetitive, slowly evolving lush phrases.
        // ==========================================

        /** DRUMS: Lo-Fi/Chillhop grooves. Very spacious. */
        const PATTERN_DRUMS = [
            // 0: Deep Space Intro (Wind chimes & sparse hats, 64 steps loop)
            {
                k: Array(64).fill(0),
                s: Array(64).fill(0),
                hc: Array(64).fill(0).map((_, i) => i % 8 === 0 ? 0.4 : (i % 4 === 2 ? 0.2 : 0)),
                ho: Array(64).fill(0),
                cr: [0.6].concat(Array(63).fill(0))
            },
            // 1: Awakening (Gentle heartbeat kick, soft sidestick, 64 steps)
            {
                k: Array(64).fill(0).map((_, i) => (i % 16 === 0 || i % 16 === 10) ? 0.8 : 0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 0.5 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 0 ? 0.4 : 0),
                ho: Array(64).fill(0).map((_, i) => i % 16 === 14 ? 0.5 : 0),
                cr: [0].concat(Array(63).fill(0))
            },
            // 2: The Glide (Flowing Geometry Dash Chill wave, 128 steps)
            {
                k: Array(128).fill(0).map((_, i) => (i % 16 === 0 || i % 16 === 7 || i % 16 === 10) ? 0.9 : 0),
                s: Array(128).fill(0).map((_, i) => i % 8 === 4 ? 0.8 : 0),
                hc: Array(128).fill(0).map((_, i) => i % 2 === 0 ? 0.6 : (i % 16 === 13 || i % 16 === 15 ? 0.4 : 0)), // Bouncy hats
                ho: Array(128).fill(0).map((_, i) => i % 8 === 6 ? 0.6 : 0),
                cr: [0.8].concat(Array(63).fill(0)).concat([0.5]).concat(Array(63).fill(0))
            },
            // 3: Uplifting Flight (Continuous driving but soft beat, 64 steps)
            {
                k: Array(64).fill(0).map((_, i) => i % 4 === 0 ? 0.8 : 0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 0.8 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 1 ? 0.6 : 0), // Upbeats
                ho: Array(64).fill(0).map((_, i) => i % 8 === 6 ? 0.7 : 0),
                cr: [0.9].concat(Array(31).fill(0)).concat([0.7]).concat(Array(31).fill(0))
            }
        ]

        /** BASSLINES: Smooth sine and gentle triangle subs. (128 step patterns) */
        const PATTERN_BASS = [
            // 0: Deep Space Sub (Very long sustaining root notes)
            Array(128).fill(0).map((_, i) => i % 32 === 0 ? 12 : 0),
            // 1: Walking Sub (Slow groove)
            Array(128).fill(0).map((_, i) => {
                if (i % 32 === 0) return 12; if (i % 32 === 16) return 9; if (i % 32 === 24) return 7; return 0;
            }),
            // 2: The Glide Bass (Syncopated melodic bass line, highly musical)
            [12, 0, 0, 0, 0, 0, 12, 0, 0, 0, 16, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 9, 0, 0, 0, 4, 0, 0, 0, 0, 0].concat(
                [5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 9, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 7, 0, 0, 0, 14, 0, 0, 0, 0, 0]).concat(
                    [12, 0, 0, 0, 0, 0, 12, 0, 0, 0, 16, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 9, 0, 0, 0, 19, 0, 0, 0, 0, 0]).concat(
                        [5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 2, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 7, 0, 0, 0, 11, 0, 0, 0, 0, 0]),
            // 3: Driving Arp Bass (Continuous soft pulsing 8ths)
            Array(128).fill(0).map((_, i) => {
                const phase = Math.floor(i / 32) % 4
                const root = phase === 0 ? 12 : (phase === 1 ? 9 : (phase === 2 ? 5 : 7))
                return i % 4 === 0 ? root : (i % 4 === 2 ? root + 12 : 0) // Octave bouncing
            })
        ]

        /** CHORDS: Lush extended major/minor 7ths & 9ths. Long sustaining washes of sound. */
        const PATTERN_CHORDS = [
            // 0: Chill (Whole notes padding)
            Array(128).fill(null).map((_, i) => {
                // Majestic slow 4-chord journey: Imaj7 - vim7 - IVmaj7 - V9
                if (i === 0) return { n: [24, 28, 31, 35], d: 32 } // Extended warm pad length
                if (i === 32) return { n: [21, 24, 28, 31], d: 32 }
                if (i === 64) return { n: [17, 21, 24, 28], d: 32 }
                if (i === 96) return { n: [19, 23, 26, 31], d: 32 }
                return null
            }),
            // 1: Awakening (Gentle pulsing half-note chords)
            Array(128).fill(null).map((_, i) => {
                const phase = Math.floor(i / 32)
                const noteGroup = phase === 0 ? [24, 28, 31, 35] : (phase === 1 ? [21, 24, 28, 31] : (phase === 2 ? [17, 21, 24, 28] : [19, 23, 26, 31]))
                if (i % 8 === 0) return { n: noteGroup, d: 6 } // Breathing, pulsing pads
                return null
            }),
            // 2: The Glide (Flowing Geometry Dash beautiful chords, syncopated but soft)
            Array(128).fill(null).map((_, i) => {
                const phase = Math.floor(i / 32)
                const ng = phase === 0 ? [24, 28, 31, 35, 38] : (phase === 1 ? [21, 24, 28, 31, 35] : (phase === 2 ? [17, 21, 24, 28, 33] : [19, 23, 26, 31, 35]))
                // Very lush syncopated strums
                if (i % 16 === 0 || i % 16 === 6 || i % 16 === 10) return { n: ng, d: 4.5 }
                return null
            }),
            // 3: Uplifting Flight (Full continuous wall of beautiful sound)
            Array(128).fill(null).map((_, i) => {
                const chordNotes = i < 64 ? [24, 28, 31, 35] : [26, 29, 33, 36]
                if (i % 4 === 0) return { n: chordNotes, d: 3.8 } // Plucky but long release
                return null
            })
        ]

        /** MELODIC LEADS & ARPS (Beautiful dripping echoes). Octave 4/5/6 */
        const PATTERN_LEADS = [
            // 0: Deep Space (Piano-like sparse cascading notes)
            Array(128).fill(0).map((_, i) => {
                if (i === 0) return 48; if (i === 6) return 52; if (i === 12) return 55; if (i === 24) return 60;
                if (i === 32) return 45; if (i === 38) return 48; if (i === 44) return 52; if (i === 56) return 55;
                if (i === 64) return 41; if (i === 70) return 45; if (i === 76) return 48; if (i === 88) return 55;
                if (i === 96) return 43; if (i === 102) return 47; if (i === 108) return 50; if (i === 120) return 55;
                return 0
            }),
            // 1: Awakening (Cascading pentatonic waterfalls)
            Array(128).fill(0).map((_, i) => {
                const phrase = [48, 52, 55, 60, 52, 55, 60, 64]
                return i % 2 === 0 ? phrase[(i / 2) % phrase.length] : 0
            }),
            // 2: The Glide (Main addictive sweet melody, 128 steps of pure ear candy)
            [60, 0, 60, 55, 60, 0, 64, 0, 0, 0, 55, 0, 0, 0, 0, 0, 55, 0, 55, 52, 55, 0, 60, 0, 0, 0, 52, 0, 0, 0, 0, 0].concat(
                [52, 0, 52, 48, 52, 0, 55, 0, 0, 0, 48, 0, 0, 0, 0, 0, 55, 0, 50, 0, 48, 0, 50, 0, 47, 0, 45, 0, 0, 0, 0, 0]).concat(
                    [60, 0, 60, 55, 60, 0, 64, 0, 0, 0, 55, 0, 0, 0, 0, 0, 67, 0, 67, 64, 67, 0, 72, 0, 0, 0, 67, 0, 0, 0, 0, 0]).concat(
                        [72, 0, 72, 72, 71, 0, 71, 71, 67, 0, 67, 67, 64, 0, 64, 64, 60, 0, 60, 60, 55, 0, 55, 55, 52, 0, 48, 0]),
            // 3: Uplifting Flight (Hypnotic, euphoric fast arpeggio)
            Array(128).fill(0).map((_, i) => {
                const arp = [48, 55, 60, 64, 67, 64, 60, 55]
                return arp[i % arp.length] + (i > 64 ? 2 : 0) // Shift key up in second half
            })
        ]

        // ==========================================
        // SCHEDULER
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

            // 1. DRUMS (Soft, Acoustic-ish)
            const pDrum = PATTERN_DRUMS[intensity]
            if (pDrum.k[b64] > 0) playKick(time, pDrum.k[b64])
            if (pDrum.s[b64] > 0) playSnare(time, pDrum.s[b64])
            if (pDrum.hc[b64] > 0) playHiHat(time, 'closed', pDrum.hc[b64])
            if (pDrum.ho[b64] > 0) playHiHat(time, 'open', pDrum.ho[b64])
            if (pDrum.cr && pDrum.cr[b64] > 0) playHiHat(time, 'open', pDrum.cr[b64] * 1.5) // Splash

            // 2. BASS (Warm, floating sub)
            const pBass = PATTERN_BASS[intensity]
            const bassN = pBass[b128]
            if (bassN > 0) {
                // Gentle pulsing filter tone
                const filterFreq = 150 + Math.sin(time * 2) * 100
                // Sine + Triangle combo for warm tape-like bass
                playSynth(bassN - 12, 'sine', time, interval * 2, 0.45, filterFreq, true, 0, baseFreq)
                playSynth(bassN - 12, 'triangle', time, interval * 1.5, 0.3, filterFreq * 2, true, 5, baseFreq)
            }

            // 3. CHORDS / PADS (Super wide and beautiful)
            const pChord = PATTERN_CHORDS[intensity]
            const chord = pChord[b128]
            if (chord) {
                const dur = chord.d * interval
                chord.n.forEach(cn => {
                    // Soft triangles stacked to sound like a Rhodes Piano / Heaven Choir
                    playSynth(cn, 'triangle', time, dur, 0.08, 1200, true, -6, baseFreq)
                    playSynth(cn, 'sine', time, dur, 0.1, 800, true, 0, baseFreq)
                    playSynth(cn, 'triangle', time, dur, 0.08, 1200, true, 6, baseFreq)
                })
            }

            // 4. MELODIC LEAD / ARPS (Crystal Bells / Marimba sound)
            const pLead = PATTERN_LEADS[intensity]
            const leadN = pLead[b128]
            if (leadN > 0) {
                const dur = interval * 0.8 // Plucky, dripping sound
                // Sent to delay bus for beautiful echoing space
                playSynth(leadN, 'sine', time, dur, 0.2, 5000, false, 0, baseFreq)
                playSynth(leadN, 'triangle', time, dur, 0.15, 6000, false, 3, baseFreq)
            }

            // 5. FX / ATMOSPHERE
            // Wind sweeps every 64 beats instead of harsh crashes
            if (beatNumber > 0 && beatNumber % 64 === 0) {
                const fxOsc = ctx.createOscillator()
                const fxGain = ctx.createGain()
                fxOsc.type = 'sine'
                fxOsc.frequency.setValueAtTime(200, time)
                fxOsc.frequency.linearRampToValueAtTime(800, time + 2.0)
                fxGain.gain.setValueAtTime(0, time)
                fxGain.gain.linearRampToValueAtTime(0.15, time + 1.0)
                fxGain.gain.linearRampToValueAtTime(0.01, time + 3.0)

                // Add noise for texture
                if (noiseBufferRef.current) {
                    const noiseSrc = ctx.createBufferSource()
                    noiseSrc.buffer = noiseBufferRef.current
                    const windFilter = ctx.createBiquadFilter()
                    windFilter.type = 'lowpass'
                    windFilter.frequency.setValueAtTime(400, time)
                    windFilter.frequency.exponentialRampToValueAtTime(1500, time + 1.5)
                    windFilter.frequency.exponentialRampToValueAtTime(400, time + 3)
                    noiseSrc.connect(windFilter)
                    windFilter.connect(fxGain)
                    noiseSrc.start(time)
                    noiseSrc.stop(time + 3.5)
                }

                fxOsc.connect(fxGain)
                fxGain.connect(leadGain)
                fxOsc.start(time)
                fxOsc.stop(time + 3.5)
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
