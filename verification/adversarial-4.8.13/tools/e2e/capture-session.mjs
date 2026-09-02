// 세션 확보 — 비밀번호는 소유자가 창에 직접 입력한다. 나는 로그인된 상태만 저장한다.
//
// 나는 이 스크립트에서 어떤 자격정보도 입력하지 않고, 읽지도 기록하지도 않는다.
// 저장하는 것은 Playwright 의 storageState(쿠키·로컬스토리지)이며,
// 저장소 바깥(스크래치패드)에 두고 검증이 끝나면 지운다.
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/capture-session.mjs <teacher|student|admin> [분]

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const role = process.argv[2] || 'teacher'
const 제한분 = Number(process.argv[3] || 12)
const OUT_DIR = 'C:/Users/kbe/AppData/Local/Temp/claude/D--apps-sugar-salt-campus/e6bc74b3-0c98-43db-908f-fb5749de244b/scratchpad/sessions'
mkdirSync(OUT_DIR, { recursive: true })
const OUT = `${OUT_DIR}/${role}.json`

const browser = await chromium.launch({ headless: false, args: ['--window-size=430,900'] })
const context = await browser.newContext({ viewport: { width: 400, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await context.newPage()
await page.goto('https://gyo6.kr/apps/sugar-salt/?entry=member', { waitUntil: 'domcontentloaded', timeout: 60000 })

console.log(`\n창이 열렸습니다. ${role} 계정으로 직접 로그인해 주세요.`)
console.log('로그인이 확인되면 자동으로 세션만 저장하고 창을 닫습니다.')
console.log(`제한 시간 ${제한분}분\n`)

const 시작 = Date.now()
let 결과 = null
let 직전화면 = ''
while (Date.now() - 시작 < 제한분 * 60_000) {
  await page.waitForTimeout(2500)
  const 상태 = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    const 탭 = [...document.querySelectorAll('button, [role=button]')]
      .map(e => (e.innerText || '').trim())
    const 학생탭 = ['홈', '탐험', '성장', '소식', '나'].filter(x => 탭.includes(x)).length
    const 교사탭 = ['홈', '학습', '수업', '학생', '소통'].filter(x => 탭.includes(x)).length
    // 로그인 직후 앱이 PWA 설치 안내를 먼저 띄운다. 이것도 '로그인된 상태'다.
    // (이걸 몰라 첫 회차에서 세션을 못 잡았다)
    const 설치안내 = /이 기기에 JOB고 설치|홈 화면에 추가|설치하기/.test(t)
    const 로그인폼 = /비밀번호를 잊으셨나요|설탕과소금 계정으로 로그인/.test(t)
    return {
      로그인화면: 로그인폼,
      설치안내,
      교사화면: 교사탭 >= 4 || /MY CLASS CAMPUS|학급 캠퍼스/.test(t) || (설치안내 && !로그인폼),
      학생화면: 학생탭 >= 4 || /오늘도 이어서 학습/.test(t),
      관리자화면: /학교 목록|관리자 지정|과목배정/.test(t),
      승인대기: /승인/.test(t) && /대기|기다|후에|필요/.test(t),
      화면머리: t.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 4).join(' / ').slice(0, 120),
      글자수: t.length,
    }
  }).catch(() => null)
  if (!상태) continue
  if (상태.화면머리 !== 직전화면) {
    직전화면 = 상태.화면머리
    console.log(`[화면] ${상태.화면머리}`)
  }
  if (상태.승인대기) {
    console.log('⚠ 승인 대기 상태로 보입니다 — 교사(학생 승인) 또는 학교관리자(교사 승인) 처리가 먼저 필요합니다.')
  }
  if (상태.설치안내) {
    const 닫음 = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button, [role=button]')]
        .find(e => /웹으로 계속|나중에|건너뛰기|닫기/.test((e.innerText || '').trim()))
      el?.click(); return Boolean(el)
    }).catch(() => false)
    if (닫음) console.log('[설치 안내] "웹으로 계속"을 눌러 닫았습니다')
    await page.waitForTimeout(1500)
    continue
  }
  if (상태.교사화면 || 상태.학생화면 || 상태.관리자화면) {
    결과 = {
      감지된역할: 상태.관리자화면 ? 'admin' : 상태.교사화면 ? 'teacher' : 'student',
      글자수: 상태.글자수,
    }
    break
  }
}

if (!결과) {
  // 왜 확인되지 않았는지 남긴다. 화면 글자만 남기고 입력값은 남기지 않는다.
  const 끝상태 = await page.evaluate(() => (document.body?.innerText || '')
    .split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12).join(' / ').slice(0, 400)).catch(() => '(읽기 실패)')
  console.log('시간 안에 로그인이 확인되지 않았습니다.')
  console.log('마지막 화면:', 끝상태)
  await browser.close()
  process.exit(2)
}

// 이 앱은 auth 세션을 sessionStorage 에 '탭 단위 키'로 넣는다
// (src/lib/supabase.js:93-95 — 공용 PC 격리 설계).
// storageState 는 localStorage·쿠키만 담으므로 그것만으로는 재사용되지 않는다 — 실제로 안 됐다.
// 그래서 window.name(탭 id)과 sessionStorage 를 함께 저장한다.
const 탭상태 = await page.evaluate(() => {
  const ss = {}
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    ss[k] = sessionStorage.getItem(k)
  }
  return { windowName: window.name, sessionStorage: ss }
})
await context.storageState({ path: OUT })
const fs = await import('node:fs')
const 저장본 = JSON.parse(fs.readFileSync(OUT, 'utf8'))
저장본.__tab = 탭상태
fs.writeFileSync(OUT, JSON.stringify(저장본, null, 1))
console.log(`sessionStorage 키 ${Object.keys(탭상태.sessionStorage).length}개 · 탭이름 ${탭상태.windowName ? '있음' : '없음'}`)
console.log(`\n세션 저장 완료 — 감지된 역할: ${결과.감지된역할}`)
console.log(`저장 위치(저장소 바깥): ${OUT}`)
await browser.close()
