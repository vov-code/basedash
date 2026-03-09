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

// ============================================================================
// MUSIC THEORY CONSTANTS
// ============================================================================

// Pentatonic minor scale intervals — always sounds pleasant, impossible to clash
const PENTA_MINOR = [0, 3, 5, 7, 10]

// Note frequencies (A4 = 440Hz standard tuning)
const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

// Chord progressions — emotionally resonant, universally loved
// Using Am - F - C - G (vi-IV-I-V in C major) — the "pop punk" progression
// Mapped to MIDI: A3=57, F3=53, C4=60, G3=55
const PROGRESSIONS = [
    // Warm & dreamy (for early worlds)
    { roots: [57, 53, 60, 55], mode: 'minor', feel: 'dreamy' },
    // Uplifting energy (for mid worlds)   
    { roots: [60, 55, 57, 53], mode: 'major', feel: 'uplifting' },
    // Euphoric drive (for fast worlds)
    { roots: [64, 60, 65, 62], mode: 'major', feel: 'euphoric' },
    // Epic finale (for endgame worlds)
    { roots: [69, 64, 67, 62], mode: 'major', feel: 'epic' },
]

// Melodic phrases — hand-crafted to sound beautiful over each chord
// Each phrase is 16 steps (16th notes), values are MIDI note numbers, 0 = rest
const MELODY_PHRASES = [
    // Phrase A: Gentle opening — ascending, hopeful
    [72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
    // Phrase B: Playful bounce
    [79, 0, 76, 79, 0, 0, 74, 0, 76, 0, 72, 0, 0, 0, 0, 0],
    // Phrase C: Emotional climb
    [72, 0, 0, 74, 0, 76, 0, 0, 79, 0, 81, 0, 79, 0, 76, 0],
    // Phrase D: Resolution — falling back home
    [84, 0, 81, 0, 79, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0],
    // Phrase E: Chiptune arp (fast and catchy)
    [72, 76, 79, 84, 79, 76, 72, 76, 79, 84, 86, 84, 79, 76, 72, 0],
    // Phrase F: Syncopated groove
    [0, 72, 0, 0, 74, 0, 76, 0, 0, 79, 0, 0, 76, 0, 74, 0],
    // Phrase G: High energy descending
    [84, 0, 84, 81, 0, 79, 0, 76, 0, 74, 0, 72, 74, 0, 0, 0],
    // Phrase H: Call and response
    [72, 74, 76, 0, 0, 0, 79, 81, 79, 0, 0, 0, 76, 74, 72, 0],
]

// Arpeggio patterns (chord tones cycled)
const ARP_PATTERNS = [
    [0, 4, 7, 12],      // Up
    [12, 7, 4, 0],      // Down
    [0, 7, 4, 12],      // Bounce
    [0, 12, 7, 4],      // Skip
]

// Bass patterns (rhythmic variations per section)
const BASS_RHYTHMS = [
    // Minimal: whole notes
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // Pulse: quarter notes
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    // Driving: octave bounce
    [1, 0, 0, 0, 0.7, 0, 1, 0, 0, 0, 0.7, 0, 1, 0, 0, 0],
    // Energetic: 8th notes with octave
    [1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0],
]

// Drum patterns
const DRUM_PATTERNS = {
    // Intro: just soft hats
    intro: {
        kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hat: [0.3, 0, 0.2, 0, 0.3, 0, 0.2, 0, 0.3, 0, 0.2, 0, 0.3, 0, 0.2, 0],
    },
    // Light: kick + soft snare
    light: {
        kick: [0.8, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
        hat: [0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0],
    },
    // Full: 4-on-the-floor
    full: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
        hat: [0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0],
    },
    // Driving: fast hats + syncopated kick
    driving: {
        kick: [1, 0, 0, 0.5, 1, 0, 0, 0, 1, 0, 0.5, 0, 1, 0, 0, 0.5],
        snare: [0, 0, 0, 0, 1, 0, 0, 0.3, 0, 0, 0, 0, 1, 0, 0, 0.3],
        hat: [0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3],
    },
}

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const bgmNodesRef = useRef<{ stop: () => void, gain: GainNode } | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
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

            // Smooth master compression — not too aggressive, keeps it musical
            const compressor = ctx.createDynamicsCompressor()
            compressor.threshold.value = -18
            compressor.knee.value = 12
            compressor.ratio.value = 6
            compressor.attack.value = 0.005
            compressor.release.value = 0.15
            compressor.connect(ctx.destination)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = 0.35
            masterGainRef.current.connect(compressor)

            // Generate noise buffer for percussion
            const bufferSize = ctx.sampleRate * 2
            const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const output = noiseBuf.getChannelData(0)
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1
            }
            noiseBufferRef.current = noiseBuf
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

    // =========================================================================
    // CORE SYNTH: play a single note with envelope and optional filter
    // =========================================================================
    const playNote = useCallback((
        freq: number,
        type: OscillatorType,
        time: number,
        dur: number,
        vol: number,
        dest: AudioNode,
        opts?: {
            filterFreq?: number
            filterQ?: number
            detune?: number
            attack?: number
            decay?: number
            sustain?: number
        }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx) return

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = type
        osc.frequency.setValueAtTime(freq, time)
        if (opts?.detune) osc.detune.value = opts.detune

        const atk = opts?.attack ?? 0.015
        const dec = opts?.decay ?? dur * 0.3
        const sus = opts?.sustain ?? 0.6

        gain.gain.setValueAtTime(0, time)
        gain.gain.linearRampToValueAtTime(vol, time + atk)
        gain.gain.linearRampToValueAtTime(vol * sus, time + atk + dec)
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur)

        if (opts?.filterFreq) {
            const filter = ctx.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(opts.filterFreq, time)
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(200, opts.filterFreq * 0.2), time + dur
            )
            filter.Q.value = opts?.filterQ ?? 1
            osc.connect(filter)
            filter.connect(gain)
        } else {
            osc.connect(gain)
        }

        gain.connect(dest)
        osc.start(time)
        osc.stop(time + dur + 0.05)
    }, [])

    // =========================================================================
    // SIMPLE TONE PLAYER (for SFX compatibility)
    // =========================================================================
    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)

        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)

        osc.connect(gain)
        gain.connect(master)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + dur + 0.05)
    }, [soundEnabled, initAudio])

    // =========================================================================
    // PLEASANT SOUND EFFECTS — warm, musical, satisfying
    // =========================================================================

    // Jump: soft ascending chime (like a xylophone tap)
    const sfxJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        playNote(523.25, 'sine', t, 0.12, 0.06, master, { attack: 0.005 })
        playNote(783.99, 'sine', t + 0.015, 0.1, 0.03, master, { attack: 0.005 })
    }, [soundEnabled, initAudio, playNote])

    // Double jump: sparkling two-note rise
    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        playNote(659.25, 'sine', t, 0.08, 0.05, master, { attack: 0.003 })
        playNote(987.77, 'triangle', t + 0.05, 0.12, 0.04, master, { attack: 0.003 })
    }, [soundEnabled, initAudio, playNote])

    // Dash: whoosh (low filtered sweep)
    const sfxDash = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        playNote(220, 'triangle', t, 0.15, 0.04, master, { filterFreq: 800, attack: 0.01 })
    }, [soundEnabled, initAudio, playNote])

    // Collect: warm sparkle (major third interval = happy sound)
    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        playNote(880, 'sine', t, 0.15, 0.05, master, { attack: 0.003 })
        playNote(1108.73, 'sine', t + 0.04, 0.18, 0.04, master, { attack: 0.003 })
        playNote(1318.51, 'sine', t + 0.09, 0.14, 0.025, master, { attack: 0.003 })
    }, [soundEnabled, initAudio, playNote])

    // Power-up: ascending arpeggio (magical fairy dust)
    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]
        notes.forEach((f, i) => {
            playNote(f, 'sine', t + i * 0.06, 0.2 - i * 0.02, 0.04 - i * 0.005, master, { attack: 0.003 })
        })
    }, [soundEnabled, initAudio, playNote])

    // Hit/Death: soft thud + descending tone (not harsh)
    const sfxHit = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime

        // Soft impact thud
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(150, t)
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2)
        gain.gain.setValueAtTime(0.08, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.connect(gain)
        gain.connect(master)
        osc.start(t)
        osc.stop(t + 0.35)

        // Sad descending tone
        playNote(392, 'triangle', t + 0.05, 0.3, 0.04, master, { filterFreq: 600 })
        playNote(330, 'sine', t + 0.15, 0.25, 0.03, master, { filterFreq: 400 })
    }, [soundEnabled, initAudio, playNote])

    // Select: gentle click
    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        playNote(784, 'sine', ctx.currentTime, 0.06, 0.04, master, { attack: 0.002 })
    }, [soundEnabled, initAudio, playNote])

    // Combo: ascending pentatonic notes (higher combo = higher pitch)
    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime

        const baseNote = 60 + Math.min(combo, 12) * 2
        const freq1 = noteFreq(baseNote)
        const freq2 = noteFreq(baseNote + 7) // Perfect fifth = always consonant

        playNote(freq1, 'sine', t, 0.12, 0.045, master, { attack: 0.003 })
        playNote(freq2, 'sine', t + 0.04, 0.14, 0.03, master, { attack: 0.003 })
    }, [soundEnabled, initAudio, playNote])

    // Milestone: fanfare arpeggio (triumphant major chord)
    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]
        notes.forEach((f, i) => {
            playNote(f, 'sine', t + i * 0.08, 0.25, 0.04, master, { attack: 0.005 })
            if (i >= 3) playNote(f, 'triangle', t + i * 0.08, 0.3, 0.025, master, { attack: 0.005 })
        })
    }, [soundEnabled, initAudio, playNote])

    // Level up: glittering ascending scale
    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master) return
        const t = ctx.currentTime
        const scale = [60, 64, 67, 72, 76, 79, 84]
        scale.forEach((n, i) => {
            playNote(noteFreq(n), 'sine', t + i * 0.055, 0.15, 0.035, master, { attack: 0.003 })
        })
    }, [soundEnabled, initAudio, playNote])

    // =========================================================================
    // BACKGROUND MUSIC ENGINE — Melodious, Relaxing, Geometry Dash Degen Style
    // =========================================================================
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return
        if (ctx.state === 'suspended') ctx.resume().catch(() => { })

        let isPlaying = true
        const TEMPO = 128 // BPM — chill but groovy
        const STEPS_PER_BEAT = 4 // 16th notes
        const STEP_DUR = 60 / TEMPO / STEPS_PER_BEAT // ~0.117s

        let currentStep = 0
        let nextStepTime = ctx.currentTime + 0.15

        // === Audio buses ===
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain envelope (duck on kick)
        const sidechainGain = ctx.createGain()
        sidechainGain.gain.value = 1
        sidechainGain.connect(bgmGain)

        // Drum bus
        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.9
        drumBus.connect(bgmGain)

        // Melody bus with delay for spaciousness
        const melodyBus = ctx.createGain()
        melodyBus.gain.value = 1.0
        const melodyDelay = ctx.createDelay(2.0)
        const delayFeedback = ctx.createGain()
        const delayFilter = ctx.createBiquadFilter()

        melodyDelay.delayTime.value = STEP_DUR * 6 // dotted quarter = lush echo
        delayFeedback.gain.value = 0.35
        delayFilter.type = 'lowpass'
        delayFilter.frequency.value = 2000

        melodyBus.connect(sidechainGain) // dry signal
        melodyBus.connect(melodyDelay)   // wet signal
        melodyDelay.connect(delayFilter)
        delayFilter.connect(delayFeedback)
        delayFeedback.connect(melodyDelay)
        melodyDelay.connect(sidechainGain)

        // Pad bus (warm chords)
        const padBus = ctx.createGain()
        padBus.gain.value = 0.7
        padBus.connect(sidechainGain)

        // Bass bus
        const bassBus = ctx.createGain()
        bassBus.gain.value = 1.0
        bassBus.connect(sidechainGain)

        // === DRUM SYNTH ===
        const playKick = (time: number, vel: number) => {
            const osc = ctx.createOscillator()
            const g = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(80 * vel, time)
            osc.frequency.exponentialRampToValueAtTime(35, time + 0.08)
            g.gain.setValueAtTime(0, time)
            g.gain.linearRampToValueAtTime(0.7 * vel, time + 0.005)
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.25)
            osc.connect(g)
            g.connect(drumBus)
            osc.start(time)
            osc.stop(time + 0.3)
            // Sidechain ducking
            sidechainGain.gain.setValueAtTime(0.3, time)
            sidechainGain.gain.linearRampToValueAtTime(1.0, time + 0.15)
        }

        const playSnare = (time: number, vel: number) => {
            if (!noiseBufferRef.current) return
            // Tonal body
            const osc = ctx.createOscillator()
            const og = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(200, time)
            osc.frequency.exponentialRampToValueAtTime(120, time + 0.08)
            og.gain.setValueAtTime(0, time)
            og.gain.linearRampToValueAtTime(0.35 * vel, time + 0.003)
            og.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
            osc.connect(og)
            og.connect(drumBus)
            osc.start(time)
            osc.stop(time + 0.15)
            // Noise tail
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current
            const nf = ctx.createBiquadFilter()
            nf.type = 'bandpass'
            nf.frequency.value = 3000
            nf.Q.value = 0.8
            const ng = ctx.createGain()
            ng.gain.setValueAtTime(0, time)
            ng.gain.linearRampToValueAtTime(0.4 * vel, time + 0.003)
            ng.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
            noise.connect(nf)
            nf.connect(ng)
            ng.connect(drumBus)
            noise.start(time)
            noise.stop(time + 0.15)
        }

        const playHat = (time: number, vel: number, open = false) => {
            if (!noiseBufferRef.current) return
            const noise = ctx.createBufferSource()
            noise.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter()
            f.type = 'highpass'
            f.frequency.value = 8000
            const g = ctx.createGain()
            const dur = open ? 0.15 : 0.04
            g.gain.setValueAtTime(0, time)
            g.gain.linearRampToValueAtTime(0.25 * vel, time + 0.002)
            g.gain.exponentialRampToValueAtTime(0.001, time + dur)
            noise.connect(f)
            f.connect(g)
            g.connect(drumBus)
            noise.start(time)
            noise.stop(time + dur + 0.05)
        }

        // === SONG SECTION LOGIC ===
        // Song structure cycles every 256 steps (64 beats = 30 seconds at 128bpm)
        // Section 0: Intro (bars 1-4)  — hats only, pad, gentle melody
        // Section 1: Build (bars 5-8)  — add kick, fuller bass, arp melody
        // Section 2: Drop (bars 9-12)  — full drums, driving bass, catchy lead
        // Section 3: Peak (bars 13-16) — max energy, fast arps, euphoric

        const getSection = (step: number, worldTheme: number): number => {
            const barInCycle = Math.floor((step % 256) / 16) // 0-15
            let section = 0
            if (barInCycle >= 12) section = 3
            else if (barInCycle >= 8) section = 2
            else if (barInCycle >= 4) section = 1

            // Higher worlds push to higher sections faster
            return Math.min(3, section + Math.floor(worldTheme / 3))
        }

        const getDrumPattern = (section: number) => {
            if (section <= 0) return DRUM_PATTERNS.intro
            if (section === 1) return DRUM_PATTERNS.light
            if (section === 2) return DRUM_PATTERNS.full
            return DRUM_PATTERNS.driving
        }

        // === MAIN SCHEDULER ===
        const scheduleStep = (step: number, time: number) => {
            const worldTheme = bgmThemeRef.current || 0
            const speedMult = Math.max(0.6, bgmSpeedRef.current || 1)
            const section = getSection(step, worldTheme)

            const prog = PROGRESSIONS[Math.min(worldTheme, PROGRESSIONS.length - 1) % PROGRESSIONS.length]
            const chordIdx = Math.floor((step % 64) / 16) // Chord changes every 16 steps (1 bar)
            const root = prog.roots[chordIdx % prog.roots.length]

            const s16 = step % 16 // Position within a bar

            // --- DRUMS ---
            const dp = getDrumPattern(section)
            if (dp.kick[s16] > 0) playKick(time, dp.kick[s16])
            if (dp.snare[s16] > 0) playSnare(time, dp.snare[s16])
            if (dp.hat[s16] > 0) playHat(time, dp.hat[s16], s16 % 8 === 6)

            // --- BASS ---
            const bassRhythm = BASS_RHYTHMS[Math.min(section, BASS_RHYTHMS.length - 1)]
            if (bassRhythm[s16] > 0) {
                const bassFreq = noteFreq(root - 12) // One octave below chord root
                const octaveUp = s16 % 8 === 4 && section >= 2 // Octave bounce in drop
                playNote(
                    octaveUp ? bassFreq * 2 : bassFreq,
                    'sine', time,
                    STEP_DUR * 1.8,
                    0.35 * bassRhythm[s16],
                    bassBus,
                    { filterFreq: 400 + section * 100, attack: 0.01 }
                )
                // Sub layer
                if (section >= 1) {
                    playNote(bassFreq, 'sine', time, STEP_DUR * 2, 0.2 * bassRhythm[s16], bassBus, {
                        filterFreq: 200, attack: 0.02
                    })
                }
            }

            // --- PAD CHORDS (warm, gentle) ---
            if (s16 === 0) {
                // Play full chord on downbeat of each bar
                const chordNotes = [root, root + 4, root + 7] // Major triad
                if (section >= 2) chordNotes.push(root + 12) // Add octave in drop

                const padDur = STEP_DUR * 15 // Nearly full bar sustain
                chordNotes.forEach(n => {
                    // Warm sine pad
                    playNote(noteFreq(n), 'sine', time, padDur, 0.06, padBus, {
                        attack: 0.15, decay: padDur * 0.5, sustain: 0.7,
                        filterFreq: 1500 + section * 500
                    })
                    // Soft sawtooth shimmer (very quiet)
                    if (section >= 1) {
                        playNote(noteFreq(n), 'sawtooth', time, padDur, 0.02, padBus, {
                            attack: 0.2, decay: padDur * 0.4, sustain: 0.5,
                            filterFreq: 800 + section * 300, detune: 8
                        })
                        playNote(noteFreq(n), 'sawtooth', time, padDur, 0.02, padBus, {
                            attack: 0.2, decay: padDur * 0.4, sustain: 0.5,
                            filterFreq: 800 + section * 300, detune: -8
                        })
                    }
                })
            }

            // --- MELODY ---
            const phraseSet = section <= 1
                ? [0, 5, 2, 3] // Gentle phrases for intro/build
                : [4, 1, 6, 7] // Energetic phrases for drop/peak

            const phraseIdx = phraseSet[chordIdx % phraseSet.length]
            const phrase = MELODY_PHRASES[phraseIdx % MELODY_PHRASES.length]
            const melodyNote = phrase[s16]

            if (melodyNote > 0) {
                // Transpose melody to fit current chord key
                const transposeOffset = root - 60 // Shift melody relative to C4
                const finalNote = melodyNote + transposeOffset

                const melodyDur = STEP_DUR * (section >= 2 ? 1.5 : 1.2)
                // Clean lead: sine + triangle blend
                playNote(noteFreq(finalNote), 'sine', time, melodyDur, 0.07, melodyBus, {
                    attack: 0.008, filterFreq: 3000 + section * 1000
                })
                if (section >= 1) {
                    playNote(noteFreq(finalNote), 'triangle', time, melodyDur, 0.04, melodyBus, {
                        attack: 0.008, filterFreq: 2500 + section * 800
                    })
                }
                // Chiptune square wave lead in high-energy sections
                if (section >= 3) {
                    playNote(noteFreq(finalNote + 12), 'square', time, melodyDur * 0.8, 0.025, melodyBus, {
                        attack: 0.005, filterFreq: 4000
                    })
                }
            }

            // --- ARP (in higher sections) ---
            if (section >= 2 && s16 % 2 === 0) {
                const arpPattern = ARP_PATTERNS[section - 2]
                const arpIdx = (s16 / 2) % arpPattern.length
                const arpNote = root + 12 + arpPattern[arpIdx] // One octave up
                playNote(noteFreq(arpNote), 'sine', time, STEP_DUR * 0.8, 0.03, melodyBus, {
                    attack: 0.003, filterFreq: 2500
                })
            }
        }

        // === SCHEDULER LOOP ===
        let timerID: ReturnType<typeof setTimeout>
        const LOOKAHEAD_MS = 50
        const SCHEDULE_AHEAD = 0.18

        const scheduler = () => {
            if (!isPlaying || !audioCtxRef.current) return
            const speedMult = Math.max(0.6, bgmSpeedRef.current || 1)
            const interval = STEP_DUR / speedMult

            while (nextStepTime < audioCtxRef.current.currentTime + SCHEDULE_AHEAD) {
                scheduleStep(currentStep, nextStepTime)
                nextStepTime += interval
                currentStep++
                if (currentStep > 1_000_000) currentStep = 0
            }
            timerID = setTimeout(scheduler, LOOKAHEAD_MS)
        }

        // Gentle fade in
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 4.0)

        timerID = setTimeout(scheduler, LOOKAHEAD_MS)

        bgmNodesRef.current = {
            stop: () => {
                isPlaying = false
                clearTimeout(timerID)
                try {
                    bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                    bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime)
                    bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5)
                } catch { /* ctx may be closed */ }
            },
            gain: bgmGain,
        }
    }, [soundEnabled, initAudio, playNote])

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
        unlockAudio: initAudio,
    }
}
