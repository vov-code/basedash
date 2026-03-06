import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

/**
 * Game Sessions API — stores game results with short IDs
 * 
 * POST /api/game-sessions — Create a new game session
 * GET  /api/game-sessions?id=xxx — Retrieve a game session
 * 
 * Uses Vercel KV (Redis) to persist sessions across serverless instances.
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

function generateId(): string {
    // Short 8-char alphanumeric ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let id = ''
    for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
}

// POST — Create session
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { score, time, dodged, buys, jumps, combo, address } = body

        if (typeof score !== 'number') {
            return NextResponse.json({ error: 'score required' }, { status: 400 })
        }

        // Validate KV token existence (graceful downgrade to memory if not configured locally)
        const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN

        let id = generateId()

        if (hasKV) {
            // Generate unique ID in Redis
            let exists = await kv.exists(`session:${id}`)
            while (exists) {
                id = generateId()
                exists = await kv.exists(`session:${id}`)
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

        if (hasKV) {
            // Save to Redis with 7-day TTL
            await kv.set(`session:${id}`, session, { ex: EXPIRY_SECONDS })
        } else {
            console.warn('Vercel KV not configured. Session will not persist.')
            // Fallback for local dev without KV token configured yet (just returns the ID)
            // Real production will have the KV strings in process.env
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

    const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN

    if (!hasKV) {
        console.warn('Vercel KV not configured. Returning 404 for session retrieval.')
        return NextResponse.json({ error: 'Session not found or KV not configured' }, { status: 404 })
    }

    try {
        const session = await kv.get<GameSession>(`session:${id}`)

        if (!session) {
            return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 })
        }

        return NextResponse.json(session)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch session from DB' }, { status: 500 })
    }
}
