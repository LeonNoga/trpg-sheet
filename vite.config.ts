import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }
const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __GIT_HASH__: JSON.stringify(gitHash),
  },
  // Относительный base — чтобы собранные пути работали и локально,
  // и на GitHub Pages в подпапке (https://user.github.io/repo/), без привязки к имени репозитория.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Файлы OCR (≈10 МБ) не кладём в предзагрузку: они кэшируются при первом использовании распознавания.
        globIgnores: ['**/ocr/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-assets', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Карточка персонажа НРИ',
        short_name: 'Карточка НРИ',
        description: 'Карточка персонажа для самодельной настольной ролевой системы',
        theme_color: '#b5482f',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
