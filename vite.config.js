import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_FIREBASE_PROJECT_ID

  return {
    server: {
      proxy: {
        '/api/payment/create': {
          target: `https://us-central1-${projectId}.cloudfunctions.net`,
          changeOrigin: true,
          rewrite: () => '/createPayment',
        },
        '/api/payment/process': {
          target: `https://us-central1-${projectId}.cloudfunctions.net`,
          changeOrigin: true,
          rewrite: () => '/processPayment',
        },
        '/api/payment/status': {
          target: `https://us-central1-${projectId}.cloudfunctions.net`,
          changeOrigin: true,
          rewrite: () => '/checkPaymentStatus',
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
        },
        manifest: {
          name: 'Blim Wallet',
          short_name: 'Blim Wallet',
          start_url: '/home',
          description: 'A personal finance tracker that helps you manage your income, expenses, and investments.',
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
