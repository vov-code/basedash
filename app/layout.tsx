import type { Metadata, Viewport } from 'next'
import { Outfit, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './styles/globals.css'
import { Providers } from './components/Providers'

// ============================================
// FONT CONFIGURATION — Premium trio
// ============================================

/** Outfit: clean geometric, premium body font */
const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

/** Space Grotesk: techy & distinctive for headings, HUD labels */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  variable: '--font-space',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['monospace'],
  variable: '--font-mono',
  weight: ['300', '400', '500', '600', '700'],
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
    default: 'base dash - endless runner on Base',
    template: '%s | Base Dash',
  },
  description: 'jump candles, send it to chain. built on Base.',
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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'base dash — endless runner on base',
        type: 'image/png',
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
  // Farcaster Frame v2 metadata
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${metadataBase.toString()}og-image.png`,
    'fc:frame:image:aspect_ratio': '1.91:1',
    'fc:frame:button:1': 'Play Base Dash 🏃‍♂️',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': metadataBase.toString(),
    'fc:frame:button:2': 'View Leaderboard 🏆',
    'fc:frame:button:2:action': 'link',
    'fc:frame:button:2:target': `${metadataBase.toString()}?tab=leaderboard`,
    'fc:frame:post_url': `${metadataBase.toString()}api/webhook`,
    'fc:frame:input:text': 'Enter your score...',
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
      className={`${outfit.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="stylesheet" href="/onchainkit.css" />
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/_next/static/media/inter-var-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/_next/static/media/jetbrains-mono-var-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Preload critical images */}
        <link
          rel="preload"
          as="image"
          href="/base-logo.png"
        />
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="https://mainnet.base.org" />
        <link rel="dns-prefetch" href="https://sepolia.base.org" />
        <link rel="dns-prefetch" href="https://vercel.com" />
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://mainnet.base.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://sepolia.base.org" crossOrigin="anonymous" />
      </head>
      <body className="font-outfit antialiased bg-white text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
