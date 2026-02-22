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
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 &&
    (typeof window !== 'undefined' ? window.innerWidth < 768 : true)

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
export type MarketState = 'bull' | 'bear' | 'neutral'

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

export const MARKET_CONFIG = {
    /** Seconds between market cycles */
    CYCLE_TIME: 25,
    /** Bull = more greens, bear = more reds + faster */
    BULL_GREEN_BONUS: 0.15,
    BEAR_SPEED_MULT: 1.12,
    /** Near-miss threshold in pixels (extremely tight for rarity) */
    NEAR_MISS_DIST: 2,
    /** Near-miss slow-mo duration */
    NEAR_MISS_DURATION: 0.2,
    /** Minimum cooldown between near-miss triggers (seconds) */
    NEAR_MISS_COOLDOWN: 2.0,
    /** Rug-pull duration */
    RUG_PULL_DURATION: 3.5,
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
    /** Timestamp of last jump for debounce */
    lastJumpTime: number
    /** Market cycle state */
    marketState: MarketState
    /** Time until next market cycle change */
    marketTimer: number
    /** Near-miss slow-mo timer */
    nearMissTimer: number
    /** Near-miss flash text */
    nearMissText: string
    /** Rug-pull event timer (ground disappearing) */
    rugPullTimer: number
    /** Rug-pull active flag */
    rugPullActive: boolean
    /** Speed-lines flash timer (on speed tier change) */
    speedLinesTimer: number
    /** Combo pulse border timer */
    comboPulseTimer: number
    /** Previous speed tier index for detecting change */
    prevSpeedTierIdx: number
    /** Tutorial hint visible */
    showTutorial: boolean
    /** Run count for rug-pull chance (every 5th run) */
    runCount: number
    /** Camera zoom level (1.0 = normal, <1 = zoomed out) */
    cameraZoom: number
    /** Timer for spawning running dust particles */
    runDustTimer: number
    /** Near-miss text position for rendering */
    nearMissX: number
    nearMissY: number
    /** Rug-pull visual holes in ground (x positions) */
    rugPullHoles: number[]
    /** Candles spawned so far this run (for early-game guard) */
    spawnCount: number
    /** Shield flash overlay timer (item 4) */
    shieldFlashTimer: number
    /** Moon boost golden HUD pulse active (item 4) */
    moonBoostPulseActive: boolean
}

// ============================================================================
// CONFIGURATION — Physics, Limits, Scoring
// ============================================================================

// Initial defaults (overridden on mount by updateGameConfig)
export const CFG = {
    WIDTH: 960,
    HEIGHT: 540,
    GROUND: 430,

    PLAYER_X: 180,
    PLAYER_SIZE: 42,
    HITBOX_FRAC: 0.14,  // 14% inset each side — scales with screen size (16)
    HITBOX: 6,          // computed at runtime from HITBOX_FRAC × PLAYER_SIZE

    STEP: 1 / 60,
    MAX_DELTA: 0.033,
    UI_RATE: 1 / 10,

    GRAVITY: 2400,
    GRAVITY_UP: 1900,   // Lighter going up — floaty, readable arc (item 1)
    GRAVITY_DOWN: 3100, // Heavier falling — snappy, responsive (item 1)
    JUMP: -820,
    DOUBLE_JUMP: -680,
    MAX_FALL: 1200,
    COYOTE: 0.08,
    BUFFER: 0.12,
    ROT_SPEED: 11.0,
    TILT_SPEED: 18,
    SQUASH_LAND: -0.35,  // Strong squash on landing (item 6)
    SQUASH_JUMP: 0.22,   // Stretch on jump takeoff (item 6)
    BREATHE_SPEED: 1.5,  // Idle breathing oscillation speed
    BREATHE_AMP: 0.025,  // Idle breathing amplitude

    DASH_SPEED: 200,
    DASH_DURATION: 0.15,
    DASH_COOLDOWN: 0.8,

    BASE_SPEED: 440,
    MAX_SPEED: 780,
    DOUBLE_JUMP_AT: 120,

    BASE_SPAWN_GAP: 490,
    MIN_SPAWN_GAP: 260,
    MAX_CANDLES_PATTERN: 5,

    RED_SCORE: 7,
    GREEN_SCORE: 33,
    COMBO_BONUS: 2,
    SLOW_MULT: 0.50,
    SLOW_TIME: 2.5,

    PARTICLE_LIMIT: 140,
    TRAIL_LIMIT: 7,
    STAR_COUNT: 45,
    CLOUD_COUNT: 6,
    MAX_CANDLES: 14,
    GROUND_PARTICLE_COUNT: 24,
    MAX_POWERUPS: 3,
};

