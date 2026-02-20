/**
 * ============================================================================
 * BASE DASH — Game Configuration, Types & Spawn Logic
 * ============================================================================
 *
 * All game constants, type definitions, world themes, speed tiers,
 * creation helpers, utility functions, and spawn-pattern generators.
 *
 * Trading-candle endless runner in the style of Geometry Dash,
 * designed for the Base blockchain mini-app ecosystem.
 * ============================================================================
 */

// ============================================================================
// MOBILE DETECTION
// ============================================================================

export const IS_MOBILE =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type GameMode = 'menu' | 'playing' | 'paused' | 'gameover'
export type CandleKind = 'red' | 'green'
export type ParticleType =
    | 'spark'
    | 'glow'
    | 'star'
    | 'ring'
    | 'burst'
    | 'trail'
    | 'coin'
    | 'smoke'
    | 'dust'
    | 'ground'
    | 'collect'
    | 'death'
    | 'jump'
    | 'powerup'

export type PowerUpKind = 'diamond_hands' | 'moon_boost' | 'whale_mode'
export type TrailType = 'default' | 'fire' | 'rainbow' | 'neon'

export type FloorPattern =
    | 'diagonal'
    | 'circuit'
    | 'waves'
    | 'grid'
    | 'neon'
    | 'dots'
    | 'lines'
    | 'chevron'
    | 'hex'
    | 'pulse'

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

export interface WorldTheme {
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
    floorPattern: FloorPattern
    starColor: string
    particleColor: string
    /** Parallax cloud color for this world */
    cloudColor: string
    /** Ground shimmer alpha multiplier */
    shimmer: number
}

export interface SpeedTier {
    label: string
    startScore: number
    multiplier: number
    color: string
    description: string
    /** Extra particle intensity at this speed */
    particleBoost: number
}

export interface TrailPoint {
    x: number
    y: number
    life: number
    alpha: number
    size: number
    rotation: number
    scale: number
}

export interface Player {
    x: number
    y: number
    velocityY: number
    velocityX: number
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
    tilt: number
    /** Accumulated rotation for smooth snapping */
    targetRotation: number
    /** Dash cooldown timer */
    dashTimer: number
    /** Is currently dashing */
    isDashing: boolean
    /** Dash velocity */
    dashVelocity: number
}

export interface Candle {
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
    moveAmplitude: number
    glowIntensity: number
    /** Size class: 0=small, 1=normal, 2=tall, 3=wide */
    sizeClass: number
}

export interface Particle {
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
    alpha: number
    pulse: number
}

export interface Star {
    x: number
    y: number
    size: number
    alpha: number
    depth: number
    twinkle: number
    twinkleSpeed: number
    color: string
    layer: number
}

export interface Cloud {
    x: number
    y: number
    width: number
    height: number
    alpha: number
    speed: number
}

export interface GroundParticle {
    x: number
    y: number
    size: number
    speed: number
    alpha: number
    phase: number
}

export interface PowerUp {
    id: number
    kind: PowerUpKind
    x: number
    y: number
    size: number
    collected: boolean
    phase: number
    bobSpeed: number
    glowPhase: number
    collectProgress: number
}

/** Trail unlock milestones (on-chain best score thresholds) */
export const TRAIL_UNLOCKS: { trail: TrailType; score: number; label: string; description: string }[] = [
    { trail: 'default', score: 0, label: 'classic', description: 'base blue trail' },
    { trail: 'fire', score: 500, label: '🔥 fire trail', description: 'unlocked at 500 on-chain score' },
    { trail: 'rainbow', score: 1500, label: '🌈 rainbow trail', description: 'unlocked at 1500 on-chain score' },
    { trail: 'neon', score: 3000, label: '⚡ neon trail', description: 'unlocked at 3000 on-chain score' },
]

export const POWERUP_CONFIG = {
    /** Crypto-themed power-ups */
    TYPES: {
        diamond_hands: {
            label: '💎 diamond hands',
            description: 'survive 1 red candle hit',
            duration: 0, // instant shield
            color1: '#00D4FF',
            color2: '#0088CC',
            symbol: '💎',
        },
        moon_boost: {
            label: '🚀 moon bag',
            description: '2x score for 5s',
            duration: 5,
            color1: '#FFD700',
            color2: '#FF8C00',
            symbol: '🌕',
        },
        whale_mode: {
            label: '🐋 whale alert',
            description: 'slow time for 4s',
            duration: 4,
            color1: '#7B68EE',
            color2: '#4B0082',
            symbol: '📊',
        },
    } as const,
    SIZE: 32,
    SPAWN_CHANCE: 0.06, // 6% per pattern after score 200
    MIN_SCORE: 200,
    BOB_AMPLITUDE: 12,
} as const

