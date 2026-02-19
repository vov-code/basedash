/**
 * ============================================================================
 * BASE DASH — Premium Geometry Dash-Style Endless Runner
 * Trading-Themed with Candle Obstacles
 * 
 * Features:
 * - Smooth 60FPS gameplay with advanced physics
 * - Multiple game modes and worlds
 * - Trading candle obstacles (red = death, green = slowdown)
 * - Beautiful particle effects and animations
 * - Procedural obstacle generation
 * - On-chain score submission
 * 
 * @version 4.0.0
 * @author Base Dash Team
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
type ObstaclePattern = 'single' | 'double' | 'triple' | 'stair' | 'wave' | 'pyramid' | 'gap'
type ParticleType = 'spark' | 'glow' | 'star' | 'ring' | 'burst' | 'trail' | 'coin' | 'smoke'

// ============================================================================
// WORLD THEMES
// ============================================================================

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
  floorPattern: 'diagonal' | 'circuit' | 'waves' | 'grid' | 'neon'
  backgroundElements: ('building' | 'cloud' | 'mountain' | 'crystal' | 'orb')[]
}

const WORLDS: WorldTheme[] = [
  {
    name: 'Foundation',
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
    backgroundElements: ['building', 'cloud', 'orb'],
  },
  {
    name: 'Data Storm',
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
    backgroundElements: ['crystal', 'orb', 'cloud'],
  },
  {
    name: 'Bear Valley',
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
    backgroundElements: ['mountain', 'cloud', 'crystal'],
  },
  {
    name: 'Liquid Night',
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
    backgroundElements: ['orb', 'crystal', 'cloud'],
  },
  {
    name: 'Void Circuit',
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
    floorPattern: 'neon',
    backgroundElements: ['building', 'crystal', 'orb'],
  },
  {
    name: 'Neon Horizon',
    startScore: 2800,
    skyTop: '#1a0a28',
    skyMid: '#2a1540',
    skyBottom: '#4a2560',
    groundTop: '#3a1a50',
    groundBottom: '#150a20',
    accent: '#ff00ff',
    grid: 'rgba(255,0,255,0.08)',
    redA: '#ff5577', redB: '#aa3355',
    greenA: '#55ffaa', greenB: '#33aa77',
    floorPattern: 'neon',
    backgroundElements: ['building', 'orb', 'crystal'],
  },
  {
    name: 'Quantum Realm',
    startScore: 3800,
    skyTop: '#0a1a0a',
    skyMid: '#153015',
    skyBottom: '#204520',
    groundTop: '#255025',
    groundBottom: '#0a150a',
    accent: '#00ff88',
    grid: 'rgba(0,255,136,0.08)',
    redA: '#ff6688', redB: '#aa4455',
    greenA: '#88ffcc', greenB: '#44cc99',
    floorPattern: 'grid',
    backgroundElements: ['crystal', 'orb', 'mountain'],
  },
]

// ============================================================================
// SPEED TIERS
// ============================================================================

interface SpeedTier {
  label: string
  startScore: number
  multiplier: number
  color: string
}

const SPEEDS: SpeedTier[] = [
  { label: 'Chill', startScore: 0, multiplier: 1.0, color: '#88ccff' },
  { label: 'Warming Up', startScore: 200, multiplier: 1.12, color: '#88ff88' },
  { label: 'Picking Up', startScore: 450, multiplier: 1.28, color: '#ffff88' },
  { label: 'Fast AF', startScore: 850, multiplier: 1.48, color: '#ffcc88' },
  { label: 'Degen Mode', startScore: 1400, multiplier: 1.72, color: '#ff8888' },
  { label: 'Impossible', startScore: 2200, multiplier: 2.0, color: '#ff88ff' },
  { label: 'GOD MODE', startScore: 3200, multiplier: 2.35, color: '#88ffff' },
]

// ============================================================================
// CONFIGURATION
// ============================================================================

const CFG = {
  // Canvas
  WIDTH: 960,
  HEIGHT: 540,
  GROUND: 430,
  
  // Player
  PLAYER_X: 180,
  PLAYER_SIZE: 42,
  HITBOX: 10,
  
  // Physics
  STEP: 1 / 60,
  MAX_DELTA: 0.033,
  UI_RATE: 1 / 8,
  
  GRAVITY: 2900,
  JUMP: -920,
  DOUBLE_JUMP: -780,
  MAX_FALL: 1550,
  COYOTE: 0.11,
  BUFFER: 0.14,
  ROT_SPEED: 9.5,
  
  // Speed
  BASE_SPEED: 400,
  MAX_SPEED: 750,
  SPEED_INCREMENT: 22,
  DOUBLE_JUMP_AT: 150,
  
  // Spawning
  BASE_SPAWN_GAP: 460,
  MIN_SPAWN_GAP: 270,
  GAP_DECREASE: 0.075,
  
  // Scoring
  RED_SCORE: 10,
  GREEN_SCORE: 5,
  SLOW_MULT: 0.58,
  SLOW_TIME: 2.2,
  
  // Effects
  PARTICLE_LIMIT: 220,
  TRAIL_LIMIT: 12,
  STAR_COUNT: 80,
  BG_ELEMENT_COUNT: 12,
}

// ============================================================================
// INTERFACES
// ============================================================================

interface TrailPoint {
  x: number
  y: number
  life: number
  alpha: number
  size: number
  rotation: number
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
  flash: number
}

interface Candle {
  id: number
  kind: CandleKind
  x: number
  y: number
  width: number
  height: number
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
  rotation: number
  targetY: number
  moveSpeed: number
  movePhase: number
  isMoving: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  targetSize: number
  color: string
  color2?: string
  gravity: number
  type: ParticleType
  angle: number
  rotation: number
  rotationSpeed: number
  friction: number
}

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  depth: number
  twinkle: number
  twinkleSpeed: number
  color: string
}

interface BackgroundElement {
  type: 'building' | 'cloud' | 'mountain' | 'crystal' | 'orb'
  x: number
  y: number
  width: number
  height: number
  color: string
  alpha: number
  phase: number
  speed: number
}

interface EngineState {
  player: Player
  candles: Candle[]
  particles: Particle[]
  stars: Star[]
  backgroundElements: BackgroundElement[]
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
  totalJumps: number
  distanceTraveled: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp(t, 0, 1)
const lerpAngle = (a: number, b: number, t: number): number => {
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * clamp(t, 0, 1)
}
const rand = (min: number, max: number): number => Math.random() * (max - min) + min
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1))

const getWorld = (score: number): WorldTheme => WORLDS.filter(w => score >= w.startScore).at(-1) || WORLDS[0]
const getSpeed = (score: number): SpeedTier => SPEEDS.filter(s => score >= s.startScore).at(-1) || SPEEDS[0]
const getJumps = (score: number): number => score >= CFG.DOUBLE_JUMP_AT ? 2 : 1

// ============================================================================
// CREATION FUNCTIONS
// ============================================================================

const createStars = (count: number = CFG.STAR_COUNT): Star[] =>
  Array.from({ length: count }, () => ({
    x: Math.random() * CFG.WIDTH,
    y: Math.random() * (CFG.GROUND - 60),
    size: rand(0.5, 2.2),
    alpha: rand(0.4, 0.9),
    depth: rand(0.2, 0.95),
    twinkle: rand(0, Math.PI * 2),
    twinkleSpeed: rand(1.5, 3.5),
    color: rand(0, 1) > 0.9 ? '#aaccff' : rand(0, 1) > 0.85 ? '#ffddaa' : '#ffffff',
  }))

const createBackgroundElements = (world: WorldTheme, count: number = CFG.BG_ELEMENT_COUNT): BackgroundElement[] =>
  Array.from({ length: count }, () => {
    const type = world.backgroundElements[randInt(0, world.backgroundElements.length - 1)]
    return {
      type,
      x: rand(0, CFG.WIDTH),
      y: rand(80, CFG.GROUND - 100),
      width: rand(40, 120),
      height: rand(60, 180),
      color: world.accent,
      alpha: rand(0.12, 0.28),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.02, 0.05),
    }
  })

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
  flash: 0,
})

const createCandle = (id: number, kind: CandleKind, x: number, height: number, width: number, isMoving = false): Candle => {
  const upperWick = height * rand(0.18, 0.26)
  const lowerWick = height * rand(0.08, 0.14)
  const bodyHeight = height - upperWick - lowerWick
  const bodyY = CFG.GROUND - lowerWick - bodyHeight

  return {
    id, kind, x, y: bodyY, width, height, bodyHeight, bodyY,
    bodyTop: bodyY + bodyHeight,
    wickTop: bodyY - upperWick,
    wickBottom: bodyY + bodyHeight + lowerWick,
    passed: false, collected: false,
    phase: rand(0, Math.PI * 2),
    flickerSpeed: rand(6, 11),
    collectProgress: 0,
    scaleAnim: 1,
    rotation: 0,
    targetY: bodyY,
    moveSpeed: isMoving ? rand(30, 60) : 0,
    movePhase: rand(0, Math.PI * 2),
    isMoving,
  }
}

const createEngine = (): EngineState => {
  const world = WORLDS[0]
  return {
    player: createPlayer(),
    candles: [],
    particles: [],
    stars: createStars(),
    backgroundElements: createBackgroundElements(world),
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
    totalJumps: 0,
    distanceTraveled: 0,
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
  // PARTICLE SYSTEM
  // ──────────────────────────────────────────────────────────────────────────

  const addParticles = useCallback((
    x: number, y: number, color: string, count: number,
    type: ParticleType = 'spark', spread: number = Math.PI * 2,
    speedMin: number = 80, speedMax: number = 320
  ) => {
    const e = engineRef.current
    if (e.particles.length > CFG.PARTICLE_LIMIT) {
      e.particles.splice(0, e.particles.length - CFG.PARTICLE_LIMIT)
    }
    for (let i = 0; i < count; i++) {
      const baseAngle = spread === Math.PI * 2 ? 0 : -spread / 2
      const angle = spread === Math.PI * 2
        ? Math.random() * Math.PI * 2
        : baseAngle + (spread / count) * i + rand(-0.12, 0.12)
      const speed = rand(speedMin, speedMax)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        size: rand(2, 5.5),
        targetSize: rand(1, 3),
        color, color2: undefined,
        gravity: type === 'spark' ? 480 : type === 'coin' ? 180 : type === 'star' ? 150 : 0,
        type,
        angle,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-4, 4),
        friction: 0.965,
      })
    }
  }, [])

  const addRingParticles = useCallback((x: number, y: number, color: string, count: number = 12) => {
    const e = engineRef.current
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i
      const speed = rand(100, 180)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        size: rand(2, 4),
        targetSize: 2,
        color,
        gravity: 0,
        type: 'ring',
        angle,
        rotation: 0,
        rotationSpeed: 0,
        friction: 0.97,
      })
    }
  }, [])

  const addBurstParticles = useCallback((x: number, y: number, color: string, count: number = 18) => {
    const e = engineRef.current
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2)
      const speed = rand(130, 300)
      e.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        size: rand(2.5, 6),
        targetSize: 2,
        color,
        gravity: 220,
        type: 'burst',
        angle,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-3, 3),
        friction: 0.955,
      })
    }
  }, [])

  const addTrailParticles = useCallback((x: number, y: number, color: string) => {
    const e = engineRef.current
    e.particles.push({
      x, y,
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      life: 1, maxLife: 1,
      size: rand(3, 6),
      targetSize: 1,
      color,
      gravity: 0,
      type: 'trail',
      angle: 0,
      rotation: 0,
      rotationSpeed: 0,
      friction: 0.92,
    })
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // GAME HELPERS
  // ──────────────────────────────────────────────────────────────────────────

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
    shake(22, 0.35)
    addBurstParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, e.player.y + CFG.PLAYER_SIZE / 2, '#ff6078', 25)
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

  // ──────────────────────────────────────────────────────────────────────────
  // SPAWN PATTERNS
  // ──────────────────────────────────────────────────────────────────────────

  const spawnPattern = useCallback((e: EngineState) => {
    const diff = clamp(e.score / 4000, 0, 1)
    const complexity = Math.min(5, Math.floor(e.score / 550))
    const startX = CFG.WIDTH + 140
    const baseH = lerp(78, 118, diff)
    const baseW = lerp(30, 42, diff)

    const push = (offset: number, kind: CandleKind, hM = 1, wM = 1, isMoving = false) => {
      e.candles.push(createCandle(
        e.nextCandleId++,
        kind,
        startX + offset,
        baseH * rand(0.88, 1.18) * hM,
        baseW * rand(0.92, 1.12) * wM,
        isMoving
      ))
    }

    const roll = Math.random()

    // Разнообразные паттерны препятствий
    if (complexity === 0) {
      if (roll < 0.62) {
        push(0, 'red')
      } else if (roll < 0.82) {
        push(0, 'red', 1.08)
        push(115, 'green')
      } else if (roll < 0.92) {
        push(0, 'green')
      } else {
        push(0, 'red', 1, 1, true) // Движущаяся
      }
    } else if (complexity === 1) {
      if (roll < 0.22) {
        push(0, 'red')
        push(135, 'red', 1.06)
      } else if (roll < 0.42) {
        push(0, 'green')
        push(110, 'red', 1.12)
      } else if (roll < 0.62) {
        push(0, 'red', 0.92)
        push(120, 'red', 1.15)
      } else if (roll < 0.82) {
        push(0, 'red')
        push(100, 'green')
        push(205, 'red', 1.08)
      } else {
        push(0, 'red', 1.1)
        push(105, 'red', 0.9)
        push(210, 'red', 1.12)
      }
    } else if (complexity === 2) {
      if (roll < 0.18) {
        push(0, 'red', 1.08)
        push(115, 'red', 0.92)
        push(230, 'red', 1.12)
      } else if (roll < 0.36) {
        push(0, 'green')
        push(105, 'red', 1.18)
        push(220, 'red', 0.95)
      } else if (roll < 0.54) {
        push(0, 'green')
        push(100, 'red', 1.12)
        push(205, 'red', 0.95)
        push(310, 'green')
      } else if (roll < 0.72) {
        push(0, 'red', 0.88)
        push(110, 'red', 1.08)
        push(225, 'red', 1.22)
      } else if (roll < 0.9) {
        push(0, 'red', 0.95)
        push(95, 'green')
        push(195, 'red', 1.15)
        push(295, 'red', 0.9)
      } else {
        push(0, 'red', 1, 1, true)
        push(120, 'red', 1.08)
        push(240, 'green')
      }
    } else if (complexity === 3) {
      if (roll < 0.15) {
        push(0, 'red')
        push(105, 'red', 1.08)
        push(215, 'red', 0.92)
        push(325, 'red', 1.15)
      } else if (roll < 0.3) {
        push(0, 'green')
        push(90, 'red', 1.15)
        push(185, 'red', 0.95)
        push(280, 'red', 1.1)
        push(375, 'green')
      } else if (roll < 0.45) {
        push(0, 'red', 0.9)
        push(100, 'red', 1.12)
        push(205, 'red', 0.88)
        push(305, 'red', 1.18)
      } else if (roll < 0.6) {
        push(0, 'red', 1.05)
        push(92, 'green')
        push(190, 'red', 1.18)
        push(285, 'red', 0.92)
        push(380, 'green')
      } else if (roll < 0.75) {
        push(0, 'red', 0.95)
        push(95, 'red', 1.1)
        push(195, 'green')
        push(295, 'red', 1.15)
        push(395, 'red', 0.88)
      } else {
        push(0, 'red', 1, 1, true)
        push(110, 'red', 1.08)
        push(220, 'red', 0.92)
        push(330, 'green')
      }
    } else {
      // Максимальная сложность
      if (roll < 0.12) {
        push(0, 'red')
        push(95, 'red', 1.08)
        push(195, 'red', 0.92)
        push(290, 'red', 1.15)
        push(390, 'red', 0.88)
      } else if (roll < 0.24) {
        push(0, 'green')
        push(85, 'red', 1.15)
        push(175, 'red', 0.95)
        push(270, 'red', 1.1)
        push(365, 'green')
        push(460, 'red', 1.05)
      } else if (roll < 0.4) {
        push(0, 'red', 0.92)
        push(90, 'red', 1.12)
        push(185, 'green')
        push(285, 'red', 1.15)
        push(385, 'red', 0.88)
        push(480, 'green')
      } else if (roll < 0.55) {
        push(0, 'red', 1, 1, true)
        push(105, 'red', 1.08)
        push(210, 'red', 0.92)
        push(315, 'red', 1.12)
        push(420, 'green')
      } else if (roll < 0.7) {
        push(0, 'red', 0.88)
        push(88, 'red', 1.15)
        push(180, 'red', 0.92)
        push(270, 'green')
        push(365, 'red', 1.18)
        push(460, 'red', 0.85)
      } else {
        push(0, 'green')
        push(95, 'red', 1.12)
        push(190, 'red', 0.95)
        push(285, 'red', 1.08)
        push(380, 'green')
        push(475, 'red', 1.15)
      }
    }

    const gap = lerp(CFG.BASE_SPAWN_GAP, CFG.MIN_SPAWN_GAP, diff)
    e.nextSpawnDistance = e.distance + gap * rand(0.93, 1.07)
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────

  const update = useCallback((dt: number) => {
    const e = engineRef.current
    if (!e.alive) return

    e.gameTime += dt
    e.distanceTraveled += e.speed * dt
    const p = e.player

    // Speed calculation
    const tier = getSpeed(e.score)
    const diffMult = lerp(1, 1.42, clamp(e.score / 4000, 0, 1))
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
    p.flash = Math.max(0, p.flash - dt)

    // Jump
    if (p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0)) {
      const vel = p.jumpCount === 0 ? CFG.JUMP : CFG.DOUBLE_JUMP
      p.velocityY = vel
      p.onGround = false
      p.jumpCount++
      p.jumpBufferTimer = 0
      p.coyoteTimer = 0
      p.squash = -0.18
      p.flash = 0.08

      e.totalJumps++

      if (p.jumpCount === 1) {
        addParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, CFG.GROUND - 2, '#ffffff', 12, 'spark', Math.PI, 80, 240)
        addTrailParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, CFG.GROUND - 5, '#88ccff')
      } else {
        addRingParticles(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, p.y + CFG.PLAYER_SIZE, '#88ccff', 14)
      }
    }

    // Gravity
    p.velocityY = Math.min(CFG.MAX_FALL, p.velocityY + CFG.GRAVITY * dt)
    p.y += p.velocityY * dt

    // Ground collision
    if (p.y >= CFG.GROUND - CFG.PLAYER_SIZE) {
      p.y = CFG.GROUND - CFG.PLAYER_SIZE
      p.velocityY = 0
      p.onGround = true
      p.jumpCount = 0
      p.maxJumps = getJumps(e.score)
      const targetRot = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2)
      p.rotation = lerpAngle(p.rotation, targetRot, dt * 13)
      p.squash = lerp(p.squash, 0, dt * 9)
    } else {
      p.onGround = false
      p.rotation += CFG.ROT_SPEED * dt
      p.squash = lerp(p.squash, 0.06, dt * 3.5)
    }

    p.scale = lerp(p.scale, 1 + p.squash * 0.35, dt * 11)

    // Trail
    if (e.gameTime % 0.032 < dt) {
      p.trail.push({
        x: CFG.PLAYER_X,
        y: p.y,
        life: 0.45,
        alpha: 0.55,
        size: CFG.PLAYER_SIZE * p.scale,
        rotation: p.rotation,
      })
      if (p.trail.length > CFG.TRAIL_LIMIT) p.trail.shift()
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= 0.075
      if (p.trail[i].life <= 0) p.trail.splice(i, 1)
    }

    // Spawn
    if (e.distance >= e.nextSpawnDistance) spawnPattern(e)

    // Update candles
    const pad = CFG.HITBOX
    const px = CFG.PLAYER_X + pad
    const py = p.y + pad
    const ps = CFG.PLAYER_SIZE - pad * 2

    for (let i = e.candles.length - 1; i >= 0; i--) {
      const c = e.candles[i]
      
      // Moving candle logic
      if (c.isMoving) {
        c.movePhase += dt * 2.5
        c.targetY = c.bodyY + Math.sin(c.movePhase) * 25
        c.y = lerp(c.y, c.targetY, dt * 3)
      }

      c.x -= e.speed * dt
      c.phase += c.flickerSpeed * dt

      // Collect animation
      if (c.collected && c.collectProgress < 1) {
        c.collectProgress += dt * 7
        c.scaleAnim = 1 + Math.sin(c.collectProgress * Math.PI) * 0.35
        c.y = c.bodyY - c.collectProgress * 45
        c.rotation += dt * 8
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

      if (c.x + c.width < -85) { e.candles.splice(i, 1); continue }

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

        addRingParticles(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, '#16e79a', 14)
        addBurstParticles(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, '#44f5c6', 20)
        shake(7, 0.13)
      }
    }

    // Update particles
    for (let i = e.particles.length - 1; i >= 0; i--) {
      const pt = e.particles[i]
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += pt.gravity * dt
      pt.vx *= pt.friction
      pt.vy *= pt.friction
      pt.life -= 0.026
      pt.size = lerp(pt.size, pt.targetSize, dt * 4)
      pt.rotation += pt.rotationSpeed * dt
      if (pt.life <= 0) e.particles.splice(i, 1)
    }

    // Update stars
    for (const s of e.stars) {
      s.x -= e.speed * 0.022 * s.depth * dt
      s.twinkle += s.twinkleSpeed * dt
      if (s.x < -10) { s.x = CFG.WIDTH + 10; s.y = rand(15, CFG.GROUND - 50) }
    }

    // Update background elements
    for (const elem of e.backgroundElements) {
      elem.x -= e.speed * elem.speed * dt
      elem.phase += elem.speed * dt
      if (elem.x < -elem.width) {
        elem.x = CFG.WIDTH + rand(0, 150)
        elem.y = rand(80, CFG.GROUND - 100)
      }
    }

    // World transition
    const world = getWorld(e.score)
    if (world.name !== e.worldName) {
      e.worldName = world.name
      e.worldBannerTimer = 2.4
      e.backgroundElements = createBackgroundElements(world)
      shake(12, 0.22)
      addRingParticles(CFG.WIDTH / 2, 85, world.accent, 16)
    } else if (e.worldBannerTimer > 0) {
      e.worldBannerTimer -= dt
    }

    // Camera shake
    if (e.shakeTimer > 0) {
      e.shakeTimer -= dt
      const intensity = e.shakeTimer * 1.6
      e.shakeX = (Math.random() - 0.5) * intensity
      e.shakeY = (Math.random() - 0.5) * intensity
    } else {
      e.shakeX = 0
      e.shakeY = 0
    }

    // UI update
    e.uiTimer += dt
    if (e.uiTimer > CFG.UI_RATE) {
      e.uiTimer = 0
      setScore(e.score)
      setCombo(e.combo)
      setWorldName(world.name)
      setSpeedName(tier.label)
    }
  }, [addParticles, addRingParticles, addBurstParticles, addTrailParticles, shake, spawnPattern, stopGame])

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW
  // ──────────────────────────────────────────────────────────────────────────

  const drawBackgroundElement = useCallback((
    ctx: CanvasRenderingContext2D,
    elem: BackgroundElement,
    world: WorldTheme
  ) => {
    ctx.save()
    ctx.globalAlpha = elem.alpha * (0.75 + Math.sin(elem.phase) * 0.25)

    switch (elem.type) {
      case 'building':
        const buildingGrad = ctx.createLinearGradient(elem.x, elem.y, elem.x, elem.y + elem.height)
        buildingGrad.addColorStop(0, world.accent)
        buildingGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = buildingGrad
        ctx.fillRect(elem.x, elem.y, elem.width, elem.height)
        // Windows
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        for (let wy = elem.y + 12; wy < elem.y + elem.height - 12; wy += 16) {
          for (let wx = elem.x + 10; wx < elem.x + elem.width - 10; wx += 14) {
            if ((wx + wy) % 7 > 2) ctx.fillRect(wx, wy, 7, 11)
          }
        }
        break

      case 'cloud':
        const cloudGrad = ctx.createRadialGradient(
          elem.x + elem.width / 2, elem.y + elem.height / 2, 0,
          elem.x + elem.width / 2, elem.y + elem.height / 2, elem.width
        )
        cloudGrad.addColorStop(0, world.accent + '35')
        cloudGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = cloudGrad
        ctx.beginPath()
        ctx.ellipse(elem.x + elem.width / 2, elem.y + elem.height / 2, elem.width / 2, elem.height / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'mountain':
        ctx.fillStyle = world.groundTop + '55'
        ctx.beginPath()
        ctx.moveTo(elem.x, elem.y + elem.height)
        ctx.lineTo(elem.x + elem.width / 2, elem.y)
        ctx.lineTo(elem.x + elem.width, elem.y + elem.height)
        ctx.closePath()
        ctx.fill()
        break

      case 'crystal':
        const crystalGrad = ctx.createLinearGradient(elem.x, elem.y, elem.x + elem.width, elem.y + elem.height)
        crystalGrad.addColorStop(0, world.accent)
        crystalGrad.addColorStop(1, world.accent + '40')
        ctx.fillStyle = crystalGrad
        ctx.beginPath()
        ctx.moveTo(elem.x + elem.width / 2, elem.y)
        ctx.lineTo(elem.x + elem.width, elem.y + elem.height * 0.65)
        ctx.lineTo(elem.x + elem.width / 2, elem.y + elem.height)
        ctx.lineTo(elem.x, elem.y + elem.height * 0.65)
        ctx.closePath()
        ctx.fill()
        break

      case 'orb':
        const orbGrad = ctx.createRadialGradient(
          elem.x + elem.width / 2, elem.y + elem.height / 2, 0,
          elem.x + elem.width / 2, elem.y + elem.height / 2, elem.width / 2
        )
        orbGrad.addColorStop(0, '#ffffff')
        orbGrad.addColorStop(0.25, world.accent)
        orbGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = orbGrad
        ctx.beginPath()
        ctx.arc(elem.x + elem.width / 2, elem.y + elem.height / 2, elem.width / 2, 0, Math.PI * 2)
        ctx.fill()
        break
    }
    ctx.restore()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const e = engineRef.current
    const w = getWorld(e.score)

    // Background
    ctx.fillStyle = w.skyBottom
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT)

    ctx.save()
    if (e.shakeTimer > 0) ctx.translate(e.shakeX, e.shakeY)

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CFG.GROUND)
    skyGrad.addColorStop(0, w.skyTop)
    skyGrad.addColorStop(0.52, w.skyMid)
    skyGrad.addColorStop(1, w.skyBottom)
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.GROUND)

    // Stars
    ctx.globalAlpha = 0.72
    ctx.fillStyle = '#ffffff'
    for (const s of e.stars) {
      const alpha = (s.alpha + Math.sin(s.twinkle) * 0.14) * 0.62
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * 0.72, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Grid
    ctx.strokeStyle = w.grid
    ctx.lineWidth = 1
    const off = (e.distance * 0.095) % 52
    for (let x = -off; x <= CFG.WIDTH; x += 52) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CFG.GROUND)
      ctx.stroke()
    }

    // Background elements
    for (const elem of e.backgroundElements) {
      drawBackgroundElement(ctx, elem, w)
    }

    // Ground
    ctx.fillStyle = w.groundTop
    ctx.fillRect(0, CFG.GROUND, CFG.WIDTH, CFG.HEIGHT - CFG.GROUND)

    // Ground line glow
    ctx.strokeStyle = w.accent
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.moveTo(0, CFG.GROUND)
    ctx.lineTo(CFG.WIDTH, CFG.GROUND)
    ctx.stroke()

    // Floor pattern
    const fOff = (e.distance * 0.36) % 46
    ctx.fillStyle = 'rgba(255,255,255,0.038)'
    for (let x = -fOff; x < CFG.WIDTH + 46; x += 46) {
      ctx.beginPath()
      ctx.moveTo(x, CFG.GROUND)
      ctx.lineTo(x + 23, CFG.GROUND + 13)
      ctx.lineTo(x + 46, CFG.GROUND)
      ctx.closePath()
      ctx.fill()
    }

    // Candles
    for (const c of e.candles) {
      if (c.collected && c.collectProgress >= 1) continue
      const isRed = c.kind === 'red'
      const a = isRed ? w.redA : w.greenA
      const b = isRed ? w.redB : w.greenB
      const flicker = 0.84 + Math.sin(c.phase) * 0.16

      // Wick
      ctx.strokeStyle = a
      ctx.lineWidth = Math.max(2.3, c.width * 0.14)
      ctx.globalAlpha = flicker * 0.58
      ctx.beginPath()
      ctx.moveTo(c.x + c.width / 2, c.wickTop)
      ctx.lineTo(c.x + c.width / 2, c.wickBottom)
      ctx.stroke()
      ctx.globalAlpha = 1

      // Body gradient
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

      // Candle body with rotation
      ctx.save()
      ctx.translate(c.x + c.width / 2, scaledY + scaledH / 2)
      ctx.rotate(c.rotation)
      ctx.fillRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH)
      
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.17)'
      ctx.fillRect(-scaledW / 2 + 3, -scaledH / 2 + 2, scaledW * 0.2, scaledH - 4)
      ctx.restore()

      // Collection glow
      if (c.collected && c.collectProgress < 1) {
        ctx.globalAlpha = (1 - c.collectProgress) * 0.55
        ctx.fillStyle = isRed ? w.redA : w.greenA
        ctx.beginPath()
        ctx.arc(c.x + c.width / 2, c.bodyY + c.bodyHeight / 2, c.width * (1.4 + c.collectProgress * 2.2), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    // Player trail
    for (const t of e.player.trail) {
      ctx.globalAlpha = t.alpha * t.life * 0.52
      ctx.save()
      ctx.translate(CFG.PLAYER_X + CFG.PLAYER_SIZE / 2, t.y + CFG.PLAYER_SIZE / 2)
      ctx.rotate(t.rotation)
      if (logoLoaded && logoRef.current) {
        ctx.drawImage(logoRef.current, -t.size / 2, -t.size / 2, t.size, t.size)
      } else {
        ctx.fillStyle = w.accent
        ctx.fillRect(-t.size / 2, -t.size / 2, t.size, t.size)
      }
      ctx.restore()
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

    // Flash effect
    if (e.player.flash > 0) {
      ctx.globalAlpha = e.player.flash * 4
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-CFG.PLAYER_SIZE / 2 - 2, -CFG.PLAYER_SIZE / 2 - 2, CFG.PLAYER_SIZE + 4, CFG.PLAYER_SIZE + 4)
    }

    ctx.restore()

    // Particles
    for (const pt of e.particles) {
      ctx.save()
      ctx.globalAlpha = clamp(pt.life, 0, 1)
      ctx.translate(pt.x, pt.y)
      ctx.rotate(pt.rotation)
      ctx.fillStyle = pt.color

      if (pt.type === 'ring') {
        ctx.beginPath()
        ctx.arc(0, 0, pt.size * pt.life * 1.15, 0, Math.PI * 2)
        ctx.fill()
      } else if (pt.type === 'burst') {
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size * pt.life, pt.size * pt.life)
      } else if (pt.type === 'trail') {
        ctx.globalAlpha *= 0.6
        ctx.beginPath()
        ctx.arc(0, 0, pt.size * pt.life, 0, Math.PI * 2)
        ctx.fill()
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
      const alpha = clamp(e.worldBannerTimer / 2.4, 0, 1)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.68)'
      const bw = 280, bh = 52
      const bx = CFG.WIDTH / 2 - bw / 2, by = 42
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = w.accent
      ctx.lineWidth = 2.8
      ctx.strokeRect(bx, by, bw, bh)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 21px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(w.name, CFG.WIDTH / 2, by + bh / 2 + 2)
      ctx.restore()
    }

    ctx.restore()
  }, [logoLoaded, drawBackgroundElement])

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────────

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

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER UI
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
                <p className="text-white/40 text-xs">geometry dash meets trading</p>
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
                  <li>🕯️ <span className="text-green-400">green candles</span> = chill mode (2s slowdown)</li>
                  <li>⚡ double jump at 150 pts</li>
                  <li>🌍 7 unique worlds to unlock</li>
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
              <p className="text-white/40 text-xs mb-5">hit a red candle</p>

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
                  <p className="text-sm font-semibold" style={{ color: getSpeed(score).color }}>{speedName}</p>
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
                  connect wallet
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
                <p className="text-xs font-semibold" style={{ color: getSpeed(score).color }}>{speedName}</p>
              </div>
            </div>

            {engineRef.current.slowdownTimer > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-green-500/15 backdrop-blur-sm border border-green-500/30">
                <p className="text-green-400 text-xs font-medium">⚡ chill mode</p>
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
