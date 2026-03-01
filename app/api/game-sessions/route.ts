import { NextRequest, NextResponse } from 'next/server'

/**
 * Game Sessions API — stores game results with short IDs
 * 
 * POST /api/game-sessions — Create a new game session
 * GET  /api/game-sessions?id=xxx — Retrieve a game session
 * 
 * Sessions auto-expire after 7 days via cleanup on each request.
 * Uses in-memory Map (suitable for serverless with low traffic).
 */

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

// In-memory store — survives within a single serverless instance
const sessions = new Map<string, GameSession>()

// Auto-cleanup: remove sessions older than 7 days
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SESSIONS = 5000

function cleanup() {
    const now = Date.now()
    sessions.forEach((session, id) => {
        if (now - session.createdAt > EXPIRY_MS) {
            sessions.delete(id)
        }
    })
    // Hard cap — remove oldest if over limit
    if (sessions.size > MAX_SESSIONS) {
        const entries: [string, GameSession][] = []
        sessions.forEach((v, k) => entries.push([k, v]))
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt)
        const toRemove = entries.slice(0, sessions.size - MAX_SESSIONS)
        for (let i = 0; i < toRemove.length; i++) sessions.delete(toRemove[i][0])
    }
}

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
        cleanup()

        const body = await req.json()
        const { score, time, dodged, buys, jumps, combo, address } = body

        if (typeof score !== 'number') {
            return NextResponse.json({ error: 'score required' }, { status: 400 })
        }

        let id = generateId()
        while (sessions.has(id)) id = generateId()

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

        sessions.set(id, session)

        return NextResponse.json({ id, session }, { status: 201 })
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

// GET — Retrieve session
export async function GET(req: NextRequest) {
    cleanup()

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    const session = sessions.get(id)
    if (!session) {
        return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 })
    }

    return NextResponse.json(session)
}
