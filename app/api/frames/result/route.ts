import { NextRequest, NextResponse } from 'next/server'

/**
 * Farcaster Frame API — Game Over style result page
 * Mirrors the in-game Game Over overlay design (white card, compact stats, share button)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const score = searchParams.get('score') || '0'
  const address = searchParams.get('address') || ''
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const formattedScore = Number(score).toLocaleString()

  // Determine speed tier based on score (mirroring game logic)
  let speedName = 'paper hands'
  let speedColor = '#94A3B8'
  const s = Number(score)
  if (s >= 5000) { speedName = 'whale'; speedColor = '#8B5CF6' }
  else if (s >= 3000) { speedName = 'diamond hands'; speedColor = '#0052FF' }
  else if (s >= 1500) { speedName = 'bull run'; speedColor = '#0ECB81' }
  else if (s >= 700) { speedName = 'fomo'; speedColor = '#F0B90B' }
  else if (s >= 300) { speedName = 'degen'; speedColor = '#F6465D' }

  const shareText = encodeURIComponent(`I scored $${formattedScore} PNL in Base Dash! 🎮\n${appUrl}/api/frames/result?score=${score}${address ? `&address=${address}` : ''}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
  <meta property="og:title" content="base dash — $${formattedScore}"/>
  <meta property="og:description" content="portfolio result"/>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${appUrl}/og-image.svg"/>
  <meta property="fc:frame:button:1" content="🎮 try"/>
  <meta property="fc:frame:button:1:action" content="link"/>
  <meta property="fc:frame:button:1:target" content="${appUrl}"/>
  <title>base dash — $${formattedScore}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #F1F4F9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
    }
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.18);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      width: 100%;
      max-width: 300px;
      background: #fff;
      border: 1px solid rgba(10, 11, 20, 0.15);
      border-radius: 16px;
      padding: 16px 14px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
      overflow: hidden;
    }
    /* Header — "liquidated" / death message */
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 12px;
    }
    .header h2 {
      font-size: 13px;
      font-weight: 900;
      color: #F6465D;
      letter-spacing: 3px;
      text-transform: lowercase;
    }
    /* Stats grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .stat-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .stat-card.blue {
      background: #EEF4FF;
      border-color: rgba(0, 82, 255, 0.2);
    }
    .stat-label {
      font-size: 7px;
      font-weight: 900;
      color: #94A3B8;
      letter-spacing: 3px;
      text-transform: lowercase;
      margin-bottom: 4px;
    }
    .stat-card.blue .stat-label {
      color: #6CACFF;
    }
    .stat-value {
      font-size: 13px;
      font-weight: 900;
      color: #0F172A;
      line-height: 1;
    }
    .stat-value.speed {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: lowercase;
    }
    /* Player address */
    .player-row {
      margin-bottom: 12px;
      text-align: center;
    }
    .player-addr {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 5px 14px;
      letter-spacing: 1px;
    }
    /* Buttons */
    .btn-primary {
      display: block;
      width: 100%;
      text-align: center;
      background: #fff;
      color: #0A0B14;
      border: 1px solid #0A0B14;
      padding: 10px 12px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: lowercase;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-primary:hover {
      background: #0A0B14;
      color: #fff;
    }
    .btn-share {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      text-align: center;
      background: rgba(139, 92, 246, 0.1);
      color: #8B5CF6;
      border: 1px solid #8B5CF6;
      padding: 8px 12px;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: lowercase;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.15s;
      margin-top: 6px;
    }
    .btn-share:hover {
      background: #8B5CF6;
      color: #fff;
    }
    .btn-share svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }
    /* Subtle animation */
    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .card { animation: cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  </style>
</head>
<body>
  <div class="overlay">
    <div class="card">
      <!-- Header -->
      <div class="header">
        <h2>liquidated</h2>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label">p n l</p>
          <p class="stat-value">$${formattedScore}</p>
        </div>
        <div class="stat-card blue">
          <p class="stat-label">m o d e</p>
          <p class="stat-value speed" style="color: ${speedColor}">${speedName}</p>
        </div>
      </div>

      <!-- Player Address -->
      <div class="player-row">
        <span class="player-addr">${shortAddr}</span>
      </div>

      <!-- Buttons -->
      <a href="${appUrl}" class="btn-primary">🎮 try</a>
      <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" class="btn-share">
        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
        share
      </a>
    </div>
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
