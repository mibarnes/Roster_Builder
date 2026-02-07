/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'miami-green': '#1a4d2e',
        surface: '#0a0a0a',
        'surface-border': '#1a1a1a',
        'card-bg': '#000000',
        'rs-purple': '#7c3aed',
        'portal-orange': '#f97316'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
