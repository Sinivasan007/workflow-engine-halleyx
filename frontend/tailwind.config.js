/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        moonlight: {
          bg: '#080812',
          sidebar: '#0D0D1A',
          card: '#FFFFFF',
          hover: '#F8F7FF',
          elevated: '#F3F0FF',
          border: '#E5E7EB',
          dark: '#1E1E35',
          accent: '#7C3AED',
          'accent-light': '#8B5CF6',
        }
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(124,58,237,0.12)',
        'glow': '0 0 30px rgba(124,58,237,0.15)',
        'input': '0 0 0 3px rgba(124,58,237,0.08)',
      }
    },
  },
  plugins: [],
}
