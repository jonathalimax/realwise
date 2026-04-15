import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: {
          name: 'Moneywise',
          short_name: 'Moneywise',
          start_url: '/app/dashboard',
          description: 'Controle financeiro pessoal simples e eficiente.',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor-react';
            if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@landing': path.resolve(__dirname, './landing_page'),
      },
    },
    test: {
      environment: 'node',
      exclude: ['functions/**', 'node_modules/**'],
    },
  }
})
