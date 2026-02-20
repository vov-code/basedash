const ROOT_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_APP_URL || 'https://basedash-five.vercel.app'

export const minikitConfig = {
  accountAssociation: {
    header: '',
    payload: '',
    signature: '',
  },
  miniapp: {
    version: '1',
    name: 'base dash',
    subtitle: 'endless runner on base',
    description: 'endless runner game on base blockchain. daily check-ins, on-chain leaderboard.',
    screenshotUrls: [
      `${ROOT_URL}/screenshots/screenshot-1.svg`,
      `${ROOT_URL}/screenshots/screenshot-2.svg`,
      `${ROOT_URL}/screenshots/screenshot-3.svg`,
    ],
    iconUrl: `${ROOT_URL}/icons/icon-192.svg`,
    splashImageUrl: `${ROOT_URL}/splash.svg`,
    splashBackgroundColor: '#0052FF',
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: 'games',
    tags: ['game', 'runner', 'base', 'crypto', 'leaderboard', 'arcade', 'endless'],
    heroImageUrl: `${ROOT_URL}/hero.svg`,
    tagline: 'jump. dash. conquer.',
    ogTitle: 'base dash - endless runner',
    ogDescription: 'endless runner game on base blockchain. daily check-ins, on-chain leaderboard.',
    ogImageUrl: `${ROOT_URL}/og-image.svg`,
  },
} as const
