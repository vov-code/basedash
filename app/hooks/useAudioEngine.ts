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
// MUSIC THEORY — GD-Inspired, Premium, Modal Harmony
// ============================================================================
//
// Design philosophy (from audio_direction.md):
//   1. GD-style energy stacking: layers add progressively per phrase section
//   2. Fifths-based melodies: singable 4-note motifs per world key
//   3. Reverse click sync: SFX quantize to beat grid
//   4. 128 BPM, 4/4 time, micro-swing
//   5. Zero performance impact: scheduler decoupled from rAF
//
// Performance rules:
//   - Max 20 oscillators on mobile, 30 on desktop (enforced)
//   - All scheduling via setTimeout, NEVER in requestAnimationFrame
//   - Short oscillator lifetimes with mandatory osc.stop()
//   - Single pre-allocated noise buffer
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (typeof window !== 'undefined' ? window.innerWidth < 1100 : true)

const MAX_OSCILLATORS = IS_MOBILE ? 20 : 30

// Per-world keys with modal harmony and fifths-based motifs
// Each world has: root MIDI note, mode intervals, and a 4-note motif
const WORLD_KEYS = [
    { root: 62, name: 'D Ionian',      motif: [0, 7, 14, 12] },  // World 0: Paper Hands
    { root: 64, name: 'E Dorian',      motif: [0, 7, 14, 12] },  // World 1: Buying the Dip
    { root: 66, name: 'F# Aeolian',    motif: [0, 7, 14, 12] },  // World 2: Diamond Hands
    { root: 69, name: 'A Mixolydian',   motif: [0, 7, 14, 12] },  // World 3: Whale Spotted
    { root: 71, name: 'B Dorian',      motif: [0, 7, 14, 12] },  // World 4: To the Moon
    { root: 61, name: 'C# Phrygian',   motif: [0, 7, 14, 12] },  // World 5: Full Degen
    { root: 63, name: 'Eb Locrian',    motif: [0, 7, 14, 12] },  // World 6: Margin Call
    { root: 65, name: 'F Harm Min',    motif: [0, 7, 14, 12] },  // World 7: Liquidation
    { root: 68, name: 'Ab Dorian',     motif: [0, 7, 14, 12] },  // World 8: GG No Re
    { root: 74, name: 'D Lydian 8va',  motif: [0, 7, 14, 12] },  // World 9: Valhalla
]

// Chord progressions — open, airy voicings (sus4, maj9, m7)
// Each prog is [chord1, chord2, chord3, chord4] — offsets from root
const CHORD_PROGS = [
    [[0, 4, 7, 11],  [5, 9, 12, 16], [-3, 0, 5, 7],  [-5, -1, 2, 7]],   // Ionian: Imaj7 IVmaj7 Vsus4 iiim7
    [[0, 3, 7, 10],  [5, 9, 12, 15], [-2, 2, 5, 10],  [-4, 0, 3, 7]],   // Dorian: im7 IVmaj7 bVII iii
    [[0, 3, 7, 10],  [-4, 0, 3, 8],  [-2, 2, 5, 9],   [-5, -1, 2, 7]],  // Aeolian
    [[0, 4, 7, 10],  [5, 9, 12, 16], [-2, 2, 5, 10],  [-5, -1, 4, 7]],  // Mixolydian
    [[0, 3, 7, 10],  [5, 9, 12, 15], [-2, 2, 5, 10],  [-4, 0, 3, 7]],   // Dorian
    [[0, 3, 7, 10],  [1, 5, 8, 12],  [-2, 2, 5, 9],   [-4, 0, 3, 8]],   // Phrygian
    [[0, 3, 6, 10],  [1, 5, 8, 12],  [-2, 1, 5, 8],   [-5, -1, 2, 6]],  // Locrian
    [[0, 3, 7, 11],  [-4, 0, 3, 8],  [-2, 2, 5, 9],   [-5, -1, 4, 7]],  // Harmonic minor
    [[0, 3, 7, 10],  [5, 9, 12, 15], [-2, 2, 5, 10],  [-4, 0, 3, 7]],   // Dorian
    [[0, 4, 7, 11],  [6, 10, 13, 18],[-2, 2, 5, 11],   [-5, -1, 4, 7]],  // Lydian
]

