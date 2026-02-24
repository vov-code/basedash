/**
 * ============================================================================
 * BASE DASH — Game Renderer
 * ============================================================================
 *
 * All canvas drawing operations: sky gradients, parallax layers, stars,
 * clouds, ground surfaces, floor patterns, trading-candle rendering,
 * player sprite, particles, trail effects, world banners.
 *
 * Zero shadowBlur calls — optimized for consistent 60fps.
 * ============================================================================
 */

import {
    type EngineState,
    type WorldTheme,
    type Candle,
    type Particle,
    type Star,
    type Cloud,
    type PowerUp,
    CFG,
    clamp,
    lerp,
    getWorld,
    getSpeed,
    POWERUP_CONFIG,
    MARKET_CONFIG,
    IS_MOBILE,
    formatMarketCap,
} from './gameConfig'

// ============================================================================
// DRAWING HELPERS
// ============================================================================

/** Pre-calculated constants to avoid per-frame division */
const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2
const PLAYER_HALF = CFG.PLAYER_SIZE / 2

/** Gradient cache to avoid recreating every frame */
let cachedSkyGrad: CanvasGradient | null = null
let cachedSkyWorldIdx = -1
let cachedGroundGrad: CanvasGradient | null = null
let cachedGroundWorldIdx = -1

const getSkyGradient = (
    ctx: CanvasRenderingContext2D,
    w: WorldTheme,
    worldIdx: number
): CanvasGradient => {
    if (cachedSkyGrad && cachedSkyWorldIdx === worldIdx) return cachedSkyGrad
    const g = ctx.createLinearGradient(0, 0, 0, CFG.GROUND)
    g.addColorStop(0, w.skyTop)
    g.addColorStop(0.45, w.skyMid)
    g.addColorStop(1, w.skyBottom)
    cachedSkyGrad = g
    cachedSkyWorldIdx = worldIdx
    return g
}

const getGroundGradient = (
    ctx: CanvasRenderingContext2D,
    w: WorldTheme,
    worldIdx: number,
    renderH: number = CFG.HEIGHT
): CanvasGradient => {
    if (cachedGroundGrad && cachedGroundWorldIdx === worldIdx) return cachedGroundGrad
    const g = ctx.createLinearGradient(0, CFG.GROUND, 0, renderH)
    g.addColorStop(0, w.groundTop)
    g.addColorStop(0.5, w.groundTop)
    g.addColorStop(1, '#FFFFFF')
    cachedGroundGrad = g
    cachedGroundWorldIdx = worldIdx
    return g
}

// ============================================================================
// SKY & BACKGROUND
// ============================================================================

/** Draw sky with smooth depth and scrolling grid — Geometry Dash premium */
export const drawSky = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.fillStyle = getSkyGradient(ctx, w, e.worldIndex)
    ctx.fillRect(0, -800, CFG.WIDTH, CFG.GROUND + 800)

    ctx.save()
    // === SCROLLING VERTICAL LINES ===
    ctx.strokeStyle = w.grid
    ctx.lineWidth = 0.5
    const gridSize = 50
    const offsetX = (e.backgroundOffset * 0.3) % gridSize
    for (let x = -offsetX; x < CFG.WIDTH + gridSize; x += gridSize) {
        ctx.globalAlpha = 0.12
        ctx.beginPath(); ctx.moveTo(x, -800); ctx.lineTo(x, CFG.GROUND); ctx.stroke()
    }

    // === SMOOTH HORIZONTAL DEPTH BANDS — GD parallax ===
    const bandCount = 5
    for (let i = 0; i < bandCount; i++) {
        const t = i / bandCount
        const y = CFG.GROUND * (0.3 + t * 0.7)
        ctx.globalAlpha = 0.03 + t * 0.08
        ctx.strokeStyle = w.grid
        ctx.lineWidth = 0.4 + t * 0.6
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(CFG.WIDTH, y)
        ctx.stroke()
    }

    // === BOTTOM GRADIENT FADE (sky-to-ground transition) ===
    const fadeH = CFG.GROUND * 0.15
    const fade = ctx.createLinearGradient(0, CFG.GROUND - fadeH, 0, CFG.GROUND)
    fade.addColorStop(0, 'rgba(255,255,255,0)')
    fade.addColorStop(1, 'rgba(255,255,255,0.08)')
    ctx.globalAlpha = 1
    ctx.fillStyle = fade
    ctx.fillRect(0, CFG.GROUND - fadeH, CFG.WIDTH, fadeH)

    ctx.restore()
}

// ============================================================================
// PARALLAX CLOUDS
// ============================================================================

/** Draw soft parallax cloud layers with inner depth */
export const drawClouds = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const c of e.clouds) {
        const x = ((c.x - e.cloudOffset * c.speed * 3) % (CFG.WIDTH + c.width * 2)) - c.width
        ctx.fillStyle = w.cloudColor

        // Main cloud body (3 overlapping ellipses)
        const rx = c.width * 0.3
        const ry = c.height * 0.4
        ctx.globalAlpha = c.alpha * 0.7
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.3, c.y + c.height * 0.5, rx, ry, 0, 0, TWO_PI)
        ctx.fill()
        ctx.globalAlpha = c.alpha
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.6, c.y + c.height * 0.35, rx * 1.2, ry * 1.1, 0, 0, TWO_PI)
        ctx.fill()
        ctx.globalAlpha = c.alpha * 0.6
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.85, c.y + c.height * 0.55, rx * 0.8, ry * 0.9, 0, 0, TWO_PI)
        ctx.fill()
    }
    ctx.restore()
}

// ============================================================================
// STARS / FLOATING DOTS
// ============================================================================

