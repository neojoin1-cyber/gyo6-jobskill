import { existsSync, readFileSync } from 'node:fs'

const androidMode = process.argv.includes('--android')
const outputRoot = androidMode ? 'android/app/src/main/assets/public' : 'dist'
const fail = message => {
  console.error(`[native-runtime] FAIL: ${message}`)
  process.exitCode = 1
}

const index = readFileSync(`${outputRoot}/index.html`, 'utf8')
const mainActivity = readFileSync('android/app/src/main/java/com/gyo6/jobskill/MainActivity.java', 'utf8')
const main = readFileSync('src/main.jsx', 'utf8')

if (existsSync(`${outputRoot}/sw.js`) || existsSync(`${outputRoot}/registerSW.js`)) {
  fail('Capacitor build contains a PWA service worker')
}
if (/registerSW\.js|navigator\.serviceWorker\.register/.test(index)) {
  fail('Capacitor index still registers a service worker')
}
if (!index.includes('id="boot-guard"') || !index.includes('data-boot-recover')) {
  fail('static pre-React recovery screen is missing')
}
if (!main.includes('__SUGAR_SALT_NATIVE_READY__') || !main.includes('__SUGAR_SALT_BOOT_READY__')) {
  fail('React paint does not release the native/static boot guard')
}
if (!mainActivity.includes('recoverPackagedWebRuntime') ||
    !mainActivity.includes('purgeLegacyWorkerStorage') ||
    !mainActivity.includes('app_webview/Default/Service Worker') ||
    !mainActivity.includes('OnBackPressedCallback') ||
    !mainActivity.includes('__SUGAR_SALT_NATIVE_READY__') ||
    !mainActivity.includes('showBootFailure')) {
  fail('native update recovery or boot timeout UI is missing')
}

if (!process.exitCode) {
  console.log(`[native-runtime] PASS - no PWA worker, static recovery, native boot watchdog${androidMode ? ', synced assets' : ''}`)
}
