import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The commit a build came from, shown at the foot of Settings. An installed PWA keeps running
// the old build until its service worker updates, so this is how a phone shows which one it has.
function buildId(): string {
  const sha = process.env.CF_PAGES_COMMIT_SHA // set in Cloudflare Pages builds
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig(() => {
  const base = '/'
  return {
    base,
    define: {
      __BUILD_ID__: JSON.stringify(buildId()),
    },
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
