// PWA — 설치·서비스워커·오프라인이 약속대로 되는지 본다.
//
//  W1 서비스워커 등록·활성·scope
//  W2 precache 로 실제로 채워지는 것
//  W3 캐시가 데워진 뒤 오프라인에서 앱이 열리는가 (앱 기능 목록의 "오프라인 지원")
//  W4 오프라인에서 아직 안 받은 화면(지연 청크)을 열면 어떻게 되는가
//  W5 설치 조건(manifest·SW·HTTPS) 충족 여부
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/pwa-scan.mjs

import { openSession, loginTrial, tapVisible, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const s = await openSession({ viewport: VIEWPORTS['390x844'] })
const report = { _meta: { baseline: '9797477fe73a (4.8.14)', 대상: APP } }

await loginTrial(s, 'student')

// ── W1 · W2 ───────────────────────────────────────────────────────────────
report.서비스워커 = await s.page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  const keys = await caches.keys()
  const detail = []
  for (const k of keys) {
    const c = await caches.open(k)
    const reqs = await c.keys()
    detail.push({ 캐시: k, 항목수: reqs.length, 예: reqs.slice(0, 3).map(r => r.url.split('/').pop()) })
  }
  return {
    등록수: regs.length,
    scope: regs[0]?.scope ?? null,
    활성: Boolean(regs[0]?.active),
    상태: regs[0]?.active?.state ?? null,
    캐시: detail,
  }
})
console.log('[SW]', JSON.stringify(report.서비스워커).slice(0, 500))

// ── W5 설치 조건 ──────────────────────────────────────────────────────────
report.설치조건 = await s.page.evaluate(async () => {
  const link = document.querySelector('link[rel=manifest]')
  let manifest = null
  try { manifest = await (await fetch(link.href)).json() } catch { /* noop */ }
  return {
    HTTPS: location.protocol === 'https:',
    manifest링크: Boolean(link),
    이름: manifest?.name ?? null,
    display: manifest?.display ?? null,
    start_url: manifest?.start_url ?? null,
    아이콘수: (manifest?.icons || []).length,
    maskable보유: (manifest?.icons || []).some(i => (i.purpose || '').includes('maskable')),
    서비스워커: 'serviceWorker' in navigator,
  }
})
console.log('[설치조건]', JSON.stringify(report.설치조건))

// 학습 화면까지 들어가 청크를 데운다
await tapVisible(s.page, '바로 시작', 4200)
await tapVisible(s.page, '학습 시작', 3600)
const 데운뒤 = await s.page.evaluate(() => (document.body.innerText || '').slice(0, 120))
report.캐시워밍 = { 학습화면도달: /장면|보기|확인/.test(데운뒤) }

// ── W3 오프라인에서 다시 열기 ─────────────────────────────────────────────
await s.context.setOffline(true)
await s.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { report.오프라인이동오류 = String(e).slice(0, 120) })
await s.page.waitForTimeout(8000)
const 오프라인본문 = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
await s.shot('pwa/offline-home.png').catch(() => {})
report.오프라인_홈 = {
  본문길이: 오프라인본문.length,
  학습관보임: 오프라인본문.includes('교육부 직업공통능력관'),
  오류화면: /문제가 발생했어요|불러오지 못했습니다|인터넷|오프라인/.test(오프라인본문),
  본문: mask(오프라인본문).slice(0, 500),
}
console.log('[오프라인 홈]', JSON.stringify({ ...report.오프라인_홈, 본문: undefined }))

// ── W4 오프라인에서 아직 안 받은 화면 열기 ────────────────────────────────
const 이동 = await tapVisible(s.page, '면접 스킬관', 5000)
await s.page.waitForTimeout(4000)
const 오프라인청크 = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
await s.shot('pwa/offline-lazy-chunk.png').catch(() => {})
report.오프라인_미캐시화면 = {
  이동시도: 이동,
  복구화면문구: /최신 학습 화면을 연결|콘텐츠를 불러오지 못했습니다|다시 시도|새로고침/.test(오프라인청크),
  빈화면: 오프라인청크.trim().length < 40,
  본문: mask(오프라인청크).slice(0, 400),
}
console.log('[오프라인 미캐시 화면]', JSON.stringify({ ...report.오프라인_미캐시화면, 본문: undefined }))

// ── 복구 ──────────────────────────────────────────────────────────────────
await s.context.setOffline(false)
await s.page.goto(APP, { waitUntil: 'domcontentloaded' }).catch(() => {})
await s.page.waitForTimeout(8000)
const 복구본문 = (await s.page.evaluate(() => document.body?.innerText || ''))
report.온라인복구 = { 학습관보임: 복구본문.includes('교육부 직업공통능력관'), 본문길이: 복구본문.length }
console.log('[온라인 복구]', JSON.stringify(report.온라인복구))

report.콘솔오류 = s.logs.console.filter(c => c.type === 'error').slice(0, 10)
save('pwa/pwa-scan.json', report)
await s.close()
