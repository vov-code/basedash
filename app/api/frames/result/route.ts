import { NextRequest, NextResponse } from 'next/server'

/**
 * Farcaster Frame API — Premium Game Over Share Card
 * ONLY supports ?id=xxx game session lookup (no raw query params to prevent spoofing)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('id')

  let score = '0'
  let address = ''
  let time = ''
  let dodged = ''
  let buys = ''
  let jumps = ''
  let combo = ''

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const errorPage = (title: string, msg: string, status: number) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>base dash</title><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0B14;font-family:'JetBrains Mono',monospace;color:#fff}.card{text-align:center;max-width:280px;padding:32px 24px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)}h1{font-size:14px;font-weight:900;color:#F6465D;letter-spacing:3px;text-transform:lowercase;margin-bottom:8px}p{font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:20px;line-height:1.5}a{display:block;padding:10px 20px;background:linear-gradient(135deg,#0052FF,#003FCC);color:#fff;text-decoration:none;border-radius:12px;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:lowercase}</style></head><body><div class="card"><h1>${title}</h1><p>${msg}</p><a href="${appUrl}">🎮 play base dash</a></div></body></html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status })
  }

  if (!sessionId) {
    return errorPage('invalid link', 'this share link is invalid or missing.', 404)
  }

  // Fetch session data from game-sessions API
  try {
    const origin = appUrl
    const res = await fetch(`${origin}/api/game-sessions?id=${sessionId}`)
    if (!res.ok) {
      return errorPage('session expired', 'this game session has expired or does not exist.', 404)
    }
    const data = await res.json()
    score = String(data.score || 0)
    time = String(data.time || 0)
    dodged = String(data.dodged || 0)
    buys = String(data.buys || 0)
    jumps = String(data.jumps || 0)
    combo = String(data.combo || 0)
    address = data.address || ''
  } catch {
    return errorPage('error', 'could not load game session.', 500)
  }

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'

  // Format score as market cap
  const s = Number(score)
  let formattedScore: string
  if (s >= 1_000_000_000) formattedScore = `$${(s / 1_000_000_000).toFixed(2)}B`
  else if (s >= 1_000_000) formattedScore = `$${(s / 1_000_000).toFixed(2)}M`
  else if (s >= 1_000) formattedScore = `$${(s / 1_000).toFixed(2)}K`
  else formattedScore = `$${s.toLocaleString()}`

  // Speed tier
  let speedName = 'paper hands'
  let speedColor = '#94A3B8'
  let speedGradient = 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)'
  if (s >= 5000) { speedName = 'whale'; speedColor = '#8B5CF6'; speedGradient = 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }
  else if (s >= 3000) { speedName = 'diamond hands'; speedColor = '#0052FF'; speedGradient = 'linear-gradient(135deg, #0052FF 0%, #0040CC 100%)' }
  else if (s >= 1500) { speedName = 'bull run'; speedColor = '#0ECB81'; speedGradient = 'linear-gradient(135deg, #0ECB81 0%, #059669 100%)' }
  else if (s >= 700) { speedName = 'fomo'; speedColor = '#F0B90B'; speedGradient = 'linear-gradient(135deg, #F0B90B 0%, #D4A002 100%)' }
  else if (s >= 300) { speedName = 'degen'; speedColor = '#F6465D'; speedGradient = 'linear-gradient(135deg, #F6465D 0%, #DC2646 100%)' }

  // Death message
  const deathMessages = ['rekt!', 'liquidated!', 'rugged!', 'ngmi', 'dumped!', 'paper handed!']
  const msgIdx = Math.abs(s * 7 + (address ? address.charCodeAt(2) || 0 : 0)) % deathMessages.length
  const deathMsg = deathMessages[msgIdx]

  const hasStats = time || dodged || buys || jumps
  const hasCombo = combo && Number(combo) > 0

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
  <meta property="fc:frame:button:1" content="🎮 play"/>
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
      background: #0A0B14;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: linear-gradient(165deg, rgba(10,11,20,0.95) 0%, rgba(15,23,42,0.9) 50%, rgba(10,11,20,0.95) 100%);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .card {
      width: 100%;
      max-width: 320px;
      border-radius: 20px;
      background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1);
      padding: 20px 16px;
      position: relative;
      overflow: hidden;
      animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .card::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 30%, ${speedColor}15, transparent 60%);
      pointer-events: none;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.92) translateY(12px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Brand */
    .brand {
      text-align: center;
      margin-bottom: 12px;
    }
    .brand-name {
      font-size: 8px;
      font-weight: 800;
      color: rgba(255,255,255,0.3);
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    /* Death header */
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 16px;
    }
    .header h2 {
      font-size: 16px;
      font-weight: 900;
      color: #F6465D;
      letter-spacing: 3px;
      text-transform: lowercase;
      text-shadow: 0 0 20px rgba(246,70,93,0.4);
    }

    /* Score hero */
    .score-hero {
      text-align: center;
      margin-bottom: 16px;
      padding: 16px 12px;
      background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .score-label {
      font-size: 8px;
      font-weight: 800;
      color: rgba(255,255,255,0.35);
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .score-value {
      font-size: 28px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -1px;
      text-shadow: 0 2px 12px rgba(255,255,255,0.15);
    }
    .speed-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 12px;
      font-size: 8px;
      font-weight: 800;
      color: white;
      letter-spacing: 2px;
      text-transform: lowercase;
      border-radius: 20px;
      background: ${speedGradient};
      box-shadow: 0 4px 12px ${speedColor}40;
    }

    /* Stats grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    .stat-cell {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 8px 4px;
      text-align: center;
    }
    .stat-cell.green {
      background: rgba(14,203,129,0.08);
      border-color: rgba(14,203,129,0.2);
    }
    .stat-label {
      font-size: 7px;
      font-weight: 800;
      color: rgba(255,255,255,0.3);
      letter-spacing: 2px;
      text-transform: lowercase;
      margin-bottom: 4px;
    }
    .stat-cell.green .stat-label { color: rgba(14,203,129,0.6); }
    .stat-value {
      font-size: 12px;
      font-weight: 900;
      color: rgba(255,255,255,0.8);
    }
    .stat-cell.green .stat-value { color: #0ECB81; }

    /* Combo row */
    .combo-row {
      margin-bottom: 12px;
      background: linear-gradient(135deg, rgba(240,185,11,0.1) 0%, rgba(240,185,11,0.04) 100%);
      border: 1px solid rgba(240,185,11,0.2);
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .combo-row svg { width: 12px; height: 12px; fill: #F0B90B; filter: drop-shadow(0 0 4px rgba(240,185,11,0.4)); }
    .combo-row p { font-size: 9px; font-weight: 800; color: #F0B90B; letter-spacing: 2px; }

    /* Address */
    .addr-row { text-align: center; margin-bottom: 16px; }
    .addr-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 4px 14px;
    }
    .addr-dot { width: 5px; height: 5px; border-radius: 50%; background: #0ECB81; box-shadow: 0 0 6px rgba(14,203,129,0.5); }

    /* CTA button */
    .btn-play {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      text-align: center;
      background: linear-gradient(135deg, #0052FF 0%, #003FCC 100%);
      color: #fff;
      border: none;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: lowercase;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,82,255,0.35);
      transition: all 0.2s;
    }
    .btn-play:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(0,82,255,0.5); }
  </style>
</head>
<body>
  <div class="overlay">
    <div class="card">
      <div class="brand">
        <span class="brand-name">base dash</span>
      </div>

      <div class="header">
        <h2>${deathMsg}</h2>
      </div>

      <div class="score-hero">
        <p class="score-label">final pnl</p>
        <p class="score-value">${formattedScore}</p>
        <span class="speed-badge">${speedName}</span>
      </div>

      ${hasCombo ? `
      <div class="combo-row">
        <svg viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
        <p>${combo}× max combo</p>
      </div>
      ` : ''}

      ${hasStats ? `
      <div class="stats-grid">
        <div class="stat-cell">
          <p class="stat-label">time</p>
          <p class="stat-value">${time || '0'}s</p>
        </div>
        <div class="stat-cell">
          <p class="stat-label">dodged</p>
          <p class="stat-value">${dodged || '0'}</p>
        </div>
        <div class="stat-cell green">
          <p class="stat-label">buys</p>
          <p class="stat-value">${buys || '0'}</p>
        </div>
        <div class="stat-cell">
          <p class="stat-label">jumps</p>
          <p class="stat-value">${jumps || '0'}</p>
        </div>
      </div>
      ` : ''}

      <div class="addr-row">
        <span class="addr-badge">
          ${address ? '<span class="addr-dot"></span>' : ''}
          ${shortAddr}
        </span>
      </div>

      <a href="${appUrl}" class="btn-play">🎮 play base dash</a>
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
