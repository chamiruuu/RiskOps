import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Check if Vercel is the one building the app
  const isVercel = process.env.VERCEL === '1';

  return {
    plugins: [react()],
    
    // If Vercel: use absolute paths ('/') so deep routing works.
    // If Electron/Local: use relative paths ('./') so the desktop app works.
    base: isVercel ? '/' : './',
  }
})