import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'deyam',
        short_name: 'deyam',
        description: 'A little place, just for you. Your days, your words, and your tiny ghost. Saved on your device.',
        theme_color: '#080b14',
        background_color: '#080b14',
        display: 'standalone',
        start_url: './',
        scope: './',
        lang: 'en',
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        // Public assets such as moon.jpg need revisions; only Vite's hashed
        // bundles may skip cache-busting. Avoid adding the moon twice with
        // different revisions, which would abort Workbox's precache setup.
        dontCacheBustURLsMatching: /-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?)$/,
        globPatterns: ['**/*.{js,css,html,png,svg,jpg,woff,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
