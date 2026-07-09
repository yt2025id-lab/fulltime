import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const footKey = env.VITE_FOOTBALL_API_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env': {},
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer/',
      },
    },
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
              proxyReq.setHeader('X-Auth-Token', footKey);
            });
          },
        },
      },
    },
  };
})
