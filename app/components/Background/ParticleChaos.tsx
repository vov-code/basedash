'use client'

import React, { useEffect, useRef } from 'react'

interface ParticleChaosProps {
    opacity?: number
}

export default function ParticleChaos({ opacity = 1.0 }: ParticleChaosProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animId: number
        let w = window.innerWidth
        let h = window.innerHeight

        // Detect low-end devices
        const isLowEnd = typeof navigator !== 'undefined' && (
            navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2 ||
            (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4
        )

        const updateSize = () => {
            w = window.innerWidth
            h = window.innerHeight
            canvas.width = w
            canvas.height = h
        }
        updateSize()

        interface Bar {
            x: number
            y: number
            bodyH: number
            wickH: number
            isGreen: boolean
            speed: number
            alpha: number
        }

        // Scrolling candlestick bars — the signature look (enhanced visibility)
        const barCount = isLowEnd ? 15 : 30
        const bars: Bar[] = []
        for (let i = 0; i < barCount; i++) {
            const isGreen = Math.random() > 0.45
            bars.push({
                x: Math.random() * w * 1.5,
                y: -50 + Math.random() * h * 1.2, // Spread them everywhere
                bodyH: 30 + Math.random() * 60,   // Bigger
                wickH: 15 + Math.random() * 30,   // Bigger
                isGreen,
                speed: 0.15 + Math.random() * 0.3,
                alpha: 0.2 + Math.random() * 0.15, // Way brighter so they show through glass
            })
        }


        let tick = 0

        const draw = () => {
            if (document.hidden) { animId = requestAnimationFrame(draw); return }
            ctx.clearRect(0, 0, w, h)
            tick++

            // === SCROLLING CANDLESTICK BARS ===
            const barW = isLowEnd ? 10 : 14 // Fatter candles
            for (const bar of bars) {
                bar.x -= bar.speed
                if (bar.x < -barW * 2) {
                    bar.x = w + barW * 2 + Math.random() * 60
                    bar.y = -50 + Math.random() * h * 1.2
                }

                ctx.fillStyle = bar.isGreen ? `rgba(14,203,129,${bar.alpha})` : `rgba(246,70,93,${bar.alpha})`

                // wick
                ctx.fillRect(bar.x + barW / 2 - 1, bar.y - bar.wickH, 2, bar.bodyH + bar.wickH * 2)
                // body
                ctx.fillRect(bar.x, bar.y, barW, bar.bodyH)
            }

            // === FLOATING PARTICLES (Base colored) ===
            if (!isLowEnd) {
                for (let i = 0; i < 15; i++) {
                    const t = tick * 0.01 + i * 0.5
                    const px = (Math.sin(t * 0.5) * 0.5 + 0.5) * w
                    const py = (Math.cos(t * 0.3) * 0.5 + 0.5) * h
                    const size = Math.abs(Math.sin(t)) * 3 + 1
                    ctx.beginPath()
                    ctx.arc(px, py, size, 0, Math.PI * 2)
                    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,82,255,0.1)' : 'rgba(255,255,255,0.05)'
                    ctx.fill()
                }
            }

            animId = requestAnimationFrame(draw)
        }
        animId = requestAnimationFrame(draw)

        window.addEventListener('resize', updateSize)
        return () => {
            window.removeEventListener('resize', updateSize)
            cancelAnimationFrame(animId)
        }
    }, [])

    return (
        <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
                background: 'linear-gradient(180deg, rgba(248,250,252,0) 0%, rgba(0,82,255,0.03) 100%)',
                opacity
            }}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ opacity: 1 }}
            />
        </div>
    )
}
