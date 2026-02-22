import { NextRequest, NextResponse } from 'next/server'

/**
 * Farcaster Frame API — generates OG-compatible HTML for sharing game results.
 * Query params: score, address
 * Returns HTML with fc:frame meta tags for Warpcast embed (item 10).
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const score = searchParams.get('score') || '0'
    const address = searchParams.get('address') || ''
    const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const formattedScore = Number(score).toLocaleString()

    // Simple SVG-based OG image (rendered inline as data URI for maximum compatibility)
    const svgImage = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0A0B14"/>
          <stop offset="100%" style="stop-color:#1a1b2e"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect x="40" y="40" width="1120" height="550" rx="24" fill="none" stroke="#0052FF" stroke-width="3" opacity="0.4"/>
      <text x="600" y="120" font-family="system-ui,sans-serif" font-size="42" font-weight="900" fill="#0052FF" text-anchor="middle" letter-spacing="8">BASE DASH</text>
      <text x="600" y="180" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#6B7280" text-anchor="middle" letter-spacing="4">PORTFOLIO RESULT</text>
      <text x="600" y="320" font-family="system-ui,sans-serif" font-size="96" font-weight="900" fill="#FFFFFF" text-anchor="middle">${formattedScore}</text>
      <text x="600" y="370" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#0ECB81" text-anchor="middle" letter-spacing="6">PNL</text>
      <text x="600" y="440" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#6B7280" text-anchor="middle">player: ${shortAddr}</text>
      <text x="600" y="540" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="#F0B90B" text-anchor="middle">CAN YOU BEAT THIS SCORE?</text>
    </svg>`

    const ogImageData = `data:image/svg+xml;base64,${Buffer.from(svgImage).toString('base64')}`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta property="og:title" content="Base Dash — ${formattedScore} PNL"/>
  <meta property="og:description" content="I scored ${formattedScore} PNL in Base Dash! Can you beat my score?"/>
  <meta property="og:image" content="${ogImageData}"/>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${ogImageData}"/>
  <meta property="fc:frame:button:1" content="🎮 Play Base Dash"/>
  <meta property="fc:frame:button:1:action" content="link"/>
  <meta property="fc:frame:button:1:target" content="${appUrl}"/>
  <meta property="fc:frame:button:2" content="🏆 Leaderboard"/>
  <meta property="fc:frame:button:2:action" content="link"/>
  <meta property="fc:frame:button:2:target" content="${appUrl}?tab=leaderboard"/>
  <title>Base Dash — ${formattedScore} PNL</title>
</head>
<body style="background:#0A0B14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
  <div style="text-align:center">
    <h1 style="color:#0052FF;letter-spacing:6px;font-size:36px">BASE DASH</h1>
    <p style="font-size:72px;font-weight:900;margin:20px 0">${formattedScore}</p>
    <p style="color:#0ECB81;letter-spacing:4px">PNL</p>
    <p style="margin-top:40px"><a href="${appUrl}" style="background:#0052FF;color:#fff;padding:16px 40px;text-decoration:none;font-weight:800;letter-spacing:3px;font-size:14px">PLAY NOW</a></p>
  </div>
</body>
</html>`

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
