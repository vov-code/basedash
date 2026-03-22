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
// MELODIOUS MINIMALISM — Pentatonic Purity
// ============================================================================
//
// Design philosophy:
//   1. PENTATONIC ONLY — the pentatonic scale cannot produce dissonance.
//      Every note combination sounds beautiful and consonant.
//   2. FEWER SOUNDS — max 6 simultaneous voices, open voicings (root + 5th)
//   3. SINE + TRIANGLE ONLY — purest, warmest timbres. No sawtooth/square.
//   4. MELODY BREATHES — rests are as important as notes. Space = premium.
//   5. EARWORM MOTIF — 4-note phrase per world, repeats with tiny variation.
//   6. PSYCHOACOUSTIC WARMTH — ±3 cent detuning creates binaural shimmer.
//
// Performance rules (unchanged):
//   - Max 16 oscillators on mobile, 24 on desktop
//   - All scheduling via setTimeout, NEVER in requestAnimationFrame
//   - Short oscillator lifetimes with mandatory osc.stop()
//   - Single pre-allocated noise buffer
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (typeof window !== 'undefined' ? window.innerWidth < 1100 : true)

const MAX_OSCILLATORS = IS_MOBILE ? 16 : 24

// Pentatonic intervals: [0, 2, 4, 7, 9] (major pentatonic)
// Every combination of these notes is consonant — impossible to create dissonance.
//
// Per-world: unique root + unique 4-note motif using pentatonic intervals only
const WORLD_KEYS = [
    { root: 62, motif: [0, 4, 7, 12] },    // W0: D — hopeful rise (1→3→5→8)
    { root: 64, motif: [0, 7, 12, 9] },     // W1: E — leap & settle (1→5→8→6)
    { root: 66, motif: [0, 2, 7, 4] },      // W2: F# — gentle climb (1→2→5→3)
    { root: 69, motif: [0, 7, 4, 12] },     // W3: A — wide sweep (1→5→3→8)
    { root: 71, motif: [0, 4, 9, 7] },      // W4: B — flowing arc (1→3→6→5)
    { root: 61, motif: [0, 2, 4, 7] },      // W5: C# — stepwise rise (1→2→3→5)
    { root: 63, motif: [0, 9, 7, 12] },     // W6: Eb — reaching (1→6→5→8)
    { root: 65, motif: [0, 7, 9, 4] },      // W7: F — call-response (1→5→6→3)
    { root: 68, motif: [0, 4, 12, 7] },     // W8: Ab — leap-return (1→3→8→5)
    { root: 74, motif: [0, 7, 12, 16] },    // W9: D8va — soaring (1→5→8→10)
]

// Open voicings: root + perfect 5th only (2 notes, never 4)
// These change per 2-bar section, cycling through pentatonic tones
const PAD_VOICINGS = [
    [0, 7],      // Root + P5
    [4, 12],     // M3 + Octave
    [7, 14],     // P5 + 9th
    [2, 9],      // M2 + M6
]

// Arp pattern — sparse, breathing, with rests (-1 = silence)
// Much simpler than before: only 6 active notes out of 16 steps
const ARP_PATTERN = [
    0, -1, -1, 1,  -1, -1, 2, -1,  -1, 0, -1, -1,  1, -1, 2, -1
]

// Bass: root note only, half-note pulse (minimal)
const BASS_HITS = [0, 8]  // Beat 1 and beat 3

// Kick: only on downbeats
const KICK_HITS = [0, 8]

