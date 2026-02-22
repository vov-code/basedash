'use client'

/**
 * ============================================================================
 * BASE DASH — Game Engine Component
 * ============================================================================
 *
 * React component with game loop, physics simulation, collision detection,
 * input handling (keyboard + touch + gamepad), particle spawning,
 * score management, and all UI overlays (menu, paused, game over, HUD).
 *
 * Geometry Dash-inspired endless runner built on Base blockchain.
 * ============================================================================
 */
import {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react'

import {
  type GameMode,
  type EngineState,
  type Particle,
  type ParticleType,
  type TrailType,
  type TrailPoint,
  type MarketState,
  CFG,
  WORLDS,
  SPEEDS,
  IS_MOBILE,
  POWERUP_CONFIG,
  MARKET_CONFIG,
  TRAIL_UNLOCKS,
  clamp, lerp, rand, easeOut,
  getWorld, getWorldIndex, getSpeed, getJumps,
  createEngine, spawnPattern, formatMarketCap,
  updateGameConfig,
} from './gameConfig'
import { drawFrame } from './gameRenderer'
import { useWallet } from '@/app/hooks/useWallet'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction'

// ============================================================================
// PARTICLE SPAWNER HELPERS
// ============================================================================

/** Create a single particle with standard defaults */
const mkParticle = (
  x: number, y: number,
  type: ParticleType,
  color: string,
  overrides: Partial<Particle> = {}
): Particle => ({
  x, y,
  vx: rand(-60, 60),
  vy: rand(-120, -30),
  life: rand(0.4, 0.8),
  maxLife: 0.8,
  size: rand(2, 5),
  targetSize: 0,
  color,
  gravity: 300,
  type,
  angle: 0,
  rotation: rand(0, Math.PI * 2),
  rotationSpeed: rand(-5, 5),
  friction: 0.96,
  alpha: 1,
  pulse: 0,
  ...overrides,
})

/** Spawn jump dust particles */
const spawnJumpDust = (e: EngineState, count: number): void => {
  const w = getWorld(e.score)
  for (let i = 0; i < count; i++) {
    e.particles.push(mkParticle(
      CFG.PLAYER_X + rand(-5, CFG.PLAYER_SIZE + 5),
      CFG.GROUND - 2,
      'jump',
      w.accent,
      {
        vx: rand(-40, 40),
        vy: rand(-30, -80),
        life: rand(0.2, 0.5),
        maxLife: 0.5,
        size: rand(2, 5),
        gravity: 200,
        alpha: 0.6,
      }
    ))
  }
}

/** Spawn death explosion particles */
const spawnDeathBurst = (e: EngineState, count: number): void => {
  const w = getWorld(e.score)
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const speed = rand(80, 250)
    e.particles.push(mkParticle(
      CFG.PLAYER_X + CFG.PLAYER_SIZE / 2,
      e.player.y + CFG.PLAYER_SIZE / 2,
      i % 3 === 0 ? 'ring' : i % 3 === 1 ? 'burst' : 'spark',
      i % 2 === 0 ? w.redA : '#FFFFFF',
      {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.5, 1.2),
        maxLife: 1.2,
        size: rand(3, 8),
        gravity: 150,
        friction: 0.94,
        alpha: 0.9,
      }
    ))
  }
}

/** Spawn collection sparkles */
const spawnCollectSparkle = (e: EngineState, x: number, y: number, count: number): void => {
  const w = getWorld(e.score)
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const speed = rand(40, 120)
    e.particles.push(mkParticle(x, y, 'collect', w.greenA, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: rand(0.4, 0.8),
      maxLife: 0.8,
      size: rand(2, 5),
      gravity: 80,
      friction: 0.95,
      alpha: 0.85,
    }))
  }
}

/** Spawn speed-based trail particles behind player */
const spawnTrailParticle = (e: EngineState): void => {
  const w = getWorld(e.score)
  const speedTier = getSpeed(e.score)
  if (Math.random() > 0.3 + speedTier.particleBoost * 0.4) return
  e.particles.push(mkParticle(
    CFG.PLAYER_X - rand(5, 15),
    e.player.y + CFG.PLAYER_SIZE / 2 + rand(-8, 8),
    'trail',
    w.particleColor,
    {
      vx: rand(-50, -20),
      vy: rand(-15, 15),
      life: rand(0.15, 0.35),
      maxLife: 0.35,
      size: rand(1.5, 3.5),
      gravity: 0,
      friction: 0.92,
      alpha: 0.5,
    }
  ))
}

// ============================================================================
// MAIN GAME COMPONENT
// ============================================================================

interface GameEngineProps {
  onScoreSubmit?: (score: number) => Promise<void>
  storageKey?: string
  isConnected?: boolean
  canSubmitScore?: boolean
  connectWallet?: () => void
  isScoreConfirmed?: boolean
  submitTxHash?: `0x${string}`
}

// ============================================================================
// SOUND EFFECTS — Web Audio API generated tones (no external files)
// ============================================================================

let audioCtx: AudioContext | null = null
let audioInitialized = false
let musicOscillators: OscillatorNode[] = []
let musicGain: GainNode | null = null
let isMusicPlaying = false

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
      audioInitialized = true
    } catch (error) {
      console.warn('Audio context not supported:', error)
      return null
    }
  }
  return audioCtx
}

/** Initialize audio context on user interaction */
function initAudio(): boolean {
  const ctx = getAudioCtx()
  if (!ctx) return false

  try {
    // Resume audio context if suspended (browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* ignore resume errors */ })
    }
    return true
  } catch (error) {
    console.warn('Failed to initialize audio:', error)
    return false
  }
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.12) {
  const ctx = getAudioCtx()
  if (!ctx) return

  try {
    // Check if context is in a playable state
    if (ctx.state === 'closed') return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (error) {
    // Silently fail - audio is not critical
    if (process.env.NODE_ENV === 'development') {
      console.warn('Tone playback error:', error)
    }
  }
}

/**
 * 8-bit chiptune background music — 4 channel sequencer
 * Channels: kick (noise), bass (square), lead (square), hi-hat (noise)
 * 16-step pattern at ~140 BPM, pentatonic scale
 */
let musicIntervalId: ReturnType<typeof setInterval> | null = null
let musicStep = 0
export let activeWorldIndex = 0 // Track globally for the audio sequencer

function startBackgroundMusic(): void {
  if (!initAudio() || isMusicPlaying) return

  const ctx = getAudioCtx()
  if (!ctx) return

  // Stop any existing music first to prevent layering
  stopBackgroundMusic()

  try {
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.25 // Lowered volume per request
    musicGain.connect(ctx.destination)

    // Minimal percussion: soft tick on 0,4,8,12
    const tickBeat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

    musicStep = 0

    const playStep = () => {
      // Stop music when tab is hidden to prevent layering
      if (document.hidden) return
      if (!ctx || ctx.state === 'closed' || !musicGain) return
      try {
        const now = ctx.currentTime
        const s = musicStep % 16

        // Dynamically change music based on current world tracker
        const currentWorld = activeWorldIndex

        let melodyNotes = [220, 262, 294, 220, 330, 294, 262, 247, 220, 262, 330, 294, 262, 247, 220, 262]
        let padNotes = [110, 110, 131, 131, 110, 110, 98, 98, 110, 110, 131, 131, 110, 110, 98, 98]
        let waveType: OscillatorType = 'sine'
        let padType: OscillatorType = 'sine'

        // World-dependent music variations
        if (currentWorld >= 8) {
          // Intense alien synthesis
          melodyNotes = [880, 0, 987, 880, 1046, 0, 987, 880, 1318, 0, 1174, 1046, 987, 0, 880, 783]
          padNotes = [220, 220, 246, 246, 261, 261, 246, 246, 329, 329, 293, 293, 246, 246, 220, 220]
          waveType = 'sawtooth'
          padType = 'square'
        } else if (currentWorld >= 5) {
          // Upbeat techy 
          melodyNotes = [329, 329, 392, 329, 440, 392, 329, 293, 261, 261, 329, 261, 293, 261, 220, 261]
          padNotes = [164, 0, 196, 0, 220, 0, 196, 0, 130, 0, 164, 0, 146, 0, 110, 0]
          waveType = 'square'
          padType = 'triangle'
        } else if (currentWorld >= 2) {
          // Harmonic synth
          melodyNotes = [261, 293, 329, 392, 440, 392, 329, 293, 261, 329, 392, 440, 523, 440, 392, 329]
          padNotes = [130, 130, 164, 164, 196, 196, 164, 164, 130, 130, 164, 164, 196, 196, 164, 164]
          waveType = 'triangle'
          padType = 'sine'
        }

        // Lead melody
        if (melodyNotes[s] > 0) {
          const leadOsc = ctx.createOscillator()
          const leadGain = ctx.createGain()
          leadOsc.type = waveType
          leadOsc.frequency.setValueAtTime(melodyNotes[s], now)
          leadGain.gain.setValueAtTime(0.04, now)
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + (waveType === 'sine' ? 0.35 : 0.2))
          leadOsc.connect(leadGain)
          leadGain.connect(musicGain!)
          leadOsc.start(now)
          leadOsc.stop(now + 0.4)
        }

        // Pad bass
        if (padNotes[s] > 0) {
          const padOsc = ctx.createOscillator()
          const padGain = ctx.createGain()
          padOsc.type = padType
          padOsc.frequency.setValueAtTime(padNotes[s], now)
          padGain.gain.setValueAtTime(0.03, now)
          padGain.gain.exponentialRampToValueAtTime(0.001, now + (padType === 'sine' ? 0.6 : 0.3))
          padOsc.connect(padGain)
          padGain.connect(musicGain!)
          padOsc.start(now)
          padOsc.stop(now + 0.7)
        }

        // Soft tick — gentle sine blip
        if (tickBeat[s]) {
          const tickOsc = ctx.createOscillator()
          const tickG = ctx.createGain()
          tickOsc.type = 'sine'
          tickOsc.frequency.setValueAtTime(800, now)
          tickG.gain.setValueAtTime(0.02, now)
          tickG.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
          tickOsc.connect(tickG)
          tickG.connect(musicGain!)
          tickOsc.start(now)
          tickOsc.stop(now + 0.06)
        }

        musicStep++
      } catch { /* ignore */ }
    }

    // ~80 BPM = ~188ms per 16th note step (calm tempo)
    musicIntervalId = setInterval(playStep, 188)
    playStep()

    isMusicPlaying = true
  } catch (error) {
    console.warn('Failed to start background music:', error)
  }
}

