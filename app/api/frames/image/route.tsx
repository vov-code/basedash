import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * Farcaster Frame v2 — Premium OG Image Generator
 *
 * Generates a 600×600 (1:1) PNG image for social sharing.
 * Dark theme with neon glow effects, gradient score display,
 * and "BUILT ON BASE" branding watermark.
 *
 * Used by: /api/frames/result -> fc:frame:image meta tag
 */

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const scoreStr = searchParams.get('score') || '0'
        const address = searchParams.get('address') || ''
        const time = searchParams.get('time') || ''
        const dodged = searchParams.get('dodged') || ''
        const buys = searchParams.get('buys') || ''
        const jumps = searchParams.get('jumps') || ''
        const combo = searchParams.get('combo') || ''

        const s = Number(scoreStr)
        const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'anon'

        // Format score as market-cap style
        let formattedScore: string
        if (s >= 1_000_000_000) formattedScore = `$${(s / 1_000_000_000).toFixed(2)}B`
        else if (s >= 1_000_000) formattedScore = `$${(s / 1_000_000).toFixed(2)}M`
        else if (s >= 1_000) formattedScore = `$${(s / 1_000).toFixed(2)}K`
        else formattedScore = `$${s.toLocaleString()}`

        // Determine speed tier with colors
        let speedName = 'paper hands'
        let speedColor = '#94A3B8'
        let accentGlow = 'rgba(148,163,184,0.3)'
        if (s >= 5000) { speedName = 'whale'; speedColor = '#8B5CF6'; accentGlow = 'rgba(139,92,246,0.4)' }
        else if (s >= 3000) { speedName = 'diamond hands'; speedColor = '#0052FF'; accentGlow = 'rgba(0,82,255,0.4)' }
        else if (s >= 1500) { speedName = 'bull run'; speedColor = '#0ECB81'; accentGlow = 'rgba(14,203,129,0.4)' }
        else if (s >= 700) { speedName = 'fomo'; speedColor = '#F0B90B'; accentGlow = 'rgba(240,185,11,0.4)' }
        else if (s >= 300) { speedName = 'degen'; speedColor = '#F6465D'; accentGlow = 'rgba(246,70,93,0.4)' }

        // Death message — deterministic based on score + address
        const deathMessages = ['rekt!', 'liquidated!', 'rugged!', 'ngmi', 'dumped!', 'paper handed!']
        const msgIdx = Math.abs(s * 7 + (address ? address.charCodeAt(2) || 0 : 0)) % deathMessages.length
        const deathMsg = deathMessages[msgIdx]

        const hasCombo = combo && Number(combo) > 0

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#0A0B14',
                        fontFamily: 'monospace',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Background radial glow */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-30%',
                            left: '-30%',
                            width: '160%',
                            height: '160%',
                            background: `radial-gradient(circle at 50% 40%, ${accentGlow}, transparent 60%)`,
                            display: 'flex',
                        }}
                    />

                    {/* Grid pattern overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                            display: 'flex',
                        }}
                    />

                    {/* Main card */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '85%',
                            backgroundColor: 'rgba(15,17,26,0.95)',
                            borderRadius: '28px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: `0 32px 64px rgba(0,0,0,0.6), 0 0 80px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                            padding: '36px 32px',
                            position: 'relative',
                        }}
                    >
                        {/* Brand header */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '6px', textTransform: 'uppercase' as const }}>
                                base dash
                            </span>
                        </div>

                        {/* Death message */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#F6465D', letterSpacing: '4px', textTransform: 'lowercase' as const, textShadow: '0 0 30px rgba(246,70,93,0.5)' }}>
                                {deathMsg}
                            </span>
                        </div>

                        {/* Score + Speed tier */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginBottom: '24px',
                            padding: '20px 16px',
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '5px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                                final pnl
                            </span>
                            <span style={{ fontSize: '52px', fontWeight: 900, color: '#ffffff', letterSpacing: '-2px', textShadow: `0 4px 20px rgba(255,255,255,0.15), 0 0 40px ${accentGlow}` }}>
                                {formattedScore}
                            </span>
                            <div style={{
                                display: 'flex',
                                marginTop: '12px',
                                padding: '6px 20px',
                                borderRadius: '24px',
                                backgroundColor: `${speedColor}22`,
                                border: `1px solid ${speedColor}44`,
                            }}>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: speedColor, letterSpacing: '3px', textTransform: 'lowercase' as const }}>
                                    {speedName}
                                </span>
                            </div>
                        </div>

                        {/* Combo row */}
                        {hasCombo && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '20px',
                                padding: '10px 16px',
                                borderRadius: '14px',
                                backgroundColor: 'rgba(240,185,11,0.08)',
                                border: '1px solid rgba(240,185,11,0.2)',
                            }}>
                                <span style={{ fontSize: '22px' }}>🔥</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#F0B90B', letterSpacing: '2px' }}>
                                    {combo}× max combo
                                </span>
                            </div>
                        )}

                        {/* Stats grid */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '20px' }}>
                            {[
                                { label: 'time', value: `${time || '0'}s`, accent: false },
                                { label: 'dodged', value: dodged || '0', accent: false },
                                { label: 'buys', value: buys || '0', accent: true },
                                { label: 'jumps', value: jumps || '0', accent: false },
                            ].map((stat) => (
                                <div key={stat.label} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1,
                                    alignItems: 'center',
                                    padding: '10px 6px',
                                    borderRadius: '14px',
                                    backgroundColor: stat.accent ? 'rgba(14,203,129,0.08)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${stat.accent ? 'rgba(14,203,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: stat.accent ? 'rgba(14,203,129,0.6)' : 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'lowercase' as const, marginBottom: '4px' }}>
                                        {stat.label}
                                    </span>
                                    <span style={{ fontSize: '22px', fontWeight: 900, color: stat.accent ? '#0ECB81' : 'rgba(255,255,255,0.85)' }}>
                                        {stat.value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Player address + branding */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                                {address && (
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0ECB81', boxShadow: '0 0 8px rgba(14,203,129,0.5)', display: 'flex' }} />
                                )}
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                                    {shortAddr}
                                </span>
                            </div>

                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.15)', letterSpacing: '3px', textTransform: 'uppercase' as const }}>
                                built on base
                            </span>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 600,
                height: 600,
            }
        )
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('Frame image error:', message)
        return new Response('Failed to generate the image', {
            status: 500,
        })
    }
}
