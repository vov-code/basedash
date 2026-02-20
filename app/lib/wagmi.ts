'use client'

import { createConfig, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors'

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const connectors = [
  injected({ shimDisconnect: true }),
  metaMask(),
  coinbaseWallet({ appName: 'base dash' }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: 'base dash',
            description: 'base dash endless runner',
            url: 'https://basedash-five.vercel.app',
            icons: ['https://basedash-five.vercel.app/icons/icon-192.svg'],
          },
        }),
      ]
    : []),
]

export const config = createConfig({
  chains: [isTestnet ? baseSepolia : base],
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})