export interface EngineState {
    player: Player
    candles: Candle[]
    powerUps: PowerUp[]
    particles: Particle[]
    stars: Star[]
    clouds: Cloud[]
    groundParticles: GroundParticle[]
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
    worldIndex: number
    worldBannerTimer: number
    uiTimer: number
    alive: boolean
    gameTime: number
    totalCollected: number
    totalJumps: number
    totalDashes: number
    distanceTraveled: number
    backgroundOffset: number
    groundOffset: number
    cloudOffset: number
    /** Difficulty factor 0-1 based on score */
    difficulty: number
    /** Score pulse animation timer */
    scorePulse: number
    /** Combo pulse animation timer */
    comboPulse: number
    /** Active trail type */
    activeTrail: TrailType
    /** Active power-up effects */
    shieldActive: boolean
    moonBoostTimer: number
    whaleTimer: number
    /** Score multiplier (from moon boost) */
    scoreMultiplier: number
    /** Next power-up ID */
    nextPowerUpId: number
}

// ============================================================================
// CONFIGURATION — Physics, Limits, Scoring
// ============================================================================

export const CFG = {
    // Canvas
    WIDTH: 960,
    HEIGHT: 540,
    GROUND: 430,

    // Player
    PLAYER_X: 180,
    PLAYER_SIZE: 42,
    HITBOX: 10,

    // Physics — snappy Geometry Dash feel
    STEP: 1 / 60,
    MAX_DELTA: 0.033,
    UI_RATE: 1 / 10,

    GRAVITY: 2400,
    JUMP: -820,
    DOUBLE_JUMP: -680,
    MAX_FALL: 1200,
    COYOTE: 0.08,
    BUFFER: 0.12,
    ROT_SPEED: 11.0,
    TILT_SPEED: 18,

    // Dash
    DASH_SPEED: 200,
    DASH_DURATION: 0.15,
    DASH_COOLDOWN: 0.8,

    // Speed
    BASE_SPEED: 360,
    MAX_SPEED: 680,
    DOUBLE_JUMP_AT: 150,

    // Spawning — safe gaps, always beatable
    BASE_SPAWN_GAP: 520,
    MIN_SPAWN_GAP: 300,
    MAX_CANDLES_PATTERN: 5,

    // Scoring
    RED_SCORE: 10,
    GREEN_SCORE: 25,  // +25 points per green candle
    COMBO_BONUS: 2,
    SLOW_MULT: 0.50,
    SLOW_TIME: 2.5,

    // Effects — mobile-aware
    PARTICLE_LIMIT: IS_MOBILE ? 60 : 140,
    TRAIL_LIMIT: IS_MOBILE ? 3 : 7,
    STAR_COUNT: IS_MOBILE ? 20 : 45,
    CLOUD_COUNT: IS_MOBILE ? 3 : 6,
    MAX_CANDLES: 14,
    GROUND_PARTICLE_COUNT: IS_MOBILE ? 10 : 24,
    MAX_POWERUPS: 3,
} as const

// ============================================================================
// 10 WORLD THEMES — Each with unique visual identity
// ============================================================================

