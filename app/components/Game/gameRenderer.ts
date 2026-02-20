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
    CFG,
    clamp,
    lerp,
    getWorld,
    getSpeed,
    IS_MOBILE,
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

/**
 * Create or return cached sky gradient for current world.
 */
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

// ============================================================================
// SKY & BACKGROUND
// ============================================================================

/** Draw sky gradient and subtle grid pattern */
export const drawSky = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    // Sky gradient
    ctx.fillStyle = getSkyGradient(ctx, w, e.worldIndex)
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.GROUND)

    // Subtle moving grid
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.strokeStyle = w.grid
    ctx.lineWidth = 0.5
    const gridSize = 50
    const offsetX = (e.backgroundOffset * 0.35) % gridSize
    const offsetY = (e.gameTime * 12) % gridSize

    for (let x = -offsetX; x < CFG.WIDTH + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.GROUND); ctx.stroke()
    }
    for (let y = -offsetY; y < CFG.GROUND + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.WIDTH, y); ctx.stroke()
    }
    ctx.restore()
}

// ============================================================================
// PARALLAX CLOUDS
// ============================================================================

/** Draw soft parallax cloud layers */
export const drawClouds = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const c of e.clouds) {
        const x = ((c.x - e.cloudOffset * c.speed) % (CFG.WIDTH + c.width * 2)) - c.width
        ctx.globalAlpha = c.alpha
        ctx.fillStyle = w.cloudColor

        // Soft rounded rectangle cloud shape
        const rx = c.width * 0.3
        const ry = c.height * 0.4
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.3, c.y + c.height * 0.5, rx, ry, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.6, c.y + c.height * 0.35, rx * 1.2, ry * 1.1, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(x + c.width * 0.85, c.y + c.height * 0.55, rx * 0.8, ry * 0.9, 0, 0, TWO_PI)
        ctx.fill()
    }
    ctx.restore()
}

// ============================================================================
// STARS / FLOATING DOTS
// ============================================================================

