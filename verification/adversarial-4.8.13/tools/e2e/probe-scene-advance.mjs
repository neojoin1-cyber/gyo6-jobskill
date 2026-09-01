// 학습 장면이 실제로 넘어가는지, 어떤 버튼으로 넘어가는지 확인한다.
import { openSession, appFrame, buttonTexts, tapButton, save, TRIAL_PAGE } from './lib/harness.mjs'

const s = await openSession()
await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(2000)
await s.page.locator('[data-trial="student"]').first().click()
await s.page.waitForTimeout(10000)
let frame = appFrame(s.page)

const log = []
const sceneOf = async () => ((await frame.evaluate(() => document.body.innerText || '')).match(/장면\s*\d+\s*\/\s*\d+/) || ['(없음)'])[0]

await tapButton(frame, '바로 시작', { page: s.page, waitMs: 4000 }); frame = appFrame(s.page)
await tapButton(frame, '학습 시작', { page: s.page, waitMs: 3500 }); frame = appFrame(s.page)

for (let i = 0; i < 8; i++) {
  frame = appFrame(s.page)
  const before = await sceneOf()
  const btns = await buttonTexts(frame)
  // 보기 하나 선택
  await frame.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role=button]')]
      .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
    el?.click()
  })
  await s.page.waitForTimeout(800)
  const afterPick = await buttonTexts(frame)
  // 진행 버튼 후보를 순서대로 시도
  let used = null
  for (const cand of ['다음 장면', '다음', '계속', '이어서', '확인', '완료']) {
    const r = await tapButton(frame, `^${cand}`, { page: s.page, waitMs: 2000 })
    if (r.ok) { used = cand; break }
  }
  frame = appFrame(s.page)
  const after = await sceneOf()
  log.push({ i, before, after, moved: before !== after, used, btnsBefore: btns.slice(0, 12), btnsAfterPick: afterPick.slice(0, 12) })
  console.log(`${i}: ${before} -> ${after} (버튼 '${used}') 이동=${before !== after}`)
}
save('journey/scene-advance.json', log)
await s.close()