export const WORLDS: WorldTheme[] = [
    {
        name: 'base camp',
        startScore: 0,
        skyTop: '#FFFFFF',
        skyMid: '#F5F8FF',
        skyBottom: '#E8F0FE',
        groundTop: '#C5D4F0',
        groundBottom: '#A0B8E0',
        accent: '#0052FF',
        grid: 'rgba(0,82,255,0.06)',
        redA: '#F6465D', redB: '#D63048',
        greenA: '#0ECB81', greenB: '#0A9F68',
        floorPattern: 'diagonal',
        starColor: '#0052FF',
        particleColor: '#88CCFF',
        cloudColor: 'rgba(0,82,255,0.04)',
        shimmer: 0.5,
    },
    {
        name: 'turbo track',
        startScore: 500,
        skyTop: '#F8FAFF',
        skyMid: '#EBF0FF',
        skyBottom: '#DCE4FF',
        groundTop: '#B8C8F0',
        groundBottom: '#95A8E0',
        accent: '#3378FF',
        grid: 'rgba(51,120,255,0.07)',
        redA: '#FF5A72', redB: '#E04058',
        greenA: '#14E89A', greenB: '#0EC080',
        floorPattern: 'circuit',
        starColor: '#3378FF',
        particleColor: '#AADDFF',
        cloudColor: 'rgba(51,120,255,0.05)',
        shimmer: 0.6,
    },
    {
        name: 'diamond hands',
        startScore: 1200,
        skyTop: '#FAFBFF',
        skyMid: '#F0F2FF',
        skyBottom: '#E2E6FF',
        groundTop: '#C0C8F0',
        groundBottom: '#9AA8E0',
        accent: '#4E6AFF',
        grid: 'rgba(78,106,255,0.06)',
        redA: '#FF6070', redB: '#E04858',
        greenA: '#18E8A0', greenB: '#10C888',
        floorPattern: 'dots',
        starColor: '#4E6AFF',
        particleColor: '#99BBFF',
        cloudColor: 'rgba(78,106,255,0.04)',
        shimmer: 0.65,
    },
    {
        name: 'crystal caves',
        startScore: 2000,
        skyTop: '#FAF8FF',
        skyMid: '#F2EBFF',
        skyBottom: '#E5D5FF',
        groundTop: '#D0C0F0',
        groundBottom: '#B095E0',
        accent: '#6E5CFF',
        grid: 'rgba(110,92,255,0.07)',
        redA: '#FF6B7D', redB: '#E05065',
        greenA: '#28F0A8', greenB: '#1ED890',
        floorPattern: 'waves',
        starColor: '#6E5CFF',
        particleColor: '#CCAAFF',
        cloudColor: 'rgba(110,92,255,0.05)',
        shimmer: 0.7,
    },
    {
        name: 'midnight run',
        startScore: 3000,
        skyTop: '#F0F4FF',
        skyMid: '#E0EAFF',
        skyBottom: '#C8D8FF',
        groundTop: '#A0B8F0',
        groundBottom: '#80A0E0',
        accent: '#0090FF',
        grid: 'rgba(0,144,255,0.08)',
        redA: '#FF7B90', redB: '#E06078',
        greenA: '#40F8B8', greenB: '#28E0A0',
        floorPattern: 'grid',
        starColor: '#0090FF',
        particleColor: '#88DDFF',
        cloudColor: 'rgba(0,144,255,0.06)',
        shimmer: 0.75,
    },
    {
        name: 'bull market',
        startScore: 4200,
        skyTop: '#F5FFF5',
        skyMid: '#E8FFE8',
        skyBottom: '#D0F8D0',
        groundTop: '#A8E0A8',
        groundBottom: '#88C888',
        accent: '#00C060',
        grid: 'rgba(0,192,96,0.07)',
        redA: '#FF6078', redB: '#E04860',
        greenA: '#30F8A0', greenB: '#20E088',
        floorPattern: 'chevron',
        starColor: '#00C060',
        particleColor: '#88FFA8',
        cloudColor: 'rgba(0,192,96,0.04)',
        shimmer: 0.8,
    },
    {
        name: 'digital core',
        startScore: 5600,
        skyTop: '#F8F8FA',
        skyMid: '#EBEBF0',
        skyBottom: '#DCDCE8',
        groundTop: '#C0C0D8',
        groundBottom: '#A0A0C0',
        accent: '#5A50E0',
        grid: 'rgba(90,80,224,0.07)',
        redA: '#FF8090', redB: '#E06578',
        greenA: '#58FFC8', greenB: '#40E8B0',
        floorPattern: 'circuit',
        starColor: '#5A50E0',
        particleColor: '#AAAAFF',
        cloudColor: 'rgba(90,80,224,0.05)',
        shimmer: 0.85,
    },
    {
        name: 'neon nights',
        startScore: 7200,
        skyTop: '#F0F5FF',
        skyMid: '#E0EAFF',
        skyBottom: '#C8D8FF',
        groundTop: '#98B0F0',
        groundBottom: '#7898E0',
        accent: '#0078FF',
        grid: 'rgba(0,120,255,0.09)',
        redA: '#FF5A72', redB: '#E04058',
        greenA: '#14E89A', greenB: '#0EC080',
        floorPattern: 'neon',
        starColor: '#0078FF',
        particleColor: '#66CCFF',
        cloudColor: 'rgba(0,120,255,0.06)',
        shimmer: 0.9,
    },
    {
        name: 'bear trap',
        startScore: 9000,
        skyTop: '#FFF8F8',
        skyMid: '#FFE8E8',
        skyBottom: '#FFD0D0',
        groundTop: '#F0A0A0',
        groundBottom: '#E08888',
        accent: '#FF3050',
        grid: 'rgba(255,48,80,0.06)',
        redA: '#FF4060', redB: '#E03050',
        greenA: '#20F0A0', greenB: '#10D888',
        floorPattern: 'hex',
        starColor: '#FF3050',
        particleColor: '#FF8888',
        cloudColor: 'rgba(255,48,80,0.04)',
        shimmer: 0.95,
    },
    {
        name: 'moon mission',
        startScore: 11000,
        skyTop: '#F0F0FF',
        skyMid: '#E0E0F8',
        skyBottom: '#D0D0F0',
        groundTop: '#B0B0E0',
        groundBottom: '#9090D0',
        accent: '#6040FF',
        grid: 'rgba(96,64,255,0.08)',
        redA: '#FF6080', redB: '#E04868',
        greenA: '#40FFD0', greenB: '#28E8B8',
        floorPattern: 'pulse',
        starColor: '#6040FF',
        particleColor: '#AA88FF',
        cloudColor: 'rgba(96,64,255,0.05)',
        shimmer: 1.0,
    },
]

