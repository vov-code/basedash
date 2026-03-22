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
// 🌌 "MIDNIGHT ON THE CHAIN" — EPIC SYNTH-POP SOUNDTRACK
// ============================================================================
// A massive 10-layer generative engine + the "Smalltown Boy" emotional melody.
// 
// HARMONY: Minor Pentatonic (The emotional synth-pop scale)
// PROGRESSION: i - ♭VI - ♭III - ♭VII (The hero's journey progression)
//
// LAYERS (10 active audio buses):
// 1. Sub Drone - Chest-rattling 80Hz foundation
// 2. Ensemble Pad - 4-note voicings + 3x detuning (Juno-106 analog warmth)
// 3. Arpeggiator - 16-step Pluck sequencer, creates forward momentum
// 4. Bass - Dirty FM-style synth bass pulse
// 5. Lo-Fi Kick - Boom-bap warm sweep
// 6. Snare/Rim - Syncopated backbeat on 2 & 4
// 7. Hats & Shakers - Complex 16th-note generative grooves with ghost notes
// 8. Lead Hook - The step-step-LEAP-settle pure sine melody, drenched in delay
// 9. Counter Hook - High triangle call-and-response answering the lead
// 10. FX & Risers - Noise sweeps, tape stops, sub drops for section transitions
// ============================================================================

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (typeof window !== 'undefined' ? window.innerWidth < 1100 : true)

const MAX_OSCILLATORS = IS_MOBILE ? 24 : 36 // Increased cap for the epic feel

// Each world has a unique emotional identity and hooks
const WORLD_SONGS = [
    { root: 62, hook: [0, 3, 5, 7, 5, 3, 0, 3], counter: [12, 10, 7, 5, 7, 10, 12, 10] }, // Dm: Yearning
    { root: 64, hook: [0, 3, 7, 10, 7, 5, 3, 5], counter: [12, 10, 5, 7, 10, 12, 10, 7] }, // Em: Driving
    { root: 66, hook: [0, 5, 7, 12, 10, 7, 5, 7], counter: [12, 7, 5, 0, 3, 5, 7, 5] },    // F#m: Resolute
    { root: 69, hook: [0, 3, 7, 12, 10, 7, 3, 7], counter: [12, 10, 5, 0, 3, 5, 10, 5] },  // Am: Majestic
    { root: 71, hook: [0, 5, 7, 12, 7, 10, 12, 7], counter: [12, 7, 5, 0, 5, 3, 0, 5] },   // Bm: Euphoric
    { root: 61, hook: [0, 3, 5, 10, 7, 5, 3, 0], counter: [12, 10, 7, 3, 5, 7, 10, 12] },  // C#m: Dark
    { root: 63, hook: [0, 5, 10, 12, 10, 7, 5, 3], counter: [12, 7, 3, 0, 3, 5, 7, 10] },  // Ebm: Tense
    { root: 65, hook: [0, 3, 7, 10, 7, 3, 5, 7], counter: [12, 10, 5, 3, 5, 10, 7, 5] },   // Fm: Bittersweet
    { root: 68, hook: [0, 5, 7, 12, 10, 5, 7, 10], counter: [12, 7, 5, 0, 3, 7, 5, 3] },   // Abm: Defiant
    { root: 74, hook: [0, 3, 7, 12, 10, 7, 12, 7], counter: [12, 10, 5, 0, 3, 5, 0, 5] },  // Dm 8va: Transcendent
]

// Open 4-part voicings for the i - ♭VI - ♭III - ♭VII progression
const CHORD_VOICINGS = [
    [0, 7, 12, 15],     // i (Root, 5th, 8va, minor 10th)
    [-4, 3, 8, 12],     // ♭VI (Major chord sitting on the minor 6th)
    [3, 10, 15, 19],    // ♭III (Major chord relative to root)
    [-2, 5, 10, 14],    // ♭VII (Major chord a whole step down)
]

