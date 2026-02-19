'use client'

import { createConfig, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'

export const config = createConfig({
  chains: [isTestnet ? baseSepolia : base],
  connectors: [coinbaseWallet({ appName: 'base dash' })],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})