// Hi-hat: gentle offbeats only (4 hits per bar, not 8 or 16)
const HAT_HITS = [4, 12]
const HAT_VEL = 0.4

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
    // AUDIO INIT — Lazy, one-time setup
    // =========================================================================
    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const ctx = new AC()
            audioCtxRef.current = ctx

            // Gentle master compression — musical, not squashed
            const comp = ctx.createDynamicsCompressor()
            comp.threshold.value = -18
            comp.knee.value = 12
            comp.ratio.value = 3
            comp.attack.value = 0.01
            comp.release.value = 0.25
            comp.connect(ctx.destination)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = IS_MOBILE ? 0.22 : 0.28
            masterGainRef.current.connect(comp)

            // Pre-allocate noise buffer (2s) — reused for all percussion
            const len = ctx.sampleRate * 2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
            noiseBufferRef.current = buf
        }
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }, [])

    // =========================================================================
    // VOICE — Single oscillator with envelope and optional filter
    // Tracks active count, skips if at cap
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

    // =========================================================================
    // HELPER — Get current world
    // =========================================================================
    const getRoot = useCallback(() => {
        const idx = Math.min(bgmThemeRef.current || 0, WORLD_KEYS.length - 1)
        return WORLD_KEYS[idx].root
    }, [])

    // =========================================================================
    // SFX — Crystalline, minimal, key-aware
    // All SFX: max 2 oscillators. Pure sine. Pentatonic intervals only.
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

    // Jump: single rising perfect 5th (root → P5) — pure, instant
    const sfxJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.09, 0.04, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.015, 0.08, 0.025, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Double jump: octave + 5th — brighter, airier
    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 19), 'sine', t, 0.07, 0.03, m, { atk: 0.003 })
        voice(midi(r + 24), 'triangle', t + 0.04, 0.08, 0.02, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Near-miss: low octave pulse — "felt", not heard
    const sfxDash = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const r = getRoot()
        voice(midi(r - 12), 'sine', ctx.currentTime, 0.12, 0.03, m, { filt: 500, atk: 0.008 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Collect: rising 5th (2 notes only) — clean, satisfying
    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.12, 0.04, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.05, 0.1, 0.03, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Power-up: 3-note pentatonic rise (root → 5th → octave)
    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.15, 0.035, m, { atk: 0.003 })
        voice(midi(r + 19), 'sine', t + 0.06, 0.13, 0.03, m, { atk: 0.003 })
        voice(midi(r + 24), 'triangle', t + 0.12, 0.14, 0.025, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Death: root to tritone drop — visceral "wrong" without harshness
    const sfxHit = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()

        // Sub thud — sine sweep down, felt in chest
        if (activeOscCountRef.current < MAX_OSCILLATORS) {
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(75, t)
            o.frequency.exponentialRampToValueAtTime(30, t + 0.2)
            g.gain.setValueAtTime(0.07, t)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
            o.connect(g)
            g.connect(m)
            o.start(t)
            o.stop(t + 0.35)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
        }

        // Descending tritone — the most psychoacoustically "wrong" interval
        voice(midi(r + 6), 'triangle', t + 0.04, 0.2, 0.025, m, { filt: 400 })
        voice(midi(r - 6), 'sine', t + 0.12, 0.25, 0.02, m, { filt: 300 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Select: clean single ping
    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(midi(79), 'sine', ctx.currentTime, 0.06, 0.03, m, { atk: 0.002 })
    }, [soundEnabled, initAudio, voice])

    // Combo: pitch rises with combo, single note + octave
    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        // Pentatonic scale degrees: each combo steps up the scale
        const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
        const n = r + pentatonic[Math.min(combo, pentatonic.length - 1)]
        voice(midi(n), 'sine', t, 0.1, 0.035, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Milestone: 3-note pentatonic arp
    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.18, 0.03, m, { atk: 0.005 })
        voice(midi(r + 16), 'sine', t + 0.08, 0.16, 0.025, m, { atk: 0.005 })
        voice(midi(r + 19), 'triangle', t + 0.16, 0.2, 0.03, m, { atk: 0.005 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // New record: 4-note ascending pentatonic with last note held
    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        const steps = [0, 4, 7, 12]
        steps.forEach((s, i) =>
            voice(midi(r + 12 + s), 'sine', t + i * 0.07, i === 3 ? 0.3 : 0.12, 0.03, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice, getRoot])

    // =========================================================================
    // BACKGROUND MUSIC — Melodious Minimalism
    // =========================================================================
    //
    // 128 BPM, 8-bar phrases, 4 sections (A/B/C/D)
    // ONLY 5 layers (down from 10):
    //   1. Sub Drone — always, root sine, LP 80Hz
    //   2. Pad — root + P5, sine with ±3 cent binaural detune (2-3 oscs)
    //   3. Melody — world's 4-note pentatonic motif, pure sine (1 osc)
    //   4. Bass — root, sine, LP 200Hz, half-note pulse (1 osc)
    //   5. Soft Kick + Hat — minimal percussion (1 osc + 1 noise)
    //
    // Total budget: 5-7 simultaneous oscs (vs previous 12-20)
    // Result: every sound has SPACE to breathe. Consonance guaranteed.
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
        // ROUTING — Ultra-simple: bgmGain → master
        // Plus a single gentle delay for the melody
        // ===================================================================
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain bus — gentle duck under kick
        const scGain = ctx.createGain()
        scGain.gain.value = 1
        scGain.connect(bgmGain)

        // Melody bus with dotted-8th delay (single echo = dreamy)
        const melBus = ctx.createGain()
        melBus.gain.value = 0.7
        const melDelay = ctx.createDelay(2)
        const melDelFb = ctx.createGain()
        const melDelFilt = ctx.createBiquadFilter()
        melDelay.delayTime.value = BEAT * 0.75  // Dotted eighth — creates flowing echo
        melDelFb.gain.value = 0.2              // Subtle single repeat
        melDelFilt.type = 'lowpass'
        melDelFilt.frequency.value = 1800       // Warm echo, no harshness
        melBus.connect(scGain)
        melBus.connect(melDelay)
        melDelay.connect(melDelFilt)
        melDelFilt.connect(melDelFb)
        melDelFb.connect(melDelay)
        melDelay.connect(scGain)

        // Drum bus
        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.6
        drumBus.connect(bgmGain)

        // ===================================================================
        // DRUMS — Feather-light. Felt, not heard.
        // ===================================================================

        const softKick = (t: number) => {
            if (activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(90, t)
            o.frequency.exponentialRampToValueAtTime(38, t + 0.07)
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.06, t + 0.003)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
            o.connect(g)
            g.connect(drumBus)
            o.start(t)
            o.stop(t + 0.22)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }

            // Gentle sidechain duck
            scGain.gain.cancelScheduledValues(t)
            scGain.gain.setValueAtTime(0.7, t)
            scGain.gain.linearRampToValueAtTime(0.85, t + 0.04)
            scGain.gain.linearRampToValueAtTime(1, t + 0.1)
        }

        const softHat = (t: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'
            f.frequency.value = 9500
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.035, t + 0.001)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.012)
            n.connect(f)
            f.connect(g)
            g.connect(drumBus)
            n.start(t)
            n.stop(t + 0.02)
        }

        // ===================================================================
        // MAIN SCHEDULER
        // ===================================================================
        const schedule = (s: number, t: number) => {
            const world = Math.min(bgmThemeRef.current || 0, WORLD_KEYS.length - 1)
            const wk = WORLD_KEYS[world]
            const root = wk.root
            const intensity = Math.min(world, 5)

            // Phrase: 128 steps = 8 bars
            const phraseStep = s % 128
            const bar = Math.floor(phraseStep / 16)
            const s16 = phraseStep % 16

            // Section: A(0-1) B(2-3) C(4-5) D(6-7)
            const section = bar < 2 ? 0 : bar < 4 ? 1 : bar < 6 ? 2 : 3

            // Pad voicing index (changes every 2 bars)
            const padIdx = Math.floor(bar / 2) % PAD_VOICINGS.length
            const padNotes = PAD_VOICINGS[padIdx]

            // =============================================================
            // LAYER 1: Sub Drone — always present, root note 2 octaves down
            // Single sine, LP 80Hz — you feel it, don't hear it
            // =============================================================
            if (phraseStep === 0) {
                const droneDur = S16 * 126
                voice(midi(root - 24), 'sine', t, droneDur, 0.022 + intensity * 0.002, scGain, {
                    atk: 2, rel: droneDur * 0.9, filt: 80
                })
            }

            // =============================================================
            // LAYER 2: Pad — open voicing (root + P5), sine only
            // ±3 cent detuning creates binaural beating = perceived warmth
            // Only 2-3 oscillators (down from 12!)
            // =============================================================
            if (s16 === 0) {
                const padDur = S16 * 15.5
                const padVol = 0.03 + intensity * 0.002

                padNotes.forEach((offset: number) => {
                    const n = root + offset
                    // Main voice — pure sine
                    voice(midi(n), 'sine', t, padDur, padVol, scGain, {
                        atk: 0.5, rel: padDur * 0.9, filt: 900 + intensity * 100
                    })
                    // Binaural shimmer — same note, +3 cents detune
                    // Creates ~1Hz beating perceived as warmth/depth
                    if (intensity >= 1) {
                        voice(midi(n), 'sine', t, padDur, padVol * 0.5, scGain, {
                            atk: 0.6, rel: padDur * 0.85, filt: 800, det: 3
                        })
                    }
                })
            }

            // =============================================================
            // LAYER 3: Melody — the 4-note pentatonic motif
            // SINGLE sine voice. The melody delay adds the second "voice".
            // Plays in Section A sparse, Section B-C full, Section D silent.
            //
            // Bar structure:
            //   First bar of pair: play motif notes 0,1,2,3
            //   Second bar: repeat notes 0,1,2 then vary note 3 (+2 semitones)
            //   → Repetition + tiny variation = earworm
            // =============================================================
            if (section <= 2 && intensity >= 1) {
                const arpVal = ARP_PATTERN[s16]

                if (arpVal >= 0) {
                    const motif = wk.motif
                    const motifNote = motif[arpVal % motif.length]
                    // Second bar of each pair: vary the last note up
                    const variation = (bar % 2 === 1 && arpVal === motif.length - 1) ? 2 : 0
                    const noteOffset = motifNote + variation

                    const melNote = root + 12 + noteOffset
                    const melDur = S16 * 2
                    const melVol = section >= 2 ? 0.032 : 0.022

                    // Pure sine — the delay adds all the "texture" needed
                    voice(midi(melNote), 'sine', t, melDur, melVol, melBus, {
                        atk: 0.005, filt: 2500 + intensity * 200, rel: melDur * 0.7
                    })
                }
            }

            // =============================================================
            // LAYER 4: Bass — Section B+ only
            // Root note, 1 octave down, sine, LP 200Hz
            // Half-note pulse: only on beats 1 and 3
            // =============================================================
            if (section >= 1 && intensity >= 2) {
                if (BASS_HITS.includes(s16)) {
                    const bassNote = root + padNotes[0] - 12
                    const bassDur = S16 * 3
                    voice(midi(bassNote), 'sine', t, bassDur, 0.08 + intensity * 0.008, scGain, {
                        atk: 0.008, filt: 200, rel: bassDur * 0.8
                    })
                }
            }

            // =============================================================
            // LAYER 5: Percussion — Section C only
            // Soft kick: beats 1 & 3 (sine sweep, no click)
            // Soft hat: offbeats 2 & 4 (filtered noise, 12ms)
            // =============================================================
            if (section >= 2 && intensity >= 3) {
                if (KICK_HITS.includes(s16)) {
                    softKick(t)
                }
                if (HAT_HITS.includes(s16)) {
                    softHat(t)
                }
            }

            // =============================================================
            // TRANSITIONS — Section D
            // No noise riser. Instead: melody goes silent (natural rest)
            // Sub boom on phrase downbeat for continuity
            // =============================================================
            if (intensity >= 3 && phraseStep === 0 && s > 0) {
                voice(midi(root - 12), 'sine', t, 0.5, 0.04, scGain, {
                    atk: 0.005, filt: 150
                })
            }
        }

        // =================================================================
        // SCHEDULER LOOP — decoupled from rAF
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

        // Gentle 3-second fade in
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)

        timer = setTimeout(loop, LOOK)

        // Handle tab visibility
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
                bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1)
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
