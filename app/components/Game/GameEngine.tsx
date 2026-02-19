/**
 * ============================================================================
 * BASE DASH — Premium Trading-Themed Endless Runner
 * Smooth 60FPS gameplay with beautiful animations
 * ============================================================================
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWriteContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'
import { useWallet } from '@/app/hooks/useWallet'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type GameMode = 'menu' | 'playing' | 'paused' | 'gameover'
type CandleKind = 'red' | 'green'
type ObstacleType = 'single' | 'double' | 'triple' | 'stair' | 'wave'

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
  size: number
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
  scale: number
  squash: number
}

interface Candle {
  id: number
  kind: CandleKind
  x: number
  y: number
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
  collectProgress: number
  scaleAnim: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  color2?: string
  gravity: number
  type: 'spark' | 'glow' | 'star' | 'ring' | 'burst'
  angle: number
  rotationSpeed: number
}

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  depth: number
  twinkle: number
}

interface EngineState {
  player: Player
  candles: Candle[]
  particles: Particle[]
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
  totalCollected: number
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CFG = {
  WIDTH: 960,
  HEIGHT: 540,
  GROUND: 430,
  PLAYER_X: 180,
  PLAYER_SIZE: 42,
  HITBOX: 10,

  STEP: 1 / 60,
  MAX_DELTA: 0.033,
  UI_RATE: 1 / 8,

  GRAVITY: 2800,
  JUMP: -900,
  DOUBLE_JUMP: -750,
  MAX_FALL: 1500,
  COYOTE: 0.1,
  BUFFER: 0.13,
  ROT_SPEED: 9,

  BASE_SPEED: 380,
  MAX_SPEED: 700,
  DOUBLE_JUMP_AT: 150,

  BASE_SPAWN_GAP: 450,
  MIN_SPAWN_GAP: 260,

  RED_SCORE: 10,
  GREEN_SCORE: 5,
  SLOW_MULT: 0.62,
  SLOW_TIME: 2.8,

  PARTICLE_LIMIT: 180,
  TRAIL_LIMIT: 10,
  STAR_COUNT: 70,
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEED TIERS
// ─────────────────────────────────────────────────────────────────────────────

const SPEEDS: SpeedTier[] = [
  { label: 'chill', startScore: 0, multiplier: 1.0 },
  { label: 'warming up', startScore: 200, multiplier: 1.15 },
  { label: 'picking up', startScore: 450, multiplier: 1.35 },
  { label: 'fast af', startScore: 850, multiplier: 1.58 },
  { label: 'degen mode', startScore: 1400, multiplier: 1.85 },
  { label: 'impossible', startScore: 2200, multiplier: 2.15 },
]

// ─────────────────────────────────────────────────────────────────────────────
// WORLDS
// ─────────────────────────────────────────────────────────────────────────────

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
    grid: 'rgba(63,127,255,0.08)',
    redA: '#ff6078', redB: '#ac3348',
    greenA: '#16e79a', greenB: '#0b9f68',
    floorPattern: 'diagonal',
  },
  {
    name: 'data storm',
    startScore: 300,
    skyTop: '#120a20',
    skyMid: '#231341',
    skyBottom: '#3a2166',
    groundTop: '#2d1a4a',
    groundBottom: '#0f0a1a',
    accent: '#a16eff',
    grid: 'rgba(161,110,255,0.08)',
    redA: '#ff7390', redB: '#ba3a59',
    greenA: '#44f5c6', greenB: '#1aa88a',
    floorPattern: 'circuit',
  },
  {
    name: 'bear valley',
    startScore: 750,
    skyTop: '#18090a',
    skyMid: '#321518',
    skyBottom: '#4f2327',
    groundTop: '#4a2025',
    groundBottom: '#1a0a0b',
    accent: '#ff9347',
    grid: 'rgba(255,147,71,0.08)',
    redA: '#ff6f61', redB: '#b43d30',
    greenA: '#70f6ae', greenB: '#2cb06d',
    floorPattern: 'waves',
  },
  {
    name: 'liquid night',
    startScore: 1300,
    skyTop: '#061218',
    skyMid: '#0d2532',
    skyBottom: '#12465a',
    groundTop: '#1a3d4a',
    groundBottom: '#0a151a',
    accent: '#33d1ff',
    grid: 'rgba(51,209,255,0.08)',
    redA: '#ff7ba6', redB: '#b13b61',
    greenA: '#67ffd9', greenB: '#21b89f',
    floorPattern: 'grid',
  },
  {
    name: 'void circuit',
    startScore: 2000,
    skyTop: '#0a0a0a',
    skyMid: '#181818',
    skyBottom: '#262626',
    groundTop: '#2a2a2a',
    groundBottom: '#0a0a0a',
    accent: '#f0b90b',
    grid: 'rgba(240,185,11,0.08)',
    redA: '#ff845e', redB: '#b85a38',
    greenA: '#9cff78', greenB: '#4ca93f',
    floorPattern: 'circuit',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1)
const rand = (min: number, max: number) => Math.random() * (max - min) + min

const getWorld = (score: number) => WORLDS.filter(w => score >= w.startScore).at(-1) || WORLDS[0]
const getSpeed = (score: number) => SPEEDS.filter(s => score >= s.startScore).at(-1) || SPEEDS[0]
const getJumps = (score: number) => score >= CFG.DOUBLE_JUMP_AT ? 2 : 1

// ─────────────────────────────────────────────────────────────────────────────
// CREATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const createStars = (): Star[] =>
  Array.from({ length: CFG.STAR_COUNT }, () => ({
    x: Math.random() * CFG.WIDTH,
    y: Math.random() * (CFG.GROUND - 60),
    size: rand(0.5, 2),
    alpha: rand(0.4, 0.9),
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
  scale: 1,
  squash: 0,
})

const createCandle = (id: number, kind: CandleKind, x: number, height: number, width: number): Candle => {
  const upperWick = height * rand(0.18, 0.26)
  const lowerWick = height * rand(0.08, 0.14)
  const bodyHeight = height - upperWick - lowerWick
  const bodyY = CFG.GROUND - lowerWick - bodyHeight

  return {
    id, kind, x, y: bodyY, width, bodyHeight, bodyY,
    bodyTop: bodyY + bodyHeight,
    wickTop: bodyY - upperWick,
    wickBottom: bodyY + bodyHeight + lowerWick,
    passed: false, collected: false,
    phase: rand(0, Math.PI * 2),
    flickerSpeed: rand(6, 10),
    collectProgress: 0,
    scaleAnim: 1,
  }
}

const createEngine = (): EngineState => {
  const world = WORLDS[0]
  return {
    player: createPlayer(),
    candles: [],
    particles: [],
    stars: createStars(),
    speed: CFG.BASE_SPEED,
    distance: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    slowdownTimer: 0,
    nextSpawnDistance: CFG.BASE_SPAWN_GAP,
    nextCandleId: 1,
    shakeX: 0, shakeY: 0, shakeTimer: 0,
    worldName: world.name,
    worldBannerTimer: 0,
    uiTimer: 0,
    alive: true,
    gameTime: 0,
    totalCollected: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────────────────
  // PARTICLE SYSTEM
  // ───────────────────────────────────────────────────────────────────────────

  const addParticles = useCallback((x: number, y: number, color: string, count: number, type: Particle['type'] = 'spark', spread: number = Math.PI * 2) => {
    const e = engineRef.current
    if (e.particles.length > CFG.PARTICLE_LIMIT) {
      e.particles.splice(0, e.particles.length - CFG.PARTICLE_LIMIT)
    }
    for (let i = 0; i < count; i++) {
      const baseAngle = spread === Math.PI * 2 ? 0 : -spread / 2
      const angle = spread === Math.PI * 2
        ? Math.random() * Math.PI * 2
        : baseAngle + (spread / count) * i + rand(-0.15, 0.15)
      const speed = rand(80, 320)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: rand(2, 5),
        color,
        gravity: type === 'spark' ? 450 : type === 'star' ? 150 : 0,
        type,
        angle,
        rotationSpeed: rand(-4, 4),
      })
    }
  }, [])

  const addRingParticles = useCallback((x: number, y: number, color: string) => {
    const e = engineRef.current
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i
      const speed = rand(100, 180)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: rand(2, 4),
        color,
        gravity: 0,
        type: 'ring',
        angle,
        rotationSpeed: 0,
      })
    }
  }, [])

  const addBurstParticles = useCallback((x: number, y: number, color: string) => {
    const e = engineRef.current
    const count = 16
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2)
      const speed = rand(120, 280)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: rand(2.5, 5.5),
        color,
        gravity: 200,
        type: 'burst',
        angle,
        rotationSpeed: rand(-3, 3),
      })
    }
  }, [])

  // ───────────────────────────────────────────────────────────────────────────
  // GAME HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  const saveBest = useCallback((v: number) => {
    if (v <= highScoreRef.current) return
    highScoreRef.current = v
    setBest(v)
    localStorage.setItem(storageKey, String(v))
  }, [storageKey])

  const shake = useCallback((intensity: number, duration: number = 0.15) => {
    const e = engineRef.current
    e.shakeTimer = Math.max(e.shakeTimer, intensity * duration)
  }, [])

  const stopGame = useCallback((runScore: number) => {
    const e = engineRef.current
    if (!e.alive) return
    e.alive = false
    shake(20, 0.3)
    addBurstParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, e.player.y + CFG.PLAYER_SIZE / 2, '#ff6078')
    setDeathScore(runScore)
    setScore(runScore)
    saveBest(runScore)
    setMode('gameover')
  }, [addBurstParticles, saveBest, shake])

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

  // ───────────────────────────────────────────────────────────────────────────
  // SPAWN PATTERNS - DIVERSE OBSTACLES
  // ───────────────────────────────────────────────────────────────────────────

  const spawnPattern = useCallback((e: EngineState) => {
    const diff = clamp(e.score / 3500, 0, 1)
    const complexity = Math.min(4, Math.floor(e.score / 500))
    const startX = CFG.WIDTH + 130
    const baseH = lerp(75, 115, diff)
    const baseW = lerp(28, 40, diff)

    const push = (offset: number, kind: CandleKind, hM = 1, wM = 1) => {
      e.candles.push(createCandle(
        e.nextCandleId++,
        kind,
        startX + offset,
        baseH * rand(0.88, 1.18) * hM,
        baseW * rand(0.9, 1.12) * wM
      ))
    }

    const roll = Math.random()

    // Разнообразные паттерны препятствий
    if (complexity === 0) {
      if (roll < 0.65) {
        // Одиночная красная
        push(0, 'red')
      } else if (roll < 0.85) {
        // Красная + зелёная сзади
        push(0, 'red', 1.08)
        push(110, 'green')
      } else {
        // Одиночная зелёная
        push(0, 'green')
      }
    } else if (complexity === 1) {
      if (roll < 0.25) {
        // Две красные подряд
        push(0, 'red')
        push(130, 'red', 1.05)
      } else if (roll < 0.45) {
        // Зелёная + красная
        push(0, 'green')
        push(105, 'red', 1.12)
      } else if (roll < 0.65) {
        // Лесенка вверх
        push(0, 'red', 0.92)
        push(115, 'red', 1.15)
      } else if (roll < 0.85) {
        // Три свечи: К-З-К
        push(0, 'red')
        push(95, 'green')
        push(195, 'red', 1.08)
      } else {
        // Волна
        push(0, 'red', 1.1)
        push(100, 'red', 0.88)
        push(200, 'red', 1.12)
      }
    } else if (complexity === 2) {
      if (roll < 0.2) {
        // Три красные
        push(0, 'red', 1.08)
        push(110, 'red', 0.92)
        push(220, 'red', 1.12)
      } else if (roll < 0.4) {
        // Зелёная + две красные
        push(0, 'green')
        push(100, 'red', 1.18)
        push(210, 'red', 0.95)
      } else if (roll < 0.6) {
        // Четыре свечи: З-К-К-З
        push(0, 'green')
        push(95, 'red', 1.12)
        push(195, 'red', 0.95)
        push(295, 'green')
      } else if (roll < 0.8) {
        // Лесенка из 3
        push(0, 'red', 0.88)
        push(105, 'red', 1.08)
        push(215, 'red', 1.22)
      } else {
        // Пять свечей волной
        push(0, 'red', 0.95)
        push(90, 'green')
        push(185, 'red', 1.15)
        push(280, 'red', 0.9)
        push(375, 'green')
      }
    } else {
      // Максимальная сложность
      if (roll < 0.15) {
        // Четыре красные
        push(0, 'red')
        push(100, 'red', 1.08)
        push(200, 'red', 0.92)
        push(300, 'red', 1.15)
      } else if (roll < 0.3) {
        // Шесть свечей
        push(0, 'green')
        push(85, 'red', 1.15)
        push(175, 'red', 0.95)
        push(265, 'red', 1.1)
        push(355, 'green')
      } else if (roll < 0.5) {
        // Двойная лесенка
        push(0, 'red', 0.9)
        push(95, 'red', 1.12)
        push(195, 'red', 0.88)
        push(290, 'red', 1.18)
      } else if (roll < 0.7) {
        // Волна из 5
        push(0, 'red', 1.05)
        push(88, 'green')
        push(180, 'red', 1.18)
        push(270, 'red', 0.92)
        push(360, 'green')
      } else {
        // Смешанный паттерн
        push(0, 'red', 0.95)
        push(92, 'red', 1.1)
        push(188, 'green')
        push(285, 'red', 1.15)
        push(380, 'red', 0.88)
      }
    }

    const gap = lerp(CFG.BASE_SPAWN_GAP, CFG.MIN_SPAWN_GAP, diff)
    e.nextSpawnDistance = e.distance + gap * rand(0.92, 1.08)
  }, [])

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ───────────────────────────────────────────────────────────────────────────

  const update = useCallback((dt: number) => {
    const e = engineRef.current
    if (!e.alive) return

    e.gameTime += dt
    const p = e.player

    // Speed
    const tier = getSpeed(e.score)
    const diffMult = lerp(1, 1.38, clamp(e.score / 3500, 0, 1))
    let targetSpeed = CFG.BASE_SPEED * tier.multiplier * diffMult
    targetSpeed = Math.min(targetSpeed, CFG.MAX_SPEED)

    if (e.slowdownTimer > 0) {
      e.slowdownTimer = Math.max(0, e.slowdownTimer - dt)
      const mix = clamp(e.slowdownTimer / CFG.SLOW_TIME, 0, 1)
      targetSpeed *= lerp(1, CFG.SLOW_MULT, mix)
    }

    e.speed = lerp(e.speed, targetSpeed, dt * 3.5)
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
      p.squash = -0.15

      if (p.jumpCount === 1) {
        addParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, CFG.GROUND - 2, '#ffffff', 10, 'spark', Math.PI)
      } else {
        addRingParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, p.y + CFG.PLAYER_SIZE, '#88ccff')
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
      p.squash = lerp(p.squash, 0, dt * 8)
    } else {
      p.onGround = false
      p.rotation += CFG.ROT_SPEED * dt
      p.squash = lerp(p.squash, 0.05, dt * 3)
    }

    p.scale = lerp(p.scale, 1 + p.squash * 0.3, dt * 10)

    // Trail
    if (e.gameTime % 0.035 < dt) {
      p.trail.push({ x: CFG.PLAYER_X, y: p.y, life: 0.4, alpha: 0.5, size: CFG.PLAYER_SIZE * p.scale })
      if (p.trail.length > CFG.TRAIL_LIMIT) p.trail.shift()
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= 0.07
      if (p.trail[i].life <= 0) p.trail.splice(i, 1)
    }

    // Spawn
    if (e.distance >= e.nextSpawnDistance) spawnPattern(e)

    // Candles
    const pad = CFG.HITBOX
    const px = CFG.PLAYER_X + pad
    const py = p.y + pad
    const ps = CFG.PLAYER_SIZE - pad * 2

    for (let i = e.candles.length - 1; i >= 0; i--) {
      const c = e.candles[i]
      c.x -= e.speed * dt
      c.phase += c.flickerSpeed * dt

      // Collect animation
      if (c.collected && c.collectProgress < 1) {
        c.collectProgress += dt * 8
        c.scaleAnim = 1 + Math.sin(c.collectProgress * Math.PI) * 0.3
        c.y = (c.bodyY || 0) - c.collectProgress * 40
      }

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
        e.totalCollected++

        // Красивая анимация сбора
        addRingParticles(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, '#16e79a')
        addBurstParticles(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, '#44f5c6')
        shake(6, 0.12)
      }
    }

    // Particles
    for (let i = e.particles.length - 1; i >= 0; i--) {
      const pt = e.particles[i]
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += pt.gravity * dt
      pt.vx *= 0.96
      pt.vy *= 0.96
      pt.life -= 0.028
      pt.size *= 0.985
      if (pt.life <= 0) e.particles.splice(i, 1)
    }

    // Stars
    for (const s of e.stars) {
      s.x -= e.speed * 0.025 * s.depth * dt
      s.twinkle += 2 * dt
      if (s.x < -10) { s.x = CFG.WIDTH + 10; s.y = rand(15, CFG.GROUND - 50) }
    }

    // World transition
    const world = getWorld(e.score)
    if (world.name !== e.worldName) {
      e.worldName = world.name
      e.worldBannerTimer = 2.2
      shake(10, 0.2)
      addRingParticles(CFG.WIDTH / 2, 80, world.accent)
    } else if (e.worldBannerTimer > 0) {
      e.worldBannerTimer -= dt
    }

    // Shake
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
  }, [addParticles, addRingParticles, addBurstParticles, shake, spawnPattern, stopGame])

  // ───────────────────────────────────────────────────────────────────────────
  // DRAW
  // ───────────────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const e = engineRef.current
    const w = getWorld(e.score)

    ctx.fillStyle = w.skyBottom
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT)

    ctx.save()
    if (e.shakeTimer > 0) ctx.translate(e.shakeX, e.shakeY)

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CFG.GROUND)
    skyGrad.addColorStop(0, w.skyTop)
    skyGrad.addColorStop(0.55, w.skyMid)
    skyGrad.addColorStop(1, w.skyBottom)
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.GROUND)

    // Stars
    ctx.globalAlpha = 0.75
    ctx.fillStyle = '#ffffff'
    for (const s of e.stars) {
      const alpha = (s.alpha + Math.sin(s.twinkle) * 0.12) * 0.65
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * 0.75, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Grid
    ctx.strokeStyle = w.grid
    ctx.lineWidth = 1
    const off = (e.distance * 0.1) % 55
    for (let x = -off; x <= CFG.WIDTH; x += 55) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CFG.GROUND)
      ctx.stroke()
    }

    // Ground
    ctx.fillStyle = w.groundTop
    ctx.fillRect(0, CFG.GROUND, CFG.WIDTH, CFG.HEIGHT - CFG.GROUND)

    // Ground line
    ctx.strokeStyle = w.accent
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, CFG.GROUND)
    ctx.lineTo(CFG.WIDTH, CFG.GROUND)
    ctx.stroke()

    // Floor pattern
    const fOff = (e.distance * 0.38) % 48
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    for (let x = -fOff; x < CFG.WIDTH + 48; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, CFG.GROUND)
      ctx.lineTo(x + 24, CFG.GROUND + 14)
      ctx.lineTo(x + 48, CFG.GROUND)
      ctx.closePath()
      ctx.fill()
    }

    // Candles
    for (const c of e.candles) {
      if (c.collected && c.collectProgress >= 1) continue
      const isRed = c.kind === 'red'
      const a = isRed ? w.redA : w.greenA
      const b = isRed ? w.redB : w.greenB
      const flicker = 0.85 + Math.sin(c.phase) * 0.15

      // Wick
      ctx.strokeStyle = a
      ctx.lineWidth = Math.max(2.2, c.width * 0.13)
      ctx.globalAlpha = flicker * 0.6
      ctx.beginPath()
      ctx.moveTo(c.x + c.width / 2, c.wickTop)
      ctx.lineTo(c.x + c.width / 2, c.wickBottom)
      ctx.stroke()
      ctx.globalAlpha = 1

      // Body
      const bodyGrad = ctx.createLinearGradient(c.x, c.bodyY, c.x, c.bodyY + c.bodyHeight)
      bodyGrad.addColorStop(0, a)
      bodyGrad.addColorStop(1, b)
      ctx.fillStyle = bodyGrad

      const drawY = c.collected ? c.y : c.bodyY
      const scale = c.scaleAnim
      const scaledW = c.width * scale
      const scaledH = c.bodyHeight * scale
      const scaledX = c.x + (c.width - scaledW) / 2
      const scaledY = drawY + (c.bodyHeight - scaledH) / 2

      ctx.fillRect(scaledX, scaledY, scaledW, scaledH)

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.16)'
      ctx.fillRect(scaledX + 3, scaledY + 2, scaledW * 0.18, scaledH - 4)

      // Collection glow
      if (c.collected && c.collectProgress < 1) {
        ctx.globalAlpha = (1 - c.collectProgress) * 0.6
        ctx.fillStyle = isRed ? w.redA : w.greenA
        ctx.beginPath()
        ctx.arc(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, c.width * (1.5 + c.collectProgress * 2), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    // Trail
    for (const t of e.player.trail) {
      ctx.globalAlpha = t.alpha * t.life * 0.55
      if (logoLoaded && logoRef.current) {
        ctx.drawImage(logoRef.current, t.x, t.y, t.size, t.size)
      } else {
        ctx.fillStyle = w.accent
        ctx.fillRect(t.x, t.y, t.size, t.size)
      }
    }
    ctx.globalAlpha = 1

    // Player
    ctx.save()
    ctx.translate(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, e.player.y + CFG.PLAYER_SIZE / 2)
    ctx.rotate(e.player.rotation)
    ctx.scale(e.player.scale, e.player.scale)

    if (logoLoaded && logoRef.current) {
      ctx.drawImage(logoRef.current, -CFG.PLAYER_SIZE / 2, -CFG.PLAYER_SIZE / 2, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-CFG.PLAYER_SIZE / 2, -CFG.PLAYER_SIZE / 2, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
      ctx.fillStyle = w.accent
      ctx.fillRect(-CFG.PLAYER_SIZE / 2 + 6, -CFG.PLAYER_SIZE / 2 + 6, CFG.PLAYER_SIZE - 12, CFG.PLAYER_SIZE - 12)
    }

    // Invincibility flash
    if (e.player.invincible > 0 && Math.floor(e.gameTime * 18) % 2 === 0) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(-CFG.PLAYER_SIZE / 2 - 2, -CFG.PLAYER_SIZE / 2 - 2, CFG.PLAYER_SIZE + 4, CFG.PLAYER_SIZE + 4)
    }

    ctx.restore()

    // Particles
    for (const pt of e.particles) {
      ctx.save()
      ctx.globalAlpha = clamp(pt.life, 0, 1)
      ctx.translate(pt.x, pt.y)
      ctx.rotate(pt.angle + pt.rotationSpeed * (1 - pt.life))
      ctx.fillStyle = pt.color

      if (pt.type === 'ring') {
        ctx.beginPath()
        ctx.arc(0, 0, pt.size * pt.life * 1.2, 0, Math.PI * 2)
        ctx.fill()
      } else if (pt.type === 'burst') {
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size * pt.life, pt.size * pt.life)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, pt.size * Math.max(0.5, pt.life), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // World banner
    if (e.worldBannerTimer > 0) {
      const alpha = clamp(e.worldBannerTimer / 2.2, 0, 1)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      const bw = 270, bh = 50
      const bx = CFG.WIDTH / 2 - bw / 2, by = 40
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = w.accent
      ctx.lineWidth = 2.5
      ctx.strokeRect(bx, by, bw, bh)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(w.name, CFG.WIDTH / 2, by + bh / 2 + 2)
      ctx.restore()
    }

    ctx.restore()
  }, [logoLoaded])

  // ───────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
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

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

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
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/5">
        <canvas
          ref={canvasRef}
          width={CFG.WIDTH}
          height={CFG.HEIGHT}
          className="w-full bg-[#0a0b14] cursor-pointer"
          onClick={handleAction}
          tabIndex={0}
        />

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
                <p className="text-green-400 text-xs font-medium mb-1.5">how to play</p>
                <ul className="text-white/50 text-[11px] space-y-1 text-left">
                  <li>🕯️ <span className="text-red-400">red candles</span> = instant rekt</li>
                  <li>🕯️ <span className="text-green-400">green candles</span> = chill mode + points</li>
                  <li>⚡ double jump at 150 pts</li>
                </ul>
              </div>
            </div>
          </div>
        )}

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
