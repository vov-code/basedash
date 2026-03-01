import { NextRequest, NextResponse } from 'next/server'

/**
 * Farcaster Frame API — Exact replica of the in-game Game Over overlay
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const score = searchParams.get('score') || '0'
  const address = searchParams.get('address') || ''
  const time = searchParams.get('time') || ''
  const dodged = searchParams.get('dodged') || ''
  const buys = searchParams.get('buys') || ''
  const jumps = searchParams.get('jumps') || ''
  const combo = searchParams.get('combo') || ''

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  // Format score as market cap (mirrors formatMarketCap from gameConfig.ts)
  const s = Number(score)
  let formattedScore: string
  if (s >= 1_000_000_000) formattedScore = `$${(s / 1_000_000_000).toFixed(2)}B`
  else if (s >= 1_000_000) formattedScore = `$${(s / 1_000_000).toFixed(2)}M`
  else if (s >= 1_000) formattedScore = `$${(s / 1_000).toFixed(2)}K`
  else formattedScore = `$${s.toLocaleString()}`

  // Determine speed tier (mirrors SPEEDS from gameConfig.ts)
  let speedName = 'paper hands'
  let speedColor = '#94A3B8'
  if (s >= 5000) { speedName = 'whale'; speedColor = '#8B5CF6' }
  else if (s >= 3000) { speedName = 'diamond hands'; speedColor = '#0052FF' }
  else if (s >= 1500) { speedName = 'bull run'; speedColor = '#0ECB81' }
  else if (s >= 700) { speedName = 'fomo'; speedColor = '#F0B90B' }
  else if (s >= 300) { speedName = 'degen'; speedColor = '#F6465D' }

  // Determine death message
  const deathMessages = ['rekt!', 'liquidated!', 'rugged!', 'ngmi', 'dumped!', 'paper handed!']
  const msgIdx = Math.abs(s * 7 + (address ? address.charCodeAt(2) || 0 : 0)) % deathMessages.length
  const deathMsg = deathMessages[msgIdx]

  const hasStats = time || dodged || buys || jumps

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
  <meta property="og:title" content="base dash — ${formattedScore}"/>
  <meta property="og:description" content="${deathMsg} — ${formattedScore} PNL"/>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image:aspect_ratio" content="1:1"/>
  <meta property="fc:frame:image" content="${appUrl}/api/frames/image?score=${score}&combo=${combo}&time=${time}&dodged=${dodged}&buys=${buys}&jumps=${jumps}&address=${address}"/>
  <meta property="fc:frame:button:1" content="🎮 try"/>
  <meta property="fc:frame:button:1:action" content="link"/>
  <meta property="fc:frame:button:1:target" content="${appUrl}"/>
  <title>base dash — ${formattedScore}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      -webkit-font-smoothing: antialiased;
    }

    /* === OVERLAY — exact match: rgba(0,0,0,0.25) + blur(3px) === */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
    }

    /* === CARD — exact: white, rounded-xl, border, shadow-2xl === */
    .card {
      width: 100%;
      max-width: 280px;
      border-radius: 12px;
      background: #fff;
      border: 1px solid rgba(10, 11, 20, 0.2);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 8px 8px;
      position: relative;
      overflow: hidden;
      animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* === HEADER — death message === */
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .header h2 {
      font-size: 13px;
      font-weight: 900;
      color: #F6465D;
      letter-spacing: 3px;
      text-transform: lowercase;
      line-height: 1;
    }

    /* === STATS GRID — 2 columns: PNL + MODE === */
    .stats-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .stat-pnl {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 4px 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .stat-mode {
      background: #EEF4FF;
      border: 1px solid rgba(0, 82, 255, 0.2);
      border-radius: 8px;
      padding: 4px 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .stat-label {
      font-size: 7px;
      font-weight: 900;
      color: #94A3B8;
      letter-spacing: 3px;
      text-transform: lowercase;
      margin-bottom: 2px;
    }
    .stat-mode .stat-label {
      color: #6CACFF;
    }
    .stat-value {
      font-size: 12px;
      font-weight: 900;
      color: #0F172A;
      line-height: 1;
    }
    .stat-value.speed {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: lowercase;
    }

    /* === STATS ROW — 4 columns: time, dodged, buys, jumps === */
    .stats-4col {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 4px;
      margin-bottom: 6px;
      text-align: center;
    }
    .mini-stat {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 2px 4px;
    }
    .mini-stat.green {
      background: #E8F8F0;
      border-color: rgba(14, 203, 129, 0.4);
    }
    .mini-label {
      font-size: 6px;
      font-weight: 900;
      color: #94A3B8;
      letter-spacing: 2px;
      text-transform: lowercase;
      margin-bottom: 2px;
    }
    .mini-stat.green .mini-label {
      color: #0ECB81;
    }
    .mini-value {
      font-size: 9px;
      font-weight: 900;
      color: #334155;
      line-height: 1;
    }
    .mini-stat.green .mini-value {
      color: #0ECB81;
    }

    /* === COMBO ROW === */
    .combo-row {
      margin-bottom: 6px;
      background: #FFFBEB;
      border: 1px solid rgba(240, 185, 11, 0.3);
      border-radius: 8px;
      padding: 4px 8px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .combo-row svg {
      width: 10px;
      height: 10px;
      fill: #F0B90B;
    }
    .combo-row p {
      font-size: 7px;
      font-weight: 900;
      color: #B78905;
      letter-spacing: 2px;
      text-transform: lowercase;
    }

    /* === PLAYER ADDRESS === */
    .addr-row {
      margin-bottom: 6px;
      text-align: center;
    }
    .addr-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      color: #64748B;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 3px 10px;
      letter-spacing: 1px;
    }

    /* === TRY BUTTON — exact match: border border-[#0A0B14] bg-white === */
    .btn-try {
      display: block;
      width: 100%;
      text-align: center;
      background: #fff;
      color: #0A0B14;
      border: 1px solid #0A0B14;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: lowercase;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-try:hover {
      background: #0A0B14;
      color: #fff;
    }
    .btn-try:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="overlay">
    <div class="card">
      <!-- Header — death message (same as in-game) -->
      <div class="header">
        <h2>${deathMsg}</h2>
      </div>

      <!-- 2-col stats: PNL + Mode (same as in-game) -->
      <div class="stats-2col">
        <div class="stat-pnl">
          <p class="stat-label">pnl</p>
          <p class="stat-value">${formattedScore}</p>
        </div>
        <div class="stat-mode">
          <p class="stat-label">mode</p>
          <p class="stat-value speed" style="color: ${speedColor}">${speedName}</p>
        </div>
      </div>

      ${combo ? `
      <!-- Combo row (same as near-record in-game) -->
      <div class="combo-row">
        <svg viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
        <p>${combo}× max combo</p>
      </div>
      ` : ''}

      ${hasStats ? `
      <!-- 4-col mini stats: time, dodged, buys, jumps (same as in-game) -->
      <div class="stats-4col">
        <div class="mini-stat">
          <p class="mini-label">time</p>
          <p class="mini-value">${time || '0'}s</p>
        </div>
        <div class="mini-stat">
          <p class="mini-label">dodged</p>
          <p class="mini-value">${dodged || '0'}</p>
        </div>
        <div class="mini-stat green">
          <p class="mini-label">buys</p>
          <p class="mini-value">${buys || '0'}</p>
        </div>
        <div class="mini-stat">
          <p class="mini-label">jumps</p>
          <p class="mini-value">${jumps || '0'}</p>
        </div>
      </div>
      ` : ''}

      <!-- Player address -->
      <div class="addr-row">
        <span class="addr-badge">${shortAddr}</span>
      </div>

      <!-- Single TRY button (replaces run it back + share) -->
      <a href="${appUrl}" class="btn-try">🎮 try</a>
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
