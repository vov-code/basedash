import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { baseAccount, injected } from 'wagmi/connectors'

/**
 * Wagmi configuration — follows official Base documentation pattern:
 * https://docs.base.org/get-started/build-app
 *
 * Key patterns from the docs:
 * 1. `baseAccount` connector from @base-org/account — replaces coinbaseWallet
 * 2. `injected` as fallback for browser extension wallets
 * 3. `cookieStorage` for SSR hydration (prevents flash)
 * 4. `ssr: true` for Next.js SSR compatibility
 * 5. Explicit RPC URLs in transports
 * 6. Typed config via `declare module 'wagmi'`
 */

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const activeChain = isTestnet ? baseSepolia : base

export const config = createConfig({
  chains: [activeChain],
  connectors: [
    baseAccount({
      appName: 'Base Dash',
    }),
    injected(),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Typed config registration for type safety across the app
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
