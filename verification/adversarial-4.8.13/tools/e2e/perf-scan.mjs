// PERF — "느리다"는 체감 대신 지표로 고정한다(지시서 5절).
//
//  P1 첫 로드 지표: FCP · LCP · DOMContentLoaded · load
//  P2 long task(>50ms) 개수와 총 점유 시간
//  P3 첫 상호작용 응답(학습관 카드 탭 → 다음 페인트까지)
//  P4 문항 진행 상호작용 지연(INP 근사: event 항목의 duration 최대·중앙값)
//  P5 스크롤 프레임 드랍률
//
// 조건: 정상 / 저사양 근사(CPU 6배 스로틀) / 3G 지연 + 저사양
// 서비스 가용성을 떨어뜨리는 부하는 걸지 않는다. 단일 세션만 쓴다.
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/perf-scan.mjs [normal|cpu6|slow3g]

import { openSession, loginTrial, save, VIEWPORTS, APP } from './lib/harness.mjs'

const mode = process.argv[2] || 'normal'
const s = await openSession({ viewport: VIEWPORTS['390x844'] })

const cdp = await s.context.newCDPSession(s.page)
if (mode === 'cpu6' || mode === 'slow3g') {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
}
if (mode === 'slow3g') {
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,                    // 3G 수준 왕복 지연
    downloadThroughput: 400 * 1024 / 8,
    uploadThroughput: 400 * 1024 / 8,
  })
}

// 지표 수집기를 문서보다 먼저 심는다.
await s.page.addInitScript(() => {
  window.__perf = { longTasks: [], events: [], lcp: 0, frames: [] }
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__perf.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* 미지원 */ }
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__perf.lcp = Math.round(e.startTime)
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* 미지원 */ }
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.duration >= 16) window.__perf.events.push({ name: e.name, dur: Math.round(e.duration) })
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
  } catch { /* 미지원 */ }
})

await loginTrial(s, 'student')

// ── P1 첫 로드 (앱 주소 새로 열기) ────────────────────────────────────────
const t0 = Date.now()
await s.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 120000 })
await s.page.waitForTimeout(9000)
const 로드 = await s.page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {}
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]
  return {
    DOMContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    load: Math.round(nav.loadEventEnd || 0),
    FCP: fcp ? Math.round(fcp.startTime) : null,
    LCP: window.__perf.lcp || null,
    전송바이트: Math.round((performance.getEntriesByType('resource') || []).reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
    자원수: (performance.getEntriesByType('resource') || []).length,
  }
})
const longTasks = await s.page.evaluate(() => window.__perf.longTasks)

// ── P3 첫 상호작용 응답 ───────────────────────────────────────────────────
// 실제 입력으로 눌러야 한다. JS 의 el.click() 은 event timing 에 잡히지 않아
// INP 근사값이 늘 0건으로 나온다(실제로 그렇게 나왔다).
async function 상호작용(label, regex) {
  const loc = s.page.locator('button, [role=button], a').filter({ hasText: new RegExp(regex) }).first()
  if (!(await loc.count().catch(() => 0))) return { label, 결과: '대상 없음' }
  await loc.scrollIntoViewIfNeeded().catch(() => {})
  const before = Date.now()
  const ok = await loc.click({ timeout: 8000 }).then(() => true).catch(() => false)
  if (!ok) return { label, 결과: '클릭 실패' }
  // 다음 두 프레임이 그려질 때까지
  await s.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  const paint = Date.now() - before
  await s.page.waitForTimeout(2600)
  const settled = Date.now() - before
  return { label, 다음페인트ms: paint, 안정까지ms: settled }
}

const 상호작용결과 = []
// 화면 순서: 홈 →(바로 시작) 학습 안내 →(학습 시작) 문항 → 보기 → 다음 → 보기 → 다음
상호작용결과.push(await 상호작용('바로 시작', '바로 시작'))
상호작용결과.push(await 상호작용('학습 시작', '학습 시작'))
상호작용결과.push(await 상호작용('보기 선택', '^[A-E]\\s'))
상호작용결과.push(await 상호작용('다음 장면', '^다음'))
상호작용결과.push(await 상호작용('보기 선택 2', '^[A-E]\\s'))
상호작용결과.push(await 상호작용('다음 장면 2', '^다음'))

// ── P5 스크롤 프레임 ──────────────────────────────────────────────────────
const 스크롤 = await s.page.evaluate(async () => {
  const frames = []
  let last = performance.now()
  let stop = false
  const tick = now => { frames.push(now - last); last = now; if (!stop) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  for (let i = 0; i < 12; i++) {
    window.scrollBy(0, 200)
    await new Promise(r => setTimeout(r, 120))
  }
  stop = true
  await new Promise(r => setTimeout(r, 120))
  const 총프레임 = frames.length
  const 드랍 = frames.filter(f => f > 32).length      // 30fps 미만 프레임
  return { 총프레임, 느린프레임: 드랍, 드랍률: 총프레임 ? Number((드랍 / 총프레임).toFixed(3)) : null,
    최장프레임ms: Math.round(Math.max(0, ...frames)) }
})

const events = await s.page.evaluate(() => window.__perf.events)
const durs = events.map(e => e.dur).sort((a, b) => a - b)
const 상호작용지연 = {
  건수: durs.length,
  중앙값ms: durs.length ? durs[Math.floor(durs.length / 2)] : null,
  최댓값ms: durs.length ? durs[durs.length - 1] : null,
  p95ms: durs.length ? durs[Math.max(0, Math.floor(durs.length * 0.95) - 1)] : null,
}

const 결과 = {
  _meta: { baseline: '9797477fe73a (4.8.14)', 조건: mode, 대상: APP, 측정시각: new Date().toISOString() },
  로드, 전체소요ms: Date.now() - t0,
  longTask: {
    개수: longTasks.length,
    총점유ms: longTasks.reduce((a, t) => a + t.dur, 0),
    최장ms: longTasks.length ? Math.max(...longTasks.map(t => t.dur)) : 0,
  },
  상호작용: 상호작용결과,
  상호작용지연_event: 상호작용지연,
  스크롤,
}
save(`perf/perf-${mode}.json`, 결과)
console.log(JSON.stringify(결과, null, 1))
await s.close()
