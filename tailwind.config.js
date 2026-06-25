/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0b0e',
        surface: '#111318',
        card: '#161a21',
        border: '#1e2330',
        muted: '#8892a4',
        accent: '#22c55e',
      },
    },
  },
  plugins: [],
}

