import { Abi } from 'viem'
import GameLeaderboardArtifact from './GameLeaderboardABI.json'

// Extract only the ABI array from the artifact
export const GAME_LEADERBOARD_ABI = (GameLeaderboardArtifact.abi || GameLeaderboardArtifact) as Abi

// Environment-specific contract addresses
export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET ||
  '0x0000000000000000000000000000000000000000'
) as `0x${string}`

// Testnet address (optional, for development)
export const CONTRACT_ADDRESS_TESTNET = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET ||
  '0x0000000000000000000000000000000000000000'
) as `0x${string}`

// Get the appropriate contract address based on network
export const getContractAddress = (isTestnet?: boolean): `0x${string}` => {
  if (isTestnet === undefined) {
    isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
  }
  return isTestnet ? CONTRACT_ADDRESS_TESTNET : CONTRACT_ADDRESS
}

export interface PlayerScore {
  player: string
  score: bigint
  timestamp: bigint
  streakDays: bigint
}