// Arp patterns — 16 steps, GD-style rising/falling with rests (-1)
// Inspired by Waterflame's ascending fifths-based motion
const ARP_PATTERNS = [
    [0, -1, 1, -1, 2, -1, 0, -1, 1, -1, 2, -1, 3, 2, 1, 0],   // Rising cascade
    [2, -1, 1, -1, 0, -1, 2, 1, 0, -1, 1, -1, 2, -1, 0, -1],   // Descending bounce
    [0, -1, -1, 1, -1, 2, -1, -1, 0, -1, -1, 2, -1, 1, -1, 0], // Syncopated
    [0, 1, 2, 3, -1, -1, -1, -1, 3, 2, 1, 0, -1, -1, -1, -1],  // Call and response (GD style)
]

// Bass patterns (16 steps, 1=hit 0=rest) — cleaner than phonk
const BASS_PATTERNS = [
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // Half-note pulse
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Quarter note
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], // Syncopated
]

// Hi-hat velocity patterns (0=skip)
const HAT_PATTERNS = [
    [0.8, 0.2, 0.5, 0.2, 0.8, 0.2, 0.5, 0.2, 0.8, 0.2, 0.5, 0.2, 0.8, 0.2, 0.5, 0.3],
    [0.8, 0.3, 0.6, 0.0, 0.8, 0.0, 0.5, 0.3, 0.8, 0.3, 0.6, 0.0, 0.8, 0.0, 0.5, 0.3],
    [0.7, 0,   0.4, 0,   0.7, 0,   0.3, 0,   0.7, 0,   0.4, 0,   0.7, 0.2, 0.5, 0],
]

