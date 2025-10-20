import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Detect if we're in a Netlify environment
const isNetlify = !!process.env.NETLIFY;

export default defineConfig({
  // Use root path for Netlify, /fee-app/ for GitHub Pages
  base: isNetlify ? '/' : '/fee-app/',
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    proxy: {
      '/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(
          /^\/gas/,
          '/macros/s/AKfycbyWCzApXWxr5gr5DTYyDN8QDheGKCGbtZ-XxILuJxmeWITiK0vhGVLX1RYhUcFNTQlC/exec'
        ),
      },
    },
  },
})