import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { runSupabase } from './release/release-utils.mjs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
  .map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }))
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const password = env.DEMO_PASSWORD
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const teacherClient = createClient(url, anon, clientOptions)
const adminClient = createClient(url, anon, clientOptions)

const { data: teacherLogin, error: teacherLoginError } = await teacherClient.auth.signInWithPassword({
  email: env.DEMO_TEACHER_EMAIL,
  password,
})
if (teacherLoginError || !teacherLogin.user) throw new Error('검증 교사 로그인에 실패했습니다.')

const teacherId = teacherLogin.user.id
const { data: teacherProfile, error: profileError } = await teacherClient
  .from('profiles').select('school_id, role').eq('id', teacherId).single()
if (profileError || teacherProfile?.role !== 'teacher' || !teacherProfile.school_id) {
  throw new Error('검증 교사의 역할과 학교를 확인할 수 없습니다.')
}

const { data: originalRows, error: originalError } = await teacherClient
  .from('teacher_classes').select('class_id').eq('teacher_id', teacherId)
if (originalError || !originalRows?.length) throw new Error('검증 교사의 기존 담당 학급을 확인할 수 없습니다.')
const originalIds = [...new Set(originalRows.map(row => row.class_id))].sort()

const adminId = randomUUID()
const classId = randomUUID()
const email = `assignment-check-${Date.now()}@sugarsalt.invalid`
const classCode = `TA${Date.now().toString(36).slice(-6)}`.toUpperCase()
let restored = false

runSupabase(['db', 'query', '--linked', `
  set search_path = public, auth, extensions;
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '${adminId}'::uuid,
    coalesce((select instance_id from auth.users limit 1), '00000000-0000-0000-0000-000000000000'::uuid),
    'authenticated', 'authenticated', '${email}',
    extensions.crypt('${sqlText(password)}', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('email', '${email}'), now(), now()
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values ('${adminId}', '${adminId}'::uuid,
    jsonb_build_object('sub', '${adminId}', 'email', '${email}', 'email_verified', true, 'phone_verified', false),
    'email', now(), now());
  insert into public.profiles (id, role, display_name, school_id, approved)
  values ('${adminId}'::uuid, 'school_admin', '학급배정 검증관리자', '${teacherProfile.school_id}'::uuid, true);
  insert into public.classes (id, school_id, name, grade, class_code)
  values ('${classId}'::uuid, '${teacherProfile.school_id}'::uuid, '학급배정 자동검증', 1, '${classCode}');
`])

const restore = async () => {
  const { data, error } = await adminClient.rpc('rpc_admin_update_user_v2', {
    p_user_id: teacherId,
    p_class_ids: originalIds,
  })
  if (error || Number(data?.assigned_class_count) !== originalIds.length) {
    throw new Error('검증 후 교사 담당 학급 원상복구에 실패했습니다.')
  }
  restored = true
}

try {
  const { error: loginError } = await adminClient.auth.signInWithPassword({ email, password })
  if (loginError) throw new Error('임시 학교관리자 로그인에 실패했습니다.')

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    restored = false
    const { data: assigned, error: assignError } = await adminClient.rpc('rpc_admin_update_user', {
      p_user_id: teacherId,
      p_class_id: classId,
    })
    const { data: linked, error: linkedError } = await teacherClient
      .from('teacher_classes').select('class_id').eq('teacher_id', teacherId).eq('class_id', classId)
    if (assignError || assigned?.ok !== true || linkedError || linked?.length !== 1) {
      throw new Error(`교사 학급 배정 ${attempt}회차가 DB 기록과 일치하지 않습니다.`)
    }
    await restore()
    const { data: afterRestore, error: restoreReadError } = await teacherClient
      .from('teacher_classes').select('class_id').eq('teacher_id', teacherId)
    const restoredIds = [...new Set((afterRestore || []).map(row => row.class_id))].sort()
    if (restoreReadError || JSON.stringify(restoredIds) !== JSON.stringify(originalIds)) {
      throw new Error(`교사 학급 배정 ${attempt}회차 원상복구 검증에 실패했습니다.`)
    }
    console.log(`PASS teacher-class assignment ${attempt}/3 (persisted=1, restored=${restoredIds.length})`)
  }

  const { data: members, error: membersError } = await adminClient.rpc('rpc_admin_members')
  const teacher = Array.isArray(members) ? members.find(member => member.id === teacherId) : null
  if (membersError || !teacher || teacher.teacher_class_ids?.length !== originalIds.length) {
    throw new Error('학교관리자 회원 목록의 담당 학급 표시 계약이 실제 DB와 일치하지 않습니다.')
  }
  console.log(`PASS admin member assignment projection (classes=${originalIds.length})`)
} finally {
  if (!restored) await restore().catch(() => {})
  await teacherClient.auth.signOut({ scope: 'local' })
  await adminClient.auth.signOut({ scope: 'local' })
  runSupabase(['db', 'query', '--linked', `
    delete from public.classes where id = '${classId}'::uuid;
    delete from public.profiles where id = '${adminId}'::uuid;
    delete from auth.identities where user_id = '${adminId}'::uuid;
    delete from auth.users where id = '${adminId}'::uuid;
  `])
}

function sqlText(value) {
  return String(value).replaceAll("'", "''")
}
