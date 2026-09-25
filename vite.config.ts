import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Относительный base — чтобы собранные пути работали и локально,
  // и на GitHub Pages в подпапке (https://user.github.io/repo/), без привязки к имени репозитория.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