// ============================================================================
// 10 WORLD THEMES — Each with unique visual identity
// ============================================================================

export const WORLDS: WorldTheme[] = [
    {
        name: 'I. ONCHAIN', // world 1
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
        name: 'II. DEGEN',
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
        name: 'III. DIAMOND',
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
        name: 'IV. WHALE',
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
        name: 'V. MOON',
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
        name: 'VI. FOMO',
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
        name: 'VII. DARKPOOL',
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
        name: 'VIII. FLASHCRASH',
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
        name: 'IX. REKT',
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
        name: 'X. ASCENSION',
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
    { label: 'I. HODL', startScore: 0, multiplier: 1.05, color: '#A0B8F0', description: 'base speed', particleBoost: 0 },
    { label: 'II. PUMP', startScore: 400, multiplier: 1.18, color: '#0ECB81', description: 'speed up', particleBoost: 0 },
    { label: 'III. LEVERAGE', startScore: 1200, multiplier: 1.33, color: '#F0B90B', description: 'fast', particleBoost: 1 },
    { label: 'IV. MARGIN CALL', startScore: 2600, multiplier: 1.48, color: '#FF7B90', description: 'very fast', particleBoost: 2 },
    { label: 'V. LIQUIDATE', startScore: 4500, multiplier: 1.62, color: '#F6465D', description: 'danger', particleBoost: 3 },
    { label: 'VI. FOMO', startScore: 7000, multiplier: 1.78, color: '#C080FF', description: 'insane', particleBoost: 4 },
    { label: 'VII. 100X', startScore: 10000, multiplier: 1.88, color: '#FF00FF', description: 'lightspeed', particleBoost: 5 },
    { label: 'VIII. HYPERDRIVE', startScore: 14000, multiplier: 1.98, color: '#00FFFF', description: 'terminal velocity', particleBoost: 6 },
    { label: 'IX. SINGULARITY', startScore: 18000, multiplier: 2.15, color: '#FFFFFF', description: 'god mode', particleBoost: 8 },
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

/** Format score as crypto market-cap style: "$12,450" */
export const formatMarketCap = (score: number): string =>
    '$' + score.toLocaleString('en-US')

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
    nextSpawnDistance: IS_MOBILE ? 220 : 300,
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
    lastJumpTime: 0,
    marketState: 'neutral' as MarketState,
    marketTimer: 15,
    nearMissTimer: 0,
    nearMissText: '',
    rugPullTimer: 0,
    rugPullActive: false,
    speedLinesTimer: 0,
    comboPulseTimer: 0,
    prevSpeedTierIdx: 0,
    showTutorial: false,
    runCount: 0,
    cameraZoom: 1,
    runDustTimer: 0,
    nearMissX: 0,
    nearMissY: 0,
    rugPullHoles: [],
    spawnCount: 0,
    shieldFlashTimer: 0,
    moonBoostPulseActive: false,
})

// ============================================================================
// SPAWN PATTERNS — Massive variety, always beatable
// ============================================================================

/**
 * Spawn a pattern of candles at the right edge of the screen.
 * Patterns scale with difficulty (complexity 0-5).
 * All patterns are designed to be beatable with single or double jump.
 * Green candles ~25% frequency — they are valuable rewards.
 */
