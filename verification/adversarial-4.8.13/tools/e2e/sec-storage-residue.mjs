// SEC-06 / SEC-09 / SEC-10 — 체험 종료 뒤 무엇이 남는가, 무엇이 새는가.
//
// SEC-06 체험 종료 후 local/session/IndexedDB/cache 에 개인 작성물·인증 흔적이 남는가
// SEC-09 오류 화면·네트워크 응답·콘솔에 PII/SQL/키가 드러나는가
// SEC-10 같은 브라우저에서 계정을 바꾼 뒤 이전 사용자 자료에 앱 경로로 접근되는가
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/sec-storage-residue.mjs

import { openSession, loginTrial, tapVisible, save, mask, APP } from './lib/harness.mjs'

const report = { _meta: { baseline: 'ee6aee89abf8', 대상: APP } }

// 값 자체는 남기지 않는다. 무엇이 들어 있었는지만 분류해 적는다.
const CLASSIFY = [
  ['인증토큰', /eyJ[A-Za-z0-9_-]{10,}\./],
  ['이메일', /[\w.+-]+@[\w-]+\.[\w.]{2,}/],
  ['UUID', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
  ['이름형태', /"(name|nickname|full_name|student_name)"\s*:/],
  ['학습기록', /(wrong|answer|submission|progress|score|attempt)/i],
  ['작성본', /(cover_letter|draft|essay|자기소개|작성)/i],
]
const classify = obj => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => {
  const s = String(v)
  return [k, { 길이: s.length, 포함: CLASSIFY.filter(([, re]) => re.test(s)).map(([n]) => n) }]
}))

const s = await openSession({ viewport: { width: 390, height: 844 } })

// 응답 본문에서 민감정보가 새는지 본다(SEC-09).
const leaky = []
s.page.on('response', async res => {
  const url = res.url()
  if (!/supabase|gyo6\.kr/.test(url)) return
  if (!/rest\/v1|auth\/v1|rpc/.test(url)) return
  let body = ''
  try { body = (await res.text()).slice(0, 4000) } catch { return }
  const hits = []
  if (/(SELECT|INSERT|UPDATE|DELETE)\s+(FROM|INTO|SET)/i.test(body)) hits.push('SQL문')
  if (/(pg_|relation ".*" does not exist|syntax error at or near)/i.test(body)) hits.push('DB내부오류')
  if (/service_role|secret|private_key/i.test(body)) hits.push('키단어')
  if (res.status() >= 400) hits.push(`HTTP${res.status()}`)
  if (hits.length) leaky.push({ url: mask(url).slice(0, 140), status: res.status(), hits, sample: mask(body).slice(0, 200) })
})

// ── 1. 학생 체험으로 흔적을 만든다 ─────────────────────────────────────────
await loginTrial(s, 'student')
await tapVisible(s.page, '바로 시작', 4200)
await tapVisible(s.page, '학습 시작', 3200)
await s.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')]
    .find(e => /^([A-E]\s|[1-5][.)]\s|[①-⑤])/.test((e.innerText || '').trim()))
  el?.click()
})
await s.page.waitForTimeout(1200)
await tapVisible(s.page, '다음', 2400)

const during = await s.dumpStorage()
report['1_체험중_저장소'] = {
  localStorage: classify(during.localStorage),
  sessionStorage: classify(during.sessionStorage),
  indexedDB: during.indexedDB,
  caches: during.caches,
  쿠키유무: Boolean(during.cookies),
}
await s.shot('sec/01-during-trial.png').catch(() => {})

// ── 2. 체험 종료 ───────────────────────────────────────────────────────────
const ended = await s.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')]
    .find(e => (e.getAttribute('aria-label') || '') === '체험 종료' || (e.innerText || '').trim() === '×')
  el?.click(); return Boolean(el)
})
await s.page.waitForTimeout(4000)
// 확인 대화가 있으면 눌러 준다
for (const label of ['종료', '확인', '나가기', '체험 종료']) {
  const r = await tapVisible(s.page, `^${label}$`, 2200)
  if (r.ok) break
}
await s.page.waitForTimeout(3000)
await s.shot('sec/02-after-exit.png').catch(() => {})

const after = await s.dumpStorage()
report['2_체험종료후_저장소'] = {
  종료버튼눌림: ended,
  localStorage: classify(after.localStorage),
  sessionStorage: classify(after.sessionStorage),
  indexedDB: after.indexedDB,
  caches: after.caches,
  쿠키유무: Boolean(after.cookies),
  남은키: Object.keys(after.localStorage),
  사라진키: Object.keys(during.localStorage).filter(k => !(k in after.localStorage)),
}

// ── 3. 종료 후 앱 주소로 바로 들어가면 무엇이 보이는가 (SEC-06/10) ────────
await s.page.goto(APP, { waitUntil: 'domcontentloaded' })
await s.page.waitForTimeout(8000)
const body = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
await s.shot('sec/03-direct-after-exit.png').catch(() => {})
report['3_종료후_앱직접진입'] = {
  로그인화면인가: /로그인|이메일|비밀번호|체험/.test(body.slice(0, 400)),
  학습화면인가: /학습관|오늘 학습|내 학습/.test(body.slice(0, 800)),
  본문: mask(body).slice(0, 600),
  저장소: classify((await s.dumpStorage()).localStorage),
}

// ── 4. 같은 브라우저에서 다른 역할로 로그인 (공용 PC 가정, SEC-10) ────────
await loginTrial(s, 'teacher')
const teacherBody = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
const teacherStore = await s.dumpStorage()
await s.shot('sec/04-role-switch.png').catch(() => {})
report['4_계정전환후'] = {
  현재화면: /TEACHER|학급|수업/.test(teacherBody) ? '교사 화면' : '알 수 없음',
  이전학생흔적_남은키: Object.keys(teacherStore.localStorage).filter(k => Object.keys(during.localStorage).includes(k)),
  저장소: classify(teacherStore.localStorage),
}

report['5_네트워크_민감정보'] = {
  의심응답수: leaky.length,
  목록: leaky.slice(0, 15),
}
report['6_콘솔'] = {
  오류: s.logs.console.filter(c => c.type === 'error').slice(0, 10),
  경고: s.logs.console.filter(c => c.type === 'warning').slice(0, 5),
  페이지오류: s.logs.pageErrors.slice(0, 5),
}

save('sec/storage-residue.json', report)
console.log(JSON.stringify({
  체험중_키: Object.keys(during.localStorage).length,
  종료후_키: Object.keys(after.localStorage).length,
  종료후_남은키: Object.keys(after.localStorage),
  종료후_토큰남음: Object.values(report['2_체험종료후_저장소'].localStorage).some(v => v.포함.includes('인증토큰')),
  종료후_앱직접진입: report['3_종료후_앱직접진입'].로그인화면인가 ? '로그인/체험 화면' : '학습 화면 노출',
  계정전환후_이전키잔존: report['4_계정전환후'].이전학생흔적_남은키,
  민감응답: leaky.length,
  콘솔오류: s.logs.console.filter(c => c.type === 'error').length,
}, null, 1))
await s.close()
