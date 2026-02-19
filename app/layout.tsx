import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './styles/globals.css'
import { Providers } from './components/Providers'

// ============================================
// FONT CONFIGURATION
// ============================================

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['monospace'],
  variable: '--font-mono',
  weight: ['300', '400', '500', '600', '700'],
})

// ============================================
// VIEWPORT CONFIGURATION
// ============================================

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0052FF',
  colorScheme: 'dark',
}

// ============================================
// METADATA CONFIGURATION
// ============================================

export const metadata: Metadata = {
  title: {
    default: 'base dash | built on base',
    template: '%s | base dash',
  },
  description: 'jump candles, send it to chain. built on base.',
  keywords: [
    'base',
    'game',
    'crypto',
    'trading',
    'blockchain',
    'web3',
    'runner',
    'dash',
  ],
  authors: [{ name: 'base dash team' }],
  creator: 'base dash',
  publisher: 'base dash',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'base dash',
    description: 'jump candles, send it to chain.',
    type: 'website',
    locale: 'en_US',
    siteName: 'base dash',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'base dash game',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'base dash',
    description: 'jump candles, send it to chain.',
    images: ['/og-image.png'],
    creator: '@base',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'base dash',
  },
}

// ============================================
// ROOT LAYOUT COMPONENT
// ============================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className="font-sans antialiased bg-[#0a0b14] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
