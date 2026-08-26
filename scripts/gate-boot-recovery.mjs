import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const index = read('index.html')
const main = read('src/main.jsx')
const activity = read('android/app/src/main/java/com/gyo6/jobskill/MainActivity.java')
const vite = read('vite.config.js')
const pkg = JSON.parse(read('package.json'))
const failures = []

const requireText = (source, token, message) => {
  if (!source.includes(token)) failures.push(message)
}

requireText(index, 'id="boot-guard"', 'React 이전 정적 부팅 화면이 없음')
requireText(index, 'data-boot-recover', '웹 최신 화면 복구 버튼이 없음')
requireText(index, "window.setTimeout(showRecovery, 10000)", '웹 부팅 타임아웃이 없음')
requireText(main, '__SUGAR_SALT_NATIVE_READY__', 'React 렌더 완료 신호가 없음')
requireText(main, '__SUGAR_SALT_BOOT_READY__', '정적 부팅 화면 해제 신호가 없음')
requireText(vite, "disable: mode === 'native'", '네이티브 빌드에서 PWA 서비스워커가 차단되지 않음')
requireText(activity, 'purgeLegacyWorkerStorage()', '업데이트 전 서비스워커 저장소 정리가 없음')
requireText(activity, 'app_webview/Default/Service Worker', '서비스워커 저장소만 선별 정리하지 않음')
requireText(activity, 'OnBackPressedCallback', '부팅 실패 중 시스템 뒤로가기 복구가 없음')
requireText(activity, 'showBootFailure', '네이티브 부팅 실패 화면이 없음')

const purgeAt = activity.indexOf('purgeLegacyWorkerStorage();')
const bridgeAt = activity.indexOf('super.onCreate(savedInstanceState);')
if (purgeAt < 0 || bridgeAt < 0 || purgeAt > bridgeAt) {
  failures.push('서비스워커 저장소가 WebView 생성 전에 정리되지 않음')
}
if (!String(pkg.scripts?.['build:native']).includes('gate-native-runtime.mjs') ||
    !String(pkg.scripts?.['android:sync']).includes('gate-native-runtime.mjs --android')) {
  failures.push('네이티브 빌드·동기화 산출물 게이트가 연결되지 않음')
}

if (failures.length) {
  failures.forEach(message => console.error(`[boot-recovery] FAIL: ${message}`))
  process.exit(1)
}

console.log('[boot-recovery] PASS - web static fallback, native pre-WebView cleanup, timeout UI, back recovery')
