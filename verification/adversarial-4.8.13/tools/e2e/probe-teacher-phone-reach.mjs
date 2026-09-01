// 폰 화면에서 교사가 미션 만들기·작성본 첨삭·면접 코칭·채점함·9단계 관찰표에
// 도달할 수 있는 경로가 하나라도 있는지 깊이 2까지 훑는다.
import { openSession, loginTrial, visibleControls, save, VIEWPORTS, APP } from './lib/harness.mjs'

const vpKey = process.argv[2] || '390x844'
const KEYWORDS = ['미션', '첨삭', '코칭', '채점', '관찰표', '수업 시작']
const s = await openSession({ viewport: VIEWPORTS[vpKey] })
await loginTrial(s, 'teacher')

const visited = []
const hits = []

async function scan(pathLabel) {
  const controls = await visibleControls(s.page)
  const found = controls.filter(c => KEYWORDS.some(k => c.includes(k)))
  visited.push({ path: pathLabel, controlCount: controls.length, controls: controls.slice(0, 30) })
  if (found.length) hits.push({ path: pathLabel, found })
  return controls
}

const root = await scan('홈')
const TABS = ['학습', '수업', '학생', '소통']
for (const tab of TABS) {
  await s.page.goto(APP, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(5500)
  const clicked = await s.page.evaluate(t => {
    const el = [...document.querySelectorAll('button, [role=button]')].find(e => (e.innerText || '').trim() === t)
    el?.click(); return Boolean(el)
  }, tab)
  if (!clicked) { visited.push({ path: tab, error: '탭 없음' }); continue }
  await s.page.waitForTimeout(3200)
  const inTab = await scan(`홈 > ${tab}`)

  // 깊이 2 — 탭 안의 조작을 하나씩 눌러 본다(되돌아오며)
  const candidates = inTab.filter(c => c.length < 30 && !['홈', '학습', '수업', '학생', '소통', '×'].includes(c)).slice(0, 8)
  for (const c of candidates) {
    const ok = await s.page.evaluate(t => {
      const el = [...document.querySelectorAll('button, [role=button], a')].find(e => (e.innerText || '').trim() === t)
      el?.click(); return Boolean(el)
    }, c)
    if (!ok) continue
    await s.page.waitForTimeout(2600)
    await scan(`홈 > ${tab} > ${c}`)
    await s.page.goto(APP, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(5000)
    await s.page.evaluate(t => {
      const el = [...document.querySelectorAll('button, [role=button]')].find(e => (e.innerText || '').trim() === t)
      el?.click()
    }, tab)
    await s.page.waitForTimeout(2600)
  }
}

save(`nav/teacher-phone-reach-${vpKey}.json`, { viewport: vpKey, keywords: KEYWORDS, hits, visited })
console.log(`\n[${vpKey}] 훑은 화면 ${visited.length}개`)
console.log('키워드 도달:', hits.length ? JSON.stringify(hits, null, 1).slice(0, 900) : '없음')
await s.close()
