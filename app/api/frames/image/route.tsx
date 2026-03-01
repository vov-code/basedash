import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

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

        // Format score
        let formattedScore: string
        if (s >= 1_000_000_000) formattedScore = `$${(s / 1_000_000_000).toFixed(2)}B`
        else if (s >= 1_000_000) formattedScore = `$${(s / 1_000_000).toFixed(2)}M`
        else if (s >= 1_000) formattedScore = `$${(s / 1_000).toFixed(2)}K`
        else formattedScore = `$${s.toLocaleString()}`

        // Determine speed tier
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

        // Load custom font (optional, using default sans for speed, or we can use generic system fonts)
        // Satori doesn't support "system-ui" out of the box without a font file, but we can rely on default if needed.

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8fafc',
                        backgroundImage: 'radial-gradient(circle at 25px 25px, #e2e8f0 2%, transparent 0%), radial-gradient(circle at 75px 75px, #e2e8f0 2%, transparent 0%)',
                        backgroundSize: '100px 100px',
                        fontFamily: 'monospace',
                    }}
                >
                    {/* Card mimicking Game Over */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '85%',
                            backgroundColor: 'white',
                            borderRadius: '24px',
                            border: '2px solid rgba(10, 11, 20, 0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            padding: '32px',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '36px', fontWeight: 900, color: '#F6465D', letterSpacing: '4px', textTransform: 'lowercase', margin: 0 }}>
                                {deathMsg}
                            </h2>
                        </div>

                        {/* 2-col Stats */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: '16px', padding: '16px', alignItems: 'center' }}>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#94A3B8', letterSpacing: '4px', textTransform: 'lowercase', marginBottom: '8px' }}>pnl</span>
                                <span style={{ fontSize: '48px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{formattedScore}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: '#EEF4FF', border: '2px solid rgba(0, 82, 255, 0.2)', borderRadius: '16px', padding: '16px', alignItems: 'center' }}>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#6CACFF', letterSpacing: '4px', textTransform: 'lowercase', marginBottom: '8px' }}>mode</span>
                                <span style={{ fontSize: '32px', fontWeight: 900, color: speedColor, letterSpacing: '2px', textTransform: 'lowercase', lineHeight: 1.2, textAlign: 'center' }}>{speedName}</span>
                            </div>
                        </div>

                        {/* Combo Row */}
                        {combo && (
                            <div style={{ display: 'flex', backgroundColor: '#FFFBEB', border: '2px solid rgba(240, 185, 11, 0.3)', borderRadius: '16px', padding: '16px', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>🔥</span>
                                <span style={{ fontSize: '24px', fontWeight: 900, color: '#B78905', letterSpacing: '2px', textTransform: 'lowercase' }}>{combo}× max combo</span>
                            </div>
                        )}

                        {/* 4-col Mini Stats */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
                            {[
                                { label: 'time', value: `${time || '0'}s`, green: false },
                                { label: 'dodged', value: dodged || '0', green: false },
                                { label: 'buys', value: buys || '0', green: true },
                                { label: 'jumps', value: jumps || '0', green: false },
                            ].map((stat) => (
                                <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: stat.green ? '#E8F8F0' : '#F8FAFC', border: `2px solid ${stat.green ? 'rgba(14, 203, 129, 0.4)' : '#E2E8F0'}`, borderRadius: '12px', padding: '12px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 900, color: stat.green ? '#0ECB81' : '#94A3B8', letterSpacing: '2px', textTransform: 'lowercase', marginBottom: '4px' }}>{stat.label}</span>
                                    <span style={{ fontSize: '28px', fontWeight: 900, color: stat.green ? '#0ECB81' : '#334155' }}>{stat.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Player Address */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ backgroundColor: '#F1F5F9', border: '2px solid #E2E8F0', borderRadius: '12px', padding: '8px 24px', display: 'flex' }}>
                                <span style={{ fontSize: '24px', fontWeight: 700, color: '#64748B', letterSpacing: '2px' }}>{shortAddr}</span>
                            </div>
                        </div>
                    </div>
                </div >
            ),
            {
                width: 600,
                height: 600, // Square image for 1:1 aspect ratio
            }
        )
    } catch (e: any) {
        console.log(`${e.message}`)
        return new Response(`Failed to generate the image`, {
            status: 500,
        })
    }
}
