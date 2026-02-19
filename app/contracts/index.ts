import GameLeaderboardABI from './GameLeaderboardABI.json'

export const GAME_LEADERBOARD_ABI = GameLeaderboardABI
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export interface PlayerScore {
  player: string
  score: bigint
  timestamp: bigint
  streakDays: bigint
}
