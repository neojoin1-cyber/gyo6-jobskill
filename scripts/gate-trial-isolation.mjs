import { readFileSync } from 'node:fs'
import {
  beginTrialSession,
  clearTrialSession,
  shouldSwitchTrialRole,
} from '../src/lib/trialSession.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const fail = message => {
  console.error(`[웹 체험 격리] 실패 - ${message}`)
  process.exitCode = 1
}

const supabaseSource = read('src/lib/supabase.js')
const trialSource = read('src/lib/trialSession.js')
const lazyChunkSource = read('src/lib/lazyChunk.js')
const loginSource = read('src/screens/LoginScreen.jsx')
const appSource = read('src/App.jsx')
const serverGuard = read('supabase/migrations/20260825150000_public_trial_read_only.sql')
const tokenBroker = read('supabase/migrations/20260826100000_public_trial_token_broker.sql')
const edgeFunction = read('supabase/functions/public-trial-session/index.ts')
if (!supabaseSource.includes('storage: window.sessionStorage')) {
  fail('웹 인증 저장소가 탭별 sessionStorage가 아님')
}
if (!supabaseSource.includes('storageKey: `sugar-salt-auth-${tabId}`')) {
  fail('Supabase BroadcastChannel을 분리할 탭별 storageKey가 없음')
}
if (!supabaseSource.includes('resetWebAuthSession') ||
    !supabaseSource.includes("sessionStorage.removeItem(`sugar-salt-auth-${tabId}`)")) {
  fail('체험 역할 전환용 탭 단위 인증 초기화가 없음')
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
if (!loginSource.includes('requestTrialToken(role)') || !loginSource.includes('verifyOtp')) {
  fail('체험 로그인이 서버 발급 일회성 토큰을 사용하지 않음')
}
for (const [name, source] of [['trialSession.js', trialSource], ['LoginScreen.jsx', loginSource], ['App.jsx', appSource]]) {
  if (/demo\.(student|teacher|admin)@/i.test(source) || /sugarsalt2026/i.test(source) || /VITE_TRIAL_PASSWORD/.test(source)) {
    fail(`${name} 프런트 코드에 체험 계정 자격 증명이 남음`)
  }
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
if (!appSource.includes('shouldSwitchTrialRole(session.user, requestedTrial)') ||
    !appSource.includes('switchingTrialRole')) {
  fail('같은 iframe에서 학생·교사 체험 역할을 바꾸는 흐름이 없음')
}
if (!appSource.includes("lazyChunk(() => import('./screens/teacher/TeacherShell.jsx'), 'TeacherShell')")) {
  fail('배포 교체 중 최상위 교사 화면의 청크 자동 복구가 없음')
}
if (!lazyChunkSource.includes('clearRetryMarker(name)') ||
    !lazyChunkSource.includes('window.setTimeout(reloadLatestApp, 120)') ||
    !lazyChunkSource.includes('registration.unregister()')) {
  fail('오래된 청크 복구 후 재시도 표식·서비스워커·캐시 정리가 완전하지 않음')
}
if (!supabaseSource.includes('trialSafeFetch') || !supabaseSource.includes('X-Sugar-Salt-Trial')) {
  fail('체험 데이터의 클라이언트 저장 차단이 없음')
}
if (!serverGuard.includes('public_trial_read_only') || !serverGuard.includes('reject_public_trial_write')) {
  fail('공개 체험 계정의 서버 쓰기 차단이 없음')
}
if (!trialSource.includes('localStorage.clear()') || !trialSource.includes('wasTrial')) {
  fail('체험 종료 시 브라우저 작성·학습 자료 전체 정리가 없음')
}
if (!tokenBroker.includes('claim_public_trial_session') ||
    !tokenBroker.includes('encrypted_password = extensions.crypt') ||
    !tokenBroker.includes('CREATE EVENT TRIGGER ensure_public_trial_guard')) {
  fail('체험 발급 제한·기존 비밀번호 폐기·향후 테이블 자동 보호가 완성되지 않음')
}
if (!edgeFunction.includes("admin.auth.admin.generateLink") || !edgeFunction.includes('hashed_token')) {
  fail('서버 체험 함수가 일회성 토큰만 발급하지 않음')
}

class MemoryStorage {
  #values = new Map()
  get length() { return this.#values.size }
  getItem(key) { return this.#values.get(key) ?? null }
  setItem(key, value) { this.#values.set(key, String(value)) }
  removeItem(key) { this.#values.delete(key) }
  clear() { this.#values.clear() }
}
globalThis.sessionStorage = new MemoryStorage()
globalThis.localStorage = new MemoryStorage()
beginTrialSession('student', 1_000)
localStorage.setItem('iv_cover_draft', '{"answer":"trial-only"}')
localStorage.setItem('gyo6.studySummaries.v2', '{"progress":1}')
clearTrialSession()
if (localStorage.length !== 0) fail('체험 종료 뒤 작성·학습 로컬 자료가 남음')

const trialTeacher = { user_metadata: { is_public_trial: true, trial_role: 'teacher' } }
const regularTeacher = { user_metadata: { role: 'teacher' } }
if (!shouldSwitchTrialRole(trialTeacher, 'student')) fail('체험 교사에서 체험 학생으로 역할 전환을 감지하지 못함')
if (shouldSwitchTrialRole(trialTeacher, 'teacher')) fail('동일 체험 역할을 전환으로 오인함')
if (shouldSwitchTrialRole(regularTeacher, 'teacher')) fail('정식 교사 로그인을 체험 역할 전환으로 오인함')

if (!process.exitCode) {
  console.log('[웹 체험 격리] 통과 - 원클릭 15분 체험·탭별 인증·저장 차단·교사 반응형 확인')
}