/** Draw twinkling stars — clean dots with subtle sparkle */
export const drawStars = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const s of e.stars) {
        const parallaxX = (s.x - e.backgroundOffset * s.depth * 0.15) % CFG.WIDTH
        const displayX = parallaxX < 0 ? parallaxX + CFG.WIDTH : parallaxX
        const twinkle = Math.sin(s.twinkle + e.gameTime * s.twinkleSpeed)
        const alpha = clamp((s.alpha + twinkle * 0.2) * 0.5, 0, 1)
        if (alpha <= 0.03) continue

        const displaySize = s.layer === 1 ? s.size : s.size * 1.3

        ctx.globalAlpha = alpha
        ctx.fillStyle = w.starColor
        ctx.beginPath()
        ctx.arc(displayX, s.y, displaySize, 0, TWO_PI)
        ctx.fill()

        // Minimal cross on bright stars
        if (displaySize > 1.3 && alpha > 0.25) {
            ctx.globalAlpha = alpha * 0.3
            ctx.strokeStyle = w.starColor
            ctx.lineWidth = 0.5
            const cs = displaySize * 2
            ctx.beginPath()
            ctx.moveTo(displayX - cs, s.y); ctx.lineTo(displayX + cs, s.y)
            ctx.moveTo(displayX, s.y - cs); ctx.lineTo(displayX, s.y + cs)
            ctx.stroke()
        }
    }
    ctx.restore()
}

// ============================================================================
// GROUND & FLOOR PATTERNS
// ============================================================================

/** Draw the ground surface with GD-style blocks and glowing top line */
export const drawGround = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    renderH: number
): void => {
    const groundH = renderH - CFG.GROUND

    // Ground gradient
    const gGrad = ctx.createLinearGradient(0, CFG.GROUND, 0, renderH)
    gGrad.addColorStop(0, w.groundTop)
    gGrad.addColorStop(0.4, w.groundTop)
    gGrad.addColorStop(1, '#FFFFFF')
    ctx.fillStyle = gGrad
    ctx.fillRect(0, CFG.GROUND, CFG.WIDTH, groundH)

    // === GROUND ACCENT LINE — smooth 3-layer glow ===
    ctx.save()
    // Wide outer glow
    const glowGrad = ctx.createLinearGradient(0, CFG.GROUND - 6, 0, CFG.GROUND + 4)
    glowGrad.addColorStop(0, 'rgba(0,0,0,0)')
    glowGrad.addColorStop(0.4, w.accent + '15')
    glowGrad.addColorStop(0.6, w.accent + '20')
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, CFG.GROUND - 6, CFG.WIDTH, 10)
    // Mid accent
    ctx.globalAlpha = 0.35 + Math.sin(e.gameTime * 2) * 0.05
    ctx.fillStyle = w.accent
    ctx.fillRect(0, CFG.GROUND - 1, CFG.WIDTH, 2)
    // Bright core line
    ctx.globalAlpha = 0.6
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, CFG.GROUND - 0.25, CFG.WIDTH, 0.5)
    ctx.restore()

    // === ANIMATED FLOOR PATTERN (world-specific) ===
    const fOff = (e.groundOffset * 0.5) % 60
    ctx.save()
    ctx.fillStyle = w.accent + '25'
    ctx.globalAlpha = 0.6
    drawFloorPattern(ctx, e, w, fOff, renderH)
    ctx.restore()
}

/** Draw floor pattern specific to current world */
const drawFloorPattern = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    fOff: number,
    renderH: number
): void => {
    const pattern = w.floorPattern

    if (pattern === 'grid' || pattern === 'diagonal') {
        // Simple 3D tech grid (fast to render)
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 50) {
            ctx.fillRect(x, CFG.GROUND, 1, renderH - CFG.GROUND)
            for (let y = CFG.GROUND; y < renderH; y += 30) {
                ctx.fillRect(x, y, 40, 1)
            }
        }
    } else if (pattern === 'dots' || pattern === 'hex' || pattern === 'circuit') {
        // Constellation dots
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 30) {
            for (let y = CFG.GROUND + 15; y < renderH; y += 25) {
                ctx.globalAlpha = 0.3 + Math.sin(e.gameTime * 2 + x * 0.05 + y * 0.03) * 0.15
                ctx.beginPath()
                ctx.arc(x, y, 2, 0, TWO_PI)
                ctx.fill()
            }
        }
    } else if (pattern === 'lines' || pattern === 'chevron' || pattern === 'waves') {
        // Speed lines
        for (let y = CFG.GROUND + 12; y < renderH; y += 18) {
            ctx.globalAlpha = 0.3
            ctx.fillRect(0, y, CFG.WIDTH, 1)
        }
    } else {
        // Default pulse
        const pulseCount = 4
        for (let i = 0; i < pulseCount; i++) {
            const radius = 20 + i * 45 + Math.sin(e.gameTime * 2 + i) * 5
            ctx.globalAlpha = clamp(0.15 - i * 0.03, 0.02, 0.15)
            ctx.strokeStyle = w.accent
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(CFG.WIDTH * 0.5 - fOff * 0.3, CFG.GROUND + 40, radius, 0, TWO_PI)
            ctx.stroke()
        }
    }
}

// ============================================================================
// GROUND PARTICLES
// ============================================================================

/** Draw floating ground particles with soft glow */
export const drawGroundParticles = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const gp of e.groundParticles) {
        const a = gp.alpha * (0.5 + Math.sin(gp.phase) * 0.3)
        // Soft glow halo
        ctx.globalAlpha = a * 0.3
        ctx.fillStyle = w.accent
        ctx.beginPath()
        ctx.arc(gp.x, gp.y, gp.size * 2.5, 0, TWO_PI)
        ctx.fill()
        // Core dot
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(gp.x, gp.y, gp.size, 0, TWO_PI)
        ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()
}

// ============================================================================
// TRADING CANDLE RENDERING
// ============================================================================

