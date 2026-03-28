import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Global middleware — security headers + CORS for API routes.
 *
 * Security hardening:
 * - Strict CORS: only explicit production origins (no wildcards)
 * - CSP: restricts script/connect/img sources
 * - Standard security headers (X-Frame-Options, nosniff, referrer)
 */
export function middleware(request: NextRequest) {
    const response = NextResponse.next()

    // ================================================================
    // CORS headers for API routes — STRICT origin allowlist only
    // ================================================================
    if (request.nextUrl.pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin') || ''
        const allowedOrigins = [
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'https://basedash-five.vercel.app',
            // Add other explicit production domains here:
            // 'https://basedash.gg',
        ]

        // Strict match only — no wildcard subdomains
        if (allowedOrigins.includes(origin)) {
            response.headers.set('Access-Control-Allow-Origin', origin)
        }

        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Max-Age', '86400')
    }

    // ================================================================
    // Security headers for ALL responses
    // ================================================================
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-DNS-Prefetch-Control', 'on')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // Content Security Policy — restrict resource loading
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://mainnet.base.org https://sepolia.base.org https://*.base.org wss://*.walletlink.org https://*.coinbase.com https://*.walletconnect.com https://vercel.live https://*.vercel-insights.com",
        "frame-src 'self' https://keys.coinbase.com https://wallet.coinbase.com",
        "frame-ancestors 'self' https://warpcast.com https://*.farcaster.xyz",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)

    return response
}

export const config = {
    matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
}
