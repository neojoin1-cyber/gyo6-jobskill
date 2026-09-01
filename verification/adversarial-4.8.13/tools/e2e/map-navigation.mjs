// 화면 지도 — 하단 탭마다 실제로 보이는 조작을 모은다(최상위 창, 전체 뷰포트).
// 실행: node .../map-navigation.mjs student|teacher [뷰포트키]

import { openSession, loginTrial, visibleControls, tapVisible, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const role = process.argv[2] === 'teacher' ? 'teacher' : 'student'
const vpKey = process.argv[3] || '390x844'
const s = await openSession({ viewport: VIEWPORTS[vpKey] })
await loginTrial(s, role)

const map = { role, viewport: vpKey, screens: [] }
const bodyOf = async () => (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')

async function snap(name) {
  const controls = await visibleControls(s.page)
  const body = await bodyOf()
  await s.shot(`nav/${role}-${vpKey}-${name}.png`).catch(() => {})
  map.screens.push({ screen: name, 조작: controls, 본문: mask(body).slice(0, 900) })
  console.log(`\n[${name}] ${controls.length}개`)
  console.log('  ', controls.join(' | ').slice(0, 700))
  return body
}

await snap('00-landing')
const TABS = role === 'teacher' ? ['학습', '수업', '학생', '소통'] : ['탐험', '성장', '소식', '나']
for (const tab of TABS) {
  // 교사 '학습' 탭은 학생 화면 미리보기로 넘어가므로 매번 앱을 다시 연다.
  await s.page.goto(APP, { waitUntil: 'domcontentloaded' })
  await s.page.waitForTimeout(6000)
  const r = await tapVisible(s.page, `^${tab}$`, 3200)
  await snap(`tab-${tab}${r.ok ? '' : '-이동실패'}`)
}
save(`nav/${role}-${vpKey}-navigation.json`, map)
await s.close()
