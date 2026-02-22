import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
        space: ['var(--font-space)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        sans: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        base: {
          blue: '#0052FF',
          'blue-hover': '#0040CC',
          'blue-active': '#0033AA',
          'blue-light': '#3378FF',
          'blue-pale': '#E8F0FE',
          'blue-ultra-light': '#F5F8FF',
          dark: '#0A0B14',
          white: '#FFFFFF',
        },
        bull: {
          green: '#0ECB81',
          light: '#14E89A',
          dark: '#0A9F68',
        },
        bear: {
          red: '#F6465D',
          light: '#FF5A72',
          dark: '#D63048',
        },
        gold: '#F0B90B',
        gray: {
          0: '#FFFFFF',
          50: '#F8F9FC',
          100: '#F0F2F8',
          200: '#E0E4F0',
          300: '#C8CDE0',
          400: '#A0A8C0',
          500: '#7882A0',
          600: '#5A6480',
          700: '#3D4660',
          800: '#283048',
          900: '#1A2030',
          950: '#0D121C',
        },
      },
      borderRadius: {
        none: '0',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '36px',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(26, 32, 48, 0.04)',
        sm: '0 2px 8px rgba(26, 32, 48, 0.06)',
        md: '0 4px 16px rgba(26, 32, 48, 0.08)',
        lg: '0 8px 32px rgba(26, 32, 48, 0.1)',
        xl: '0 16px 64px rgba(26, 32, 48, 0.12)',
        '2xl': '0 24px 96px rgba(26, 32, 48, 0.16)',
        blue: '0 4px 24px rgba(0, 82, 255, 0.15)',
        'blue-lg': '0 8px 48px rgba(0, 82, 255, 0.25)',
        'blue-glow': '0 0 40px rgba(0, 82, 255, 0.3)',
        green: '0 4px 24px rgba(14, 203, 129, 0.2)',
        red: '0 4px 24px rgba(246, 70, 93, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'fade-in-up': 'fadeInUp 400ms ease-out',
        'scale-in': 'scaleIn 300ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        rain: 'rain 5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(24px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        scaleIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.94)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        slideInRight: {
          '0%': {
            opacity: '0',
            transform: 'translateX(16px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(0, 82, 255, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 40px rgba(0, 82, 255, 0.4)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '1' }],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        in: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        out: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        'in-out': 'cubic-bezier(0.645, 0.045, 0.355, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
        bounce: '600ms',
      },
      screens: {
        '2xs': '320px',
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}

export default config