/** Draw twinkling stars with parallax depth */
export const drawStars = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const s of e.stars) {
        const parallaxX = (s.x - e.backgroundOffset * s.depth * 0.15) % CFG.WIDTH
        const displayX = parallaxX < 0 ? parallaxX + CFG.WIDTH : parallaxX
        const alpha = (s.alpha + Math.sin(s.twinkle + e.gameTime * s.twinkleSpeed) * 0.2) * 0.45
        if (alpha <= 0.02) continue // skip invisible stars

        ctx.globalAlpha = alpha
        ctx.fillStyle = w.starColor

        // Layer 1: simple dots — Layer 2: slightly larger
        const displaySize = s.layer === 1 ? s.size : s.size * 1.3
        ctx.beginPath()
        ctx.arc(displayX, s.y, displaySize, 0, TWO_PI)
        ctx.fill()

        // Faint cross sparkle on larger stars
        if (displaySize > 1.4 && alpha > 0.25) {
            ctx.globalAlpha = alpha * 0.3
            ctx.strokeStyle = w.starColor
            ctx.lineWidth = 0.5
            const cs = displaySize * 2.5
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

/** Draw the ground surface with world-specific floor pattern */
export const drawGround = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    // Ground fill
    const gGrad = ctx.createLinearGradient(0, CFG.GROUND, 0, CFG.HEIGHT)
    gGrad.addColorStop(0, w.groundTop); gGrad.addColorStop(1, w.groundBottom)
    ctx.fillStyle = gGrad
    ctx.fillRect(0, CFG.GROUND, CFG.WIDTH, CFG.HEIGHT - CFG.GROUND)

    // Accent ground line — clean 2px, no blur
    ctx.save()
    ctx.strokeStyle = w.accent
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.7 + Math.sin(e.gameTime * 2) * 0.15
    ctx.beginPath(); ctx.moveTo(0, CFG.GROUND); ctx.lineTo(CFG.WIDTH, CFG.GROUND); ctx.stroke()
    ctx.restore()

    // Floor pattern
    const fOff = (e.groundOffset * 0.5) % 60
    ctx.save()
    ctx.fillStyle = w.accent + '25'
    ctx.globalAlpha = 0.6

    drawFloorPattern(ctx, e, w, fOff)
    ctx.restore()
}

/** Draw floor pattern specific to current world */
const drawFloorPattern = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    fOff: number
): void => {
    const pattern = w.floorPattern

    if (pattern === 'diagonal') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 60) {
            ctx.beginPath()
            ctx.moveTo(x, CFG.GROUND)
            ctx.lineTo(x + 25, CFG.GROUND)
            ctx.lineTo(x + 5, CFG.HEIGHT)
            ctx.lineTo(x - 15, CFG.HEIGHT)
            ctx.closePath()
            ctx.fill()
        }
    } else if (pattern === 'circuit') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 60) {
            ctx.fillRect(x, CFG.GROUND, 2, CFG.HEIGHT - CFG.GROUND)
            ctx.fillRect(x, CFG.GROUND + 20, 30, 2)
            ctx.fillRect(x + 20, CFG.GROUND + 40, 25, 2)
            // Extra circuit nodes
            ctx.beginPath()
            ctx.arc(x + 15, CFG.GROUND + 20, 3, 0, TWO_PI)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(x + 45, CFG.GROUND + 40, 2, 0, TWO_PI)
            ctx.fill()
        }
    } else if (pattern === 'waves') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 40) {
            ctx.beginPath()
            ctx.moveTo(x, CFG.GROUND)
            for (let y = CFG.GROUND; y < CFG.HEIGHT; y += 10) {
                ctx.quadraticCurveTo(
                    x + 15 + Math.sin(e.gameTime * 3 + y * 0.1) * 10, y,
                    x, y + 20
                )
            }
            ctx.lineTo(x - 20, CFG.HEIGHT)
            ctx.lineTo(x - 20, CFG.GROUND)
            ctx.closePath()
            ctx.fill()
        }
    } else if (pattern === 'grid') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 50) {
            ctx.fillRect(x, CFG.GROUND, 1, CFG.HEIGHT - CFG.GROUND)
            for (let y = CFG.GROUND; y < CFG.HEIGHT; y += 30) {
                ctx.fillRect(x, y, 40, 1)
            }
        }
    } else if (pattern === 'neon') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 80) {
            ctx.globalAlpha = 0.5 + Math.sin(e.gameTime * 4 + x * 0.05) * 0.2
            ctx.fillRect(x, CFG.GROUND, 2, CFG.HEIGHT - CFG.GROUND)
        }
    } else if (pattern === 'dots') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 30) {
            for (let y = CFG.GROUND + 15; y < CFG.HEIGHT; y += 25) {
                ctx.globalAlpha = 0.3 + Math.sin(e.gameTime * 2 + x * 0.05 + y * 0.03) * 0.15
                ctx.beginPath()
                ctx.arc(x, y, 2, 0, TWO_PI)
                ctx.fill()
            }
        }
    } else if (pattern === 'lines') {
        for (let y = CFG.GROUND + 12; y < CFG.HEIGHT; y += 18) {
            ctx.globalAlpha = 0.3
            ctx.fillRect(0, y, CFG.WIDTH, 1)
        }
    } else if (pattern === 'chevron') {
        for (let x = -fOff; x < CFG.WIDTH + 60; x += 45) {
            ctx.beginPath()
            ctx.moveTo(x, CFG.GROUND + 15)
            ctx.lineTo(x + 20, CFG.GROUND + 30)
            ctx.lineTo(x + 40, CFG.GROUND + 15)
            ctx.lineWidth = 1.5
            ctx.strokeStyle = w.accent + '40'
            ctx.stroke()
            // Second row
            ctx.beginPath()
            ctx.moveTo(x + 10, CFG.GROUND + 45)
            ctx.lineTo(x + 30, CFG.GROUND + 60)
            ctx.lineTo(x + 50, CFG.GROUND + 45)
            ctx.stroke()
        }
    } else if (pattern === 'hex') {
        const hexR = 12
        for (let x = -fOff; x < CFG.WIDTH + 60; x += hexR * 3) {
            for (let y = CFG.GROUND + hexR + 5; y < CFG.HEIGHT; y += hexR * 2.2) {
                ctx.globalAlpha = 0.25
                ctx.beginPath()
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6
                    const hx = x + hexR * Math.cos(angle)
                    const hy = y + hexR * Math.sin(angle)
                    if (i === 0) ctx.moveTo(hx, hy)
                    else ctx.lineTo(hx, hy)
                }
                ctx.closePath()
                ctx.strokeStyle = w.accent + '30'
                ctx.lineWidth = 0.8
                ctx.stroke()
            }
        }
    } else if (pattern === 'pulse') {
        const pulseCount = 6
        for (let i = 0; i < pulseCount; i++) {
            const radius = 20 + i * 35 + Math.sin(e.gameTime * 2 + i) * 5
            ctx.globalAlpha = clamp(0.15 - i * 0.02, 0.02, 0.15)
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

/** Draw floating ground particles */
export const drawGroundParticles = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    ctx.save()
    for (const gp of e.groundParticles) {
        ctx.globalAlpha = gp.alpha * (0.5 + Math.sin(gp.phase) * 0.3)
        ctx.fillStyle = w.accent
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
 * Draw a single trading candle with animations:
 * - Clean wick + body
 * - Shimmer highlight sliding down
 * - Red: pulsing danger ring + × mark
 * - Green: pulsing border + ▲ arrow
 * - Collection: expanding ring + floating "+5"
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

    // ===== WICK — clean thin trading line =====
    ctx.globalAlpha = 0.7
    ctx.strokeStyle = a
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, c.wickTop)
    ctx.lineTo(cx, c.wickBottom)
    ctx.stroke()

    // Small wick caps (horizontal ticks)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 3, c.wickTop); ctx.lineTo(cx + 3, c.wickTop)
    ctx.moveTo(cx - 3, c.wickBottom); ctx.lineTo(cx + 3, c.wickBottom)
    ctx.stroke()

    // ===== BODY — gradient fill =====
    const bodyGrad = ctx.createLinearGradient(c.x, drawY, c.x + c.width, drawY)
    bodyGrad.addColorStop(0, b)
    bodyGrad.addColorStop(0.35, a)
    bodyGrad.addColorStop(0.65, a)
    bodyGrad.addColorStop(1, b)
    ctx.globalAlpha = 1
    ctx.fillStyle = bodyGrad
    ctx.fillRect(c.x, drawY, c.width, c.bodyHeight)

    // ===== SHIMMER — highlight bar sliding down body =====
    const shimmerProgress = (t * 30) % (c.bodyHeight + 20)
    const shimmerY = drawY + shimmerProgress - 10
    const shimmerClipY = Math.max(drawY, shimmerY)
    const shimmerClipH = Math.min(6, drawY + c.bodyHeight - shimmerClipY)
    if (shimmerClipH > 0) {
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(c.x + 2, shimmerClipY, c.width - 4, shimmerClipH)
    }

    // ===== BORDER — crisp =====
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = a
    ctx.lineWidth = 1.5
    ctx.strokeRect(c.x, drawY, c.width, c.bodyHeight)

    // ===== ANIMATED INDICATORS =====
    if (!c.collected) {
        if (isRed) {
            // --- Danger pulse ring ---
            const pulseR = c.width * 0.65 + Math.sin(t * 3) * 4
            ctx.globalAlpha = 0.12 + Math.sin(t * 3) * 0.08
            ctx.strokeStyle = w.redA
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(cx, drawY + c.bodyHeight / 2, pulseR, 0, TWO_PI)
            ctx.stroke()

            // --- × danger mark above wick ---
            ctx.globalAlpha = 0.5 + Math.sin(t * 2) * 0.2
            ctx.strokeStyle = w.redA
            ctx.lineWidth = 1.5
            const markY = c.wickTop - 9
            const ms = 3.5
            ctx.beginPath()
            ctx.moveTo(cx - ms, markY - ms); ctx.lineTo(cx + ms, markY + ms)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(cx + ms, markY - ms); ctx.lineTo(cx - ms, markY + ms)
            ctx.stroke()

            // --- Down arrow below wick (red = price dropping) ---
            ctx.globalAlpha = 0.35 + Math.sin(t * 1.8) * 0.15
            ctx.fillStyle = w.redA
            ctx.beginPath()
            const dy = c.wickBottom + 8 + Math.sin(t * 2) * 2
            ctx.moveTo(cx, dy + 5)
            ctx.lineTo(cx - 4, dy - 1)
            ctx.lineTo(cx + 4, dy - 1)
            ctx.closePath()
            ctx.fill()

        } else {
            // --- Collectible pulse border ---
            ctx.globalAlpha = 0.2 + Math.sin(t * 2) * 0.12
            ctx.strokeStyle = w.greenA
            ctx.lineWidth = 2
            ctx.strokeRect(c.x - 3, drawY - 3, c.width + 6, c.bodyHeight + 6)

            // Second outer ring pulse
            ctx.globalAlpha = 0.08 + Math.sin(t * 2 + 1) * 0.05
            ctx.strokeRect(c.x - 6, drawY - 6, c.width + 12, c.bodyHeight + 12)

            // --- ▲ up arrow above wick (green = price rising) ---
            ctx.globalAlpha = 0.6 + Math.sin(t * 2.5) * 0.3
            ctx.fillStyle = w.greenA
            ctx.beginPath()
            const ay = c.wickTop - 11 + Math.sin(t * 2) * 3
            ctx.moveTo(cx, ay - 5)
            ctx.lineTo(cx - 4, ay + 2)
            ctx.lineTo(cx + 4, ay + 2)
            ctx.closePath()
            ctx.fill()

            // --- Small "+" text near arrow ---
            ctx.globalAlpha = 0.4 + Math.sin(t * 3) * 0.2
            ctx.font = '600 9px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('+', cx + 8, ay)
        }
    }

    // ===== COLLECTION ANIMATION =====
    if (c.collected && c.collectProgress < 1) {
        const prog = c.collectProgress

        // Expanding ring
        ctx.globalAlpha = (1 - prog) * 0.6
        ctx.strokeStyle = a
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, c.bodyY + c.bodyHeight / 2, c.width * (0.8 + prog * 3), 0, TWO_PI)
        ctx.stroke()

        // Second ring (delayed)
        if (prog > 0.15) {
            ctx.globalAlpha = (1 - prog) * 0.3
            ctx.beginPath()
            ctx.arc(cx, c.bodyY + c.bodyHeight / 2, c.width * (0.4 + prog * 2), 0, TWO_PI)
            ctx.stroke()
        }

        // Floating "+5" score text
        ctx.globalAlpha = (1 - prog) * 0.85
        ctx.fillStyle = w.greenA
        ctx.font = '700 14px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('+' + CFG.GREEN_SCORE, cx, c.bodyY - prog * 35)
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
// PLAYER TRAIL
// ============================================================================

/** Draw player ghost trail */
export const drawTrail = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    logo: HTMLImageElement | null,
    logoLoaded: boolean
): void => {
    for (const t of e.player.trail) {
        ctx.globalAlpha = t.alpha * t.life * 0.4
        ctx.save()
        ctx.translate(CFG.PLAYER_X + PLAYER_HALF, t.y + PLAYER_HALF)
        ctx.rotate(t.rotation)
        ctx.scale(t.scale, t.scale)
        if (logoLoaded && logo) {
            ctx.drawImage(logo, -PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
        } else {
            ctx.fillStyle = w.accent
            ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
        }
        ctx.restore()
    }
    ctx.globalAlpha = 1
}

// ============================================================================
// PLAYER SPRITE
// ============================================================================

/** Draw the player cube with shadow, rotation, and airborne glow */
export const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme,
    logo: HTMLImageElement | null,
    logoLoaded: boolean
): void => {
    const p = e.player

    ctx.save()
    ctx.translate(CFG.PLAYER_X + PLAYER_HALF, p.y + PLAYER_HALF)
    ctx.rotate(p.rotation)
    ctx.scale(p.scale, p.scale)
    ctx.translate(p.tilt * 10, 0)

    // Airborne glow (subtle blue ring)
    if (!p.onGround) {
        ctx.globalAlpha = 0.2 + Math.sin(e.gameTime * 6) * 0.1
        ctx.strokeStyle = w.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, PLAYER_HALF + 5, 0, TWO_PI)
        ctx.stroke()
        ctx.globalAlpha = 1
    }

    // Shadow
    ctx.globalAlpha = 0.08
    ctx.fillStyle = '#000000'
    ctx.fillRect(-PLAYER_HALF + 3, -PLAYER_HALF + 3, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    ctx.globalAlpha = 1

    // Player body
    if (logoLoaded && logo) {
        ctx.drawImage(logo, -PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
    } else {
        // Fallback: layered squares
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, CFG.PLAYER_SIZE, CFG.PLAYER_SIZE)
        ctx.fillStyle = w.accent
        ctx.fillRect(-PLAYER_HALF + 5, -PLAYER_HALF + 5, CFG.PLAYER_SIZE - 10, CFG.PLAYER_SIZE - 10)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(-PLAYER_HALF + 10, -PLAYER_HALF + 10, CFG.PLAYER_SIZE - 20, CFG.PLAYER_SIZE - 20)
    }

    // Dash effect — streak lines
    if (p.isDashing) {
        ctx.globalAlpha = 0.5
        ctx.strokeStyle = w.accent
        ctx.lineWidth = 2
        for (let i = 1; i <= 3; i++) {
            const lx = -PLAYER_HALF - i * 8
            ctx.globalAlpha = 0.4 - i * 0.1
            ctx.beginPath()
            ctx.moveTo(lx, -PLAYER_HALF + 5)
            ctx.lineTo(lx, PLAYER_HALF - 5)
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

/** Draw all active particles */
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
            // Ring particle — expanding circle outline
            ctx.strokeStyle = pt.color
            ctx.lineWidth = 1.5 * lifeRatio
            ctx.beginPath()
            ctx.arc(0, 0, sz * (2 - lifeRatio), 0, TWO_PI)
            ctx.stroke()
        } else if (pt.type === 'spark') {
            // Spark — small bright square
            ctx.fillStyle = pt.color
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz)
        } else if (pt.type === 'glow') {
            // Glow — soft circle
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.arc(0, 0, sz, 0, TWO_PI)
            ctx.fill()
        } else if (pt.type === 'star') {
            // Star-shaped particle
            ctx.fillStyle = pt.color
            ctx.beginPath()
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * TWO_PI
                ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz)
                const a2 = ((i + 0.5) / 4) * TWO_PI
                ctx.lineTo(Math.cos(a2) * sz * 0.4, Math.sin(a2) * sz * 0.4)
            }
            ctx.closePath()
            ctx.fill()
        } else if (pt.type === 'burst') {
            // Burst — bright expanding square with fade
            ctx.fillStyle = pt.color
            ctx.globalAlpha *= 0.7
            const bs = sz * 1.5
            ctx.fillRect(-bs / 2, -bs / 2, bs, bs)
        } else if (pt.type === 'trail') {
            // Trail — small fading dot
            ctx.fillStyle = pt.color
            ctx.globalAlpha *= 0.5
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.7, 0, TWO_PI)
            ctx.fill()
        } else if (pt.type === 'collect') {
            // Collect — rising "+$" sparkle
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.arc(0, 0, sz, 0, TWO_PI)
            ctx.fill()
            // Inner bright core
            ctx.fillStyle = '#FFFFFF'
            ctx.globalAlpha *= 0.6
            ctx.beginPath()
            ctx.arc(0, 0, sz * 0.4, 0, TWO_PI)
            ctx.fill()
        } else if (pt.type === 'death') {
            // Death — red expanding squares
            ctx.fillStyle = pt.color
            const ds = sz * 1.2
            ctx.fillRect(-ds / 2, -ds / 2, ds, ds)
        } else if (pt.type === 'jump') {
            // Jump dust — semi-transparent puff
            ctx.fillStyle = pt.color
            ctx.globalAlpha *= 0.6
            ctx.beginPath()
            ctx.arc(0, 0, sz * 1.2, 0, TWO_PI)
            ctx.fill()
        } else if (pt.type === 'dust' || pt.type === 'smoke' || pt.type === 'ground') {
            // Generic small particle
            ctx.fillStyle = pt.color
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz)
        } else {
            // Default: simple square
            ctx.fillStyle = pt.color
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz)
        }

        ctx.restore()
    }
    ctx.restore()
    ctx.globalAlpha = 1
}

