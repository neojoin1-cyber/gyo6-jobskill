import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const account = read('src/screens/student/AccountDataScreen.jsx')
const shell = read('src/screens/student/StudentShell.jsx')
const preview = read('src/screens/DesignPreview.jsx')
const migration = read('supabase/migrations/20260829123000_cover_letter_evidence_service_access.sql')
const failures = []

for (const token of [
  'iv_personalized_example_context',
  'hifiveDepartmentOptions',
  '취업 준비 기본정보',
  '작성근거 관리',
  "from('cover_letter_evidence')",
]) {
  if (!account.includes(token)) failures.push(`나 화면의 취업 준비 정보에 ${token} 연결이 없음`)
}
if (!shell.includes("mode: 'cover-practical'")) failures.push('나 화면에서 실전자기소개서 근거 관리로 이동하지 못함')
if (!preview.includes("mode === 'student-account'") || !preview.includes('onMe')) failures.push('학생 웹 미리보기에서 나 화면을 검증할 수 없음')
if (!migration.includes('TO service_role')) failures.push('근거은행 운영 자동검증 권한이 없음')
if (account.includes('pushNotifications') || account.includes('getPushPermissionStatus')) failures.push('나 화면 진입이 네이티브 알림 모듈을 호출함')

if (failures.length) {
  failures.forEach(message => console.error(`[account-career] FAIL: ${message}`))
  process.exit(1)
}

console.log('[account-career] PASS - safe account entry, shared career context, evidence management, service verification')
