'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { type ReactNode } from 'react'
import { config } from '@/app/lib/wagmi'

/**
 * App Providers — follows official Base documentation pattern:
 * https://docs.base.org/get-started/build-app
 *
 * Base docs use:
 *   WagmiProvider → QueryClientProvider → {children}
 *
 * OnchainKitProvider removed — the Base docs don't require it.
 * All wallet UI and connection is handled via wagmi hooks directly.
 * The `baseAccount` connector (configured in wagmi.ts) provides
 * the Coinbase Smart Wallet experience natively.
 */

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