const MELODY_HITS = [0, 4, 8, 14, 16, 20, 24, 28] // Syncopated at hit #3
const COUNTER_HITS = [2, 6, 12, 18, 22, 26, 30] 
const BASS_PULSE = [0, 3, 6, 8, 11, 14] // Dotted rhythmic drive

// Arp Patterns: Generative 16-step sequences
const ARP_PATTERNS = [
    [0, 1, 2, 3, 0, 1, 2, -1, 3, 2, 1, 0, 3, 2, -1, -1], // Up and down waterfall
    [0, -1, 1, -1, 2, 1, 3, 2, 0, 1, 2, -1, 3, -1, 2, 1], // Syncopated bounce
]

// Drum Groove Data
const KICK_PATTERN = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] // Kick on 1, 3, 3"and"
const SNARE_PATTERN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] // Snare on 2 and 4
const HAT_PATTERN = [0.8, 0.2, 0.6, 0.3, 0.9, 0.2, 0.5, 0.4, 0.8, 0.2, 0.6, 0.3, 0.9, 0.4, 0.6, 0.2] // 16th groove

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

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const ctx = new AC()
            audioCtxRef.current = ctx

            // Epic mastering chain: EQ + Multi-band compression equivalent
            const comp = ctx.createDynamicsCompressor()
            comp.threshold.value = -18
            comp.knee.value = 8
            comp.ratio.value = 4
            comp.attack.value = 0.005
            comp.release.value = 0.15
            comp.connect(ctx.destination)

            // Warmth Filter (Subtle high shelf cut to remove digital harshness)
            const masterEq = ctx.createBiquadFilter()
            masterEq.type = 'highshelf'
            masterEq.frequency.value = 10000
            masterEq.gain.value = -3
            masterEq.connect(comp)

            masterGainRef.current = ctx.createGain()
            masterGainRef.current.gain.value = IS_MOBILE ? 0.25 : 0.35
            masterGainRef.current.connect(masterEq)

            const len = ctx.sampleRate * 2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
            noiseBufferRef.current = buf
        }
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }, [])

    const voice = useCallback((
        freq: number, type: OscillatorType, t: number, dur: number,
        vol: number, dest: AudioNode,
        opts?: { filt?: number; det?: number; atk?: number; rel?: number; filtType?: BiquadFilterType }
    ) => {
        const ctx = audioCtxRef.current
        if (!ctx || activeOscCountRef.current >= MAX_OSCILLATORS) return
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
            f.type = opts.filtType || 'lowpass'
            f.frequency.setValueAtTime(opts.filt, t)
            f.frequency.exponentialRampToValueAtTime(Math.max(100, opts.filt * 0.1), t + r)
            osc.connect(f); f.connect(g)
        } else {
            osc.connect(g)
        }
        g.connect(dest)
        osc.start(t); osc.stop(t + r + 0.1)
        osc.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
    }, [])

    const ensemblePad = useCallback((freq: number, t: number, dur: number, vol: number, dest: AudioNode, filt: number) => {
        const detunes = [-6, 0, 6] // Wider detune for massive analog feel
        detunes.forEach(det => voice(freq, 'sine', t, dur, vol/3, dest, { atk: 1.2, rel: dur * 0.9, filt, det }))
    }, [voice])

    const getRoot = useCallback(() => {
        const idx = Math.min(bgmThemeRef.current || 0, WORLD_SONGS.length - 1)
        return WORLD_SONGS[idx].root
    }, [])

    // =========================================================================
    // EPIC SFX — Multi-layered, premium feedback
    // =========================================================================
    
    // Fallback simple tone generator
    const playTone = useCallback((freq: number, type: OscillatorType = 'sine', vol = 0.1, dur = 0.1, slideFreq?: number) => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m || activeOscCountRef.current >= MAX_OSCILLATORS) return
        activeOscCountRef.current++; const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime)
        if (slideFreq) o.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + dur)
        g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
        o.connect(g); g.connect(m); o.start(ctx.currentTime); o.stop(ctx.currentTime + dur + 0.1)
        o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
    }, [soundEnabled, initAudio])

    const sfxJump = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        // Crisp dual-osc bubble sound
        voice(midi(r + 12), 'sine', t, 0.12, 0.05, m, { atk: 0.005 })
        voice(midi(r + 19), 'triangle', t + 0.015, 0.15, 0.03, m, { atk: 0.005, filt: 2000 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxDoubleJump = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        // Shimmering octave burst
        voice(midi(r + 19), 'sine', t, 0.1, 0.04, m, { atk: 0.005 })
        voice(midi(r + 24), 'triangle', t + 0.03, 0.12, 0.035, m, { atk: 0.005 })
        voice(midi(r + 31), 'sine', t + 0.06, 0.1, 0.02, m, { atk: 0.005 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxDash = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m || !noiseBufferRef.current) return
        const t = ctx.currentTime
        // Wind sweep + sub drop
        voice(midi(getRoot() - 12), 'triangle', t, 0.2, 0.04, m, { filt: 400, atk: 0.01 })
        
        // Air whoosh
        const n = ctx.createBufferSource(); n.buffer = noiseBufferRef.current
        const f = ctx.createBiquadFilter(), g = ctx.createGain()
        f.type = 'bandpass'; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.2)
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        n.connect(f); f.connect(g); g.connect(m); n.start(t); n.stop(t + 0.25)
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxCollect = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        // 3-note ascending glass strike
        voice(midi(r + 12), 'sine', t, 0.15, 0.04, m, { atk: 0.003 })
        voice(midi(r + 15), 'sine', t + 0.04, 0.15, 0.03, m, { atk: 0.003 })
        voice(midi(r + 19), 'triangle', t + 0.09, 0.2, 0.03, m, { atk: 0.003, filt: 3000 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxPowerup = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime; const r = getRoot();
        // 5-note euphoric sweep (Major feel injected briefly)
        [0, 4, 7, 12, 16].forEach((n, i) => {
            voice(midi(r + 12 + n), i > 2 ? 'triangle' : 'sine', t + i * 0.04, 0.2, 0.04 - i * 0.005, m, { atk: 0.005 })
        })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxHit = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        // Massive Sub Drop
        if (activeOscCountRef.current < MAX_OSCILLATORS) {
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(100, t)
            o.frequency.exponentialRampToValueAtTime(20, t + 0.3)
            g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
            o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.5)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
        }
        // Dissonant crunch (Tritone + Noise)
        voice(midi(r + 6), 'sawtooth', t + 0.02, 0.3, 0.03, m, { filt: 800 })
        voice(midi(r - 6), 'triangle', t + 0.05, 0.4, 0.04, m, { filt: 400 })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxSelect = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        voice(midi(79), 'sine', ctx.currentTime, 0.08, 0.04, m, { atk: 0.002 })
    }, [soundEnabled, initAudio, voice])

    const sfxCombo = useCallback((combo: number) => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const r = getRoot(), t = ctx.currentTime
        const penta = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]
        const n = r + penta[Math.min(combo, penta.length - 1)]
        voice(midi(n), 'sine', t, 0.15, 0.04, m, { atk: 0.003 })
        voice(midi(n + 7), 'sine', t + 0.04, 0.15, 0.02, m, { atk: 0.003 }) // Added harmony
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxMilestone = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime; const r = getRoot();
        // 4-note epic minor chord roll
        [0, 3, 7, 12].forEach((n, i) => {
            voice(midi(r + 12 + n), i === 3 ? 'triangle' : 'sine', t + i * 0.06, 0.25, 0.04, m, { atk: 0.005 })
        })
    }, [soundEnabled, initAudio, voice, getRoot])

    const sfxLevelUp = useCallback(() => {
        if (!soundEnabled) return; initAudio()
        const ctx = audioCtxRef.current, m = masterGainRef.current
        if (!ctx || !m) return
        const t = ctx.currentTime, r = getRoot()
        // 6-note triumphant minor pentatonic scale run
        const steps = [0, 3, 5, 7, 10, 12]
        steps.forEach((s, i) => {
            voice(midi(r + 12 + s), 'sine', t + i * 0.06, 0.3, i === 5 ? 0.06 : 0.035, m, { atk: 0.005 })
            if (i >= 2) voice(midi(r + 24 + s), 'triangle', t + i * 0.06, 0.2, 0.02, m, { atk: 0.005, filt: 4000 }) // Shimmer layer
        })
    }, [soundEnabled, initAudio, voice, getRoot])


    // =========================================================================
    // 🌌 MASSIVE BGM ENGINE — 10 Layers of Depth
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
        // PRO ROUTING & BUSES
        // ===================================================================
        const bgmGain = ctx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(master)
        
        // Sidechain compression from Kick
        const scGain = ctx.createGain(); scGain.gain.value = 1; scGain.connect(bgmGain)

        // Drum Bus with parallel saturation/drive emulation
        const drumBus = ctx.createGain(); drumBus.gain.value = 0.55; drumBus.connect(bgmGain)
        
        // Melody Delay Bus (Dotted-8th tape echo)
        const melDelayBus = ctx.createGain(); melDelayBus.gain.value = 0.65; melDelayBus.connect(scGain)
        const melDelay = ctx.createDelay(2); melDelay.delayTime.value = BEAT * 0.75
        const melDelFb = ctx.createGain(); melDelFb.gain.value = 0.28
        const melDelFilt = ctx.createBiquadFilter(); melDelFilt.type = 'lowpass'; melDelFilt.frequency.value = 1200
        melDelayBus.connect(melDelay); melDelay.connect(melDelFilt)
        melDelFilt.connect(melDelFb); melDelFb.connect(melDelay)
        melDelay.connect(scGain)

        // Arp Delay Bus (16th note ping-pong space)
        const arpDelayBus = ctx.createGain(); arpDelayBus.gain.value = 0.4; arpDelayBus.connect(scGain)

        // ===================================================================
        // PREMIUM DRUM SYNTHESIS
        // ===================================================================
        const punchyKick = (t: number, volMultiplier: number = 1) => {
            if (activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.05)
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * volMultiplier, t + 0.002)
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
            o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.3)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }

            // Heavy Sidechain ducking
            scGain.gain.cancelScheduledValues(t)
            scGain.gain.setValueAtTime(0.4, t)
            scGain.gain.exponentialRampToValueAtTime(1, t + 0.2)
        }

        const crispSnare = (t: number) => {
            if (!noiseBufferRef.current || activeOscCountRef.current >= MAX_OSCILLATORS) return
            activeOscCountRef.current++
            // Body 
            const o = ctx.createOscillator(), og = ctx.createGain()
            o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(100, t + 0.05)
            og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.04, t + 0.002); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
            o.connect(og); og.connect(drumBus); o.start(t); o.stop(t + 0.15)
            o.onended = () => { activeOscCountRef.current = Math.max(0, activeOscCountRef.current - 1) }
            
            // Tail
            const n = ctx.createBufferSource(); n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), ng = ctx.createGain()
            f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.5
            ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.05, t + 0.005); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            n.connect(f); f.connect(ng); ng.connect(drumBus); n.start(t); n.stop(t + 0.25)
        }

        const silkyHat = (t: number, vel: number) => {
            if (!noiseBufferRef.current || vel <= 0) return
            const n = ctx.createBufferSource(); n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'highpass'; f.frequency.value = 8500
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035 * vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
            n.connect(f); f.connect(g); g.connect(drumBus); n.start(t); n.stop(t + 0.05)
        }

        const sweepRiser = (t: number, dur: number) => {
            if (!noiseBufferRef.current) return
            const n = ctx.createBufferSource(); n.buffer = noiseBufferRef.current
            const f = ctx.createBiquadFilter(), g = ctx.createGain()
            f.type = 'bandpass'; f.Q.value = 2
            f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(4000, t + dur)
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.001, t + dur)
            n.connect(f); f.connect(g); g.connect(bgmGain); n.start(t); n.stop(t + dur + 0.1)
        }

        // ===================================================================
        // THE ENGINE LOOP
        // ===================================================================
        const schedule = (s: number, t: number) => {
            const world = Math.min(bgmThemeRef.current || 0, WORLD_SONGS.length - 1)
            const song = WORLD_SONGS[world]; const root = song.root; const intensity = Math.min(world, 5)

            const phraseStep = s % 256
            const bar = Math.floor(phraseStep / 16)
            const s16 = phraseStep % 16

            // Song Structure: Intro -> Verse -> Pre-Chorus -> Chorus -> Bridge
            let section = 0; // 0=Intro
            if (bar >= 2 && bar < 6) section = 1;      // Verse
            else if (bar >= 6 && bar < 8) section = 2; // Pre-Chorus
            else if (bar >= 8 && bar < 12) section = 3; // Chorus
            else if (bar >= 12) section = 4;           // Bridge/Outro

            const chordIdx = Math.floor(bar / 4) % 4
            const chord = CHORD_VOICINGS[chordIdx]

            // 1. SUB DRONE - The deep foundation
            if (phraseStep === 0) {
                const dur = S16 * 254
                voice(midi(root - 24), 'sine', t, dur, 0.025 + intensity * 0.002, scGain, { atk: 4, rel: dur * 0.8, filt: 70 })
            }

            // 2. ENSEMBLE PAD - Sweeping, evolving chords
            if (s16 === 0) {
                const padDur = S16 * 15.8
                const padVol = (section === 3 ? 0.045 : 0.035) + intensity * 0.003
                
                chord.forEach((offset: number, index: number) => {
                    // Spread voices: lower notes are darker, high notes have more filter envelope
                    const baseFilt = 600 + (index * 200) + (section * 100) + intensity * 100
                    ensemblePad(midi(root + offset), t, padDur, padVol, scGain, baseFilt)
                })
            }

            // 3. ARPEGGIATOR - Plucky 16th momentum, alive in Verse and Chorus
            if ((section === 1 || section === 3) && intensity >= 1) {
                const arpMatrix = ARP_PATTERNS[(bar + chordIdx) % ARP_PATTERNS.length]
                const arpTone = arpMatrix[s16]
                if (arpTone >= 0) {
                    const note = root + 12 + chord[arpTone % chord.length]
                    voice(midi(note), 'triangle', t, S16 * 1.5, 0.012 + intensity * 0.002, arpDelayBus, { 
                        atk: 0.005, filt: 1500 + (s16 * 50) + intensity * 100, rel: S16 * 1.2 
                    })
                }
            }

            // 4. BASS - Edgy FM-style pulse
            if (section >= 1 && section <= 3) {
                if (BASS_PULSE.includes(s16)) {
                    const bassNote = root - 12 + chord[0]
                    // Octave jump logic for funk
                    const octDrop = (s16 === 11) ? -12 : 0 
                    voice(midi(bassNote + octDrop), 'sawtooth', t, S16 * 2.5, 0.015, scGain, { 
                        atk: 0.01, filt: 250 + intensity * 30, rel: S16 * 2 
                    })
                    voice(midi(bassNote + octDrop), 'sine', t, S16 * 3, 0.06, scGain, { 
                        atk: 0.01, filt: 150, rel: S16 * 2.5 
                    })
                }
            }

            // 5, 6, 7. FULL DRUM KIT - Builds through sections
            if (section >= 1 && section <= 3) {
                // Kick
                if (KICK_PATTERN[s16] === 1) punchyKick(t, section === 3 ? 1.2 : 1)
                // Snare (Pre-Chorus and Chorus only)
                if (section >= 2 && SNARE_PATTERN[s16] === 1) crispSnare(t)
                // Hats (Busier in Chorus)
                const hatVel = HAT_PATTERN[s16]
                if (hatVel > 0) {
                    // Open hat on the 'and' of 4 before drop
                    if (section === 2 && bar === 7 && s16 === 14) {
                        silkyHat(t, 1.5); // BIG open hat
                    } else if (section === 3 || s16 % 4 === 0 || s16 % 4 === 2) {
                        silkyHat(t, hatVel * (0.5 + intensity * 0.05))
                    }
                }
            }

            // Drum Fills! (Last beats of Pre-Chorus)
            if (section === 2 && bar === 7 && s16 >= 12) {
                // Snare roll
                if (s16 % 2 === 0) crispSnare(t) 
                punchyKick(t, 0.8) // Double kicks
            }

            // 8. LEAD HOOK - The Emotional Core
            // Full in Chorus, Sparse in Verse, Echoes in Bridge
            if (section >= 1) {
                const twoBarPos = phraseStep % 32
                const melIdx = MELODY_HITS.indexOf(twoBarPos)
                
                let shouldPlay = false;
                if (melIdx >= 0) {
                    if (section === 1) shouldPlay = (melIdx % 2 === 0); // Verse: half notes
                    if (section === 3) shouldPlay = true;               // Chorus: all notes
                    if (section === 4) shouldPlay = (melIdx === 0 || melIdx === 3); // Bridge: sparse echoes
                }

                if (shouldPlay && melIdx >= 0) {
                    // Ornamental grace note on the peak hit (index 3)
                    if (melIdx === 3 && section === 3) {
                        voice(midi(root + 12 + song.hook[melIdx] + 2), 'sine', t, S16 * 0.5, 0.015, melDelayBus, { atk: 0.005, filt: 3000 })
                    }

                    const note = root + 12 + song.hook[melIdx]
                    voice(midi(note), 'sine', t + (melIdx === 3 && section === 3 ? S16*0.5 : 0), S16 * 3.5, 0.035, melDelayBus, { 
                        atk: 0.015, filt: 2000 + intensity * 200, rel: S16 * 2.5 
                    })
                }
            }

            // 9. COUNTER HOOK - Chorus Call and Response
            if (section === 3 && intensity >= 2) {
                const twoBarPos = phraseStep % 32
                const ctrIdx = COUNTER_HITS.indexOf(twoBarPos)
                if (ctrIdx >= 0) {
                    const note = root + song.counter[ctrIdx]
                    voice(midi(note), 'triangle', t, S16 * 2.5, 0.02 + intensity * 0.002, melDelayBus, {
                        atk: 0.02, filt: 1800 + intensity * 150, rel: S16 * 1.5
                    })
                }
            }

            // 10. FX & RISERS - Section Glue
            if (section === 2 && bar === 7 && s16 === 0) {
                // Massive 1-bar riser before Chorus drop
                sweepRiser(t, S16 * 16)
            }
            if (section === 3 && bar === 8 && s16 === 0) {
                // Sub impact on Chorus downbeat
                const impactDur = S16 * 8
                voice(midi(root - 24), 'sawtooth', t, impactDur, 0.03, scGain, { atk: 0.001, filt: 600, rel: impactDur * 0.5 })
            }
        }

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

        bgmGain.gain.setValueAtTime(0, ctx.currentTime)
        bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)

        timer = setTimeout(loop, LOOK)

        const handleVisibility = () => {
            if (document.hidden) {
                alive = false; clearTimeout(timer)
                try {
                    bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                    bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime)
                    bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3)
                } catch {}
            } else if (!alive && bgmNodesRef.current) {
                alive = true; nextTime = ctx.currentTime + 0.15
                bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                bgmGain.gain.setValueAtTime(0, ctx.currentTime)
                bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
                timer = setTimeout(loop, LOOK)
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)

        bgmNodesRef.current = {
            stop: () => {
                alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', handleVisibility)
                try {
                    bgmGain.gain.cancelScheduledValues(ctx.currentTime)
                    bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime)
                    bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5)
                } catch {}
            },
            gain: bgmGain,
        }
    }, [soundEnabled, initAudio, voice, ensemblePad])

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
