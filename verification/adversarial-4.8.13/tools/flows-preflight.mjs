// 정식 계정 사전 점검 — 검증에 쓸 수 있는 상태인지 먼저 본다.
//
// 자격정보는 .env.local 에서 읽기만 하고, 화면·증거·로그 어디에도 값을 남기지 않는다.
// (소유자가 직접 넣은 값이며, 이 스크립트는 이메일을 마스킹해 출력한다)
//
// 실행: node verification/adversarial-4.8.13/tools/flows-preflight.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const url = process.env.VITE_SUPABASE_URL || get('VITE_SUPABASE_URL')
const anon = process.env.VITE_SUPABASE_ANON_KEY || get('VITE_SUPABASE_ANON_KEY')
const password = process.env.DEMO_PASSWORD || get('DEMO_PASSWORD')

const 역할별 = {
  teacher: get('DEMO_TEACHER_EMAIL'),
  student: get('DEMO_STUDENT_EMAIL'),
}

const mask = s => (s ? String(s).replace(/^(.).*(@.*)$/, '$1***$2').replace(/@(.).*/, '@$1***') : '(없음)')
const 결과 = { _meta: { baseline: '9797477fe73a (4.8.14)', 주의: '자격정보 값은 기록하지 않는다' }, 계정: [] }

for (const [이름, email] of Object.entries(역할별)) {
  const row = { 지정역할: 이름, 이메일: mask(email) }
  if (!email || !password) { row.상태 = '자격정보 없음'; 결과.계정.push(row); continue }

  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    row.상태 = '로그인 실패'
    row.사유 = String(error.message).slice(0, 120)
    결과.계정.push(row)
    continue
  }
  row.상태 = '로그인 성공'

  const { data: profile, error: pErr } = await client.from('profiles')
    .select('role, approved, school_id, display_name, nickname').eq('id', data.user.id).maybeSingle()
  row.프로필조회 = pErr ? `오류: ${pErr.message.slice(0, 80)}` : Boolean(profile)
  if (profile) {
    row.실제역할 = profile.role
    row.승인됨 = profile.approved
    row.학교연결 = Boolean(profile.school_id)
    row.이름있음 = Boolean(profile.display_name)
    row.닉네임있음 = Boolean(profile.nickname)
  }

  // 학급 연결 — 학생은 student_classes, 교사는 teacher_classes
  const 표 = 이름 === 'student' ? 'student_classes' : 'teacher_classes'
  const 키 = 이름 === 'student' ? 'student_id' : 'teacher_id'
  const { data: 학급, error: cErr } = await client.from(표).select('class_id').eq(키, data.user.id)
  row.학급수 = cErr ? `오류: ${cErr.message.slice(0, 60)}` : (학급 || []).length

  // 부트스트랩 — 앱이 첫 화면에서 호출하는 것
  const { data: boot, error: bErr } = await client.rpc('rpc_bootstrap')
  row.부트스트랩 = bErr ? `오류: ${bErr.message.slice(0, 80)}` : Object.keys(boot || {}).sort().slice(0, 12)

  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  결과.계정.push(row)
}

mkdirSync('verification/adversarial-4.8.13/evidence/flows', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/flows/preflight.json', JSON.stringify(결과, null, 1) + '\n')
console.log(JSON.stringify(결과, null, 1))
