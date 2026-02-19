import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: { blue: '#0052FF', dark: '#0033AA', light: '#3378FF' },
        bull: { green: '#0ECB81', light: '#14E89A' },
        bear: { red: '#F6465D', light: '#FF5A72' },
        gold: '#F0B90B',
      },
      borderRadius: {
        sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '28px',
      },
      boxShadow: {
        glow: '0 0 40px rgba(0, 82, 255, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
        'fade-in-up': 'fadeInUp 500ms ease-out',
        float: 'float 4s ease-in-out infinite',
        glow: 'glow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        glow: { '0%,100%': { filter: 'drop-shadow(0 0 8px rgba(0,82,255,0.4))' }, '50%': { filter: 'drop-shadow(0 0 20px rgba(0,82,255,0.6))' } },
      },
    },
  },
  plugins: [],
}

export default config
