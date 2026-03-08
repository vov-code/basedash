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
        // KEYBOARD SCALES & PROGRESSIONS (Clean, Euphoric, Catchy)
        // ==========================================
        // Using the universally loved vi - IV - I - V emotional progression (e.g. F minor / Ab Major)
        const KEYS = [
            { base: 34.65, name: 'C# Minor', notes: [0, 3, 7, 8, 10, 15] },       // Level 1-2 (Moody)
            { base: 38.89, name: 'D# Minor', notes: [0, 3, 7, 8, 10, 15] },       // Level 3-4 (Lifting)
            { base: 43.65, name: 'F Minor', notes: [0, 3, 7, 8, 10, 15] },        // Level 5-6 (Emotional Drop)
            { base: 41.20, name: 'E Minor', notes: [0, 3, 7, 8, 10, 15] },        // Level 7+ (Darker push)
        ]

        // ==========================================
        // SYNTHESIS ENGINES (Clean EDM, Highly Polished)
        // ==========================================

        /** 
         * Plays a punchy EDM kick
         */
        const playKick = (time: number, intensity: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'

            // Punchy pitch drop
            osc.frequency.setValueAtTime(120 * intensity, time)
            osc.frequency.exponentialRampToValueAtTime(45, time + 0.05)
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3)

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(1.0 * intensity, time + 0.01) // Fast attack
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3)

            // Clean sidechain pumping (Ducking)
            sidechainNode.gain.setValueAtTime(0.1, time)
            sidechainNode.gain.linearRampToValueAtTime(1.0, time + 0.25)

            osc.connect(gain)
            gain.connect(drumGain)
            osc.start(time)
            osc.stop(time + 0.4)
        }

        /**
         * Plays a tight progressive house snare/clap
         */
        const playSnare = (time: number, intensity: number) => {
            if (!noiseBufferRef.current) return

            // Body
            const osc = ctx.createOscillator()
            const oscGain = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(250, time)
            osc.frequency.exponentialRampToValueAtTime(150, time + 0.1)

            oscGain.gain.setValueAtTime(0, time)
            oscGain.gain.linearRampToValueAtTime(0.6 * intensity, time + 0.01)
            oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15)

            // Tail (Filtered Noise)
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current
            const noiseFilter = ctx.createBiquadFilter()
            noiseFilter.type = 'highpass'
            noiseFilter.frequency.value = 1500

            const noiseGain = ctx.createGain()
            noiseGain.gain.setValueAtTime(0, time)
            noiseGain.gain.linearRampToValueAtTime(0.8 * intensity, time + 0.01)
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2)

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
         * Plays a crisp hi-hat
         */
        const playHiHat = (time: number, type: 'closed' | 'open', intensity: number) => {
            if (!noiseBufferRef.current) return
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current

            const filter = ctx.createBiquadFilter()
            filter.type = 'highpass'
            filter.frequency.value = 7000

            const gain = ctx.createGain()
            const dur = type === 'open' ? 0.25 : 0.05

            gain.gain.setValueAtTime(0, time)
            gain.gain.linearRampToValueAtTime(0.4 * intensity, time + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.01, time + dur)

            noise.connect(filter)
            filter.connect(gain)
            gain.connect(drumGain)

            noise.start(time)
            noise.stop(time + dur + 0.1)
        }

        /**
         * Clean Synth Voice (no dissonance)
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
            filter.frequency.setValueAtTime(filterStartFreq, time)
            filter.frequency.exponentialRampToValueAtTime(Math.max(300, filterStartFreq * 0.3), time + dur)

            gain.gain.setValueAtTime(0, time)
            const attack = dur > 0.5 ? 0.05 : 0.02
            gain.gain.linearRampToValueAtTime(vol, time + attack)
            gain.gain.setTargetAtTime(vol * 0.8, time + attack, 0.1)
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur)

            osc.connect(filter)
            filter.connect(gain)
            gain.connect(isSidechain ? sidechainNode : leadGain)

            osc.start(time)
            osc.stop(time + dur + 0.1)
        }

        // ==========================================
        // SONG SECTIONS & PATTERNS (128-Step Matrix)
        // Clean, pleasant, continuous progression (no weird gaps)
        // ==========================================

        const PATTERN_DRUMS = [
            // 0: Intro (Just house claps/hats, no kick yet)
            {
                k: Array(64).fill(0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 0.6 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 0 ? 0.5 : 0),
                ho: Array(64).fill(0),
                cr: [0.8].concat(Array(63).fill(0))
            },
            // 1: Build (Adding the kick, rhythmic pulse)
            {
                k: Array(64).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 0.8 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 1 ? 0.6 : 0), // Upbeats
                ho: Array(64).fill(0).map((_, i) => i % 4 === 2 ? 0.5 : 0),
                cr: [0].concat(Array(63).fill(0))
            },
            // 2: Drop (Classic Progressive EDM, full beat)
            {
                k: Array(128).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
                s: Array(128).fill(0).map((_, i) => i % 8 === 4 ? 1 : 0),
                hc: Array(128).fill(0).map((_, i) => i % 2 === 1 ? 0.7 : 0),
                ho: Array(128).fill(0).map((_, i) => i % 4 === 2 ? 0.8 : 0),
                cr: [1.0].concat(Array(63).fill(0)).concat([0.8]).concat(Array(63).fill(0))
            },
            // 3: Fast Trance (Driving 16ths in hats)
            {
                k: Array(64).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
                s: Array(64).fill(0).map((_, i) => i % 8 === 4 ? 1 : 0),
                hc: Array(64).fill(0).map((_, i) => i % 2 === 0 ? 0.5 : 0.8), // Driving trance hats
                ho: Array(64).fill(0).map((_, i) => i % 4 === 2 ? 0.8 : 0),
                cr: [1.0].concat(Array(31).fill(0)).concat([1.0]).concat(Array(31).fill(0))
            }
        ]

        /** BASSLINES: Strictly follow the chord root notes to prevent dissonance. */
        const PATTERN_BASS = [
            // Roots for the 128-step progression: [12, 7, 3, 10]
            Array(128).fill(0).map((_, i) => i % 32 === 0 ? (Math.floor(i / 32) === 0 ? 12 : Math.floor(i / 32) === 1 ? 7 : Math.floor(i / 32) === 2 ? 3 : 10) : 0),

            Array(128).fill(0).map((_, i) => i % 8 === 0 ? (Math.floor(i / 32) === 0 ? 12 : Math.floor(i / 32) === 1 ? 7 : Math.floor(i / 32) === 2 ? 3 : 10) : 0),

            // Drop bass (Pumping offbeats)
            Array(128).fill(0).map((_, i) => {
                const root = (Math.floor(i / 32) === 0 ? 12 : Math.floor(i / 32) === 1 ? 7 : Math.floor(i / 32) === 2 ? 3 : 10)
                return i % 4 === 0 ? root : (i % 4 === 2 ? root + 12 : 0) // Classic octave bounce
            }),

            // Fast trance rolling bass
            Array(128).fill(0).map((_, i) => {
                const root = (Math.floor(i / 32) === 0 ? 12 : Math.floor(i / 32) === 1 ? 7 : Math.floor(i / 32) === 2 ? 3 : 10)
                return i % 4 !== 0 ? root : 0 // Bass on 16ths, ducking the kick on the downbeat
            })
        ]

        /** CHORDS: Extremely clean, consonant triads. Epic Geometry Dash Supersaws. */
        const PATTERN_CHORDS = [
            // Emotionally resonant vi - IV - I - V progression
            // Array indices: 0-31 (vi), 32-63 (IV), 64-95 (I), 96-127 (V)
            Array(128).fill(null).map((_, i) => {
                if (i === 0) return { n: [12, 19, 24], d: 32 }    // vi (e.g., C#m)
                if (i === 32) return { n: [7, 15, 19], d: 32 }     // IV (e.g., A)
                if (i === 64) return { n: [3, 10, 15], d: 32 }     // I  (e.g., E)
                if (i === 96) return { n: [10, 14, 22], d: 32 }    // V  (e.g., B)
                return null
            }),
            Array(128).fill(null).map((_, i) => {
                const rootGroup = Math.floor(i / 32)
                const group = rootGroup === 0 ? [12, 19, 24] : rootGroup === 1 ? [7, 15, 19] : rootGroup === 2 ? [3, 10, 15] : [10, 14, 22]
                if (i % 8 === 0) return { n: group, d: 4.5 } // Staccato stabs
                return null
            }),
            Array(128).fill(null).map((_, i) => {
                const rootGroup = Math.floor(i / 32)
                const group = rootGroup === 0 ? [12, 19, 24, 28] : rootGroup === 1 ? [7, 15, 19, 24] : rootGroup === 2 ? [3, 10, 15, 19] : [10, 14, 19, 22]
                // Epic syncopated rhythm
                if (i % 16 === 0 || i % 16 === 6 || i % 16 === 10) return { n: group, d: 3.5 }
                return null
            }),
            Array(128).fill(null).map((_, i) => {
                const rootGroup = Math.floor(i / 32)
                const group = rootGroup === 0 ? [12, 19, 24] : rootGroup === 1 ? [7, 15, 19] : rootGroup === 2 ? [3, 10, 15] : [10, 14, 22]
                if (i % 4 === 0) return { n: group, d: 3 } // Pumping 8ths
                return null
            })
        ]

        /** MELODIC LEADS & ARPS: Simple, strictly pentatonic and catchy. */
        const PATTERN_LEADS = [
            // 0: Plucky clean echoes
            Array(128).fill(0).map((_, i) => {
                if (i === 0) return 36; if (i === 12) return 43; if (i === 24) return 48;
                if (i === 32) return 31; if (i === 44) return 38; if (i === 56) return 43;
                if (i === 64) return 27; if (i === 76) return 34; if (i === 88) return 39;
                if (i === 96) return 34; if (i === 108) return 41; if (i === 120) return 46;
                return 0
            }),
            // 1: Building Arp
            Array(128).fill(0).map((_, i) => {
                const arp = [36, 43, 48, 55, 31, 38, 43, 50, 27, 34, 39, 46, 34, 41, 46, 53]
                return i % 2 === 0 ? arp[Math.floor((i % 32) / 2)] : 0
            }),
            // 2: Very catchy, universally pleasant lead melody (Avicii / GD style)
            [48, 0, 0, 48, 0, 0, 51, 0, 0, 0, 43, 0, 46, 0, 0, 0, 46, 0, 0, 46, 0, 0, 51, 0, 0, 0, 39, 0, 43, 0, 0, 0].concat(
                [48, 0, 0, 48, 0, 0, 51, 0, 0, 0, 43, 0, 46, 0, 0, 0, 55, 0, 0, 55, 0, 0, 51, 0, 0, 0, 60, 0, 55, 0, 0, 0]).concat(
                    [48, 0, 0, 48, 0, 0, 51, 0, 0, 0, 43, 0, 46, 0, 0, 0, 46, 0, 0, 46, 0, 0, 51, 0, 0, 0, 39, 0, 43, 0, 0, 0]).concat(
                        [60, 0, 60, 0, 58, 0, 58, 0, 55, 0, 55, 0, 51, 0, 51, 0, 48, 0, 48, 0, 46, 0, 46, 0, 43, 0, 43, 0, 39, 0, 39, 0]),
            // 3: Euphoric fast Arp
            Array(128).fill(0).map((_, i) => {
                const arp1 = [48, 43, 51, 46]
                const arp2 = [55, 51, 60, 55]
                return i < 64 ? arp1[i % 4] : arp2[i % 4]
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

            // 2. BASS (Clean Sub, matches chord root)
            const pBass = PATTERN_BASS[intensity]
            const bassN = pBass[b128]
            if (bassN > 0) {
                const filterFreq = 300 + Math.sin(time * 2) * 50
                // Double sine for very clean, heavy low end. No weird sawtooth dissonance.
                playSynth(bassN - 12, 'sine', time, interval * 1.5, 0.45, filterFreq, true, 0, baseFreq)
                playSynth(bassN, 'triangle', time, interval * 1.5, 0.3, filterFreq * 2, true, 0, baseFreq)
            }

            // 3. CHORDS / PADS (Clean, Big Room EDM Supersaws)
            const pChord = PATTERN_CHORDS[intensity]
            const chord = pChord[b128]
            if (chord) {
                const dur = chord.d * interval
                chord.n.forEach(cn => {
                    // Proper supersaw: slightly detuned sawtooths, bright filter
                    playSynth(cn, 'sawtooth', time, dur, 0.08, 3000, true, -10, baseFreq)
                    playSynth(cn, 'sawtooth', time, dur, 0.08, 3000, true, 10, baseFreq)
                    // Add warmth
                    playSynth(cn, 'sine', time, dur, 0.08, 1000, true, 0, baseFreq)
                })
            }

            // 4. MELODIC LEAD / ARPS (Classic 8-bit / Video game square wave lead)
            const pLead = PATTERN_LEADS[intensity]
            const leadN = pLead[b128]
            if (leadN > 0) {
                const dur = interval * (intensity >= 2 ? 1.0 : 0.8) // Legato in drop
                // Clean square wave and triangle, classic GD lead
                playSynth(leadN, 'square', time, dur, 0.08, 4000, false, 0, baseFreq)
                playSynth(leadN, 'triangle', time, dur, 0.08, 4000, false, 0, baseFreq)
            }

            // 5. FX (Clean sweep removed, only nice impacts on phrase changes)
            if (intensity >= 2 && beatNumber % 128 === 0) {
                // Happy, large crash symbol to signal new section
                playHiHat(time, 'open', 1.5)
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
