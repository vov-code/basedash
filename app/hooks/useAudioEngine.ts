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
// 🎹 PREMIUM GENERATIVE SOUNDTRACK — "Midnight on the Chain"
// ============================================================================
//
// COMPOSITION PHILOSOPHY:
//
// 1. DORIAN MODE — the sophisticated minor scale
//    D Dorian: D E F G A B C  (intervals: 0 2 3 5 7 9 10)
//    The natural 6th (B/9) gives warmth that Aeolian lacks.
//    Used by: Daft Punk, Deadmau5, Bonobo, Tycho — premium electronic music.
//
// 2. STEPWISE MELODY — "на одном дыхании" (in one breath)
//    Every note moves AT MOST 3 semitones from the previous.
//    No jumps, no surprises. The melody flows like water.
//    This is how Ryuichi Sakamoto and Brian Eno compose.
//
// 3. SMOOTH VOICE LEADING — chords share common tones
//    Chord 1 ending note = Chord 2 starting note.
//    No harmonic "seams" between sections.
//
// 4. SPEED DECOUPLING — game speed barely affects music tempo
//    At 3× game speed → music is only 1.16× faster.
//    The music stays grounded; only the arp subtly accelerates.
//
// 5. DESIGNED SFX — not oscillator beeps, but layered textures
//    Each SFX: transient layer + body + tail.
//    Pitch slides give life. Filter sweeps add polish.
//
// STRUCTURE (16-bar / 256-step loop):
//   INTRO    bars  0-3:  Pad blooms from silence + sub drone
//   VERSE    bars  4-7:  Melody phrase 1 enters + gentle bass pulse
//   CHORUS   bars  8-11: Melody phrase 2 (higher) + counter + arp + drums
//   BRIDGE   bars 12-15: Melody thins to echoes + pad alone + riser to loop
//
// 10 AUDIO LAYERS:
//   1. Sub Drone          — 24Hz foundation, felt not heard
//   2. Ensemble Pad       — 4-voice detuned chords, LP filtered  
//   3. Lead Melody        — Pure sine through tape delay
//   4. Counter Melody     — Triangle call-and-response (chorus)
//   5. Glass Arpeggiator  — Sparse pluck pattern through delay (chorus)
//   6. Walking Bass       — Warm sine, stepwise root movement
//   7. Kick               — Soft pressure-wave sine sweep
//   8. Snare/Rim          — Body + noise tail (chorus only)
//   9. Hi-Hat             — Filtered noise with ghost velocity
//  10. FX Risers          — Noise sweeps for section transitions
//
// MAX OSCILLATORS: 20 mobile / 32 desktop — enforced per-voice
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (typeof window !== 'undefined' ? window.innerWidth < 1100 : true)

const MAX_OSC = IS_MOBILE ? 20 : 32

// ============================================================================
// DORIAN SCALE DEGREES for each world
//   Dorian intervals: 0, 2, 3, 5, 7, 9, 10, 12 (=octave)
//
// MELODY DESIGN RULE: consecutive notes differ by ≤3 semitones.
//   This guarantees the "one breath" flow.
//   Checked: every hook[] and counter[] obeys |hook[i+1] - hook[i]| ≤ 3
// ============================================================================

