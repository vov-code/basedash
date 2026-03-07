import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Global middleware — adds security headers to all API responses */
export function middleware(request: NextRequest) {
    const response = NextResponse.next()

    // CORS headers for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin') || ''
        const allowedOrigins = [
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'https://gameforbase.vercel.app',
            'https://basedash-five.vercel.app',
        ]

        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            response.headers.set('Access-Control-Allow-Origin', origin)
        }

        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Max-Age', '86400')
    }

    // Security headers for all responses
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
}

export const config = {
    matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
}
