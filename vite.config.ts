import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => {
  const base = '/'
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'Glossy',
          short_name: 'Glossy',
          description: 'Look up words, translate naturally, remember forever.',
          theme_color: '#BA7517',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          clientsClaim: true,
          navigateFallback: `${base}index.html`,
          runtimeCaching: [
            {
              // LLM proxy calls — never cache, always go to network
              urlPattern: ({ url }) => url.hostname.includes('workers.dev'),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
  }
})
