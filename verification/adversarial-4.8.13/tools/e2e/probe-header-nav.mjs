// 헤더 아이콘 버튼이 무엇인지, 접근성 이름이 있는지, 무엇을 여는지 본다.
import { openSession, loginTrial, visibleControls, save } from './lib/harness.mjs'

const role = process.argv[2] || 'teacher'
const s = await openSession({ viewport: { width: 390, height: 844 } })
await loginTrial(s, role)

const headerButtons = await s.page.evaluate(() => {
  const top = [...document.querySelectorAll('button, [role=button]')].filter(e => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.top < 160
  })
  return top.map((e, i) => ({
    i,
    text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30),
    ariaLabel: e.getAttribute('aria-label'),
    title: e.getAttribute('title'),
    hasSvg: !!e.querySelector('svg'),
    rect: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect()),
  }))
})
console.log('헤더 버튼:', JSON.stringify(headerButtons, null, 1))

// 이름 없는 아이콘 버튼을 순서대로 눌러 무엇이 열리는지 본다.
// '×' 는 체험 종료 버튼이라 누르면 세션이 끝난다. 메뉴 탐색에서는 건너뛴다.
for (const b of headerButtons.filter(x => x.text !== '×')) {
  const before = await visibleControls(s.page)
  await s.page.evaluate(i => {
    const top = [...document.querySelectorAll('button, [role=button]')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 160
    })
    top[i]?.click()
  }, b.i)
  await s.page.waitForTimeout(2200)
  const after = await visibleControls(s.page)
  const added = after.filter(x => !before.includes(x))
  console.log(`\n버튼 #${b.i} '${b.text || b.ariaLabel || '(이름없음)'}' → 새로 나타난 조작 ${added.length}개`)
  console.log('  ', added.join(' | ').slice(0, 500))
  await s.shot(`nav/${role}-header-${b.i}.png`).catch(() => {})
  if (added.length) break
}
save(`nav/${role}-header.json`, { headerButtons })
await s.close()
