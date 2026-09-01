import { openSession, loginTrial, visibleControls, save } from './lib/harness.mjs'
const s = await openSession({ viewport: { width: 390, height: 844 } })
await loginTrial(s, 'teacher')
const before = await visibleControls(s.page)
// 아바타(체) 버튼만 정확히 누른다.
const clicked = await s.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')].find(e => {
    const r = e.getBoundingClientRect()
    return r.top < 160 && r.width > 0 && (e.innerText || '').trim() === '체'
  })
  el?.click()
  return Boolean(el)
})
await s.page.waitForTimeout(2500)
const after = await visibleControls(s.page)
console.log('아바타 클릭:', clicked)
console.log('새 조작:', after.filter(x => !before.includes(x)).join(' | ').slice(0, 800))
await s.shot('nav/teacher-avatar-menu.png')

// 여기서 주요 기능이 보이는지 확인
const TARGETS = ['수업 시작', '미션 만들기', '작성본 첨삭', '면접 코칭', '채점함', '성장 순위', '학급 캠퍼스', 'PC·휴대폰 동기화', '로그아웃']
const state = await s.page.evaluate(ts => Object.fromEntries(ts.map(t => {
  const el = [...document.querySelectorAll('button, [role=button], a')].find(e => (e.innerText || '').trim().startsWith(t))
  if (!el) return [t, 'DOM에 없음']
  const r = el.getBoundingClientRect(); const st = getComputedStyle(el)
  const vis = r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05
  return [t, vis ? `보임(y=${Math.round(r.top)})` : '숨음']
})), TARGETS)
console.log('주요 기능 노출:', JSON.stringify(state, null, 1))
save('nav/teacher-avatar-menu.json', { state })
await s.close()