// ============================================================================
// WORLD BANNER
// ============================================================================

/** Draw the world transition banner */
export const drawWorldBanner = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    w: WorldTheme
): void => {
    if (e.worldBannerTimer <= 0) return

    const alpha = clamp(e.worldBannerTimer / 2, 0, 1)
    ctx.save()
    ctx.globalAlpha = alpha

    // Banner background
    const bw = 260, bh = 48
    const bx = CFG.WIDTH / 2 - bw / 2, by = 40

    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 8)
    ctx.fill()

    // Border
    ctx.strokeStyle = w.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 8)
    ctx.stroke()

    // World name text
    ctx.fillStyle = w.accent
    ctx.font = '600 16px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(w.name, CFG.WIDTH / 2, by + bh / 2)

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
// MAIN DRAW COMPOSITE
// ============================================================================

/**
 * Master draw function — composites all layers in correct order.
 * Called once per animation frame.
 */
export const drawFrame = (
    ctx: CanvasRenderingContext2D,
    e: EngineState,
    logo: HTMLImageElement | null,
    logoLoaded: boolean
): void => {
    const w = getWorld(e.score)

    // Clear
    ctx.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT)

    // Camera shake
    ctx.save()
    applyShake(ctx, e)

    // Background layers
    drawSky(ctx, e, w)
    drawClouds(ctx, e, w)
    drawStars(ctx, e, w)

    // Ground
    drawGround(ctx, e, w)
    drawGroundParticles(ctx, e, w)

    // Game objects
    drawCandles(ctx, e, w)

    // Player
    drawTrail(ctx, e, w, logo, logoLoaded)
    drawPlayer(ctx, e, w, logo, logoLoaded)

    // Effects
    drawParticles(ctx, e)

    // UI (canvas-rendered)
    drawWorldBanner(ctx, e, w)

    // End shake transform
    ctx.restore()
}
