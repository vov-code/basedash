/**
 * ============================================================================
 * BASE DASH — Premium Trading-Themed Endless Runner
 * Built for degens who ape into candles and HODL through the dips
 * 
 * Features:
 * - Advanced physics with coyote time, jump buffering, variable jump height
 * - Trading candle obstacles (red = death, green = slowdown + points)
 * - Multiple worlds with unique themes that unlock as score increases
 * - Parallax scrolling backgrounds with detailed graphics
 * - Particle systems, screen shake, camera effects
 * - Combo system with score multipliers
 * - Procedural obstacle generation with increasing complexity
 * - 60+ FPS optimized rendering with fixed timestep
 * - On-chain score submission via Base blockchain
 * 
 * @version 3.0.0
 * @author Base Dash Team
 * @license MIT
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWriteContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'
import { useWallet } from '@/app/hooks/useWallet'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type GameMode = 'menu' | 'playing' | 'paused' | 'gameover'
type CandleKind = 'red' | 'green'

interface WorldTheme {
  name: string
  startScore: number
  skyTop: string
  skyMid: string
  skyBottom: string
  groundTop: string
  groundBottom: string
  accent: string
  grid: string
  redA: string
  redB: string
  greenA: string
  greenB: string
  floorPattern: 'diagonal' | 'circuit' | 'waves' | 'grid'
}

interface SpeedTier {
  label: string
  startScore: number
  multiplier: number
}

interface TrailPoint {
  x: number
  y: number
  life: number
  alpha: number
}

interface Player {
  x: number
  y: number
  velocityY: number
  onGround: boolean
  coyoteTimer: number
  jumpBufferTimer: number
  rotation: number
  trail: TrailPoint[]
  jumpCount: number
  maxJumps: number
  invincible: number
}

interface Candle {
  id: number
  kind: CandleKind
  x: number
  width: number
  bodyHeight: number
  bodyY: number
  bodyTop: number
  wickTop: number
  wickBottom: number
  passed: boolean
  collected: boolean
  phase: number
  flickerSpeed: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: string
  gravity: number
  type: 'spark' | 'glow' | 'star'
}

interface FloatingText {
  x: number
  y: number
  value: string
  color: string
  life: number
  vy: number
}

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  depth: number
  twinkle: number
  color?: string
}

interface EngineState {
  player: Player
  candles: Candle[]
  particles: Particle[]
  floatingTexts: FloatingText[]
  stars: Star[]
  speed: number
  distance: number
  score: number
  combo: number
  maxCombo: number
  slowdownTimer: number
  nextSpawnDistance: number
  nextCandleId: number
  shakeX: number
  shakeY: number
  shakeTimer: number
  worldName: string
  worldBannerTimer: number
  uiTimer: number
  alive: boolean
  gameTime: number
}

// ============================================================================
// CONFIGURATION CONSTANTS - OPTIMIZED FOR SMOOTH 60FPS
// ============================================================================

const CFG = {
  // Canvas dimensions
  WIDTH: 960,
  HEIGHT: 540,

  // Ground and player positioning
  GROUND: 430,
  PLAYER_X: 180,
  PLAYER_SIZE: 40,
  HITBOX: 8,

  // Physics - timing (fixed timestep for consistent physics)
  STEP: 1 / 60,
  MAX_DELTA: 0.033,
  UI_RATE: 1 / 10,

  // Physics - movement (balanced for smooth gameplay)
  GRAVITY: 3200,
  JUMP: -950,
  DOUBLE_JUMP: -800,
  MAX_FALL: 1600,
  COYOTE: 0.12,
  BUFFER: 0.15,
  ROT_SPEED: 10,

  // Game progression - INCREASED SPEED & DISTANCE
  BASE_SPEED: 420,
  MAX_SPEED: 780,
  SPEED_INCREMENT: 18,
  DOUBLE_JUMP_AT: 150,
  TRIPLE_JUMP_AT: 450,

  // Spawning - LOGICAL PROGRESSION
  BASE_SPAWN_GAP: 420,
  MIN_SPAWN_GAP: 240,
  GAP_DECREASE_RATE: 0.08,

  // Scoring
  RED_SCORE: 10,
  GREEN_SCORE: 5,
  SLOW_MULT: 0.65,
  SLOW_TIME: 2.5,

  // Visual effects - OPTIMIZED LIMITS
  PARTICLE_LIMIT: 200,
  TRAIL_LIMIT: 8,
  STAR_COUNT: 60,
  TEXT_LIMIT: 12,
}

// ============================================================================
// SPEED TIERS - BALANCED FOR NEW SPEED SYSTEM
// ============================================================================

const SPEEDS: SpeedTier[] = [
  { label: 'chill', startScore: 0, multiplier: 1.0 },
  { label: 'warming up', startScore: 200, multiplier: 1.12 },
  { label: 'picking up', startScore: 500, multiplier: 1.28 },
  { label: 'fast af', startScore: 900, multiplier: 1.48 },
  { label: 'degen mode', startScore: 1500, multiplier: 1.72 },
  { label: 'impossible', startScore: 2400, multiplier: 2.0 },
]

// ============================================================================
// WORLD THEMES
// ============================================================================

const WORLDS: WorldTheme[] = [
  {
    name: 'foundation',
    startScore: 0,
    skyTop: '#050811',
    skyMid: '#0f1a2e',
    skyBottom: '#173257',
    groundTop: '#1a2740',
    groundBottom: '#0a0f1a',
    accent: '#3f7fff',
    grid: 'rgba(63,127,255,0.1)',
    redA: '#ff6078', redB: '#ac3348',
    greenA: '#16e79a', greenB: '#0b9f68',
    floorPattern: 'diagonal',
  },
  {
    name: 'data storm',
    startScore: 280,
    skyTop: '#120a20',
    skyMid: '#231341',
    skyBottom: '#3a2166',
    groundTop: '#2d1a4a',
    groundBottom: '#0f0a1a',
    accent: '#a16eff',
    grid: 'rgba(161,110,255,0.1)',
    redA: '#ff7390', redB: '#ba3a59',
    greenA: '#44f5c6', greenB: '#1aa88a',
    floorPattern: 'circuit',
  },
  {
    name: 'bear valley',
    startScore: 700,
    skyTop: '#18090a',
    skyMid: '#321518',
    skyBottom: '#4f2327',
    groundTop: '#4a2025',
    groundBottom: '#1a0a0b',
    accent: '#ff9347',
    grid: 'rgba(255,147,71,0.1)',
    redA: '#ff6f61', redB: '#b43d30',
    greenA: '#70f6ae', greenB: '#2cb06d',
    floorPattern: 'waves',
  },
  {
    name: 'liquid night',
    startScore: 1250,
    skyTop: '#061218',
    skyMid: '#0d2532',
    skyBottom: '#12465a',
    groundTop: '#1a3d4a',
    groundBottom: '#0a151a',
    accent: '#33d1ff',
    grid: 'rgba(51,209,255,0.1)',
    redA: '#ff7ba6', redB: '#b13b61',
    greenA: '#67ffd9', greenB: '#21b89f',
    floorPattern: 'grid',
  },
  {
    name: 'void circuit',
    startScore: 1900,
    skyTop: '#0a0a0a',
    skyMid: '#181818',
    skyBottom: '#262626',
    groundTop: '#2a2a2a',
    groundBottom: '#0a0a0a',
    accent: '#f0b90b',
    grid: 'rgba(240,185,11,0.1)',
    redA: '#ff845e', redB: '#b85a38',
    greenA: '#9cff78', greenB: '#4ca93f',
    floorPattern: 'circuit',
  },
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1)
const rand = (min: number, max: number) => Math.random() * (max - min) + min

const getWorld = (score: number) => WORLDS.filter(w => score >= w.startScore).at(-1) || WORLDS[0]
const getSpeed = (score: number) => SPEEDS.filter(s => score >= s.startScore).at(-1) || SPEEDS[0]
const getJumps = (score: number) => score >= CFG.TRIPLE_JUMP_AT ? 3 : score >= CFG.DOUBLE_JUMP_AT ? 2 : 1

// ============================================================================
// CREATION FUNCTIONS
// ============================================================================

const createStars = (): Star[] =>
  Array.from({ length: CFG.STAR_COUNT }, () => ({
    x: Math.random() * CFG.WIDTH,
    y: Math.random() * (CFG.GROUND - 60),
    size: rand(0.5, 2.2),
    alpha: rand(0.3, 0.85),
    depth: rand(0.2, 0.9),
    twinkle: rand(0, Math.PI * 2),
  }))

const createPlayer = (): Player => ({
  x: CFG.PLAYER_X,
  y: CFG.GROUND - CFG.PLAYER_SIZE,
  velocityY: 0,
  onGround: true,
  coyoteTimer: CFG.COYOTE,
  jumpBufferTimer: 0,
  rotation: 0,
  trail: [],
  jumpCount: 0,
  maxJumps: 1,
  invincible: 0,
})

const createCandle = (id: number, kind: CandleKind, x: number, height: number, width: number): Candle => {
  const upperWick = height * rand(0.16, 0.24)
  const lowerWick = height * rand(0.08, 0.14)
  const bodyHeight = height - upperWick - lowerWick
  const bodyY = CFG.GROUND - lowerWick - bodyHeight

  return {
    id, kind, x, width, bodyHeight, bodyY,
    bodyTop: bodyY + bodyHeight,
    wickTop: bodyY - upperWick,
    wickBottom: bodyY + bodyHeight + lowerWick,
    passed: false, collected: false,
    phase: rand(0, Math.PI * 2),
    flickerSpeed: rand(7, 11),
  }
}

const createEngine = (): EngineState => {
  const world = WORLDS[0]
  return {
    player: createPlayer(),
    candles: [],
    particles: [],
    floatingTexts: [],
    stars: createStars(),
    speed: CFG.BASE_SPEED,
    distance: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    slowdownTimer: 0,
    nextSpawnDistance: 260,
    nextCandleId: 1,
    shakeX: 0, shakeY: 0, shakeTimer: 0,
    worldName: world.name,
    worldBannerTimer: 0,
    uiTimer: 0,
    alive: true,
    gameTime: 0,
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GameEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const engineRef = useRef<EngineState>(createEngine())
  const rafRef = useRef<number>()
  const highScoreRef = useRef(0)
  const jumpHoldRef = useRef(false)

  const { address, isConnected, connectWallet } = useWallet()
  const { canSubmitScore } = useDailyCheckin(address)
  const { writeContractAsync } = useWriteContract()

  const [mode, setMode] = useState<GameMode>('menu')
  const [loading, setLoading] = useState(true)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [score, setScore] = useState(0)
  const [deathScore, setDeathScore] = useState(0)
  const [best, setBest] = useState(0)
  const [combo, setCombo] = useState(0)
  const [worldName, setWorldName] = useState(WORLDS[0].name)
  const [speedName, setSpeedName] = useState(SPEEDS[0].label)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const storageKey = useMemo(
    () => address ? `basedash:${address.toLowerCase()}` : 'basedash:guest',
    [address]
  )

  // ──────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ──────────────────────────────────────────────────────────────────────────

  const saveBest = useCallback((v: number) => {
    if (v <= highScoreRef.current) return
    highScoreRef.current = v
    setBest(v)
    localStorage.setItem(storageKey, String(v))
  }, [storageKey])

  const addParticles = useCallback((x: number, y: number, color: string, count: number, type: Particle['type'] = 'spark') => {
    const e = engineRef.current
    if (e.particles.length > CFG.PARTICLE_LIMIT) {
      e.particles.splice(0, e.particles.length - CFG.PARTICLE_LIMIT)
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = rand(70, 280)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: rand(1.5, 4),
        color,
        gravity: type === 'spark' ? 500 : type === 'star' ? 180 : 0,
        type,
      })
    }
  }, [])

  const addText = useCallback((x: number, y: number, value: string, color: string) => {
    engineRef.current.floatingTexts.push({ x, y, value, color, life: 1, vy: -45 })
  }, [])

  const shake = useCallback((intensity: number) => {
    const e = engineRef.current
    e.shakeTimer = Math.max(e.shakeTimer, intensity * 0.02)
  }, [])

  const stopGame = useCallback((runScore: number) => {
    const e = engineRef.current
    if (!e.alive) return
    e.alive = false
    shake(18)
    addParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, e.player.y + CFG.PLAYER_SIZE / 2, '#ff6078', 40, 'spark')
    setDeathScore(runScore)
    setScore(runScore)
    saveBest(runScore)
    setMode('gameover')
  }, [addParticles, saveBest, shake])

  const queueJump = useCallback(() => {
    engineRef.current.player.jumpBufferTimer = CFG.BUFFER
    jumpHoldRef.current = true
  }, [])

  const releaseJump = useCallback(() => {
    jumpHoldRef.current = false
  }, [])

  const startGame = useCallback(() => {
    engineRef.current = createEngine()
    setError('')
    setScore(0)
    setCombo(0)
    setWorldName(WORLDS[0].name)
    setSpeedName(SPEEDS[0].label)
    setMode('playing')
  }, [])

  const handleAction = useCallback(() => {
    if (mode === 'menu' || mode === 'gameover') {
      startGame()
      return
    }
    queueJump()
  }, [mode, queueJump, startGame])

  const submitScore = useCallback(async () => {
    if (!address || !canSubmitScore || deathScore <= 0 || submitting) return
    if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('contract not configured')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/score-sign?address=${address}&score=${deathScore}`)
      if (!res.ok) throw new Error('signing failed')
      const { signature, nonce } = await res.json()
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: GAME_LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(deathScore), BigInt(nonce), signature],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed')
    } finally {
      setSubmitting(false)
    }
  }, [address, canSubmitScore, deathScore, submitting, writeContractAsync])

  // ──────────────────────────────────────────────────────────────────────────
  // SPAWN PATTERNS - OPTIMIZED DISTANCES
  // ──────────────────────────────────────────────────────────────────────────

  const spawnPattern = useCallback((e: EngineState) => {
    const diff = clamp(e.score / 3500, 0, 1)
    const complexity = Math.min(5, Math.floor(e.score / 500))
    const startX = CFG.WIDTH + 120
    const baseH = lerp(80, 120, diff)
    const baseW = lerp(30, 42, diff)

    const push = (offset: number, kind: CandleKind, hM = 1, wM = 1) => {
      e.candles.push(createCandle(
        e.nextCandleId++,
        kind,
        startX + offset,
        baseH * rand(0.9, 1.18) * hM,
        baseW * rand(0.92, 1.12) * wM
      ))
    }

    const roll = Math.random()

    // Логичная прогрессия сложности с увеличенными дистанциями
    if (complexity === 0) {
      if (roll < 0.75) push(0, 'red')
      else if (roll < 0.9) { push(0, 'red', 1.08); push(100, 'green') }
      else push(0, 'green')
    } else if (complexity === 1) {
      if (roll < 0.28) { push(0, 'red'); push(120, 'red', 1.06) }
      else if (roll < 0.48) { push(0, 'green'); push(100, 'red', 1.15) }
      else if (roll < 0.72) { push(0, 'red', 0.94); push(95, 'red', 1.18) }
      else { push(0, 'red'); push(90, 'red', 1.04); push(185, 'green') }
    } else if (complexity === 2) {
      if (roll < 0.22) { push(0, 'red', 1.12); push(105, 'red', 0.94); push(210, 'red', 1.06) }
      else if (roll < 0.42) { push(0, 'green'); push(95, 'red', 1.2); push(190, 'red') }
      else if (roll < 0.62) { push(0, 'red', 0.9); push(90, 'red', 1.15); push(185, 'green') }
      else { push(0, 'red'); push(95, 'red', 1.1); push(195, 'red', 0.96); push(290, 'green') }
    } else if (complexity === 3) {
      if (roll < 0.18) { push(0, 'red'); push(85, 'red', 1.08); push(170, 'red', 1.18); push(260, 'green') }
      else if (roll < 0.36) { push(0, 'green'); push(90, 'red', 1.16); push(180, 'red'); push(270, 'red', 0.94) }
      else if (roll < 0.56) { push(0, 'red', 1.04); push(95, 'green'); push(195, 'red', 1.14); push(295, 'red', 0.96) }
      else { push(0, 'red', 0.92); push(80, 'red', 1.1); push(165, 'red'); push(250, 'red', 1.16); push(340, 'green') }
    } else {
      if (roll < 0.15) { push(0, 'red'); push(78, 'red', 1.08); push(156, 'red', 1.18); push(240, 'red', 1.06) }
      else if (roll < 0.32) { push(0, 'green'); push(85, 'red', 1.18); push(175, 'red'); push(265, 'red', 0.94); push(355, 'green') }
      else if (roll < 0.5) { push(0, 'red', 1.04); push(90, 'green'); push(185, 'red', 1.16); push(280, 'red', 0.96) }
      else { push(0, 'red', 0.92); push(75, 'red', 1.1); push(155, 'red'); push(235, 'red', 1.18); push(320, 'green') }
    }

    // Логичный расчет дистанции спавна на основе скорости
    const speedFactor = e.speed / CFG.BASE_SPEED
    const gap = Math.max(
      CFG.MIN_SPAWN_GAP,
      CFG.BASE_SPAWN_GAP - (e.score * CFG.GAP_DECREASE_RATE)
    ) * speedFactor
    
    e.nextSpawnDistance = e.distance + gap * rand(0.9, 1.08)
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE SIMULATION - OPTIMIZED
  // ──────────────────────────────────────────────────────────────────────────

  const update = useCallback((dt: number) => {
    const e = engineRef.current
    if (!e.alive) return

    e.gameTime += dt
    const p = e.player

    // Speed calculation with cap
    const tier = getSpeed(e.score)
    const diffMult = lerp(1, 1.4, clamp(e.score / 3500, 0, 1))
    let targetSpeed = CFG.BASE_SPEED * tier.multiplier * diffMult

    // Cap max speed
    targetSpeed = Math.min(targetSpeed, CFG.MAX_SPEED)

    if (e.slowdownTimer > 0) {
      e.slowdownTimer = Math.max(0, e.slowdownTimer - dt)
      const mix = clamp(e.slowdownTimer / CFG.SLOW_TIME, 0, 1)
      targetSpeed *= lerp(1, CFG.SLOW_MULT, mix)
    }

    e.speed = lerp(e.speed, targetSpeed, dt * 3)
    e.distance += e.speed * dt

    // Timers
    p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt)
    p.coyoteTimer = p.onGround ? CFG.COYOTE : Math.max(0, p.coyoteTimer - dt)
    p.invincible = Math.max(0, p.invincible - dt)

    // Jump
    if (p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0)) {
      const vel = p.jumpCount === 0 ? CFG.JUMP : CFG.DOUBLE_JUMP
      p.velocityY = vel
      p.onGround = false
      p.jumpCount++
      p.jumpBufferTimer = 0
      p.coyoteTimer = 0
      
      // Only add particles on ground
      if (p.jumpCount === 1) {
        addParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, CFG.GROUND - 2, '#ffffff', 8, 'spark')
      }
    }

    // Gravity
    p.velocityY = Math.min(CFG.MAX_FALL, p.velocityY + CFG.GRAVITY * dt)
    p.y += p.velocityY * dt

    // Ground
    if (p.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
      p.y = CFG.GROUND - CFG.PLAYER_SIZE
      p.velocityY = 0
      p.onGround = true
      p.jumpCount = 0
      p.maxJumps = getJumps(e.score)
      const targetRot = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2)
      p.rotation = lerp(p.rotation, targetRot, dt * 12)
    } else {
      p.onGround = false
      p.rotation += CFG.ROT_SPEED * dt
    }

    // Trail - optimized limit
    if (e.gameTime % 0.04 < dt) {
      p.trail.push({ x: CFG.PLAYER_X, y: p.y, life: 0.35, alpha: 0.5 })
      if (p.trail.length > CFG.TRAIL_LIMIT) {
        p.trail.shift()
      }
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= 0.08
      if (p.trail[i].life <= 0) p.trail.splice(i, 1)
    }

    // Spawn
    if (e.distance >= e.nextSpawnDistance) spawnPattern(e)

    // Candles - optimized collision
    const pad = CFG.HITBOX
    const px = CFG.PLAYER_X + pad
    const py = p.y + pad
    const ps = CFG.PLAYER_SIZE - pad * 2

    for (let i = e.candles.length - 1; i >= 0; i--) {
      const c = e.candles[i]
      c.x -= e.speed * dt
      c.phase += c.flickerSpeed * dt

      if (!c.passed && c.x + c.width < CFG.PLAYER_X) {
        c.passed = true
        if (c.kind === 'red') {
          e.score += CFG.RED_SCORE
          if (e.combo > 0) e.combo = Math.max(1, e.combo - 1)
        } else if (!c.collected) {
          e.combo = 0
        }
      }

      if (c.x + c.width < -80) { e.candles.splice(i, 1); continue }

      const bodyHit = (px < c.x + c.width - 2 && px + ps > c.x + 2 && py < c.bodyTop - 1 && py + ps > c.bodyY + 1)
      const wickHit = (px < c.x + c.width * 0.55 && px + ps > c.x + c.width * 0.35 && py < c.wickBottom && py + ps > c.wickTop)

      if (c.kind === 'red' && (bodyHit || wickHit) && p.invincible <= 0) {
        stopGame(e.score)
        return
      }

      if (c.kind === 'green' && !c.collected && (bodyHit || wickHit)) {
        c.collected = true
        e.score += CFG.GREEN_SCORE
        e.combo++
        e.maxCombo = Math.max(e.maxCombo, e.combo)
        e.slowdownTimer = Math.max(e.slowdownTimer, CFG.SLOW_TIME)
        addParticles(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, '#16e79a', 14, 'glow')
        addText(c.x + c.width / 2, c.bodyY - 12, '+5', '#16e79a')
        shake(4)
      }
    }

    // Texts - optimized
    for (let i = e.floatingTexts.length - 1; i >= 0; i--) {
      const t = e.floatingTexts[i]
      t.y += t.vy * dt
      t.life -= 0.8 * dt
      if (t.life <= 0 || e.floatingTexts.length > CFG.TEXT_LIMIT) {
        e.floatingTexts.splice(i, 1)
      }
    }

    // Stars - optimized
    for (const s of e.stars) {
      s.x -= e.speed * 0.03 * s.depth * dt
      s.twinkle += 2 * dt
      if (s.x < -10) { s.x = CFG.WIDTH + 10; s.y = rand(15, CFG.GROUND - 50) }
    }

    // Particles - optimized
    for (let i = e.particles.length - 1; i >= 0; i--) {
      const pt = e.particles[i]
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += pt.gravity * dt
      pt.vx *= 0.97
      pt.vy *= 0.97
      pt.life -= 0.03
      if (pt.life <= 0) e.particles.splice(i, 1)
    }

    // World transition
    const world = getWorld(e.score)
    if (world.name !== e.worldName) {
      e.worldName = world.name
      e.worldBannerTimer = 2.2
      shake(8)
    } else if (e.worldBannerTimer > 0) {
      e.worldBannerTimer -= dt
    }

    // Shake decay
    if (e.shakeTimer > 0) {
      e.shakeTimer -= dt
      const intensity = e.shakeTimer * 1.5
      e.shakeX = (Math.random() - 0.5) * intensity
      e.shakeY = (Math.random() - 0.5) * intensity
    } else {
      e.shakeX = 0
      e.shakeY = 0
    }

    // UI
    e.uiTimer += dt
    if (e.uiTimer > CFG.UI_RATE) {
      e.uiTimer = 0
      setScore(e.score)
      setCombo(e.combo)
      setWorldName(world.name)
      setSpeedName(tier.label)
    }
  }, [addParticles, addText, shake, spawnPattern, stopGame])

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW FUNCTION - OPTIMIZED FOR PERFORMANCE
  // ──────────────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const e = engineRef.current
    const w = getWorld(e.score)

    // Clear with background fill (faster than clear + fill)
    ctx.fillStyle = w.skyBottom
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT)

    ctx.save()
    if (e.shakeTimer > 0) {
      ctx.translate(e.shakeX, e.shakeY)
    }

    // Sky gradient - optimized
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CFG.GROUND)
    skyGrad.addColorStop(0, w.skyTop)
    skyGrad.addColorStop(0.6, w.skyMid)
    skyGrad.addColorStop(1, w.skyBottom)
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.GROUND)

    // Stars - simplified rendering
    ctx.globalAlpha = 0.8
    ctx.fillStyle = '#ffffff'
    for (const s of e.stars) {
      const alpha = (s.alpha + Math.sin(s.twinkle) * 0.15) * 0.7
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Grid overlay - reduced lines
    ctx.strokeStyle = w.grid
    ctx.lineWidth = 1
    const off = (e.distance * 0.1) % 60
    for (let x = -off; x <= CFG.WIDTH; x += 60) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CFG.GROUND)
      ctx.stroke()
    }

    // Ground - optimized
    ctx.fillStyle = w.groundTop
    ctx.fillRect(0, CFG.GROUND, CFG.WIDTH, CFG.HEIGHT - CFG.GROUND)

    // Ground line - no shadow for performance
    ctx.strokeStyle = w.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, CFG.GROUND)
    ctx.lineTo(CFG.WIDTH, CFG.GROUND)
    ctx.stroke()

    // Floor pattern - simplified
    const fOff = (e.distance * 0.4) % 50
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    for (let x = -fOff; x < CFG.WIDTH + 50; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, CFG.GROUND)
      ctx.lineTo(x + 25, CFG.GROUND + 14)
      ctx.lineTo(x + 50, CFG.GROUND)
      ctx.closePath()
      ctx.fill()
    }

    // Candles - optimized rendering
    for (const c of e.candles) {
      if (c.collected) continue
      const isRed = c.kind === 'red'
      const a = isRed ? w.redA : w.greenA
      const b = isRed ? w.redB : w.greenB

      // Wick - simple line
      ctx.strokeStyle = a
      ctx.lineWidth = Math.max(2, c.width * 0.12)
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(c.x + c.width / 2, c.wickTop)
      ctx.lineTo(c.x + c.width / 2, c.wickBottom)
      ctx.stroke()
      ctx.globalAlpha = 1

      // Body - gradient fill only
      const bodyGrad = ctx.createLinearGradient(c.x, c.bodyY, c.x, c.bodyY + c.bodyHeight)
      bodyGrad.addColorStop(0, a)
      bodyGrad.addColorStop(1, b)
      ctx.fillStyle = bodyGrad
      ctx.fillRect(c.x, c.bodyY, c.width, c.bodyHeight)

      // Highlight - single rectangle
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(c.x + 3, c.bodyY + 2, c.width * 0.2, c.bodyHeight - 4)
    }

    // Trail - optimized
    for (const t of e.player.trail) {
      ctx.globalAlpha = t.alpha * t.life * 0.6
      if (logoLoaded && logoRef.current) {
        ctx.drawImage(logoRef.current, t.x, t.y, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
      } else {
        ctx.fillStyle = w.accent
        ctx.fillRect(t.x, t.y, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
      }
    }
    ctx.globalAlpha = 1

    // Player - simplified
    ctx.save()
    ctx.translate(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, e.player.y + CFG.PLAYER_SIZE / 2)
    ctx.rotate(e.player.rotation)
    
    if (logoLoaded && logoRef.current) {
      ctx.drawImage(logoRef.current, -CFG.PLAYER_SIZE / 2, -CFG.PLAYER_SIZE / 2, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    } else {
      ctx.fillStyle = w.accent
      ctx.fillRect(-CFG.PLAYER_SIZE / 2, -CFG.PLAYER_SIZE / 2, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-CFG.PLAYER_SIZE / 2 + 6, -CFG.PLAYER_SIZE / 2 + 6, CFG.PLAYER_SIZE - 12, CFG.PLAYER_SIZE - 12)
    }
    
    // Invincibility - simple flash
    if (e.player.invincible > 0 && Math.floor(e.gameTime * 20) % 2 === 0) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(-CFG.PLAYER_SIZE / 2 - 2, -CFG.PLAYER_SIZE / 2 - 2, CFG.PLAYER_SIZE + 4, CFG.PLAYER_SIZE + 4)
    }
    
    ctx.restore()

    // Particles - batch rendering
    for (const pt of e.particles) {
      const alpha = clamp(pt.life, 0, 1)
      ctx.globalAlpha = alpha
      ctx.fillStyle = pt.color
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, pt.size * Math.max(0.5, pt.life), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Floating texts - simple render
    for (const t of e.floatingTexts) {
      ctx.globalAlpha = clamp(t.life, 0, 1)
      ctx.fillStyle = t.color
      ctx.font = 'bold 18px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t.value, t.x, t.y)
    }

    // World banner
    if (e.worldBannerTimer > 0) {
      const alpha = clamp(e.worldBannerTimer / 2.2, 0, 1)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      const bw = 260, bh = 48
      const bx = CFG.WIDTH / 2 - bw / 2, by = 40
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = w.accent
      ctx.lineWidth = 2
      ctx.strokeRect(bx, by, bw, bh)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(w.name, CFG.WIDTH / 2, by + bh / 2 + 2)
      ctx.restore()
    }

    ctx.restore()
  }, [logoLoaded])

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setTimeout(() => setLoading(false), 600)
    const img = new Image()
    img.src = '/base-logo.png'
    img.onload = () => { logoRef.current = img; setLogoLoaded(true) }
  }, [])

  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey) || 0)
    highScoreRef.current = isFinite(saved) ? saved : 0
    setBest(highScoreRef.current)
  }, [storageKey])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        handleAction()
      }
      if (e.code === 'Escape' && mode === 'playing') setMode('paused')
      if (e.code === 'KeyP') setMode(m => m === 'playing' ? 'paused' : 'playing')
    }
    const up = () => releaseJump()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [handleAction, releaseJump, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ts = (e: TouchEvent) => { e.preventDefault(); handleAction() }
    const te = (e: TouchEvent) => { e.preventDefault(); releaseJump() }
    canvas.addEventListener('touchstart', ts, { passive: false })
    canvas.addEventListener('touchend', te, { passive: false })
    return () => { canvas.removeEventListener('touchstart', ts); canvas.removeEventListener('touchend', te) }
  }, [handleAction, releaseJump])

  useEffect(() => {
    if (mode !== 'playing') return
    let prev = performance.now()
    let acc = 0
    const loop = (t: number) => {
      const dt = Math.min(CFG.MAX_DELTA, (t - prev) / 1000)
      prev = t
      acc += dt
      while (acc >= CFG.STEP) { update(CFG.STEP); acc -= CFG.STEP }
      draw()
      if (engineRef.current.alive && mode === 'playing') rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [mode, update, draw])

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/40 text-xs">loading basedash...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* CANVAS */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/5">
        <canvas
          ref={canvasRef}
          width={CFG.WIDTH}
          height={CFG.HEIGHT}
          className="w-full bg-[#0a0b14] cursor-pointer"
          onClick={handleAction}
          tabIndex={0}
        />

        {/* MENU */}
        {mode === 'menu' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center">
            <div className="text-center px-6">
              <div className="mb-5">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
                  <img src="/base-logo.png" alt="" className="w-16 h-16 rounded-xl object-cover" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">basedash</h2>
                <p className="text-white/40 text-xs">ape into candles, don't get rekt</p>
              </div>

              <button
                onClick={startGame}
                className="px-7 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/25 mb-5"
              >
                start running
              </button>

              <div className="grid grid-cols-2 gap-2.5 text-left text-xs">
                <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">controls</p>
                  <p className="text-white/70">space / click</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">best</p>
                  <p className="text-white/70 font-mono">{best}</p>
                </div>
              </div>

              <div className="mt-5 px-4 py-3 rounded-xl bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/25">
                <p className="text-green-400 text-xs font-medium mb-1.5">how to not get rekt</p>
                <ul className="text-white/50 text-[11px] space-y-1 text-left">
                  <li>🕯️ <span className="text-red-400">red candles</span> = instant rekt</li>
                  <li>🕯️ <span className="text-green-400">green candles</span> = chill mode + points</li>
                  <li>⚡ double jump unlocks at 120 pts</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* PAUSED */}
        {mode === 'paused' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">paused</h2>
              <button
                onClick={() => setMode('playing')}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-700 text-white transition-all hover:scale-105"
              >
                resume
              </button>
              <p className="text-white/35 text-xs mt-3">press P to resume</p>
            </div>
          </div>
        )}

        {/* GAMEOVER */}
        {mode === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
            <div className="text-center px-6 max-w-sm">
              <h2 className="text-3xl font-bold text-red-400 mb-1">rekt</h2>
              <p className="text-white/40 text-xs mb-5">ate a red candle</p>

              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">score</p>
                  <p className="text-xl font-bold text-white font-mono">{deathScore}</p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">best</p>
                  <p className="text-xl font-bold text-blue-400 font-mono">{best}</p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">world</p>
                  <p className="text-sm font-semibold text-white">{worldName}</p>
                </div>
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-0.5">speed</p>
                  <p className="text-sm font-semibold" style={{ color: getSpeed(score).startScore === 0 ? '#88ccff' : '#88ff88' }}>{speedName}</p>
                </div>
              </div>

              {isConnected && canSubmitScore && deathScore > 0 ? (
                <button
                  onClick={submitScore}
                  disabled={submitting}
                  className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                >
                  {submitting ? 'submitting...' : 'send score on-chain'}
                </button>
              ) : !isConnected ? (
                <button
                  onClick={connectWallet}
                  className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-700 text-white transition-all mb-2"
                >
                  connect wallet to save
                </button>
              ) : null}

              {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

              <button
                onClick={startGame}
                className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
              >
                run it back
              </button>
            </div>
          </div>
        )}

        {/* HUD */}
        {mode === 'playing' && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="px-3.5 py-2 rounded-xl bg-black/50 backdrop-blur-sm border border-white/10">
                <p className="text-white/35 text-[10px] uppercase tracking-wide">score</p>
                <p className="text-xl font-bold text-white font-mono">{score}</p>
              </div>
              {combo > 1 && (
                <div className="px-2.5 py-2 rounded-xl bg-yellow-500/15 backdrop-blur-sm border border-yellow-500/30 animate-pulse">
                  <p className="text-yellow-400 text-xs font-semibold">x{combo}</p>
                </div>
              )}
            </div>

            <div className="absolute top-3 right-3">
              <div className="px-3.5 py-2 rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 text-right">
                <p className="text-white/35 text-[10px] uppercase tracking-wide">{worldName}</p>
                <p className="text-xs font-semibold" style={{ color: getSpeed(score).startScore === 0 ? '#88ccff' : '#88ff88' }}>{speedName}</p>
              </div>
            </div>

            {engineRef.current.slowdownTimer > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-green-500/15 backdrop-blur-sm border border-green-500/30">
                <p className="text-green-400 text-xs font-medium">chill mode</p>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex gap-1">
              {Array.from({ length: getJumps(score) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < engineRef.current.player.maxJumps - engineRef.current.player.jumpCount
                      ? 'bg-blue-500'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="text-white/25 text-[10px]">space / W / ↑ / tap to jump • hold for variable height</p>
      </div>
    </div>
  )
}
