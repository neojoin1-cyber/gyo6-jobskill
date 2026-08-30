import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const manifest = JSON.parse(read('public/manifest.json'))
const login = read('src/screens/LoginScreen.jsx')
const app = read('src/App.jsx')
const prompt = read('src/components/PwaInstallPrompt.jsx')
const install = read('src/lib/pwaInstall.js')
const teacher = read('src/screens/teacher/TeacherShell.jsx')
const student = read('src/screens/student/AccountDataScreen.jsx')
const html = read('index.html')

const failures = []
const requireValue = (condition, message) => { if (!condition) failures.push(message) }

requireValue(manifest.start_url === './?entry=member', '설치 아이콘의 정식 사용자 시작 URL이 다릅니다.')
requireValue(manifest.scope === './', 'PWA scope가 앱 경로 밖으로 변경됐습니다.')
requireValue(manifest.orientation === 'any', 'PC·태블릿 가로 화면을 허용해야 합니다.')
requireValue(html.includes('href="./manifest.json"'), '하위 경로 배포에서도 manifest를 찾을 수 있어야 합니다.')
requireValue(login.includes("get('entry') === 'member'"), '정식 사용자 직행 쿼리 처리가 없습니다.')
requireValue(app.includes('<PwaInstallPrompt enabled={!isTrial} />'), '정식 로그인 후 설치 안내가 연결되지 않았습니다.')
for (const token of ['beforeinstallprompt', 'appinstalled', 'display-mode: standalone', 'userChoice']) {
  requireValue(install.includes(token), `PWA 설치 상태 처리 누락: ${token}`)
}
for (const token of ['홈 화면에 추가', '웹으로 계속', '학습 기록은 로그인한 계정으로 이어집니다']) {
  requireValue(prompt.includes(token), `설치 안내 문구 누락: ${token}`)
}
requireValue(teacher.includes('openPwaInstall()'), '교사 계정 메뉴의 설치 재진입이 없습니다.')
requireValue(student.includes('onClick={openPwaInstall}'), '학생 나 화면의 설치 재진입이 없습니다.')

if (failures.length) {
  console.error(`\n[PWA 진입 게이트 실패]\n- ${failures.join('\n- ')}\n`)
  process.exit(1)
}

console.log('[통과] 체험·정식 진입 분리 및 PWA 설치 흐름')