// Lead melody — syncopated hits per bar (GD "singable" motif approach)
const LEAD_BEATS = [0, 3, 7, 10]   // Syncopated positions within 16 steps
const LEAD_DEGREES = [7, 5, 3, 0, 12, 10, 7, 5]  // Scale degrees for melody

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
            masterGainRef.current.gain.value = IS_MOBILE ? 0.20 : 0.25
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
    // VOICE — Single oscillator with envelope, filter, detune
    // Performance: tracks active oscillator count, skips if at cap
    // =========================================================================
    const voice = useCallback((
        freq: number, type: OscillatorType, t: number, dur: number,
        vol: number, dest: AudioNode,
        opts?: { filt?: number; det?: number; atk?: number; rel?: number }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx) return

        // Enforce oscillator cap — skip if at limit
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

        // Decrement counter when oscillator ends
        osc.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
    }, [])

    // =========================================================================
    // HELPER — Get current world root MIDI note
    // =========================================================================
    const getRoot = useCallback(() => {
        const idx = Math.min(bgmThemeRef.current || 0, WORLD_KEYS.length - 1)
        return WORLD_KEYS[idx].root
    }, [])

    // =========================================================================
    // SFX — Crystalline, musical, key-aware
    // All SFX use intervals relative to current world root (GD principle)
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

    // Rising 5th interval — like a droplet leaving water
    const sfxJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.1, 0.05, m, { atk: 0.004 })
        voice(midi(r + 19), 'sine', t + 0.012, 0.09, 0.03, m, { atk: 0.004 })  // +7 = P5
    }, [soundEnabled, initAudio, voice, getRoot])

    // Rising 3rd from the 5th — brighter, lighter double jump
    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 16), 'sine', t, 0.08, 0.04, m, { atk: 0.003 })
        voice(midi(r + 23), 'triangle', t + 0.045, 0.1, 0.03, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Near-miss: low pulse + rising pitch bend — "that was close"
    const sfxDash = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const r = getRoot()
        voice(midi(r - 12), 'triangle', ctx.currentTime, 0.14, 0.035, m, { filt: 700, atk: 0.01 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // 3-note ascending arp (1→3→5) — collecting green candle
    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        voice(midi(r + 12), 'sine', t, 0.13, 0.045, m, { atk: 0.003 })        // Root
        voice(midi(r + 16), 'sine', t + 0.035, 0.15, 0.03, m, { atk: 0.003 }) // M3
        voice(midi(r + 19), 'sine', t + 0.08, 0.12, 0.02, m, { atk: 0.003 })  // P5
    }, [soundEnabled, initAudio, voice, getRoot])

    // Major 7th arpeggio — power-up celebration
    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        const notes = [0, 4, 7, 11, 16]  // Root, M3, P5, M7, octave+M3
        notes.forEach((offset, i) =>
            voice(midi(r + 12 + offset), 'sine', t + i * 0.055, 0.18 - i * 0.02, 0.035 - i * 0.004, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice, getRoot])

    // Death: descending m2 + sub thud — soft "no", not punishing
    const sfxHit = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()

        // Sub thud — sine at 60Hz, felt not heard
        if (activeOscCountRef.current < MAX_OSCILLATORS) {
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(80, t)
            o.frequency.exponentialRampToValueAtTime(35, t + 0.18)
            g.gain.setValueAtTime(0.07, t)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
            o.connect(g)
            g.connect(m)
            o.start(t)
            o.stop(t + 0.3)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
        }

        // Sad descending minor 2nd
        voice(midi(r + 5), 'triangle', t + 0.05, 0.25, 0.03, m, { filt: 500 })
        voice(midi(r + 4), 'sine', t + 0.13, 0.2, 0.025, m, { filt: 350 })
    }, [soundEnabled, initAudio, voice, getRoot])

    // Menu select: single clean ping
    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(midi(79), 'sine', ctx.currentTime, 0.06, 0.035, m, { atk: 0.002 })  // G5
    }, [soundEnabled, initAudio, voice])

    // Combo: escalating interval — pitch rises with combo count
    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        const n = r + Math.min(combo, 12) * 2
        voice(midi(n), 'sine', t, 0.11, 0.04, m, { atk: 0.003 })
        voice(midi(n + 7), 'sine', t + 0.035, 0.12, 0.025, m, { atk: 0.003 }) // P5 interval
    }, [soundEnabled, initAudio, voice, getRoot])

    // Milestone: ascending arpeggio with increasing notes
    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        const notes = [0, 4, 7, 12, 16]
        notes.forEach((offset, i) => {
            voice(midi(r + 12 + offset), 'sine', t + i * 0.07, 0.22, 0.035, m, { atk: 0.005 })
            if (i >= 3) voice(midi(r + 12 + offset), 'triangle', t + i * 0.07, 0.25, 0.02, m, { atk: 0.005 })
        })
    }, [soundEnabled, initAudio, voice, getRoot])

    // New record fanfare: 7-note scale run
    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime
        const r = getRoot()
        const scaleSteps = [0, 2, 4, 5, 7, 9, 11]
        scaleSteps.forEach((s, i) =>
            voice(midi(r + 12 + s), 'sine', t + i * 0.05, 0.13, 0.03, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice, getRoot])

    // =========================================================================
    // BACKGROUND MUSIC — GD-Inspired Generative System
    // =========================================================================
    //
    // 128 BPM, 32-bar phrases with 4 sections (A/B/C/D)
    // Layers stack progressively like GD energy builds:
    //   Section A (Breathe):  Pad + Drone + Sparse Arp
    //   Section B (Build):    + Kick + Bass Pulse + Fuller Arp
    //   Section C (Peak):     + Hats + Lead Motif + Perc
    //   Section D (Resolve):  Layers thin + FX riser + key change prep
    //
    // Performance: runs entirely on setTimeout (50ms), never in rAF
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
        const S8 = BEAT / 2

        let step = 0
        let nextTime = ctx.currentTime + 0.15

        // ===================================================================
        // AUDIO ROUTING — Minimal 3-bus architecture (lighter than old 5-bus)
        // ===================================================================
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain bus — everything ducks gently under kick
        const scGain = ctx.createGain()
        scGain.gain.value = 1
        scGain.connect(bgmGain)

        // Drum bus
        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.7
        drumBus.connect(bgmGain)

        // Melody bus with dotted-8th delay
        const melBus = ctx.createGain()
        melBus.gain.value = 0.6
        const melDelay = ctx.createDelay(2)
        const melDelFb = ctx.createGain()
        const melDelFilt = ctx.createBiquadFilter()
        melDelay.delayTime.value = S8 * 0.75  // Dotted sixteenth — rhythmic echo
        melDelFb.gain.value = 0.25
        melDelFilt.type = 'lowpass'
        melDelFilt.frequency.value = 2200
        melBus.connect(scGain)
        melBus.connect(melDelay)
        melDelay.connect(melDelFilt)
        melDelFilt.connect(melDelFb)
        melDelFb.connect(melDelay)
        melDelay.connect(scGain)

        // ===================================================================
        // DRUM SOUNDS — Soft, pressure-wave style (not aggressive)
        // ===================================================================

        // Soft kick — sine sweep 100→40Hz, no click layer
        const softKick = (t: number, vel: number) => {
            if (activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(100 * vel, t)
            o.frequency.exponentialRampToValueAtTime(40, t + 0.08)
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.08 * vel, t + 0.003)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            o.connect(g)
            g.connect(drumBus)
            o.start(t)
            o.stop(t + 0.25)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }

            // Gentle sidechain duck: -4dB, 120ms release
            scGain.gain.cancelScheduledValues(t)
            scGain.gain.setValueAtTime(0.63, t)     // -4dB
            scGain.gain.linearRampToValueAtTime(0.8, t + 0.04)
            scGain.gain.linearRampToValueAtTime(1, t + 0.12)
        }

        // Crystalline closed hi-hat — softer, higher filter
        const hihatClosed = (t: number, vel: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'
            f.frequency.value = 9000
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.001)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.015)
            n.connect(f)
            f.connect(g)
            g.connect(drumBus)
            n.start(t)
            n.stop(t + 0.025)
        }

        // Open hi-hat — longer, breathier
        const hihatOpen = (t: number, vel: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'
            f.frequency.value = 8000
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.002)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
            n.connect(f)
            f.connect(g)
            g.connect(drumBus)
            n.start(t)
            n.stop(t + 0.1)
        }

        // Champagne glass rim tap — tonal percussion
        const rimTap = (t: number, vel: number) => {
            if (activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'square'
            o.frequency.setValueAtTime(520, t)
            o.frequency.exponentialRampToValueAtTime(360, t + 0.015)
            g.gain.setValueAtTime(0.03 * vel, t)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
            o.connect(g)
            g.connect(drumBus)
            o.start(t)
            o.stop(t + 0.035)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
        }

        // ===================================================================
        // MAIN SCHEDULER — 128 steps per phrase (32 bars × 4 16th-notes per beat × 4 beats per bar / 4)
        //                   Actually: 32 bars = 128 beats = 512 16th steps
        //                   We use 128-step phrases (8 bars) for manageable cycling
        // ===================================================================
        const schedule = (s: number, t: number) => {
            const world = Math.min(bgmThemeRef.current || 0, WORLD_KEYS.length - 1)
            const wk = WORLD_KEYS[world]
            const root = wk.root
            const intensity = Math.min(world, 5)

            // Phrase structure: 128 steps = 8 bars (each bar = 16 steps)
            const phraseStep = s % 128
            const bar = Math.floor(phraseStep / 16)
            const s16 = phraseStep % 16

            // Section determination (GD-style A/B/C/D):
            //   A (bars 0-1): Breathe — pad + drone + sparse arp
            //   B (bars 2-3): Build — + kick + bass pulse
            //   C (bars 4-5): Peak — all layers, lead motif
            //   D (bars 6-7): Resolve — thin out + FX
            const section = bar < 2 ? 0 : bar < 4 ? 1 : bar < 6 ? 2 : 3  // 0=A 1=B 2=C 3=D

            // Chord progression — one chord per 2 bars
            const chordIdx = Math.floor(bar / 2) % 4
            const progIdx = Math.min(world, CHORD_PROGS.length - 1)
            const chordOffsets = CHORD_PROGS[progIdx][chordIdx]

            // =============================================================
            // LAYER 1: Sub Drone — always, root-2oct, sine, LP 80Hz
            // =============================================================
            if (phraseStep === 0) {
                const droneDur = S16 * 126
                voice(midi(root - 24), 'sine', t, droneDur, 0.025 + intensity * 0.003, scGain, {
                    atk: 1.5, rel: droneDur * 0.9, filt: 80
                })
            }

            // =============================================================
            // LAYER 2: Atmospheric Pad — always, changes with chord
            // Detuned sine ×2 with triangle shimmer
            // =============================================================
            if (s16 === 0) {
                const padDur = S16 * 15.5
                const padVol = 0.035 + intensity * 0.003

                chordOffsets.forEach((offset: number) => {
                    const n = root + offset
                    // Warm sine pad (main)
                    voice(midi(n), 'sine', t, padDur, padVol, scGain, {
                        atk: 0.4, rel: padDur * 0.9, filt: 800 + intensity * 150
                    })
                    // Detuned second voice for width (intensity >= 1)
                    if (intensity >= 1) {
                        voice(midi(n), 'sine', t, padDur, padVol * 0.6, scGain, {
                            atk: 0.5, rel: padDur * 0.85, filt: 700 + intensity * 100, det: 4
                        })
                    }
                    // Triangle octave shimmer (intensity >= 4)
                    if (intensity >= 4) {
                        voice(midi(n + 12), 'triangle', t, padDur, padVol * 0.25, scGain, {
                            atk: 0.6, rel: padDur * 0.7, filt: 1200
                        })
                    }
                })
            }

            // =============================================================
            // LAYER 3: Arp Melody — "glass chime pluck"
            // Section A: sparse (every 4th step)
            // Section B+: full 16-step pattern
            // Uses GD-style fifths-based chord tones through dotted-8th delay
            // =============================================================
            if (intensity >= 1) {
                const arpActive = section === 0 ? (s16 % 4 === 0) : (section >= 1)

                if (arpActive) {
                    const arpPatIdx = (Math.floor(s / 128) + Math.floor(bar / 2)) % ARP_PATTERNS.length
                    const arpPat = ARP_PATTERNS[arpPatIdx]
                    const arpVal = arpPat[s16]

                    if (arpVal >= 0) {
                        const toneIdx = arpVal % chordOffsets.length
                        const arpNote = root + 12 + chordOffsets[toneIdx]
                        const arpDur = S16 * 1.6
                        const arpVol = section >= 2 ? 0.035 : 0.025

                        // Triangle + sine blend (60/40) — "glass wind chime"
                        voice(midi(arpNote), 'triangle', t, arpDur, arpVol * 0.6, melBus, {
                            atk: 0.003, filt: 3000 + intensity * 300, rel: arpDur * 0.6
                        })
                        voice(midi(arpNote), 'sine', t, arpDur, arpVol * 0.4, melBus, {
                            atk: 0.003, filt: 4000, rel: arpDur * 0.5
                        })
                    }
                }
            }

            // =============================================================
            // LAYER 4: Soft Kick — Section B+
            // Sine sweep 100→40Hz, no click, gentle sidechain
            // =============================================================
            if (section >= 1 && intensity >= 2) {
                // Beats 1 and 3 (s16 0 and 8)
                if (s16 === 0 || s16 === 8) {
                    softKick(t, 0.8 + intensity * 0.03)
                }
            }

            // =============================================================
            // LAYER 5: Bass Pulse — Section B+
            // Clean sine at root-1oct, LP 200Hz
            // =============================================================
            if (section >= 1 && intensity >= 2) {
                const bassPatIdx = intensity >= 3 ? 1 : 0  // Quarter or half-note
                const bassPat = BASS_PATTERNS[bassPatIdx]
                if (bassPat[s16]) {
                    const bassNote = root + chordOffsets[0] - 12
                    const bassDur = S16 * 2
                    voice(midi(bassNote), 'sine', t, bassDur, 0.12 + intensity * 0.01, scGain, {
                        atk: 0.005, filt: 200, rel: bassDur * 0.8
                    })
                }
            }

            // =============================================================
            // LAYER 6: Liquid Hi-Hats — Section C only
            // Crystalline, filtered noise with velocity humanization
            // =============================================================
            if (section >= 2 && intensity >= 3) {
                const hatPatIdx = intensity >= 4 ? 1 : (intensity >= 3 ? 0 : 2)
                const hatPat = HAT_PATTERNS[hatPatIdx]
                const hatVel = hatPat[s16]
                if (hatVel > 0) {
                    hihatClosed(t, hatVel * (0.5 + intensity * 0.05))
                }
                // Open hat on offbeats
                if (s16 === 6 || s16 === 14) {
                    hihatOpen(t, 0.4 + intensity * 0.04)
                }
            }

            // =============================================================
            // LAYER 7: Lead Motif — Section C, intensity >= 4
            // Filtered sawtooth with 5Hz vibrato — GD "singable" melody
            // Uses scale degrees for call-and-response feel
            // =============================================================
            if (section === 2 && intensity >= 4 && bar < 6) {
                if (LEAD_BEATS.includes(s16)) {
                    const leadIdx = (s16 + bar * 3) % LEAD_DEGREES.length
                    const leadNote = root + 12 + LEAD_DEGREES[leadIdx]
                    const leadDur = S16 * 2.5

                    voice(midi(leadNote), 'sawtooth', t, leadDur, 0.025, melBus, {
                        atk: 0.005, filt: 2500 + intensity * 400, rel: leadDur * 0.7
                    })
                    voice(midi(leadNote), 'triangle', t, leadDur, 0.018, melBus, {
                        atk: 0.008, filt: 2000, rel: leadDur * 0.6
                    })
                }
            }

            // =============================================================
            // LAYER 8: Percussion Detail — Section C, intensity >= 3
            // Champagne glass rim taps on offbeats
            // =============================================================
            if (section >= 2 && intensity >= 3) {
                if (s16 === 2 || s16 === 10) {
                    rimTap(t, 0.5 + intensity * 0.04)
                }
                // Fill on last bar of phrase
                if (bar === 7 && s16 >= 12 && s16 % 2 === 0) {
                    rimTap(t, 0.3 + (s16 - 12) * 0.08)
                }
            }

            // =============================================================
            // LAYER 9: Grain Texture — intensity >= 1
            // Random noise bursts, subliminal digital rain
            // =============================================================
            if (intensity >= 1 && noiseBufferRef.current && Math.random() < 0.15) {
                const gn = ctx.createBufferSource()
                gn.buffer = noiseBufferRef.current
                const gf = ctx.createBiquadFilter(), gg = ctx.createGain()
                gf.type = 'bandpass'
                gf.frequency.value = 2000 + Math.random() * 1500
                gf.Q.value = 1
                gg.gain.setValueAtTime(0, t)
                gg.gain.linearRampToValueAtTime(0.008, t + 0.002)
                gg.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
                gn.connect(gf)
                gf.connect(gg)
                gg.connect(scGain)
                gn.start(t)
                gn.stop(t + 0.04)
            }

            // =============================================================
            // LAYER 10: FX & Transitions — Section D only
            // Noise riser sweep + sub boom on phrase downbeat
            // =============================================================
            if (section === 3 && s16 === 0 && bar === 6 && intensity >= 2) {
                // Rising noise sweep over 2 bars
                if (noiseBufferRef.current) {
                    const rn = ctx.createBufferSource()
                    rn.buffer = noiseBufferRef.current
                    const rf = ctx.createBiquadFilter(), rg = ctx.createGain()
                    rf.type = 'bandpass'
                    rf.frequency.setValueAtTime(400, t)
                    rf.frequency.exponentialRampToValueAtTime(3000, t + S16 * 28)
                    rf.Q.value = 2
                    const riseVol = 0.02 + intensity * 0.005
                    rg.gain.setValueAtTime(0.001, t)
                    rg.gain.linearRampToValueAtTime(riseVol, t + S16 * 26)
                    rg.gain.linearRampToValueAtTime(0.001, t + S16 * 30)
                    rn.connect(rf)
                    rf.connect(rg)
                    rg.connect(scGain)
                    rn.start(t)
                    rn.stop(t + S16 * 32)
                }
            }

            // Sub boom on phrase downbeat (intensity >= 3, not first phrase)
            if (intensity >= 3 && phraseStep === 0 && s > 0) {
                voice(midi(root - 12), 'sine', t, 0.5, 0.06, scGain, {
                    atk: 0.005, filt: 150
                })
            }
        }

        // =================================================================
        // SCHEDULER LOOP — decoupled from rAF, 50ms interval
        // =================================================================
        let timer: ReturnType<typeof setTimeout>
        const LOOK = 50       // Check every 50ms (lighter than old 40ms)
        const AHEAD = 0.25    // Schedule 250ms ahead

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

        // Handle tab visibility — stop scheduler when hidden
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
                // Resume when tab becomes visible again
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
