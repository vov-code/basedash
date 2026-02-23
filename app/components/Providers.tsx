'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { base, baseSepolia } from 'wagmi/chains'
import { config } from '@/app/lib/wagmi'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const chain = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? baseSepolia : base

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={chain}
          projectId={process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID}
          config={{
            wallet: {
              display: 'modal',
              termsUrl: 'https://www.coinbase.com/legal/cookie',
              privacyUrl: 'https://www.coinbase.com/legal/privacy',
            },
            appearance: {
              name: 'Base Dash',
              mode: 'light',
            }
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