// ============================================================================
// 9 SPEED TIERS
// ============================================================================

export const SPEEDS: SpeedTier[] = [
    { label: 'easy', startScore: 0, multiplier: 1.0, color: '#88CCFF', description: 'relaxed start', particleBoost: 0 },
    { label: 'medium', startScore: 180, multiplier: 1.1, color: '#88FF88', description: 'warming up', particleBoost: 0.1 },
    { label: 'fast', startScore: 400, multiplier: 1.24, color: '#CCFF66', description: 'getting faster', particleBoost: 0.2 },
    { label: 'rapid', startScore: 700, multiplier: 1.40, color: '#FFFF88', description: 'hold on tight', particleBoost: 0.3 },
    { label: 'intense', startScore: 1100, multiplier: 1.58, color: '#FFCC88', description: 'intense mode', particleBoost: 0.4 },
    { label: 'extreme', startScore: 1600, multiplier: 1.78, color: '#FF8888', description: 'extreme speed', particleBoost: 0.55 },
    { label: 'insane', startScore: 2200, multiplier: 2.0, color: '#FF88CC', description: 'insane pace', particleBoost: 0.7 },
    { label: 'hardcore', startScore: 2900, multiplier: 2.25, color: '#CC88FF', description: 'hardcore mode', particleBoost: 0.85 },
    { label: 'god mode', startScore: 3800, multiplier: 2.55, color: '#88FFFF', description: 'god mode', particleBoost: 1.0 },
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const clamp = (v: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, v))

export const lerp = (a: number, b: number, t: number): number =>
    a + (b - a) * clamp(t, 0, 1)

export const lerpAngle = (a: number, b: number, t: number): number => {
    let diff = b - a
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    return a + diff * clamp(t, 0, 1)
}

export const rand = (min: number, max: number): number =>
    Math.random() * (max - min) + min

export const randInt = (min: number, max: number): number =>
    Math.floor(rand(min, max + 1))

export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)

export const easeInOut = (t: number): number =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

export const getWorld = (score: number): WorldTheme =>
    WORLDS.filter(w => score >= w.startScore).at(-1) || WORLDS[0]

export const getWorldIndex = (score: number): number => {
    let idx = 0
    for (let i = WORLDS.length - 1; i >= 0; i--) {
        if (score >= WORLDS[i].startScore) { idx = i; break }
    }
    return idx
}

export const getSpeed = (score: number): SpeedTier =>
    SPEEDS.filter(s => score >= s.startScore).at(-1) || SPEEDS[0]

export const getJumps = (score: number): number =>
    score >= CFG.DOUBLE_JUMP_AT ? 2 : 1

export const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

// ============================================================================
// CREATION FUNCTIONS
// ============================================================================

export const createStars = (count: number = CFG.STAR_COUNT): Star[] =>
    Array.from({ length: count }, () => ({
        x: Math.random() * CFG.WIDTH,
        y: Math.random() * (CFG.GROUND - 60),
        size: rand(0.5, 2.2),
        alpha: rand(0.3, 0.7),
        depth: rand(0.15, 0.85),
        twinkle: rand(0, Math.PI * 2),
        twinkleSpeed: rand(1, 3),
        color: '#0052FF',
        layer: Math.random() > 0.5 ? 1 : 2,
    }))

