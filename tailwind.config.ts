import type { Config } from 'tailwindcss'

// Theme ported from the recovered build's tailwind.config.js.
// NOTE: per-team accent colors are applied at runtime via the --team-accent CSS var
// (set from teamRegistry.ts), not declared here.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'miami-green': '#1a4d2e',
        surface: '#0a0a0a',
        'surface-border': '#1a1a1a',
        'card-bg': '#000000',
        'rs-purple': '#7c3aed',
        'portal-orange': '#f97316',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
