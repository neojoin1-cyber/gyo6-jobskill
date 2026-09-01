// 학생 여정 — 체험 학생 계정 하나로 연속 수행하며 각 단계의 관측을 남긴다.
// 각 단계에서 묻는다: "정답 번호만 외워도 다음 단계로 갈 수 있는가."
//
// 체험 진입은 앱을 iframe 으로 띄우므로 모든 조작은 앱 프레임에서 한다.
// 실행: node verification/adversarial-4.8.13/tools/e2e/journey-student.mjs [뷰포트키]

import { openSession, appFrame, save, mask, TRIAL_PAGE, VIEWPORTS } from './lib/harness.mjs'

const vpKey = process.argv[2] || '390x844'
const s = await openSession({ viewport: VIEWPORTS[vpKey] ?? VIEWPORTS['390x844'] })
const steps = []
const t0 = Date.now()
const now = () => Date.now() - t0

let frame = null
const text = async () => (await frame.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')

async function record(step, note = {}) {
  const body = await text().catch(() => '')
  const shot = `journey/${vpKey}/${String(steps.length).padStart(2, '0')}-${step}.png`
  await s.shot(shot).catch(() => {})
  const entry = {
    step, atMs: now(), shot,
    heading: (body.split('\n').map(l => l.trim()).find(l => l.length > 1) || '').slice(0, 80),
    bodyChars: body.length,
    bodyPreview: mask(body).slice(0, 1200),
    consoleErrors: s.logs.console.filter(c => c.type === 'error').length,
    pageErrors: s.logs.pageErrors.length,
    failedRequests: s.logs.requests.filter(r => r.status >= 400).length,
    ...note,
  }
  steps.push(entry)
  console.log(`[${String(steps.length).padStart(2, '0')}] ${step} — ${entry.heading} (${entry.bodyChars}자, err ${entry.consoleErrors}/${entry.pageErrors}/${entry.failedRequests})`)
  return body
}

// 화면 글자로 누른다. 사용자가 실제로 보는 것만 근거로 삼는다.
async function tap(label, { exact = false, nth = 0, waitMs = 2200 } = {}) {
  const loc = frame.getByText(label, { exact })
  const count = await loc.count().catch(() => 0)
  if (!count) return { ok: false, reason: 'not-found', label }
  const target = loc.nth(Math.min(nth, count - 1))
  await target.scrollIntoViewIfNeeded().catch(() => {})
  let ok = true
  await target.click({ timeout: 8000 }).catch(async () => {
    await target.click({ force: true, timeout: 5000 }).catch(() => { ok = false })
  })
  await s.page.waitForTimeout(waitMs)
  frame = appFrame(s.page)
  return { ok, label, matches: count }
}

async function questionState() {
  return frame.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role=button], li, label')]
    const isChoice = el => {
      const t = (el.innerText || '').trim()
      // 화면 표기는 'A 교환용 제품을…' · '1) …' · '① …' 세 가지가 모두 쓰인다.
      return /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test(t) && t.length < 300
    }
    const choices = btns.filter(isChoice)
    const all = [...document.querySelectorAll('button')]
    return {
      choiceCount: choices.length,
      choiceTexts: choices.slice(0, 6).map(b => (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 70)),
      hasConfirm: all.some(b => /확인|정답 확인|제출/.test(b.innerText || '')),
      hasNext: all.some(b => /다음|계속|이어/.test(b.innerText || '')),
      buttons: all.slice(0, 25).map(b => (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean),
      hasExplanation: /해설|풀이|정답은|근거/.test(document.body.innerText || ''),
    }
  })
}

// ── 진입 ───────────────────────────────────────────────────────────────────
await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(2000)
await s.page.locator('[data-trial="student"]').first().click()
await s.page.waitForTimeout(10000)
frame = appFrame(s.page)
if (!frame.url().includes('/apps/sugar-salt')) {
  console.error('앱 프레임을 찾지 못했다:', s.page.frames().map(f => f.url()))
  await s.close()
  process.exit(1)
}
const home = await record('01-홈', { 비고: '체험 학생 진입(정식 가입은 학급 코드 필요 — 계정 대기)' })

// ── 6개 학습관 ─────────────────────────────────────────────────────────────
const CAMPUSES = ['교육부 직업공통능력관', 'NCS 직업기초능력관', '채용필기 심화관', '인성검사훈련관', '자기소개서관', '면접 스킬관']
await record('02-학습관목록', {
  화면에보인학습관: CAMPUSES.filter(c => home.includes(c)),
  안보인학습관: CAMPUSES.filter(c => !home.includes(c)),
})

// ── 학습 시작 → 문항 ───────────────────────────────────────────────────────
await tap('바로 시작', { waitMs: 4500 })
await record('03-학습진입')
await tap('학습 시작', { waitMs: 3500 })
let q = await questionState()
await record('04-문항화면', { 문항상태: q })

