import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is environment-driven so the SAME build works for:
//   - local dev / Netlify / root-domain hosting → VITE_BASE unset → '/'
//   - GitHub Pages project site                  → VITE_BASE='/Roster_Builder/'
// (The original build hardcoded '/Roster_Builder/', which silently broke local + Netlify.)
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
})
