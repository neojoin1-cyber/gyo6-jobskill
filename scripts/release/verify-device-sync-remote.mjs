import { createClient } from '@supabase/supabase-js'
import { getProjectRef, loadLocalEnv, logPass, parseJsonOutput, runSupabase } from './release-utils.mjs'

const env = { ...loadLocalEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다.')

const apiKeys = parseJsonOutput(
  runSupabase(['projects', 'api-keys', '--project-ref', getProjectRef(), '--reveal', '--output', 'json']).stdout,
  'Supabase API 키',
)
const serviceKey = apiKeys.find(key => key.name === 'service_role')?.api_key
  ?? apiKeys.find(key => key.type === 'secret')?.api_key
if (!serviceKey) throw new Error('자동 정리 가능한 운영 service role 키를 찾지 못했습니다.')

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, serviceKey, clientOptions)
const pc = createClient(url, anonKey, clientOptions)
const mobile = createClient(url, anonKey, clientOptions)
const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const email = `release-sync-${nonce}@example.invalid`
const password = `Release-${nonce}-A7!`
let userId = null

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

async function sync(client, changes = [], since = null, deviceId = 'release-device') {
  const { data, error } = await client.rpc('rpc_sync_user_device_state', {
    p_changes: changes,
    p_since: since,
    p_device_id: deviceId,
  })
  if (error) throw new Error(`동기화 RPC 실패: ${error.message}`)
  return data
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { release_verification: true },
  })
  if (created.error || !created.data.user) throw new Error(`검증 학생 생성 실패: ${created.error?.message}`)
  userId = created.data.user.id

  const profile = await admin.from('profiles').upsert({
    id: userId,
    role: 'student',
    display_name: '출시 자동검증 학생',
    approved: true,
  })
  if (profile.error) throw new Error(`검증 학생 프로필 생성 실패: ${profile.error.message}`)

  for (const client of [pc, mobile]) {
    const login = await client.auth.signInWithPassword({ email, password })
    if (login.error || login.data.user?.id !== userId) throw new Error(`독립 기기 로그인 실패: ${login.error?.message}`)
  }

  const base = Date.now() - 10_000
  const change = (key, value, offset) => ({ key, value, deleted: false, updated_at: new Date(base + offset).toISOString() })

  await sync(pc, [change('release.pc.progress', 'PC 학습 3/10', 1000)], null, 'release-pc')
  const mobilePull = await sync(mobile, [change('release.mobile.draft', '휴대폰 지원동기 초안', 2000)], null, 'release-mobile')
  expect(mobilePull.items?.some(item => item.key === 'release.pc.progress' && item.value === 'PC 학습 3/10'), '휴대폰이 PC 진행을 받지 못했습니다.')

  const pcPull = await sync(pc, [], null, 'release-pc')
  expect(pcPull.items?.some(item => item.key === 'release.mobile.draft' && item.value === '휴대폰 지원동기 초안'), 'PC가 휴대폰 초안을 받지 못했습니다.')

  await sync(pc, [change('release.shared.answer', '이전 PC 답변', 3000)], null, 'release-pc')
  await sync(mobile, [change('release.shared.answer', '최신 휴대폰 답변', 4000)], null, 'release-mobile')
  const conflictPull = await sync(pc, [], null, 'release-pc')
  expect(conflictPull.items?.find(item => item.key === 'release.shared.answer')?.value === '최신 휴대폰 답변', '키 단위 최신 수정 충돌 처리가 실패했습니다.')

  await sync(pc, [change('release.oversize', '가'.repeat(400_001), 5000)], null, 'release-pc')
  const oversize = await admin.from('user_device_state').select('storage_key').eq('user_id', userId).eq('storage_key', 'release.oversize')
  expect(!oversize.error && oversize.data.length === 0, '항목별 400KB 상한이 작동하지 않았습니다.')

  const hugeBatch = await pc.rpc('rpc_sync_user_device_state', {
    p_changes: [change('release.huge-batch', 'a'.repeat(1_500_100), 6000)],
    p_since: null,
    p_device_id: 'release-pc',
  })
  expect(Boolean(hugeBatch.error), '1.5MB 동기화 묶음 상한이 작동하지 않았습니다.')

  const ownRows = await pc.from('user_device_state').select('user_id')
  expect(!ownRows.error && ownRows.data.every(row => row.user_id === userId), '학생 RLS가 다른 사용자의 행을 노출했습니다.')

  const careerProfile = {
    profileVersion: 3,
    currentGrade: 1,
    departmentName: '스마트기계과',
    majorGroup: 'mechanical',
    targetIndustry: '자동차 부품',
    targetRole: '생산설비',
    semesterGoal: '실습 근거 카드 2장 완성',
    qualifications: [{ id: 'release-q1', name: '생산자동화기능사', issuer: '한국산업인력공단', status: 'preparing', grade: 1 }],
    extracurricularActivities: [{ id: 'release-a1', category: 'club', name: '메이커 동아리', role: '부품 조립', outcome: '작동 시제품 완성', grade: 1 }],
  }
  const careerWrite = await pc.rpc('rpc_upsert_my_career_profile', {
    p_profile: careerProfile,
    p_readiness_score: 61,
    p_evidence_count: 1,
  })
  expect(!careerWrite.error && careerWrite.data?.ok === true, `PC 취업 프로필 저장 실패: ${careerWrite.error?.message || careerWrite.data?.error}`)
  const careerMobile = await mobile.from('student_career_profiles')
    .select('student_id, profile_data, readiness_score, evidence_count')
    .eq('student_id', userId)
    .single()
  expect(!careerMobile.error, `휴대폰 취업 프로필 조회 실패: ${careerMobile.error?.message}`)
  expect(careerMobile.data?.profile_data?.targetRole === '생산설비', '휴대폰이 PC의 관심 직무를 받지 못했습니다.')
  expect(careerMobile.data?.profile_data?.extracurricularActivities?.[0]?.name === '메이커 동아리', '휴대폰이 PC의 교과외활동을 받지 못했습니다.')
  expect(careerMobile.data?.readiness_score === 61 && careerMobile.data?.evidence_count === 1, '장기 취업 준비도·근거 수가 기기 간 일치하지 않습니다.')

  logPass('실제 운영 학생 계정 · PC↔휴대폰 양방향/취업 프로필/충돌/RLS/요청량 상한')
} finally {
  await Promise.allSettled([pc.auth.signOut(), mobile.auth.signOut()])
  if (userId) {
    await admin.from('student_career_profiles').delete().eq('student_id', userId)
    await admin.from('user_device_state').delete().eq('user_id', userId)
  }
  if (userId) await admin.auth.admin.deleteUser(userId)
}
