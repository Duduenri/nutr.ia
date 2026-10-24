/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#24324a',
        mint: { 50: '#eef8f6', 100: '#d9eeea', 400: '#5cc3a8', 500: '#2fb38f' },
        peach: { 100: '#fde1d6', 400: '#f6a07c', 500: '#e8693a' },
        sun: '#ffd85e',
        sky: '#a8d8f5',
        soft: '#f4f6fa',
      },
      boxShadow: {
        card: '0 2px 12px rgba(36, 50, 74, 0.06)',
      },
    },
  },
  plugins: [],
}
