import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Base path for GitHub Pages deployment - update this with your new repo name
  base: '/fee-app/', // Using the repository name for GitHub Pages
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
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
