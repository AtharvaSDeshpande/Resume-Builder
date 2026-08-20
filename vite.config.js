import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // Forward agent API calls to the Express backend during development.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
