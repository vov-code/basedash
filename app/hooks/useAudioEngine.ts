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
    const bgmNodesRef = useRef<{ oscs: OscillatorNode[], gain: GainNode } | null>(null)
    const bgmIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const bgmSpeedRef = useRef<number>(1)
    const bgmThemeRef = useRef<number>(0)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

    const updateAudioParams = useCallback((speedMultiplier: number, themeIndex: number) => {
        bgmSpeedRef.current = speedMultiplier
        bgmThemeRef.current = themeIndex
    }, [])

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            audioCtxRef.current = new AudioContext()

            const compressor = audioCtxRef.current.createDynamicsCompressor()
            compressor.threshold.value = -20
            compressor.knee.value = 20
            compressor.ratio.value = 4
            compressor.attack.value = 0.005
            compressor.release.value = 0.15
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            masterGainRef.current.gain.value = 0.20
            masterGainRef.current.connect(compressor)
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
    }, [])

    // === CORE TONE PLAYER (offline-rendered + cached) ===
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

        // Evict oldest entries if cache grows too large
        if (toneCacheRef.current.size > 100) {
            const keys = Array.from(toneCacheRef.current.keys())
            for (let i = 0; i < 20; i++) toneCacheRef.current.delete(keys[i])
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

        // Smooth envelope — fast but soft attack, natural decay
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
    // SFX — ENERGETIC, CRISP, MUSICAL
    // =====================================================================

    // JUMP — Bright pluck, quick upward
    const sfxJump = useCallback(() => {
        playTone(523, 'sine', 0.07, 0.1, 784)        // C5→G5 snap up
    }, [playTone])

    // DOUBLE JUMP — Sparkle pair
    const sfxDoubleJump = useCallback(() => {
        playTone(659, 'sine', 0.06, 0.08, 988)       // E5→B5
        setTimeout(() => playTone(1046, 'sine', 0.04, 0.12), 60)  // C6 shimmer
    }, [playTone])

    // DASH — Whoosh with body
    const sfxDash = useCallback(() => {
        playTone(262, 'triangle', 0.05, 0.15, 131)   // C4→C3 whoosh
    }, [playTone])

    // COLLECT — Bright reward chime (major third)
    const sfxCollect = useCallback(() => {
        playTone(880, 'sine', 0.06, 0.15)             // A5
        setTimeout(() => playTone(1108, 'sine', 0.04, 0.2), 50)   // C#6 — major 3rd
    }, [playTone])

    // POWERUP — Fast ascending major arpeggio
    const sfxPowerup = useCallback(() => {
        const notes = [523, 659, 784, 1046, 1318]     // C-E-G-C-E
        notes.forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.04 - i * 0.005, 0.15 + i * 0.03), i * 45)
        })
    }, [playTone])

    // DEATH — Dramatic descending minor
    const sfxHit = useCallback(() => {
        playTone(392, 'sine', 0.08, 0.3, 196)         // G4→G3
        setTimeout(() => playTone(262, 'triangle', 0.04, 0.4, 98), 100) // C4→G2
    }, [playTone])

    // SELECT — Quick tap
    const sfxSelect = useCallback(() => {
        playTone(784, 'sine', 0.04, 0.08, 659)        // G5→E5
    }, [playTone])

    // COMBO — Rising pentatonic with harmonics
    const sfxCombo = useCallback((combo: number) => {
        const scale = [523, 587, 659, 784, 880, 1046, 1174, 1318, 1568, 1760, 2093]
        const idx = Math.min(combo, scale.length - 1)
        const note = scale[idx]
        playTone(note, 'sine', 0.05, 0.15)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.025, 0.2), 50)  // Perfect 5th
    }, [playTone])

    // MILESTONE — Triumphant fanfare
    const sfxMilestone = useCallback(() => {
        const seq = [
            { f: 523, d: 60 },   // C5
            { f: 659, d: 60 },   // E5
            { f: 784, d: 60 },   // G5
            { f: 1046, d: 80 },  // C6
            { f: 1318, d: 250 }, // E6 sustain
        ]
        let t = 0
        seq.forEach(({ f, d }) => {
            setTimeout(() => playTone(f, 'sine', 0.04, d / 1000 + 0.1), t)
            t += d
        })
    }, [playTone])

    // LEVEL UP — Bright cascading sparkle
    const sfxLevelUp = useCallback(() => {
        [523, 784, 1046, 1318, 1568, 2093].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.035, 0.12 + i * 0.03), i * 40)
        })
    }, [playTone])

    // =====================================================================
    // BGM — ENERGETIC SYNTH-POP WITH EVOLVING WORLD LAYERS
    // =====================================================================
    //
    // Architecture:
    //   Melody (sine)    — main hook, catchy pentatonic patterns
    //   Pad (triangle)   — harmonic bed, detuned for width
    //   Bass (sine)      — driving pulse, rhythmic root movement
    //
    // World progression:
    //   0-1: Light melody, sparse — learning phase
    //   2-3: Add synth pad harmonies, fuller sound
    //   4-5: Driving bass enters, energy builds
    //   6+:  Full arrangement, faster arpeggios, richer harmonics
    //
    // Tempo tracks game speed — feels alive and responsive

    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        if (!ctx || !master || bgmNodesRef.current) return

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { })
        }

        // =====================================================================
        // GEOMETRY DASH INSPIRED BGM — Catchy arpeggios, driving rhythm
        // =====================================================================
        // 6 oscillators: arpLead, arpHarmony, pad1, pad2, subBass, kickSim
        // I-V-vi-IV chord progression — universally catchy
        // Fast arpeggios through chord tones = signature GD cascading synth

        const arpLead = ctx.createOscillator()
        const arpHarmony = ctx.createOscillator()
        const pad1 = ctx.createOscillator()
        const pad2 = ctx.createOscillator()
        const subBass = ctx.createOscillator()
        const kickSim = ctx.createOscillator()

        const gArp = ctx.createGain()
        const gHarm = ctx.createGain()
        const gPad = ctx.createGain()
        const gBass = ctx.createGain()
        const gKick = ctx.createGain()
        const bgmGain = ctx.createGain()
        const bgmFilter = ctx.createBiquadFilter()

        // Timbres — chiptune-inspired
        arpLead.type = 'square'       // classic chiptune lead
        arpHarmony.type = 'triangle'  // soft harmony
        pad1.type = 'triangle'
        pad2.type = 'triangle'
        pad2.detune.value = 8         // chorus effect
        subBass.type = 'sine'         // clean deep sub
        kickSim.type = 'sine'         // kick drum sim

        bgmFilter.type = 'lowpass'
        bgmFilter.frequency.value = 1400
        bgmFilter.Q.value = 0.7       // slight resonance for character

        // Routing: all → filter → master bus → master
        arpLead.connect(gArp); arpHarmony.connect(gHarm)
        pad1.connect(gPad); pad2.connect(gPad)
        subBass.connect(gBass); kickSim.connect(gKick)
        gArp.connect(bgmFilter); gHarm.connect(bgmFilter)
        gPad.connect(bgmFilter); gBass.connect(bgmFilter)
        gKick.connect(bgmFilter); bgmFilter.connect(bgmGain)
        bgmGain.connect(master)

        // Initial volumes
        gArp.gain.value = 0.07
        gHarm.gain.value = 0.03
        gPad.gain.value = 0.05
        gBass.gain.value = 0.06
        gKick.gain.value = 0.04

        // Fade in
        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3)

        arpLead.start(); arpHarmony.start()
        pad1.start(); pad2.start()
        subBass.start(); kickSim.start()

        bgmNodesRef.current = { oscs: [arpLead, arpHarmony, pad1, pad2, subBass, kickSim], gain: bgmGain }

        // =================================================================
        // WORLD KEYS — I-V-vi-IV chord progressions per world
        // Each key provides chord roots, arpeggio notes, bass notes
        // =================================================================
        interface WorldKey {
            chords: number[][]  // 4 chords, each with root + 3rd + 5th
            bass: number[]      // bass root per chord
            arpNotes: number[]  // pool of arpeggio notes (chord tones)
        }

        const worldKeys: WorldKey[] = [
            // C major: C-G-Am-F
            {
                chords: [[262, 330, 392], [392, 494, 587], [440, 523, 659], [349, 440, 523]],
                bass: [131, 196, 220, 175],
                arpNotes: [262, 330, 392, 523, 494, 440, 349, 587],
            },
            // G major: G-D-Em-C
            {
                chords: [[392, 494, 587], [294, 370, 440], [330, 392, 494], [262, 330, 392]],
                bass: [196, 147, 165, 131],
                arpNotes: [392, 494, 587, 784, 440, 330, 262, 294],
            },
            // D major: D-A-Bm-G
            {
                chords: [[294, 370, 440], [440, 554, 659], [494, 587, 740], [392, 494, 587]],
                bass: [147, 220, 247, 196],
                arpNotes: [294, 370, 440, 587, 554, 494, 392, 659],
            },
            // Bb major: Bb-F-Gm-Eb
            {
                chords: [[466, 587, 698], [349, 440, 523], [392, 466, 587], [311, 392, 466]],
                bass: [233, 175, 196, 156],
                arpNotes: [466, 587, 698, 523, 440, 392, 311, 349],
            },
            // Eb major: Eb-Bb-Cm-Ab (epic, triumphant)
            {
                chords: [[311, 392, 466], [466, 587, 698], [523, 622, 784], [415, 523, 622]],
                bass: [156, 233, 262, 208],
                arpNotes: [311, 392, 466, 622, 587, 523, 415, 698],
            },
        ]

        // Arpeggio patterns — index into arpNotes pool
        // Each is 16 steps, creates melodic phrases
        const arpPatterns = [
            // A: Classic ascending cascade (like GD Stereo Madness)
            [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1],
            // B: Bouncy syncopated (like GD Back on Track)
            [0, 3, 1, 4, 0, 2, 1, 3, 0, 4, 2, 5, 1, 3, 0, 2],
            // C: Driving with repeated notes (like GD Polargeist)
            [0, 0, 2, 3, 0, 0, 4, 3, 0, 0, 2, 5, 0, 0, 3, 2],
            // D: Wide intervals, dramatic
            [0, 3, 0, 5, 1, 4, 1, 6, 2, 5, 2, 7, 0, 3, 1, 4],
            // E: Fast cascading runs
            [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0],
        ]

        let step = 0
        let nextTime = ctx.currentTime + 0.5
        const BASE_TEMPO = 0.125  // fast 16th notes (~120 BPM)

        const tick = () => {
            if (!bgmNodesRef.current || !audioCtxRef.current) return

            const speed = bgmSpeedRef.current || 1
            const world = bgmThemeRef.current || 0
            const ki = Math.min(Math.floor(world / 2), worldKeys.length - 1)
            const key = worldKeys[ki]

            const tempoScale = 0.8 + speed * 0.2
            const interval = BASE_TEMPO / tempoScale

            while (nextTime < audioCtxRef.current.currentTime + 1.0) {
                if (nextTime < audioCtxRef.current.currentTime - 0.5) {
                    nextTime = audioCtxRef.current.currentTime + 0.05
                    bgmGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01)
                    bgmGain.gain.setTargetAtTime(1.0, audioCtxRef.current.currentTime + 0.1, 0.3)
                    continue
                }

                const chordIdx = Math.floor(step / 16) % 4
                const chord = key.chords[chordIdx]
                const bassNote = key.bass[chordIdx]

                // Select arp pattern based on world
                const patIdx = Math.min(ki, arpPatterns.length - 1)
                const pattern = arpPatterns[patIdx]
                const noteIdx = pattern[step % 16]
                const arpNote = key.arpNotes[noteIdx % key.arpNotes.length]

                const beat16 = step % 4 === 0     // quarter note
                const beat8 = step % 2 === 0      // 8th note
                const barStart = step % 16 === 0   // new chord
                const phraseStart = step % 64 === 0

                const glide = interval * 0.12  // short for chiptune feel

                // === ARPEGGIO LEAD — the catchy, memorable part ===
                arpLead.frequency.setTargetAtTime(arpNote, nextTime, glide)

                // === HARMONY — follows at half speed, different inversion ===
                if (beat8) {
                    const harmIdx = (noteIdx + 2) % key.arpNotes.length
                    arpHarmony.frequency.setTargetAtTime(
                        key.arpNotes[harmIdx] * 0.5, nextTime, glide * 2
                    )
                }

                // === PAD — smooth chord changes ===
                pad1.frequency.setTargetAtTime(chord[0] * 0.5, nextTime, 0.25)
                pad2.frequency.setTargetAtTime(chord[1] * 0.5, nextTime, 0.25)

                // === BASS — driving root ===
                subBass.frequency.setTargetAtTime(bassNote * 0.5, nextTime, glide * 2)

                // === KICK — quarter note pulse ===
                if (beat16) {
                    kickSim.frequency.setValueAtTime(160, nextTime)
                    kickSim.frequency.exponentialRampToValueAtTime(35, nextTime + 0.08)
                }

                // === VOLUMES — sidechain pump + world scaling ===
                let aV = 0.06, hV = 0.02, pV = 0.04, bV = 0.05, kV = 0.03
                if (world >= 2) { aV = 0.07; hV = 0.03; pV = 0.05; bV = 0.06; kV = 0.04 }
                if (world >= 4) { aV = 0.08; hV = 0.04; pV = 0.06; bV = 0.07; kV = 0.05 }
                if (world >= 6) { aV = 0.09; hV = 0.05; pV = 0.07; bV = 0.08; kV = 0.06 }
                if (world >= 8) { aV = 0.10; hV = 0.06; pV = 0.08; bV = 0.09; kV = 0.07 }

                // Sidechain pump — dip on beat, rise between
                if (beat16) {
                    gArp.gain.setTargetAtTime(aV * 0.65, nextTime, 0.008)
                    gArp.gain.setTargetAtTime(aV, nextTime + interval * 0.4, 0.04)
                    gPad.gain.setTargetAtTime(pV * 0.4, nextTime, 0.008)
                    gPad.gain.setTargetAtTime(pV, nextTime + interval * 0.6, 0.06)
                }

                gHarm.gain.setTargetAtTime(beat8 ? hV : hV * 0.4, nextTime, 0.04)
                gBass.gain.setTargetAtTime(bV, nextTime, 0.03)

                // Kick — sharp attack, fast decay
                if (beat16) {
                    gKick.gain.setValueAtTime(kV, nextTime)
                    gKick.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.10)
                }

                // === FILTER — opens with world/speed, breathes on phrases ===
                const baseCut = 1000 + world * 100 + speed * 80
                const beatBoost = barStart ? 350 : (beat16 ? 180 : 0)
                const phraseBoost = phraseStart ? 500 : 0
                bgmFilter.frequency.setTargetAtTime(
                    Math.min(baseCut + beatBoost + phraseBoost, 3200),
                    nextTime, 0.05
                )

                // Resonance peak on phrase for drama
                if (phraseStart) {
                    bgmFilter.Q.setTargetAtTime(2.5, nextTime, 0.02)
                    bgmFilter.Q.setTargetAtTime(0.7, nextTime + interval * 6, 0.1)
                }

                step++
                nextTime += interval
            }

            bgmIntervalRef.current = setTimeout(tick, 50)
        }
        tick()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmNodesRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmNodesRef.current.gain.gain.cancelScheduledValues(ct)
            bgmNodesRef.current.gain.gain.setValueAtTime(bgmNodesRef.current.gain.gain.value, ct)
            bgmNodesRef.current.gain.gain.linearRampToValueAtTime(0, ct + 0.5)
            for (const osc of bgmNodesRef.current.oscs) {
                try { osc.stop(ct + 0.6) } catch { /* already stopped */ }
            }
            bgmNodesRef.current = null
        }
        if (bgmIntervalRef.current) {
            clearTimeout(bgmIntervalRef.current)
            bgmIntervalRef.current = null
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
