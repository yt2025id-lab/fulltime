import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/txline': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/txline', ''),
      },
      '/api/football': {
        target: 'https://api.football-data.org/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/football/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Auth-Token', process.env.VITE_FOOTBALL_API_KEY || '');
          });
        },
      },
    },
  },
})
