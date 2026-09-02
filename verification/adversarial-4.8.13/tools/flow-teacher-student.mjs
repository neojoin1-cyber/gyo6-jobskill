// 교사·학생 왕복 — 체험 토큰 모드에서 실행되지 않던 쓰기 계열 흐름을 실계정으로 확인한다.
//
//  F1 수업 시작 → 문항 위치 발행 → 학생 따라가기
//  F2 학생 접속 신고 → 교사 화면에 보이는가 (수업 presence)
//  F3 자율학습 위치 신고 → 교사 화면의 '현재 학습 중' (LIMIT-001)
//  F4 진도 동기화 → 교사 화면 반영
//  F5 오답 누적(1회·2회) → 반복 오답 카운트
//  F6 메시지 왕복(교사 → 학생 → 답장 → 교사 수신함)
//  F7 SEC-02 학생 토큰으로 남의 자료 접근 차단
//
// 쓰기는 [검증]전용학급과 시험 계정 자기 자료에만 일어나고, 끝나면 수업을 종료한다.
// 실행: node verification/adversarial-4.8.13/tools/flow-teacher-student.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const CLASS_ID = '7880eca9-a328-439d-8db5-5fff299e2184'
const env = readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const mk = () => createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

const 결과 = []
const check = (이름, ok, 상세) => {
  결과.push({ 검사: 이름, 판정: ok ? 'PASS' : 'FAIL', 상세: 상세 ?? null })
  console.log(`${ok ? '✔' : '✘'} ${이름}${상세 ? ` — ${String(상세).slice(0, 90)}` : ''}`)
}

const teacher = mk(), student = mk()
const { data: tIn, error: tErr } = await teacher.auth.signInWithPassword({ email: get('DEMO_TEACHER_EMAIL'), password: get('DEMO_PASSWORD') })
const { data: sIn, error: sErr } = await student.auth.signInWithPassword({ email: get('DEMO_STUDENT_EMAIL'), password: get('DEMO_PASSWORD') })
if (tErr || sErr) { console.error('로그인 실패'); process.exit(1) }
const teacherId = tIn.user.id, studentId = sIn.user.id

// ── F1 수업 시작 → 위치 발행 → 학생 따라가기 ─────────────────────────────
const { data: 시작, error: 시작오류 } = await teacher.rpc('rpc_start_class_session', {
  p_class_id: CLASS_ID, p_title: '[검증] 수업 흐름',
})
check('교사 수업 시작', !시작오류 && !시작?.error, 시작오류?.message || 시작?.error)
const sessionId = 시작?.session_id

const focus = { questionId: 'C01-0-Q01', index: 3, subject: 'job-common', label: '[검증] 위치' }
const { data: 위치, error: 위치오류 } = await teacher.rpc('rpc_set_class_focus', { p_session_id: sessionId, p_focus: focus })
check('교사 문항 위치 발행', !위치오류 && !위치?.error, 위치오류?.message || 위치?.error)

const { data: 학생수업, error: 학생수업오류 } = await student.rpc('rpc_my_class_session')
check('학생이 진행 중 수업을 본다', !학생수업오류 && Boolean(학생수업?.session_id), 학생수업오류?.message)
check('학생이 교사와 같은 questionId 를 받는다',
  학생수업?.focus?.questionId === focus.questionId && 학생수업?.focus?.index === focus.index,
  JSON.stringify(학생수업?.focus ?? null))

// ── F2 수업 접속 신고 ─────────────────────────────────────────────────────
const { data: ping, error: ping오류 } = await student.rpc('rpc_presence_ping', { p_session_id: sessionId, p_state: 'active' })
check('학생 접속 신고', !ping오류 && !ping?.error, ping오류?.message || ping?.error)
check('신고 응답에 현재 위치가 함께 온다', ping?.focus?.questionId === focus.questionId, JSON.stringify(ping?.focus ?? null))

const { data: presence, error: presence오류 } = await teacher.rpc('rpc_class_presence', { p_class_id: CLASS_ID })
const 그학생 = presence?.students?.find(r => r.student_id === studentId)
check('교사 화면에 그 학생이 접속으로 보인다', !presence오류 && Boolean(그학생), presence오류?.message || JSON.stringify(그학생 ?? null))
결과.push({ 검사: '교사가 본 연결 상태 라벨', 판정: 'INFO', 상세: JSON.stringify(그학생 ?? null).slice(0, 200) })

// ── F3 자율학습 위치 신고 (LIMIT-001) ─────────────────────────────────────
const { data: 자율, error: 자율오류 } = await student.rpc('rpc_learning_presence_ping', {
  p_state: 'active',
  p_context: { subject: 'job-common', mode: 'study', area: '의사소통 국어', lesson: 'C01-0', label: '[검증] 자율학습' },
})
check('학생 자율학습 위치 신고', !자율오류 && !자율?.error, 자율오류?.message || JSON.stringify(자율 ?? null))

const { data: live, error: live오류 } = await teacher.rpc('rpc_class_live', { p_class_id: CLASS_ID })
const live학생 = live?.students?.find(r => r.student_id === studentId)
check('교사 화면에 자율학습 상태가 보인다', !live오류 && Boolean(live학생), live오류?.message || JSON.stringify(live ?? null).slice(0, 120))
결과.push({ 검사: '교사가 본 자율학습 항목', 판정: 'INFO', 상세: JSON.stringify(live학생 ?? null).slice(0, 240) })

