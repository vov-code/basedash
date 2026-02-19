/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  webpack: (config) => {
    if (!config.resolve.fallback) config.resolve.fallback = {}
    config.resolve.fallback['@react-native-async-storage/async-storage'] = false
    config.resolve.fallback['pino-pretty'] = false
    return config
  },
}

module.exports = nextConfig
