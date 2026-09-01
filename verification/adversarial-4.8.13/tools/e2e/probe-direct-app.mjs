// 체험 로그인 뒤 앱을 최상위 창에서 직접 열 수 있는지 확인한다.
// (iframe 패널은 높이가 고정돼 뷰포트 변형 시험에 쓸 수 없다)
import { openSession, save, mask, TRIAL_PAGE, APP } from './lib/harness.mjs'

const role = process.argv[2] === 'teacher' ? 'teacher' : 'student'
const s = await openSession({ viewport: { width: 390, height: 844 } })
await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(2000)
await s.page.locator(`[data-trial="${role}"]`).first().click()
await s.page.waitForTimeout(10000)

await s.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(9000)
const body = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
const buttons = await s.page.evaluate(() => [...document.querySelectorAll('button, [role=button]')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  .map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40))
await s.shot(`nav/${role}-direct-app.png`)
console.log('로그인 유지:', !/로그인하세요|비밀번호/.test(body.slice(0, 500)))
console.log('본문:', mask(body).replace(/\n/g, ' | ').slice(0, 700))
console.log('보이는 버튼:', buttons.join(' | ').slice(0, 700))
save(`nav/${role}-direct-app.json`, { body: mask(body).slice(0, 3000), buttons })
await s.close()
