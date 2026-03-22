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
// 🎵 FULL SONG — "Midnight on the Chain"
// ============================================================================
//
// A lo-fi chillhop track that relaxes the degen and pulls them into flow state.
//
// Structure (16-bar loop = 256 steps at 16th-note resolution):
//   INTRO   (bars 0-3):   Pad + sub drone — ambient warmth, sets the mood
//   VERSE   (bars 4-7):   + melody hook + walking bass — groove establishes
//   CHORUS  (bars 8-11):  + counter-melody + kick + hat — full energy, hook peaks
//   BRIDGE  (bars 12-15): Melody thins to echoes, bass walks alone — tension/release
//
// Melody: 8-note pentatonic hook per world — singable, memorable
// Harmony: 4-chord loop with open voicings, changes every 4 bars
// Bass: Walking pattern (not just root) — alive, jazzy feel
// Percussion: Lo-fi kit — vinyl-warm kick, paper-thin hat
//
// All pentatonic. All sine+triangle. Max 8 simultaneous oscs.
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (typeof window !== 'undefined' ? window.innerWidth < 1100 : true)

const MAX_OSCILLATORS = IS_MOBILE ? 18 : 26

// ============================================================================
// SONG DATA — Per-world musical identity
// ============================================================================

// Pentatonic intervals: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
// These intervals CANNOT produce dissonance in any combination.

// Each world has a unique 8-note melodic hook + chord tones
// The hook is the "chorus melody" — the earworm that gets stuck in your head
const WORLD_SONGS = [
    { // W0: "Paper Hands" — Hopeful, ascending, like dawn breaking
        root: 62,
        hook:    [0, 4, 7, 12, 9, 7, 4, 7],       // D pentatonic: up-up-up-peak-settle-back-dip-home
        counter: [12, 9, 12, 14, 12, 9, 7, 9],     // High mirror: answers the hook
        chords:  [[0, 7], [4, 12], [7, 14], [2, 9]], // Open 5ths walking up
    },
    { // W1: "Buying the Dip" — Confident bounce
        root: 64,
        hook:    [0, 7, 4, 0, 2, 9, 7, 4],
        counter: [12, 14, 12, 9, 12, 16, 14, 12],
        chords:  [[0, 7], [2, 9], [4, 12], [7, 14]],
    },
    { // W2: "Diamond Hands" — Determined, driving
        root: 66,
        hook:    [0, 2, 4, 7, 4, 2, 0, 4],
        counter: [9, 12, 14, 12, 9, 7, 9, 12],
        chords:  [[0, 7], [4, 12], [2, 9], [7, 14]],
    },
    { // W3: "Whale Spotted" — Wide, epic, majestic
        root: 69,
        hook:    [0, 7, 12, 9, 7, 12, 14, 12],
        counter: [14, 12, 9, 12, 14, 16, 14, 12],
        chords:  [[0, 7], [7, 14], [4, 12], [9, 16]],
    },
    { // W4: "To the Moon" — Euphoric, soaring
        root: 71,
        hook:    [0, 4, 9, 12, 14, 12, 9, 7],
        counter: [12, 16, 19, 16, 14, 12, 14, 16],
        chords:  [[0, 7], [4, 12], [9, 16], [7, 14]],
    },
    { // W5: "Full Degen" — Mysterious, compelling
        root: 61,
        hook:    [0, 2, 7, 4, 9, 7, 2, 4],
        counter: [12, 14, 16, 14, 12, 9, 12, 14],
        chords:  [[0, 7], [2, 9], [7, 14], [4, 12]],
    },
    { // W6: "Margin Call" — Tense but beautiful
        root: 63,
        hook:    [0, 9, 7, 4, 7, 9, 12, 9],
        counter: [14, 12, 9, 12, 14, 16, 14, 12],
        chords:  [[0, 7], [9, 16], [4, 12], [7, 14]],
    },
    { // W7: "Liquidation" — Bittersweet, reflective
        root: 65,
        hook:    [0, 7, 9, 7, 4, 2, 4, 7],
        counter: [12, 14, 16, 14, 12, 9, 12, 14],
        chords:  [[0, 7], [7, 14], [2, 9], [4, 12]],
    },
    { // W8: "GG No Re" — Defiant, energetic
        root: 68,
        hook:    [0, 4, 12, 9, 4, 7, 9, 12],
        counter: [12, 16, 19, 16, 14, 12, 14, 16],
        chords:  [[0, 7], [4, 12], [7, 14], [9, 16]],
    },
    { // W9: "Valhalla" — Transcendent, peaceful
        root: 74,
        hook:    [0, 7, 12, 14, 12, 9, 7, 12],
        counter: [14, 19, 21, 19, 16, 14, 16, 19],
        chords:  [[0, 7], [7, 14], [9, 16], [12, 19]],
    },
]

