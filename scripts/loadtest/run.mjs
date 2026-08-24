/**
 * 설탕과소금 부하 테스트 하네스.
 *
 * ── 왜 만드나 ──────────────────────────────────────────────────────
 * "수만 명이 동시에 들어와도 괜찮은가"는 추정으로 답할 수 없다. RLS 를
 * 최적화하고 왕복을 90회에서 2회로 줄였지만, 그게 실제로 몇 명까지
 * 버티는지는 걸어 봐야 안다.
 *
 * ── 무엇을 재나 ────────────────────────────────────────────────────
 * 앱이 실제로 던지는 요청만 던진다(scenarios.mjs 에 출처를 적어 두었다).
 * 엔드포인트별로 p50/p95/p99·초당 처리량·오류율을 낸다. 429(속도 제한)와
 * 5xx 는 따로 세어 둔다 — 그 둘이 나타나는 지점이 곧 한계다.
 *
 * ── 주의 ───────────────────────────────────────────────────────────
 * 기본값은 **읽기 전용**이다. 쓰기 시나리오(--write)는 review_schedule 에
 * 실제로 행을 남기므로 운영 DB 에서는 함부로 켜지 않는다. 켤 때는
 * subject='loadtest' 로 표시되니 나중에 지울 수 있다.
 *
 * 계정을 새로 만들지 않는다. 이미 있는 계정의 토큰을 파일로 받는다.
 *
 * ── 사용법 ─────────────────────────────────────────────────────────
 *   node scripts/loadtest/run.mjs --tokens tokens.txt --vus 50 --duration 30
 *   node scripts/loadtest/run.mjs --tokens tokens.txt --vus 200 --duration 60 --write
 *
 *   tokens.txt : 한 줄에 access_token 하나. 여러 개면 가상 사용자마다
 *                돌아가며 쓴다(RLS 가 사용자마다 다른 행을 보게 하려면
 *                토큰이 여럿이어야 실제에 가깝다).
 */
import { readFileSync } from 'node:fs'
import { Agent, setGlobalDispatcher } from 'undici'
import { ALL, READ_ONLY, LOCAL_FIRST } from './scenarios.mjs'


// ── 인자 ───────────────────────────────────────────────────────────
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k)
  return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1])
}
const has = (k) => process.argv.includes('--' + k)

// Node 의 fetch(undici)는 오리진당 동시 연결을 기본 128개로 묶는다. 가상
// 사용자를 그보다 많이 띄우면 **서버가 아니라 이 클라이언트가** 병목이 되고,
// 모든 엔드포인트의 지연이 똑같이 올라가 서버가 밀리는 것처럼 보인다.
// 실제로 400명 구간에서 그 착시가 나왔다. 측정 도구가 먼저 막히면 안 된다.
const CONNS = Number(arg('conns', 0)) || 1024
setGlobalDispatcher(new Agent({
  connections: CONNS,
  pipelining: 0,
  keepAliveTimeout: 30_000,
  connect: { timeout: 20_000 },
}))

const VUS       = Number(arg('vus', 20))
const DURATION  = Number(arg('duration', 20))          // 초
const RAMP      = Number(arg('ramp', 5))               // 초, 서서히 올린다
const TOKENFILE = arg('tokens', null)
const WRITE     = has('write')
const BASE_URL  = arg('url', null) || readEnv('VITE_SUPABASE_URL')
const ANON      = arg('anon', null) || readEnv('VITE_SUPABASE_ANON_KEY')

// 주의: 여기서 쓰는 URL 은 전역 생성자다. 위에서 const URL 로 받았다가
// 이 함수가 TDZ 에 걸려 조용히 null 을 돌려주는 일이 있었다.
function readEnv(key) {
  try {
    const txt = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    return txt.split('\n').find(l => l.startsWith(key + '='))?.slice(key.length + 1).trim()
  } catch { return null }
}

if (!BASE_URL || !ANON) {
  console.error('Supabase URL/anon key 를 찾지 못했습니다. --url --anon 으로 주세요.')
  process.exit(1)
}

const tokens = TOKENFILE
  ? readFileSync(TOKENFILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : []

if (!tokens.length) {
  console.error(
    '토큰이 없습니다. --tokens <파일> 로 주세요.\n' +
    '  로그인한 브라우저에서 다음을 실행해 얻습니다:\n' +
    "    Object.keys(localStorage).filter(k=>k.includes('auth-token'))\n" +
    "      .map(k=>JSON.parse(localStorage[k]).access_token).join('\\n')")
  process.exit(1)
}

// ── 토큰에서 사용자 id 를 꺼낸다(JWT payload, 서명 검증 아님) ──────
function uidOf(tok) {
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'))
    return p.sub
  } catch { return null }
}

const vusers = tokens.map(t => ({ token: t, uid: uidOf(t) })).filter(v => v.uid)
if (!vusers.length) { console.error('토큰에서 사용자 id 를 못 읽었습니다.'); process.exit(1) }

