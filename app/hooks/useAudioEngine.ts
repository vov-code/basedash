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
        const BPM = 120  // Relaxed, groovy tempo — NEVER changes
        const BEAT = 60 / BPM  // 0.5s per beat
        const S16 = BEAT / 4   // 0.125s per 16th note

        let step = 0
        let nextTime = ctx.currentTime + 0.2

        // --- Audio buses ---
        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmGain.connect(master)

        // Sidechain (gentle pump on kick)
        const scGain = ctx.createGain()
        scGain.gain.value = 1
        scGain.connect(bgmGain)

        const drumBus = ctx.createGain()
        drumBus.gain.value = 0.75
        drumBus.connect(bgmGain)

        // Melody with lush stereo delay
        const melBus = ctx.createGain()
        melBus.gain.value = 0.9
        const del = ctx.createDelay(2)
        const delFb = ctx.createGain()
        const delFilt = ctx.createBiquadFilter()
        del.delayTime.value = BEAT * 0.75  // Dotted eighth = classic feel
        delFb.gain.value = 0.3
        delFilt.type = 'lowpass'
        delFilt.frequency.value = 1800
        melBus.connect(scGain)        // dry
        melBus.connect(del)           // wet send
        del.connect(delFilt)
        delFilt.connect(delFb)
        delFb.connect(del)
        del.connect(scGain)           // wet return

        const padBus = ctx.createGain()
        padBus.gain.value = 0.6
        padBus.connect(scGain)

        const bassBus = ctx.createGain()
        bassBus.gain.value = 0.85
        bassBus.connect(scGain)

        // --- Drums ---
        const kick = (t: number, v: number) => {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(75 * v, t)
            o.frequency.exponentialRampToValueAtTime(30, t + 0.1)
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.55 * v, t + 0.004)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
            o.connect(g); g.connect(drumBus)
            o.start(t); o.stop(t + 0.25)
            // gentle sidechain
            scGain.gain.setValueAtTime(0.4, t)
            scGain.gain.linearRampToValueAtTime(1, t + 0.12)
        }

        const snare = (t: number, v: number) => {
            if (!noiseBufferRef.current) return
            const o = ctx.createOscillator(), og = ctx.createGain()
            o.type = 'triangle'
            o.frequency.setValueAtTime(180, t)
            o.frequency.exponentialRampToValueAtTime(100, t + 0.06)
            og.gain.setValueAtTime(0, t)
            og.gain.linearRampToValueAtTime(0.25 * v, t + 0.003)
            og.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
            o.connect(og); og.connect(drumBus)
            o.start(t); o.stop(t + 0.1)
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const nf = ctx.createBiquadFilter(), ng = ctx.createGain()
            nf.type = 'bandpass'; nf.frequency.value = 3500; nf.Q.value = 0.7
            ng.gain.setValueAtTime(0, t)
            ng.gain.linearRampToValueAtTime(0.3 * v, t + 0.003)
            ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
            n.connect(nf); nf.connect(ng); ng.connect(drumBus)
            n.start(t); n.stop(t + 0.12)
        }

        const hat = (t: number, v: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource()
            n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'; f.frequency.value = 9000
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.18 * v, t + 0.002)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
            n.connect(f); f.connect(g); g.connect(drumBus)
            n.start(t); n.stop(t + 0.06)
        }

        // =================================================================
        // CHORD PROGRESSION: i - VI - III - VII (natural minor)
        // This is the "epic emotional" progression — Avicii, Waterflame, etc.
        // Mapped to intervals relative to root: [0, 8, 3, 10]
        // =================================================================
        const PROG = [0, 8, 3, 10]  // i - VI - III - VII semitones from root

        // =================================================================
        // MELODY — 4 phrases, each 16 steps. Minimal, singable, harmonious.
        // Values = semitone offset from chord root. 0 = rest.
        // Only uses intervals: unison(0), 3rd(3/4), 5th(7), octave(12), 9th(14)
        // These intervals are ALWAYS consonant regardless of key.
        // =================================================================
        const MEL = [
            // A: Gentle opening — ascending breath
            [12, 0, 0, 0, 7, 0, 0, 12, 0, 0, 14, 0, 12, 0, 0, 0],
            // B: Playful response — bouncing down
            [14, 0, 12, 0, 0, 0, 7, 0, 0, 0, 3, 0, 0, 0, 0, 0],
            // C: Building tension — pushing up
            [7, 0, 0, 12, 0, 0, 14, 0, 0, 0, 0, 0, 12, 0, 7, 0],
            // D: Resolution — coming home
            [12, 0, 0, 0, 0, 7, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
        ]

        // =================================================================
        // SONG STRUCTURE — builds with world progress
        // world 0-1: pad + melody only (dreamy)
        // world 2-3: add light drums + bass (grooving)
        // world 4+:  full beat + arp layer (driving)
        // =================================================================

        const schedule = (s: number, t: number) => {
            const world = bgmThemeRef.current || 0

            // Get root note for current world — smooth key changes!
            const wk = WORLD_KEYS[Math.min(world, WORLD_KEYS.length - 1)]
            const root = wk.root

            // Song position
            const bar = Math.floor(s / 16) // which bar we're in
            const s16 = s % 16             // position in bar
            const chordIdx = bar % 4       // which chord in progression
            const chordRoot = root + PROG[chordIdx]

            // Intensity ramps up with world
            const intensity = Math.min(world, 5)

            // ----- PAD CHORD (always plays — the harmonic foundation) -----
            if (s16 === 0) {
                const notes = [chordRoot, chordRoot + 3, chordRoot + 7]
                if (intensity >= 3) notes.push(chordRoot + 12)
                const dur = S16 * 15.5

                notes.forEach(n => {
                    // Warm sine pad — the core sound
                    voice(midi(n), 'sine', t, dur, 0.055, padBus, {
                        atk: 0.25, rel: dur, filt: 1200 + intensity * 200
                    })
                    // Subtle shimmer layer (from world 2+)
                    if (intensity >= 2) {
                        voice(midi(n), 'triangle', t, dur, 0.02, padBus, {
                            atk: 0.3, rel: dur, filt: 800 + intensity * 150, det: 6
                        })
                    }
                })
            }

            // ----- BASS (from world 1+) -----
            if (intensity >= 1) {
                // Simple: root note on beat 1 and 3 only
                if (s16 === 0 || s16 === 8) {
                    const bassNote = chordRoot - 12
                    voice(midi(bassNote), 'sine', t, S16 * 3, 0.3, bassBus, {
                        atk: 0.015, filt: 350 + intensity * 50
                    })
                    // Sub
                    voice(midi(bassNote - 12), 'sine', t, S16 * 3, 0.15, bassBus, {
                        atk: 0.025, filt: 180
                    })
                }
                // Octave bounce on offbeats (from world 3+)
                if (intensity >= 3 && s16 === 4) {
                    voice(midi(chordRoot), 'sine', t, S16 * 1.5, 0.15, bassBus, {
                        atk: 0.01, filt: 400
                    })
                }
            }

            // ----- DRUMS (from world 2+) -----
            if (intensity >= 2) {
                // Kick: beats 1 and 3
                if (s16 === 0 || s16 === 8) kick(t, 0.8 + (intensity - 2) * 0.1)
                // Snare: beats 2 and 4
                if (s16 === 4 || s16 === 12) snare(t, 0.7 + (intensity - 2) * 0.1)
                // Hi-hat: 8th notes
                if (s16 % 2 === 0) hat(t, s16 % 4 === 0 ? 0.5 : 0.3)
                // Extra hat on 16ths for world 5+
                if (intensity >= 5 && s16 % 2 === 1) hat(t, 0.2)
            }

            // ----- MELODY -----
            // Rotate through 4 phrases, one per bar
            const phrase = MEL[chordIdx % MEL.length]
            const noteOff = phrase[s16]

            if (noteOff > 0) {
                const melNote = chordRoot + noteOff
                const dur = S16 * (intensity >= 4 ? 2.5 : 2)

                // Primary: clean sine — always beautiful
                voice(midi(melNote), 'sine', t, dur, 0.06, melBus, {
                    atk: 0.008, filt: 2500 + intensity * 400
                })
                // Harmonic: soft triangle octave lower for warmth (world 1+)
                if (intensity >= 1) {
                    voice(midi(melNote), 'triangle', t, dur, 0.03, melBus, {
                        atk: 0.01, filt: 2000 + intensity * 300
                    })
                }
                // Sparkle: high octave square for chiptune feel (world 4+)
                if (intensity >= 4) {
                    voice(midi(melNote + 12), 'square', t, dur * 0.6, 0.015, melBus, {
                        atk: 0.005, filt: 3500
                    })
                }
            }

            // ----- ARP (world 4+ only, very subtle) -----
            if (intensity >= 4 && s16 % 4 === 2) {
                const arpIntervals = [0, 7, 12, 7]
                const arpNote = chordRoot + 12 + arpIntervals[(s16 / 4) % 4]
                voice(midi(arpNote), 'sine', t, S16 * 1.2, 0.02, melBus, {
                    atk: 0.003, filt: 2200
                })
            }
        }

        // === SCHEDULER LOOP (constant BPM, never changes) ===
        let timer: ReturnType<typeof setTimeout>
        const LOOK = 45       // check every 45ms
        const AHEAD = 0.2     // schedule 200ms ahead

        const loop = () => {
            if (!alive || !audioCtxRef.current) return
            // Speed multiplier: only speed UP, never slow DOWN
            const speedMult = Math.max(1, bgmSpeedRef.current || 1)
            const interval = S16 / speedMult
            while (nextTime < audioCtxRef.current.currentTime + AHEAD) {
                schedule(step, nextTime)
                nextTime += interval  // Speeds up with game, never below base BPM
                step++
                if (step > 500_000) step = 0
            }
            timer = setTimeout(loop, LOOK)
        }

        // Gentle 4-second fade in
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 4)

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
