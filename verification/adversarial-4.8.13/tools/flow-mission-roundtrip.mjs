// TCH-001·TCH-003 실계정 왕복 — 교사가 낸 미션이 학생에게 무엇으로 도착하는가.
//
// 교사 세션으로 실제 미션을 만들고(운영), 학생 세션으로 그 미션을 받아
// 앱의 MissionScreen.loadQuestions 와 같은 규칙으로 출제될 문항을 계산한다.
// 쓰기는 [검증]전용학급 안에서만 일어나고, 끝나면 만든 미션을 지운다.
//
// 실행: npx esbuild verification/adversarial-4.8.13/tools/flow-mission-roundtrip.mjs \
//         --bundle --platform=node --format=esm --loader:.json=json --packages=external \
//         --outfile=.cache/flow-mission.mjs && node .cache/flow-mission.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import jobQuestions from '../../../data/questions.json'
import { buildJcMissionAreas, englishStudyQuestions, jobCommonMediaQuestions } from '../../../src/lib/jobCommonAreas.js'
import { withExtractedChoices, isOXQuestion } from '../../../src/lib/questionNorm.js'

const CLASS_ID = '7880eca9-a328-439d-8db5-5fff299e2184'   // [검증]전용학급
const env = readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const mk = () => createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

const 기록 = { _meta: { baseline: '9797477fe73a (4.8.14)', 학급: CLASS_ID, 원칙: '검증 전용 학급 안에서만 쓰기, 끝나면 정리' }, 시험: [] }
const log = (이름, 내용) => { 기록.시험.push({ 이름, ...내용 }); console.log(`— ${이름}`) }

// 앱의 학생 화면과 같은 문항 풀
const POOL = [...jobQuestions, ...englishStudyQuestions, ...jobCommonMediaQuestions]
const byId = new Map(POOL.map(q => [q.id, q]))

// MissionScreen.loadQuestions 의 폴백 사슬 (src/screens/student/MissionScreen.jsx:288-315)
function 학생이받는문항(qIds, areaIds) {
  let pool = [], route = 'id'
  if (qIds.length && !qIds[0].endsWith('-Q*')) {
    const s = new Set(qIds); pool = POOL.filter(q => s.has(q.id) && !q.excludeFromQuiz)
  }
  if (!pool.length && qIds.length && qIds[0].startsWith('area:')) {
    const s = new Set(qIds.map(x => x.replace('area:', '')))
    pool = POOL.filter(q => s.has(q.area) && !q.excludeFromQuiz); route = 'area:'
  }
  if (!pool.length && qIds.length) {
    const pre = qIds.map(p => p.replace(/-Q\*$/, ''))
    pool = POOL.filter(q => pre.some(p => q.lessonId === p || q.id.startsWith(p + '-Q')) && !q.excludeFromQuiz); route = 'prefix'
  }
  if (!pool.length && areaIds?.length) {
    pool = POOL.filter(q => areaIds.some(a => q.area === a || q.lessonId?.startsWith(a.replace('a', 'C')) || q.id.startsWith(a)) && !q.excludeFromQuiz)
    route = 'area_ids'
  }
  if (!pool.length) { pool = POOL.filter(q => !q.excludeFromQuiz); route = '전체폴백' }
  return { pool, route }
}

// ── 로그인 ────────────────────────────────────────────────────────────────
const teacher = mk(), student = mk()
const { data: tIn, error: tErr } = await teacher.auth.signInWithPassword({ email: get('DEMO_TEACHER_EMAIL'), password: get('DEMO_PASSWORD') })
const { data: sIn, error: sErr } = await student.auth.signInWithPassword({ email: get('DEMO_STUDENT_EMAIL'), password: get('DEMO_PASSWORD') })
if (tErr || sErr) { console.error('로그인 실패'); process.exit(1) }
log('로그인', { 교사: !tErr, 학생: !sErr })

