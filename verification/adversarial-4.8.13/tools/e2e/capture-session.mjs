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
while (Date.now() - 시작 < 제한분 * 60_000) {
  await page.waitForTimeout(2500)
  const 상태 = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return {
      로그인화면: /설탕과소금 계정으로 로그인|비밀번호를 잊으셨나요/.test(t),
      교사화면: /MY CLASS CAMPUS|학급 캠퍼스|TEACHER/.test(t),
      학생화면: /학습관|오늘도 이어서 학습|스킬캠퍼스/.test(t) && !/TEACHER/.test(t),
      승인대기: /승인/.test(t) && /대기|기다/.test(t),
      글자수: t.length,
    }
  }).catch(() => null)
  if (!상태) continue
  if (상태.승인대기) {
    console.log('⚠ 승인 대기 상태로 보입니다 — 교사(학생 승인) 또는 학교관리자(교사 승인) 처리가 먼저 필요합니다.')
  }
  if (상태.교사화면 || 상태.학생화면) {
    결과 = { 감지된역할: 상태.교사화면 ? 'teacher' : 'student', 글자수: 상태.글자수 }
    break
  }
}

if (!결과) {
  console.log('시간 안에 로그인이 확인되지 않았습니다. 창을 닫습니다.')
  await browser.close()
  process.exit(2)
}

await context.storageState({ path: OUT })
console.log(`\n세션 저장 완료 — 감지된 역할: ${결과.감지된역할}`)
console.log(`저장 위치(저장소 바깥): ${OUT}`)
await browser.close()
