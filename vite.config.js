import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8788'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api')) {
            // Strip or keep the prefix depending on target server expectations
            const targetUrl = new URL(req.url, apiTarget).toString()
            
            res.writeHead(307, { Location: targetUrl })
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 5173,
    open: false,
  },
})