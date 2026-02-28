import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    proxy: {
      '/api': 'http://localhost:3004',
      '/health': 'http://localhost:3004',
    },
  },
  build: {
    outDir: 'build', // keep 'build' for Docker compatibility
  },
  define: {
    // Ensure process.env.NODE_ENV is available for compatibility
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
})