if (q.choiceCount === 0) {
  // 한 번 더 진행 버튼을 눌러 본다(안내 카드가 앞에 있는 경우)
  for (const label of ['학습 시작', '다음', '시작', '문제 풀기']) {
    if (q.choiceCount > 0) break
    await tap(label, { waitMs: 2500 })
    q = await questionState()
  }
  await record('04b-문항재탐색', { 문항상태: q })
}

if (q.choiceCount > 0) {
  await frame.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role=button], li, label')]
      .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
    el?.click()
  })
  await s.page.waitForTimeout(1000)
  await record('05-보기선택', { 문항상태: await questionState() })
  await tap('확인', { waitMs: 2500 })
  const after = await record('06-정오피드백', { 문항상태: await questionState() })
  await record('07-학습판정', {
    관측_정답외우기만으로충분한가: {
      해설이보이는가: /해설|풀이|근거/.test(after),
      근거·과정을묻는가: /왜|근거를 고르|이유를 고르|과정을|서술/.test(after),
      다음이동버튼: (await questionState()).hasNext,
    },
  })
}

// ── 장면을 이어 가며 학습 구조를 관측한다 ─────────────────────────────────
const scenes = []
for (let i = 0; i < 6; i++) {
  const st = await questionState()
  const body = await text()
  const scene = (body.match(/장면\s*(\d+)\s*\/\s*(\d+)/) || [])[0] || null
  scenes.push({
    i, scene,
    보기수: st.choiceCount,
    확인버튼: st.hasConfirm,
    다음버튼: st.hasNext,
    해설·근거문구: /해설|근거|판단 기준|의미·효과/.test(body),
    자기설명요구: /근거를 설명|왜 그런지|이유를 적|서술|직접 작성/.test(body),
  })
  if (st.choiceCount > 0) {
    await frame.evaluate(() => {
      const el = [...document.querySelectorAll('button, [role=button], li, label')]
        .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
      el?.click()
    })
    await s.page.waitForTimeout(700)
  }
  const moved = await tap('확인', { waitMs: 2200 })
  if (!moved.ok) await tap('다음', { waitMs: 2200 })
}
await record('07b-장면흐름', { 장면관측: scenes })

// ── 탭 순회 ────────────────────────────────────────────────────────────────
for (const tab of ['탐험', '성장', '소식', '나']) {
  const r = await tap(tab, { exact: true, waitMs: 3000 })
  await record(`08-탭-${tab}`, { 탭이동: r })
}

// ── 오답노트 ───────────────────────────────────────────────────────────────
await tap('성장', { exact: true, waitMs: 2500 })
const growth = await text()
const wrongLabel = ['오답노트', '오답', '틀린 문제', '복습'].find(l => growth.includes(l))
if (wrongLabel) await tap(wrongLabel, { waitMs: 3000 })
await record('09-오답노트', { 찾은라벨: wrongLabel ?? null })

// ── 학습관별 진입 ──────────────────────────────────────────────────────────
for (const [name, label] of [['자기소개서', '자기소개서관'], ['면접', '면접 스킬관'], ['채용필기', '채용필기 심화관'], ['인성검사', '인성검사훈련관']]) {
  await tap('홈', { exact: true, waitMs: 1800 })
  const r = await tap(label, { waitMs: 3500 })
  await record(`10-${name}`, { 진입: r })
}

// ── 재접속 ─────────────────────────────────────────────────────────────────
const before = await s.dumpStorage()
await s.page.reload({ waitUntil: 'domcontentloaded' })
await s.page.waitForTimeout(9000)
frame = appFrame(s.page)
const afterBody = await record('11-재접속')
const after = await s.dumpStorage()
await record('12-재접속상태', {
  로그인이유지되는가: !/로그인하세요|이메일.*비밀번호/.test(afterBody.slice(0, 600)),
  저장키수_전: Object.keys(before.localStorage).length,
  저장키수_후: Object.keys(after.localStorage).length,
})

save(`journey/${vpKey}/journey.json`, {
  _meta: { baseline: 'ee6aee89abf8', viewport: vpKey, startedAt: new Date().toISOString(), durationMs: now() },
  steps,
  storageAfter: mask(after),
  console: s.logs.console.slice(-50),
  pageErrors: s.logs.pageErrors,
  failedRequests: s.logs.requests.filter(r => r.status >= 400),
})

console.log('\n총 단계', steps.length,
  '· 콘솔 오류', s.logs.console.filter(c => c.type === 'error').length,
  '· 페이지 오류', s.logs.pageErrors.length,
  '· 실패 요청', s.logs.requests.filter(r => r.status >= 400).length)
await s.close()
