// A11Y — 스크린리더를 접근성 트리로 대체해 판정한다(지시서 6절).
//
// 무엇을 보는가
//  A1 axe-core 자동 검사 (WCAG 2.1 A/AA) — 대비비 포함
//  A2 접근성 트리에 랜드마크·제목·버튼명·상태가 실제로 있는가
//  A3 aria-live 영역의 변경이 "읽힐 내용"으로 남는가 (MutationObserver 캡처)
//  A4 색만으로 정답/오답·상태를 구분하는 곳이 있는가 (텍스트·기호 동반 여부)
//  A5 큰 글자(브라우저 배율 200%)에서 조작이 화면 밖으로 밀리는가
//
// 한계: 실제 음성 청취는 하지 않는다. 트리에 정보가 없으면 결함, 있으면 통과로 본다.
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/a11y-scan.mjs [student|teacher] [뷰포트키]

import { AxeBuilder } from '@axe-core/playwright'
import { openSession, loginTrial, tapVisible, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const role = process.argv[2] === 'teacher' ? 'teacher' : 'student'
const vpKey = process.argv[3] || '390x844'
const s = await openSession({ viewport: VIEWPORTS[vpKey] ?? VIEWPORTS['390x844'] })
await loginTrial(s, role)

const report = { _meta: { baseline: '9797477fe73a (4.8.14)', role, viewport: vpKey, 대체판정: '접근성 트리 + axe-core. 음성 청취 없음' }, screens: [] }

// aria-live 변경을 잡아 둔다. 학생이 정답/오답을 들을 수 있는지의 근거다.
async function armLiveWatcher() {
  await s.page.evaluate(() => {
    window.__liveLog = []
    const live = [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')]
    for (const el of live) {
      new MutationObserver(() => {
        const text = (el.innerText || '').trim().replace(/\s+/g, ' ')
        if (text) window.__liveLog.push({ region: el.getAttribute('aria-live') || el.getAttribute('role'), text: text.slice(0, 200) })
      }).observe(el, { childList: true, subtree: true, characterData: true })
    }
    return live.length
  })
}
const liveLog = () => s.page.evaluate(() => window.__liveLog || [])

async function scan(name) {
  const axe = await new AxeBuilder({ page: s.page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  // Playwright 1.62 는 page.accessibility 를 없앴다. CDP 로 직접 트리를 받는다.
  const cdp = await s.context.newCDPSession(s.page)
  await cdp.send('Accessibility.enable')
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  await cdp.detach().catch(() => {})
  const flat = (nodes || [])
    .filter(n => !n.ignored)
    .map(n => ({ role: n.role?.value || '', name: (n.name?.value || '').slice(0, 60) }))

  const 구조 = {
    랜드마크: flat.filter(n => ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region'].includes(n.role)).map(n => `${n.role}:${n.name}`),
    제목: flat.filter(n => n.role === 'heading').map(n => n.name).slice(0, 12),
    이름없는버튼: flat.filter(n => (n.role === 'button' || n.role === 'link') && !n.name.trim()).length,
    버튼수: flat.filter(n => n.role === 'button').length,
    상태알림영역: await s.page.evaluate(() => document.querySelectorAll('[aria-live], [role=status], [role=alert]').length),
  }

  const violations = axe.violations.map(v => ({
    id: v.id, impact: v.impact, help: v.help,
    건수: v.nodes.length,
    예: v.nodes.slice(0, 2).map(n => ({ target: n.target.join(' '), 요약: mask(n.failureSummary || '').replace(/\n/g, ' ').slice(0, 180) })),
  }))

  const row = { screen: name, axe위반: violations, 위반건수: violations.reduce((a, v) => a + v.건수, 0), 구조, liveLog: await liveLog() }
  report.screens.push(row)
  await s.shot(`a11y/${role}-${vpKey}-${name}.png`).catch(() => {})
  console.log(`\n[${name}] axe 위반 ${row.위반건수}건 (규칙 ${violations.length}종) · 이름없는버튼 ${구조.이름없는버튼}/${구조.버튼수} · 랜드마크 ${구조.랜드마크.length} · 알림영역 ${구조.상태알림영역}`)
  for (const v of violations.slice(0, 6)) console.log(`   - ${v.id} (${v.impact}) ${v.건수}건 — ${v.help}`)
  return row
}

await armLiveWatcher()
await scan('01-홈')

if (role === 'student') {
  await tapVisible(s.page, '바로 시작', 4200)
  await armLiveWatcher()
  await scan('02-학습안내')
  await tapVisible(s.page, '학습 시작', 3600)
  await armLiveWatcher()
  await scan('03-문항')

  // A4 — 정답/오답을 색만으로 구분하는가
  await s.page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role=button]')]
      .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
    el?.click()
  })
  await s.page.waitForTimeout(1500)
  const 정오표시 = await s.page.evaluate(() => {
    const marks = [...document.querySelectorAll('button, [role=button], [class*=choice], li')]
      .map(e => ({
        text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        color: getComputedStyle(e).color,
        background: getComputedStyle(e).backgroundColor,
        border: getComputedStyle(e).borderColor,
      }))
      .filter(x => x.text && x.text.length < 120)
    return {
      텍스트로표시된것: marks.filter(m => /정답|오답|내 선택|맞|틀|✓|✔|✗|❌|⭕/.test(m.text)).map(m => m.text.slice(0, 50)),
      전체표본: marks.slice(0, 12),
    }
  })
  report.정오표시 = 정오표시
  console.log('\n[정오 표시] 텍스트·기호로도 구분되는 항목:', JSON.stringify(정오표시.텍스트로표시된것).slice(0, 300))
  const 정오알림 = await liveLog()
  report.정오순간_라이브영역 = 정오알림
  console.log('[정오 순간 aria-live 알림]', 정오알림.length ? JSON.stringify(정오알림).slice(0, 300) : '없음 — 상태 변경이 읽히지 않는다')
  await scan('04-정오피드백')
}

if (role === 'teacher') {
  await tapVisible(s.page, '^수업$', 3200)
  await armLiveWatcher()
  await scan('02-수업')
  await s.page.goto(APP, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(6000)
  await tapVisible(s.page, '^소통$', 3200)
  await armLiveWatcher()
  await scan('03-소통')
}

// A5 — 배율 200% 에서 조작이 살아 있는가
await s.page.goto(APP, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(6000)
await s.page.evaluate(() => { document.documentElement.style.zoom = '2' })
await s.page.waitForTimeout(2500)
const 배율200 = await s.page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight
  const btns = [...document.querySelectorAll('button, [role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0
  })
  const 밖 = btns.filter(e => { const r = e.getBoundingClientRect(); return r.right > vw + 2 || r.left < -2 })
  return {
    버튼수: btns.length,
    가로로넘친버튼: 밖.length,
    예: 밖.slice(0, 5).map(e => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)),
    문서가로스크롤: document.documentElement.scrollWidth > vw + 2,
  }
})
await s.shot(`a11y/${role}-${vpKey}-05-배율200.png`).catch(() => {})
report.배율200 = 배율200
console.log('\n[배율 200%]', JSON.stringify(배율200).slice(0, 300))

save(`a11y/${role}-${vpKey}-a11y.json`, report)
const 총위반 = report.screens.reduce((a, s2) => a + s2.위반건수, 0)
const 규칙 = [...new Set(report.screens.flatMap(s2 => s2.axe위반.map(v => v.id)))]
console.log(`\n=== ${role} ${vpKey} 합계 — axe 위반 ${총위반}건 · 규칙 ${규칙.length}종: ${규칙.join(', ')}`)
await s.close()
