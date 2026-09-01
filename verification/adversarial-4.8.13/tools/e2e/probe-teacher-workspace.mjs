// 교사 작업대(미션 만들기·작성본 첨삭·면접 코칭·채점함)가 기기별로 실제 도달 가능한지 본다.
// 홍보물이 약속한 "작성본 첨삭 · 개별 상담 · 메시지", "9단계 면접 관찰표"의 도달 경로 확인.
import { openSession, loginTrial, visibleControls, save, VIEWPORTS } from './lib/harness.mjs'

const TARGETS = ['수업 시작', '미션 만들기', '작성본 첨삭', '면접 코칭', '채점함', '성장 순위', '학급 캠퍼스']
const out = []

for (const vpKey of ['390x844', '768x1024', '1280x720']) {
  const s = await openSession({ viewport: VIEWPORTS[vpKey] })
  await loginTrial(s, 'teacher')

  const landing = await s.page.evaluate(ts => Object.fromEntries(ts.map(t => {
    const el = [...document.querySelectorAll('button, [role=button], a')].find(e => (e.innerText || '').trim().startsWith(t))
    if (!el) return [t, '없음']
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el)
    return [t, (r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05) ? '보임' : '숨음']
  })), TARGETS)

  // 아바타 → 교사 작업대
  await s.page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role=button]')].find(e => {
      const r = e.getBoundingClientRect(); return r.top < 160 && r.width > 0 && (e.innerText || '').trim() === '체'
    })
    el?.click()
  })
  await s.page.waitForTimeout(2000)
  const opened = await s.page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role=button], a')].find(e => /교사 작업대|넓게 보기/.test(e.innerText || ''))
    el?.click(); return Boolean(el)
  })
  await s.page.waitForTimeout(4500)

  const workspace = await s.page.evaluate(ts => Object.fromEntries(ts.map(t => {
    const el = [...document.querySelectorAll('button, [role=button], a')].find(e => (e.innerText || '').trim().startsWith(t))
    if (!el) return [t, '없음']
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el)
    return [t, (r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05) ? `보임(y=${Math.round(r.top)})` : '숨음']
  })), TARGETS)

  const controls = await visibleControls(s.page)
  await s.shot(`nav/teacher-workspace-${vpKey}.png`).catch(() => {})
  out.push({ viewport: vpKey, 진입화면: landing, 작업대열림: opened, 작업대화면: workspace, 작업대조작: controls.slice(0, 25) })
  console.log(`\n[${vpKey}] 작업대 열림=${opened}`)
  console.log('  진입화면:', JSON.stringify(landing))
  console.log('  작업대:', JSON.stringify(workspace))
  await s.close()
}
save('nav/teacher-workspace.json', out)
