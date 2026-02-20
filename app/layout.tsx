import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
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

const brandFont = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-brand',
  weight: ['500', '600', '700'],
})

const getMetadataBase = (): URL => {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) {
    return new URL('https://basedash-five.vercel.app')
  }

  const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
  try {
    return new URL(normalized)
  } catch {
    return new URL('https://basedash-five.vercel.app')
  }
}

const metadataBase = getMetadataBase()

// ============================================
// VIEWPORT CONFIGURATION — Оптимизировано для мобильных
// ============================================

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0052FF',
  colorScheme: 'light',
  viewportFit: 'cover',
}

// ============================================
// METADATA CONFIGURATION
// ============================================

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: 'Base Dash — Endless Runner on Base',
    template: '%s | Base Dash',
  },
  description: 'Jump candles, send it to chain. Built on Base.',
  keywords: [
    'base',
    'game',
    'crypto',
    'trading',
    'blockchain',
    'web3',
    'runner',
    'dash',
    'endless runner',
    'base network',
  ],
  authors: [{ name: 'Base Dash Team' }],
  creator: 'Base Dash',
  publisher: 'Base Dash',
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
    title: 'Base Dash',
    description: 'Jump candles, send it to chain.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Base Dash',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Base Dash Game',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Base Dash',
    description: 'Jump candles, send it to chain.',
    images: ['/og-image.svg'],
    creator: '@base',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Base Dash',
  },
  // Farcaster Frame meta tags (Improvement #9)
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${metadataBase.toString()}og-image.svg`,
    'fc:frame:button:1': 'Play Base Dash 🏃‍♂️',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': metadataBase.toString(),
    'fc:frame:post_url': metadataBase.toString(),
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${brandFont.variable}`}
    >
      <body className="font-sans antialiased bg-white text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