// ── 통계 ───────────────────────────────────────────────────────────
const stats = new Map()   // label -> {lat:[], ok, err, codes:Map}
function record(label, ms, status) {
  let s = stats.get(label)
  if (!s) { s = { lat: [], ok: 0, err: 0, codes: new Map() }; stats.set(label, s) }
  s.lat.push(ms)
  if (status >= 200 && status < 400) s.ok++; else s.err++
  s.codes.set(status, (s.codes.get(status) || 0) + 1)
}
const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0

// ── 한 번의 요청 ───────────────────────────────────────────────────
async function fire(step, ctx) {
  const path = typeof step.path === 'function' ? step.path(ctx) : step.path
  const body = typeof step.body === 'function' ? step.body(ctx) : step.body
  const t0 = performance.now()
  let status = 0
  try {
    const res = await fetch(BASE_URL + path, {
      method: step.method,
      headers: {
        apikey: ANON,
        Authorization: 'Bearer ' + ctx.token,
        'Content-Type': 'application/json',
        ...(step.headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    status = res.status
    await res.arrayBuffer()          // 본문을 끝까지 받아야 실제 지연이다
  } catch (e) {
    status = -1
  }
  record(step.label, performance.now() - t0, status)
  return status
}

// ── 시나리오 고르기 (가중치) ───────────────────────────────────────
// --local-first 로 새 구조를, 없으면 옛 구조를 잰다(비교용).
const pool = Object.values(has('local-first') ? LOCAL_FIRST : (WRITE ? ALL : READ_ONLY))
const total = pool.reduce((s, x) => s + x.weight, 0)
function pick() {
  let r = Math.random() * total
  for (const s of pool) { r -= s.weight; if (r <= 0) return s }
  return pool[pool.length - 1]
}

// ── 가상 사용자 한 명의 루프 ───────────────────────────────────────
let running = true
let iterations = 0

async function vu(i) {
  const who = vusers[i % vusers.length]
  while (running) {
    const sc = pick()
    const ctx = {
      token: who.token,
      uid: who.uid,
      // 채점 한 세트 = 문항 24개. 실제 세트 크기와 맞춘다.
      itemIds: Array.from({ length: 24 }, (_, k) => `loadtest-${i}-${k}`),
    }
    for (const step of sc.steps) {
      if (!running) break
      await fire(step, ctx)
    }
    iterations++
    // 사람은 쉬지 않고 누르지 않는다. 생각하는 시간을 둔다.
    await new Promise(r => setTimeout(r, 300 + Math.random() * 700))
  }
}

// ── 실행 ───────────────────────────────────────────────────────────
console.log(`대상   ${BASE_URL}`)
console.log(`가상사용자 ${VUS}명 · ${DURATION}초 · 램프업 ${RAMP}초 · 토큰 ${vusers.length}개`)
console.log(`모드   ${WRITE ? '읽기+쓰기 (review_schedule 에 subject=loadtest 로 기록)' : '읽기 전용'}`)
console.log('')

const started = Date.now()
const runners = []
for (let i = 0; i < VUS; i++) {
  const delay = (RAMP * 1000 * i) / VUS
  runners.push(new Promise(r => setTimeout(() => vu(i).then(r), delay)))
}

setTimeout(() => { running = false }, (DURATION + RAMP) * 1000)
await Promise.all(runners)

// ── 결과 ───────────────────────────────────────────────────────────
const secs = (Date.now() - started) / 1000
let reqs = 0, errs = 0
console.log('엔드포인트                     요청    오류    p50     p95     p99    최대')
console.log('─'.repeat(78))
for (const [label, s] of [...stats].sort((a, b) => b[1].lat.length - a[1].lat.length)) {
  reqs += s.lat.length; errs += s.err
  console.log(
    label.padEnd(28) +
    String(s.lat.length).padStart(7) +
    String(s.err).padStart(7) +
    (pct(s.lat, 0.50).toFixed(0) + 'ms').padStart(8) +
    (pct(s.lat, 0.95).toFixed(0) + 'ms').padStart(8) +
    (pct(s.lat, 0.99).toFixed(0) + 'ms').padStart(8) +
    (Math.max(...s.lat).toFixed(0) + 'ms').padStart(8))
  const bad = [...s.codes].filter(([c]) => c < 200 || c >= 400)
  if (bad.length) console.log('    응답코드 ' + bad.map(([c, n]) => `${c}×${n}`).join(' '))
}
console.log('─'.repeat(78))
console.log(`총 ${reqs}요청 · 오류 ${errs}건(${(errs / Math.max(1, reqs) * 100).toFixed(1)}%) · ` +
            `${(reqs / secs).toFixed(1)} req/s · 시나리오 ${iterations}회 · ${secs.toFixed(0)}초`)

const throttled = [...stats.values()].reduce((n, s) => n + (s.codes.get(429) || 0), 0)
const server5xx = [...stats.values()].reduce((n, s) =>
  n + [...s.codes].filter(([c]) => c >= 500).reduce((m, [, v]) => m + v, 0), 0)
if (throttled) console.log(`⚠ 429(속도 제한) ${throttled}건 — 여기가 한계입니다.`)
if (server5xx) console.log(`⚠ 5xx ${server5xx}건 — 서버가 밀리고 있습니다.`)
if (!throttled && !server5xx && errs === 0) console.log('오류 없음 — 이 부하는 여유 있게 처리했습니다.')