function stopBackgroundMusic(): void {
  if (!musicGain || !isMusicPlaying) return

  try {
    // Clear arpeggio interval
    if (musicIntervalId) {
      clearInterval(musicIntervalId)
      musicIntervalId = null
    }

    // Fade out
    const ctx = getAudioCtx()
    if (ctx && musicGain) {
      musicGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
    }

    // Stop oscillators
    musicOscillators.forEach((osc) => {
      try {
        osc.stop(ctx?.currentTime ? ctx.currentTime + 0.5 : 0)
      } catch { /* ignore */ }
    })
    musicOscillators = []

    isMusicPlaying = false
  } catch (error) {
    console.warn('Failed to stop background music:', error)
  }
}

/** Play a celebratory fanfare for new record */
function playNewRecordFanfare(): void {
  const ctx = getAudioCtx()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const fanfare = [523.25, 659.25, 783.99, 1046.50] // C5 E5 G5 C6

    fanfare.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.12)

      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.5)
    })
  } catch (error) {
    console.warn('Failed to play fanfare:', error)
  }
}

// Global sound mute flag
let globalSoundMuted = false

function sfxJump() {
  if (globalSoundMuted || !initAudio()) return
  // Warm ascending arpeggio — like opening a long position
  playTone(392, 0.04, 'sine', 0.04)
  setTimeout(() => playTone(494, 0.05, 'sine', 0.035), 20)
  setTimeout(() => playTone(587, 0.06, 'triangle', 0.025), 45)
  setTimeout(() => playTone(784, 0.08, 'sine', 0.015), 70)
}

function sfxDeath() {
  if (globalSoundMuted || !initAudio()) return
  // Crystalline wind-chime descend — position closed gracefully
  playTone(880, 0.08, 'sine', 0.05)
  setTimeout(() => playTone(698, 0.10, 'sine', 0.04), 40)
  setTimeout(() => playTone(523, 0.14, 'triangle', 0.035), 90)
  setTimeout(() => playTone(392, 0.18, 'sine', 0.025), 150)
  setTimeout(() => playTone(262, 0.25, 'sine', 0.015), 220)
}

function sfxCollect() {
  if (globalSoundMuted || !initAudio()) return
  // Bubbly pop + sparkle tail — profit locked in
  playTone(1047, 0.03, 'sine', 0.06)
  playTone(1319, 0.04, 'triangle', 0.045)
  setTimeout(() => playTone(1568, 0.06, 'sine', 0.03), 25)
  setTimeout(() => playTone(2093, 0.08, 'sine', 0.015), 55)
}

/** 4.3 — Combo sound: pitch rises by semitone per level, capped at 1 octave */
function sfxCombo(comboLevel: number) {
  if (globalSoundMuted || !initAudio()) return
  const semitone = Math.pow(2, 1 / 12)
  const steps = Math.min(comboLevel, 12)
  const baseFreq = 440 * Math.pow(semitone, steps)
  playTone(baseFreq, 0.06, 'sine', 0.09)
  setTimeout(() => playTone(baseFreq * 2, 0.04, 'triangle', 0.04), 30)  // overtone
}

/** Near-miss whoosh */
function sfxNearMiss() {
  if (globalSoundMuted || !initAudio()) return
  playTone(200, 0.15, 'sawtooth', 0.04)
  playTone(1200, 0.08, 'sine', 0.06)
}

/** Market cycle change fanfare */
function sfxMarketChange(isBull: boolean) {
  if (globalSoundMuted || !initAudio()) return
  if (isBull) {
    playTone(523, 0.08, 'sine', 0.06)
    setTimeout(() => playTone(659, 0.08, 'sine', 0.06), 80)
    setTimeout(() => playTone(784, 0.10, 'sine', 0.05), 160)
  } else {
    playTone(440, 0.08, 'sine', 0.06)
    setTimeout(() => playTone(370, 0.10, 'sine', 0.06), 80)
    setTimeout(() => playTone(330, 0.12, 'sawtooth', 0.04), 160)
  }
}

/** Rug pull alarm */
function sfxRugPull() {
  if (globalSoundMuted || !initAudio()) return
  playTone(800, 0.10, 'square', 0.08)
  setTimeout(() => playTone(600, 0.10, 'square', 0.08), 120)
  setTimeout(() => playTone(800, 0.10, 'square', 0.06), 240)
}

/** Open chime — played once on menu load */
function sfxOpenChime() {
  if (globalSoundMuted || !initAudio()) return
  playTone(523, 0.12, 'sine', 0.06)
  setTimeout(() => playTone(659, 0.10, 'sine', 0.05), 100)
  setTimeout(() => playTone(784, 0.14, 'triangle', 0.04), 200)
}

function sfxPowerUp() {
  if (globalSoundMuted || !initAudio()) return
  playTone(660, 0.08, 'sine', 0.10)
  setTimeout(() => playTone(880, 0.08, 'sine', 0.08), 60)
  setTimeout(() => playTone(1100, 0.10, 'sine', 0.06), 120)
  setTimeout(() => playTone(1320, 0.12, 'triangle', 0.05), 180)
}

// ============================================================================
// HAPTIC HELPERS
// ============================================================================

function hapticJump() {
  try { navigator?.vibrate?.(30) } catch { /* no haptic */ }
}

function hapticDeath() {
  try { navigator?.vibrate?.([80, 40, 80]) } catch { /* no haptic */ }
}

function hapticCollect() {
  try { navigator?.vibrate?.(15) } catch { /* no haptic */ }
}

// ============================================================================
// GAME STATS — computed on death for display
// ============================================================================

interface GameStats {
  timeSurvived: number
  candlesDodged: number
  greensCollected: number
  totalJumps: number
  maxCombo: number
}

// Trading-themed death messages
const DEATH_MESSAGES = [
  'position liquidated!',
  'liquidated at',
  'stop-loss triggered!',
  'margin called!',
  'position closed!',
  'rug pulled!',
  'trade expired!',
  'portfolio rekt!',
  'leverage too high!',
]

function getRandomDeathMessage(): string {
  return DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]
}

