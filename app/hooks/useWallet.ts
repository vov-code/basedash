'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function useWallet() {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)

  const preferredConnectors = useMemo(
    () =>
      [...connectors].sort((a, b) => {
        const score = (id: string) => {
          if (id.includes('injected')) return 0
          if (id.includes('meta')) return 1
          if (id.includes('wallet')) return 2
          if (id.includes('coinbase')) return 3
          return 4
        }
        return score(a.id) - score(b.id)
      }),
    [connectors]
  )

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    let lastError: unknown = null
    try {
      if (preferredConnectors.length === 0) {
        throw new Error('No wallet connector available')
      }

      for (const connector of preferredConnectors) {
        try {
          await connectAsync({ connector })
          return
        } catch (err) {
          lastError = err
        }
      }

      throw lastError ?? new Error('Wallet connection failed')
    } catch (err) {
      console.error('Failed to connect:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [connectAsync, preferredConnectors])

  return {
    address: address as `0x${string}` | undefined,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet: disconnect,
  }
}
