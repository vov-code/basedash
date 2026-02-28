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
import { useAudioEngine } from '@/app/hooks/useAudioEngine'
import { useGameStore } from '@/app/store/gameStore'

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
  const { score, setScore, mode, setMode, soundEnabled, setSoundEnabled } = useGameStore()

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
  const [deathMessage, setDeathMessage] = useState('rekt!')
  const [activeTrail, setActiveTrail] = useState<TrailType>('default')
  const { address } = useWallet()

  // --- Audio Engine ---
  const {
    sfxDoubleJump: sfxJump,
    sfxCollect,
    sfxHit: sfxDeath,
    sfxCombo,
    sfxPowerup: sfxPowerUp,
    sfxMilestone: sfxMarketChange,
    sfxDash: sfxNearMiss,
    sfxLevelUp: playNewRecordFanfare,
    startBackgroundMusic,
    stopBackgroundMusic
  } = useAudioEngine(soundEnabled)

  useEffect(() => {
    if (!soundEnabled || mode !== 'playing') {
      stopBackgroundMusic()
    } else if (mode === 'playing') {
      startBackgroundMusic()
    }
  }, [soundEnabled, mode, startBackgroundMusic, stopBackgroundMusic])

  // --- Adaptive Screen State
  const [dims, setDims] = useState(() => {
    // Get initial DPR immediately on client side
    const initialDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR) : 1
    // Default logical size, will be immediately overwritten by resize observer
    return { w: CFG.WIDTH, h: CFG.HEIGHT, dpr: initialDpr }
  })

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EngineState>(createEngine())
  const rafRef = useRef<number | null>(null)
  const highScoreRef = useRef(0)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const demoRafRef = useRef<number | null>(null)
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

    // Safety: ensure player stays within bounds
    if (p.y < 0) {
      p.y = 0
      p.velocityY = 0
    }
    if (p.y > CFG.GROUND - CFG.PLAYER_SIZE) {
      p.y = CFG.GROUND - CFG.PLAYER_SIZE
      p.velocityY = 0
      p.onGround = true
      p.coyoteTimer = CFG.COYOTE
      p.jumpCount = 0
      p.rotation = 0
    }

    // Gravity — asymmetric: lighter going up, heavier falling (item 1)
    if (!p.isDashing) {
      const grav = p.velocityY < 0 ? CFG.GRAVITY_UP : CFG.GRAVITY_DOWN
      p.velocityY += grav * dt
      p.velocityY = Math.min(p.velocityY, CFG.MAX_FALL)
    }

    // Apply velocity
    p.y += p.velocityY * dt

    // Ground collision — DEEP FIX: EXACT snap, NO GAP WHATSOEVER
    const groundLevel = CFG.GROUND - CFG.PLAYER_SIZE

    // CRITICAL: Snap if within 20px and not moving up fast
    if (p.y >= groundLevel - 20 && p.velocityY >= 0) {
      p.y = groundLevel  // PERFECT - zero gap
      p.velocityY = 0
      p.onGround = true
      p.coyoteTimer = CFG.COYOTE
      p.jumpCount = 0
      p.rotation = 0
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

    // Rotation — smooth spin in air, snap to 0 on ground
    if (p.onGround) {
      // Snap rotation to nearest 90 degrees (0, π/2, π, 3π/2)
      const snapTarget = Math.round(p.rotation / HALF_PI) * HALF_PI
      p.rotation = lerp(p.rotation, snapTarget, dt * 25)
      // Fully snap when very close
      if (Math.abs(p.rotation - snapTarget) < 0.05) {
        p.rotation = snapTarget
      }
    } else {
      // Smooth constant spin in air (Geometry Dash style)
      p.rotation += 11.5 * dt
    }

    // Squash/stretch animation — SMOOTHER landing
    // Breathe idle animation when on ground
    if (p.onGround && e.alive && Math.abs(p.squash) < 0.01) {
      p.squash = Math.sin(e.gameTime * CFG.BREATHE_SPEED) * CFG.BREATHE_AMP
    }
    p.squash = lerp(p.squash, 0, dt * 8)  // Плавнее затухание
    p.scale = 1 + p.squash * (p.velocityY < 0 ? -0.25 : 0.35)  // Мягче эффект

    // Tilt based on velocity — SMOOTHER
    const targetTilt = clamp(p.velocityY / 900, -0.9, 0.9)  // Меньше наклон
    p.tilt = lerp(p.tilt, targetTilt, dt * 6)  // Плавнее

    // Flash decay
    p.flash = Math.max(0, p.flash - dt * 4)

    // Ensure scale is always valid (prevent NaN disappearance)
    if (isNaN(p.scale) || !isFinite(p.scale)) p.scale = 1;
    if (isNaN(p.y) || !isFinite(p.y)) p.y = CFG.GROUND - CFG.PLAYER_SIZE;

    // Invincibility
    p.invincible = Math.max(0, p.invincible - dt)

    // Trail — spawn ghost image (much smoother and more frequent)
    if (!p.onGround && e.player.trail.length < CFG.TRAIL_LIMIT) {
      const trailInterval = 0.015 // Much faster spawn rate for a smooth beam
      if (e.gameTime % trailInterval < dt) {
        p.trail.push({
          x: p.x, y: p.y,
          life: 1, alpha: 0.15, // Softer alpha to blend the dense trail
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
        } else if (c.kind === 'green' && !c.collected) {
          e.combo = 0
          e.comboPulse = 0
        }
      }
    }

    // Remove off-screen candles
    e.candles = e.candles.filter(c => c.x + c.width > -100)

    // --- Spawn patterns ---
    if (e.distance >= e.nextSpawnDistance) {
      spawnPattern(e)
    }

    // --- Collision detection — STRICT hitboxes ---
    const HITBOX_PAD = 1 // Extremely tight padding = visually perfect collisions
    const px1 = CFG.PLAYER_X + HITBOX_PAD
    const py1 = p.y + HITBOX_PAD
    const px2 = CFG.PLAYER_X + CFG.PLAYER_SIZE - HITBOX_PAD
    const py2 = p.y + CFG.PLAYER_SIZE - HITBOX_PAD

    for (const c of e.candles) {
      if (c.collected || c.x + c.width < CFG.PLAYER_X - 10) continue
      if (c.x > CFG.PLAYER_X + CFG.PLAYER_SIZE + 10) continue

      // Stricter candle hitbox (no margin)
      const cx1 = c.x + 1
      const cy1 = c.bodyY + 1
      const cx2 = c.x + c.width - 1
      const cy2 = c.bodyY + c.bodyHeight - 1

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
            e.combo = 0  // Сброс комбо при смерти
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
      } else if (c.kind === 'red' && !c.passed && c.x + c.width < CFG.PLAYER_X + 5 && c.x + c.width > CFG.PLAYER_X - 10 && e.nearMissTimer <= 0 && (e.gameTime - ((e as any)._lastNearMissTime || 0) > MARKET_CONFIG.NEAR_MISS_COOLDOWN)) {
        // Near-miss detection: only genuine close calls with cooldown
        const vertDistTop = Math.abs((p.y + CFG.PLAYER_SIZE - CFG.HITBOX) - c.bodyY)
        const vertDistBot = Math.abs((p.y + CFG.HITBOX) - (c.bodyY + c.bodyHeight))
        const passedOver = p.y + CFG.PLAYER_SIZE - CFG.HITBOX < c.bodyY && vertDistTop < MARKET_CONFIG.NEAR_MISS_DIST
        const passedUnder = p.y + CFG.HITBOX > c.bodyY + c.bodyHeight && vertDistBot < MARKET_CONFIG.NEAR_MISS_DIST

        if (passedOver || passedUnder) {
          e.nearMissTimer = MARKET_CONFIG.NEAR_MISS_DURATION;
          (e as any)._lastNearMissTime = e.gameTime
          e.nearMissText = 'close'
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
        // Whale mode ends
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

    // Trail particles during jump (physical flight trail)
    if (!p.onGround && e.alive && e.trailTimer <= 0) {
      e.trailTimer = 0.05  // Add trail point every 50ms
      p.trail.push({
        x: CFG.PLAYER_X + CFG.PLAYER_SIZE / 2,
        y: p.y + CFG.PLAYER_SIZE / 2,
        life: 0.35,
        alpha: 0.5,
        size: CFG.PLAYER_SIZE * 0.7,
        rotation: p.rotation,
        scale: 0.9
      })
    }
    if (e.trailTimer > 0) e.trailTimer -= dt

    // --- Clean up player trail particles ---
    p.trail = p.trail.filter(t => {
      t.life -= dt
      return t.life > 0
    })

    // Cap trail count to prevent memory leaks over time
    if (p.trail.length > CFG.PARTICLE_LIMIT) {
      p.trail = p.trail.slice(-CFG.PARTICLE_LIMIT)
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
    e.showTutorial = false
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

    // Add trail point for jump (physical trail effect)
    p.trail.push({
      x: CFG.PLAYER_X + CFG.PLAYER_SIZE / 2,
      y: p.y + CFG.PLAYER_SIZE / 2,
      life: 0.5,
      alpha: 0.7,
      size: CFG.PLAYER_SIZE * 0.9,
      rotation: p.rotation,
      scale: 1.0
    })

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

    // Show tutorial on first play only
    if (typeof window !== 'undefined' && !localStorage.getItem('bd_played_tutorial_v2')) {
      engine.showTutorial = true
      localStorage.setItem('bd_played_tutorial_v2', '1')
    }

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
  }, [activeTrail])

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

    // High-DPI scaling with smooth gradients
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    drawFrame(ctx, engineRef.current, {
      w: CFG.WIDTH,
      h: CFG.HEIGHT,
      dpr: dims.dpr,
      cssW: dims.w,
      cssH: dims.h
    }, logoRef.current, logoLoaded)
  }, [logoLoaded, dims])

  // ========================================================================
  // RESIZE OBSERVER — Crisp Canvas at any layout size
  // ========================================================================
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleResize = () => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      // Use actual displayed CSS size
      const cssWidth = Math.max(rect.width, 300)
      const cssHeight = Math.max(rect.height, 200)

      const newDpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR)

      setDims(prev => {
        if (prev.w === cssWidth && prev.h === cssHeight && prev.dpr === newDpr) return prev
        // IMPORTANT: We keep CFG logical dimensions for gameplay, but store CSS dimensions for canvas rendering
        return { w: cssWidth, h: cssHeight, dpr: newDpr }
      })
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(container)

    // Initial call
    handleResize()

    return () => observer.disconnect()
  }, [])

  // Load logo image
  useEffect(() => {
    setTimeout(() => setLoading(false), 200)
    const img = new Image()
    img.src = '/base-logo.png'
    img.onload = () => { logoRef.current = img; setLogoLoaded(true) }
    img.onerror = () => setLogoLoaded(false)
  }, [])

  // Load high score and sound preferences
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

  // Auto-pause on visibility change and reset clock
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && mode === 'playing') {
        setMode('paused')
      }
      // Clear out the massive delta buildup by signaling physics loops
      if (!document.hidden) {
        window.dispatchEvent(new Event('baseresume'))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [mode, setMode])

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

    // Reset loop time completely when waking up the tab
    const onResume = () => { prev = performance.now(); acc = 0 }
    window.addEventListener('baseresume', onResume)

    const loop = (t: number) => {
      // Extremely aggressive cap on delta time. If the tab slept, discard huge time jumps entirely.
      const rawDt = (t - prev) / 1000
      const dt = Math.min(rawDt, 0.05) // Cap max step to 50ms safely
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

      // Discard excess accumulated time to avoid carrying huge deficit from tab switches or lag spikes
      acc = acc % CFG.STEP

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
      window.removeEventListener('baseresume', onResume)
    }
  }, [mode, update, draw])

  // 1.1 + 1.2 — Demo auto-play loop behind menu — OPTIMIZED & FIXED
  useEffect(() => {
    if (mode !== 'menu') {
      if (demoRafRef.current) { cancelAnimationFrame(demoRafRef.current); demoRafRef.current = null }
      return
    }

    // Create demo engine with proper initial state
    const demoEngine = createEngine()
    demoEngine.alive = true
    demoEngine.showTutorial = false
    demoEngine.player.y = CFG.GROUND - CFG.PLAYER_SIZE
    demoEngine.player.onGround = true

    let prev = performance.now()
    let demoAcc = 0
    let jumpCooldown = 0

    const demoLoop = (t: number) => {
      if (mode !== 'menu') return

      const dt = Math.min(0.033, (t - prev) / 1000)
      prev = t
      demoAcc += dt

      // Physics tick with fixed step
      while (demoAcc >= CFG.STEP) {
        const de = demoEngine

        // Update game state
        de.gameTime += CFG.STEP
        de.difficulty = clamp(de.score / 4000, 0, 1)
        const sMult = getSpeed(de.score).multiplier
        de.speed = lerp(de.speed, CFG.BASE_SPEED * sMult, CFG.STEP * 4)
        de.distance += de.speed * CFG.STEP
        de.distanceTraveled += de.speed * CFG.STEP
        de.backgroundOffset += de.speed * CFG.STEP * 0.5
        de.groundOffset += de.speed * CFG.STEP
        de.cloudOffset += de.speed * CFG.STEP

        // Player physics — asymmetric gravity like real game
        const dp = de.player
        const dGrav = dp.velocityY < 0 ? CFG.GRAVITY_UP : CFG.GRAVITY_DOWN
        dp.velocityY += dGrav * CFG.STEP
        dp.velocityY = Math.min(dp.velocityY, CFG.MAX_FALL)
        dp.y += dp.velocityY * CFG.STEP

        // Ensure scale validation in demo loop as well
        if (isNaN(dp.scale) || !isFinite(dp.scale)) dp.scale = 1;
        if (isNaN(dp.y) || !isFinite(dp.y)) dp.y = CFG.GROUND - CFG.PLAYER_SIZE;

        // EXACT ground collision with landing squash
        if (dp.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
          dp.y = CFG.GROUND - CFG.PLAYER_SIZE
          if (dp.velocityY > 150) {
            dp.squash = clamp(dp.velocityY / 800, 0.1, 0.25)
          }
          dp.velocityY = 0
          dp.onGround = true
          dp.jumpCount = 0
        } else {
          dp.onGround = false
        }

        // Rotation — GD-style constant spin, snap on ground
        if (dp.onGround) {
          const snapTarget = Math.round(dp.rotation / (Math.PI / 2)) * (Math.PI / 2)
          dp.rotation = lerp(dp.rotation, snapTarget, CFG.STEP * 20)
        } else {
          dp.rotation += 11.5 * CFG.STEP
        }
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

        // AI: auto-jump — improved timing and double-jump
        jumpCooldown -= CFG.STEP
        if (jumpCooldown <= 0) {
          const nearest = de.candles.find(c =>
            c.kind === 'red' &&
            c.x > CFG.PLAYER_X - 20 &&
            c.x < CFG.PLAYER_X + 160
          )
          if (nearest) {
            const distToCandle = nearest.x - (CFG.PLAYER_X + CFG.PLAYER_SIZE)
            // Ground jump at optimized timing
            if (dp.onGround && distToCandle < 70 && distToCandle > 25) {
              dp.velocityY = CFG.JUMP
              dp.onGround = false
              dp.squash = -0.12
              dp.jumpCount = 1
              jumpCooldown = 0.3
            }
            // Double jump for tall candles
            else if (!dp.onGround && dp.jumpCount < 2 && distToCandle < 40 && nearest.height > 80) {
              dp.velocityY = CFG.DOUBLE_JUMP
              dp.jumpCount = 2
              jumpCooldown = 0.4
            }
          }
        }

        // Auto-collect greens
        for (const c of de.candles) {
          if (!c.passed && c.x + c.width < CFG.PLAYER_X) {
            c.passed = true
          }
          if (c.kind === 'green' && !c.collected) {
            const gx = c.x + c.width / 2
            const gy = c.bodyY + c.bodyHeight / 2
            const px = CFG.PLAYER_X + CFG.PLAYER_SIZE / 2
            const py = dp.y + CFG.PLAYER_SIZE / 2
            if (Math.abs(gx - px) < 35 && Math.abs(gy - py) < 35) {
              c.collected = true
            }
          }
        }

        // Background elements
        for (const s of de.stars) s.twinkle += CFG.STEP * s.twinkleSpeed
        for (const gp of de.groundParticles) {
          gp.x -= de.speed * CFG.STEP * gp.speed
          gp.phase += CFG.STEP * 2 * gp.speed
          if (gp.x < -10) gp.x = CFG.WIDTH + rand(5, 30)
        }

        // Clean up demo trail particles
        de.player.trail = de.player.trail.filter(t => {
          t.life -= CFG.STEP
          return t.life > 0
        })
        if (de.player.trail.length > CFG.PARTICLE_LIMIT) {
          de.player.trail = de.player.trail.slice(-CFG.PARTICLE_LIMIT)
        }

        // Reset occasionally
        if (de.distance > 10000) {
          Object.assign(de, createEngine())
          de.alive = true
          de.showTutorial = false
          de.player.y = CFG.GROUND - CFG.PLAYER_SIZE
          de.player.onGround = true
        }

        demoAcc -= CFG.STEP
      }

      // Draw demo frame
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const demoDpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR)
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          // Draw frame to internal logic size
          drawFrame(ctx, demoEngine, {
            w: CFG.WIDTH,
            h: CFG.HEIGHT,
            dpr: demoDpr,
            cssW: dims.w,
            cssH: dims.h
          }, logoRef.current, logoLoaded)
        }
      }

      demoRafRef.current = requestAnimationFrame(demoLoop)
    }

    demoRafRef.current = requestAnimationFrame(demoLoop)
    return () => {
      if (demoRafRef.current) cancelAnimationFrame(demoRafRef.current)
      demoRafRef.current = null
    }
  }, [mode, logoLoaded, dims])

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
          <p className="mb-3 text-[10px] font-bold text-slate-400 lowercase tracking-widest animate-pulse">loading</p>
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
    <div
      className="game-container relative w-full h-full min-h-[280px] bg-[#FAFBFF] overflow-hidden rounded-[20px] select-none shadow-[inset_0_0_20px_rgba(0,82,255,0.05)]"
      style={{ touchAction: 'none' }}
    >
      {/* GAME CANVAS — Sharp Rendering Setup */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-transparent touch-none">
        <canvas
          ref={canvasRef}
          width={dims.w > 0 ? dims.w * dims.dpr : 960 * dims.dpr}
          height={dims.h > 0 ? dims.h * dims.dpr : 540 * dims.dpr}
          className="absolute inset-0 block w-full h-full object-cover"
          onClick={handleAction}
          tabIndex={0}
          role="application"
          aria-label="Base Dash Game Canvas"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* ===================== MENU OVERLAY ===================== */}
      {mode === 'menu' && (
        <div className="game-overlay flex items-center justify-center" style={{ containerType: 'size', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-[180px] border border-white/40 bg-white/50 backdrop-blur-md px-4 py-4 sm:px-5 sm:py-6 shadow-[0_24px_80px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] relative flex flex-col items-center gap-3 sm:gap-4 rounded-[20px]"
            style={{ transform: 'scale(min(1, calc(100cqh / 260px)))', transformOrigin: 'center', animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>

            {/* Best Score Display — Premium */}
            <div className="w-full bg-gradient-to-br from-[#FFFBEB] to-[#FFF3CC] px-4 py-2.5 sm:py-3 border border-[#F0B90B]/30 text-center rounded-2xl shadow-[0_4px_12px_rgba(240,185,11,0.15)]"
              style={{ animation: 'menuFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '0.05s' }}>
              <p className="text-[7px] font-black text-[#D4A002] tracking-[0.18em] mb-1 lowercase" style={{ fontFamily: 'var(--font-mono, monospace)' }}>best pnl</p>
              <p className="font-black text-[#B78905] leading-none text-base sm:text-lg tracking-tighter" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{formatMarketCap(best)}</p>
            </div>

            {/* Start Button — PREMIUM pulsing glow */}
            <button
              onClick={(e) => { e.stopPropagation(); startGame() }}
              className="w-full relative overflow-hidden px-4 py-3 sm:py-4 text-[12px] font-black tracking-[0.18em] lowercase text-white transition-all duration-300 active:scale-95 group rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #0052FF 0%, #0040CC 100%)',
                boxShadow: '0 8px 32px rgba(0,82,255,0.45), 0 0 0 1px rgba(0,82,255,0.3)',
                animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both, startGlow 2.5s ease-in-out 0.5s infinite',
                animationDelay: '0.15s',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <span className="relative z-10">start trade</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-2xl" />
            </button>

            {/* Hint Text */}
            <div className="text-center" style={{ animation: 'menuFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '0.25s' }}>
              <p className="text-[9px] font-medium text-slate-500 tracking-wide" style={{ fontFamily: 'var(--font-mono, monospace)' }}>Tap or space to start</p>
            </div>

          </div>
        </div>
      )}

      {/* ===================== PAUSED OVERLAY ===================== */}
      {mode === 'paused' && (
        <div className="game-overlay bg-black/20 backdrop-blur-[2px]" style={{ containerType: 'size' }}>
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="w-full max-w-[240px] border-2 border-[#0A0B14] bg-white px-5 py-6 shadow-none mx-auto text-center rounded-2xl"
              style={{ transform: 'scale(min(1, calc(100cqh / 240px)))', transformOrigin: 'center' }}>
              <h2 className="text-xl font-bold text-[#0A0B14] mb-2 tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>Paused</h2>
              <p className="text-slate-500 text-[11px] mb-5 font-medium tracking-wide">Take a breath</p>
              <button
                onClick={() => setMode('playing')}
                className="w-full bg-[#0052FF] px-4 py-3 text-[12px] font-semibold text-white hover:bg-[#0040CC] border-2 border-[#0052FF] transition-colors rounded-xl tracking-wide"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== GAME OVER OVERLAY ===================== */}
      {mode === 'gameover' && (
        <div className="game-overlay" style={{ containerType: 'size', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: 'deathFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <div className="w-full h-full flex items-center justify-center p-1 sm:p-2">
            <div className="w-full max-w-[280px] rounded-xl bg-white border border-[#0A0B14]/20 shadow-2xl px-2 py-1.5 sm:py-2 mx-auto relative overflow-hidden"
              style={{ transform: 'scale(min(1, calc(100cqh / 280px)))', transformOrigin: 'center' }}>

              <div className="flex items-center justify-center gap-1 mb-1.5">
                {isNewRecord && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center bg-[#F0B90B] border border-[#B78905] rounded-full">
                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                )}
                <h2 className={`text-[12px] sm:text-[13px] font-black lowercase ${isNewRecord ? 'text-[#F0B90B]' : 'text-[#F6465D]'} tracking-widest`} style={{ fontFamily: 'var(--font-mono)' }}>
                  {isNewRecord ? 'new high!' : deathMessage.toLowerCase()}
                </h2>
              </div>

              <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                  <p className="text-[7px] font-black text-slate-400 lowercase tracking-widest mb-0.5">pnl</p>
                  <p className="text-[11px] sm:text-[12px] font-black text-slate-900 leading-none">{formatMarketCap(deathScore)}</p>
                </div>
                <div className="bg-[#eef4ff] px-2 py-1 rounded-lg border border-[#0052FF]/20 text-center flex flex-col justify-center">
                  <p className="text-[7px] font-black text-[#6CACFF] lowercase tracking-widest mb-0.5">mode</p>
                  <p className="text-[9px] sm:text-[10px] font-black leading-none lowercase tracking-widest" style={{ color: getSpeed(score).color }}>{speedName.toLowerCase()}</p>
                </div>
              </div>

              {nearRecordDiff !== null && (
                <div className="mb-1.5 bg-[#FFFBEB] px-2 py-1 rounded-lg border border-[#F0B90B]/30 text-center flex items-center justify-center gap-1">
                  <svg className="w-2.5 h-2.5 text-[#F0B90B]" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                  <p className="text-[7px] font-black text-[#B78905] lowercase tracking-widest">-{nearRecordDiff} from max</p>
                </div>
              )}

              {gameStats && (
                <div className="grid grid-cols-4 gap-1 mb-1.5 text-center text-[7px] font-bold">
                  <div className="bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                    <p className="text-slate-400 lowercase tracking-widest mb-0.5" style={{ fontSize: '6px' }}>time</p>
                    <p className="text-slate-700 font-black text-[8px] sm:text-[9px]">{Math.floor(gameStats.timeSurvived)}s</p>
                  </div>
                  <div className="bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                    <p className="text-slate-400 lowercase tracking-widest mb-0.5" style={{ fontSize: '6px' }}>dodged</p>
                    <p className="text-slate-700 font-black text-[8px] sm:text-[9px]">{gameStats.candlesDodged}</p>
                  </div>
                  <div className="bg-[#e8f8f0] px-1 py-0.5 rounded border border-[#0ECB81]/40">
                    <p className="text-[#0ECB81] lowercase tracking-widest mb-0.5" style={{ fontSize: '6px' }}>buys</p>
                    <p className="text-[#0ECB81] font-black text-[8px] sm:text-[9px]">{gameStats.greensCollected}</p>
                  </div>
                  <div className="bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                    <p className="text-slate-400 lowercase tracking-widest mb-0.5" style={{ fontSize: '6px' }}>jumps</p>
                    <p className="text-slate-700 font-black text-[8px] sm:text-[9px]">{gameStats.totalJumps}</p>
                  </div>
                </div>
              )}

              {(submitted || isScoreConfirmed) ? (
                <div className="mb-1.5 bg-[#e8f8f0] border border-[#0ECB81] px-2 py-1 rounded-lg flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-[8px] font-black text-[#0ECB81] lowercase tracking-widest">saved!</span>
                  </div>
                  {submitTxHash && (
                    <a href={`https://${process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? 'sepolia.' : ''}basescan.org/tx/${submitTxHash}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 text-[6px] font-black font-mono text-[#0A0B14] hover:text-[#0052FF] underline opacity-90 transition-colors lowercase tracking-widest">
                      view tx ↗
                    </a>
                  )}
                </div>
              ) : isNewRecord ? (
                isConnected && canSubmitScore && deathScore > 0 ? (
                  submitting ? (
                    <button disabled className="mb-1.5 w-full bg-slate-200 text-slate-500 py-1.5 text-[8px] sm:text-[9px] font-black lowercase tracking-widest rounded-none border border-slate-300">
                      submitting...
                    </button>
                  ) : (
                    <button onClick={submitScore} className="mb-1.5 w-full bg-[#0052FF] text-white py-1.5 text-[8px] sm:text-[9px] font-black lowercase tracking-widest hover:bg-[#0A0B14] active:scale-[0.98] rounded-none border border-[#0052FF] hover:border-[#0A0B14] transition-colors">
                      save record (free)
                    </button>
                  )
                ) : !isConnected ? (
                  <button onClick={handleConnectWallet} disabled={connectingWallet} className="mb-1.5 w-full bg-[#0052FF] text-white py-1.5 text-[8px] sm:text-[9px] font-black lowercase tracking-widest hover:bg-[#0A0B14] active:scale-[0.98] rounded-none border border-[#0052FF] hover:border-[#0A0B14] transition-colors disabled:opacity-50">
                    {connectingWallet ? 'connecting...' : 'connect to save'}
                  </button>
                ) : (
                  <p className="mb-1.5 px-2 py-1 text-[6px] sm:text-[7px] font-black text-slate-500 lowercase tracking-widest bg-slate-100/80 rounded border border-slate-200 text-center">contract not configured.</p>
                )
              ) : null}

              {error && <p className="text-[#F6465D] text-[6px] sm:text-[7px] font-black mb-1.5 bg-[#FFF0F2] px-2 py-1 rounded text-center border border-[#F6465D]/30 lowercase tracking-widest">{error.toLowerCase()}</p>}

              <button onClick={startGame} className={`w-full border border-[#0A0B14] bg-white px-2 py-1.5 text-[9px] sm:text-[10px] font-black text-[#0A0B14] lowercase tracking-widest hover:bg-[#0A0B14] hover:text-white active:scale-[0.98] transition-all rounded-none ${retryVisible ? 'opacity-100' : 'opacity-0 scale-95 pointer-events-none'}`} style={retryVisible ? { animation: 'retryPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' } : undefined}>
                run it back
              </button>

              {retryVisible && (
                <button
                  onClick={() => {
                    const encodedAddr = address ? `&address=${address}` : ''
                    const shareUrl = `${window.location.origin}/api/frames/result?score=${deathScore}${encodedAddr}`
                    const shareText = `I scored ${formatMarketCap(deathScore)} PNL in Base Dash! 🎮`
                    if (navigator.share) {
                      navigator.share({ title: 'Base Dash Score', text: shareText, url: shareUrl }).catch(() => { })
                    } else {
                      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => { })
                    }
                  }}
                  className="w-full mt-1 border border-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-1 text-[7px] sm:text-[8px] font-black text-[#8B5CF6] lowercase tracking-widest hover:bg-[#8B5CF6] hover:text-white active:scale-[0.98] transition-all rounded-none flex items-center justify-center gap-1"
                >
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" /></svg>
                  share
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== PLAYING HUD ===================== */}
      {mode === 'playing' && (
        <>
          {/* Minimalist Premium HUD — Left with ATH */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
            <div className="flex flex-col items-start gap-1">
              {/* Current Score */}
              <div className="flex items-center gap-2.5 px-2 py-1.5 bg-white/70 backdrop-blur rounded-xl border border-white/80 shadow-sm pointer-events-none"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <span className="text-[15px] font-black text-slate-900 leading-none tracking-tighter"
                  style={{ fontFamily: 'var(--font-mono, monospace)', textShadow: 'none' }}>
                  {formatMarketCap(score)}
                </span>
                <div className="w-px h-3.5 bg-slate-300" />
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[#0ECB81] rounded-sm shadow-[0_0_4px_#0ECB81]" />
                  <span className="text-[11px] font-bold text-slate-700"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    {engineRef.current.totalCollected}
                  </span>
                </div>
              </div>
              {/* ATH (Best) indicator */}
              {best > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FFF8DC]/90 backdrop-blur border border-[#F0B90B]/40 rounded-lg shadow-sm">
                  <svg className="w-2.5 h-2.5 text-[#D4A002]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[9px] font-black text-[#B78905] lowercase tracking-wide"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    ath: {formatMarketCap(best)}
                  </span>
                </div>
              )}
            </div>

            {/* Combo badge */}
            {engineRef.current.combo > 1 && (
              <div className="flex items-center px-2 py-1 bg-[#FFF8DC]/90 backdrop-blur border border-[#F0B90B]/40 rounded-lg shadow-sm">
                <span className="text-[10px] font-black text-[#D4A002] drop-shadow-[0_0_4px_rgba(240,185,11,0.4)] lowercase"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {engineRef.current.combo}× combo
                </span>
              </div>
            )}
          </div>

          {/* Premium HUD — Right: World + Speed + Sound */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/70 backdrop-blur rounded-xl border border-white/80 shadow-sm pointer-events-none"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <span className="text-[9px] font-bold text-slate-600 lowercase leading-none tracking-[0.14em]"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {worldName.toLowerCase()}
              </span>
              <div className="w-px h-2.5 bg-slate-300" />
              <span className="text-[9px] font-black leading-none lowercase tracking-[0.1em]"
                style={{ color: getSpeed(score).color, fontFamily: 'var(--font-mono, monospace)', textShadow: `0 0 8px ${getSpeed(score).color}80` }}>
                {(speedName.split('.').pop()?.trim() || speedName).toLowerCase()}
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
              <p className="text-[#0ECB81] text-[9px] font-bold text-center drop-shadow-[0_0_4px_rgba(14,203,129,0.5)] tracking-wide lowercase">
                {engineRef.current.whaleTimer > 0 ? 'market freeze' : 'chill market'}
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
  )
}
