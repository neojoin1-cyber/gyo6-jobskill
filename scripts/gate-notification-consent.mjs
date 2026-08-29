import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const app = read('src/App.jsx')
const push = read('src/lib/pushNotifications.js')
const reminders = read('src/lib/reminders.js')
const account = read('src/screens/student/AccountDataScreen.jsx')
const failures = []

if (app.includes('initPushNotifications') || app.includes('scheduleReviewReminder')) {
  failures.push('로그인·앱 시작 경로에서 알림 플러그인을 초기화함')
}
if (!push.includes('if (receive !== \'granted\' && requestPermission)')) {
  failures.push('푸시 알림 권한이 사용자 요청 없이 열릴 수 있음')
}
if (!reminders.includes('if (display !== \'granted\' && requestPermission)')) {
  failures.push('로컬 알림 권한이 사용자 요청 없이 열릴 수 있음')
}
if (!account.includes('requestPushNotifications(profile?.id)')) {
  failures.push('학생이 직접 알림을 켤 수 있는 진입점이 없음')
}

if (failures.length) {
  failures.forEach(message => console.error(`[notification-consent] FAIL: ${message}`))
  process.exit(1)
}

console.log('[notification-consent] PASS - app boot is notification-plugin-free and consent is user initiated')
