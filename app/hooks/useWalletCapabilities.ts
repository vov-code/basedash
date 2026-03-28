'use client'

import { useCapabilities } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { useMemo } from 'react'

/**
 * Wallet capabilities detection — follows official Base documentation:
 * https://docs.base.org/get-started/build-app
 *
 * Detects:
 * - Batch transaction support (EIP-5792 atomic calls)
 * - Paymaster support (gas sponsorship)
 */

const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
const activeChainId = isTestnet ? baseSepolia.id : base.id

export function useWalletCapabilities() {
    const { data: capabilities } = useCapabilities()

    const supportsBatching = useMemo(() => {
        const atomic = capabilities?.[activeChainId]?.atomic
        return atomic?.status === 'ready' || atomic?.status === 'supported'
    }, [capabilities])

    const supportsPaymaster = useMemo(() => {
        return capabilities?.[activeChainId]?.paymasterService?.supported === true
    }, [capabilities])

    return { supportsBatching, supportsPaymaster }
}
