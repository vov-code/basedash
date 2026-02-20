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

// --- Game modules ---
import {
  type GameMode,
  type EngineState,
  type Particle,
  type ParticleType,
  type TrailType,
  type TrailPoint,
  CFG,
  WORLDS,
  IS_MOBILE,
  POWERUP_CONFIG,
  TRAIL_UNLOCKS,
  clamp, lerp, rand, easeOut,
  getWorld, getWorldIndex, getSpeed, getJumps,
  createEngine, spawnPattern,
} from './gameConfig'
import { drawFrame } from './gameRenderer'

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
 * Relaxing background music — pentatonic arpeggio with pad
 * Calming lo-fi vibe: C pentatonic (C-D-E-G-A) arpeggiated over warm pad
 */
let musicIntervalId: ReturnType<typeof setInterval> | null = null

function startBackgroundMusic(): void {
  if (!initAudio() || isMusicPlaying) return

  const ctx = getAudioCtx()
  if (!ctx) return

  try {
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.025
    musicGain.connect(ctx.destination)

    // Warm pad layer — C3 + G3 sine with slight detune
    const padFreqs = [130.81, 196.00]
    musicOscillators = padFreqs.map((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      osc.detune.setValueAtTime(i * 4 - 2, ctx.currentTime)
      const oscGain = ctx.createGain()
      oscGain.gain.value = 0.15
      osc.connect(oscGain)
      oscGain.connect(musicGain!)
      osc.start()
      return osc
    })

    // Pentatonic arpeggio — C4, D4, E4, G4, A4, G4, E4, D4
    const arpeggioNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66]
    let noteIdx = 0

    const playArpeggioNote = () => {
      if (!ctx || ctx.state === 'closed' || !musicGain) return
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(arpeggioNotes[noteIdx], ctx.currentTime)
        osc.detune.setValueAtTime(Math.random() * 6 - 3, ctx.currentTime) // slight humanize
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        osc.connect(gain)
        gain.connect(musicGain!)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.9)
        noteIdx = (noteIdx + 1) % arpeggioNotes.length
      } catch { /* ignore */ }
    }

    // Play note every 400ms for relaxing pace
    musicIntervalId = setInterval(playArpeggioNote, 400)
    playArpeggioNote() // play first note immediately

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
  playTone(520, 0.10, 'square', 0.08)
  setTimeout(() => playTone(680, 0.08, 'square', 0.06), 30)
}

function sfxDeath() {
  if (globalSoundMuted || !initAudio()) return
  playTone(220, 0.25, 'sawtooth', 0.10)
  setTimeout(() => playTone(140, 0.35, 'sawtooth', 0.08), 80)
}

function sfxCollect() {
  if (globalSoundMuted || !initAudio()) return
  playTone(880, 0.08, 'sine', 0.10)
  setTimeout(() => playTone(1100, 0.10, 'sine', 0.08), 50)
  setTimeout(() => playTone(1320, 0.12, 'sine', 0.06), 100)
}

