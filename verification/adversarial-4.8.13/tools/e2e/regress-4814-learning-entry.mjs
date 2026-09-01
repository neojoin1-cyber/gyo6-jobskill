// 4.8.14 회귀 확인 — 코덱스가 고친 지점과 그 주변만 본다. 앱은 고치지 않는다.
//
// 무엇을 보는가
//  R1 학습관 6곳에 처음 진입할 때 오류 복구 화면이 뜨는가 (P0 재발 여부)
//  R2 학습을 시작한 뒤에도 오류가 없는가
//  R3 고친 함수가 보내는 학습 위치(rpc_learning_presence_ping 요청 본문)가
//     실제 학습 맥락을 담는가 — 전부 '학습관 탐색'으로 뭉개지면 교사 화면 약속이 깨진다
//  R4 콘솔·페이지 오류·실패 요청
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/regress-4814-learning-entry.mjs [뷰포트키]

import { openSession, loginTrial, tapVisible, visibleControls, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const vpKey = process.argv[2] || '390x844'
const s = await openSession({ viewport: VIEWPORTS[vpKey] ?? VIEWPORTS['390x844'] })

// 학습 위치 신고 본문을 그대로 모은다.
const pings = []
s.page.on('request', req => {
  if (!/rpc_learning_presence_ping/.test(req.url())) return
  let body = null
  try { body = JSON.parse(req.postData() || 'null') } catch { body = req.postData() }
  pings.push({ at: Date.now(), body: mask(body ?? {}) })
})

const ERROR_MARKS = ['문제가 발생했어요', '화면을 표시하는 중 오류', '콘텐츠를 불러오지 못했습니다']
const bodyOf = async () => (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
const errorShown = body => ERROR_MARKS.filter(m => body.includes(m))

await loginTrial(s, 'student')

const results = []
async function step(name, action) {
  if (action) await action()
  const body = await bodyOf()
  const errs = errorShown(body)
  const row = {
    단계: name,
    오류화면: errs,
    화면머리: (body.split('\n').map(l => l.trim()).find(l => l.length > 1) || '').slice(0, 60),
    콘솔오류: s.logs.console.filter(c => c.type === 'error').length,
    페이지오류: s.logs.pageErrors.length,
    실패요청: s.logs.requests.filter(r => r.status >= 400).length,
  }
  results.push(row)
  await s.shot(`regress-4814/${vpKey}-${results.length.toString().padStart(2, '0')}-${name}.png`).catch(() => {})
  console.log(`${errs.length ? '✘' : '✔'} ${name} — ${row.화면머리} (콘솔 ${row.콘솔오류} / 페이지 ${row.페이지오류} / 실패요청 ${row.실패요청})`)
  return body
}

await step('00-홈')

// R1 — 6개 학습관 첫 진입
const CAMPUSES = ['교육부 직업공통능력관', 'NCS 직업기초능력관', '채용필기 심화관', '인성검사훈련관', '자기소개서관', '면접 스킬관']
for (const c of CAMPUSES) {
  await s.page.goto(APP, { waitUntil: 'domcontentloaded' })
  await s.page.waitForTimeout(6000)
  const r = await tapVisible(s.page, c, 4200)
  await step(`01-${c}`, null)
  if (!r.ok) console.log(`   (진입 실패: ${c})`)
}

// R2 — 학습 시작까지
await s.page.goto(APP, { waitUntil: 'domcontentloaded' })
await s.page.waitForTimeout(6000)
await tapVisible(s.page, '바로 시작', 4200)
await step('02-학습진입')
await tapVisible(s.page, '학습 시작', 3600)
await step('03-학습시작')
await s.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')]
    .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
  el?.click()
})
await s.page.waitForTimeout(1200)
await tapVisible(s.page, '^다음', 2600)
await step('04-문항진행')

// 하단 탭도 한 바퀴 — 메뉴마다 오류가 났다는 신고였다
for (const tab of ['탐험', '성장', '소식', '나', '홈']) {
  await tapVisible(s.page, `^${tab}$`, 3000)
  await step(`05-탭-${tab}`)
}

// R3 — 학습 위치 신고 본문
const 위치본문 = pings.map(p => p.body?.p_context ?? p.body)
const 라벨들 = 위치본문.map(c => (c && typeof c === 'object') ? c.label : null).filter(Boolean)

save(`regress-4814/${vpKey}-regression.json`, {
  _meta: {
    기준선: '4.8.14 / build 29804584 / commit b7c1b26',
    웹엔트리: 'assets/index-DzsLqKW4.js',
    목적: '코덱스 수정분의 회귀 확인. 앱은 수정하지 않는다.',
  },
  단계별: results,
  학습위치신고: { 건수: pings.length, 본문: 위치본문.slice(0, 20) },
  콘솔: s.logs.console.slice(-30),
  페이지오류: s.logs.pageErrors,
  실패요청: s.logs.requests.filter(r => r.status >= 400).slice(0, 20),
  보이는조작_마지막화면: await visibleControls(s.page),
})

console.log('\n=== 요약 ===')
console.log('오류 화면이 뜬 단계:', results.filter(r => r.오류화면.length).map(r => r.단계).join(', ') || '없음')
console.log('학습 위치 신고 건수:', pings.length, '· 라벨:', JSON.stringify([...new Set(라벨들)]).slice(0, 300))
console.log('콘솔 오류:', s.logs.console.filter(c => c.type === 'error').length,
  '· 페이지 오류:', s.logs.pageErrors.length,
  '· 실패 요청:', s.logs.requests.filter(r => r.status >= 400).length)
await s.close()
