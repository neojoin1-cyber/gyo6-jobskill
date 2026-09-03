import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const read = path => readFileSync(join(root, path), 'utf8')
const errors = []

const requireText = (path, text, label) => {
  if (!read(path).includes(text)) errors.push(`${label}: ${path}`)
}
const forbidText = (path, text, label) => {
  if (read(path).includes(text)) errors.push(`${label}: ${path}`)
}

const mission = read('src/screens/student/MissionScreen.jsx')
const areas = read('src/lib/jobCommonAreas.js')
const teachers = read('src/screens/admin/TeachersScreen.jsx')
const schoolAdmin = read('src/screens/schooladmin/SchoolAdminShell.jsx')
const teacherDashboard = read('src/screens/teacher/TeacherDashboard.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const migration = read('supabase/migrations/20260903090000_release_integrity_contracts.sql')
const identityMigration = read('supabase/migrations/20260903091000_email_identity_integrity.sql')
const accountMigration = read('supabase/migrations/20260903093000_admin_create_user_current_schema.sql')
const isolatedTrialMigration = read('supabase/migrations/20260903094000_isolated_public_trial_users.sql')
const memberDirectoryMigration = read('supabase/migrations/20260903150000_admin_member_directory_filters.sql')
const trial = read('src/lib/trialSession.js')
const trialEdge = read('supabase/functions/public-trial-session/index.ts')
const viewport = read('index.html')

if (!mission.includes('jcStudyQuestions()') || mission.includes("import jobQuestions from '../../../data/questions.json'")) {
  errors.push('TCH-001/002: student mission is not using the canonical study pool')
}
if (!mission.includes('임의의 다른 문항으로 바꾸지 않았으니')) {
  errors.push('TCH-001: mission mismatch must fail visibly instead of silently falling back')
}
if (!areas.includes('missionPoolIds.has(q.id)') || !areas.includes("q.type !== 'matching' && q.type !== 'text'")) {
  errors.push('TCH-003/CNT-107: unsupported mission types or IDs remain selectable')
}
if (!teachers.includes("rpc('rpc_admin_update_user_v2'") || !teachers.includes('assigned_class_count')) {
  errors.push('TCH-006: admin UI does not verify the persisted teacher-class assignment count')
}
if (!schoolAdmin.includes('<TeachersScreen currentRole={profile?.role}')) {
  errors.push('TCH-006: school administrator cannot reach member/class assignment')
}
for (const contract of ['filterOffice', 'filterSchool', 'ROLE_FILTERS', 'school_education_office']) {
  const source = contract === 'school_education_office' ? memberDirectoryMigration : teachers
  if (!source.includes(contract)) errors.push(`OPS-003: admin member directory filter is missing: ${contract}`)
}
if (!memberDirectoryMigration.includes("v_role = 'admin'") || !memberDirectoryMigration.includes("p.role <> 'admin' AND p.school_id = v_school")) {
  errors.push('OPS-003: admin member directory does not preserve the school administrator scope')
}
if (!memberDirectoryMigration.includes('public_trial_ephemeral_users trial_user') || !memberDirectoryMigration.includes('trial_user.user_id = p.id')) {
  errors.push('OPS-003: public trial identities remain visible in the administrator member directory')
}
if (teacherDashboard.includes('rpc_create_class') || teacherWorkspace.includes('rpc_create_class')) {
  errors.push('TCH-005: teacher UI still exposes a server-forbidden class creation path')
}
for (const [label, contract] of [
  ['missions', "onNavigate?.('create-mission'"],
  ['grading', "onTab?.('grading')"],
  ['cover-feedback', 'onOpenCoverReviews?.(classId)'],
  ['interview', 'onOpenInterviewCoach?.(classId)'],
  ['messages', 'onOpenMessages?.('],
]) {
  if (!teacherWorkspace.includes(contract)) errors.push(`TCH-004: phone teacher route is missing: ${label}`)
}
for (const contract of [
  'CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_v2',
  'INSERT INTO public.teacher_classes',
  "'assigned_class_count'",
  'CREATE FUNCTION public.rpc_student_join',
  'p_class_id uuid',
]) {
  if (!migration.includes(contract)) errors.push(`TCH-006/OPS-002: missing database contract: ${contract}`)
}
for (const contract of ['INSERT INTO auth.identities', 'p_role::public.user_role']) {
  if (!identityMigration.includes(contract)) errors.push(`OPS-002: missing email identity contract: ${contract}`)
}
if (!accountMigration.includes('INSERT INTO public.student_classes') || accountMigration.includes('profiles (id, display_name, role, school_id, class_id')) {
  errors.push('OPS-002: account creation is not aligned with normalized class membership')
}
for (const contract of [
  'CREATE TABLE IF NOT EXISTS public.public_trial_ephemeral_users',
  'CREATE OR REPLACE FUNCTION public.provision_public_trial_identity',
  'GRANT EXECUTE ON FUNCTION public.provision_public_trial_identity',
]) {
  if (!isolatedTrialMigration.includes(contract)) errors.push(`SEC-001: missing isolated public trial contract: ${contract}`)
}
for (const contract of ['trial_session_id', 'public_trial_ephemeral_users', 'admin.auth.admin.generateLink({']) {
  if (!trialEdge.includes(contract)) errors.push(`SEC-001: public trial identity isolation is missing: ${contract}`)
}
if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?/.test(viewport)) {
  errors.push('A11Y-001: viewport still blocks user zoom')
}
if (!trial.includes('AbortController') || !trial.includes('12_000') || !trial.includes('attempt < 2')) {
  errors.push('PERF-002: trial request has no bounded retry/timeout path')
}
for (const origin of ['https://localhost', 'capacitor://localhost']) {
  if (!trialEdge.includes(origin)) errors.push(`AND-103: native trial origin is not allowed: ${origin}`)
}
forbidText('src/screens/LoginScreen.jsx', "if (isNative) return", 'AND-103: native trial entry is still blocked')
requireText('src/lib/userLocalStorage.js', 'storage.removeItem(LEGACY_OWNER_KEY)', 'SEC-002: legacy owner trace is not cleared')
forbidText('output/promotion/tmp/build_leaflet.py', '5,765 검증 문항', 'LEGAL-001: unsupported marketing count remains')
forbidText('output/promotion/tmp/build_leaflet.py', '31/31 핵심 흐름 검증', 'LEGAL-002: validation scope remains overstated')

const icon192 = readFileSync(join(root, 'public/icons/icon-192.png'))
const mask192 = readFileSync(join(root, 'public/icons/icon-192-maskable.png'))
if (createHash('sha256').update(icon192).digest('hex') === createHash('sha256').update(mask192).digest('hex')) {
  errors.push('PWA-002: regular and maskable icons are identical')
}

if (errors.length) {
  console.error('Adversarial remediation gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('PASS: adversarial remediation contracts (teacher, mission, content, accessibility, trial, privacy, PWA, claims)')