export const createClouds = (count: number = CFG.CLOUD_COUNT): Cloud[] =>
    Array.from({ length: count }, () => ({
        x: Math.random() * CFG.WIDTH,
        y: rand(30, CFG.GROUND * 0.45),
        width: rand(60, 180),
        height: rand(18, 40),
        alpha: rand(0.02, 0.06),
        speed: rand(0.02, 0.08),
    }))

export const createGroundParticles = (
    count: number = CFG.GROUND_PARTICLE_COUNT
): GroundParticle[] =>
    Array.from({ length: count }, () => ({
        x: Math.random() * CFG.WIDTH,
        y: CFG.GROUND + rand(5, 25),
        size: rand(1.5, 4),
        speed: rand(0.4, 1.3),
        alpha: rand(0.2, 0.5),
        phase: rand(0, Math.PI * 2),
    }))

export const createPlayer = (): Player => ({
    x: CFG.PLAYER_X,
    y: CFG.GROUND - CFG.PLAYER_SIZE,
    velocityY: 0,
    velocityX: 0,
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
    tilt: 0,
    targetRotation: 0,
    dashTimer: 0,
    isDashing: false,
    dashVelocity: 0,
})

export const createCandle = (
    id: number,
    kind: CandleKind,
    x: number,
    height: number,
    width: number
): Candle => {
    const upperWick = height * rand(0.18, 0.26)
    const lowerWick = height * rand(0.08, 0.14)
    const bodyHeight = height - upperWick - lowerWick
    const bodyY = CFG.GROUND - lowerWick - bodyHeight

    // Determine size class for visual variety
    const area = height * width
    let sizeClass = 1
    if (area < 2000) sizeClass = 0
    else if (area > 4000) sizeClass = 2
    if (width > 40) sizeClass = 3

    return {
        id, kind, x, y: bodyY, width, height, bodyHeight, bodyY,
        bodyTop: bodyY + bodyHeight,
        wickTop: bodyY - upperWick,
        wickBottom: bodyY + bodyHeight + lowerWick,
        passed: false, collected: false,
        phase: rand(0, Math.PI * 2),
        flickerSpeed: rand(6, 10),
        collectProgress: 0, scaleAnim: 1, rotation: 0,
        targetY: bodyY,
        moveSpeed: rand(0.8, 1.5),
        movePhase: rand(0, Math.PI * 2),
        isMoving: false,
        moveAmplitude: rand(15, 30),
        glowIntensity: 1,
        sizeClass,
    }
}

export const createEngine = (): EngineState => ({
    player: createPlayer(),
    candles: [],
    powerUps: [],
    particles: [],
    stars: createStars(),
    clouds: createClouds(),
    groundParticles: createGroundParticles(),
    speed: CFG.BASE_SPEED,
    distance: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    slowdownTimer: 0,
    nextSpawnDistance: CFG.BASE_SPAWN_GAP,
    nextCandleId: 1,
    shakeX: 0, shakeY: 0, shakeTimer: 0,
    worldName: WORLDS[0].name,
    worldIndex: 0,
    worldBannerTimer: 0,
    uiTimer: 0,
    alive: true,
    gameTime: 0,
    totalCollected: 0,
    totalJumps: 0,
    totalDashes: 0,
    distanceTraveled: 0,
    backgroundOffset: 0,
    groundOffset: 0,
    cloudOffset: 0,
    difficulty: 0,
    scorePulse: 0,
    comboPulse: 0,
    activeTrail: 'default',
    shieldActive: false,
    moonBoostTimer: 0,
    whaleTimer: 0,
    scoreMultiplier: 1,
    nextPowerUpId: 1,
})

// ============================================================================
// SPAWN PATTERNS — Massive variety, always beatable
// ============================================================================

/**
 * Spawn a pattern of candles at the right edge of the screen.
 * Patterns scale with difficulty (complexity 0-5).
 * All patterns are designed to be beatable with single or double jump.
 * Green candles ~12% frequency — they are valuable rewards.
 */
