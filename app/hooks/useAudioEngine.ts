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
            masterGainRef.current.gain.value = 0.35
            masterGainRef.current.connect(compressor)

            // Lush delay effect for all SFX
            fxNodeRef.current = audioCtxRef.current.createGain()
            fxNodeRef.current.gain.value = 0.35

            const delay = audioCtxRef.current.createDelay()
            delay.delayTime.value = 0.33 // 330ms hypnotic delay
            const feedback = audioCtxRef.current.createGain()
            feedback.gain.value = 0.35 // 35% delay feedback

            // LP filter to dampen echoes
            const filter = audioCtxRef.current.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.value = 2000

            fxNodeRef.current.connect(delay)
            delay.connect(filter)
            filter.connect(feedback)
            feedback.connect(delay)
            delay.connect(masterGainRef.current)
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

    // Sweeter FM-like plucks for actions
    const sfxJump = useCallback(() => playTone(392.00, 'sine', 0.25, 0.15, 440), [playTone]) // G4 to A4
    const sfxDoubleJump = useCallback(() => playTone(523.25, 'triangle', 0.25, 0.2, 587.33), [playTone]) // C5 to D5
    const sfxDash = useCallback(() => playTone(261.63, 'sine', 0.4, 0.15, 196.00), [playTone]) // C4 to G3 (whoosh down)

    // Sparkly chime chord (Major 9th arpeggio)
    const sfxCollect = useCallback(() => {
        playTone(523.25, 'sine', 0.3, 0.1) // C5
        setTimeout(() => playTone(659.25, 'triangle', 0.4, 0.15), 40) // E5
        setTimeout(() => playTone(783.99, 'sine', 0.5, 0.2), 80) // G5
        setTimeout(() => playTone(987.77, 'triangle', 0.6, 0.3), 120) // B5
    }, [playTone])

    // Heavenly harp glissando
    const sfxPowerup = useCallback(() => {
        [392.00, 440.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.4, 0.2), i * 40)
        })
    }, [playTone])

    // Soft, muffled thud
    const sfxHit = useCallback(() => {
        playTone(130.81, 'sine', 0.6, 0.2, 65.41)
        setTimeout(() => playTone(98.00, 'triangle', 0.7, 0.2, 49.00), 40)
    }, [playTone])

    const sfxSelect = useCallback(() => playTone(523.25, 'sine', 0.3, 0.1, 659.25), [playTone])

    // Gentle musical combo counter (playing up a C Major Pentatonic scale, lingering longer)
    const sfxCombo = useCallback((combo: number) => {
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]
        const note = pentatonic[Math.min(combo, pentatonic.length - 1)]
        playTone(note, 'triangle', 0.3, 0.1)
        setTimeout(() => playTone(note * 1.5, 'sine', 0.4, 0.2), 60)
    }, [playTone])

    const sfxMilestone = useCallback(() => {
        playTone(392.00, 'sine', 0.4, 0.15) // G4
        setTimeout(() => playTone(523.25, 'triangle', 0.4, 0.2), 150) // C5
        setTimeout(() => playTone(659.25, 'sine', 0.5, 0.3), 300) // E5
        setTimeout(() => playTone(783.99, 'triangle', 0.6, 0.4), 450) // G5
    }, [playTone])

    const sfxLevelUp = useCallback(() => {
        [261.63, 329.63, 392.00, 523.25, 659.25].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.6, 0.2), i * 100)
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

        // C Major Pentatonic (C4, D4, E4, G4, A4) - relaxing intervals
        const notes = [
            261.63, 329.63, 392.00, 329.63,
            440.00, 392.00, 523.25, 392.00,
            261.63, 293.66, 329.63, 392.00
        ]
        let noteIdx = 0
        let nextNoteTime = ctx.currentTime + 0.1

        const schedulePattern = () => {
            if (!bgmOscRef.current || !audioCtxRef.current) return

            while (nextNoteTime < audioCtxRef.current.currentTime + 1.0) {
                osc.frequency.setValueAtTime(notes[noteIdx], nextNoteTime)

                // Extremely soft attack and long decay (Harp/Pad like)
                gain.gain.setValueAtTime(0.005, nextNoteTime)
                gain.gain.linearRampToValueAtTime(0.015, nextNoteTime + 0.4) // Swell in
                gain.gain.exponentialRampToValueAtTime(0.005, nextNoteTime + 1.2) // long fade out

                noteIdx = (noteIdx + 1) % notes.length

                // Slow, hypnotic tempo (~50 BPM, 1.2 seconds per note)
                nextNoteTime += 1.2
            }
            setTimeout(schedulePattern, 800)
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