// ── F4 진도 동기화 ────────────────────────────────────────────────────────
const { data: 진도, error: 진도오류 } = await student.rpc('rpc_sync_progress', {
  p_payload: { reviews: [], wrong: [], resolved: [], activity: { study: 1, quiz: 0, mission: 0 }, correct: 0 },
})
check('학생 진도 동기화', !진도오류 && !진도?.error, 진도오류?.message || 진도?.error)

const { data: live2 } = await teacher.rpc('rpc_class_live', { p_class_id: CLASS_ID })
const live학생2 = live2?.students?.find(r => r.student_id === studentId)
check('교사 화면에 학생 진도가 반영된다', Boolean(live학생2), JSON.stringify(live학생2 ?? null).slice(0, 160))

// ── F5 오답 누적 ──────────────────────────────────────────────────────────
const qid = `VERIFY-${Date.now()}`
const 오답인자 = {
  p_question_id: qid, p_course_id: 1, p_question_text: '[검증] 반복 오답 문항',
  p_correct_answer: 'B', p_user_answer: 'A', p_area: '[검증]',
}
const { error: 오답1 } = await student.rpc('rpc_save_wrong_answer', 오답인자)
const { data: 첫행 } = await student.from('wrong_answers').select('wrong_count').eq('question_id', qid).maybeSingle()
check('오답 1회 저장', !오답1 && 첫행?.wrong_count === 1, 오답1?.message || `wrong_count=${첫행?.wrong_count}`)

const { error: 오답2 } = await student.rpc('rpc_save_wrong_answer', 오답인자)
const { data: 둘째행 } = await student.from('wrong_answers').select('wrong_count').eq('question_id', qid).maybeSingle()
check('같은 문항 재오답 시 횟수 증가', !오답2 && 둘째행?.wrong_count === 2, 오답2?.message || `wrong_count=${둘째행?.wrong_count}`)

const { data: 복습, error: 복습오류 } = await student.rpc('rpc_review_wrong', { p_question_id: qid, p_correct: false })
check('오답 재풀이 반영', !복습오류, 복습오류?.message || JSON.stringify(복습 ?? null).slice(0, 80))

// ── F6 메시지 왕복 ────────────────────────────────────────────────────────
const 표식 = `[검증 ${Date.now()}]`
const { data: 보냄, error: 보냄오류 } = await teacher.rpc('rpc_send_message', {
  p_scope: 'personal', p_target: studentId, p_title: `${표식} 확인`, p_body: '자동 검증 메시지입니다.',
})
check('교사가 개별 메시지 발송', !보냄오류 && !보냄?.error, 보냄오류?.message || 보냄?.error)

const { data: 받은목록 } = await student.from('notifications').select('id, title').order('created_at', { ascending: false }).limit(10)
const 받음 = (받은목록 || []).find(n => (n.title || '').includes(표식))
check('학생이 그 메시지를 받는다', Boolean(받음), 받음 ? '수신 확인' : '수신 없음')

let 답장오류 = null
if (받음) {
  const r = await student.rpc('rpc_reply_message', { p_notification_id: 받음.id, p_body: '[검증] 학생 답장' })
  답장오류 = r.error
}
check('학생 답장', Boolean(받음) && !답장오류, 답장오류?.message)

const { data: 수신함, error: 수신함오류 } = await teacher.rpc('rpc_teacher_inbox', { p_limit: 50 })
const 답장도착 = (수신함?.items || 수신함 || []).some?.(i => JSON.stringify(i).includes('학생 답장'))
check('교사 수신함에 답장이 온다', !수신함오류 && Boolean(답장도착), 수신함오류?.message || `항목 ${(수신함?.items || 수신함 || []).length ?? '?'}`)

// ── F7 SEC-02 남의 자료 접근 ──────────────────────────────────────────────
const { data: 남의프로필 } = await student.from('profiles').select('id').neq('id', studentId).limit(5)
check('학생이 남의 프로필을 못 본다', (남의프로필 || []).length === 0, `${(남의프로필 || []).length}행`)

const { data: 남의오답 } = await student.from('wrong_answers').select('id').neq('student_id', studentId).limit(5)
check('학생이 남의 오답을 못 본다', (남의오답 || []).length === 0, `${(남의오답 || []).length}행`)

const { data: 남의기기 } = await student.from('user_device_state').select('storage_key').neq('user_id', studentId).limit(5)
check('학생이 남의 기기상태를 못 본다', (남의기기 || []).length === 0, `${(남의기기 || []).length}행`)

// ── 정리 ──────────────────────────────────────────────────────────────────
const { error: 종료오류 } = await teacher.rpc('rpc_end_class_session', { p_class_id: CLASS_ID })
check('수업 종료(정리)', !종료오류, 종료오류?.message)

mkdirSync('verification/adversarial-4.8.13/evidence/flows', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/flows/teacher-student.json',
  JSON.stringify({ _meta: { baseline: '9797477fe73a (4.8.14)', 학급: CLASS_ID }, 결과 }, null, 1) + '\n')

const pass = 결과.filter(r => r.판정 === 'PASS').length
const fail = 결과.filter(r => r.판정 === 'FAIL').length
console.log(`\n=== PASS ${pass} · FAIL ${fail} ===`)