export default function GameEngine({
  onScoreSubmit,
  storageKey = 'basedash_highscore_v2',
  isConnected = false,
  canSubmitScore = false,
  connectWallet,
  isScoreConfirmed = false,
  submitTxHash,
}: GameEngineProps) {
  // --- React state ---
  const [mode, setMode] = useState<GameMode>('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [combo, setCombo] = useState(0)
  const [worldName, setWorldName] = useState(WORLDS[0].name)
  const [speedName, setSpeedName] = useState('easy')
  const [deathScore, setDeathScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [gameStats, setGameStats] = useState<GameStats | null>(null)
  const [connectingWallet, setConnectingWallet] = useState(false)
  const [isNewRecord, setIsNewRecord] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [deathMessage, setDeathMessage] = useState('rekt!')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [activeTrail, setActiveTrail] = useState<TrailType>('default')
  const { address } = useWallet()
  const [txContracts, setTxContracts] = useState<any[] | null>(null)

  // Fetch signature for OnchainKit Transaction when player dies with a new record
  useEffect(() => {
    if (mode === 'gameover' && isNewRecord && deathScore > 0 && address && !txContracts) {
      fetch(`/api/score-sign?address=${address}&score=${deathScore}`)
        .then(res => res.json())
        .then(data => {
          if (data.nonce && data.signature) {
            setTxContracts([{
              address: CONTRACT_ADDRESS,
              abi: GAME_LEADERBOARD_ABI,
              functionName: 'submitScore',
              args: [BigInt(deathScore), BigInt(data.nonce), data.signature as `0x${string}`],
            }])
          }
        })
        .catch(console.error)
    }
    if (mode === 'playing') {
      setTxContracts(null)
    }
  }, [mode, isNewRecord, deathScore, address, txContracts])

  // --- Adaptive Screen State ---
  const [dims, setDims] = useState({ w: CFG.WIDTH, h: CFG.HEIGHT, dpr: 1 })

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EngineState>(createEngine())
  const rafRef = useRef<number | null>(null)
  const highScoreRef = useRef(0)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const demoRafRef = useRef<number | null>(null)
  const chimePlayedRef = useRef(false)
  const [nearRecordDiff, setNearRecordDiff] = useState<number | null>(null)
  const [retryVisible, setRetryVisible] = useState(false)

  // ========================================================================
  // PHYSICS UPDATE — Heart of the game
  // ========================================================================

  const update = useCallback((dt: number) => {
    const e = engineRef.current
    if (!e.alive) return

    e.gameTime += dt
    // Smooth exponential difficulty (item 1)
    e.difficulty = 1 - Math.exp(-e.score / 2500)
    // Time-based warmup: first 8s gentler
    const warmup = clamp(e.gameTime / 8, 0.5, 1.0)
    const speedTier = getSpeed(e.score)
    const speedMult = speedTier.multiplier
    const slowMult = e.slowdownTimer > 0 ? CFG.SLOW_MULT : 1
    const nearMissMult = e.nearMissTimer > 0 ? 0.4 : 1 // near-miss slow-mo
    const bearMult = 1 // Market mechanics disabled
    const frameSpeed = CFG.BASE_SPEED * speedMult * slowMult * nearMissMult * bearMult * warmup

    e.speed = lerp(e.speed, frameSpeed, dt * 4)
    e.distance += e.speed * dt
    e.distanceTraveled += e.speed * dt
    e.backgroundOffset += e.speed * dt * 0.5
    e.groundOffset += e.speed * dt
    e.cloudOffset += e.speed * dt

    // --- Timers ---
    if (e.slowdownTimer > 0) e.slowdownTimer -= dt
    if (e.nearMissTimer > 0) e.nearMissTimer -= dt
    if (e.speedLinesTimer > 0) e.speedLinesTimer -= dt
    if (e.comboPulseTimer > 0) e.comboPulseTimer -= dt

    // --- Tutorial: hide after first jump ---
    if (e.showTutorial && e.totalJumps > 0) e.showTutorial = false

    // --- Market cycle — DISABLED ---
    // Market mechanics removed for cleaner gameplay

    // --- Rug-pull event ---
    if (e.rugPullActive) {
      e.rugPullTimer -= dt
      if (e.rugPullTimer <= 0) {
        e.rugPullActive = false
      }
      // Player falls through ground during rug-pull if on ground
      if (e.player.onGround && !e.player.isDashing) {
        // Ground disappears — player must jump to survive
        // They don't insta-die, just fall slightly with warning
      }
    } else if (e.score >= 1500 && Math.random() < 0.0002 * e.difficulty) {
      e.rugPullActive = true
      e.rugPullTimer = MARKET_CONFIG.RUG_PULL_DURATION
      sfxRugPull()
    }

    // --- Speed tier change detection ---
    const currentTierIdx = SPEEDS.findIndex((s, i) => {
      const next = SPEEDS[i + 1]
      return !next || e.score < next.startScore
    })
    if (currentTierIdx > e.prevSpeedTierIdx) {
      e.prevSpeedTierIdx = currentTierIdx
      e.speedLinesTimer = 1.5
    }

    // --- Player physics ---
    const p = e.player
    p.maxJumps = getJumps(e.score)

    // Gravity — asymmetric: lighter going up, heavier falling (item 1)
    if (!p.isDashing) {
      const grav = p.velocityY < 0 ? CFG.GRAVITY_UP : CFG.GRAVITY_DOWN
      p.velocityY += grav * dt
      p.velocityY = Math.min(p.velocityY, CFG.MAX_FALL)
    }

    // Apply velocity
    p.y += p.velocityY * dt

    // Ground collision
    if (p.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
      if (p.velocityY > 0) {
        p.y = CFG.GROUND - CFG.PLAYER_SIZE
        if (p.velocityY > 150) {
          // Strong landing squash (item 6)
          p.squash = clamp(p.velocityY / 800, Math.abs(CFG.SQUASH_LAND) * 0.4, Math.abs(CFG.SQUASH_LAND))
          spawnJumpDust(e, IS_MOBILE ? 4 : 7)
        }
        p.velocityY = 0
        p.onGround = true
        p.coyoteTimer = CFG.COYOTE
        p.jumpCount = 0
      } else {
        p.onGround = false
      }
    } else {
      p.onGround = false
    }

    // Coyote time
    if (p.onGround) {
      p.coyoteTimer = CFG.COYOTE
    } else {
      p.coyoteTimer -= dt
    }

    // Jump buffer
    if (p.jumpBufferTimer > 0) {
      p.jumpBufferTimer -= dt
      if (p.onGround || p.coyoteTimer > 0) {
        performJump(e, false)
        p.jumpBufferTimer = 0
      }
    }

    // Dash timer
    if (p.isDashing) {
      p.dashTimer -= dt
      p.velocityY = 0 // freeze Y during dash
      p.y += 0 // no vertical movement
      if (p.dashTimer <= 0) {
        p.isDashing = false
        p.dashTimer = CFG.DASH_COOLDOWN
      }
    } else if (p.dashTimer > 0) {
      p.dashTimer -= dt
    }

    // Rotation — smooth spin in the air, snap on landing
    if (p.onGround) {
      // Snap rotation to nearest 90° when on ground
      const snapTarget = Math.round(p.rotation / HALF_PI) * HALF_PI
      p.rotation = lerp(p.rotation, snapTarget, dt * 18)
    } else {
      p.rotation += CFG.ROT_SPEED * dt
    }

    // Squash/stretch animation
    // Breathe idle animation when on ground (item 6)
    if (p.onGround && e.alive && Math.abs(p.squash) < 0.01) {
      p.squash = Math.sin(e.gameTime * CFG.BREATHE_SPEED) * CFG.BREATHE_AMP
    }
    p.squash = lerp(p.squash, 0, dt * 12)
    p.scale = 1 + p.squash * (p.velocityY < 0 ? -0.3 : 0.4)

    // Tilt based on velocity
    const targetTilt = clamp(p.velocityY / 800, -1, 1)
    p.tilt = lerp(p.tilt, targetTilt, dt * CFG.TILT_SPEED)

    // Flash decay
    p.flash = Math.max(0, p.flash - dt * 4)

    // Invincibility
    p.invincible = Math.max(0, p.invincible - dt)

    // Trail — spawn ghost image
    if (!p.onGround && e.player.trail.length < CFG.TRAIL_LIMIT) {
      const trailInterval = 0.06
      if (e.gameTime % trailInterval < dt) {
        p.trail.push({
          x: p.x, y: p.y,
          life: 1, alpha: 0.35,
          size: CFG.PLAYER_SIZE,
          rotation: p.rotation,
          scale: p.scale,
        })
      }
    }

    // Update trail
    p.trail = p.trail.filter(t => {
      t.life -= dt * 3
      t.alpha -= dt * 1.5
      return t.life > 0 && t.alpha > 0
    })

    // Speed-based trail particles
    spawnTrailParticle(e)

    // --- Update candles ---
    for (const c of e.candles) {
      c.x -= e.speed * dt
      c.phase += dt * c.flickerSpeed

      // Moving candle animation
      if (c.isMoving) {
        c.movePhase += dt * c.moveSpeed
        const wobble = Math.sin(c.movePhase) * c.moveAmplitude
        c.bodyY = c.targetY + wobble
        c.y = c.bodyY
        c.bodyTop = c.bodyY + c.bodyHeight
        c.wickTop = c.bodyY - (c.height - c.bodyHeight) * 0.6
        c.wickBottom = c.bodyY + c.bodyHeight + (c.height - c.bodyHeight) * 0.4
      }

      // Collection progress
      if (c.collected) c.collectProgress = Math.min(1, c.collectProgress + dt * 3)

      // Score — passed candle
      if (!c.passed && c.x + c.width < CFG.PLAYER_X) {
        c.passed = true
        if (c.kind === 'red' && !c.collected) {
          const pts = CFG.RED_SCORE * Math.max(1, e.combo) * e.scoreMultiplier
          e.score += Math.round(pts)
          e.scorePulse = 1
        }
      }
    }

    // Remove off-screen candles
    e.candles = e.candles.filter(c => c.x + c.width > -100)

    // --- Spawn patterns ---
    if (e.distance >= e.nextSpawnDistance) {
      spawnPattern(e)
    }

    // --- Collision detection ---
    const px1 = CFG.PLAYER_X + CFG.HITBOX
    const py1 = p.y + CFG.HITBOX
    const px2 = CFG.PLAYER_X + CFG.PLAYER_SIZE - CFG.HITBOX
    const py2 = p.y + CFG.PLAYER_SIZE - CFG.HITBOX

    for (const c of e.candles) {
      if (c.collected || c.x + c.width < CFG.PLAYER_X - 10) continue
      if (c.x > CFG.PLAYER_X + CFG.PLAYER_SIZE + 10) continue

      const cx1 = c.x + 2
      const cy1 = c.bodyY + 2
      const cx2 = c.x + c.width - 2
      const cy2 = c.bodyY + c.bodyHeight - 2

      const hit = px1 < cx2 && px2 > cx1 && py1 < cy2 && py2 > cy1

      if (hit) {
        if (c.kind === 'red') {
          if (p.invincible <= 0) {
            // Shield check (diamond hands power-up)
            if (e.shieldActive) {
              e.shieldActive = false
              e.shieldFlashTimer = 0.3  // White screen flash (item 4)
              p.invincible = 0.8
              p.flash = 0.8
              e.shakeTimer = 0.2
              sfxCollect()
              hapticCollect()
              // Shield break particles
              for (let i = 0; i < 8; i++) {
                e.particles.push(mkParticle(
                  CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, p.y + CFG.PLAYER_SIZE / 2,
                  'powerup', '#00D4FF',
                  { vx: rand(-150, 150), vy: rand(-200, -50), life: rand(0.5, 0.8), size: rand(4, 8) }
                ))
              }
              continue
            }
            // DEATH
            e.alive = false
            e.shakeTimer = 0.4
            setDeathScore(e.score)
            // Compute game stats
            const dodged = e.candles.filter(c => c.kind === 'red' && c.passed && !c.collected).length
            setGameStats({
              timeSurvived: e.gameTime,
              candlesDodged: dodged + Math.floor(e.score / CFG.RED_SCORE),
              greensCollected: e.totalCollected,
              totalJumps: e.totalJumps,
              maxCombo: e.maxCombo,
            })
            setMode('gameover')
            // 8.3 — "LIQUIDATED at $X" death message
            const msg = getRandomDeathMessage()
            setDeathMessage(msg === 'liquidated at' ? `liquidated at ${formatMarketCap(e.score)}` : msg)
            // Sound + haptic
            sfxDeath()
            hapticDeath()
            // Save high score & new record celebration
            if (e.score > highScoreRef.current) {
              highScoreRef.current = e.score
              setBest(e.score)
              setIsNewRecord(true)
              playNewRecordFanfare()
              try { localStorage.setItem(storageKey, String(e.score)) } catch { }
            }
            // Death particles
            spawnDeathBurst(e, IS_MOBILE ? 16 : 28)
            return
          }
        } else if (c.kind === 'green' && !c.collected) {
          // COLLECT green candle
          c.collected = true
          const greenPts = CFG.GREEN_SCORE * e.scoreMultiplier
          e.score += Math.round(greenPts)
          e.combo += 1
          e.maxCombo = Math.max(e.maxCombo, e.combo)
          e.totalCollected += 1
          e.slowdownTimer = CFG.SLOW_TIME
          e.scorePulse = 1
          e.comboPulse = 1
          p.flash = 0.6
          p.invincible = 0.3
          // 7.3 — Combo pulse at x5 milestones
          if (e.combo > 0 && e.combo % 5 === 0) {
            e.comboPulseTimer = 0.5
            sfxCombo(e.combo)
          }
          // Sound + haptic
          sfxCollect()
          hapticCollect()
          // Collection particles
          spawnCollectSparkle(e, c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, IS_MOBILE ? 6 : 12)
        }
      } else if (c.kind === 'red' && !c.passed && c.x + c.width < CFG.PLAYER_X + 5 && c.x + c.width > CFG.PLAYER_X - 10 && e.nearMissTimer <= 0 && (e.gameTime - (e as any)._lastNearMissTime > MARKET_CONFIG.NEAR_MISS_COOLDOWN)) {
        // Near-miss detection: only genuine close calls with cooldown
        const vertDistTop = Math.abs((p.y + CFG.PLAYER_SIZE - CFG.HITBOX) - c.bodyY)
        const vertDistBot = Math.abs((p.y + CFG.HITBOX) - (c.bodyY + c.bodyHeight))
        const passedOver = p.y + CFG.PLAYER_SIZE - CFG.HITBOX < c.bodyY && vertDistTop < MARKET_CONFIG.NEAR_MISS_DIST
        const passedUnder = p.y + CFG.HITBOX > c.bodyY + c.bodyHeight && vertDistBot < MARKET_CONFIG.NEAR_MISS_DIST

        if (passedOver || passedUnder) {
          e.nearMissTimer = MARKET_CONFIG.NEAR_MISS_DURATION;
          (e as any)._lastNearMissTime = e.gameTime
          e.nearMissText = 'CLOSE!'
          e.nearMissX = c.x + c.width / 2
          e.nearMissY = c.bodyY - 20
          e.score += 15
          sfxNearMiss()
        }
      }
    }

    // --- Update power-ups ---
    for (const pu of e.powerUps) {
      pu.x -= e.speed * dt
      pu.phase += dt * pu.bobSpeed
      pu.glowPhase += dt * 2
      if (pu.collected) {
        pu.collectProgress = Math.min(1, pu.collectProgress + dt * 3)
        continue
      }

      // Power-up collision (AABB)
      const puCx = pu.x + pu.size / 2
      const puCy = pu.y + Math.sin(pu.phase) * POWERUP_CONFIG.BOB_AMPLITUDE
      const puHalf = pu.size / 2
      if (px1 < puCx + puHalf && px2 > puCx - puHalf && py1 < puCy + puHalf && py2 > puCy - puHalf) {
        pu.collected = true
        sfxPowerUp()
        hapticCollect()

        // Apply power-up effect
        switch (pu.kind) {
          case 'diamond_hands':
            e.shieldActive = true
            break
          case 'moon_boost':
            e.moonBoostTimer = POWERUP_CONFIG.TYPES.moon_boost.duration
            e.scoreMultiplier = 2
            e.moonBoostPulseActive = true  // Golden HUD pulse (item 4)
            break
          case 'whale_mode':
            e.whaleTimer = POWERUP_CONFIG.TYPES.whale_mode.duration
            e.slowdownTimer = Math.max(e.slowdownTimer, POWERUP_CONFIG.TYPES.whale_mode.duration)
            // Whale mode: pitch-shift music down (item 4/5)
            try {
              const ctx = getAudioCtx()
              if (ctx && musicGain) {
                // We can't change playbackRate of setInterval, but we can slow the gain envelope
                musicGain.gain.setValueAtTime(0.18, ctx.currentTime)
              }
            } catch { /* ignore */ }
            break
        }

        // 7.4 — Camera zoom out on power-up
        e.cameraZoom = 0.92

        // Spawn celebration particles
        const config = POWERUP_CONFIG.TYPES[pu.kind]
        for (let i = 0; i < 10; i++) {
          e.particles.push(mkParticle(
            puCx, puCy,
            'powerup', config.color1,
            { vx: rand(-120, 120), vy: rand(-180, -30), life: rand(0.5, 1), size: rand(3, 7) }
          ))
        }
      }
    }

    // Remove off-screen power-ups and fully collected ones
    e.powerUps = e.powerUps.filter(pu => pu.x + pu.size > -50 && !(pu.collected && pu.collectProgress >= 1))

    // --- Power-up timers ---
    if (e.moonBoostTimer > 0) {
      e.moonBoostTimer -= dt
      if (e.moonBoostTimer <= 0) {
        e.moonBoostTimer = 0
        e.scoreMultiplier = 1
        e.moonBoostPulseActive = false  // End golden HUD pulse (item 4)
      }
    }
    if (e.whaleTimer > 0) {
      e.whaleTimer -= dt
      if (e.whaleTimer <= 0) {
        // Restore music volume after whale mode (item 4)
        try {
          const ctx = getAudioCtx()
          if (ctx && musicGain) {
            musicGain.gain.setValueAtTime(0.25, ctx.currentTime)
          }
        } catch { /* ignore */ }
      }
    }

    // Shield flash timer (item 4)
    if (e.shieldFlashTimer > 0) e.shieldFlashTimer -= dt

    // --- World transitions ---
    const newWorldIdx = getWorldIndex(e.score)
    if (newWorldIdx !== e.worldIndex) {
      e.worldIndex = newWorldIdx
      const newWorld = WORLDS[newWorldIdx]
      e.worldName = newWorld.name
      e.worldBannerTimer = 3.5
      // Update star colors for new world
      for (const s of e.stars) s.color = newWorld.starColor
    }

    // --- Update stars ---
    for (const s of e.stars) {
      s.twinkle += dt * s.twinkleSpeed
    }

    // --- Update ground particles ---
    for (const gp of e.groundParticles) {
      gp.x -= e.speed * dt * gp.speed
      gp.phase += dt * 2 * gp.speed
      if (gp.x < -10) gp.x = CFG.WIDTH + rand(5, 30)
    }

    // --- Update particles (effects) ---
    e.particles = e.particles.filter(pt => {
      pt.life -= dt
      if (pt.life <= 0) return false
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += pt.gravity * dt
      pt.vx *= pt.friction
      pt.rotation += pt.rotationSpeed * dt
      return true
    })

    // Cap particle count
    if (e.particles.length > CFG.PARTICLE_LIMIT) {
      e.particles = e.particles.slice(-CFG.PARTICLE_LIMIT)
    }

    // --- Screen shake ---
    if (e.shakeTimer > 0) {
      e.shakeTimer -= dt
      const intensity = e.shakeTimer * 8
      e.shakeX = (Math.random() - 0.5) * intensity
      e.shakeY = (Math.random() - 0.5) * intensity
    } else {
      e.shakeX = 0; e.shakeY = 0
    }

    // --- World banner timer ---
    if (e.worldBannerTimer > 0) e.worldBannerTimer -= dt

    // --- Camera zoom lerp back to 1.0 (7.4) ---
    if (e.cameraZoom < 1) {
      e.cameraZoom = Math.min(1, e.cameraZoom + dt * 0.5)
    }

    // 7.5 — Running dust particles (subtle ground trail)
    if (p.onGround && e.alive) {
      e.runDustTimer -= dt
      if (e.runDustTimer <= 0) {
        e.runDustTimer = IS_MOBILE ? 0.15 : 0.08
        e.particles.push(mkParticle(
          CFG.PLAYER_X + rand(-5, 5), CFG.GROUND - 2,
          'dust', 'rgba(150,150,180,0.4)',
          { vx: rand(-20, -5), vy: rand(-15, -5), life: rand(0.3, 0.5), size: rand(1, 2.5), gravity: 10 }
        ))
      }
    }

    // 8.4 — Rug-pull ground damage: force jump or take damage
    if (e.rugPullActive) {
      // Generate visual holes
      if (e.rugPullHoles.length < 6) {
        e.rugPullHoles.push(rand(0, CFG.WIDTH))
      }
      // Player on ground too long during rug-pull = death
      if (p.onGround && e.rugPullTimer < MARKET_CONFIG.RUG_PULL_DURATION - 0.5) {
        // Force player off ground—give them a chance first
        if (e.rugPullTimer < MARKET_CONFIG.RUG_PULL_DURATION - 1.5) {
          e.alive = false
          e.shakeTimer = 0.4
          setDeathScore(e.score)
          setGameStats({
            timeSurvived: e.gameTime,
            candlesDodged: e.candles.filter(c => c.kind === 'red' && c.passed).length,
            greensCollected: e.totalCollected,
            totalJumps: e.totalJumps,
            maxCombo: e.maxCombo,
          })
          setMode('gameover')
          setDeathMessage('rug pulled!')
          sfxDeath()
          hapticDeath()
          spawnDeathBurst(e, IS_MOBILE ? 16 : 28)
          return
        }
      }
    } else {
      e.rugPullHoles = []
    }

    // --- Animation timers ---
    if (e.scorePulse > 0) e.scorePulse -= dt * 3
    if (e.comboPulse > 0) e.comboPulse -= dt * 3

    // --- UI update (throttled) ---
    e.uiTimer += dt
    if (e.uiTimer >= CFG.UI_RATE) {
      e.uiTimer = 0
      setScore(e.score)
      setCombo(e.combo)
      setWorldName(e.worldName)
      setSpeedName(getSpeed(e.score).label)
    }
  }, [storageKey])

  const HALF_PI = Math.PI / 2

  // ========================================================================
  // JUMP LOGIC
  // ========================================================================

  const performJump = useCallback((e: EngineState, isDouble: boolean) => {
    const p = e.player
    if (isDouble) {
      p.velocityY = CFG.DOUBLE_JUMP
      p.jumpCount = p.maxJumps
    } else {
      p.velocityY = CFG.JUMP
      p.jumpCount = 1
    }
    p.onGround = false
    p.coyoteTimer = 0
    p.squash = -0.15
    e.totalJumps += 1
    e.shakeTimer = 0.04

    // Jump particles
    spawnJumpDust(e, IS_MOBILE ? 3 : 6)
    // Sound + haptic
    sfxJump()
    hapticJump()
  }, [])

  // ========================================================================
  // GAME START / RESET
  // ========================================================================

  const startGame = useCallback(() => {
    const engine = createEngine()
    engine.activeTrail = activeTrail
    engineRef.current = engine
    setScore(0)
    setCombo(0)
    setError(null)
    setSubmitted(false)
    setSubmitting(false)
    setGameStats(null)
    setWorldName(WORLDS[0].name)
    setSpeedName('easy')
    setIsNewRecord(false)
    setDeathMessage('rekt!')
    setNearRecordDiff(null)
    setRetryVisible(false)
    setMode('playing')

    // Start background music on first game start
    if (!musicEnabled && soundEnabled) {
      startBackgroundMusic()
      setMusicEnabled(true)
    }
  }, [musicEnabled, activeTrail, soundEnabled])

  // ========================================================================
  // INPUT HANDLERS
  // ========================================================================

  const handleAction = useCallback(() => {
    if (mode === 'menu') {
      startGame()
      return
    }
    if (mode === 'gameover') {
      startGame()
      return
    }
    if (mode !== 'playing') return

    const e = engineRef.current
    const p = e.player

    // Prevent jump spam — require minimum time between jumps
    const now = performance.now()
    if (e.lastJumpTime && now - e.lastJumpTime < 80) return

    // Ground jump or coyote jump
    if (p.onGround || p.coyoteTimer > 0) {
      performJump(e, false)
      e.lastJumpTime = now
    }
    // Double jump
    else if (p.jumpCount < p.maxJumps) {
      performJump(e, true)
      e.lastJumpTime = now
    }
    // Buffer the jump for better feel
    else {
      p.jumpBufferTimer = CFG.BUFFER
    }
  }, [mode, performJump, startGame])

  const releaseJump = useCallback(() => {
    if (mode !== 'playing') return
  }, [mode])

  // Wallet connect wrapper with loading state (Improvement #2)
  const handleConnectWallet = useCallback(async () => {
    if (!connectWallet || connectingWallet) return
    setConnectingWallet(true)
    setError(null)
    try {
      await connectWallet()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to connect wallet')
    } finally {
      setConnectingWallet(false)
    }
  }, [connectWallet, connectingWallet])

  // ========================================================================
  // SCORE SUBMISSION
  // ========================================================================

  const submitScore = useCallback(async () => {
    if (!onScoreSubmit || deathScore <= 0 || submitting || submitted) return
    setSubmitting(true)
    setError(null)
    try {
      await onScoreSubmit(deathScore)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit')
    } finally {
      setSubmitting(false)
    }
  }, [onScoreSubmit, deathScore, submitting, submitted])

  const shareScore = useCallback(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'basedash-five.vercel.app'
    const text = `I scored ${deathScore} on base dash 🏃‍♂️\nbuilt on @base — play at ${appUrl}`
    if (navigator.share) {
      navigator.share({ text }).catch(() => { })
    } else {
      navigator.clipboard.writeText(text).catch(() => { })
    }
  }, [deathScore])

  // ========================================================================
  // DRAW CALLBACK — delegates to renderer
  // ========================================================================

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Support high-DPI scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dims.dpr, dims.dpr)

    drawFrame(ctx, engineRef.current, logoRef.current, logoLoaded)
  }, [logoLoaded, dims.dpr])

  // ========================================================================
  // EFFECTS — Initialization, keyboard, touch, game loop
  // ========================================================================

  // Adaptive Resize Handling
  useEffect(() => {
    const handleResize = () => {
      let w = window.innerWidth
      let h = window.innerHeight

      // If we have a container, we can read the actual flex-allocated space
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        w = rect.width
        h = rect.height
      }

      // Constrain width on desktop
      if (w > 1024) w = 1024
      // Force roughly 16:9 on desktop
      if (!IS_MOBILE && h > w * 0.6) h = w * 0.6

      const dpr = window.devicePixelRatio || 1

      updateGameConfig(w, h)
      setDims({ w, h, dpr })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load logo image
  useEffect(() => {
    setTimeout(() => setLoading(false), 400)
    const img = new Image()
    img.src = '/base-logo.png'
    img.onload = () => { logoRef.current = img; setLogoLoaded(true) }
    img.onerror = () => setLogoLoaded(false)
  }, [])

  // Sync sound mute state
  useEffect(() => {
    globalSoundMuted = !soundEnabled
    if (!soundEnabled && isMusicPlaying) {
      stopBackgroundMusic()
      setMusicEnabled(false)
    } else if (soundEnabled && mode === 'playing' && !isMusicPlaying) {
      startBackgroundMusic()
      setMusicEnabled(true)
    }
  }, [soundEnabled, mode])

  // Load high score
  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey) || 0)
    highScoreRef.current = isFinite(saved) ? saved : 0
    setBest(highScoreRef.current)
  }, [storageKey])

  // Cleanup background music on unmount
  useEffect(() => {
    return () => {
      stopBackgroundMusic()
      if (demoRafRef.current) cancelAnimationFrame(demoRafRef.current)
    }
  }, [])

  // Auto-pause on visibility change (fix #6)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && mode === 'playing') {
        setMode('paused')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [mode])

  // Keyboard controls
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') {
        ev.preventDefault()
        handleAction()
      }
      if (ev.code === 'Escape' && mode === 'playing') setMode('paused')
      if (ev.code === 'KeyP') setMode(m => m === 'playing' ? 'paused' : 'playing')
    }
    const up = () => releaseJump()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handleAction, releaseJump, mode])

  // Touch controls — only preventDefault when playing (fix #8)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ts = (ev: TouchEvent) => { if (mode === 'playing') ev.preventDefault(); handleAction() }
    const te = (ev: TouchEvent) => { if (mode === 'playing') ev.preventDefault(); releaseJump() }
    canvas.addEventListener('touchstart', ts, { passive: false })
    canvas.addEventListener('touchend', te, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', ts)
      canvas.removeEventListener('touchend', te)
    }
  }, [handleAction, releaseJump, mode])

  // Game loop — fixed timestep with accumulator (optimized for mobile)
  useEffect(() => {
    if (mode !== 'playing') return
    let prev = performance.now()
    let acc = 0
    let frameCount = 0
    let lastFpsUpdate = performance.now()

    const loop = (t: number) => {
      const dt = Math.min(CFG.MAX_DELTA, (t - prev) / 1000)
      prev = t
      acc += dt

      // Limit physics updates to prevent spiral of death on slow devices
      let updates = 0
      const maxUpdates = IS_MOBILE ? 2 : 3
      while (acc >= CFG.STEP && updates < maxUpdates) {
        update(CFG.STEP)
        acc -= CFG.STEP
        updates++
      }

      // Update global audio tracker
      activeWorldIndex = engineRef.current.worldIndex

      // Skip rendering if tab is hidden
      if (document.visibilityState !== 'hidden') {
        draw()
      }

      // FPS monitoring for debugging (dev only)
      if (process.env.NODE_ENV === 'development') {
        frameCount++
        if (t - lastFpsUpdate >= 1000) {
          // console.log(`FPS: ${frameCount}`)
          frameCount = 0
          lastFpsUpdate = t
        }
      }

      if (engineRef.current.alive && mode === 'playing') {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mode, update, draw])

  // 1.1 + 1.2 — Demo auto-play loop behind menu
  useEffect(() => {
    if (mode !== 'menu') {
      if (demoRafRef.current) { cancelAnimationFrame(demoRafRef.current); demoRafRef.current = null }
      return
    }
    // Create a disposable demo engine
    const demoEngine = createEngine()
    demoEngine.alive = true
    demoEngine.showTutorial = false
    let prev = performance.now()
    let demoAcc = 0
    let autoJumpCooldown = 0

    const demoLoop = (t: number) => {
      const dt = Math.min(0.033, (t - prev) / 1000)
      prev = t
      demoAcc += dt

      // Simple physics tick
      while (demoAcc >= CFG.STEP) {
        const de = demoEngine
        de.gameTime += CFG.STEP
        de.difficulty = clamp(de.score / 4000, 0, 1)
        const sMult = getSpeed(de.score).multiplier
        de.speed = lerp(de.speed, CFG.BASE_SPEED * sMult, CFG.STEP * 4)
        de.distance += de.speed * CFG.STEP
        de.distanceTraveled += de.speed * CFG.STEP
        de.backgroundOffset += de.speed * CFG.STEP * 0.5
        de.groundOffset += de.speed * CFG.STEP
        de.cloudOffset += de.speed * CFG.STEP

        // Player physics
        const dp = de.player
        dp.velocityY += CFG.GRAVITY * CFG.STEP
        dp.velocityY = Math.min(dp.velocityY, CFG.MAX_FALL)
        dp.y += dp.velocityY * CFG.STEP
        // Floor collision & exact snapping to prevent clipping
        if (dp.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
          dp.y = CFG.GROUND - CFG.PLAYER_SIZE
          dp.velocityY = 0 // Kill downward velocity stringently
          dp.onGround = true
          dp.jumpCount = 0
        } else {
          dp.onGround = false
        }
        if (!dp.onGround) dp.rotation += CFG.ROT_SPEED * CFG.STEP
        dp.squash = lerp(dp.squash, 0, CFG.STEP * 12)
        dp.scale = 1 + dp.squash * (dp.velocityY < 0 ? -0.3 : 0.4)
        dp.tilt = lerp(dp.tilt, clamp(dp.velocityY / 800, -1, 1), CFG.STEP * CFG.TILT_SPEED)

        // Move candles
        for (const c of de.candles) {
          c.x -= de.speed * CFG.STEP
          c.phase += CFG.STEP * c.flickerSpeed
        }
        de.candles = de.candles.filter(c => c.x + c.width > -100)

        // Spawn
        if (de.distance >= de.nextSpawnDistance) spawnPattern(de)

        // AI: auto-jump near obstacles
        autoJumpCooldown -= CFG.STEP
        if (dp.onGround && autoJumpCooldown <= 0) {
          const nearest = de.candles.find(c => c.kind === 'red' && c.x > CFG.PLAYER_X - 20 && c.x < CFG.PLAYER_X + 200)
          if (nearest && nearest.x < CFG.PLAYER_X + 120) {
            dp.velocityY = CFG.JUMP
            dp.onGround = false
            dp.squash = -0.15
            autoJumpCooldown = 0.3
          }
        }

        // Auto-collect greens + pass reds for score
        for (const c of de.candles) {
          if (!c.passed && c.x + c.width < CFG.PLAYER_X) {
            c.passed = true
            if (c.kind === 'red') de.score += CFG.RED_SCORE
          }
          if (c.kind === 'green' && !c.collected) {
            const gx = c.x + c.width / 2
            const gy = c.bodyY + c.bodyHeight / 2
            const px = CFG.PLAYER_X + CFG.PLAYER_SIZE / 2
            const py = dp.y + CFG.PLAYER_SIZE / 2
            if (Math.abs(gx - px) < 30 && Math.abs(gy - py) < 30) {
              c.collected = true
              de.score += CFG.GREEN_SCORE
            }
          }
        }

        // Stars
        for (const s of de.stars) s.twinkle += CFG.STEP * s.twinkleSpeed
        // Ground particles
        for (const gp of de.groundParticles) {
          gp.x -= de.speed * CFG.STEP * gp.speed
          gp.phase += CFG.STEP * 2 * gp.speed
          if (gp.x < -10) gp.x = CFG.WIDTH + rand(5, 30)
        }

        // Reset if score too high (loop demo)
        if (de.score > 800) {
          Object.assign(de, createEngine())
          de.alive = true
          de.showTutorial = false
        }

        demoAcc -= CFG.STEP
      }

      // Draw demo frame
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const currentDpr = window.devicePixelRatio || 1
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.scale(currentDpr, currentDpr)
          drawFrame(ctx, demoEngine, logoRef.current, logoLoaded)
        }
      }

      demoRafRef.current = requestAnimationFrame(demoLoop)
    }

    demoRafRef.current = requestAnimationFrame(demoLoop)
    return () => {
      if (demoRafRef.current) cancelAnimationFrame(demoRafRef.current)
    }
  }, [mode, logoLoaded])

  // 1.3 — Opening chime on first user interaction
  useEffect(() => {
    if (chimePlayedRef.current) return
    const playChime = () => {
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = true
        sfxOpenChime()
      }
      window.removeEventListener('click', playChime)
      window.removeEventListener('touchstart', playChime)
    }
    window.addEventListener('click', playChime, { once: true })
    window.addEventListener('touchstart', playChime, { once: true })
    return () => {
      window.removeEventListener('click', playChime)
      window.removeEventListener('touchstart', playChime)
    }
  }, [])

  // 3.1 — Compute near-record diff & 3.4 delayed retry button
  useEffect(() => {
    if (mode === 'gameover') {
      const diff = best - deathScore
      if (diff > 0 && diff <= best * 0.25 && !isNewRecord) {
        setNearRecordDiff(diff)
      } else {
        setNearRecordDiff(null)
      }
      // 3.4 — delayed retry button appearance
      const timer = setTimeout(() => setRetryVisible(true), 150) // Reduced from 1200ms to 150ms for faster appearance
      return () => clearTimeout(timer)
    }
  }, [mode, best, deathScore, isNewRecord])

  // Track time in game
  useEffect(() => {
    let intervalId: NodeJS.Timeout
    if (mode === 'playing') {
      intervalId = setInterval(() => {
        const currentSeconds = parseInt(localStorage.getItem('base_dash_time') || '0', 10)
        localStorage.setItem('base_dash_time', (currentSeconds + 1).toString())
      }, 1000)
    }
    return () => clearInterval(intervalId)
  }, [mode])

  // ========================================================================
  // LOADING SCREEN
  // ========================================================================

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="w-full text-center">
          <p className="mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">loading</p>
          <div className="mx-auto h-0.5 w-24 overflow-hidden bg-slate-100/50">
            <span className="block h-full w-1/2 animate-pulse bg-[#0052FF]" />
          </div>
        </div>
      </div>
    )
  }

  // ========================================================================
  // RENDER — Canvas + Overlay UI
  // ========================================================================

  return (
    <div ref={containerRef} className="relative w-full h-full mx-auto flex items-center justify-center border-none min-h-0" style={{ padding: 0 }}>
      <div
        className="relative overflow-hidden w-full h-full sm:border sm:border-slate-200 sm:shadow-[0_18px_42px_rgba(15,23,42,0.12)] game-container bg-gradient-to-br from-white via-[#f5f8ff] to-[#e8f0fe] sm:rounded-none"
        style={{ width: `${dims.w}px`, height: `${dims.h}px` }}
      >
        <canvas
          ref={canvasRef}
          width={dims.w * dims.dpr}
          height={dims.h * dims.dpr}
          className="w-full h-full cursor-pointer game-canvas"
          onClick={handleAction}
          tabIndex={0}
          role="application"
          aria-label="Base Dash Game Canvas"
          style={{
            display: 'block'
          }}
        />

        {/* ===================== MENU OVERLAY ===================== */}
        {mode === 'menu' && (
          <div className="game-overlay" style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div className="w-full max-w-[180px] border border-white/60 bg-white/40 backdrop-blur-3xl px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] mx-auto relative mt-[12%] flex flex-col items-center gap-4 rounded-[20px]"
              style={{ animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>

              {/* Best Score Display — Premium */}
              <div className="w-full bg-gradient-to-br from-[#FFFBEB] to-[#FFF3CC] px-4 py-3 border border-[#F0B90B]/30 text-center rounded-2xl shadow-[0_4px_12px_rgba(240,185,11,0.15)]"
                style={{ animation: 'menuFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '0.05s' }}>
                <p className="text-[7px] font-black text-[#D4A002] uppercase tracking-[0.18em] mb-1" style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>best pnl</p>
                <p className="font-black text-[#B78905] leading-none text-lg tracking-tighter" style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>{formatMarketCap(best)}</p>
              </div>

              {/* Start Button — PREMIUM pulsing glow */}
              <button
                onClick={(e) => { e.stopPropagation(); startGame() }}
                className="w-full relative overflow-hidden px-4 py-4 text-[12px] font-black tracking-[0.18em] text-white transition-all duration-300 active:scale-95 group rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0052FF 0%, #0040CC 100%)',
                  boxShadow: '0 8px 32px rgba(0,82,255,0.45), 0 0 0 1px rgba(0,82,255,0.3)',
                  animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both, startGlow 2.5s ease-in-out 0.5s infinite',
                  animationDelay: '0.15s',
                  fontFamily: 'var(--font-space, Space Grotesk, system-ui)',
                }}
              >
                <span className="relative z-10">START TRADE</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-2xl" />
              </button>

              {/* Hint Text */}
              <div className="text-center" style={{ animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '0.25s' }}>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.22em]" style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>tap or space to start</p>
              </div>

            </div>
          </div>
        )}

        {/* ===================== PAUSED OVERLAY ===================== */}
        {mode === 'paused' && (
          <div className="game-overlay bg-black/20 backdrop-blur-[2px]">
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="w-full max-w-[240px] border-2 border-[#0A0B14] bg-white px-5 py-6 shadow-none mx-auto text-center rounded-2xl">
                <h2 className="text-xl font-black text-[#0A0B14] mb-2 uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>paused</h2>
                <p className="text-slate-500 text-[10px] mb-5 font-bold uppercase tracking-widest">take a breath</p>
                <button
                  onClick={() => setMode('playing')}
                  className="w-full bg-[#0052FF] px-4 py-3 text-[11px] font-black text-white hover:bg-[#0040CC] border-2 border-[#0052FF] transition-colors rounded-xl uppercase tracking-widest"
                >
                  RESUME
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== GAME OVER OVERLAY ===================== */}
        {mode === 'gameover' && (
          <div className="game-overlay" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'deathFadeIn 0.6s ease-out forwards' }}>
            <div className="w-full h-full flex items-center justify-center p-2">
              <div className="w-full max-w-[300px] rounded-2xl bg-white border-2 border-[#0A0B14] shadow-none px-4 py-4 mx-auto relative overflow-hidden">

                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {isNewRecord && (
                    <div className="flex h-5 w-5 items-center justify-center bg-[#F0B90B] border-2 border-[#B78905] rounded-full">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                  )}
                  <h2 className={`text-[16px] font-black uppercase ${isNewRecord ? 'text-[#F0B90B]' : 'text-[#F6465D]'} tracking-widest`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {isNewRecord ? 'NEW ALL-TIME HIGH!' : deathMessage}
                  </h2>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 px-2 py-2 rounded-xl border-2 border-slate-200 text-center"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">portfolio</p><p className="text-[14px] font-black text-slate-900 leading-none">{formatMarketCap(deathScore)}</p></div>
                  <div className="bg-[#eef4ff] px-2 py-2 rounded-xl border-2 border-[#0052FF]/20 text-center"><p className="text-[9px] font-black text-[#6CACFF] uppercase tracking-widest mb-1">mode</p><p className="text-[12px] font-black leading-none uppercase tracking-widest" style={{ color: getSpeed(score).color }}>{speedName}</p></div>
                </div>

                {/* Near-record motivational message — minimal */}
                {nearRecordDiff !== null && (
                  <div className="mb-3 bg-[#FFFBEB] px-2 py-2 rounded-xl border-2 border-[#F0B90B]/30 text-center flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#F0B90B]" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                    <p className="text-[9px] font-black text-[#B78905] uppercase tracking-widest">only {nearRecordDiff} pts from max!</p>
                  </div>
                )}

                {/* Stats — compact */}
                {gameStats && (
                  <div className="grid grid-cols-4 gap-1.5 mb-3 text-center text-[8px] font-bold mt-1">
                    <div className="bg-slate-50 px-1 py-1.5 rounded-xl border-2 border-slate-200"><p className="text-slate-400 uppercase tracking-widest mb-1" style={{ fontSize: '7px' }}>session</p><p className="text-slate-700 font-black text-[10px]">{Math.floor(gameStats.timeSurvived)}s</p></div>
                    <div className="bg-slate-50 px-1 py-1.5 rounded-xl border-2 border-slate-200"><p className="text-slate-400 uppercase tracking-widest mb-1" style={{ fontSize: '7px' }}>survived</p><p className="text-slate-700 font-black text-[10px]">{gameStats.candlesDodged}</p></div>
                    <div className="bg-[#e8f8f0] px-1 py-1.5 rounded-xl border-2 border-[#0ECB81]/40"><p className="text-[#0ECB81] uppercase tracking-widest mb-1" style={{ fontSize: '7px' }}>buys</p><p className="text-[#0ECB81] font-black text-[10px]">{gameStats.greensCollected}</p></div>
                    <div className="bg-slate-50 px-1 py-1.5 rounded-xl border-2 border-slate-200"><p className="text-slate-400 uppercase tracking-widest mb-1" style={{ fontSize: '7px' }}>entries</p><p className="text-slate-700 font-black text-[10px]">{gameStats.totalJumps}</p></div>
                  </div>
                )}

                {/* Score submit / success / wallet connect — ONLY ON NEW RECORD OR IF ALREADY SUBMITTED */}
                {(submitted || isScoreConfirmed) ? (
                  <div className="mb-3 bg-[#e8f8f0] border-2 border-[#0ECB81] px-3 py-2 rounded-xl flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-[11px] font-black text-[#0ECB81] uppercase tracking-widest">saved on-chain!</span>
                    </div>
                    {submitTxHash && (
                      <a href={`https://${process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'sepolia.' : ''}basescan.org/tx/${submitTxHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 text-[9px] font-black font-mono text-[#0A0B14] hover:text-[#0052FF] underline opacity-90 transition-colors uppercase tracking-widest">
                        view tx ↗
                      </a>
                    )}
                  </div>
                ) : isNewRecord ? (
                  isConnected && canSubmitScore && deathScore > 0 ? (
                    txContracts ? (
                      <Transaction
                        calls={txContracts as any}
                        capabilities={process.env.NEXT_PUBLIC_PAYMASTER_URL ? { paymasterService: { url: process.env.NEXT_PUBLIC_PAYMASTER_URL } } : undefined}
                        onSuccess={() => setSubmitted(true)}
                        onError={(e) => setError(e.message)}
                        className="w-full flex flex-col items-center"
                      >
                        {/* @ts-expect-error React 18 Server Component type mismatch in OnchainKit */}
                        <TransactionButton
                          className="mb-3 w-full bg-[#0052FF] text-white py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#0A0B14] active:scale-[0.98] rounded-none border-2 border-[#0052FF] hover:border-[#0A0B14] transition-colors"
                          text="SAVE RECORD GASLESS"
                        />
                        <TransactionStatus>
                          <TransactionStatusLabel />
                          <TransactionStatusAction />
                        </TransactionStatus>
                      </Transaction>
                    ) : (
                      <button disabled className="mb-3 w-full bg-slate-200 text-slate-500 py-3 text-[11px] font-black uppercase tracking-widest rounded-none border-2 border-slate-300">
                        PREPARING TX...
                      </button>
                    )
                  ) : !isConnected ? (
                    <button onClick={handleConnectWallet} disabled={connectingWallet} className="mb-3 w-full bg-[#0052FF] text-white py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#0A0B14] active:scale-[0.98] rounded-none border-2 border-[#0052FF] hover:border-[#0A0B14] transition-colors disabled:opacity-50">
                      {connectingWallet ? 'CONNECTING...' : 'CONNECT TO SAVE RECORD'}
                    </button>
                  ) : (
                    <p className="mb-3 px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/80 rounded-none border-2 border-slate-200 text-center">contract not configured.</p>
                  )
                ) : null}

                {error && <p className="text-[#F6465D] text-[9px] font-black mb-3 bg-[#FFF0F2] px-2 py-2 rounded-none text-center border-2 border-[#F6465D]/30 uppercase tracking-widest">{error}</p>}

                <button onClick={startGame} className={`w-full border-2 border-[#0A0B14] bg-white px-3 py-3 text-[12px] font-black text-[#0A0B14] uppercase tracking-widest hover:bg-[#0A0B14] hover:text-white active:scale-[0.98] transition-all rounded-none ${retryVisible ? 'opacity-100' : 'opacity-0 scale-95 pointer-events-none'}`} style={retryVisible ? { animation: 'retryPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' } : undefined}>
                  RUN IT BACK
                </button>

                {/* Share button — Farcaster Frame (item 10) */}
                {retryVisible && (
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/api/frames/result?score=${deathScore}&address=${address || ''}`
                      const shareText = `I scored ${formatMarketCap(deathScore)} PNL in Base Dash! 🎮\n\nCan you beat my score?`
                      if (navigator.share) {
                        navigator.share({ title: 'Base Dash Score', text: shareText, url: shareUrl }).catch(() => { })
                      } else {
                        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => { })
                      }
                    }}
                    className="w-full mt-2 border-2 border-[#8B5CF6] bg-[#8B5CF6]/10 px-3 py-2.5 text-[10px] font-black text-[#8B5CF6] uppercase tracking-widest hover:bg-[#8B5CF6] hover:text-white active:scale-[0.98] transition-all rounded-none flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" /></svg>
                    SHARE SCORE
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== PLAYING HUD ===================== */}
        {mode === 'playing' && (
          <>
            {/* Minimalist Premium HUD — Left */}
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
              <div className="flex items-center gap-2.5 px-2 py-1.5 bg-white/70 backdrop-blur rounded-xl border border-white/80 shadow-sm pointer-events-none"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <span className="text-[15px] font-black text-slate-900 leading-none tracking-tighter"
                  style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)', textShadow: 'none' }}>
                  {formatMarketCap(score)}
                </span>
                <div className="w-px h-3.5 bg-slate-300" />
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[#0ECB81] rounded-sm shadow-[0_0_4px_#0ECB81]" />
                  <span className="text-[11px] font-bold text-slate-700"
                    style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>
                    {engineRef.current.totalCollected}
                  </span>
                </div>
              </div>

              {/* Combo badge */}
              {engineRef.current.combo > 1 && (
                <div className="flex items-center px-2 py-1 bg-[#FFF8DC]/90 backdrop-blur border border-[#F0B90B]/40 rounded-lg shadow-sm">
                  <span className="text-[10px] font-black text-[#D4A002] drop-shadow-[0_0_4px_rgba(240,185,11,0.4)]"
                    style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>
                    {engineRef.current.combo}× COMBO
                  </span>
                </div>
              )}
            </div>

            {/* Premium HUD — Right: World + Speed + Sound */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/70 backdrop-blur rounded-xl border border-white/80 shadow-sm pointer-events-none"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <span className="text-[9px] font-bold text-slate-600 uppercase leading-none tracking-[0.14em]"
                  style={{ fontFamily: 'var(--font-space, Space Grotesk, system-ui)' }}>
                  {worldName}
                </span>
                <div className="w-px h-2.5 bg-slate-300" />
                <span className="text-[9px] font-black leading-none uppercase tracking-[0.1em]"
                  style={{ color: getSpeed(score).color, fontFamily: 'var(--font-space, Space Grotesk, system-ui)', textShadow: `0 0 8px ${getSpeed(score).color}80` }}>
                  {speedName.split('.').pop()?.trim() || speedName}
                </span>
              </div>

              {/* Sound toggle — clean, premium */}
              <button
                onClick={() => setSoundEnabled(prev => !prev)}
                className="h-[30px] w-[30px] flex items-center justify-center bg-white/80 backdrop-blur border border-slate-200/80 rounded-lg text-slate-500 hover:text-[#0052FF] hover:border-[#0052FF]/30 active:scale-95 transition-all shadow-sm z-20 touch-manipulation"
                title={soundEnabled ? 'mute' : 'unmute'}
              >
                {soundEnabled ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                )}
              </button>
            </div>

            {/* Chill / whale mode — glowing banner */}
            {engineRef.current.slowdownTimer > 0 && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#0ECB81]/15 backdrop-blur-md border border-[#0ECB81]/30 px-3 py-1 rounded-full z-10 shadow-[0_0_10px_rgba(14,203,129,0.2)] pointer-events-none">
                <p className="text-[#0ECB81] text-[9px] font-bold text-center drop-shadow-[0_0_4px_rgba(14,203,129,0.5)] tracking-wide uppercase">
                  {engineRef.current.whaleTimer > 0 ? 'whale alert' : 'chill mode'}
                </p>
              </div>
            )}

            {/* Sound toggle moved to top right - previous location removed */}

            {/* Jump indicators — glowing dots */}
            <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
              {Array.from({ length: getJumps(score) }).map((_, i) => (
                <div key={i} className={`w-3 h-3 border transition-all duration-300 rounded-sm ${i < engineRef.current.player.maxJumps - engineRef.current.player.jumpCount ? 'border-[#4d8dff]/60 bg-[#0052FF] shadow-[0_0_6px_rgba(0,82,255,0.6)] scale-100' : 'border-white/10 bg-white/10 scale-90'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div >
  )
}
