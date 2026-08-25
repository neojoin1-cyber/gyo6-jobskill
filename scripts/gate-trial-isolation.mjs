import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const fail = message => {
  console.error(`[웹 체험 격리] 실패 - ${message}`)
  process.exitCode = 1
}

const supabaseSource = read('src/lib/supabase.js')
const trialSource = read('src/lib/trialSession.js')
const loginSource = read('src/screens/LoginScreen.jsx')
const appSource = read('src/App.jsx')
const serverGuard = read('supabase/migrations/20260825150000_public_trial_read_only.sql')
if (!supabaseSource.includes('storage: window.sessionStorage')) {
  fail('웹 인증 저장소가 탭별 sessionStorage가 아님')
}
if (!supabaseSource.includes('storageKey: `sugar-salt-auth-${tabId}`')) {
  fail('Supabase BroadcastChannel을 분리할 탭별 storageKey가 없음')
}
if (!supabaseSource.includes('Capacitor.isNativePlatform()')) {
  fail('네이티브 앱의 기존 로그인 지속성을 보호하지 않음')
}

for (const path of [
  'src/App.jsx',
  'src/screens/admin/AdminShell.jsx',
  'src/screens/schooladmin/SchoolAdminShell.jsx',
  'src/screens/student/StudentShell.jsx',
  'src/screens/teacher/TeacherShell.jsx',
]) {
  const source = read(path)
  if (/auth\.signOut\(\s*\)/.test(source)) fail(`${path}에 전체 기기 로그아웃 호출이 남음`)
}

const teacherSource = read('src/screens/teacher/TeacherShell.jsx')
const studentShellSource = read('src/screens/student/StudentShell.jsx')
const campusCss = read('src/styles/campus.css')
if (!teacherSource.includes('screen teacher-shell-screen')) {
  fail('교사용 실제 컨테이너 폭 측정 기준이 없음')
}
if (!campusCss.includes('@container teacher-shell (max-width: 720px)')) {
  fail('iframe 내부 앱 폭에 반응하는 교사용 컨테이너 쿼리가 없음')
}

if (!loginSource.includes("handleTrialLogin('student')") || !loginSource.includes("handleTrialLogin('teacher')")) {
  fail('학생·교사 원클릭 체험 버튼이 없음')
}
if (!loginSource.includes('requestedTrialRole()) return')) {
  fail('원클릭 체험 전에 불필요한 학교 목록을 먼저 요청함')
}
if (!studentShellSource.includes("lazyChunk(() => import('./CourseListScreen.jsx')") ||
    !studentShellSource.includes("lazyChunk(() => import('./WrongAnswerScreen.jsx')")) {
  fail('첫 화면에서 대형 학습·오답 청크를 미리 불러옴')
}
if (!trialSource.includes('TRIAL_DURATION_MS = 15 * 60 * 1000')) {
  fail('공개 체험 시간이 15분으로 고정되지 않음')
}
if (!trialSource.includes('TRIAL_COOLDOWN_MS')) {
  fail('역할별 체험 재진입 대기 시간이 없음')
}
if (!appSource.includes('TrialSessionBar') || !appSource.includes("signOut({ scope: 'local' })")) {
  fail('체험 남은 시간 표시 또는 탭 단위 자동 종료가 없음')
}
if (!appSource.includes('SUGAR_SALT_APP_READY')) {
  fail('포털이 실제 화면 준비 완료를 판별할 신호가 없음')
}
if (!supabaseSource.includes('trialSafeFetch') || !supabaseSource.includes('X-Sugar-Salt-Trial')) {
  fail('체험 데이터의 클라이언트 저장 차단이 없음')
}
if (!serverGuard.includes('public_trial_read_only') || !serverGuard.includes('reject_public_trial_write')) {
  fail('공개 체험 계정의 서버 쓰기 차단이 없음')
}

if (!process.exitCode) {
  console.log('[웹 체험 격리] 통과 - 원클릭 15분 체험·탭별 인증·저장 차단·교사 반응형 확인')
}