export const spawnPattern = (e: EngineState): void => {
    e.spawnCount++
    // Smooth exponential difficulty — no abrupt safe zone (item 1)
    const diff = 1 - Math.exp(-e.score / 2500)
    // Time-based warmup: first 8s is gentler
    const timeFactor = clamp(e.gameTime / 8, 0.4, 1.0)
    const effectiveDiff = diff * timeFactor
    // Smooth complexity ramp instead of hard 4-candle cutoff
    const complexity = Math.min(5, Math.floor(effectiveDiff * 6))
    const startX = CFG.WIDTH + 140
    const baseH = lerp(62, 105, diff)
    const baseW = lerp(22, 38, diff)
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
        // Moving candles earlier — from score 600 (was 900)
        if (moving || (e.score >= 600 && Math.random() < 0.12 * diff)) {
            candle.isMoving = true
            candle.moveAmplitude = rand(10, 24)
        }
        // Air candles earlier — from score 300 (was 500), higher chance
        if (e.score >= 300 && Math.random() < 0.20 * diff) {
            const lift = rand(20, 55)
            candle.bodyY -= lift; candle.y -= lift; candle.bodyTop -= lift
            candle.wickTop -= lift; candle.wickBottom -= lift
            candle.isMoving = true
            candle.moveAmplitude = rand(10, 22)
        }
        e.candles.push(candle)
    }

    // Pattern selection using weighted random — MORE GREEN CANDLES
    const roll = Math.random()

    // --- COMPLEXITY 0: Single candles with varied sizes from the start ---
    if (complexity === 0) {
        if (roll < 0.18) push(0, 'red', 0.7, 1.3)  // short wide
        else if (roll < 0.32) push(0, 'red', 0.6, 1.4)  // very short wide
        else if (roll < 0.46) push(0, 'red', 1.2, 0.7)  // tall narrow
        else if (roll < 0.58) push(0, 'red', 1.3, 0.6)  // very tall narrow
        else if (roll < 0.70) push(0, 'red', 0.85)  // normal short
        else if (roll < 0.82) push(0, 'red', 1.1)  // normal tall
        else if (roll < 0.90) push(0, 'red')  // normal
        else push(0, 'green')  // green reward (10%)

        // --- COMPLEXITY 1: Pairs with size variety ---
    } else if (complexity === 1) {
        if (roll < 0.10) { push(0, 'red', 0.7, 1.3); push(160, 'red', 1.2, 0.7) }  // wide + tall
        else if (roll < 0.20) { push(0, 'red', 0.85); push(145, 'red', 1.1) }
        else if (roll < 0.30) { push(0, 'red', 1.1); push(155, 'red', 0.8) }
        else if (roll < 0.40) { push(0, 'red', 0.6, 1.4); push(140, 'red', 1.3, 0.6) }  // extreme sizes
        else if (roll < 0.50) { push(0, 'red', 1.3, 0.6); push(130, 'red', 0.7, 1.3) }  // tall + short
        else if (roll < 0.60) { push(0, 'red'); push(130, 'red', 0.9) }
        else if (roll < 0.70) { push(0, 'green', 0.8, 1.2); push(145, 'red', 1.1) }  // wide green
        else if (roll < 0.78) { push(0, 'red', 1.05); push(150, 'red', 1.0) }
        else if (roll < 0.86) { push(0, 'green'); push(145, 'red', 1.1) }
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

    // Calculate gap — smooth ramp from generous to tight (item 1)
    const gapDiff = 1 - Math.exp(-e.score / 2500)
    const timeFac = clamp(e.gameTime / 8, 0.5, 1.0)
    const baseGap = lerp(CFG.BASE_SPAWN_GAP * 1.15, CFG.MIN_SPAWN_GAP, gapDiff * timeFac)
    e.nextSpawnDistance = e.distance + baseGap * rand(0.92, 1.12)

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

// ============================================================================
// ADAPTIVE PHYSICS SYSTEM
// ============================================================================

export function updateGameConfig(width: number, height: number) {
    const isPortrait = height > width;

    CFG.WIDTH = width;
    CFG.HEIGHT = height;

    if (isPortrait) {
        // --- PORTRAIT MODE (e.g. Base App / Mobile Vertical) ---
        // Push ground to bottom safely (leaving room for UI)
        CFG.GROUND = height * 0.83;

        // Push player far left for max reaction time
        CFG.PLAYER_X = width * 0.18;

        // Player size — slightly smaller for cleaner mobile feel
        CFG.PLAYER_SIZE = clamp(width * 0.07, 24, 36);
        CFG.HITBOX = CFG.PLAYER_SIZE * 0.22;

        // Physics logic requires lower speed on narrow screens
        const speedScale = clamp(width / 960, 0.45, 0.7);
        CFG.BASE_SPEED = clamp(360 * speedScale * 1.6, 220, 320);
        CFG.MAX_SPEED = clamp(680 * speedScale * 1.6, 400, 580);

        // Floatier gravity and jumps to compensate for lower speed
        const physicsScale = clamp(height / 540, 0.8, 1.4);
        CFG.GRAVITY = 2400 * physicsScale * 0.9;
        CFG.JUMP = -820 * Math.sqrt(physicsScale) * 0.95;
        CFG.DOUBLE_JUMP = -680 * Math.sqrt(physicsScale) * 0.95;
        CFG.MAX_FALL = 1200 * physicsScale;

        // Spawning needs to be tighter, but less dense for fun factor
        CFG.BASE_SPAWN_GAP = CFG.BASE_SPEED * 1.55;
        CFG.MIN_SPAWN_GAP = CFG.BASE_SPEED * 0.95;
        CFG.MAX_CANDLES_PATTERN = 2;

        // Visuals optimized for battery & narrow viewport
        CFG.PARTICLE_LIMIT = 40;
        CFG.TRAIL_LIMIT = 2;
        CFG.STAR_COUNT = 15;
        CFG.CLOUD_COUNT = 3;
        CFG.MAX_CANDLES = 6;
        CFG.GROUND_PARTICLE_COUNT = 8;

    } else {
        // --- LANDSCAPE MODE (Desktop / Tablet Horizontal) ---
        CFG.GROUND = height * 0.82;
        CFG.PLAYER_X = clamp(width * 0.2, 120, 220);
        CFG.PLAYER_SIZE = clamp(width * 0.045, 34, 46);
        CFG.HITBOX = CFG.PLAYER_SIZE * 0.25;

        // Scales natively by width
        const scale = clamp(width / 960, 0.6, 1.2);
        CFG.BASE_SPEED = 360 * scale;
        CFG.MAX_SPEED = 680 * scale;

        const physicsScale = clamp(height / 540, 0.8, 1.2);
        CFG.GRAVITY = 2400 * physicsScale;
        CFG.JUMP = -820 * Math.sqrt(physicsScale);
        CFG.DOUBLE_JUMP = -680 * Math.sqrt(physicsScale);
        CFG.MAX_FALL = 1200 * physicsScale;

        CFG.BASE_SPAWN_GAP = CFG.BASE_SPEED * 1.4;
        CFG.MIN_SPAWN_GAP = CFG.BASE_SPEED * 0.9;

        CFG.MAX_CANDLES_PATTERN = width < 768 ? 4 : 5;

        CFG.PARTICLE_LIMIT = width < 768 ? 60 : 140;
        CFG.TRAIL_LIMIT = width < 768 ? 4 : 7;
        CFG.STAR_COUNT = width < 768 ? 20 : 45;
        CFG.CLOUD_COUNT = width < 768 ? 4 : 6;
        CFG.MAX_CANDLES = width < 768 ? 10 : 16;
        CFG.GROUND_PARTICLE_COUNT = width < 768 ? 12 : 24;
    }
}

