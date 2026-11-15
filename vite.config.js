// Build multi-pagină: hub-ul (index.html) + fiecare games/<joc>/index.html găsit automat.
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const input = { main: resolve(root, 'index.html') };
for (const g of readdirSync(resolve(root, 'games'))) {
  const page = resolve(root, 'games', g, 'index.html');
  if (existsSync(page)) input[g] = page;
}

// vite-plugin-pwa pune căi „./” și în paginile din subfoldere: corectăm manifestul după adâncime
// și scoatem registerSW (rezolvă sw.js față de pagină; îl înregistrează hub-ul, scope-ul acoperă tot).
const fixNestedPwaPaths = {
  name: 'fix-nested-pwa-paths',
  enforce: 'post',
  generateBundle(_, bundle) {
    for (const f of Object.values(bundle)) {
      const depth = f.fileName.split('/').length - 1;
      if (!f.fileName.endsWith('.html') || depth === 0) continue;
      const up = '../'.repeat(depth);
      f.source = String(f.source)
        .replace(/<script[^>]*registerSW\.js[^>]*><\/script>/g, '')
        .replace(/(["'])\.\/manifest\.webmanifest/g, `$1${up}manifest.webmanifest`);
    }
  },
};

export default defineConfig({
  base: './', // merge și pe GitHub Pages (subfolder), și pe NAS (rădăcină)
  build: {
    target: ['es2020', 'safari15'], // iPhone SE 1 / iPad 5
    rolldownOptions: { input },
  },
  // changeOrigin: false păstrează Host-ul paginii, ca verificarea Origin (CSRF) a serverului să treacă local.
  server: { proxy: {
    '/api': { target: 'http://localhost:8787', changeOrigin: false },
    '/ws': { target: 'ws://localhost:8787', ws: true, changeOrigin: false },
    '/login': { target: 'http://localhost:8787', changeOrigin: false },
  } },
  plugins: [
    fixNestedPwaPaths,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Jocuri Familie',
        short_name: 'Jocuri',
        description: 'Bobo, Bum-Bum Arena, Turbo Curse și Orășelul',
        lang: 'ro',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#1b1530',
        theme_color: '#5a2ba0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,json,mp3,ogg,glb,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/login/], // /login vine mereu de la server (sesiune)
      },
    }),
  ],
});
