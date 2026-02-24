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
      <text x="600" y="120" font-family="system-ui,sans-serif" font-size="42" font-weight="900" fill="#0052FF" text-anchor="middle" letter-spacing="8">base dash</text>
      <text x="600" y="180" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#6B7280" text-anchor="middle" letter-spacing="4">portfolio result</text>
      <text x="600" y="320" font-family="system-ui,sans-serif" font-size="96" font-weight="900" fill="#FFFFFF" text-anchor="middle">${formattedScore}</text>
      <text x="600" y="370" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#0ECB81" text-anchor="middle" letter-spacing="6">pnl</text>
      <text x="600" y="440" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#6B7280" text-anchor="middle">player: ${shortAddr}</text>
      <text x="600" y="540" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="#F0B90B" text-anchor="middle">can you beat this score?</text>
    </svg>`

  const ogImageData = `data:image/svg+xml;base64,${Buffer.from(svgImage).toString('base64')}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta property="og:title" content="base dash — ${formattedScore} pnl"/>
  <meta property="og:description" content="i scored ${formattedScore} pnl in base dash! can you beat my score?"/>
  <meta property="og:image" content="${ogImageData}"/>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${ogImageData}"/>
  <meta property="fc:frame:button:1" content="🎮 try again"/>
  <meta property="fc:frame:button:1:action" content="link"/>
  <meta property="fc:frame:button:1:target" content="${appUrl}"/>
  <meta property="fc:frame:button:2" content="🏆 leaderboard"/>
  <meta property="fc:frame:button:2:action" content="link"/>
  <meta property="fc:frame:button:2:target" content="${appUrl}?tab=leaderboard"/>
  <title>base dash — ${formattedScore} pnl</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(180deg, #0A0B14 0%, #1a1b2e 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    h1 {
      color: #0052FF;
      letter-spacing: 6px;
      font-size: 28px;
      font-weight: 900;
      margin-bottom: 10px;
      text-transform: lowercase;
    }
    .subtitle {
      color: #6B7280;
      letter-spacing: 3px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 30px;
      text-transform: lowercase;
    }
    .score {
      font-size: 56px;
      font-weight: 900;
      margin: 10px 0;
      text-shadow: 0 0 30px rgba(0, 82, 255, 0.3);
    }
    .pnl {
      color: #0ECB81;
      letter-spacing: 4px;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 30px;
      text-transform: lowercase;
    }
    .player {
      color: #6B7280;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 40px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: lowercase;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0052FF 0%, #003EC7 100%);
      color: #fff;
      padding: 14px 32px;
      text-decoration: none;
      font-weight: 800;
      letter-spacing: 2px;
      font-size: 12px;
      border-radius: 8px;
      text-transform: lowercase;
      box-shadow: 0 4px 20px rgba(0, 82, 255, 0.3);
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>base dash</h1>
    <p class="subtitle">portfolio result</p>
    <p class="score">${formattedScore}</p>
    <p class="pnl">pnl</p>
    <p class="player">player: ${shortAddr}</p>
    <a href="${appUrl}" class="btn">🎮 try again</a>
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
