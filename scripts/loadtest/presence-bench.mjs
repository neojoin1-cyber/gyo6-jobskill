/**
 * 참여 신호 부하 측정.
 *
 * 재는 것 — rpc_presence_ping 한 번의 실제 왕복 비용과 초당 처리량.
 * 토큰이 하나뿐이라 「서로 다른 3만 명」을 그대로 흉내 낼 수는 없다.
 * 대신 **모든 요청이 반드시 거치는 부분**을 잰다.
 *   인증 검사 · 세션 유효성 조회(class_sessions × student_classes) · 응답
 * 이 부분이 비용의 대부분이고, 마지막 upsert 는 기본키가 잡힌 작은 행
 * 하나라 상대적으로 싸다.
 */
import { Agent, request } from 'undici'
import fs from 'node:fs'

const TOKEN = fs.readFileSync('scripts/loadtest/.token', 'utf8').trim()
const BASE  = 'https://eniyjdmtbunvizrsomrp.supabase.co'
const ANON  = process.env.ANON
const args  = Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:[]).filter(Boolean))
const VUS   = Number(args.vus ?? 50)
const SECS  = Number(args.duration ?? 15)
const PATH  = args.path ?? '/rest/v1/rpc/rpc_presence_ping'
const BODY  = args.body ? JSON.parse(args.body) : { p_session_id: '00000000-0000-0000-0000-000000000000', p_state: 'active' }

const ALT = process.argv.includes('--alt')
let flip = false
const agent = new Agent({ connections: Math.max(VUS, 64) })
const lat = []; let ok = 0, err = 0, codes = {}
const until = Date.now() + SECS * 1000

async function vu() {
  while (Date.now() < until) {
    const t = performance.now()
    try {
      // --alt 를 주면 상태를 번갈아 보낸다. 30초 중복 억제를 매번 뚫으므로
      // **항상 실제로 쓰는** 최악의 경로가 된다. 실사용에서는 이렇게까지
      // 자주 상태가 바뀌지 않는다.
      const body = ALT ? { ...BODY, p_state: (flip = !flip) ? 'active' : 'away' } : BODY
      const r = await request(BASE + PATH, {
        method: 'POST', dispatcher: agent,
        headers: { apikey: ANON, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      await r.body.text()
      codes[r.statusCode] = (codes[r.statusCode] ?? 0) + 1
      r.statusCode < 400 ? ok++ : err++
    } catch { err++ }
    lat.push(performance.now() - t)
  }
}

await Promise.all(Array.from({ length: VUS }, vu))
lat.sort((a,b)=>a-b)
const p = q => Math.round(lat[Math.floor(lat.length*q)] ?? 0)
console.log(JSON.stringify({
  vus: VUS, seconds: SECS, path: PATH,
  'req/s': Math.round((ok+err)/SECS), ok, err, codes,
  p50: p(0.5), p95: p(0.95), p99: p(0.99), max: Math.round(lat.at(-1) ?? 0),
}, null, 1))
