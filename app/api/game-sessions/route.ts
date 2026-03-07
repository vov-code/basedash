import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'
import { randomBytes } from 'crypto'

/**
 * Game Sessions API — stores game results with short IDs
 * 
 * POST /api/game-sessions — Create a new game session
 * GET  /api/game-sessions?id=xxx — Retrieve a game session
 * 
 * Uses standard Redis (Upstash) to persist sessions across serverless instances.
 * Sessions auto-expire after 7 days via Redis EX command.
 */

export const dynamic = 'force-dynamic'

interface GameSession {
    id: string
    score: number
    time: number
    dodged: number
    buys: number
    jumps: number
    combo: number
    address: string
    createdAt: number
}

// TTL 7 days in seconds
const EXPIRY_SECONDS = 7 * 24 * 60 * 60

// Initialize Redis from standard URL
const redisUrl = process.env.REDIS_URL || process.env.KV_URL
const redis = redisUrl ? new Redis(redisUrl) : null

function generateId(): string {
    // Cryptographically secure 8-char alphanumeric ID
    return randomBytes(6).toString('base64url').slice(0, 8)
}

// POST — Create session
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { score, time, dodged, buys, jumps, combo, address } = body

        if (typeof score !== 'number') {
            return NextResponse.json({ error: 'score required' }, { status: 400 })
        }

        let id = generateId()

        if (redis) {
            // Generate unique ID in Redis
            let exists = await redis.exists(`session:${id}`)
            while (exists) {
                id = generateId()
                exists = await redis.exists(`session:${id}`)
            }
        }

        const session: GameSession = {
            id,
            score: Math.floor(score) || 0,
            time: Math.floor(time) || 0,
            dodged: Math.floor(dodged) || 0,
            buys: Math.floor(buys) || 0,
            jumps: Math.floor(jumps) || 0,
            combo: Math.floor(combo) || 0,
            address: typeof address === 'string' ? address : '',
            createdAt: Date.now(),
        }

        if (redis) {
            // Save to Redis with 7-day TTL
            await redis.set(`session:${id}`, JSON.stringify(session), 'EX', EXPIRY_SECONDS)
        } else {
            console.warn('REDIS_URL not configured. Session will not persist.')
        }

        return NextResponse.json({ id, session }, { status: 201 })
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

// GET — Retrieve session
export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    if (!redis) {
        console.warn('REDIS_URL not configured. Returning 404 for session retrieval.')
        return NextResponse.json({ error: 'Session not found or Redis not configured' }, { status: 404 })
    }

    try {
        const sessionStr = await redis.get(`session:${id}`)

        if (!sessionStr) {
            return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 })
        }

        const session = JSON.parse(sessionStr) as GameSession
        return NextResponse.json(session)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch session from DB' }, { status: 500 })
    }
}
