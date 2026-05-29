import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works both locally and on GitHub Pages
// (served from /Stardust_memes/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
})
