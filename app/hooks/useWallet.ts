'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

/**
 * Simplified wallet hook for Base App.
 * Prefers Coinbase Smart Wallet (primary for Base ecosystem).
 */
export function useWallet() {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)

  // Prefer Coinbase wallet, then injected
  const orderedConnectors = useMemo(
    () =>
      [...connectors].sort((a, b) => {
        const score = (id: string) => {
          if (id.includes('coinbase')) return 0
          if (id.includes('injected')) return 1
          return 2
        }
        return score(a.id) - score(b.id)
      }),
    [connectors]
  )

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    try {
      if (orderedConnectors.length === 0) {
        throw new Error('No wallet connector available')
      }
      // Try connectors in priority order
      for (const connector of orderedConnectors) {
        try {
          await connectAsync({ connector })
          return
        } catch (err) {
          // Try next connector
          continue
        }
      }
      throw new Error('Wallet connection failed')
    } catch (err) {
      console.error('Failed to connect:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [connectAsync, orderedConnectors])

  return {
    address: address as `0x${string}` | undefined,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet: disconnect,
  }
}

