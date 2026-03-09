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

        // Small, subtle candlestick bars floating across the background
        const barCount = isLowEnd ? 18 : 35
        const bars: Bar[] = []
        for (let i = 0; i < barCount; i++) {
            const isGreen = Math.random() > 0.45
            bars.push({
                x: Math.random() * w * 1.5,
                y: Math.random() * h,
                bodyH: 8 + Math.random() * 18,    // Small candle bodies
                wickH: 4 + Math.random() * 10,    // Small wicks
                isGreen,
                speed: 0.1 + Math.random() * 0.25,
                alpha: 0.12 + Math.random() * 0.1,  // Subtle but visible
            })
        }

        const draw = () => {
            if (document.hidden) { animId = requestAnimationFrame(draw); return }
            ctx.clearRect(0, 0, w, h)

            // === SCROLLING CANDLESTICK BARS ONLY (no floating particles) ===
            const barW = isLowEnd ? 3 : 4  // Thin, elegant candles
            for (const bar of bars) {
                bar.x -= bar.speed
                if (bar.x < -barW * 2) {
                    bar.x = w + barW * 2 + Math.random() * 80
                    bar.y = Math.random() * h
                }

                ctx.fillStyle = bar.isGreen ? `rgba(14,203,129,${bar.alpha})` : `rgba(246,70,93,${bar.alpha})`

                // wick (thin line)
                ctx.fillRect(bar.x + barW / 2 - 0.5, bar.y - bar.wickH, 1, bar.bodyH + bar.wickH * 2)
                // body
                ctx.fillRect(bar.x, bar.y, barW, bar.bodyH)
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
                background: 'linear-gradient(180deg, rgba(248,250,252,0) 0%, rgba(0,82,255,0.02) 100%)',
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
