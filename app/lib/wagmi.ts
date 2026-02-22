'use client'

import { createConfig, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'

/**
 * Base App standard: Coinbase Smart Wallet is the primary connector.
 * Injected (browser wallet) kept as fallback.
 * MetaMask & WalletConnect removed — Base App = Coinbase ecosystem.
 */
const connectors = [
  coinbaseWallet({
    appName: 'base dash',
    appLogoUrl: 'https://basedash-five.vercel.app/base-logo.png',
    preference: 'smartWalletOnly',
  }),
  injected({ shimDisconnect: true }),
]

export const config = createConfig({
  chains: [isTestnet ? baseSepolia : base],
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