// ── 교사 화면이 노출하는 단원 두 개를 고른다 ──────────────────────────────
const areas = buildJcMissionAreas()
const 단원들 = areas.flatMap(a => a.lessons.map(l => ({ 영역: a.displayName, 단원: l.title, ids: [...new Set(l.questionIds)], areaId: a.id, lessonId: l.id })))
const 전달0 = 단원들.find(l => l.ids.every(id => !byId.has(id)))          // 전달률 0% 로 예측된 단원
const 정상 = 단원들.find(l => l.ids.filter(id => byId.has(id)).length >= 10) // 정상 전달이 기대되는 단원
log('교사 화면의 단원 선택', {
  '전달 0% 예상 단원': 전달0 && { 영역: 전달0.영역, 단원: 전달0.단원, 지정문항수: 전달0.ids.length },
  '정상 예상 단원': 정상 && { 영역: 정상.영역, 단원: 정상.단원, 지정문항수: 정상.ids.length },
})

const 만든미션 = []
async function 미션시험(라벨, 단원) {
  const areaIds = [단원.lessonId]      // 영역 미선택 시 앱은 selectedLessons 를 area_ids 로 보낸다
  const { data: missionId, error } = await teacher.rpc('rpc_create_mission', {
    p_class_id: CLASS_ID,
    p_title: `[검증] ${라벨}`,
    p_mission_type: '오늘',
    p_question_ids: 단원.ids,
    p_area_ids: areaIds,
    p_question_count: 10,
    p_time_limit_min: null,
    p_shuffle: false,
    p_due_at: null,
    p_activate_now: true,          // 학생 RLS 는 status='active' 일 때만 미션을 보여 준다
  })
  if (error) { log(`미션 생성 실패 — ${라벨}`, { 오류: String(error.message).slice(0, 120) }); return }
  만든미션.push(missionId)

  // 학생이 실제로 받는 미션 행
  let { data: 미션, error: mErr } = await student.from('missions')
    .select('id, title, question_ids, area_ids, question_count, subject_id, shuffle')
    .eq('id', missionId).maybeSingle()
  if (mErr || !미션) {
    // 활성화가 안 됐으면 교사가 활성화한 뒤 다시 본다(교사 대시보드의 활성화 버튼과 같은 동작)
    await teacher.from('missions').update({ status: 'active', activated_at: new Date().toISOString() }).eq('id', missionId)
    const 재조회 = await student.from('missions')
      .select('id, title, question_ids, area_ids, question_count, subject_id, shuffle').eq('id', missionId).maybeSingle()
    if (재조회.error || !재조회.data) {
      log(`학생 미션 조회 실패 — ${라벨}`, { 오류: (mErr || 재조회.error)?.message?.slice(0, 100) ?? '행 없음' })
      return
    }
    미션 = 재조회.data
  }

  const { pool, route } = 학생이받는문항(미션.question_ids ?? [], 미션.area_ids ?? [])
  const 지정 = new Set(단원.ids)
  const 출제 = pool.slice(0, 미션.question_count || pool.length)
  const 보기없음 = 출제.filter(q => { const n = withExtractedChoices(q); const c = n.choices || n.options || []; return !isOXQuestion(n) && c.length < 2 })

  log(`미션 왕복 — ${라벨}`, {
    교사가지정한문항수: 단원.ids.length,
    학생이받은question_ids수: (미션.question_ids ?? []).length,
    적용된경로: route,
    학생출제풀크기: pool.length,
    실제출제수: 출제.length,
    '출제 중 교사 지정분': 출제.filter(q => 지정.has(q.id)).length,
    '출제 중 지정 밖': 출제.filter(q => !지정.has(q.id)).length,
    '보기 없이 뜨는 문항': 보기없음.length,
    보기없음예: 보기없음.slice(0, 3).map(q => q.id),
  })
}

if (전달0) await 미션시험('전달 0% 예상 단원', 전달0)
if (정상) await 미션시험('정상 예상 단원', 정상)

// ── 정리 — 검증이 만든 미션을 지운다 ──────────────────────────────────────
let 정리 = []
for (const id of 만든미션) {
  const { error } = await teacher.from('missions').delete().eq('id', id)
  정리.push({ id, 삭제: error ? `실패: ${String(error.message).slice(0, 60)}` : '완료' })
}
기록.정리 = 정리
console.log('정리:', JSON.stringify(정리))

mkdirSync('verification/adversarial-4.8.13/evidence/flows', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/flows/mission-roundtrip.json', JSON.stringify(기록, null, 1) + '\n')
console.log('\n' + JSON.stringify(기록.시험.filter(x => x.이름.startsWith('미션 왕복')), null, 1))
