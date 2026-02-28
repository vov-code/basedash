'use client'

import { useRef, useCallback } from 'react'

export interface AudioEngine {
    playTone: (freq: number, type: OscillatorType, dur: number, vol?: number, slideFreq?: number) => void
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
}

export function useAudioEngine(soundEnabled: boolean): AudioEngine {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const masterGainRef = useRef<GainNode | null>(null)
    const fxNodeRef = useRef<GainNode | null>(null)
    const bgmOscRef = useRef<OscillatorNode | null>(null)
    const bgmGainRef = useRef<GainNode | null>(null)
    const toneCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            audioCtxRef.current = new AudioContext()

            // Compressor for smoother sound limiting
            const compressor = audioCtxRef.current.createDynamicsCompressor()
            compressor.threshold.value = -12
            compressor.knee.value = 40
            compressor.ratio.value = 12
            compressor.attack.value = 0
            compressor.release.value = 0.25
            compressor.connect(audioCtxRef.current.destination)

            masterGainRef.current = audioCtxRef.current.createGain()
            // Turn down master slightly for headroom
            masterGainRef.current.gain.value = 0.5
            masterGainRef.current.connect(compressor)

            // No delay effect for cleaner retro sound
            fxNodeRef.current = audioCtxRef.current.createGain()
            fxNodeRef.current.gain.value = 0
            fxNodeRef.current.connect(masterGainRef.current)
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
        const fx = fxNodeRef.current
        if (!ctx || !master || !fx || !toneCacheRef.current) return

        // Cache Key
        const cacheKey = `${freq}-${type}-${dur}-${slideFreq || 'none'}`

        // FUNCTION to play the buffer once we have it
        const playBuffer = (buffer: AudioBuffer) => {
            const source = ctx.createBufferSource()
            source.buffer = buffer

            const gain = ctx.createGain()
            gain.gain.value = vol

            source.connect(gain)
            gain.connect(master)

            // Send to delay FX
            const fxSend = ctx.createGain()
            fxSend.gain.value = 0.8
            gain.connect(fxSend)
            fxSend.connect(fx)

            source.start(ctx.currentTime)
        }

        // 1. CACHE HIT
        if (toneCacheRef.current.has(cacheKey)) {
            playBuffer(toneCacheRef.current.get(cacheKey)!)
            return
        }

        // 2. CACHE MISS — Render offline (Costs CPU ONCE, then never again)
        const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
        // Render slightly longer to catch the tail
        const renderLen = dur + 0.1
        const offlineCtx = new OfflineContext(1, ctx.sampleRate * renderLen, ctx.sampleRate)

        const osc = offlineCtx.createOscillator()
        const gain = offlineCtx.createGain()
        osc.type = type

        osc.frequency.setValueAtTime(freq, 0)
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, dur)
        }

        // Bell/Chime envelope
        gain.gain.setValueAtTime(0, 0)
        gain.gain.linearRampToValueAtTime(1.0, 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, dur)

        osc.connect(gain)
        gain.connect(offlineCtx.destination)

        osc.start(0)
        osc.stop(dur + 0.1)

        offlineCtx.startRendering().then((renderedBuffer) => {
            toneCacheRef.current!.set(cacheKey, renderedBuffer)
            playBuffer(renderedBuffer)
        }).catch(err => console.error("Audio offline render failed", err))

    }, [soundEnabled, initAudio])

    // Fast, Clean Plucks (Filtered to be smooth/relaxing)
    const sfxJump = useCallback(() => playTone(300.00, 'sine', 0.08, 0.1, 440), [playTone]) // Clean jump
    const sfxDoubleJump = useCallback(() => playTone(400.00, 'triangle', 0.08, 0.12, 550), [playTone])
    const sfxDash = useCallback(() => playTone(200.00, 'sine', 0.1, 0.15, 80), [playTone]) // Swoosh down

    // Fast clean coin sound
    const sfxCollect = useCallback(() => {
        playTone(880.00, 'sine', 0.06, 0.05)
        setTimeout(() => playTone(1318.51, 'sine', 0.08, 0.1), 40)
    }, [playTone])

    // Fast ascending clean scale
    const sfxPowerup = useCallback(() => {
        [440, 554.37, 659.25, 880].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'triangle', 0.06, 0.08), i * 30)
        })
    }, [playTone])

    // Clean death (descending sine)
    const sfxHit = useCallback(() => {
        playTone(200.00, 'sine', 0.15, 0.25, 50.00)
    }, [playTone])

    const sfxSelect = useCallback(() => playTone(659.25, 'sine', 0.08, 0.1, 880), [playTone])

    // Fast pinging combo
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]
        const note = pentatonic[Math.min(combo, pentatonic.length - 1)]
        playTone(note, 'sine', 0.06, 0.08)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.08, 0.1), 40)
    }, [playTone])

    const sfxMilestone = useCallback(() => {
        playTone(523.25, 'triangle', 0.08, 0.1)
        setTimeout(() => playTone(659.25, 'triangle', 0.08, 0.1), 100)
        setTimeout(() => playTone(783.99, 'triangle', 0.1, 0.15), 200)
        setTimeout(() => playTone(1046.50, 'triangle', 0.12, 0.2), 300)
    }, [playTone])

    const sfxLevelUp = useCallback(() => {
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'triangle', 0.08, 0.1), i * 60)
        })
    }, [playTone])

    // Background Music (Relaxing, Hypnotic Spa Melody)
    const startBackgroundMusic = useCallback(() => {
        if (!soundEnabled) return
        initAudio()
        const ctx = audioCtxRef.current
        const master = masterGainRef.current
        const fx = fxNodeRef.current
        if (!ctx || !master || !fx || bgmOscRef.current) return

        if (ctx.state === 'suspended') ctx.resume()

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'

        // Very soft constant presence
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 3)

        osc.connect(gain)
        gain.connect(master)
        gain.connect(fx) // send through delay to make it super washed out

        // Use a very subtle chorus-like slow vibrato for relaxing vibe
        const vibrato = ctx.createOscillator()
        vibrato.type = 'sine'
        vibrato.frequency.value = 0.2 // 0.2Hz slow wobble
        const vibratoGain = ctx.createGain()
        vibratoGain.gain.value = 2 // +/- 2Hz pitch drift
        vibrato.connect(vibratoGain)
        vibratoGain.connect(osc.frequency)
        vibrato.start()

        osc.start()

        bgmOscRef.current = osc
        bgmGainRef.current = gain

        // Use a fast, plucky, hypnotic synthwave arpeggio
        // Fast 'degen' energy, but soft 'relaxing' sine notes with delay
        const notes = [
            220.00, 261.63, 329.63, 440.00, // Am
            174.61, 220.00, 261.63, 349.23, // F
            130.81, 164.81, 196.00, 261.63, // C
            196.00, 246.94, 293.66, 392.00  // G
        ]
        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.1

        const schedulePattern = () => {
            if (!bgmOscRef.current || !audioCtxRef.current) return

            // Schedule ahead by 0.5 seconds
            while (nextNoteTime < audioCtxRef.current.currentTime + 0.5) {
                osc.frequency.setValueAtTime(notes[noteIdx], nextNoteTime)

                // Fast plucky envelope (Synthwave Arp style) - LOUDER BGM
                gain.gain.setValueAtTime(0.0, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.08, nextNoteTime + 0.01) // louder sharp attack
                gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + 0.18) // slightly longer decay

                noteIdx = (noteIdx + 1) % notes.length

                // Fast 16th notes (approx 100 BPM)
                nextNoteTime += 0.15
            }
            setTimeout(schedulePattern, 200)
        }
        schedulePattern()

    }, [soundEnabled, initAudio])

    const stopBackgroundMusic = useCallback(() => {
        if (bgmOscRef.current && bgmGainRef.current && audioCtxRef.current) {
            const ct = audioCtxRef.current.currentTime
            bgmGainRef.current.gain.linearRampToValueAtTime(0, ct + 0.5)
            bgmOscRef.current.stop(ct + 0.5)
            bgmOscRef.current = null
            bgmGainRef.current = null
        }
    }, [])

    return {
        playTone,
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
        stopBackgroundMusic
    }
}