/**
 * Draw a single trading candle — Geometry Dash quality
 * Clean body with gradient, thin wick, subtle animation
 */
const drawSingleCandle = (
    ctx: CanvasRenderingContext2D,
    c: Candle,
    w: WorldTheme,
    gameTime: number
): void => {
    const isRed = c.kind === 'red'
    const a = isRed ? w.redA : w.greenA
    const b = isRed ? w.redB : w.greenB
    const drawY = c.collected ? c.y : c.bodyY
    const cx = c.x + c.width / 2
    const t = c.phase

    ctx.save()

    ctx.save()

    // ===== TRADING WICK (Tail/Shadow) =====
    // Thin, sharp line representing high/low trading prices
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = a
    ctx.lineWidth = 2
    ctx.lineCap = 'butt' // Sharp ends for trading charts
    ctx.beginPath()
    ctx.moveTo(cx, c.wickTop)
    ctx.lineTo(cx, c.wickBottom)
    ctx.stroke()
    ctx.globalAlpha = 1

    // ===== TRADING BODY (Open/Close) =====
    // Sharp rectangle with a premium terminal glow
    const bodyGrad = ctx.createLinearGradient(c.x, drawY, c.x + c.width, drawY)
    bodyGrad.addColorStop(0, b)
    bodyGrad.addColorStop(0.5, a)
    bodyGrad.addColorStop(1, b)

    ctx.fillStyle = bodyGrad
    ctx.fillRect(c.x, drawY, c.width, c.bodyHeight)

    // Inner bright streak for "neon tube" or digital terminal screen effect
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.15
    ctx.fillRect(c.x + c.width * 0.2, drawY, c.width * 0.6, c.bodyHeight)
    ctx.globalAlpha = 1

    // Sharp outer border
    ctx.strokeStyle = b
    ctx.lineWidth = 1
    ctx.strokeRect(c.x, drawY, c.width, c.bodyHeight)

    // ===== ANIMATED PULSE (subtle) =====
    if (!c.collected) {
        ctx.globalAlpha = 0.05 + Math.sin(t * 2.5) * 0.02
        ctx.strokeStyle = a
        ctx.lineWidth = 1
        ctx.strokeRect(c.x - 2, drawY - 2, c.width + 4, c.bodyHeight + 4)
    }

    // ===== COLLECTION ANIMATION =====
    if (c.collected && c.collectProgress < 1) {
        const prog = c.collectProgress
        const ease = 1 - (1 - prog) * (1 - prog)
        ctx.globalAlpha = (1 - ease) * 0.3
        ctx.strokeStyle = a
        ctx.lineWidth = 1.5 * (1 - ease)
        ctx.beginPath()
        ctx.arc(cx, c.bodyY + c.bodyHeight / 2, c.width * (0.5 + ease * 2.5), 0, TWO_PI)
        ctx.stroke()
        ctx.globalAlpha = (1 - ease) * 0.8
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `700 ${CFG.WIDTH < 600 ? 13 : 11}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('+' + CFG.GREEN_SCORE, cx, c.bodyY - ease * 22 - 6)
    }

    ctx.restore()
}

/** Draw all candles */
export const drawCandles = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    for (const c of e.candles) {
        if (c.collected && c.collectProgress >= 1) continue
        drawSingleCandle(ctx, c, w, e.gameTime)
    }
}

// ============================================================================
// POWER-UP RENDERING
// ============================================================================

/** Draw a single power-up with crypto-themed visuals */
const drawSinglePowerUp = (
    ctx: CanvasRenderingContext2D,
    pu: PowerUp,
    gameTime: number
): void => {
    const config = POWERUP_CONFIG.TYPES[pu.kind]
    const bobY = Math.sin(pu.phase + gameTime * pu.bobSpeed) * POWERUP_CONFIG.BOB_AMPLITUDE
    const cx = pu.x + pu.size / 2
    const cy = pu.y + bobY
    const glowAlpha = 0.2 + Math.sin(pu.glowPhase + gameTime * 3) * 0.15

    ctx.save()

    if (pu.collected) {
        // Collection animation
        const prog = pu.collectProgress
        ctx.globalAlpha = (1 - prog) * 0.8
        ctx.strokeStyle = config.color1
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, pu.size * (0.8 + prog * 3), 0, TWO_PI)
        ctx.stroke()
        // Float label
        ctx.fillStyle = config.color1
        ctx.font = `700 ${CFG.WIDTH < 600 ? 14 : 10}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(config.label.split(' ')[0], cx, cy - prog * 30 - 10)
        ctx.restore()
        return
    }

    // === OUTER GLOW RING WITH ROTATING SEGMENTS ===
    ctx.globalAlpha = glowAlpha
    ctx.strokeStyle = config.color1
    ctx.lineWidth = 2

    // Rotating segmented ring (crypto coin style)
    const segmentCount = 8
    const rotation = gameTime * 0.5
    for (let i = 0; i < segmentCount; i++) {
        const startAngle = (i / segmentCount) * TWO_PI + rotation
        const endAngle = startAngle + (0.15 * TWO_PI / segmentCount)
        ctx.beginPath()
        ctx.arc(cx, cy, pu.size * 0.7, startAngle, endAngle)
        ctx.stroke()
    }

    // === INNER CIRCLE WITH GRADIENT ===
    ctx.globalAlpha = 0.9
    const r = pu.size * 0.42
    const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    innerGrad.addColorStop(0, config.color1)
    innerGrad.addColorStop(0.6, config.color2)
    innerGrad.addColorStop(1, config.color1)
    ctx.fillStyle = innerGrad

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, TWO_PI)
    ctx.fill()

    // White border
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // === CRYPTO-THEMED ICONS (EMOJI OTIMIZED) ===
    ctx.save()
    ctx.translate(cx, cy)
    ctx.font = `${r * 1.2}px "Twemoji Mozilla", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(config.symbol, 0, r * 0.1)
    ctx.restore()

    // === ORBITING PARTICLES ===
    ctx.save()
    ctx.globalAlpha = 0.5 + Math.sin(gameTime * 3) * 0.3
    ctx.fillStyle = config.color1
    const orbitRadius = r * 1.4
    const orbitSpeed = gameTime * (pu.kind === 'moon_boost' ? 2 : 1)
    for (let i = 0; i < 3; i++) {
        const angle = orbitSpeed + (i * TWO_PI / 3)
        const ox = cx + Math.cos(angle) * orbitRadius
        const oy = cy + Math.sin(angle) * orbitRadius
        ctx.beginPath()
        ctx.arc(ox, oy, pu.size * 0.08, 0, TWO_PI)
        ctx.fill()
    }
    ctx.restore()

    ctx.restore()
}

/** Draw all power-ups */
export const drawPowerUps = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    for (const pu of e.powerUps) {
        if (pu.collected && pu.collectProgress >= 1) continue
        drawSinglePowerUp(ctx, pu, e.gameTime)
    }
}

// ============================================================================
// ACTIVE POWER-UP INDICATORS
// ============================================================================

/** Draw active power-up indicators — Compact & clean */
export const drawPowerUpIndicators = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    const indicators: { type: string; color: string; timer: number; maxTime: number }[] = []
    if (e.shieldActive) indicators.push({ type: 'diamond', color: '#00D4FF', timer: 1, maxTime: 1 })
    if (e.moonBoostTimer > 0) indicators.push({ type: 'rocket', color: '#FFD700', timer: e.moonBoostTimer, maxTime: 5 })
    if (e.whaleTimer > 0) indicators.push({ type: 'whale', color: '#7B68EE', timer: e.whaleTimer, maxTime: 4 })

    if (indicators.length === 0) return

    ctx.save()
    let offsetX = 8
    for (const ind of indicators) {
        const y = CFG.GROUND - 32  // Чуть выше
        const boxW = 48  // Меньше ширина
        const boxH = 22  // Меньше высота

        // Background
        ctx.globalAlpha = 0.95
        ctx.fillStyle = 'rgba(10,10,20,0.95)'
        ctx.strokeStyle = ind.color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(offsetX, y, boxW, boxH, 6)
        ctx.fill()
        ctx.stroke()

        // Progress bar (timer)
        const progress = ind.timer / ind.maxTime
        ctx.globalAlpha = 0.3
        ctx.fillStyle = ind.color
        ctx.beginPath()
        ctx.roundRect(offsetX + 2, y + boxH - 4, (boxW - 4) * progress, 2, 1)
        ctx.fill()

        // Icon
        ctx.globalAlpha = 1
        ctx.fillStyle = ind.color
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const icon = ind.type === 'diamond' ? '💎' : ind.type === 'rocket' ? '🚀' : '🐋'
        ctx.fillText(icon, offsetX + boxW / 2, y + boxH / 2 - 2)

        offsetX += boxW + 4
    }
    ctx.restore()
}

// ============================================================================
// PLAYER TRAIL (with trail type effects)
// ============================================================================

/** Get trail color based on trail type and index */
const getTrailColor = (trailType: string, gameTime: number, i: number): string => {
    switch (trailType) {
        case 'fire':
            return i % 3 === 0 ? '#FF4500' : i % 3 === 1 ? '#FF8C00' : '#FFD700'
        case 'rainbow': {
            const hue = (gameTime * 120 + i * 40) % 360
            return `hsl(${hue}, 90%, 60%)`
        }
        case 'neon':
            return i % 2 === 0 ? '#00FFFF' : '#FF00FF'
        default:
            return '#0052FF'
    }
}

/** Draw player ghost trail with visual effects */
export const drawTrail = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    logo: HTMLImageElement | null,
    logoLoaded: boolean
): void => {
    const trailType = e.activeTrail

    for (let i = 0; i < e.player.trail.length; i++) {
        const t = e.player.trail[i]
        const trailAlpha = t.alpha * t.life

        if (trailType === 'default') {
            // Original trail - properly centered and anchoring to the player geometry
            const rot = t.rotation
            const drawY = t.y + PLAYER_HALF

            // Continuous physically logical motion trail: scales out slightly and fades rapidly
            const scaleAnim = t.scale * (0.85 + (t.life * 0.15))

            ctx.globalAlpha = trailAlpha * 0.7 // Brighter trail base
            ctx.save()
            ctx.translate(CFG.PLAYER_X + PLAYER_HALF, drawY)
            ctx.rotate(rot)
            ctx.scale(scaleAnim, scaleAnim)
            if (logoLoaded && logo) {
                ctx.drawImage(logo, -PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
            } else {
                ctx.fillStyle = w.accent
                ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
            }
            ctx.restore()
        } else {
            // Styled trails — glowing colored shapes
            const color = getTrailColor(trailType, e.gameTime, i)
            const rot = t.rotation
            const drawY = t.y + PLAYER_HALF

            ctx.save()
            ctx.globalAlpha = trailAlpha * 0.8
            ctx.translate(CFG.PLAYER_X + PLAYER_HALF, drawY)
            ctx.rotate(rot)
            ctx.scale(t.scale * (0.6 + t.life * 0.4), t.scale * (0.6 + t.life * 0.4))

            // Outer glow
            ctx.fillStyle = color
            ctx.globalAlpha = trailAlpha * 0.3
            ctx.beginPath()
            ctx.arc(0, 0, PLAYER_HALF + 4, 0, TWO_PI)
            ctx.fill()

            // Inner shape
            ctx.globalAlpha = trailAlpha * 0.7
            ctx.fillStyle = color
            if (trailType === 'fire') {
                // Flame-like teardrop
                ctx.beginPath()
                ctx.moveTo(0, -PLAYER_HALF * 0.8)
                ctx.quadraticCurveTo(PLAYER_HALF * 0.8, 0, 0, PLAYER_HALF * 0.6)
                ctx.quadraticCurveTo(-PLAYER_HALF * 0.8, 0, 0, -PLAYER_HALF * 0.8)
                ctx.closePath()
                ctx.fill()
            } else if (trailType === 'neon') {
                // Neon ring
                ctx.strokeStyle = color
                ctx.lineWidth = 3
                ctx.beginPath()
                ctx.arc(0, 0, PLAYER_HALF * 0.7, 0, TWO_PI)
                ctx.stroke()
            } else {
                // Rainbow diamond
                const s = PLAYER_HALF * 0.7
                ctx.beginPath()
                ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0)
                ctx.closePath()
                ctx.fill()
            }

            ctx.restore()
        }
    }
    ctx.globalAlpha = 1
}

// ============================================================================
// PLAYER SPRITE
// ============================================================================

/** Draw the player cube — premium quality with clean shadow */
export const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    logo: HTMLImageElement | null,
    logoLoaded: boolean
): void => {
    const p = e.player
    const rot = p.rotation

    // EXACT ground positioning - NO GAP
    let drawY = p.y + PLAYER_HALF
    const heightAboveGround = CFG.GROUND - (p.y + CFG.PLAYER_SIZE)

    // PERFECT seat on ground - zero tolerance
    if (heightAboveGround <= 1) {
        drawY = CFG.GROUND - PLAYER_HALF  // EXACT - no visual gap
    } else {
        // Airborne - prevent corner clipping
        const boundOffset = PLAYER_HALF * p.scale * (Math.abs(Math.sin(rot)) + Math.abs(Math.cos(rot)))
        const lowestVisualPoint = drawY + boundOffset
        if (lowestVisualPoint > CFG.GROUND) {
            drawY -= (lowestVisualPoint - CFG.GROUND)
        }
    }

    // === GROUND SHADOW (only when airborne) ===
    if (heightAboveGround > 10) {
        const shadowScale = clamp(1 - heightAboveGround / 180, 0.25, 1)
        ctx.save()
        ctx.globalAlpha = 0.08 * shadowScale
        ctx.fillStyle = '#000'
        const sw = CFG.PLAYER_SIZE * shadowScale * 1.05
        const sh = 2 * shadowScale + 1
        const sx = CFG.PLAYER_X + PLAYER_HALF - sw / 2
        const sy = CFG.GROUND - sh + 0.5
        ctx.beginPath()
        ctx.roundRect(sx, sy, sw, sh, sh / 2)
        ctx.fill()
        ctx.restore()
    }

    ctx.save()
    ctx.translate(CFG.PLAYER_X + PLAYER_HALF, drawY)
    ctx.rotate(rot)
    ctx.scale(p.scale, p.scale)
    ctx.translate(p.tilt * 8, 0)

    // === DROP SHADOW (offset behind body) ===
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#000'
    ctx.fillRect(-PLAYER_HALF + 1.5, -PLAYER_HALF + 1.5, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    ctx.globalAlpha = 1

    // === PLAYER BODY — SHARP rendering ===
    if (logoLoaded && logo) {
        // Disable smoothing for sharp logo
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(logo, -PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
        ctx.imageSmoothingEnabled = true
    } else {
        // Sharp edges - no anti-aliasing tricks
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
        ctx.fillStyle = w.accent
        ctx.fillRect(-PLAYER_HALF + 3, -PLAYER_HALF + 3, CFG.PLAYER_SIZE - 6, CFG.PLAYER_SIZE - 6)
    }

    // === SUBTLE EDGE HIGHLIGHTS ===
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, 1.5)
    ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, 1.5, CFG.PLAYER_SIZE)

    // Dash effect — smooth streak lines
    if (p.isDashing) {
        ctx.strokeStyle = w.accent
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        for (let i = 1; i <= 3; i++) {
            const lx = -PLAYER_HALF - i * 7
            ctx.globalAlpha = 0.35 - i * 0.1
            ctx.beginPath()
            ctx.moveTo(lx, -PLAYER_HALF + 4)
            ctx.lineTo(lx, PLAYER_HALF - 4)
            ctx.stroke()
        }
    }

    // Flash effect on damage / collection
    if (p.flash > 0) {
        ctx.globalAlpha = p.flash * 0.5
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    }

    ctx.globalAlpha = 1
    ctx.restore()
}

// ============================================================================
// PARTICLES
// ============================================================================

/** Draw all active particles — Crypto themed */
export const drawParticles = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    ctx.save()
    for (const pt of e.particles) {
        const lifeRatio = clamp(pt.life / pt.maxLife, 0, 1)
        ctx.save()
        ctx.globalAlpha = lifeRatio * pt.alpha

        ctx.translate(pt.x, pt.y)
        ctx.rotate(pt.rotation)

        const sz = pt.size * (pt.type === 'ring' ? 1 : lifeRatio)

        if (pt.type === 'ring') {
            // Ring particle — expanding crypto coin outline
            ctx.strokeStyle = pt.color
            ctx.lineWidth = 1.5 * lifeRatio
            ctx.beginPath()
            ctx.arc(0, 0, sz * (2 - lifeRatio), 0, TWO_PI)
            ctx.stroke()
            // Inner ring
            ctx.globalAlpha *= 0.4
            ctx.beginPath()
            ctx.arc(0, 0, sz * (1 - lifeRatio * 0.5), 0, TWO_PI)
            ctx.stroke()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'spark') {
            // Spark — diamond shape
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.moveTo(0, -sz)
            ctx.lineTo(sz * 0.6, 0)
            ctx.lineTo(0, sz)
            ctx.lineTo(-sz * 0.6, 0)
            ctx.closePath()
            ctx.fill()
            // Shine
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.6
            ctx.beginPath()
            ctx.arc(-sz * 0.2, -sz * 0.2, sz * 0.2, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'glow') {
            // Glow — radial gradient orb
            const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz)
            glowGrad.addColorStop(0, pt.color)
            glowGrad.addColorStop(0.5, pt.color + '80')
            glowGrad.addColorStop(1, pt.color + '00')
            ctx.fillStyle = glowGrad
            ctx.beginPath()
            ctx.arc(0, 0, sz, 0, TWO_PI)
            ctx.fill()
        } else if (pt.type === 'star') {
            // Star — crypto sparkle with 8 points
            ctx.fillStyle = pt.color
            ctx.beginPath()
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TWO_PI
                const r = i % 2 === 0 ? sz : sz * 0.4
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
            }
            ctx.closePath()
            ctx.fill()
            // Center glow
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.5
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.3, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'burst') {
            // Burst — exploding crypto coin fragments
            ctx.fillStyle = pt.color
            ctx.globalAlpha *= 0.8
            // Outer square
            const bs = sz * 1.5
            ctx.fillRect(-bs / 2, -bs / 2, bs, bs)
            // Inner fragment
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.5
            const is = sz * 0.6
            ctx.fillRect(-is / 2, -is / 2, is, is)
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'trail') {
            // Trail — fading crypto dot with gradient
            const trailGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.7)
            trailGrad.addColorStop(0, pt.color)
            trailGrad.addColorStop(1, pt.color + '00')
            ctx.fillStyle = trailGrad
            ctx.globalAlpha *= 0.6
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.7, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'collect') {
            // Collect — rising coin sparkle
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.arc(0, 0, sz, 0, TWO_PI)
            ctx.fill()
            // Dollar/crypto symbol hint
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.7
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.5, 0, TWO_PI)
            ctx.fill()
            // Outer sparkle rays
            ctx.globalAlpha = lifeRatio * pt.alpha * 0.4
            ctx.strokeStyle = pt.color
            ctx.lineWidth = 1
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * TWO_PI + pt.rotation
                ctx.beginPath()
                ctx.moveTo(Math.cos(angle) * sz * 1.2, Math.sin(angle) * sz * 1.2)
                ctx.lineTo(Math.cos(angle) * sz * 1.8, Math.sin(angle) * sz * 1.8)
                ctx.stroke()
            }
        } else if (pt.type === 'death') {
            // Death — liquidation explosion fragments
            ctx.fillStyle = pt.color
            const ds = sz * 1.3
            // Main fragment
            ctx.fillRect(-ds / 2, -ds / 2, ds, ds)
            // Cracked pieces
            ctx.globalAlpha *= 0.6
            const fs = sz * 0.5
            ctx.fillRect(-ds, -ds, fs, fs)
            ctx.fillRect(ds * 0.5, -ds * 0.5, fs, fs)
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'jump') {
            // Jump dust — ground impact particles
            ctx.fillStyle = pt.color
            ctx.globalAlpha *= 0.5
            ctx.beginPath()
            ctx.ellipse(0, 0, sz * 1.2, sz * 0.6, 0, 0, TWO_PI)
            ctx.fill()
            // Secondary puffs
            ctx.globalAlpha *= 0.4
            ctx.beginPath()
            ctx.arc(-sz * 0.5, -sz * 0.3, sz * 0.5, 0, TWO_PI)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(sz * 0.5, -sz * 0.3, sz * 0.5, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'powerup') {
            // Powerup — special crypto burst
            ctx.fillStyle = pt.color
            ctx.beginPath()
            // Star burst shape
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * TWO_PI + pt.rotation
                const outerR = sz * 1.5
                const innerR = sz * 0.6
                ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
                ctx.lineTo(Math.cos(angle + Math.PI / 6) * innerR, Math.sin(angle + Math.PI / 6) * innerR)
            }
            ctx.closePath()
            ctx.fill()
            // Center glow
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.6
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.4, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else if (pt.type === 'dust' || pt.type === 'smoke' || pt.type === 'ground') {
            // Generic — floating dust with gradient
            ctx.globalAlpha *= 0.5
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.arc(0, 0, sz, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = lifeRatio * pt.alpha
        } else {
            // Default — crypto diamond
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.moveTo(0, -sz * 0.8)
            ctx.lineTo(sz * 0.5, 0)
            ctx.lineTo(0, sz * 0.8)
            ctx.lineTo(-sz * 0.5, 0)
            ctx.closePath()
            ctx.fill()
        }

        ctx.restore()
    }
    ctx.restore()
    ctx.globalAlpha = 1
}

// ============================================================================
// WORLD BANNER
// ============================================================================

/** Draw the world transition banner — positioned lower to avoid HUD overlap */
export const drawWorldBanner = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    if (e.worldBannerTimer <= 0) return

    const duration = 2.5
    const progress = clamp(e.worldBannerTimer / duration, 0, 1)

    // Entrance: slide down + scale in (first 0.3s)
    // Hold: stay visible
    // Exit: fade out (last 0.5s)
    const enterT = clamp(1 - (e.worldBannerTimer - (duration - 0.4)) / 0.4, 0, 1)
    const exitT = clamp(e.worldBannerTimer / 0.6, 0, 1)
    const enter = 1 - (1 - enterT) * (1 - enterT) // ease-out
    const alpha = Math.min(enter, exitT)

    if (alpha <= 0.01) return

    ctx.save()
    ctx.globalAlpha = alpha

    // Banner dimensions — compact, positioned lower
    const bw = Math.min(160, CFG.WIDTH * 0.45)
    const bh = 24
    const bx = CFG.WIDTH / 2 - bw / 2
    const slideY = -15 + enter * 15
    const by = 45 + slideY  // Moved down from 24 to 45 to avoid HUD overlap

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 6)
    ctx.fill()

    // Subtle border
    ctx.globalAlpha = alpha * 0.8
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 6)
    ctx.stroke()
    ctx.globalAlpha = alpha

    // World name
    ctx.fillStyle = '#64748b' // slate-500
    const fontSize = 10
    ctx.font = `600 ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '1px'
    ctx.fillText(`entering ${w.name.toLowerCase()}`, CFG.WIDTH / 2, by + bh / 2 + 1)

    ctx.restore()
}

