'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface GameState {
  isPlaying: boolean
  isGameOver: boolean
  score: number
  highScore: number
  speed: number
}

interface PlayerState {
  x: number
  y: number
  velocity: number
  isJumping: boolean
  rotation: number
}

interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  type: 'spike' | 'block' | 'platform'
  passed: boolean
}

interface UseGameLoopProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  onGameOver?: (score: number) => void
  onScoreUpdate?: (score: number) => void
}

export function useGameLoop({ canvasRef, onGameOver, onScoreUpdate }: UseGameLoopProps) {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    highScore: 0,
    speed: 5,
  })

  const playerRef = useRef<PlayerState>({
    x: 100,
    y: 300,
    velocity: 0,
    isJumping: false,
    rotation: 0,
  })

  const obstaclesRef = useRef<Obstacle[]>([])
  const gameLoopRef = useRef<number>()
  const speedRef = useRef(5)
  const scoreRef = useRef(0)
  const lastObstacleTimeRef = useRef(0)

  // Константы игры
  const GRAVITY = 0.6
  const JUMP_FORCE = -12
  const GROUND_Y = 340
  const BASE_LOGO_SIZE = 40
  const MIN_OBSTACLE_GAP = 800

  const resetGame = useCallback(() => {
    playerRef.current = {
      x: 100,
      y: 300,
      velocity: 0,
      isJumping: false,
      rotation: 0,
    }
    obstaclesRef.current = []
    speedRef.current = 5
    scoreRef.current = 0
    lastObstacleTimeRef.current = 0
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isGameOver: false,
      score: 0,
    }))
  }, [resetGame])

  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isGameOver: true,
    }))
    
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current)
    }
    
    onGameOver?.(scoreRef.current)
  }, [onGameOver])

  const jump = useCallback(() => {
    if (!playerRef.current.isJumping && gameState.isPlaying) {
      playerRef.current.velocity = JUMP_FORCE
      playerRef.current.isJumping = true
    }
  }, [gameState.isPlaying])

  const spawnObstacle = useCallback(() => {
    const types: ('spike' | 'block' | 'platform')[] = ['spike', 'block', 'platform']
    const type = types[Math.floor(Math.random() * types.length)]
    
    const difficultyMultiplier = Math.min(scoreRef.current / 1000, 3)
    
    obstaclesRef.current.push({
      x: 800,
      y: type === 'spike' ? GROUND_Y - 40 : type === 'block' ? GROUND_Y - 60 : GROUND_Y - 180,
      width: type === 'spike' ? 30 : 40,
      height: type === 'spike' ? 40 : type === 'block' ? 60 : 20,
      type,
      passed: false,
    })
  }, [])

  const checkCollision = useCallback((player: PlayerState, obstacle: Obstacle): boolean => {
    const playerLeft = player.x + 5
    const playerRight = player.x + BASE_LOGO_SIZE - 5
    const playerTop = player.y + 5
    const playerBottom = player.y + BASE_LOGO_SIZE - 5

    const obsLeft = obstacle.x
    const obsRight = obstacle.x + obstacle.width
    const obsTop = obstacle.y
    const obsBottom = obstacle.y + obstacle.height

    return !(
      playerRight < obsLeft ||
      playerLeft > obsRight ||
      playerBottom < obsTop ||
      playerTop > obsBottom
    )
  }, [])

  const update = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    if (!gameState.isPlaying || gameState.isGameOver) return

    const player = playerRef.current
    const currentTime = Date.now()

    // Физика игрока
    player.velocity += GRAVITY
    player.y += player.velocity

    // Проверка земли
    if (player.y > GROUND_Y) {
      player.y = GROUND_Y
      player.velocity = 0
      player.isJumping = false
      // Выравнивание вращения
      player.rotation = Math.round(player.rotation / (Math.PI * 2)) * Math.PI * 2
    }

    // Вращение при прыжке
    if (player.isJumping) {
      player.rotation += 0.15
    }

    // Постепенное ускорение
    speedRef.current += 0.001

    // Генерация препятствий
    if (currentTime - lastObstacleTimeRef.current > MIN_OBSTACLE_GAP / speedRef.current * 16) {
      if (Math.random() < 0.3 + (scoreRef.current / 5000)) {
        spawnObstacle()
        lastObstacleTimeRef.current = currentTime
      }
    }

    // Обновление препятствий
    obstaclesRef.current.forEach((obs, index) => {
      obs.x -= speedRef.current

      // Проверка прохождения
      if (!obs.passed && obs.x + obs.width < player.x) {
        obs.passed = true
        scoreRef.current += 10
        setGameState(prev => ({ ...prev, score: scoreRef.current }))
        onScoreUpdate?.(scoreRef.current)
      }

      // Удаление за экраном
      if (obs.x + obs.width < 0) {
        obstaclesRef.current.splice(index, 1)
      }

      // Проверка коллизий
      if (checkCollision(player, obs)) {
        stopGame()
      }
    })

    // Отрисовка
    // Фон
    const gradient = ctx.createLinearGradient(0, 0, 0, 400)
    gradient.addColorStop(0, '#0052FF')
    gradient.addColorStop(1, '#0033AA')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Земля
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, GROUND_Y + 40, canvas.width, 20)

    // Игрок (BASE логотип)
    ctx.save()
    ctx.translate(player.x + BASE_LOGO_SIZE / 2, player.y + BASE_LOGO_SIZE / 2)
    ctx.rotate(player.rotation)

    // Круглый BASE логотип
    ctx.beginPath()
    ctx.arc(0, 0, BASE_LOGO_SIZE / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#0052FF'
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 3
    ctx.stroke()

    // Буква "B" в центре
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('B', 0, 2)

    ctx.restore()

    // Препятствия
    obstaclesRef.current.forEach(obs => {
      ctx.fillStyle = obs.type === 'spike' ? '#FF4444' : '#FFFFFF'
      if (obs.type === 'spike') {
        ctx.beginPath()
        ctx.moveTo(obs.x, obs.y + obs.height)
        ctx.lineTo(obs.x + obs.width / 2, obs.y)
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
      }
    })
  }, [gameState.isPlaying, gameState.isGameOver, spawnObstacle, checkCollision, stopGame, onScoreUpdate])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    
    if (!canvas || !ctx) return

    update(canvas, ctx)
    
    if (gameState.isPlaying && !gameState.isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
  }, [canvasRef, update, gameState.isPlaying, gameState.isGameOver])

  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState.isPlaying, gameState.isGameOver, gameLoop])

  useEffect(() => {
    if (gameState.isGameOver) {
      const savedHighScore = localStorage.getItem('base-dash-highscore')
      const currentHighScore = savedHighScore ? parseInt(savedHighScore) : 0
      
      if (gameState.score > currentHighScore) {
        localStorage.setItem('base-dash-highscore', gameState.score.toString())
        setGameState(prev => ({ ...prev, highScore: gameState.score }))
      } else {
        setGameState(prev => ({ ...prev, highScore: currentHighScore }))
      }
    }
  }, [gameState.isGameOver, gameState.score])

  useEffect(() => {
    const savedHighScore = localStorage.getItem('base-dash-highscore')
    if (savedHighScore) {
      setGameState(prev => ({ ...prev, highScore: parseInt(savedHighScore) }))
    }
  }, [])

  return {
    gameState,
    playerRef,
    obstaclesRef,
    startGame,
    stopGame,
    jump,
    resetGame,
    score: gameState.score,
    highScore: gameState.highScore,
    isPlaying: gameState.isPlaying,
    isGameOver: gameState.isGameOver,
  }
}
