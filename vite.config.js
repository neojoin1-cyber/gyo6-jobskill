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
        // 새로 배포하면 곧바로 새 서비스워커가 넘겨받고 옛 캐시를 지운다.
        // 이게 없으면 앱을 켜 둔 학생은 옛 파일 이름을 계속 부르다 404 를 만난다.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // 앱 셸(index-*.js)에 문항 데이터가 함께 들어간다. 이 앱은 교실 와이파이가
        // 끊겨도 돌아가야 해서 오프라인 우선으로 설계했고, 그래서 셸이 무겁다.
        // 요점정리·훈화를 더하며 4.23MB 가 되어 4MB 한도를 넘어 빌드가 멈췄다.
        // 한도를 올린다 — 다만 여기 숫자가 계속 커지면 그건 셸을 쪼개라는 신호다.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // 앱 셸: JS/CSS/HTML 사전 캐시 (join.html은 랜딩 페이지라 캐시 제외)
          // 앱 셸만 사전 캐시한다. 교재·문항 청크까지 precache 하면
          // 설치·업데이트마다 17MB 이상을 내려받는다. 교실에서 30명이
          // 동시에 설치하면 한 와이파이로 수백 MB 가 몰려 수업이 날아간다.
          // 큰 청크는 아래 runtimeCaching 으로 '열 때 받고 그 뒤 캐시'.
          globPatterns: ['**/*.{css,html,ico,png,svg,woff2}', 'assets/index-*.js', 'registerSW.js'],
          globIgnores: ['join.html', 'assets/textbook-*.js', 'assets/*Screen-*.js', 'assets/jobCommonAreas-*.js', 'assets/block-inline-*.js'],
        // 런타임 캐시
          runtimeCaching: [
            {
              // 교재·화면 청크: 처음 열 때 받고 그 뒤로는 캐시에서 즉시.
              // 설치 용량을 줄이면서 오프라인 학습은 그대로 유지된다.
              urlPattern: /\/assets\/(textbook-|.*Screen-|jobCommonAreas-|block-inline-).*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gyo6-content',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
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
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist' },
})
