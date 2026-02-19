'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useWallet } from '@/app/hooks/useWallet'
import { useDailyCheckin } from '@/app/hooks/useDailyCheckin'
import { useWriteContract } from 'wagmi'
import { GAME_LEADERBOARD_ABI, CONTRACT_ADDRESS } from '@/app/contracts'

// ============ ENHANCED GAME WITH NEW OBSTACLES & FEATURES ============
// OPTIMIZED FOR SMOOTH 60FPS GAMEPLAY

const GRAVITY = 0.6, JUMP_FORCE = -14, GROUND_Y = 340, PLAYER_SIZE = 48
const INITIAL_SPEED = 3.2, MAX_SPEED = 9, ACCELERATION = 0.00025
const MIN_SPAWN_INTERVAL = 380, MAX_SPAWN_INTERVAL = 850

interface Obstacle {
  id: string; x: number; y: number; width: number; height: number
  type: 'spike' | 'spike-group' | 'block' | 'platform' | 'moving-block' | 'spike-wall' | 'gap'
  passed: boolean; rotation?: number; speed?: number; direction?: number
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface Star { x: number; y: number; size: number; speed: number; opacity: number }

const THEMES = [
  { name: 'sunrise', startScore: 0, bg: '#FF6B6B', accent: '#FF5252' },
  { name: 'midnight', startScore: 300, bg: '#0D0E26', accent: '#6B7FFF' },
  { name: 'neon', startScore: 800, bg: '#1a0a2e', accent: '#ff00cc' },
  { name: 'cyberpunk', startScore: 1500, bg: '#0f0c29', accent: '#00F5FF' },
]

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { address, connectWallet, isConnected } = useWallet()
  const { checkInStatus } = useDailyCheckin(address)

  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu')
  const [score, setScore] = useState(0), [highScore, setHighScore] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 })
  const [isLoading, setIsLoading] = useState(true)

  const playerRef = useRef({ x: 100, y: GROUND_Y - PLAYER_SIZE, velocity: 0, isJumping: false, rotation: 0, doubleJumpAvailable: false })
  const obstaclesRef = useRef<Obstacle[]>([])
  const particlesRef = useRef<Particle[]>([])
  const starsRef = useRef<Star[]>([])
  const gameLoopRef = useRef<number>()
  const speedRef = useRef(INITIAL_SPEED), scoreRef = useRef(0), lastObstacleTimeRef = useRef(0) as any
  const obstacleCounterRef = useRef(0), floorOffsetRef = useRef(0), shakeRef = useRef(0)

  useEffect(() => { setTimeout(() => setIsLoading(false), 1500) }, [])
  useEffect(() => { const saved = localStorage.getItem('base-dash-highscore'); if (saved) setHighScore(parseInt(saved)) }, [])
  useEffect(() => {
    const updateSize = () => { if (containerRef.current) { const w = Math.min(containerRef.current.clientWidth, 900); setCanvasSize({ width: w, height: Math.max(w / 2, 300) }) } }
    updateSize(); window.addEventListener('resize', updateSize); return () => window.removeEventListener('resize', updateSize)
  }, [])
  useEffect(() => { starsRef.current = Array.from({ length: 60 }, () => ({ x: Math.random() * 800, y: Math.random() * 300, size: Math.random() * 2.5 + 0.5, speed: Math.random() * 0.15 + 0.05, opacity: Math.random() * 0.5 + 0.3 })) }, [])

  const createParticles = (x: number, y: number, color: string, count: number) => {
    // OPTIMIZED: Limit particles to prevent memory leaks
    const maxParticles = 200
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current = particlesRef.current.slice(-maxParticles / 2)
    }
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2, speed = Math.random() * 4 + 2.5
      particlesRef.current.push({ 
        x, y, 
        vx: Math.cos(angle) * speed, 
        vy: Math.sin(angle) * speed - 1, 
        life: 1, 
        color, 
        size: Math.random() * 4 + 1.5 
      })
    }
  }

  const spawnObstacle = useCallback(() => {
    // SMART SPAWNING: Avoid obstacle spam
    if (Date.now() - lastObstacleTimeRef.current < MIN_SPAWN_INTERVAL) return
    if (Math.random() < 0.3) return // Random skip for variation

    const score = scoreRef.current
    const baseX = canvasSize.width + 50
    const id = `obs-${obstacleCounterRef.current++}`
    
    // Difficulty progression
    let types: Array<'spike' | 'spike-group' | 'block' | 'platform' | 'moving-block' | 'spike-wall' | 'gap'>
    if (score < 200) {
      types = ['spike', 'block', 'platform']
    } else if (score < 600) {
      types = ['spike', 'spike-group', 'block', 'moving-block', 'platform']
    } else if (score < 1200) {
      types = ['spike-group', 'spike-wall', 'block', 'moving-block', 'platform']
    } else {
      types = ['spike-group', 'spike-wall', 'moving-block', 'platform', 'gap']
    }
    
    const type = types[Math.floor(Math.random() * types.length)]
    
    const configs: Record<string, any> = {
      spike: { id, x: baseX, y: GROUND_Y - 45, width: 35, height: 50, type: 'spike', passed: false },
      'spike-group': { x: baseX, y: GROUND_Y - 40, width: 110, height: 45, type: 'spike-group', passed: false },
      block: { id, x: baseX, y: GROUND_Y - 65, width: 50, height: 70, type: 'block', passed: false },
      platform: { id, x: baseX, y: GROUND_Y - 140, width: 110, height: 30, type: 'platform', passed: false },
      'moving-block': { id, x: baseX, y: GROUND_Y - 110, width: 45, height: 50, type: 'moving-block', passed: false, speed: 2.5, direction: Math.random() > 0.5 ? 1 : -1 },
      'spike-wall': { x: baseX, y: GROUND_Y - 100, width: 90, height: 45, type: 'spike-wall', passed: false },
      gap: { id, x: baseX, y: GROUND_Y + 5, width: 120, height: 60, type: 'gap', passed: false }
    }
    
    const obstacle = configs[type]
    if (type === 'spike-group') {
      // Create 3 spikes in a row
      for (let i = 0; i < 3; i++) {
        obstaclesRef.current.push({
          id: `${id}-${i}`, x: baseX + i * 40, y: GROUND_Y - 45, 
          width: 32, height: 48, type: 'spike', passed: false
        })
      }
    } else if (type === 'spike-wall') {
      // Create diagonal wall
      for (let i = 0; i < 2; i++) {
        obstaclesRef.current.push({
          id: `${id}-${i}`, x: baseX + i * 55, y: GROUND_Y - 50 - i * 35,
          width: 38, height: 48, type: 'spike', passed: false
        })
      }
    } else {
      obstaclesRef.current.push(obstacle)
    }
    
    lastObstacleTimeRef.current = Date.now()
  }, [canvasSize.width])

  const checkCollision = (playerX: number, playerY: number, obs: Obstacle): boolean => {
    // Better collision detection with padding
    const padding = 6
    const [pl, pr, pt, pb] = [playerX + padding, playerX + PLAYER_SIZE - padding, playerY + padding, playerY + PLAYER_SIZE - padding]
    const [ol, or, ot, ob] = [obs.x, obs.x + obs.width, obs.y, obs.y + obs.height]
    
    if (obs.type === 'platform') {
      // Only collide from above, with some tolerance
      if (playerRef.current.velocity >= 0 && pb >= ot - 8 && pb <= ot + 30 && pr > ol + 8 && pl < or - 8) {
        playerRef.current.y = ot - PLAYER_SIZE
        playerRef.current.velocity = 0
        playerRef.current.isJumping = false
        playerRef.current.doubleJumpAvailable = true
        createParticles(playerX + PLAYER_SIZE / 2, ot, '#FFD700', 6)
        return false
      }
      // Die if hit from other sides
      return pr > ol && pl < or && pb > ot && pt < ob
    }
    
    if (obs.type === 'gap') {
      // Gap only kills if you fall into it
      return pb > ot && pr > ol && pl < or && playerRef.current.velocity > 0
    }
    
    return pr > ol && pl < or && pb > ot && pt < ob
  }

  const getCurrentTheme = (s: number) => {
    for (let i = THEMES.length - 1; i >= 0; i--) if (s >= THEMES[i].startScore) return THEMES[i]
    return THEMES[0]
  }

  const resetGame = () => {
    playerRef.current = { x: 100, y: GROUND_Y - PLAYER_SIZE, velocity: 0, isJumping: false, rotation: 0, doubleJumpAvailable: false }
    obstaclesRef.current = []; particlesRef.current = []; speedRef.current = INITIAL_SPEED; scoreRef.current = 0; obstacleCounterRef.current = 0; setScore(0)
  }

  const startGame = () => { resetGame(); setGameState('playing') }
  const stopGame = () => { setGameState('gameover'); if (scoreRef.current > highScore) { localStorage.setItem('base-dash-highscore', scoreRef.current.toString()); setHighScore(scoreRef.current) }; shakeRef.current = 25; createParticles(playerRef.current.x + PLAYER_SIZE / 2, playerRef.current.y + PLAYER_SIZE / 2, '#FF3B30', 40) }
  const jump = () => {
    if (gameState !== 'playing') return
    
    if (!playerRef.current.isJumping) {
      // First jump
      playerRef.current.velocity = JUMP_FORCE
      playerRef.current.isJumping = true
      playerRef.current.doubleJumpAvailable = true
      createParticles(playerRef.current.x + PLAYER_SIZE / 2, playerRef.current.y + PLAYER_SIZE, '#FFFFFF', 8)
    } else if (playerRef.current.doubleJumpAvailable && scoreRef.current >= 250) {
      // Double jump (unlocked at 250 score)
      playerRef.current.velocity = JUMP_FORCE * 0.95
      playerRef.current.doubleJumpAvailable = false
      createParticles(playerRef.current.x + PLAYER_SIZE / 2, playerRef.current.y + PLAYER_SIZE / 2, '#FFD700', 12)
    }
  }

  useEffect(() => {
    if (gameState !== 'playing') return
    
    let activeLoopRef = true
    let lastFrameTime = Date.now()
    
    const gameLoop = () => {
      if (!activeLoopRef) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) { 
        if (activeLoopRef) gameLoopRef.current = requestAnimationFrame(gameLoop)
        return 
      }

      // Frame time calculation for consistent physics
      const now = Date.now()
      const deltaTime = Math.min((now - lastFrameTime) / 16.67, 2) // Clamp to prevent huge jumps
      lastFrameTime = now

      // ===== PHYSICS UPDATE =====
      playerRef.current.velocity += GRAVITY * deltaTime
      playerRef.current.y += playerRef.current.velocity * deltaTime
      
      // Ground collision
      if (playerRef.current.y >= GROUND_Y - PLAYER_SIZE) {
        playerRef.current.y = GROUND_Y - PLAYER_SIZE
        playerRef.current.velocity = 0
        playerRef.current.isJumping = false
      }

      // Smooth rotation
      if (playerRef.current.isJumping) {
        playerRef.current.rotation += 0.10 * deltaTime
      } else {
        const targetRot = Math.round(playerRef.current.rotation / (Math.PI / 2)) * (Math.PI / 2)
        playerRef.current.rotation += (targetRot - playerRef.current.rotation) * 0.12 * deltaTime
      }

      // ===== GAME SPEED UP =====
      if (speedRef.current < MAX_SPEED) {
        speedRef.current += ACCELERATION * deltaTime
      }

      // ===== OBSTACLE SPAWNING & UPDATE =====
      spawnObstacle()

      // Update and remove obstacles
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i]
        
        // Moving block physics
        if (obs.type === 'moving-block' && obs.speed && obs.direction !== undefined) {
          obs.y += obs.speed * obs.direction * deltaTime
          if (obs.y <= 150 || obs.y >= GROUND_Y - 50) {
            obs.direction = -obs.direction
          }
        }
        
        obs.x -= speedRef.current * deltaTime
        
        // Score for passed obstacle
        if (!obs.passed && obs.x + obs.width < playerRef.current.x) {
          obs.passed = true
          scoreRef.current += 10
          setScore(scoreRef.current)
        }
        
        // Remove off-screen
        if (obs.x + obs.width < -100) {
          obstaclesRef.current.splice(i, 1)
          continue
        }
        
        // Collision check
        if (checkCollision(playerRef.current.x, playerRef.current.y, obs)) {
          stopGame()
          activeLoopRef = false
          return
        }
      }

      // ===== PARTICLE UPDATE =====
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.x += p.vx * deltaTime
        p.y += p.vy * deltaTime
        p.vy += 0.2 * deltaTime
        p.vx *= 0.96
        p.life -= 0.02 * deltaTime
        
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1)
        }
      }

      // ===== RENDERING =====
      const theme = getCurrentTheme(scoreRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Screen shake
      if (shakeRef.current > 0) {
        ctx.save()
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current)
        shakeRef.current *= 0.82
      }

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      bgGrad.addColorStop(0, '#0A1628')
      bgGrad.addColorStop(0.5, '#1a3a8a')
      bgGrad.addColorStop(1, '#0052FF')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // ===== STARS =====
      starsRef.current.forEach(star => {
        star.x -= star.speed * (speedRef.current / INITIAL_SPEED)
        if (star.x < 0) star.x = canvas.width
        
        const twinkle = 0.3 + Math.sin(now * 0.005 + star.x) * 0.5
        ctx.globalAlpha = Math.min(star.opacity * twinkle, 0.8)
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1

      // ===== GROUND =====
      floorOffsetRef.current = (floorOffsetRef.current + speedRef.current * 0.6) % 60
      const gGrad = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height)
      gGrad.addColorStop(0, '#0052FF88')
      gGrad.addColorStop(1, '#003388')
      ctx.fillStyle = gGrad
      ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y)

      // Ground line
      ctx.strokeStyle = '#00FFD4BB'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(canvas.width, GROUND_Y)
      ctx.stroke()
      ctx.setLineDash([])

      // ===== OBSTACLES RENDERING =====
      obstaclesRef.current.forEach(obs => {
        if (obs.type === 'spike' || obs.type === 'spike-wall') {
          ctx.fillStyle = '#FF5252'
          ctx.strokeStyle = '#FF1744'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(obs.x + obs.width / 2, obs.y)
          ctx.lineTo(obs.x, obs.y + obs.height)
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          
          // Highlight
          ctx.strokeStyle = '#FFCDD2'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(obs.x + obs.width / 2 - 1.5, obs.y + 3)
          ctx.lineTo(obs.x + obs.width / 2 + 1.5, obs.y + 12)
          ctx.stroke()
        } else if (obs.type === 'block' || obs.type === 'moving-block') {
          const g = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.height)
          g.addColorStop(0, '#8FA3FF')
          g.addColorStop(1, '#525FE8')
          ctx.fillStyle = g
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
          ctx.strokeStyle = '#00FFD4'
          ctx.lineWidth = 1.5
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height)
        } else if (obs.type === 'platform') {
          const g = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y + obs.height)
          g.addColorStop(0, '#00FFD4')
          g.addColorStop(1, '#00BCD4')
          ctx.fillStyle = g
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
          
          // Glow
          ctx.shadowBlur = 12
          ctx.shadowColor = '#00FFD488'
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1.5
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height)
          ctx.shadowBlur = 0
        }
      })

      // ===== PLAYER =====
      ctx.save()
      ctx.translate(playerRef.current.x + PLAYER_SIZE / 2, playerRef.current.y + PLAYER_SIZE / 2)
      ctx.rotate(playerRef.current.rotation)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowBlur = 18
      ctx.shadowColor = '#0052FFAA'
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)
      
      ctx.fillStyle = '#0052FF'
      ctx.fillRect(-PLAYER_SIZE / 2 + 6, -PLAYER_SIZE / 2 + 6, PLAYER_SIZE - 12, PLAYER_SIZE - 12)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 32px "Courier New"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('B', 0, 0)
      
      ctx.shadowBlur = 0
      ctx.restore()

      // ===== PARTICLES =====
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life * 0.85)
        ctx.fillStyle = p.color
        ctx.shadowBlur = 6
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0

      // ===== UI =====
      // Score box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(15, 15, 120, 60)
      ctx.strokeStyle = '#0052FFBB'
      ctx.lineWidth = 1.5
      ctx.strokeRect(15, 15, 120, 60)
      
      ctx.fillStyle = '#00FFD4'
      ctx.font = 'bold 11px "Inter"'
      ctx.textAlign = 'left'
      ctx.fillText('SCORE', 25, 30)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 32px "Courier New"'
      ctx.fillText(scoreRef.current.toString(), 25, 58)
      
      // Speed indicator
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(canvas.width - 115, 15, 100, 35)
      ctx.strokeStyle = '#00FFD4AA'
      ctx.lineWidth = 1
      ctx.strokeRect(canvas.width - 115, 15, 100, 35)
      
      ctx.fillStyle = '#00FFD4'
      ctx.font = 'bold 9px "Inter"'
      ctx.textAlign = 'center'
      ctx.fillText('SPEED', canvas.width - 65, 24)
      
      const speedPercent = ((speedRef.current - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fillRect(canvas.width - 110, 32, 90, 4)
      ctx.fillStyle = '#00FFD4BB'
      ctx.fillRect(canvas.width - 110, 32, (90 * speedPercent) / 100, 4)

      if (shakeRef.current > 0) ctx.restore()
      
      if (activeLoopRef) gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
    
    gameLoopRef.current = requestAnimationFrame(gameLoop)
    return () => { activeLoopRef = false; if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current) }
  }, [gameState])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (gameState === 'menu' || gameState === 'gameover') startGame(); else jump() } }
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey)
  }, [gameState])

  if (isLoading) return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto px-4">
      <div className="relative w-full aspect-[2/1] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-600 to-blue-900">
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center"><div className="mb-8 animate-bounce"><div className="w-24 h-24 mx-auto bg-white rounded-2xl shadow-2xl flex items-center justify-center border-4 border-blue-400"><div className="text-4xl font-bold text-blue-600">B</div></div></div><h1 className="text-5xl font-black text-white mb-3 tracking-tighter">BASE DASH</h1><p className="text-blue-200 mb-8 text-lg font-medium">infinite rhythm runner</p><div className="w-56 h-3 bg-blue-900 rounded-full mx-auto overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 animate-pulse" style={{ width: '75%' }} /></div></div>
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto px-4">
      <div className="relative"><canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="w-full rounded-3xl shadow-2xl cursor-pointer border-2 border-blue-500/30" onClick={() => { if (gameState === 'menu' || gameState === 'gameover') startGame(); else jump() }} onTouchStart={(e) => { e.preventDefault(); if (gameState === 'menu' || gameState === 'gameover') startGame(); else jump() }} style={{ touchAction: 'none' }} />
        {gameState === 'menu' && (<div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-3xl"><div className="text-center p-8 max-w-md"><div className="mb-6 animate-bounce"><div className="w-20 h-20 mx-auto bg-white rounded-2xl flex items-center justify-center text-4xl font-black text-blue-600 shadow-lg">B</div></div><h1 className="text-5xl font-black text-white mb-2 tracking-tighter">BASE DASH</h1><p className="text-blue-300 mb-6 text-sm font-medium tracking-widest">JUMP • SURVIVE • DOMINATE</p><div className="bg-gradient-to-br from-white/5 to-white/0 p-4 rounded-2xl mb-6 border border-white/10"><p className="text-white/80 text-xs leading-relaxed">Избегайте препятствий, прыгайте пробел/тап. После 250 очков двойной прыжок. Максимум плавности!</p></div><div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-4 rounded-2xl border border-blue-400/30"><p className="text-blue-300 text-xs font-bold mb-1 uppercase">BEST</p><p className="text-3xl font-black text-yellow-400">{highScore.toLocaleString()}</p></div><div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 p-4 rounded-2xl border border-cyan-400/30"><p className="text-cyan-300 text-xs font-bold mb-1 uppercase">STREAK</p><p className="text-3xl font-black text-cyan-400">🔥 {checkInStatus.streak}</p></div></div><button onClick={startGame} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 mb-3 uppercase tracking-widest">START GAME</button>{isConnected && <p className="text-green-400 text-xs font-bold">✓ WALLET CONNECTED</p>}{!isConnected && (<button onClick={connectWallet} className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold py-2 rounded-xl transition border border-blue-400/30 text-xs">CONNECT WALLET TO SAVE SCORES</button>)}<p className="text-gray-500 text-xs mt-4">SPACE • CLICK • TAP TO JUMP</p></div></div>)}
        {gameState === 'gameover' && (<div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl"><div className="text-center p-8 max-w-md"><h2 className="text-5xl font-black text-red-500 mb-6">GAME OVER</h2><div className="bg-gradient-to-br from-red-500/10 to-red-600/5 p-6 rounded-2xl mb-6 border border-red-400/30"><div className="grid grid-cols-2 gap-4"><div><p className="text-red-300 text-xs font-bold mb-2 uppercase">THIS RUN</p><p className="text-4xl font-black text-red-400">{score.toLocaleString()}</p></div><div><p className="text-yellow-300 text-xs font-bold mb-2 uppercase">PERSONAL BEST</p><p className="text-4xl font-black text-yellow-400">{highScore.toLocaleString()}</p></div></div></div><button onClick={startGame} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg mb-3 uppercase tracking-widest">TRY AGAIN</button><p className="text-gray-500 text-xs">TAP CANVAS TO CONTINUE</p></div></div>)}
      </div>
      <div className="mt-6 text-center text-gray-500 text-sm"><p>SPACE • ARROW UP • CLICK • TAP TO JUMP</p>{scoreRef.current >= 250 && <p className="text-yellow-400 font-bold mt-1">🚀 DOUBLE JUMP UNLOCKED!</p>}</div>

      {/* Score Display */}
      <div className="flex justify-between items-center mt-4 px-2">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">score</p>
            <p className="text-2xl font-bold text-white">{score.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">best</p>
            <p className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
