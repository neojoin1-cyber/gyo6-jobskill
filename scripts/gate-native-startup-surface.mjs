import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const app = read('src/App.jsx')
const activity = read('android/app/src/main/java/com/gyo6/jobskill/MainActivity.java')
const gradle = read('android/app/build.gradle')
const manifest = read('android/app/src/main/AndroidManifest.xml')
const failures = []

for (const token of ['Gyo6InAppUpdate', 'initPushNotifications', 'scheduleReviewReminder']) {
  if (app.includes(token)) failures.push(`앱 시작 경로에 ${token} 호출이 남아 있음`)
}
for (const token of ['Gyo6InAppUpdatePlugin', 'registerPlugin(']) {
  if (activity.includes(token)) failures.push(`MainActivity가 ${token}을 시작 시 등록함`)
}
for (const token of ['com.google.android.play:app-update', 'androidx.datastore:datastore-preferences']) {
  if (gradle.includes(token)) failures.push(`사용하지 않는 네이티브 시작 의존성 ${token}이 포함됨`)
}
if (!manifest.includes('android:allowBackup="false"')) failures.push('Android 앱 데이터 복원이 차단되지 않음')

if (failures.length) {
  failures.forEach(message => console.error(`[native-startup] FAIL: ${message}`))
  process.exit(1)
}

console.log('[native-startup] PASS - boot path has no Play Core, notification, or unused direct native dependency')