const WORLDS = [
    { // W0 "Paper Hands" — Gentle wave, like breathing
      root: 62,
      hook:    [0,  2,  3,  5,  3,  2,  0,  2],   // D E F G F E D E
      counter: [12, 10, 9,  7,  9,  10, 12, 10],  // Mirror descending
      chords:  [[0,7],[5,12],[3,10],[-2,5]],       // Dm G F/A C — smooth walk
    },
    { // W1 "Buying the Dip" — Rising confidence
      root: 64,
      hook:    [0,  2,  3,  5,  7,  5,  3,  2],   // E → step up to B → settle
      counter: [12, 10, 9,  7,  5,  7,  9,  10],
      chords:  [[0,7],[3,10],[5,12],[-2,5]],
    },
    { // W2 "Diamond Hands" — Determined ascent
      root: 66,
      hook:    [0,  3,  5,  7,  5,  3,  2,  0],   // Mountain shape
      counter: [12, 10, 7,  5,  7,  9,  10, 12],
      chords:  [[0,7],[5,12],[-2,5],[3,10]],
    },
    { // W3 "Whale Spotted" — Wide open ocean
      root: 69,
      hook:    [0,  2,  5,  7,  9,  7,  5,  3],   // Soaring peak on 9 (the Dorian note!)
      counter: [12, 10, 7,  5,  3,  5,  7,  9],
      chords:  [[0,7],[-2,5],[3,10],[5,12]],
    },
    { // W4 "To the Moon" — Euphoric
      root: 71,
      hook:    [0,  2,  3,  5,  7,  9,  7,  5],   // Steady climb to peak
      counter: [12, 10, 9,  7,  5,  3,  5,  7],
      chords:  [[0,7],[3,10],[-2,5],[5,12]],
    },
    { // W5 "Full Degen" — Dark but beautiful
      root: 61,
      hook:    [0,  3,  5,  3,  2,  0,  2,  3],   // Weaving low
      counter: [12, 10, 9, 10, 12, 10, 9,  7],
      chords:  [[0,7],[5,12],[3,10],[-2,5]],
    },
    { // W6 "Margin Call" — Tension with grace
      root: 63,
      hook:    [0,  2,  3,  5,  3,  5,  7,  5],   // Hesitant ascent
      counter: [12, 10, 9,  7,  9,  7,  5,  7],
      chords:  [[0,7],[-2,5],[5,12],[3,10]],
    },
    { // W7 "Liquidation" — Bittersweet reflection
      root: 65,
      hook:    [5,  3,  2,  0,  2,  3,  5,  3],   // Start high, dip, return
      counter: [7,  9,  10, 12, 10, 9,  7,  9],
      chords:  [[0,7],[3,10],[5,12],[-2,5]],
    },
    { // W8 "GG No Re" — Defiant energy
      root: 68,
      hook:    [0,  2,  5,  3,  5,  7,  5,  3],   // Bounce pattern
      counter: [12, 10, 7,  9,  7,  5,  7,  9],
      chords:  [[0,7],[5,12],[-2,5],[3,10]],
    },
    { // W9 "Valhalla" — Transcendent peace
      root: 74,
      hook:    [0,  2,  3,  5,  7,  5,  3,  5],   // Ascending spiral
      counter: [12, 10, 9,  7,  5,  7,  9,  7],
      chords:  [[0,7],[-2,5],[3,10],[5,12]],
    },
]

// Melody placement in 32-step (2-bar) cycle — evenly spaced, half-time feel
// Each note rings for ~4 steps (one full beat), creating a legato vocal line
const MEL_POS   = [0, 4, 8, 12, 16, 20, 24, 28]
const CTR_POS   = [2, 6, 10, 14, 18, 22, 26, 30]  // Offsetting creates dialogue

// Arp pattern (sparse, breathing) — only 6 hits per bar, rest is silence
const ARP_PAT = [0, -1, 1, -1, 2, -1, -1, 3, -1, 2, -1, 1, 0, -1, -1, -1]

// Bass: quarter notes on beats 1, 2, 3, 4 — walking pattern
const BASS_WALK_A = [0, -2, 0, -5]    // Root → step down → root → 5th below
const BASS_WALK_B = [-2, 0, -5, -7]   // Walking lower