function sfxPowerUp() {
  if (globalSoundMuted || !initAudio()) return
  playTone(660, 0.08, 'sine', 0.12)
  setTimeout(() => playTone(880, 0.08, 'sine', 0.10), 60)
  setTimeout(() => playTone(1100, 0.10, 'sine', 0.08), 120)
  setTimeout(() => playTone(1320, 0.12, 'triangle', 0.06), 180)
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

// Degen death messages
const DEATH_MESSAGES = [
  'rekt!',
  'liquidated!',
  'wasted!',
  'cooked!',
  'bag holder!',
  'rug pulled!',
  'gm rekt',
  'send it!',
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

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<EngineState>(createEngine())
  const rafRef = useRef<number | null>(null)
  const highScoreRef = useRef(0)
  const logoRef = useRef<HTMLImageElement | null>(null)

  // ========================================================================
  // PHYSICS UPDATE — Heart of the game
  // ========================================================================

  const update = useCallback((dt: number) => {
    const e = engineRef.current
    if (!e.alive) return

    e.gameTime += dt
    e.difficulty = clamp(e.score / 4000, 0, 1)
    const speedTier = getSpeed(e.score)
    const speedMult = speedTier.multiplier
    const slowMult = e.slowdownTimer > 0 ? CFG.SLOW_MULT : 1
    const frameSpeed = CFG.BASE_SPEED * speedMult * slowMult

    e.speed = lerp(e.speed, frameSpeed, dt * 4)
    e.distance += e.speed * dt
    e.distanceTraveled += e.speed * dt
    e.backgroundOffset += e.speed * dt * 0.5
    e.groundOffset += e.speed * dt
    e.cloudOffset += e.speed * dt

    // --- Slowdown timer ---
    if (e.slowdownTimer > 0) e.slowdownTimer -= dt

    // --- Player physics ---
    const p = e.player
    p.maxJumps = getJumps(e.score)

    // Gravity
    if (!p.isDashing) {
      p.velocityY += CFG.GRAVITY * dt
      p.velocityY = Math.min(p.velocityY, CFG.MAX_FALL)
    }

    // Apply velocity
    p.y += p.velocityY * dt

    // Ground collision
    if (p.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
      p.y = CFG.GROUND - CFG.PLAYER_SIZE
      if (p.velocityY > 200) {
        // Landing squash effect
        p.squash = clamp(p.velocityY / 1200, 0.05, 0.3)
        // Landing dust
        spawnJumpDust(e, IS_MOBILE ? 3 : 5)
      }
      p.velocityY = 0
      p.onGround = true
      p.coyoteTimer = CFG.COYOTE
      p.jumpCount = 0
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

      const cx1 = c.x + 4
      const cy1 = c.bodyY + 4
      const cx2 = c.x + c.width - 4
      const cy2 = c.bodyY + c.bodyHeight - 4

      const hit = px1 < cx2 && px2 > cx1 && py1 < cy2 && py2 > cy1

      if (hit) {
        if (c.kind === 'red') {
          if (p.invincible <= 0) {
            // Shield check (diamond hands power-up)
            if (e.shieldActive) {
              e.shieldActive = false
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
            setDeathMessage(getRandomDeathMessage())
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
          // Sound + haptic
          sfxCollect()
          hapticCollect()
          // Collection particles
          spawnCollectSparkle(e, c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, IS_MOBILE ? 6 : 12)
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
            break
          case 'whale_mode':
            e.whaleTimer = POWERUP_CONFIG.TYPES.whale_mode.duration
            e.slowdownTimer = Math.max(e.slowdownTimer, POWERUP_CONFIG.TYPES.whale_mode.duration)
            break
        }

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
      }
    }
    if (e.whaleTimer > 0) {
      e.whaleTimer -= dt
    }

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

    // Ground jump or coyote jump
    if (p.onGround || p.coyoteTimer > 0) {
      performJump(e, false)
    }
    // Double jump
    else if (p.jumpCount < p.maxJumps) {
      performJump(e, true)
    }
    // Buffer the jump
    else {
      p.jumpBufferTimer = CFG.BUFFER
    }
  }, [mode, performJump])

  const releaseJump = useCallback(() => {
    if (mode !== 'playing') return
    const p = engineRef.current.player
    // Variable jump height — release early = lower jump
    if (p.velocityY < CFG.JUMP * 0.4) {
      p.velocityY *= 0.5
    }
  }, [mode])

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
    setMode('playing')

    // Start background music on first game start
    if (!musicEnabled && soundEnabled) {
      startBackgroundMusic()
      setMusicEnabled(true)
    }
  }, [musicEnabled, activeTrail, soundEnabled])

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
    const text = `I scored ${deathScore} on base dash 🏃‍♂️\nbuilt on @base — play at basedash-five.vercel.app`
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
    drawFrame(ctx, engineRef.current, logoRef.current, logoLoaded)
  }, [logoLoaded])

  // ========================================================================
  // EFFECTS — Initialization, keyboard, touch, game loop
  // ========================================================================

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
    }
  }, [])

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

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ts = (ev: TouchEvent) => { ev.preventDefault(); handleAction() }
    const te = (ev: TouchEvent) => { ev.preventDefault(); releaseJump() }
    canvas.addEventListener('touchstart', ts, { passive: false })
    canvas.addEventListener('touchend', te, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', ts)
      canvas.removeEventListener('touchend', te)
    }
  }, [handleAction, releaseJump])

  // Game loop — fixed timestep with accumulator
  useEffect(() => {
    if (mode !== 'playing') return
    let prev = performance.now()
    let acc = 0

    const loop = (t: number) => {
      const dt = Math.min(CFG.MAX_DELTA, (t - prev) / 1000)
      prev = t
      acc += dt

      while (acc >= CFG.STEP) {
        update(CFG.STEP)
        acc -= CFG.STEP
      }

      draw()

      if (engineRef.current.alive && mode === 'playing') {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mode, update, draw])

  // ========================================================================
  // LOADING SCREEN
  // ========================================================================

  if (loading) {
    return (
      <div className="flex h-[58vh] items-center justify-center">
        <div className="w-[min(90vw,420px)] border border-slate-200 bg-white/95 px-8 py-8 text-center shadow-[0_22px_46px_rgba(15,23,42,0.10)]">
          <div className="relative mx-auto mb-5 h-20 w-20 border border-[#0052FF]/25 bg-[#0052FF]">
            <div className="absolute inset-[-3px] border border-[#0052FF]/20 animate-pulse" />
            <div className="absolute inset-[5px] overflow-hidden border border-white/40">
              <img src="/base-logo.png" alt="base dash logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <h2 className="mb-1 text-xl text-slate-900" style={{ fontFamily: 'var(--font-brand), var(--font-sans)' }}>base dash</h2>
          <p className="mb-4 text-xs text-slate-500">loading game</p>
          <div className="mx-auto h-1.5 w-40 overflow-hidden bg-slate-100">
            <span className="block h-full w-1/2 animate-pulse bg-gradient-to-r from-[#0052FF] to-[#4d8dff]" />
          </div>
        </div>
      </div>
    )
  }

  // ========================================================================
  // RENDER — Canvas + Overlay UI
  // ========================================================================

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="relative overflow-hidden border border-slate-200 shadow-[0_18px_42px_rgba(15,23,42,0.12)] game-container bg-gradient-to-br from-white via-[#f5f8ff] to-[#e8f0fe]" onTouchStart={(ev) => { ev.preventDefault(); handleAction() }} onTouchEnd={(ev) => { ev.preventDefault(); releaseJump() }}>
        <canvas
          ref={canvasRef}
          width={CFG.WIDTH}
          height={CFG.HEIGHT}
          className="w-full h-auto aspect-video bg-white cursor-pointer game-canvas"
          onClick={handleAction}
          tabIndex={0}
          role="application"
          aria-label="Base Dash Game Canvas"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* ===================== MENU OVERLAY ===================== */}
        {mode === 'menu' && (
          <div className="game-overlay bg-gradient-to-br from-white/90 via-[#edf4ff]/92 to-[#f7fbff]/90 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-lg px-3 py-2 text-center overflow-y-auto max-h-full">
              <div className="border border-slate-200/90 bg-white/95 px-5 py-3 shadow-[0_22px_44px_rgba(15,23,42,0.12)]">
                <div className="mb-2 flex items-center gap-3 text-left">
                  <div className="relative h-10 w-10 flex-shrink-0 border border-[#0052FF]/25 bg-[#0052FF]">
                    <div className="absolute inset-[3px] overflow-hidden border border-white/35">
                      <img src="/base-logo.png" alt="base dash logo" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-0 text-lg sm:text-xl text-slate-900" style={{ fontFamily: 'var(--font-brand), var(--font-sans)' }}>base dash</h2>
                    <p className="text-[10px] text-slate-500">built on base — endless runner</p>
                  </div>
                  {/* Sound toggle */}
                  <button onClick={() => setSoundEnabled(prev => !prev)} className="h-8 w-8 flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors" title={soundEnabled ? 'mute' : 'unmute'}>
                    {soundEnabled ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    )}
                  </button>
                </div>

                <button onClick={startGame} className="mb-2 inline-flex w-full items-center justify-center gap-2 bg-[#0052FF] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0040CC]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M8 6v12l10-6-10-6z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  start run
                </button>

                <div className="mb-2 grid grid-cols-3 gap-1.5 text-left text-xs">
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">controls</p><p className="font-medium text-slate-800 text-[11px]">space / tap</p></div>
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">best</p><p className="font-mono text-sm font-bold text-slate-900">{best}</p></div>
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">worlds</p><p className="font-medium text-slate-800 text-[11px]">10 to explore</p></div>
                </div>

                <div className="mb-2 border border-slate-200 bg-slate-50/90 px-3 py-2 text-left">
                  <p className="mb-1 text-[9px] font-semibold text-slate-500">how to play</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
                    <span>🔴 avoid red candles</span>
                    <span>🟢 green = +25 pts + slow</span>
                    <span>🦘 double jump at 150</span>
                    <span>💎🌕📊 catch power-ups</span>
                  </div>
                </div>

                {!isConnected && (
                  <button onClick={handleConnectWallet} disabled={connectingWallet} className="w-full border border-[#0052FF]/30 bg-[#eef4ff] px-3 py-2 text-xs font-semibold text-[#0040CC] transition-colors hover:bg-[#e1ecff] disabled:opacity-50">
                    {connectingWallet ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 border-2 border-[#0052FF]/30 border-t-[#0052FF] rounded-full animate-spin" />
                        connecting...
                      </span>
                    ) : 'connect wallet to save progress'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== PAUSED OVERLAY ===================== */}
        {mode === 'paused' && (
          <div className="game-overlay bg-gradient-to-br from-white/84 via-[#edf4ff]/90 to-[#f7fbff]/88 backdrop-blur-lg">
            <div className="mx-auto w-full max-w-sm px-3 py-4 text-center overflow-y-auto max-h-full">
              <div className="border border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_22px_44px_rgba(15,23,42,0.12)]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-[#0052FF]/25 bg-[#eef4ff]">
                  <svg className="w-8 h-8 text-[#0052FF]" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" /></svg>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-1" style={{ fontFamily: 'var(--font-brand), var(--font-sans)' }}>paused</h2>
                <p className="text-slate-500 text-xs mb-5">take a breath</p>
                <button onClick={() => setMode('playing')} className="mb-3 w-full bg-[#0052FF] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(0,82,255,0.28)] transition-colors hover:bg-[#0040CC]">resume</button>
                <p className="text-slate-500 text-xs">press p to resume</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== GAME OVER OVERLAY ===================== */}
        {mode === 'gameover' && (
          <div className="game-overlay bg-gradient-to-br from-white/84 via-[#edf4ff]/90 to-[#f7fbff]/88 backdrop-blur-lg">
            <div className="mx-auto w-full max-w-lg px-3 py-2 text-center overflow-y-auto max-h-full">
              <div className="border border-slate-200/90 bg-white/95 px-5 py-3 shadow-[0_22px_44px_rgba(15,23,42,0.12)]">

                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center border ${isNewRecord ? 'border-[#F0B90B]/30 bg-[#FFFBEB]' : 'border-[#F6465D]/30 bg-[#FFF0F2]'}`}>
                    {isNewRecord ? (
                      <svg className="w-4 h-4 text-[#F0B90B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                      <span className="text-xl">💀</span>
                    )}
                  </div>
                  <h2 className={`text-lg sm:text-xl font-black ${isNewRecord ? 'text-[#B78905]' : 'text-[#F6465D]'} tracking-tight`} style={{ fontFamily: 'var(--font-brand), var(--font-sans)' }}>
                    {isNewRecord ? 'new record!' : deathMessage}
                  </h2>
                </div>

                {/* Score + best + world + speed in one row */}
                <div className="grid grid-cols-4 gap-1 mb-1.5 text-left text-xs">
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">score</p><p className="text-base font-black text-slate-900 font-mono">{deathScore}</p></div>
                  <div className="border border-[#0052FF]/20 bg-[#eef4ff] px-2 py-1.5"><p className="text-[9px] text-[#0052FF]">best</p><p className="text-base font-black text-[#0052FF] font-mono">{best}</p></div>
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">world</p><p className="text-[11px] font-bold text-slate-900">{worldName}</p></div>
                  <div className="border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">diff</p><p className="text-[11px] font-bold" style={{ color: getSpeed(score).color }}>{speedName}</p></div>
                </div>

                {/* Game stats */}
                {gameStats && (
                  <div className="grid grid-cols-4 gap-1 mb-2 text-center text-[9px]">
                    <div className="border border-slate-200 bg-slate-50 px-1 py-1"><p className="text-slate-400">time</p><p className="font-bold text-slate-700 font-mono">{Math.floor(gameStats.timeSurvived)}s</p></div>
                    <div className="border border-slate-200 bg-slate-50 px-1 py-1"><p className="text-slate-400">dodged</p><p className="font-bold text-slate-700 font-mono">{gameStats.candlesDodged}</p></div>
                    <div className="border border-[#0ECB81]/20 bg-[#f0fdf4] px-1 py-1"><p className="text-[#0ECB81]">greens</p><p className="font-bold text-[#0ECB81] font-mono">{gameStats.greensCollected}</p></div>
                    <div className="border border-slate-200 bg-slate-50 px-1 py-1"><p className="text-slate-400">jumps</p><p className="font-bold text-slate-700 font-mono">{gameStats.totalJumps}</p></div>
                  </div>
                )}

                {/* Score submit / success / wallet connect */}
                {submitted || isScoreConfirmed ? (
                  <div className="mb-1.5 border border-[#0ECB81]/30 bg-[#f0fdf4] px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-sm font-semibold text-[#0ECB81]">score saved on-chain!</span>
                    </div>
                    {submitTxHash && (
                      <a
                        href={`https://${process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'sepolia.' : ''}basescan.org/tx/${submitTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[10px] font-mono text-[#0052FF] hover:underline"
                      >
                        {submitTxHash.slice(0, 10)}...{submitTxHash.slice(-8)} ↗
                      </a>
                    )}
                  </div>
                ) : isConnected && canSubmitScore && deathScore > 0 ? (
                  <button onClick={submitScore} disabled={submitting} className="mb-1.5 w-full bg-[#0052FF] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0040CC] disabled:opacity-50 disabled:cursor-not-allowed">
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        submitting...
                      </span>
                    ) : 'send score on-chain'}
                  </button>
                ) : !isConnected ? (
                  <button onClick={handleConnectWallet} disabled={connectingWallet} className="mb-1.5 w-full bg-[#0052FF] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0040CC] disabled:opacity-50 disabled:cursor-not-allowed">
                    {connectingWallet ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        connecting...
                      </span>
                    ) : 'connect wallet to save'}
                  </button>
                ) : (
                  <p className="mb-1.5 border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">{canSubmitScore ? 'wallet connected — submit.' : 'contract not configured.'}</p>
                )}
                {error && <p className="text-[#F6465D] text-xs mb-1.5 bg-[#FFF0F2] px-3 py-1 border border-[#F6465D]/20">{error}</p>}

                <button onClick={startGame} className="w-full border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">run it back</button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PLAYING HUD ===================== */}
        {mode === 'playing' && (
          <>
            {/* Score */}
            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-2">
              <div className="border border-slate-300/80 bg-white/90 px-1.5 py-1 sm:px-3 sm:py-2 rounded-md shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
                <p className="text-slate-500 text-[6px] sm:text-[8px] font-bold mb-0.5">score</p>
                <p className="text-base sm:text-xl font-black text-slate-900 font-mono tracking-tight leading-none">{score}</p>
              </div>
              {combo > 1 && (
                <div className="hidden sm:block border border-[#0052FF]/30 bg-[#eef4ff] px-2 py-1 rounded-md">
                  <p className="text-[#0052FF] text-xs font-black">x{combo}</p>
                </div>
              )}
              {/* Score multiplier indicator */}
              {engineRef.current.scoreMultiplier > 1 && (
                <div className="hidden sm:block border border-[#FFD700]/40 bg-[#FFFBEB] px-2 py-1 rounded-md">
                  <p className="text-[#B78905] text-xs font-black">🌕 x{engineRef.current.scoreMultiplier}</p>
                </div>
              )}
            </div>

            {/* World / Speed */}
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
              <div className="flex items-center gap-1.5 sm:gap-2.5 border border-slate-200/90 bg-white/95 px-2 py-1 sm:px-3.5 sm:py-2 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                <div className="flex flex-col leading-tight">
                  <span className="text-[5px] sm:text-[7px] text-slate-400 font-semibold uppercase tracking-wider">World</span>
                  <span className="text-[10px] sm:text-[13px] font-bold text-slate-800 leading-none">{worldName}</span>
                </div>
                <div className="w-px h-5 sm:h-7 bg-slate-200" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[5px] sm:text-[7px] text-slate-400 font-semibold uppercase tracking-wider">Diff</span>
                  <span className="text-[10px] sm:text-[13px] font-bold leading-none" style={{ color: getSpeed(score).color }}>{speedName}</span>
                </div>
              </div>
            </div>

            {/* Chill / whale mode indicator */}
            {engineRef.current.slowdownTimer > 0 && (
              <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 border border-[#0ECB81]/30 bg-[#efffee] px-3 py-1.5 sm:px-5 sm:py-2">
                <p className="text-[#0ECB81] text-[10px] sm:text-xs font-bold">
                  {engineRef.current.whaleTimer > 0 ? '📊 whale alert' : '🟢 chill mode'}
                </p>
              </div>
            )}

            {/* Sound toggle */}
            <button onClick={() => setSoundEnabled(prev => !prev)} className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center border border-slate-300/60 bg-white/70 text-slate-500 hover:bg-white/90 transition-colors rounded-md" title={soundEnabled ? 'mute' : 'unmute'}>
              {soundEnabled ? (
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" /></svg>
              ) : (
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
              )}
            </button>

            {/* Jump indicators */}
            <div className="absolute bottom-3 right-3 flex gap-1">
              {Array.from({ length: getJumps(score) }).map((_, i) => (
                <div key={i} className={`w-3.5 h-3.5 border transition-all duration-300 ${i < engineRef.current.player.maxJumps - engineRef.current.player.jumpCount ? 'border-[#60a5fa] bg-gradient-to-br from-[#0052FF] to-[#0033AA] shadow-lg shadow-blue-500/50 scale-100' : 'border-slate-300 bg-slate-200/60 scale-90'}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mt-3 text-center hidden sm:block"><p className="text-slate-500 text-[10px] font-medium">space / w / up / tap to jump</p></div>
    </div>
  )
}
