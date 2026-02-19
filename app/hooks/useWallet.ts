'use client'

import { useState, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { coinbaseWallet } from 'wagmi/connectors'

export function useWallet() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    try {
      await connect({ connector: coinbaseWallet() })
    } catch (err) {
      console.error('Failed to connect:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [connect])

  return {
    address: address as `0x${string}` | undefined,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet: disconnect,
  }
}
