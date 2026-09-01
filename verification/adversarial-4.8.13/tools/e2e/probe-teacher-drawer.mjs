// 교사 화면의 주요 조작(수업 시작·미션 만들기·작성본 첨삭)이 어떤 조작으로 열리는지 찾는다.
import { openSession, appFrame, save, TRIAL_PAGE } from './lib/harness.mjs'

const s = await openSession({ viewport: { width: 390, height: 844 } })
await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(2000)
await s.page.locator('[data-trial="teacher"]').first().click()
await s.page.waitForTimeout(10000)

const HIDDEN_TARGETS = ['수업 시작', '미션 만들기', '작성본 첨삭', '면접 코칭', '채점함']
const visibleOf = async () => appFrame(s.page).evaluate(targets => {
  const res = {}
  for (const t of targets) {
    const el = [...document.querySelectorAll('button, [role=button], a')].find(e => (e.innerText || '').trim().startsWith(t))
    if (!el) { res[t] = 'DOM에 없음'; continue }
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el)
    res[t] = (r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05) ? '보임' : '숨음'
  }
  return res
}, HIDDEN_TARGETS)

console.log('진입 직후:', JSON.stringify(await visibleOf()))

// 후보 조작을 하나씩 눌러 보며 무엇이 서랍을 여는지 찾는다.
const CANDIDATES = ['설탕과소금 스킬캠퍼스', '체', '학생 화면 그대로 보기', '지금 갱신']
for (const cand of CANDIDATES) {
  const frame = appFrame(s.page)
  const loc = frame.getByText(cand).first()
  if (!(await loc.count().catch(() => 0))) { console.log(`${cand}: 없음`); continue }
  await loc.click({ timeout: 6000 }).catch(() => {})
  await s.page.waitForTimeout(2000)
  const after = await visibleOf()
  console.log(`'${cand}' 클릭 후:`, JSON.stringify(after))
  await s.shot(`nav/teacher-after-${cand.slice(0, 8)}.png`).catch(() => {})
  if (Object.values(after).some(v => v === '보임')) { console.log('  → 이 조작이 주요 메뉴를 연다'); break }
}
save('nav/teacher-drawer-probe.json', { note: '진입 직후 숨어 있던 조작이 어떤 클릭으로 보이는지' })
await s.close()
