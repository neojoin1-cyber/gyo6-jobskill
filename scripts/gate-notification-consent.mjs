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
if (account.includes('pushNotifications') || account.includes('getPushPermissionStatus') || account.includes('requestPushNotifications')) {
  failures.push('학생 나 화면 진입 시 네이티브 알림 모듈을 불러올 수 있음')
}
if (!account.includes('기기 알림은 안정화 뒤 다시 제공함')) {
  failures.push('기기 알림 임시 중단 상태를 학생에게 설명하지 않음')
}

if (failures.length) {
  failures.forEach(message => console.error(`[notification-consent] FAIL: ${message}`))
  process.exit(1)
}

console.log('[notification-consent] PASS - app boot and account entry are notification-plugin-free')
