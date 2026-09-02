// SYNC 경계 시험 — 의뢰서 9절의 정량 경계값을 서버에 직접 던져 본다.
//
//   기기상태 항목   399KB / 401KB   (서버 상한 400,000 bytes)
//   묶음 항목 수     249 / 251       (서버 상한 250개)
//   서버 묶음 크기   1.49MB / 1.51MB (서버 상한 1,500,000 bytes)
//   클라이언트 상한  400,000 / 1,200,000 (src/lib/deviceSync.js:26-27 — 서버보다 엄격)
//
// 쓰기는 시험 학생 계정 '자기 자신의' 기기상태 행에만 일어난다.
// 시험이 끝나면 같은 키를 빈 값으로 덮어 정리한다.
// 자격정보는 .env.local 에서 읽기만 하고 값은 남기지 않는다.
//
// 실행: node verification/adversarial-4.8.13/tools/sync-boundary.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const client = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

const { error: 로그인오류 } = await client.auth.signInWithPassword({
  email: get('DEMO_STUDENT_EMAIL'), password: get('DEMO_PASSWORD'),
})
if (로그인오류) { console.error('학생 로그인 실패'); process.exit(1) }

const KEY = k => `sst.verify.sync-boundary.${k}`
const 채움 = n => 'A'.repeat(n)
const 지금 = () => new Date().toISOString()
const 결과 = []
const 쓴키 = new Set()

async function 시험(이름, changes, 기대) {
  const { data, error } = await client.rpc('rpc_sync_user_device_state', {
    p_changes: changes, p_since: null, p_device_id: 'verify-boundary',
  })
  const 거부됨 = Boolean(error)
  const 판정 = (기대 === '거부') === 거부됨 ? 'PASS' : 'FAIL'
  if (!거부됨) changes.forEach(c => 쓴키.add(c.key))
  결과.push({
    시험: 이름, 기대, 실제: 거부됨 ? '거부' : '수락', 판정,
    서버메시지: error ? String(error.message).slice(0, 80) : null,
    반영항목수: data?.items?.length ?? null,
  })
  console.log(`${판정 === 'PASS' ? '✔' : '✘'} ${이름} — 기대 ${기대} / 실제 ${거부됨 ? '거부' : '수락'}${error ? ` (${String(error.message).slice(0, 40)})` : ''}`)
}

// ── 항목 크기 경계 ────────────────────────────────────────────────────────
await 시험('항목 399KB (상한 아래)', [{ key: KEY('item399'), value: 채움(399_000), updated_at: 지금() }], '수락')
await 시험('항목 401KB (상한 위)', [{ key: KEY('item401'), value: 채움(401_000), updated_at: 지금() }], '수락')
//   ↑ 서버는 큰 항목을 '거부'가 아니라 'continue' 로 건너뛴다. 수락 응답이 와도 저장은 안 될 수 있어 아래에서 확인한다.

// ── 묶음 항목 수 경계 ─────────────────────────────────────────────────────
const 항목들 = n => Array.from({ length: n }, (_, i) => ({ key: KEY(`bulk${n}-${i}`), value: `v${i}`, updated_at: 지금() }))
await 시험('묶음 249항목 (상한 아래)', 항목들(249), '수락')
await 시험('묶음 251항목 (상한 위)', 항목들(251), '거부')

// ── 묶음 크기 경계 ────────────────────────────────────────────────────────
const 묶음 = bytes => {
  const 조각 = Math.floor(bytes / 4)
  return [
    { key: KEY('payloadA'), value: 채움(조각), updated_at: 지금() },
    { key: KEY('payloadB'), value: 채움(조각), updated_at: 지금() },
    { key: KEY('payloadC'), value: 채움(조각), updated_at: 지금() },
    { key: KEY('payloadD'), value: 채움(조각), updated_at: 지금() },
  ]
}
await 시험('서버 묶음 1.49MB (상한 아래)', 묶음(1_490_000), '수락')
await 시험('서버 묶음 1.51MB (상한 위)', 묶음(1_510_000), '거부')

// ── 큰 항목이 실제로 저장됐는지 확인 ──────────────────────────────────────
const { data: 저장본, error: 조회오류 } = await client.from('user_device_state')
  .select('storage_key, length(value_text)').in('storage_key', [KEY('item399'), KEY('item401')])
const 저장 = {}
if (!조회오류) for (const r of 저장본 || []) 저장[r.storage_key] = r.length ?? r['length']
결과.push({
  시험: '큰 항목의 실제 저장 여부',
  '399KB 저장됨': Object.keys(저장).includes(KEY('item399')),
  '401KB 저장됨': Object.keys(저장).includes(KEY('item401')),
  조회오류: 조회오류 ? String(조회오류.message).slice(0, 80) : null,
})
console.log(`\n저장 확인 — 399KB: ${Object.keys(저장).includes(KEY('item399'))} · 401KB: ${Object.keys(저장).includes(KEY('item401'))}`)

// ── 정리 — 시험이 남긴 값을 비운다 ────────────────────────────────────────
const 정리 = [...쓴키].map(k => ({ key: k, value: '', deleted: true, updated_at: 지금() }))
let 정리결과 = '없음'
for (let i = 0; i < 정리.length; i += 200) {
  const { error } = await client.rpc('rpc_sync_user_device_state', {
    p_changes: 정리.slice(i, i + 200), p_since: null, p_device_id: 'verify-cleanup',
  })
  정리결과 = error ? `일부 실패: ${String(error.message).slice(0, 60)}` : `${정리.length}개 비움`
}
console.log('정리:', 정리결과)

mkdirSync('verification/adversarial-4.8.13/evidence/sync', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/sync/boundary.json',
  JSON.stringify({
    _meta: {
      baseline: '9797477fe73a (4.8.14)',
      서버상한: { 항목바이트: 400000, 묶음항목수: 250, 묶음바이트: 1500000 },
      클라이언트상한: { 항목바이트: 400000, 묶음바이트: 1200000, 출처: 'src/lib/deviceSync.js:26-27' },
      정리: 정리결과,
    },
    결과,
  }, null, 1) + '\n')
await client.auth.signOut({ scope: 'local' }).catch(() => {})