// ============================================================================
// SCREEN SHAKE
// ============================================================================

/** Apply screen shake transformation */
export const applyShake = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    if (e.shakeTimer > 0) {
        ctx.translate(e.shakeX, e.shakeY)
    }
}

// ============================================================================
// NEAR-MISS TEXT (7.1)
// ============================================================================

/** Draw floating "close" text when near-miss triggers — minimal & clean */
export const drawNearMissText = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    if (e.nearMissTimer <= 0) return
    const alpha = clamp(e.nearMissTimer / MARKET_CONFIG.NEAR_MISS_DURATION, 0, 1)
    const floatY = e.nearMissY - (1 - alpha) * 15

    ctx.save()
    ctx.globalAlpha = alpha * 0.9
    // Minimal white text with subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 ${CFG.WIDTH < 600 ? 13 : 11}px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0.15em'
    ctx.fillText(e.nearMissText, e.nearMissX, floatY)
    ctx.restore()
}

// ============================================================================
// SPEED LINES (7.2)
// ============================================================================

/** Draw horizontal speed lines on tier change */
export const drawSpeedLines = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    renderH: number
): void => {
    if (e.speedLinesTimer <= 0) return
    const alpha = clamp(e.speedLinesTimer / 1.5, 0, 1)
    const lineCount = IS_MOBILE ? 6 : 10

    ctx.save()
    ctx.globalAlpha = alpha * 0.5
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1.5

    for (let i = 0; i < lineCount; i++) {
        const y = (renderH / (lineCount + 1)) * (i + 1)
        const progress = (1 - alpha) * CFG.WIDTH
        const startX = CFG.WIDTH / 2 - progress * 0.5
        const endX = CFG.WIDTH / 2 + progress * 0.5
        ctx.beginPath()
        ctx.moveTo(startX, y + (Math.random() - 0.5) * 8)
        ctx.lineTo(endX, y + (Math.random() - 0.5) * 8)
        ctx.stroke()
    }
    ctx.restore()
}

