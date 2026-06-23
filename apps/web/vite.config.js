import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

function copyStaticPages() {
  return {
    name: 'copy-static-pages',
    closeBundle() {
      copyFileSync(
        resolve(process.cwd(), 'public/sales-card.html'),
        resolve(process.cwd(), 'dist/sales-card.html')
      );
    },
  };
}

function readBuildHash() {
  try {
    const head = readFileSync(resolve(process.cwd(), '../../.git/HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = head.slice(5);
      const sha = readFileSync(resolve(process.cwd(), '../../.git', refPath), 'utf8').trim();
      return sha.slice(0, 7);
    }
    return head.slice(0, 7);
  } catch {
    return Date.now().toString(36);
  }
}
const buildHash = readBuildHash();

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      copyStaticPages(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: {
          name: 'Realwise',
          short_name: 'Realwise',
          start_url: '/loading',
          description: 'Controle financeiro pessoal simples e eficiente.',
          theme_color: '#f43f5e',
          background_color: '#f43f5e',
          display: 'standalone',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
    define: {
      __BUILD_HASH__: JSON.stringify(buildHash),
    },
    test: {
      environment: 'node',
      exclude: ['node_modules/**'],
    },
  }
})
