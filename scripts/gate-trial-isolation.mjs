import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const fail = message => {
  console.error(`[웹 체험 격리] 실패 - ${message}`)
  process.exitCode = 1
}

const supabaseSource = read('src/lib/supabase.js')
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
const campusCss = read('src/styles/campus.css')
if (!teacherSource.includes('screen teacher-shell-screen')) {
  fail('교사용 실제 컨테이너 폭 측정 기준이 없음')
}
if (!campusCss.includes('@container teacher-shell (max-width: 720px)')) {
  fail('iframe 내부 앱 폭에 반응하는 교사용 컨테이너 쿼리가 없음')
}

if (!process.exitCode) {
  console.log('[웹 체험 격리] 통과 - 탭별 인증·현재 기기 로그아웃·교사 컨테이너 반응형 확인')
}