// ============================================================================
// COMBO PULSE BORDER (7.3)
// ============================================================================

/** Draw blue border glow when combo hits x5 milestones */
export const drawComboPulse = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    renderH: number
): void => {
    if (e.comboPulseTimer <= 0) return
    const alpha = clamp(e.comboPulseTimer / 0.5, 0, 1)
    const thickness = 3 + alpha * 4

    ctx.save()
    ctx.globalAlpha = alpha * 0.6
    ctx.strokeStyle = '#0052FF'
    ctx.lineWidth = thickness
    ctx.strokeRect(0, 0, CFG.WIDTH, renderH)
    // Inner glow
    ctx.globalAlpha = alpha * 0.2
    ctx.strokeStyle = '#88CCFF'
    ctx.lineWidth = thickness * 2
    ctx.strokeRect(2, 2, CFG.WIDTH - 4, renderH - 4)
    ctx.restore()
}

// ============================================================================
// TUTORIAL HINT (6.3)
// ============================================================================

/** Draw pulsing "[ TAP TO TRADE ]" hint during tutorial phase */
export const drawTutorialHint = (
    ctx: CanvasRenderingContext2D,
    e: EngineState
): void => {
    if (!e.showTutorial) return

    // Fade out after 3.5 seconds
    if (e.gameTime > 3.5) {
        e.showTutorial = false
        return
    }

    const fade = clamp(1 - (e.gameTime / 3.5), 0, 1)
    const pulse = 0.5 + Math.sin(e.gameTime * 6) * 0.5

    ctx.save()
    ctx.globalAlpha = fade

    const cx = CFG.WIDTH / 2
    const cy = CFG.HEIGHT * 0.35

    // Minimalist text
    ctx.fillStyle = '#0052FF'
    ctx.font = `600 ${CFG.WIDTH < 600 ? 11 : 14}px monospace`
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText('TAP TO JUMP', cx, cy)

    // Pulsing minimal indicator below text
    ctx.globalAlpha = fade * pulse
    ctx.beginPath()
    ctx.arc(cx, cy + 14, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
}

// ============================================================================
// MARKET INDICATOR — REMOVED (bull/bear mechanics disabled)
// ============================================================================

/** Draw market state indicator pill — DISABLED */
// Market mechanics and rug pull removed

// ============================================================================
// MAIN DRAW COMPOSITE
// ============================================================================

/* *
 * @param ctx 2D Context
 * @param e Engine State
 * @param containerDims { w: logicalW, h: logicalH, dpr: DPR, cssW?: number, cssH?: number }
 * @param logo Player image ref
 * @param logoLoaded Is logo loaded
 */
export const drawFrame = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    containerDims: { w: number, h: number, dpr: number, cssW?: number, cssH?: number },
    logo: HTMLImageElement | null,
    logoLoaded: boolean = true
): void => {
    const { w, h, dpr, cssW, cssH } = containerDims
    const wTheme = getWorld(Math.max(0, e.score))

    ctx.save()

    // 1) Apply DPR scale universally
    ctx.scale(dpr, dpr)

    // 2) Scale to prevent squishing and handle variable DOM height safely
    let renderH = CFG.HEIGHT;
    if (cssW && cssH) {
        const scaleX = cssW / CFG.WIDTH;
        const scaleY = cssH / CFG.HEIGHT;
        let scale = scaleX;

        if (CFG.HEIGHT * scale > cssH) {
            // Container is wide (16:9 shape horizontally). The 4:3 game overflows vertically.
            const extraH = CFG.HEIGHT * scale - cssH;

            // User requested: "trim ground height by 10%".
            const groundH = CFG.HEIGHT - CFG.GROUND; // usually 110px. 10% = 11px logical.
            const bottomCropPixels = (groundH * 0.10) * scale;

            // The rest is trimmed from the sky (top):
            const topCropPixels = extraH - bottomCropPixels;

            // Offset Y moves the canvas UP to hide the top sky, 
            // leaving exactly down to the -10% trimmed ground.
            const offsetY = -(topCropPixels) / scale;
            ctx.translate(0, offsetY);
        } else {
            // Container is tall (9:16)
            // Zoom in slightly so we cut sky and ground symmetrically, instead of just stretching sky/ground
            const zoomFactor = 0.55;
            scale = scaleX + (scaleY - scaleX) * zoomFactor;

            // Width overflows because we zoomed, center it horizontally
            const offsetX = (cssW - CFG.WIDTH * scale) / 2 / scale;
            ctx.translate(offsetX, 0);

            renderH = cssH / scale;
            const extraH = renderH - CFG.HEIGHT;

            // Push camera down vertically to balance crop (cuts a bit more sky than ground)
            const shiftDown = Math.max(0, extraH * 0.4);
            ctx.translate(0, shiftDown);

            // Render more to cover the offset shift
            renderH += shiftDown * 2;
        }
        ctx.scale(scale, scale);
    }

    // Clear with cached world sky gradient (prevents black background)
    ctx.fillStyle = getSkyGradient(ctx, wTheme, e.worldIndex)
    ctx.fillRect(0, 0, CFG.WIDTH, renderH)

    // Camera shake + zoom (7.4)
    ctx.save()
    applyShake(ctx, e)
    if (e.cameraZoom < 1) {
        const cx = CFG.WIDTH / 2
        const cy = renderH / 2
        ctx.translate(cx, cy)
        ctx.scale(e.cameraZoom, e.cameraZoom)
        ctx.translate(-cx, -cy)
    }

    // Background layers
    drawSky(ctx, e, wTheme)
    drawClouds(ctx, e, wTheme)
    drawStars(ctx, e, wTheme)

    // Ground
    drawGround(ctx, e, wTheme, renderH)
    drawGroundParticles(ctx, e, wTheme)

    // Game objects
    drawCandles(ctx, e, wTheme)
    drawPowerUps(ctx, e)

    // Player
    drawTrail(ctx, e, wTheme, logo, logoLoaded)
    drawPlayer(ctx, e, wTheme, logo, logoLoaded)

    // Effects
    drawParticles(ctx, e)

    // Near-miss text (7.1)
    drawNearMissText(ctx, e)

    // Speed lines (7.2)
    drawSpeedLines(ctx, e, renderH)

    // Combo pulse border (7.3)
    drawComboPulse(ctx, e, renderH)

    // Tutorial hint (6.3)
    drawTutorialHint(ctx, e)

    // UI (canvas-rendered)
    drawWorldBanner(ctx, e, wTheme)
    drawPowerUpIndicators(ctx, e)

    // End shake + zoom transform
    ctx.restore()

    // Shield flash overlay (item 4)
    if (e.shieldFlashTimer > 0) {
        const flashAlpha = clamp(e.shieldFlashTimer / 0.3, 0, 1) * 0.6
        ctx.save()
        ctx.globalAlpha = flashAlpha
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, CFG.WIDTH, renderH)
        ctx.restore()
    }

    // Moon boost golden pulse border (item 4)
    if (e.moonBoostPulseActive && e.moonBoostTimer > 0) {
        const pulse = 0.3 + Math.sin(e.gameTime * 6) * 0.2
        ctx.save()
        ctx.globalAlpha = pulse
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 4 + Math.sin(e.gameTime * 8) * 2
        ctx.strokeRect(0, 0, CFG.WIDTH, renderH)
        // Inner golden glow
        ctx.globalAlpha = pulse * 0.3
        ctx.strokeStyle = '#FFA500'
        ctx.lineWidth = 8
        ctx.strokeRect(2, 2, CFG.WIDTH - 4, renderH - 4)
        ctx.restore()
    }

    // World-specific edge effects (item 7)
    if (wTheme.name.includes('FLASHCRASH') || e.worldIndex === 7) {
        // Red static noise strips along edges
        ctx.save()
        ctx.globalAlpha = 0.06 + Math.sin(e.gameTime * 12) * 0.03
        ctx.fillStyle = '#FF3050'
        for (let y = 0; y < renderH; y += 4) {
            const w1 = 3 + Math.random() * 8
            ctx.fillRect(0, y, w1, 2)
            ctx.fillRect(CFG.WIDTH - w1, y, w1, 2)
        }
        ctx.restore()
    }
    if (wTheme.name.includes('REKT') || e.worldIndex === 8) {
        // Red vignette
        ctx.save()
        const vig = ctx.createRadialGradient(
            CFG.WIDTH / 2, renderH / 2, CFG.WIDTH * 0.3,
            CFG.WIDTH / 2, renderH / 2, CFG.WIDTH * 0.7
        )
        vig.addColorStop(0, 'rgba(255,0,0,0)')
        vig.addColorStop(1, 'rgba(255,0,0,0.08)')
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, CFG.WIDTH, renderH)
        ctx.restore()
    }
}
