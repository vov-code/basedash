/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  
  // Отключаем все предупреждения
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  images: {
    domains: ['localhost'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  
  webpack: (config) => {
    if (!config.resolve.fallback) config.resolve.fallback = {}
    config.resolve.fallback['@react-native-async-storage/async-storage'] = false
    config.resolve.fallback['pino-pretty'] = false
    
    // Отключаем source maps для чистоты
    config.devtool = false
    
    // Подавляем warnings
    config.ignoreWarnings = [
      { module: /node_modules/ },
      { message: /deprecated/ },
      { message: /Critical dependency/ },
    ]
    
    return config
  },
  
  // Подавляем логи
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = nextConfig
