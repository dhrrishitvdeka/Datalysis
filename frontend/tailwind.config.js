/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amoled: {
          950: '#000000',
          900: '#09090B',
          850: '#101014',
          800: '#18181B',
          700: '#27272A',
          600: '#3F3F46',
          500: '#52525B',
          400: '#71717A',
          300: '#A1A1AA',
          200: '#D4D4D8',
          100: '#F4F4F5',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
