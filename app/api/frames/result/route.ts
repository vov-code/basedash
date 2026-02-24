import { NextRequest, NextResponse } from 'next/server'

/**
 * Farcaster Frame API — Game Over style result page
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const score = searchParams.get('score') || '0'
  const address = searchParams.get('address') || ''
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const formattedScore = Number(score).toLocaleString()

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
  <meta property="og:title" content="base dash — $${formattedScore}"/>
  <meta property="og:description" content="portfolio result"/>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${appUrl}/og-image.svg"/>
  <meta property="fc:frame:button:1" content="🎮 try again"/>
  <meta property="fc:frame:button:1:action" content="link"/>
  <meta property="fc:frame:button:1:target" content="${appUrl}"/>
  <title>base dash — $${formattedScore}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(180deg, #0A0B14 0%, #1a1b2e 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'JetBrains Mono', monospace;
      padding: 20px;
      overflow: hidden;
    }
    .container {
      text-align: center;
      max-width: 380px;
      width: 100%;
    }
    .label {
      color: #6B7280;
      letter-spacing: 3px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 15px;
      text-transform: lowercase;
    }
    .score {
      font-size: 48px;
      font-weight: 900;
      margin: 10px 0;
      text-shadow: 0 0 30px rgba(0, 82, 255, 0.3);
      font-family: 'JetBrains Mono', monospace;
    }
    .pnl {
      color: #0ECB81;
      letter-spacing: 4px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 25px;
      text-transform: lowercase;
    }
    .player {
      color: #6B7280;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 30px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: lowercase;
      background: rgba(255,255,255,0.05);
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0052FF 0%, #003EC7 100%);
      color: #fff;
      padding: 14px 40px;
      text-decoration: none;
      font-weight: 800;
      letter-spacing: 2px;
      font-size: 12px;
      border-radius: 10px;
      text-transform: lowercase;
      box-shadow: 0 4px 20px rgba(0, 82, 255, 0.3);
      transition: all 0.2s;
      font-family: 'JetBrains Mono', monospace;
    }
    .btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 25px rgba(0, 82, 255, 0.4);
    }
    .btn:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="container">
    <p class="label">portfolio result</p>
    <p class="score">$${formattedScore}</p>
    <p class="pnl">pnl</p>
    <p class="player">${shortAddr}</p>
    <br/>
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
