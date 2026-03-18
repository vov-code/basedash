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
// MUSIC THEORY — Premium, minimal, harmonic
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// World keys — each world has its own emotional key that transitions smoothly
// Using relative minor/major relationships for seamless modulation
const WORLD_KEYS = [
    { root: 57, name: 'Am', feel: 'mysterious' },   // A minor  (World 0 — Genesis)
    { root: 60, name: 'C', feel: 'bright' },       // C major  (World 1 — warming up)
    { root: 62, name: 'Dm', feel: 'driving' },      // D minor  (World 2 — getting serious)
    { root: 64, name: 'Em', feel: 'intense' },       // E minor  (World 3 — dark energy)
    { root: 65, name: 'F', feel: 'euphoric' },      // F major  (World 4 — euphoria)
    { root: 67, name: 'G', feel: 'triumphant' },    // G major  (World 5 — peak)
    { root: 69, name: 'Am8', feel: 'transcendent' },   // A minor octave up (World 6+)
    { root: 72, name: 'C8', feel: 'celestial' },      // C major octave up (World 7+)
]

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const bgmNodesRef = useRef<{ stop: () => void, gain: GainNode } | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
    const noiseBufferRef = useRef<AudioBuffer | null>(null)

    const updateAudioParams = useCallback((speedMultiplier: number, themeIndex: number) => {
        // NOTE: Music speeds up with game speed but NEVER slows below base BPM.
        // This means chill market won't slow music, but faster worlds speed it up.
        bgmSpeedRef.current = speedMultiplier
        bgmThemeRef.current = themeIndex
    }, [])

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as any).webkitAudioContext
            const ctx = new AC()
            audioCtxRef.current = ctx

            // Gentle master compression — musical, not squashed
            const comp = ctx.createDynamicsCompressor()
            comp.threshold.value = -20
            comp.knee.value = 15
            comp.ratio.value = 4
            comp.attack.value = 0.01
            comp.release.value = 0.2
            comp.connect(ctx.destination)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = 0.3
            masterGainRef.current.connect(comp)

            // Noise buffer for percussion
            const len = ctx.sampleRate * 2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
            noiseBufferRef.current = buf
        }
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }, [])

    // =========================================================================
    // SYNTH VOICE — clean, warm, filtered
    // =========================================================================
    const voice = useCallback((
        freq: number, type: OscillatorType, t: number, dur: number,
        vol: number, dest: AudioNode,
        opts?: { filt?: number, det?: number, atk?: number, rel?: number }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx) return
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
            osc.connect(f); f.connect(g)
        } else {
            osc.connect(g)
        }
        g.connect(dest)
        osc.start(t); osc.stop(t + r + 0.1)
    }, [])

    // =========================================================================
    // SIMPLE TONE (SFX compat)
    // =========================================================================
    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)
        g.gain.setValueAtTime(0, ctx.currentTime)
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.008)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
        osc.connect(g); g.connect(m)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05)
    }, [soundEnabled, initAudio])

    // =========================================================================
    // PLEASANT SFX — warm, musical, satisfying
    // =========================================================================
    const sfxJump = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
        voice(523, 'sine', t, 0.1, 0.05, m, { atk: 0.004 })
        voice(784, 'sine', t + 0.012, 0.09, 0.03, m, { atk: 0.004 })
    }, [soundEnabled, initAudio, voice])

    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
        voice(659, 'sine', t, 0.08, 0.04, m, { atk: 0.003 })
        voice(988, 'triangle', t + 0.045, 0.1, 0.03, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice])

    const sfxDash = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(220, 'triangle', ctx.currentTime, 0.14, 0.035, m, { filt: 700, atk: 0.01 })
    }, [soundEnabled, initAudio, voice])

    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
        voice(880, 'sine', t, 0.13, 0.045, m, { atk: 0.003 })
        voice(1109, 'sine', t + 0.035, 0.15, 0.03, m, { atk: 0.003 })
        voice(1319, 'sine', t + 0.08, 0.12, 0.02, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice])

    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
            ;[523, 659, 784, 1047, 1319].forEach((f, i) =>
                voice(f, 'sine', t + i * 0.055, 0.18 - i * 0.02, 0.035 - i * 0.004, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice])

    const sfxHit = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
        // Soft thud
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.setValueAtTime(140, t)
        o.frequency.exponentialRampToValueAtTime(35, t + 0.18)
        g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.3)
        // Sad descend
        voice(370, 'triangle', t + 0.05, 0.25, 0.03, m, { filt: 500 })
        voice(311, 'sine', t + 0.13, 0.2, 0.025, m, { filt: 350 })
    }, [soundEnabled, initAudio, voice])

    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(784, 'sine', ctx.currentTime, 0.06, 0.035, m, { atk: 0.002 })
    }, [soundEnabled, initAudio, voice])

    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
        const n = 60 + Math.min(combo, 12) * 2
        voice(midi(n), 'sine', t, 0.11, 0.04, m, { atk: 0.003 })
        voice(midi(n + 7), 'sine', t + 0.035, 0.12, 0.025, m, { atk: 0.003 })
    }, [soundEnabled, initAudio, voice])

    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
            ;[523, 659, 784, 1047, 1319].forEach((f, i) => {
                voice(f, 'sine', t + i * 0.07, 0.22, 0.035, m, { atk: 0.005 })
                if (i >= 3) voice(f, 'triangle', t + i * 0.07, 0.25, 0.02, m, { atk: 0.005 })
            })
    }, [soundEnabled, initAudio, voice])

    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return; const t = ctx.currentTime
            ;[60, 64, 67, 72, 76, 79, 84].forEach((n, i) =>
                voice(midi(n), 'sine', t + i * 0.05, 0.13, 0.03, m, { atk: 0.003 }))
    }, [soundEnabled, initAudio, voice])

    // =========================================================================
    // PREMIUM BACKGROUND MUSIC — Melodious, Minimal, Harmonic
    // =========================================================================
    //
    // Design principles:
    // 1. CONSTANT TEMPO — never slows down (chill market doesn't affect music)
    // 2. MINIMAL notes — space between notes makes melody breathe
    // 3. SMOOTH world transitions — only the key changes, smoothly
    // 4. WARM tones — sine pads, gentle triangle leads, subtle movement
    // 5. REPEATING motifs — familiar patterns that evolve with each world
    //
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return
        if (ctx.state === 'suspended') ctx.resume().catch(() => { })

        let alive = true
        const BPM = 140
        const BEAT = 60 / BPM
        const S16 = BEAT / 4
        const S8 = BEAT / 2

        let step = 0
        let nextTime = ctx.currentTime + 0.15

        // ===================================================================
        // AUDIO ROUTING — Bus architecture for pro mixing
        // ===================================================================
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain compressor bus — everything musical ducks under the kick
        const scGain = ctx.createGain()
        scGain.gain.value = 1
        scGain.connect(bgmGain)

        // Drum bus with slight compression feel
        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.8
        drumBus.connect(bgmGain)

        // 808 sub bass bus — separate for clean low end
        const bassBus = ctx.createGain()
        bassBus.gain.value = 0.9
        bassBus.connect(scGain)

        // Pad bus with low-pass for warmth
        const padBus = ctx.createGain()
        padBus.gain.value = 0.55
        padBus.connect(scGain)

        // Arp/melody bus with stereo delay
        const arpBus = ctx.createGain()
        arpBus.gain.value = 0.7
        const arpDelay = ctx.createDelay(2)
        const arpDelFb = ctx.createGain()
        const arpDelFilt = ctx.createBiquadFilter()
        arpDelay.delayTime.value = S8 * 0.75  // Dotted sixteenth for rhythmic delay
        arpDelFb.gain.value = 0.28
        arpDelFilt.type = 'lowpass'
        arpDelFilt.frequency.value = 2200
        arpBus.connect(scGain)            // dry path
        arpBus.connect(arpDelay)          // wet send
        arpDelay.connect(arpDelFilt)
        arpDelFilt.connect(arpDelFb)
        arpDelFb.connect(arpDelay)
        arpDelay.connect(scGain)          // wet return

        // Perc bus — lighter elements
        const percBus = ctx.createGain()
        percBus.gain.value = 0.5
        percBus.connect(bgmGain)

        // FX bus — risers, sweeps
        const fxBus = ctx.createGain()
        fxBus.gain.value = 0.35
        fxBus.connect(scGain)

        // ===================================================================
        // DRUM INSTRUMENTS — Phonk style
        // ===================================================================

        // 808 Kick — deep sub with pitch sweep
        const kick808 = (t: number, vel: number) => {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(150 * vel, t)
            o.frequency.exponentialRampToValueAtTime(28, t + 0.12)
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.7 * vel, t + 0.003)
            g.gain.setValueAtTime(0.65 * vel, t + 0.04)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
            o.connect(g); g.connect(drumBus)
            o.start(t); o.stop(t + 0.4)
            // Sub click for attack
            const click = ctx.createOscillator(), cg = ctx.createGain()
            click.type = 'square'
            click.frequency.setValueAtTime(800, t)
            click.frequency.exponentialRampToValueAtTime(60, t + 0.015)
            cg.gain.setValueAtTime(0.15 * vel, t)
            cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02)
            click.connect(cg); cg.connect(drumBus)
            click.start(t); click.stop(t + 0.03)
            // Heavy sidechain pump
            scGain.gain.cancelScheduledValues(t)
            scGain.gain.setValueAtTime(0.25, t)
            scGain.gain.linearRampToValueAtTime(0.5, t + 0.04)
            scGain.gain.linearRampToValueAtTime(1, t + 0.18)
        }

        // Clap — layered noise + tonal body
        const clap = (t: number, vel: number) => {
            if (!noiseBufferRef.current) return
            // Noise burst (3 micro-hits for realism)
            for (let i = 0; i < 3; i++) {
                const n = ctx.createBufferSource()
                n.buffer = noiseBufferRef.current
                const nf = ctx.createBiquadFilter(), ng = ctx.createGain()
                nf.type = 'bandpass'; nf.frequency.value = 2800; nf.Q.value = 0.6
                const offset = i * 0.008
                ng.gain.setValueAtTime(0, t + offset)
                ng.gain.linearRampToValueAtTime(0.22 * vel, t + offset + 0.002)
                ng.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09)
                n.connect(nf); nf.connect(ng); ng.connect(drumBus)
                n.start(t + offset); n.stop(t + offset + 0.12)
            }
            // Tonal body
            const o = ctx.createOscillator(), og = ctx.createGain()
            o.type = 'triangle'
            o.frequency.setValueAtTime(200, t)
            o.frequency.exponentialRampToValueAtTime(120, t + 0.05)
            og.gain.setValueAtTime(0.12 * vel, t + 0.003)
            og.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
            o.connect(og); og.connect(drumBus)
            o.start(t); o.stop(t + 0.1)
        }

        // Crispy closed hi-hat
        const hihatClosed = (t: number, vel: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'; f.frequency.value = 8500
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.14 * vel, t + 0.001)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
            n.connect(f); f.connect(g); g.connect(drumBus)
            n.start(t); n.stop(t + 0.04)
        }

        // Open hi-hat — longer decay
        const hihatOpen = (t: number, vel: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'; f.frequency.value = 7000
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.12 * vel, t + 0.002)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
            n.connect(f); f.connect(g); g.connect(drumBus)
            n.start(t); n.stop(t + 0.15)
        }

        // Rim shot — metallic perc
        const rim = (t: number, vel: number) => {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'square'
            o.frequency.setValueAtTime(440, t)
            o.frequency.exponentialRampToValueAtTime(280, t + 0.02)
            g.gain.setValueAtTime(0.08 * vel, t)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
            o.connect(g); g.connect(percBus)
            o.start(t); o.stop(t + 0.04)
        }

        // ===================================================================
        // MUSICAL THEORY — Dark minor progressions
        // ===================================================================

        // Chord progressions — dark phonk minor feel
        // i - bVI - bVII - V (dramatic tension)
        const PROGS = [
            [[0, 3, 7], [0, 3, 7, 10]],      // i minor (with optional 7th)
            [[-4, 0, 3], [-4, 0, 3, 7]],      // bVI major
            [[-2, 2, 5], [-2, 2, 5, 9]],      // bVII major
            [[-5, -1, 2], [-5, -1, 2, 7]],    // V major (dominant)
        ]

        // Arp patterns — each is 16 steps, offsets from chord tones
        // These create evolving melodic interest over the chord
        const ARP_PATTERNS = [
            // Pattern A: Rising arp with octave leap
            [0, -1, 1, -1, 2, -1, 0, -1, 1, -1, 2, -1, 0, 1, 2, 0],
            // Pattern B: Descending with bounce  
            [2, -1, 1, -1, 0, -1, 2, 1, 0, -1, 1, -1, 2, -1, 0, -1],
            // Pattern C: Syncopated hits
            [0, -1, -1, 1, -1, 2, -1, -1, 0, -1, -1, 2, -1, 1, -1, 0],
            // Pattern D: Call and response
            [2, 1, 0, -1, -1, -1, -1, -1, 0, 1, 2, -1, -1, -1, -1, -1],
        ]

        // Bass pattern — rhythmic 808 slides
        const BASS_PATTERNS = [
            // Phonk bounce — syncopated
            [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            // Driving straight
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            // Trap-style
            [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1],
            // Half-time heavy
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        ]

        // Hi-hat swing patterns (velocity multipliers, 0 = skip)
        const HAT_PATTERNS = [
            // Standard with swing ghost notes
            [1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.3],
            // Trap rolls on fills
            [1, 0.4, 0.7, 0.4, 1, 0.4, 0.7, 0.4, 1, 0.5, 0.8, 0.5, 1, 0.6, 0.9, 1],
            // Sparse groove
            [1, 0, 0.5, 0, 1, 0, 0.4, 0, 1, 0, 0.5, 0, 1, 0.3, 0.6, 0],
        ]

        // ===================================================================
        // MAIN SCHEDULER — 64-step phrases (4 bars of 16 steps)
        // ===================================================================
        const schedule = (s: number, t: number) => {
            const world = bgmThemeRef.current || 0
            const wk = WORLD_KEYS[Math.min(world, WORLD_KEYS.length - 1)]
            const root = wk.root

            const phrase = Math.floor(s / 64)       // Full phrase (4 bars)
            const phraseStep = s % 64                // Position in phrase
            const bar = Math.floor(phraseStep / 16)  // Current bar (0-3)
            const s16 = phraseStep % 16              // Step within bar

            const chordIdx = bar % 4
            const chord = PROGS[chordIdx]
            const chordNotes = chord[0]              // Simple triad
            const chord7 = chord[1]                  // Extended (7th)
            const bassRoot = root + chordNotes[0]

            // Intensity ramps up with world progression (0-5)
            const intensity = Math.min(world, 5)
            const isIntro = phrase === 0 && phraseStep < 32  // First 2 bars are gentler

            // =============================================================
            // LAYER 1: Dark atmospheric pad — always present
            // =============================================================
            if (s16 === 0) {
                const padDur = S16 * 15.8
                const padChord = intensity >= 3 ? chord7 : chordNotes

                padChord.forEach((offset: number) => {
                    const n = root + offset
                    // Warm sine pad
                    voice(midi(n), 'sine', t, padDur, 0.04 + intensity * 0.004, padBus, {
                        atk: 0.3, rel: padDur * 0.9, filt: 800 + intensity * 200
                    })
                    // Detuned saw layer for thickness (intensity >= 2)
                    if (intensity >= 2) {
                        voice(midi(n), 'sawtooth', t, padDur, 0.012, padBus, {
                            atk: 0.5, rel: padDur * 0.8, filt: 600 + intensity * 150, det: 6
                        })
                    }
                    // Triangle octave shimmer (intensity >= 4)
                    if (intensity >= 4) {
                        voice(midi(n + 12), 'triangle', t, padDur, 0.008, padBus, {
                            atk: 0.4, rel: padDur * 0.7, filt: 1200
                        })
                    }
                })
            }

            // =============================================================
            // LAYER 2: 808 Sub Bass — phonk bounce
            // =============================================================
            if (intensity >= 1 && !isIntro) {
                const bassPatIdx = intensity >= 3 ? (bar % 2 === 0 ? 0 : 2) : 3
                const bassPat = BASS_PATTERNS[bassPatIdx]
                if (bassPat[s16]) {
                    const bNote = bassRoot - 12
                    const bDur = S16 * 2.5
                    // Deep 808 sine sub
                    voice(midi(bNote - 12), 'sine', t, bDur, 0.2 + intensity * 0.02, bassBus, {
                        atk: 0.005, filt: 120
                    })
                    // Saw grit layer
                    voice(midi(bNote), 'sawtooth', t, bDur * 0.7, 0.06, bassBus, {
                        atk: 0.003, filt: 400 + intensity * 100, rel: bDur * 0.5
                    })
                    // Pitch slide on specific beats for phonk feel
                    if (s16 === 6 || s16 === 14) {
                        voice(midi(bNote + 2), 'sine', t, S16 * 0.8, 0.08, bassBus, {
                            atk: 0.002, filt: 180
                        })
                    }
                }
            }

            // =============================================================
            // LAYER 3: Kick + Clap — core groove
            // =============================================================
            if (intensity >= 2 && !isIntro) {
                // Kick: beats 1 and 3 (s16 0 and 8), plus occasional syncopation
                if (s16 === 0 || s16 === 8) {
                    kick808(t, 0.85 + intensity * 0.03)
                }
                // Extra syncopated kick at high intensity
                if (intensity >= 4 && (s16 === 6 || s16 === 13)) {
                    kick808(t, 0.5)
                }

                // Clap: beat 2 and 4 (s16 4 and 12)
                if (s16 === 4 || s16 === 12) {
                    clap(t, 0.75 + intensity * 0.04)
                }
            }

            // =============================================================
            // LAYER 4: Hi-hats — crispy with swing
            // =============================================================
            if (intensity >= 2 && !isIntro) {
                const hatPatIdx = intensity >= 4 ? 1 : (intensity >= 3 ? 0 : 2)
                const hatPat = HAT_PATTERNS[hatPatIdx]
                const hatVel = hatPat[s16]
                if (hatVel > 0) {
                    hihatClosed(t, hatVel * (0.7 + intensity * 0.06))
                }
                // Open hat on offbeats for groove
                if (s16 === 6 || s16 === 14) {
                    hihatOpen(t, 0.5 + intensity * 0.05)
                }
                // Extra open hat accent in phrase transitions
                if (phraseStep === 63) {
                    hihatOpen(t, 0.8)
                }
            }

            // =============================================================
            // LAYER 5: Rim/perc — rhythmic interest
            // =============================================================
            if (intensity >= 3) {
                // Rim on offbeats for groove
                if (s16 === 2 || s16 === 10) {
                    rim(t, 0.6 + intensity * 0.05)
                }
                // Fill on last bar of phrase
                if (bar === 3 && s16 >= 12 && s16 % 2 === 0) {
                    rim(t, 0.4 + (s16 - 12) * 0.1)
                }
            }

            // =============================================================
            // LAYER 6: Melodic arp — evolving with world
            // =============================================================
            if (intensity >= 1) {
                const arpPatIdx = (phrase + bar) % ARP_PATTERNS.length
                const arpPat = ARP_PATTERNS[arpPatIdx]
                const arpVal = arpPat[s16]

                if (arpVal >= 0) {
                    // Map arp value to chord tone
                    const tones = chordNotes
                    const toneIdx = arpVal % tones.length
                    const octaveBoost = arpVal >= tones.length ? 12 : 0
                    const arpNote = root + 12 + tones[toneIdx] + octaveBoost
                    const arpDur = S16 * 1.8

                    // Clean pluck sound
                    voice(midi(arpNote), 'sawtooth', t, arpDur, 0.035, arpBus, {
                        atk: 0.003, filt: 2000 + intensity * 400, rel: arpDur * 0.6
                    })
                    // Square layer for width
                    if (intensity >= 2) {
                        voice(midi(arpNote), 'square', t, arpDur * 0.8, 0.02, arpBus, {
                            atk: 0.003, filt: 2500 + intensity * 300, rel: arpDur * 0.5, det: 4
                        })
                    }
                    // High octave shimmer at peak
                    if (intensity >= 5 && s16 % 4 === 0) {
                        voice(midi(arpNote + 12), 'sine', t, arpDur * 0.6, 0.015, arpBus, {
                            atk: 0.005, filt: 4000
                        })
                    }
                }
            }

            // =============================================================
            // LAYER 7: Lead melody — top line (intensity >= 3)
            // =============================================================
            if (intensity >= 3 && bar < 3) {
                // Play lead on specific beats for call-and-response feel
                const leadBeats = [0, 3, 6, 10]  // Syncopated hits
                if (leadBeats.includes(s16)) {
                    // Choose melodic note based on position
                    const leadOptions = [7, 5, 3, 0, 10, 12]  // Scale degrees
                    const leadIdx = (s16 + bar * 3) % leadOptions.length
                    const leadNote = root + 12 + leadOptions[leadIdx]
                    const leadDur = S16 * 3

                    voice(midi(leadNote), 'sawtooth', t, leadDur, 0.03, arpBus, {
                        atk: 0.005, filt: 3000 + intensity * 500, rel: leadDur * 0.7
                    })
                    voice(midi(leadNote), 'triangle', t, leadDur, 0.025, arpBus, {
                        atk: 0.008, filt: 2000, rel: leadDur * 0.6
                    })
                }
            }

            // =============================================================
            // LAYER 8: Sub drone — constant low rumble (always)
            // =============================================================
            if (phraseStep === 0) {
                // Drone on root note, very low
                const droneDur = S16 * 62
                voice(midi(root - 24), 'sine', t, droneDur, 0.025 + intensity * 0.005, bassBus, {
                    atk: 1.0, rel: droneDur * 0.9, filt: 80
                })
            }

            // =============================================================
            // LAYER 9: Riser FX — build tension at phrase boundaries
            // =============================================================
            if (intensity >= 2 && phraseStep >= 56 && s16 === 0) {
                // Rising noise sweep in last 2 bars of phrase
                if (noiseBufferRef.current) {
                    const rn = ctx.createBufferSource()
                    rn.buffer = noiseBufferRef.current
                    const rf = ctx.createBiquadFilter(), rg = ctx.createGain()
                    rf.type = 'bandpass'
                    rf.frequency.setValueAtTime(400, t)
                    rf.frequency.exponentialRampToValueAtTime(3000, t + S16 * 7)
                    rf.Q.value = 2
                    const riseVol = 0.04 + intensity * 0.01
                    rg.gain.setValueAtTime(0.001, t)
                    rg.gain.linearRampToValueAtTime(riseVol, t + S16 * 6)
                    rg.gain.linearRampToValueAtTime(0.001, t + S16 * 7.5)
                    rn.connect(rf); rf.connect(rg); rg.connect(fxBus)
                    rn.start(t); rn.stop(t + S16 * 8)
                }
            }

            // =============================================================
            // LAYER 10: Impact on phrase downbeat (intensity >= 3)
            // =============================================================
            if (intensity >= 3 && phraseStep === 0 && phrase > 0) {
                // Impact cymbal (reversed noise feel)
                if (noiseBufferRef.current) {
                    const imp = ctx.createBufferSource()
                    imp.buffer = noiseBufferRef.current
                    const impF = ctx.createBiquadFilter(), impG = ctx.createGain()
                    impF.type = 'lowpass'
                    impF.frequency.setValueAtTime(8000, t)
                    impF.frequency.exponentialRampToValueAtTime(500, t + 0.6)
                    impG.gain.setValueAtTime(0.08, t)
                    impG.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
                    imp.connect(impF); impF.connect(impG); impG.connect(fxBus)
                    imp.start(t); imp.stop(t + 1.0)
                }
                // Low boom
                voice(midi(root - 12), 'sine', t, 0.6, 0.12, fxBus, {
                    atk: 0.005, filt: 200
                })
            }
        }

        // === SCHEDULER LOOP (constant BPM, never changes) ===
        let timer: ReturnType<typeof setTimeout>
        const LOOK = 40       // check every 40ms (tighter for 140 BPM)
        const AHEAD = 0.25    // schedule 250ms ahead

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

        bgmNodesRef.current = {
            stop: () => {
                alive = false
                clearTimeout(timer)
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
        if (bgmNodesRef.current) { bgmNodesRef.current.stop(); bgmNodesRef.current = null }
    }, [])

    return {
        playTone, updateAudioParams,
        sfxJump, sfxDoubleJump, sfxDash, sfxCollect, sfxPowerup,
        sfxHit, sfxSelect, sfxCombo, sfxMilestone, sfxLevelUp,
        startBackgroundMusic, stopBackgroundMusic,
        unlockAudio: initAudio,
    }
}
