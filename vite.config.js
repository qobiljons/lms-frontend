import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function bypassForHtml(req) {
  if (
    req.headers.accept &&
    req.headers.accept.includes('text/html')
  ) {

    return '/index.html'
  }
}

export default defineConfig({
  plugins: [react()],
  cacheDir: '/tmp/vite_cache',
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/courses': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/lessons': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/groups': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/payments': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/attendance': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/messages': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/homework': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: bypassForHtml,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
