import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Android keeps installed splash icons separately from the service-worker cache.
// Change their URLs when the artwork changes so the manifest advertises an update.
const iconAssets = [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
].map((icon) => {
  const source = readFileSync(new URL(`./public/${icon.src}`, import.meta.url));
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const fileName = icon.src.replace('.png', `-${hash}.png`);
  return { source, fileName, manifest: { ...icon, src: fileName } };
});

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [
    {
      name: 'versioned-pwa-icons',
      apply: 'build',
      generateBundle() {
        for (const { fileName, source } of iconAssets) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      },
    },
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
        icons: iconAssets.map(({ manifest }) => manifest),
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