// Melody rhythm: which 16th-note steps get a melody note
// 8 notes spread across 2 bars (32 steps) — syncopated, breathing
//   "♩ . . ♩ . ♩ . . ♩ . . ♩ . ♩ . ♩"
const MELODY_RHYTHM = [0, 3, 5, 8, 11, 13, 16, 21]

// Counter-melody rhythm: offset from main hook — call and response
const COUNTER_RHYTHM = [2, 6, 10, 14, 18, 22, 26, 30]

// Walking bass: 4 notes per bar, walking through chord tones
// Each value is an index into pentatonic scale degrees
const BASS_WALK = [
    [0, -5, -3, -5],    // Bar type A: root, down, step up, back
    [-3, -5, 0, -7],    // Bar type B: 3rd down, 5th down, root, octave down
]

// Kick pattern: boom-bap feel (beat 1, ghost on &3)
const KICK_STEPS = [0, 10]

// Hat pattern: offbeats with ghost notes — lo-fi shuffle
const HAT_PATTERN = [
    0, 0, 0.3, 0,  0.7, 0, 0.3, 0,  0, 0, 0.3, 0,  0.7, 0, 0.4, 0
]

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const bgmNodesRef = useRef<{ stop: () => void; gain: GainNode } | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
    const noiseBufferRef = useRef<AudioBuffer | null>(null)
    const activeOscCountRef = useRef<number>(0)

    const updateAudioParams = useCallback((speedMultiplier: number, themeIndex: number) => {
        bgmSpeedRef.current = speedMultiplier
        bgmThemeRef.current = themeIndex
    }, [])

    // =========================================================================
    // AUDIO INIT
    // =========================================================================
    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const ctx = new AC()
            audioCtxRef.current = ctx

            const comp = ctx.createDynamicsCompressor()
            comp.threshold.value = -16
            comp.knee.value = 10
            comp.ratio.value = 3.5
            comp.attack.value = 0.008
            comp.release.value = 0.2
            comp.connect(ctx.destination)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = IS_MOBILE ? 0.24 : 0.30
            masterGainRef.current.connect(comp)

            // Pre-allocated noise buffer
            const len = ctx.sampleRate * 2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
            noiseBufferRef.current = buf
        }
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }, [])

    // =========================================================================
    // VOICE — Single oscillator with envelope
    // =========================================================================
    const voice = useCallback((
        freq: number, type: OscillatorType, t: number, dur: number,
        vol: number, dest: AudioNode,
        opts?: { filt?: number; det?: number; atk?: number; rel?: number }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx) return
        if (activeOscCountRef.current >= MAX_OSCILLATORS) return
        activeOscCountRef.current++

        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, t)
        if (opts?.det) osc.detune.value = opts.det

        const a = opts?.atk ?? 0.02
        const r = opts?.rel ?? dur
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(vol, t + a)
        g.gain.setValueAtTime(vol * 0.85, t + a + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t + r)

        if (opts?.filt) {
            const f = ctx.createBiquadFilter()
            f.type = 'lowpass'
            f.frequency.setValueAtTime(opts.filt, t)
            f.frequency.exponentialRampToValueAtTime(Math.max(150, opts.filt * 0.15), t + r)
            osc.connect(f)
            f.connect(g)
        } else {
            osc.connect(g)
        }
        g.connect(dest)
        osc.start(t)
        osc.stop(t + r + 0.1)
        osc.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
    }, [])

    const getRoot = useCallback(() => {
        const idx = Math.min(bgmThemeRef.current || 0, WORLD_SONGS.length - 1)
        return WORLD_SONGS[idx].root
    }, [])

    // =========================================================================
    // SFX — Musical, key-aware, minimal oscillators
    // =========================================================================

    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        if (activeOscCountRef.current >= MAX_OSCILLATORS) return
        activeOscCountRef.current++
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)
        g.gain.setValueAtTime(0, ctx.currentTime)
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.008)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
        osc.connect(g)
        g.connect(m)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + dur + 0.05)
        osc.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
    }, [soundEnabled, initAudio])

    const sfxJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.09, 0.04, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.015, 0.08, 0.025, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        voice(midi(r + 19), 'sine', t, 0.07, 0.03, m, { atk: 0.003 })
        voice(midi(r + 24), 'triangle', t + 0.04, 0.08, 0.02, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxDash = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(midi(getRoot() - 12), 'sine', ctx.currentTime, 0.12, 0.03, m, { filt: 500, atk: 0.008 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.12, 0.04, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.05, 0.1, 0.03, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.15, 0.035, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.06, 0.13, 0.03, m, { atk: 0.003 })
        voice(midi(r + 24), 'triangle', t + 0.12, 0.14, 0.025, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxHit = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        if (activeOscCountRef.current < MAX_OSCILLATORS) {
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(75, t)
            o.frequency.exponentialRampToValueAtTime(30, t + 0.2)
            g.gain.setValueAtTime(0.07, t)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
            o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.35)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
        }
        voice(midi(r + 6), 'triangle', t + 0.04, 0.2, 0.025, m, { filt: 400 })
        voice(midi(r - 6), 'sine', t + 0.12, 0.25, 0.02, m, { filt: 300 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(midi(79), 'sine', ctx.currentTime, 0.06, 0.03, m, { atk: 0.002 })
    }, [soundEnabled, initAudio, voice])

    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const r = getRoot()
        const penta = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
        const n = r + penta[Math.min(combo, penta.length - 1)]
        voice(midi(n), 'sine', ctx.currentTime, 0.1, 0.035, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.18, 0.03, m, { atk: 0.005 })
        voice(midi(r + 16), 'sine', t + 0.08, 0.16, 0.025, m, { atk: 0.005 })
        voice(midi(r + 19), 'triangle', t + 0.16, 0.2, 0.03, m, { atk: 0.005 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        const steps = [0, 4, 7, 12]
        steps.forEach((s, i) =>
            voice(midi(r + 12 + s), 'sine', t + i * 0.07, i === 3 ? 0.3 : 0.12, 0.03, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice, getRoot])

    // =========================================================================
    // 🎵 BACKGROUND MUSIC — Full Song Engine
    // =========================================================================

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return
        if (ctx.state === 'suspended') ctx.resume().catch(() => { })

        let alive = true
        const BPM = 128
        const BEAT = 60 / BPM
        const S16 = BEAT / 4

        let step = 0
        let nextTime = ctx.currentTime + 0.15

        // ===================================================================
        // ROUTING
        // ===================================================================
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain bus
        const scGain = ctx.createGain()
        scGain.gain.value = 1
        scGain.connect(bgmGain)

        // Melody bus — warm tape-style delay
        const melBus = ctx.createGain()
        melBus.gain.value = 0.65
        const melDelay = ctx.createDelay(2)
        const melDelFb = ctx.createGain()
        const melDelFilt = ctx.createBiquadFilter()
        melDelay.delayTime.value = BEAT * 0.75  // Dotted eighth — dreamy rhythmic echo
        melDelFb.gain.value = 0.22
        melDelFilt.type = 'lowpass'
        melDelFilt.frequency.value = 1600       // Warm, like tape saturation
        melBus.connect(scGain)
        melBus.connect(melDelay)
        melDelay.connect(melDelFilt)
        melDelFilt.connect(melDelFb)
        melDelFb.connect(melDelay)
        melDelay.connect(scGain)

        // Drum bus
        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.55
        drumBus.connect(bgmGain)

        // ===================================================================
        // DRUMS — Lo-fi warmth
        // ===================================================================

        // Boom-bap kick: warm sine sweep with gentle click
        const lofiKick = (t: number) => {
            if (activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(95, t)
            o.frequency.exponentialRampToValueAtTime(42, t + 0.06)
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.07, t + 0.003)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            o.connect(g)
            g.connect(drumBus)
            o.start(t)
            o.stop(t + 0.25)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }

            // Gentle sidechain pump — the music breathes with the beat
            scGain.gain.cancelScheduledValues(t)
            scGain.gain.setValueAtTime(0.65, t)
            scGain.gain.linearRampToValueAtTime(0.82, t + 0.04)
            scGain.gain.linearRampToValueAtTime(1, t + 0.12)
        }

        // Paper-thin hi-hat: filtered noise, 10ms
        const lofiHat = (t: number, vel: number) => {
            if (!noiseBufferRef.current || vel <= 0) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'
            f.frequency.value = 9000
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.03 * vel, t + 0.001)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.015)
            n.connect(f)
            f.connect(g)
            g.connect(drumBus)
            n.start(t)
            n.stop(t + 0.025)
        }

        // ===================================================================
        // MAIN SCHEDULER — 256-step loop (16 bars)
        // ===================================================================
        const schedule = (s: number, t: number) => {
            const world = Math.min(bgmThemeRef.current || 0, WORLD_SONGS.length - 1)
            const song = WORLD_SONGS[world]
            const root = song.root
            const intensity = Math.min(world, 5)

            // 256-step phrase = 16 bars
            const phraseStep = s % 256
            const bar = Math.floor(phraseStep / 16)
            const s16 = phraseStep % 16

            // Song sections:
            //   INTRO   bars 0-3:   Pad + Drone — set the mood
            //   VERSE   bars 4-7:   + Melody + Walking bass — groove builds
            //   CHORUS  bars 8-11:  + Counter-melody + Drums — full energy
            //   BRIDGE  bars 12-15: Melody echoes out, bass walks alone — breath
            const section = bar < 4 ? 0 : bar < 8 ? 1 : bar < 12 ? 2 : 3

            // Chord changes every 4 bars — one chord per section
            const chordIdx = section
            const chord = song.chords[chordIdx]

            // =============================================================
            // 🌊 SUB DRONE — always, root -2 octaves
            // The heartbeat of the track — you feel it in your chest
            // =============================================================
            if (phraseStep === 0) {
                const dur = S16 * 254
                voice(midi(root - 24), 'sine', t, dur, 0.02 + intensity * 0.002, scGain, {
                    atk: 2.5, rel: dur * 0.9, filt: 80
                })
            }

            // =============================================================
            // 🎹 PAD — Open 5th voicing with binaural shimmer
            // Warm bed that everything else sits on top of
            // Changes with chord progression — gives movement to the track
            // =============================================================
            if (s16 === 0) {
                const padDur = S16 * 15.5
                const padVol = section === 2 ? 0.032 : 0.025
                const vol = padVol + intensity * 0.002

                chord.forEach((offset: number) => {
                    // Main sine — warm, centered
                    voice(midi(root + offset), 'sine', t, padDur, vol, scGain, {
                        atk: 0.6, rel: padDur * 0.9, filt: 850 + intensity * 80
                    })
                    // Binaural pair — +3 cents, creates ~1Hz beating
                    // Your brain interprets this as "expensive" depth
                    if (intensity >= 1) {
                        voice(midi(root + offset), 'sine', t, padDur, vol * 0.45, scGain, {
                            atk: 0.7, rel: padDur * 0.85, filt: 750, det: 3
                        })
                    }
                })
            }

            // =============================================================
            // 🎵 MELODY — The Hook (8-note pentatonic phrase)
            //
            // Plays during VERSE and CHORUS (sections 1-2)
            // 8 notes across 2 bars, syncopated rhythm with rests
            // Through the delay → creates dreamy doubled echoes
            //
            // In BRIDGE (section 3): only every other note plays
            // → melody "dissolves" into delay echoes = hauntingly beautiful
            // =============================================================
            if (section >= 1 && intensity >= 1) {
                // Which 2-bar pair within the section?
                const twoBarStep = (phraseStep - (section * 64)) % 32
                const melIdx = MELODY_RHYTHM.indexOf(twoBarStep)

                if (melIdx >= 0) {
                    // Bridge: thin out — play only notes 0, 2, 4, 6
                    if (section === 3 && melIdx % 2 !== 0) {
                        // Skip — let the delay echoes fill the space
                    } else {
                        const noteInterval = song.hook[melIdx]
                        const melNote = root + 12 + noteInterval
                        const melDur = S16 * 2.5
                        const melVol = section === 2 ? 0.035 : 0.025

                        // Pure sine — the delay adds all the texture
                        voice(midi(melNote), 'sine', t, melDur, melVol, melBus, {
                            atk: 0.006, filt: 2200 + intensity * 200, rel: melDur * 0.7
                        })
                    }
                }
            }

            // =============================================================
            // ✨ COUNTER-MELODY — Chorus only (section 2)
            // Answers the main hook — creates call-and-response
            // Higher register, triangle wave — airy, sparkly
            // =============================================================
            if (section === 2 && intensity >= 3) {
                const twoBarStep = (phraseStep - 128) % 32
                const ctrIdx = COUNTER_RHYTHM.indexOf(twoBarStep)

                if (ctrIdx >= 0) {
                    const noteInterval = song.counter[ctrIdx]
                    const ctrNote = root + noteInterval
                    const ctrDur = S16 * 2
                    const ctrVol = 0.018 + intensity * 0.002

                    // Triangle — slightly brighter, sits above the sine melody
                    voice(midi(ctrNote), 'triangle', t, ctrDur, ctrVol, melBus, {
                        atk: 0.008, filt: 1800 + intensity * 150, rel: ctrDur * 0.6
                    })
                }
            }

            // =============================================================
            // 🎸 WALKING BASS — Verse, Chorus, Bridge
            // Not just root notes — walks through pentatonic tones
            // Quarter-note pulse that keeps the groove alive
            // Lo-fi warmth: sine with LP 200Hz
            // =============================================================
            if (section >= 1 && intensity >= 2) {
                // Bass hits on quarter notes: steps 0, 4, 8, 12
                if (s16 % 4 === 0) {
                    const beatInBar = s16 / 4   // 0, 1, 2, 3
                    const walkType = bar % 2     // Alternate walk patterns
                    const walkOffset = BASS_WALK[walkType][beatInBar]
                    const bassNote = root - 12 + chord[0] + walkOffset
                    const bassDur = S16 * 3.5

                    voice(midi(bassNote), 'sine', t, bassDur, 0.07 + intensity * 0.006, scGain, {
                        atk: 0.008, filt: 200, rel: bassDur * 0.75
                    })
                }
            }

            // =============================================================
            // 🥁 DRUMS — Chorus only (section 2)
            // Boom-bap kit: warm kick + paper hat
            // Lo-fi feel: not aggressive, just groove
            // =============================================================
            if (section === 2 && intensity >= 3) {
                // Kick: boom-bap pattern
                if (KICK_STEPS.includes(s16)) {
                    lofiKick(t)
                }
                // Hat: velocity pattern with ghost notes
                const hatVel = HAT_PATTERN[s16]
                if (hatVel > 0) {
                    lofiHat(t, hatVel * (0.6 + intensity * 0.04))
                }
            }

            // =============================================================
            // 🌅 TRANSITIONS
            // Phrase downbeat sub boom — marks the loop restart
            // =============================================================
            if (intensity >= 3 && phraseStep === 0 && s > 0) {
                voice(midi(root - 12), 'sine', t, 0.6, 0.04, scGain, {
                    atk: 0.005, filt: 140
                })
            }
        }

        // =================================================================
        // SCHEDULER LOOP
        // =================================================================
        let timer: ReturnType<typeof setTimeout>
        const LOOK = 50
        const AHEAD = 0.25

        const loop = () => {
            if (!alive || !audioCtxRef.current) return
            const speedMult = Math.max(1, bgmSpeedRef.current || 1)
            const interval = S16 / speedMult

            while (nextTime < audioCtxRef.current.currentTime + AHEAD) {
                schedule(step, nextTime)
                nextTime += interval
                step++
                if (step > 500_000) step = 0
            }
            timer = setTimeout(loop, LOOK)
        }

        // 4-second fade in — like sunrise
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 4)

        timer = setTimeout(loop, LOOK)

        // Tab visibility handling
        const handleVisibility = () => {
            if (document.hidden) {
                alive = false
                clearTimeout(timer)
                try {
                    bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                    bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime)
                    bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3)
                } catch { /* ctx closed */ }
            } else if (!alive && bgmNodesRef.current) {
                alive = true
                nextTime = ctx.currentTime + 0.15
                bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                bgmGain.gain.setValueAtTime(0, ctx.currentTime)
                bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
                timer = setTimeout(loop, LOOK)
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)

        bgmNodesRef.current = {
            stop: () => {
                alive = false
                clearTimeout(timer)
                document.removeEventListener('visibilitychange', handleVisibility)
                try {
                    bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                    bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime)
                    bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5)
                } catch { /* ctx closed */ }
            },
            gain: bgmGain,
        }
    }, [soundEnabled, initAudio, voice])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current) {
            bgmNodesRef.current.stop()
            bgmNodesRef.current = null
        }
    }, [])

    return {
        playTone, updateAudioParams,
        sfxJump, sfxDoubleJump, sfxDash, sfxCollect, sfxPowerup,
        sfxHit, sfxSelect, sfxCombo, sfxMilestone, sfxLevelUp,
        startBackgroundMusic, stopBackgroundMusic,
        unlockAudio: initAudio,
    }
}