// Drum groove data
const KICK_PAT = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0]   // 1, 3, "e of 4"
const SNARE_PAT= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0]   // Backbeat: 2 & 4
const HAT_VEL  = [0.7,0,0.3,0, 0.8,0,0.3,0, 0.7,0,0.3,0, 0.8,0,0.4,0.2] // Ghost notes

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef   = useRef<AudioContext | null>(null)
    const masterRef     = useRef<GainNode | null>(null)
    const bgmRef        = useRef<{ stop: () => void; gain: GainNode } | null>(null)
    const speedRef      = useRef(1)
    const themeRef      = useRef(0)
    const noiseBufRef   = useRef<AudioBuffer | null>(null)
    const oscCountRef   = useRef(0)

    const updateAudioParams = useCallback((spd: number, theme: number) => {
        speedRef.current = spd
        themeRef.current = theme
    }, [])

    // =========================================================================
    // INIT — Lazy setup with mastering chain
    // =========================================================================
    const init = useCallback(() => {
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const ctx = new AC()
            audioCtxRef.current = ctx

            // Mastering chain: High-shelf warmth → Compression → Output
            const warmth = ctx.createBiquadFilter()
            warmth.type = 'highshelf'
            warmth.frequency.value = 8000
            warmth.gain.value = -3  // Cuts digital harshness

            const comp = ctx.createDynamicsCompressor()
            comp.threshold.value = -18; comp.knee.value = 10
            comp.ratio.value = 3.5; comp.attack.value = 0.008; comp.release.value = 0.2

            warmth.connect(comp); comp.connect(ctx.destination)
            masterRef.current = ctx.createGain()
            masterRef.current.gain.value = IS_MOBILE ? 0.25 : 0.32
            masterRef.current.connect(warmth)

            // Noise buffer — shared by all percussion
            const len = ctx.sampleRate * 2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
            noiseBufRef.current = buf
        }
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }, [])

    // =========================================================================
    // VOICE — Oscillator with envelope + optional filter + detune
    // =========================================================================
    const v = useCallback((
        freq: number, type: OscillatorType, t: number, dur: number,
        vol: number, dest: AudioNode,
        o?: { f?: number; d?: number; a?: number; r?: number }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx || oscCountRef.current >= MAX_OSC) return
        oscCountRef.current++

        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, t)
        if (o?.d) osc.detune.value = o.d

        const atk = o?.a ?? 0.02
        const rel = o?.r ?? dur
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(vol, t + atk)
        g.gain.setValueAtTime(vol * 0.85, t + atk + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t + rel)

        if (o?.f) {
            const flt = ctx.createBiquadFilter()
            flt.type = 'lowpass'
            flt.frequency.setValueAtTime(o.f, t)
            flt.frequency.exponentialRampToValueAtTime(Math.max(80, o.f * 0.08), t + rel)
            osc.connect(flt); flt.connect(g)
        } else { osc.connect(g) }

        g.connect(dest); osc.start(t); osc.stop(t + rel + 0.1)
        osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
    }, [])

    // =========================================================================
    // ENSEMBLE — 3 detuned sines = analog synth chorus (±2 cents = gentle)
    // =========================================================================
    const ens = useCallback((freq: number, t: number, dur: number, vol: number, dest: AudioNode, filt: number) => {
        const dets = [-2, 0, 2]  // Gentle beating — warm, not wobbly
        dets.forEach(d => v(freq, 'sine', t, dur, vol / 3, dest, { a: 1.5, r: dur * 0.92, f: filt, d }))
    }, [v])

    const root = useCallback(() => {
        const idx = Math.min(themeRef.current || 0, WORLDS.length - 1)
        return WORLDS[idx].root
    }, [])

    // =========================================================================
    // 🔔 PREMIUM SFX — Designed, layered, living
    // Each SFX has: transient + body + tail, with pitch slides for life
    // =========================================================================

    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m || oscCountRef.current >= MAX_OSC) return
        oscCountRef.current++
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)
        g.gain.setValueAtTime(0, ctx.currentTime)
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
        osc.connect(g); g.connect(m); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.1)
        osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
    }, [soundEnabled, init])

    // JUMP — Water droplet: sine with rising pitch slide + airy overtone
    const sfxJump = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        // Body: rising pitch slide (feels like lifting off)
        v(midi(r + 7), 'sine', t, 0.12, 0.045, m, { a: 0.003 })
        // Overtone: gentle triangle one octave up, delayed 15ms
        v(midi(r + 19), 'triangle', t + 0.015, 0.1, 0.02, m, { a: 0.004, f: 2500 })
    }, [soundEnabled, init, v, root])

    // DOUBLE JUMP — Crystalline burst: two ascending tones with shimmer
    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        v(midi(r + 14), 'sine', t, 0.09, 0.035, m, { a: 0.003 })
        v(midi(r + 19), 'triangle', t + 0.04, 0.1, 0.028, m, { a: 0.003, f: 3000 })
        // High sparkle
        v(midi(r + 26), 'sine', t + 0.07, 0.08, 0.012, m, { a: 0.002, f: 4000 })
    }, [soundEnabled, init, v, root])

    // DASH — Wind displacement: bandpass noise sweep + sub pulse
    const sfxDash = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        // Sub pulse — felt in chest
        v(midi(r - 12), 'sine', t, 0.15, 0.03, m, { f: 300, a: 0.008 })
        // Air texture
        if (noiseBufRef.current) {
            const n = ctx.createBufferSource(); n.buffer = noiseBufRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'bandpass'; f.frequency.setValueAtTime(1200, t)
            f.frequency.exponentialRampToValueAtTime(300, t + 0.18); f.Q.value = 1.5
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.01)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            n.connect(f); f.connect(g); g.connect(m); n.start(t); n.stop(t + 0.25)
        }
    }, [soundEnabled, init, v, root])

    // COLLECT — Glass chime: sine 5th + gentle pitch rise over duration
    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        // Body with gentle rising pitch (2 semitones over 120ms)
        if (oscCountRef.current < MAX_OSC) {
            oscCountRef.current++
            const osc = ctx.createOscillator(), g = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(midi(r + 12), t)
            osc.frequency.exponentialRampToValueAtTime(midi(r + 14), t + 0.12) // Gentle slide UP
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.005)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
            osc.connect(g); g.connect(m); osc.start(t); osc.stop(t + 0.2)
            osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
        }
        // 5th harmony — delayed for "bloom"
        v(midi(r + 19), 'sine', t + 0.03, 0.12, 0.025, m, { a: 0.005, f: 2800 })
    }, [soundEnabled, init, v, root])

    // POWERUP — Ascending shimmer cascade with pitch slides between notes
    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        // 4 notes, each sliding into the next — seamless
        const notes = [0, 5, 7, 12]
        notes.forEach((n, i) => {
            if (oscCountRef.current >= MAX_OSC) return
            oscCountRef.current++
            const osc = ctx.createOscillator(), g = ctx.createGain()
            osc.type = i >= 2 ? 'triangle' : 'sine'
            const startF = midi(r + 12 + n)
            const nextF = i < notes.length - 1 ? midi(r + 12 + notes[i + 1]) : startF * 1.06
            osc.frequency.setValueAtTime(startF, t + i * 0.055)
            osc.frequency.exponentialRampToValueAtTime(nextF, t + i * 0.055 + 0.04) // Slide into next
            g.gain.setValueAtTime(0, t + i * 0.055)
            g.gain.linearRampToValueAtTime(0.035, t + i * 0.055 + 0.005)
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.18)
            osc.connect(g); g.connect(m); osc.start(t + i * 0.055); osc.stop(t + i * 0.055 + 0.22)
            osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
        })
    }, [soundEnabled, init, root])

    // HIT/DEATH — Melancholy fading chord, NOT harsh. The world dims.
    const sfxHit = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        // Deep sub drop — slow decay, felt in chest
        v(midi(r - 12), 'sine', t, 0.5, 0.06, m, { a: 0.005, f: 120 })
        // Sad descending whole tone — gentle, not aggressive
        if (oscCountRef.current < MAX_OSC) {
            oscCountRef.current++
            const osc = ctx.createOscillator(), g = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(midi(r + 7), t + 0.03)
            osc.frequency.exponentialRampToValueAtTime(midi(r + 3), t + 0.4) // Gentle slide DOWN
            g.gain.setValueAtTime(0, t + 0.03); g.gain.linearRampToValueAtTime(0.035, t + 0.06)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
            osc.connect(g); g.connect(m); osc.start(t + 0.03); osc.stop(t + 0.6)
            osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
        }
        // Fading pad note — world goes quiet
        v(midi(r), 'triangle', t + 0.05, 0.6, 0.02, m, { a: 0.1, f: 400 })
    }, [soundEnabled, init, v, root])

    // SELECT — Clean tap: single filtered percussive ping
    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        v(midi(79), 'sine', ctx.currentTime, 0.07, 0.035, m, { a: 0.002, f: 3000 })
    }, [soundEnabled, init, v])

    // COMBO — Gentle glide up the Dorian scale with each combo
    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const r = root()
        const dorian = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17]
        const n = r + dorian[Math.min(combo, dorian.length - 1)]
        // Pitch SLIDES from previous degree for smoothness
        const prev = r + dorian[Math.max(0, Math.min(combo - 1, dorian.length - 1))]
        if (oscCountRef.current < MAX_OSC) {
            oscCountRef.current++
            const osc = ctx.createOscillator(), g = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(midi(prev), ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(midi(n), ctx.currentTime + 0.04)
            g.gain.setValueAtTime(0, ctx.currentTime)
            g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.008)
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
            osc.connect(g); g.connect(m); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15)
            osc.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
        }
    }, [soundEnabled, init, root])

    // MILESTONE — 3-note Dorian ascent with sustained final note
    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        v(midi(r + 12), 'sine', t, 0.2, 0.03, m, { a: 0.005 })
        v(midi(r + 14), 'sine', t + 0.08, 0.18, 0.028, m, { a: 0.005 })
        v(midi(r + 17), 'triangle', t + 0.16, 0.3, 0.035, m, { a: 0.008, f: 3000 })
    }, [soundEnabled, init, v, root])

    // LEVEL UP — 5-note Dorian run, last note held long with shimmer
    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, m = masterRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = root()
        const run = [0, 2, 3, 5, 7]
        run.forEach((s, i) => {
            const isLast = i === run.length - 1
            v(midi(r + 12 + s), 'sine', t + i * 0.06, isLast ? 0.4 : 0.12, isLast ? 0.04 : 0.03, m, { a: 0.005 })
            // Shimmer layer on last 2 notes
            if (i >= 3) v(midi(r + 24 + s), 'triangle', t + i * 0.06 + 0.01, 0.2, 0.015, m, { a: 0.005, f: 4000 })
        })
    }, [soundEnabled, init, v, root])

    // =========================================================================
    // 🌌 GENERATIVE BGM ENGINE
    // =========================================================================
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return; init()
        const ctx = audioCtxRef.current, master = masterRef.current
        if (!ctx || !master || bgmRef.current) return
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})

        let alive = true
        const BPM = 128
        const BEAT = 60 / BPM
        const S16 = BEAT / 4

        let step = 0, nextTime = ctx.currentTime + 0.15

        // === ROUTING ===
        const bgmGain = ctx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(master)
        const sc = ctx.createGain(); sc.gain.value = 1; sc.connect(bgmGain)
        const drumBus = ctx.createGain(); drumBus.gain.value = 0.5; drumBus.connect(bgmGain)

        // Melody delay — warm tape echo, dotted-8th
        const melBus = ctx.createGain(); melBus.gain.value = 0.6; melBus.connect(sc)
        const mDel = ctx.createDelay(2); mDel.delayTime.value = BEAT * 0.75
        const mFb = ctx.createGain(); mFb.gain.value = 0.22
        const mFilt = ctx.createBiquadFilter(); mFilt.type = 'lowpass'; mFilt.frequency.value = 1200
        melBus.connect(mDel); mDel.connect(mFilt); mFilt.connect(mFb); mFb.connect(mDel); mDel.connect(sc)

        // Arp delay — shorter, tighter
        const arpBus = ctx.createGain(); arpBus.gain.value = 0.35; arpBus.connect(sc)
        const aDel = ctx.createDelay(1); aDel.delayTime.value = S16 * 3
        const aFb = ctx.createGain(); aFb.gain.value = 0.15
        const aFilt = ctx.createBiquadFilter(); aFilt.type = 'lowpass'; aFilt.frequency.value = 1800
        arpBus.connect(aDel); aDel.connect(aFilt); aFilt.connect(aFb); aFb.connect(aDel); aDel.connect(sc)

        // === DRUM SYNTHESIS ===
        const kick = (t: number) => {
            if (oscCountRef.current >= MAX_OSC) return
            oscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.06)
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.065, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
            o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.27)
            o.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
            // Sidechain pump
            sc.gain.cancelScheduledValues(t); sc.gain.setValueAtTime(0.55, t)
            sc.gain.linearRampToValueAtTime(0.8, t + 0.04); sc.gain.linearRampToValueAtTime(1, t + 0.14)
        }

        const snare = (t: number) => {
            if (!noiseBufRef.current || oscCountRef.current >= MAX_OSC) return
            oscCountRef.current++
            // Body
            const o = ctx.createOscillator(), og = ctx.createGain()
            o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(100, t + 0.04)
            og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.035, t + 0.002); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
            o.connect(og); og.connect(drumBus); o.start(t); o.stop(t + 0.12)
            o.onended = () => { oscCountRef.current = Math.max(0, oscCountRef.current - 1) }
            // Noise tail
            const n = ctx.createBufferSource(); n.buffer = noiseBufRef.current
            const f = ctx.createBiquadFilter(), ng = ctx.createGain()
            f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.5
            ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.04, t + 0.004); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
            n.connect(f); f.connect(ng); ng.connect(drumBus); n.start(t); n.stop(t + 0.22)
        }

        const hat = (t: number, vel: number) => {
            if (!noiseBufRef.current || vel <= 0) return
            const n = ctx.createBufferSource(); n.buffer = noiseBufRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'; f.frequency.value = 9000
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028 * vel, t + 0.001); g.gain.exponentialRampToValueAtTime(0.001, t + 0.018)
            n.connect(f); f.connect(g); g.connect(drumBus); n.start(t); n.stop(t + 0.03)
        }

        const riser = (t: number, dur: number) => {
            if (!noiseBufRef.current) return
            const n = ctx.createBufferSource(); n.buffer = noiseBufRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'bandpass'; f.Q.value = 2
            f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3500, t + dur)
            g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.025, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.001, t + dur)
            n.connect(f); f.connect(g); g.connect(bgmGain); n.start(t); n.stop(t + dur + 0.1)
        }

        // === MAIN SCHEDULER ===
        const sched = (s: number, t: number) => {
            const wi = Math.min(themeRef.current || 0, WORLDS.length - 1)
            const w = WORLDS[wi]; const rt = w.root; const intens = Math.min(wi, 5)

            const ps = s % 256
            const bar = Math.floor(ps / 16)
            const s16 = ps % 16

            // Sections: INTRO(0-3) VERSE(4-7) CHORUS(8-11) BRIDGE(12-15)
            const sec = bar < 4 ? 0 : bar < 8 ? 1 : bar < 12 ? 2 : 3
            const ci = Math.floor(bar / 4) % 4
            const ch = w.chords[ci]

            // ── 1. SUB DRONE ──
            if (ps === 0) {
                const dur = S16 * 254
                v(midi(rt - 24), 'sine', t, dur, 0.022 + intens * 0.002, sc, { a: 3, r: dur * 0.9, f: 70 })
            }

            // ── 2. ENSEMBLE PAD — blooms every bar ──
            if (s16 === 0) {
                const padDur = S16 * 15.5
                const padVol = (sec === 2 ? 0.04 : 0.03) + intens * 0.002
                ch.forEach((off: number) => {
                    ens(midi(rt + off), t, padDur, padVol, sc, 700 + sec * 80 + intens * 60)
                })
            }

            // ── 3. LEAD MELODY — stepwise Dorian, through tape delay ──
            if (sec >= 1 && intens >= 1) {
                const tp = ps % 32
                const mi = MEL_POS.indexOf(tp)
                if (mi >= 0) {
                    let play = false
                    if (sec === 1) play = true                      // Verse: all 8 notes
                    if (sec === 2) play = true                      // Chorus: all 8 notes
                    if (sec === 3) play = (mi % 2 === 0)            // Bridge: sparse echoes

                    if (play) {
                        const note = rt + 12 + w.hook[mi]
                        const dur = S16 * 3.8  // Nearly a full beat — legato
                        const vol = sec === 2 ? 0.035 : 0.025
                        v(midi(note), 'sine', t, dur, vol, melBus, { a: 0.012, f: 1800 + intens * 150, r: dur * 0.8 })
                    }
                }
            }

            // ── 4. COUNTER MELODY — chorus only, triangle, offset rhythm ──
            if (sec === 2 && intens >= 2) {
                const tp = ps % 32
                const ci2 = CTR_POS.indexOf(tp)
                if (ci2 >= 0 && ci2 < w.counter.length) {
                    const note = rt + w.counter[ci2]
                    v(midi(note), 'triangle', t, S16 * 2.5, 0.018 + intens * 0.002, melBus, { a: 0.015, f: 1600 + intens * 100, r: S16 * 2 })
                }
            }

            // ── 5. GLASS ARP — chorus, sparse plucks through delay ──
            if (sec === 2 && intens >= 2) {
                const arpV = ARP_PAT[s16]
                if (arpV >= 0) {
                    const note = rt + 12 + ch[arpV % ch.length]
                    v(midi(note), 'sine', t, S16 * 1.5, 0.012, arpBus, { a: 0.004, f: 2000 + intens * 150, r: S16 * 1.2 })
                }
            }

            // ── 6. WALKING BASS — verse + chorus, warm sine ──
            if (sec >= 1 && sec <= 2 && intens >= 2) {
                if (s16 % 4 === 0) {
                    const beat = s16 / 4
                    const walk = bar % 2 === 0 ? BASS_WALK_A : BASS_WALK_B
                    const bassNote = rt - 12 + ch[0] + walk[beat]
                    v(midi(bassNote), 'sine', t, S16 * 3.5, 0.06 + intens * 0.005, sc, { a: 0.01, f: 180, r: S16 * 3 })
                }
            }

            // ── 7-9. DRUMS — build through sections ──
            if (sec >= 1 && sec <= 2 && intens >= 2) {
                // Kick: verse has soft kick, chorus has punchy
                if (KICK_PAT[s16] === 1) kick(t)
                // Snare: chorus only
                if (sec === 2 && SNARE_PAT[s16] === 1) snare(t)
                // Hats: busier in chorus
                const hv = HAT_VEL[s16]
                if (hv > 0) {
                    if (sec === 2 || s16 % 4 === 0) hat(t, hv * (0.5 + intens * 0.04))
                }
                // Fill before chorus (last bar of verse)
                if (sec === 1 && bar === 7 && s16 >= 12 && s16 % 2 === 0) snare(t)
            }

            // ── 10. FX RISERS — transitions ──
            // Riser before chorus
            if (sec === 1 && bar === 7 && s16 === 0 && intens >= 2) {
                riser(t, S16 * 16)
            }
            // Sub impact on chorus downbeat
            if (sec === 2 && bar === 8 && s16 === 0 && intens >= 3) {
                v(midi(rt - 12), 'sine', t, S16 * 8, 0.04, sc, { a: 0.003, f: 130 })
            }
            // Bridge riser to loop
            if (sec === 3 && bar === 14 && s16 === 0 && intens >= 2) {
                riser(t, S16 * 32)
            }
        }

        // === SCHEDULER — speed BARELY affects music ===
        let timer: ReturnType<typeof setTimeout>
        const LOOK = 50, AHEAD = 0.25

        const loop = () => {
            if (!alive || !audioCtxRef.current) return
            // CRITICAL: dampen speed coupling — at 3x game speed, music is only 1.16x
            const rawSpd = Math.max(1, speedRef.current || 1)
            const musicSpd = 1 + (rawSpd - 1) * 0.08
            const interval = S16 / musicSpd

            while (nextTime < audioCtxRef.current.currentTime + AHEAD) {
                sched(step, nextTime)
                nextTime += interval
                step++
                if (step > 500_000) step = 0
            }
            timer = setTimeout(loop, LOOK)
        }

        // 4-second sunrise fade in
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 4)
        timer = setTimeout(loop, LOOK)

        // Tab visibility
        const onVis = () => {
            if (document.hidden) {
                alive = false; clearTimeout(timer)
                try { bgmGain.gain.cancelScheduledValues(ctx.currentTime); bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime); bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3) } catch {}
            } else if (!alive && bgmRef.current) {
                alive = true; nextTime = ctx.currentTime + 0.15
                bgmGain.gain.cancelScheduledValues(ctx.currentTime); bgmGain.gain.setValueAtTime(0, ctx.currentTime); bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
                timer = setTimeout(loop, LOOK)
            }
        }
        document.addEventListener('visibilitychange', onVis)

        bgmRef.current = {
            stop: () => {
                alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis)
                try { bgmGain.gain.cancelScheduledValues(ctx.currentTime); bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime); bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5) } catch {}
            },
            gain: bgmGain,
        }
    }, [soundEnabled, init, v, ens])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmRef.current) { bgmRef.current.stop(); bgmRef.current = null }
    }, [])

    return {
        playTone, updateAudioParams,
        sfxJump, sfxDoubleJump, sfxDash, sfxCollect, sfxPowerup,
        sfxHit, sfxSelect, sfxCombo, sfxMilestone, sfxLevelUp,
        startBackgroundMusic, stopBackgroundMusic,
        unlockAudio: init,
    }
}
