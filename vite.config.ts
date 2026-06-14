import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }))
  },
  server: {
    // Bind to port 80 on all interfaces so http://lunaeyehospital/ (hosts → 127.0.0.1)
    // resolves to the Vite dev server in development mode with hot-reload.
    host: '0.0.0.0',
    port: 80,
    strictPort: true,   // fail fast if 80 is already taken (e.g. packaged exe still running)
    allowedHosts: ['lunaeyehospital'],
    proxy: {
      // Forward all /api calls to the backend dev server (PORT=3200 in server/.env)
      '/api': {
        target: 'http://127.0.0.1:3200',
        changeOrigin: true,
      }
    }
  }
})
