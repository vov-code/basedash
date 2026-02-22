const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Production lint skip
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: ['localhost'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  // Code splitting optimization
  experimental: {
    optimizePackageImports: ['wagmi', 'viem', '@tanstack/react-query', '@coinbase/onchainkit'],
    // Tree shaking improvements - disabled due to critters dependency issue
    // optimizeCss: true,
  },

  webpack: (config, { isServer }) => {
    if (!config.resolve.fallback) config.resolve.fallback = {}
    config.resolve.fallback['@react-native-async-storage/async-storage'] = false
    config.resolve.fallback['pino-pretty'] = false

    // Disable source maps in production only
    if (!isServer && process.env.NODE_ENV === 'production') {
      config.devtool = false
    }

    // Tree shaking for lodash
    if (!isServer) {
      config.optimization.sideEffects = true
    }

    return config
  },

  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = withBundleAnalyzer(nextConfig)
