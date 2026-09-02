// 검증 전용 학급 만들기 — 교사 계정의 실제 기능(학급 생성·학생 승인)을 그대로 쓴다.
//
// 왜 필요한가: 시험 교사(한국특성화고)와 시험 학생(경주여자정보고)이 서로 다른 학교라
// 같은 학급이 없다. 수업·미션·메시지 검증은 같은 학급이 있어야 한다.
// 실제 학교의 학급에는 쓰지 않고, 교사 학교 안에 검증 전용 학급을 새로 만든다.
//
// 이 과정 자체가 검증 항목이다 — 교사의 학급 생성과 학생 승인이 실제로 되는지 본다.
// 자격정보는 .env.local 에서 읽기만 하고 값은 남기지 않는다.
//
// 실행: node verification/adversarial-4.8.13/tools/provision-verify-class.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const URL_ = get('VITE_SUPABASE_URL'), ANON = get('VITE_SUPABASE_ANON_KEY'), PW = get('DEMO_PASSWORD')
const mk = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

const 기록 = { _meta: { baseline: '9797477fe73a (4.8.14)', 목적: '검증 전용 학급 확보 + 교사 기능 검증' }, 단계: [] }
const step = (이름, ok, 상세) => {
  기록.단계.push({ 단계: 이름, 결과: ok ? 'PASS' : 'FAIL', ...상세 })
  console.log(`${ok ? '✔' : '✘'} ${이름}${상세?.메모 ? ' — ' + 상세.메모 : ''}`)
}

// ── 교사: 학급 생성 ───────────────────────────────────────────────────────
const teacher = mk()
const { data: tIn, error: tErr } = await teacher.auth.signInWithPassword({ email: get('DEMO_TEACHER_EMAIL'), password: PW })
step('교사 로그인', !tErr, { 메모: tErr ? String(tErr.message).slice(0, 60) : null })
if (tErr) process.exit(1)

const { data: 학급, error: cErr } = await teacher.rpc('rpc_create_class', {
  p_name: '[검증]전용학급', p_grade: 3, p_academic_year: new Date().getFullYear(),
})
step('교사 학급 생성(rpc_create_class)', !cErr, {
  메모: cErr ? String(cErr.message).slice(0, 80) : `코드 ${학급?.class_code}`,
  class_id: 학급?.class_id ?? null, class_code: 학급?.class_code ?? null,
})
if (cErr) {
  기록.중단 = '학급 생성 실패로 이후 단계 미실행'
  mkdirSync('verification/adversarial-4.8.13/evidence/flows', { recursive: true })
  writeFileSync('verification/adversarial-4.8.13/evidence/flows/provision.json', JSON.stringify(기록, null, 1) + '\n')
  process.exit(1)
}

// ── 학생: 학급 참여 ───────────────────────────────────────────────────────
const student = mk()
const { data: sIn, error: sErr } = await student.auth.signInWithPassword({ email: get('DEMO_STUDENT_EMAIL'), password: PW })
step('학생 로그인', !sErr, { 메모: sErr ? String(sErr.message).slice(0, 60) : null })

const { error: jErr } = await student.rpc('rpc_student_join', {
  p_display_name: '[검증]학생', p_nickname: '검증학생', p_class_id: 학급.class_id,
})
step('학생 학급 참여(rpc_student_join)', !jErr, { 메모: jErr ? String(jErr.message).slice(0, 80) : '참여 요청 완료' })

// ── 교사: 학생 승인 ───────────────────────────────────────────────────────
const { data: 대기, error: pErr } = await teacher.from('student_classes')
  .select('student_id, class_id').eq('class_id', 학급.class_id)
step('교사가 학급 명단 조회', !pErr, { 인원: (대기 || []).length })

let 승인결과 = null
if ((대기 || []).length) {
  const { error: aErr } = await teacher.rpc('rpc_approve_student', { p_student: 대기[0].student_id })
  승인결과 = aErr ? String(aErr.message).slice(0, 80) : '승인 완료'
  step('교사가 학생 승인(rpc_approve_student)', !aErr, { 메모: 승인결과 })
}

// ── 확인: 두 계정이 같은 학급을 공유하는가 ────────────────────────────────
const { data: tc } = await teacher.from('teacher_classes').select('class_id').eq('teacher_id', tIn.user.id)
const { data: sc } = await student.from('student_classes').select('class_id').eq('student_id', sIn.user.id)
const 공유 = (tc || []).some(t => (sc || []).some(s => s.class_id === t.class_id))
step('교사·학생이 같은 학급 공유', 공유, {
  교사학급수: (tc || []).length, 학생학급수: (sc || []).length, 공유학급: 학급.class_id,
})

기록.학급 = { class_id: 학급.class_id, class_code: 학급.class_code, 이름: '[검증]전용학급' }
mkdirSync('verification/adversarial-4.8.13/evidence/flows', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/flows/provision.json', JSON.stringify(기록, null, 1) + '\n')
console.log('\n검증 전용 학급:', 학급.class_code, '| 공유 성립:', 공유)
