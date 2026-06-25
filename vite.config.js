import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 개발 중에도 SW 등록 (테스트용)
      devOptions: { enabled: false },
      // dist/ 에 번들된 SW 생성
      workbox: {
        // JSON 데이터가 번들에 포함돼 5MB 이상 → 제한 상향
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // 앱 셸: JS/CSS/HTML 사전 캐시 (join.html은 랜딩 페이지라 캐시 제외)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['join.html'],
        // 런타임 캐시
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gyo6-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase API (네트워크 우선 → 캐시 폴백)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gyo6-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
        ],
        // 오프라인 폴백 페이지
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /\/join\.html$/],
      },
      // manifest는 public/manifest.json 사용 (직접 관리)
      manifest: false,
    }),
  ],
  base: process.env.GITHUB_ACTIONS ? '/gyo6-jobskill/' : '/',
  server: { port: 5173 },
  build: { outDir: 'dist' },
})