export const spawnPattern = (e: EngineState): void => {
    const diff = clamp(e.score / 4000, 0, 1)
    const complexity = Math.min(5, Math.floor(e.score / 500))
    const startX = CFG.WIDTH + 140
    const baseH = lerp(65, 100, diff)
    const baseW = lerp(24, 36, diff)
    const maxHM = 1.4 // always jumpable

    const push = (
        offset: number,
        kind: CandleKind,
        hM = 1,
        wM = 1,
        moving = false
    ): void => {
        const h = clamp(hM, 0.4, maxHM)
        const candle = createCandle(
            e.nextCandleId++,
            kind,
            startX + offset,
            baseH * rand(0.85, 1.1) * h,
            baseW * rand(0.9, 1.08) * clamp(wM, 0.6, 1.4)
        )
        if (moving || (e.score >= 900 && Math.random() < 0.10 * diff)) {
            candle.isMoving = true
            candle.moveAmplitude = rand(12, 28)
        }
        // Air candles after score 800+
        if (e.score >= 800 && Math.random() < 0.08 * diff) {
            const lift = rand(25, 60)
            candle.bodyY -= lift; candle.y -= lift; candle.bodyTop -= lift
            candle.wickTop -= lift; candle.wickBottom -= lift
            candle.isMoving = true
            candle.moveAmplitude = rand(12, 25)
        }
        e.candles.push(candle)
    }

    // Pattern selection using weighted random
    const roll = Math.random()

    // --- COMPLEXITY 0: Single candles with varied sizes from the start ---
    if (complexity === 0) {
        if (roll < 0.25) push(0, 'red', 0.7, 1.3)  // short wide
        else if (roll < 0.40) push(0, 'red', 0.6, 1.4)  // very short wide
        else if (roll < 0.55) push(0, 'red', 1.2, 0.7)  // tall narrow
        else if (roll < 0.68) push(0, 'red', 1.3, 0.6)  // very tall narrow
        else if (roll < 0.78) push(0, 'red', 0.85)  // normal short
        else if (roll < 0.88) push(0, 'red', 1.1)  // normal tall
        else if (roll < 0.95) push(0, 'red')  // normal
        else push(0, 'green')  // green reward

        // --- COMPLEXITY 1: Pairs with size variety ---
    } else if (complexity === 1) {
        if (roll < 0.14) { push(0, 'red', 0.7, 1.3); push(160, 'red', 1.2, 0.7) }  // wide + tall
        else if (roll < 0.26) { push(0, 'red', 0.85); push(145, 'red', 1.1) }
        else if (roll < 0.38) { push(0, 'red', 1.1); push(155, 'red', 0.8) }
        else if (roll < 0.48) { push(0, 'red', 0.6, 1.4); push(140, 'red', 1.3, 0.6) }  // extreme sizes
        else if (roll < 0.58) { push(0, 'red', 1.3, 0.6); push(130, 'red', 0.7, 1.3) }  // tall + short
        else if (roll < 0.68) { push(0, 'red'); push(130, 'red', 0.9) }
        else if (roll < 0.76) { push(0, 'green', 0.8, 1.2); push(145, 'red', 1.1) }  // wide green
        else if (roll < 0.84) { push(0, 'red', 1.05); push(150, 'red', 1.0) }
        else if (roll < 0.92) { push(0, 'green'); push(145, 'red', 1.1) }
        else { push(0, 'red'); push(130, 'green') }

        // --- COMPLEXITY 2: Triples, first mixed patterns ---
    } else if (complexity === 2) {
        if (roll < 0.12) { push(0, 'red', 1.05); push(125, 'red', 0.85); push(250, 'red', 1.1) }
        else if (roll < 0.24) { push(0, 'red', 0.8); push(120, 'red', 1.15); push(245, 'red') }
        else if (roll < 0.34) { push(0, 'red'); push(115, 'red', 1.1); push(240, 'red', 0.9) }
        else if (roll < 0.44) { push(0, 'red', 1.1); push(130, 'red'); push(260, 'red', 0.85) }
        else if (roll < 0.54) { push(0, 'red', 0.7, 1.3); push(120, 'red', 1.05); push(240, 'red') }
        else if (roll < 0.64) { push(0, 'green'); push(125, 'red', 1.1); push(250, 'red', 0.9) }
        else if (roll < 0.74) { push(0, 'red', 0.9); push(115, 'green'); push(235, 'red', 1.1) }
        else if (roll < 0.84) { push(0, 'red', 1.1); push(130, 'red', 0.85); push(260, 'green') }
        else if (roll < 0.92) { push(0, 'red'); push(100, 'red', 0.9); push(210, 'red', 1.05); push(320, 'green') }
        else { push(0, 'red', 0.6, 1.3); push(130, 'red', 1.2); push(260, 'red', 0.7, 1.2) }

        // --- COMPLEXITY 3: Quads, some movement ---
    } else if (complexity === 3) {
        if (roll < 0.10) { push(0, 'red'); push(110, 'red', 1.05); push(225, 'red', 0.9); push(340, 'red', 1.1) }
        else if (roll < 0.20) { push(0, 'red', 0.85); push(115, 'red', 1.1); push(230, 'red'); push(350, 'red', 0.9) }
        else if (roll < 0.30) { push(0, 'red', 1.1); push(120, 'red', 0.8); push(240, 'red', 1.05); push(360, 'red') }
        else if (roll < 0.38) { push(0, 'red', 0.7, 1.3); push(105, 'red'); push(215, 'red', 1.1); push(330, 'red', 0.85) }
        else if (roll < 0.46) { push(0, 'green'); push(110, 'red', 1.1); push(225, 'red', 0.9); push(340, 'red', 1.05) }
        else if (roll < 0.54) { push(0, 'red', 1.05); push(120, 'red', 0.85); push(245, 'green'); push(365, 'red', 1.1) }
        else if (roll < 0.62) { push(0, 'red'); push(105, 'red', 1.1); push(215, 'red', 0.9); push(330, 'green') }
        else if (roll < 0.70) { push(0, 'red', 0.9); push(115, 'red', 1.05); push(230, 'red'); push(345, 'red', 0.85) }
        else if (roll < 0.78) { push(0, 'red', 1.1, 1, true); push(125, 'red', 0.9); push(250, 'red'); push(370, 'red', 1.05) }
        else if (roll < 0.86) { push(0, 'red'); push(100, 'red', 0.85); push(210, 'red', 1.1); push(325, 'red', 0.9) }
        else if (roll < 0.93) { push(0, 'green'); push(115, 'red'); push(230, 'red', 1.05); push(345, 'green') }
        else { push(0, 'red', 0.7, 1.2); push(110, 'red', 1.1); push(225, 'green'); push(340, 'red', 0.85); push(455, 'red') }

        // --- COMPLEXITY 4: Quints, movement, harder patterns ---
    } else if (complexity === 4) {
        if (roll < 0.09) { push(0, 'red'); push(105, 'red', 1.05); push(215, 'red', 0.9); push(330, 'red', 1.1); push(445, 'red') }
        else if (roll < 0.18) { push(0, 'red', 0.85); push(100, 'red', 1.1); push(210, 'red'); push(320, 'red', 0.9); push(435, 'green') }
        else if (roll < 0.27) { push(0, 'green'); push(115, 'red', 1.05); push(230, 'red', 0.9); push(345, 'red', 1.1); push(460, 'red') }
        else if (roll < 0.36) { push(0, 'red', 1.1); push(110, 'red', 0.85); push(225, 'red'); push(340, 'green'); push(455, 'red', 1.05) }
        else if (roll < 0.45) { push(0, 'red'); push(95, 'red', 1.05); push(200, 'green'); push(310, 'red', 0.9); push(420, 'red', 1.1) }
        else if (roll < 0.54) { push(0, 'red', 0.9, 1, true); push(110, 'red', 1.1); push(225, 'red'); push(340, 'red', 0.85); push(455, 'green') }
        else if (roll < 0.63) { push(0, 'red', 1.05); push(105, 'red', 0.8, 1.2); push(215, 'red', 1.1); push(330, 'red'); push(445, 'red', 0.9) }
        else if (roll < 0.72) { push(0, 'red'); push(100, 'red', 1.1); push(210, 'red', 0.85); push(325, 'red', 1.05); push(440, 'red') }
        else if (roll < 0.81) { push(0, 'green'); push(110, 'red'); push(220, 'red', 1.05); push(335, 'red', 0.9); push(450, 'green') }
        else if (roll < 0.90) { push(0, 'red', 0.7, 1.3); push(100, 'red', 1.1); push(210, 'red'); push(320, 'red', 1.05); push(435, 'red', 0.85) }
        else { push(0, 'red'); push(95, 'red', 0.9); push(195, 'red', 1.1); push(300, 'green'); push(410, 'red'); push(520, 'red', 1.05) }

        // --- COMPLEXITY 5: Maximum difficulty, 5-6 candles ---
    } else {
        if (roll < 0.08) { push(0, 'red', 1.05); push(95, 'red', 0.9); push(195, 'red', 1.1); push(300, 'red'); push(405, 'red', 0.85); push(510, 'red', 1.05) }
        else if (roll < 0.16) { push(0, 'red'); push(90, 'red', 1.1, 1, true); push(190, 'red', 0.85); push(295, 'red', 1.05); push(400, 'green'); push(510, 'red') }
        else if (roll < 0.24) { push(0, 'green'); push(100, 'red', 1.05); push(205, 'red', 0.9); push(310, 'red', 1.1); push(420, 'red'); push(530, 'red', 0.85) }
        else if (roll < 0.32) { push(0, 'red', 0.9); push(95, 'red', 1.1); push(195, 'red'); push(300, 'red', 0.85, 1, true); push(410, 'red', 1.05); push(520, 'green') }
        else if (roll < 0.40) { push(0, 'red', 1.1); push(100, 'red', 0.8, 1.2); push(205, 'red'); push(310, 'red', 1.05); push(420, 'red', 0.9) }
        else if (roll < 0.48) { push(0, 'red'); push(90, 'red', 0.9); push(185, 'green'); push(290, 'red', 1.1); push(395, 'red'); push(500, 'red', 1.05) }
        else if (roll < 0.56) { push(0, 'red', 0.85); push(95, 'red', 1.1); push(200, 'red', 0.9); push(305, 'red'); push(415, 'red', 1.05) }
        else if (roll < 0.64) { push(0, 'red', 1.05, 1, true); push(105, 'red', 0.9); push(210, 'red', 1.1); push(320, 'green'); push(430, 'red'); push(540, 'red', 0.85) }
        else if (roll < 0.72) { push(0, 'red'); push(100, 'red', 1.05); push(200, 'red', 0.85); push(305, 'red', 1.1); push(415, 'red', 0.9) }
        else if (roll < 0.80) { push(0, 'green'); push(95, 'red', 1.1); push(195, 'red'); push(300, 'red', 0.9); push(405, 'red', 1.05); push(510, 'green') }
        else if (roll < 0.88) { push(0, 'red', 0.7, 1.3); push(90, 'red', 1.1); push(190, 'red', 0.9); push(295, 'red', 1.05); push(405, 'red'); push(510, 'red', 0.85) }
        else { push(0, 'red'); push(85, 'red', 0.85); push(175, 'red', 1.1); push(270, 'red'); push(365, 'green'); push(460, 'red', 1.05); push(555, 'red', 0.9) }
    }

    // Maybe spawn a power-up
    if (e.score >= POWERUP_CONFIG.MIN_SCORE && Math.random() < POWERUP_CONFIG.SPAWN_CHANCE && e.powerUps.length < CFG.MAX_POWERUPS) {
        spawnPowerUp(e)
    }

    // Calculate gap based on difficulty
    const gap = lerp(CFG.BASE_SPAWN_GAP, CFG.MIN_SPAWN_GAP, diff)
    e.nextSpawnDistance = e.distance + gap * rand(0.90, 1.10)

    // Cleanup off-screen candles
    if (e.candles.length > CFG.MAX_CANDLES) {
        e.candles = e.candles.slice(-CFG.MAX_CANDLES)
    }
}

// ============================================================================
// POWER-UP SPAWNING
// ============================================================================

/** Spawn a random crypto-themed power-up */
export const spawnPowerUp = (e: EngineState): void => {
    const kinds: PowerUpKind[] = ['diamond_hands', 'moon_boost', 'whale_mode']
    // Weighted: diamond_hands slightly rarer
    const weights = [0.25, 0.40, 0.35]
    const r = Math.random()
    let kind: PowerUpKind = 'moon_boost'
    let cumulative = 0
    for (let i = 0; i < kinds.length; i++) {
        cumulative += weights[i]
        if (r < cumulative) { kind = kinds[i]; break }
    }

    const x = CFG.WIDTH + rand(200, 400)
    // Place between ground and mid-air (always reachable)
    const y = CFG.GROUND - rand(60, 160)

    e.powerUps.push({
        id: e.nextPowerUpId++,
        kind,
        x,
        y,
        size: POWERUP_CONFIG.SIZE,
        collected: false,
        phase: rand(0, Math.PI * 2),
        bobSpeed: rand(1.5, 2.5),
        glowPhase: rand(0, Math.PI * 2),
        collectProgress: 0,
    })
}
