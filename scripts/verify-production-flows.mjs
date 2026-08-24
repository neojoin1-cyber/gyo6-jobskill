import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = loadEnv('.env.local')
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD

if (!url || !anon || !password) {
  throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and DEMO_PASSWORD are required')
}

const accounts = {
  student: process.env.DEMO_STUDENT_EMAIL,
  teacher: process.env.DEMO_TEACHER_EMAIL,
  school_admin: process.env.DEMO_ADMIN_EMAIL,
}

const report = {
  generatedAt: new Date().toISOString(),
  target: new URL(url).host,
  checks: [],
  metrics: {},
}

const clients = {}
let classId = null
const createdMissionIds = []
const createdUserIds = []
const repeatQuestionId = `RELEASE-REPEAT-${Date.now()}`

try {
  for (const [expectedRole, email] of Object.entries(accounts)) {
    if (!email) throw new Error(`Missing DEMO_${expectedRole.toUpperCase()}_EMAIL`)
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password })
    check(`${expectedRole} login`, !loginError && Boolean(login.user), loginError?.message)
    if (loginError) continue

    const { data: profile, error: profileError } = await client
      .from('profiles').select('id, role, approved, school_id, display_name')
      .eq('id', login.user.id).single()
    check(`${expectedRole} profile`, !profileError && profile?.role === expectedRole, profileError?.message || profile?.role)
    check(`${expectedRole} approved`, profile?.approved === true, String(profile?.approved))
    if (profile) clients[expectedRole] = { client, profile }
  }

  const student = clients.student
  const teacher = clients.teacher
  const schoolAdmin = clients.school_admin
  if (!student || !teacher || !schoolAdmin) throw new Error('All three demo roles must authenticate')

  const { data: studentClasses, error: studentClassError } = await student.client
    .from('student_classes').select('class_id, classes(name)').eq('student_id', student.profile.id)
  check('student class membership', !studentClassError && studentClasses?.length > 0, studentClassError?.message)

  const { data: teacherClasses, error: teacherClassError } = await teacher.client
    .from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', teacher.profile.id)
  check('teacher assigned classes', !teacherClassError && teacherClasses?.length > 0, teacherClassError?.message)

  const studentClassIds = new Set((studentClasses || []).map(row => row.class_id))
  classId = (teacherClasses || []).find(row => studentClassIds.has(row.class_id))?.class_id || null
  check('student-teacher shared class', Boolean(classId), 'Demo student and teacher must share an assigned class')

  for (const [role, entry] of Object.entries(clients)) {
    const { data, error } = await entry.client.rpc('rpc_bootstrap')
    check(`${role} bootstrap`, !error && !data?.error, error?.message || data?.error)
    report.metrics[`${role}BootstrapKeys`] = data ? Object.keys(data).sort() : []
  }

  const repeatParams = {
    p_question_id: repeatQuestionId,
    p_course_id: 1,
    p_question_text: '반복 오답 운영 검증 문항',
    p_correct_answer: 'B',
    p_user_answer: 'A',
    p_area: '운영 검증',
  }
  const { error: firstWrongError } = await student.client.rpc('rpc_save_wrong_answer', repeatParams)
  const { data: firstWrong } = await student.client.from('wrong_answers')
    .select('wrong_count').eq('question_id', repeatQuestionId).single()
  check('first wrong answer count', !firstWrongError && firstWrong?.wrong_count === 1,
    firstWrongError?.message || String(firstWrong?.wrong_count))

  const { error: secondWrongError } = await student.client.rpc('rpc_save_wrong_answer', repeatParams)
  const { data: secondWrong } = await student.client.from('wrong_answers')
    .select('wrong_count').eq('question_id', repeatQuestionId).single()
  check('repeated study wrong answer count', !secondWrongError && secondWrong?.wrong_count === 2,
    secondWrongError?.message || String(secondWrong?.wrong_count))

  const { data: reviewStatus, error: reviewWrongError } = await student.client.rpc('rpc_review_wrong', {
    p_question_id: repeatQuestionId,
    p_correct: false,
  })
  const { data: reviewedWrong } = await student.client.from('wrong_answers')
    .select('wrong_count, review_streak, status').eq('question_id', repeatQuestionId).single()
  check('wrong-note retry increments repeat count', !reviewWrongError && reviewStatus === 'open'
    && reviewedWrong?.wrong_count === 3 && reviewedWrong?.review_streak === 0,
  reviewWrongError?.message || JSON.stringify(reviewedWrong))

  const { data: viewable, error: viewableError } = await teacher.client.rpc('rpc_my_viewable_subjects')
  check('teacher viewable subjects resolver', !viewableError && Array.isArray(viewable), viewableError?.message)
  report.metrics.teacherSubjectScope = viewable?.length ? 'assigned' : 'unrestricted-fallback'
  report.metrics.teacherViewableSubjects = viewable || []

  const teacherMenuChecks = [
    ['teacher diagnostics menu', 'rpc_class_diagnostics', { p_class_id: classId }],
    ['teacher progress menu', 'rpc_class_progress', { p_class_id: classId }],
    ['teacher weakness menu', 'rpc_class_weakness', { p_class_id: classId }],
    ['teacher personality menu', 'rpc_class_personality', { p_class_id: classId }],
    ['teacher class students menu', 'rpc_my_class_students', undefined],
    ['teacher leaderboard menu', 'rpc_class_leaderboard', { p_class_id: classId, p_subject_id: 'job-common' }],
    ['teacher class position menu', 'rpc_class_position', { p_class_id: classId, p_subject_id: 'job-common' }],
  ]
  for (const [name, fn, args] of teacherMenuChecks) {
    const { data, error } = await teacher.client.rpc(fn, args)
    check(name, !error && !data?.error, error?.message || data?.error)
  }

  for (const spec of [
    { subject: 'interview', question: 'IV-A01-1', area: '오리엔테이션' },
    { subject: 'personality', question: 'PS-CO-001', area: 'CO' },
  ]) {
    const title = `[출시검증] ${spec.subject} 미션`
    const { data: missionId, error: createError } = await teacher.client.rpc('rpc_create_mission', {
      p_class_id: classId,
      p_title: title,
      p_mission_type: '이번시간',
      p_question_ids: [spec.question],
      p_area_ids: [spec.area],
      p_question_count: 1,
      p_time_limit_min: null,
      p_shuffle: false,
      p_due_at: null,
    })
    check(`teacher creates ${spec.subject} mission`, !createError && Boolean(missionId), createError?.message)
    if (!missionId) continue
    createdMissionIds.push(missionId)
    const { error: updateError } = await teacher.client.from('missions')
      .update({ subject_id: spec.subject, status: 'active' }).eq('id', missionId)
    check(`teacher activates ${spec.subject} mission`, !updateError, updateError?.message)

    const { data: studentBoot, error: bootError } = await student.client.rpc('rpc_bootstrap')
    const visibleMission = studentBoot?.missions?.find(mission => mission.id === missionId)
    check(`student receives ${spec.subject} mission subject`, !bootError && visibleMission?.subject_id === spec.subject,
      bootError?.message || JSON.stringify(visibleMission))
    check(`student receives ${spec.subject} mission question`, visibleMission?.question_ids?.[0] === spec.question,
      JSON.stringify(visibleMission?.question_ids))

    const answerIndex = spec.subject === 'interview' ? 1 : 2
    const { data: submitted, error: submitError } = await student.client.rpc('rpc_submit_mission', {
      p_mission_id: missionId,
      p_answers: { [spec.question]: answerIndex, _score: spec.subject === 'interview' ? 1 : 0 },
      p_time_taken_sec: 20,
      p_typed_answers: {},
    })
    check(`student submits ${spec.subject} mission`, !submitError && submitted?.total === 1,
      submitError?.message || JSON.stringify(submitted))
  }

  const { data: liveBefore, error: liveBeforeError } = await teacher.client.rpc('rpc_class_live', { p_class_id: classId })
  check('teacher class progress read', !liveBeforeError && !liveBefore?.error, liveBeforeError?.message || liveBefore?.error)
  report.metrics.classSummaryBefore = liveBefore?.summary || null

  const { data: started, error: startError } = await teacher.client.rpc('rpc_start_class_session', {
    p_class_id: classId,
    p_title: '출시검증 수업',
  })
  check('teacher starts class', !startError && Boolean(started?.session_id), startError?.message || started?.error)
  const sessionId = started?.session_id

  const focus = {
    kind: 'question',
    subject: 'job-common',
    area: '의사소통',
    lesson: 'JC26-COM-LISTEN',
    index: 2,
    questionId: 'JC26-KO-LISTEN-03',
    label: '학습 · 의사소통 · 경청 · 3/10',
  }
  const { data: focusResult, error: focusError } = await teacher.client.rpc('rpc_set_class_focus', {
    p_session_id: sessionId,
    p_focus: focus,
  })
  check('teacher publishes lesson focus', !focusError && !focusResult?.error, focusError?.message || focusResult?.error)

  const { data: studentSession, error: studentSessionError } = await student.client.rpc('rpc_my_class_session')
  check('student sees active class', !studentSessionError && studentSession?.session_id === sessionId, studentSessionError?.message)
  check('student sees exact teacher focus', studentSession?.focus?.questionId === focus.questionId && studentSession?.focus?.index === focus.index, JSON.stringify(studentSession?.focus))

  const { data: ping, error: pingError } = await student.client.rpc('rpc_presence_ping', {
    p_session_id: sessionId,
    p_state: 'active',
  })
  check('student presence ping', !pingError && ping?.ok === true, pingError?.message || ping?.error)
  check('focus returns with presence', ping?.focus?.questionId === focus.questionId, JSON.stringify(ping?.focus))

  const { data: presence, error: presenceError } = await teacher.client.rpc('rpc_class_presence', { p_class_id: classId })
  const studentPresence = presence?.students?.find(row => row.student_id === student.profile.id)
  check('teacher sees student active', !presenceError && studentPresence?.shown === 'active', presenceError?.message || studentPresence?.shown)
  report.metrics.presenceSummary = presence?.summary || null

  const { data: syncResult, error: syncError } = await student.client.rpc('rpc_sync_progress', {
    p_payload: { reviews: [], wrong: [], resolved: [], activity: { study: 1, quiz: 0, mission: 0 }, correct: 0 },
  })
  check('student progress sync', !syncError && !syncResult?.error, syncError?.message || syncResult?.error)

  const { data: liveAfter, error: liveAfterError } = await teacher.client.rpc('rpc_class_live', { p_class_id: classId })
  const liveStudent = liveAfter?.students?.find(row => row.student_id === student.profile.id)
  check('teacher sees student progress', !liveAfterError && Number(liveStudent?.solved) >= 1, liveAfterError?.message || JSON.stringify(liveStudent))
  report.metrics.classSummaryAfter = liveAfter?.summary || null

  const marker = `[출시검증 ${new Date().toISOString()}]`
  const { data: sent, error: sendError } = await teacher.client.rpc('rpc_send_message', {
    p_scope: 'personal',
    p_target: student.profile.id,
    p_title: `${marker} 학습 연결 확인`,
    p_body: '교사 화면에서 보낸 자동 검증 메시지입니다.',
    p_type: 'encourage',
  })
  check('teacher sends personal message', !sendError && sent?.sent === 1, sendError?.message || JSON.stringify(sent))

  const { data: received, error: receivedError } = await student.client
    .from('notifications').select('id, title, body, sender_id, type').eq('user_id', student.profile.id)
    .like('title', `${marker}%`).order('created_at', { ascending: false }).limit(1).maybeSingle()
  check('student receives teacher message', !receivedError && received?.sender_id === teacher.profile.id, receivedError?.message)

  const { data: replied, error: replyError } = await student.client.rpc('rpc_reply_message', {
    p_notification_id: received?.id,
    p_body: '학생 답장 자동 검증 완료',
  })
  check('student replies to teacher', !replyError && replied?.ok === true, replyError?.message || replied?.error)

  const { data: inbox, error: inboxError } = await teacher.client.rpc('rpc_teacher_inbox', { p_limit: 50 })
  const replyFound = Array.isArray(inbox) && inbox.some(item => item.reply_to === received?.id)
  check('teacher receives student reply', !inboxError && replyFound, inboxError?.message)

  const { data: schoolClasses, error: schoolClassesError } = await schoolAdmin.client
    .from('classes').select('id, name').eq('school_id', schoolAdmin.profile.school_id)
  check('school admin class management read', !schoolClassesError && Array.isArray(schoolClasses), schoolClassesError?.message)
  report.metrics.schoolClassCount = Array.isArray(schoolClasses) ? schoolClasses.length : null

  const { data: adminMembers, error: adminMembersError } = await schoolAdmin.client.rpc('rpc_admin_members')
  check('school admin member management read', !adminMembersError && Array.isArray(adminMembers), adminMembersError?.message)
  const schoolStudent = adminMembers?.find(member => member.id === student.profile.id)
  const { data: memberHistory, error: memberHistoryError } = await schoolAdmin.client.rpc('rpc_admin_member_history', {
    p_user_id: student.profile.id,
  })
  check('school admin member history read', !memberHistoryError && Array.isArray(memberHistory?.submissions), memberHistoryError?.message)

  const { data: sameUpdate, error: sameUpdateError } = await schoolAdmin.client.rpc('rpc_admin_update_user', {
    p_user_id: student.profile.id,
    p_display_name: student.profile.display_name,
    p_nickname: schoolStudent?.nickname ?? null,
    p_email: schoolStudent?.email ?? null,
    p_role: 'student',
    p_school_id: student.profile.school_id,
    p_class_id: classId,
    p_approved: true,
  })
  check('school admin scoped member update', !sameUpdateError && sameUpdate?.ok === true, sameUpdateError?.message)

  const { data: samePassword, error: samePasswordError } = await schoolAdmin.client.rpc('rpc_admin_reset_password', {
    p_user_id: student.profile.id,
    p_new_password: password,
  })
  check('school admin scoped password reset', !samePasswordError && samePassword?.ok === true, samePasswordError?.message)

  const tempEmail = `release-check-${Date.now()}@sugarsalt.invalid`
  const { data: tempUser, error: tempUserError } = await schoolAdmin.client.rpc('rpc_admin_create_user', {
    p_email: tempEmail,
    p_password: password,
    p_display_name: '출시검증 임시학생',
    p_role: 'student',
    p_school_id: schoolAdmin.profile.school_id,
    p_class_id: classId,
    p_nickname: '검증임시',
  })
  const tempUserId = typeof tempUser === 'string' ? tempUser : tempUser?.user_id
  check('school admin creates scoped member', !tempUserError && Boolean(tempUserId), tempUserError?.message || JSON.stringify(tempUser))
  if (tempUserId) {
    createdUserIds.push(tempUserId)
    const { error: deleteTempError } = await schoolAdmin.client.rpc('rpc_admin_delete_member', { p_uid: tempUserId })
    check('school admin deletes scoped member', !deleteTempError, deleteTempError?.message)
    if (!deleteTempError) createdUserIds.splice(createdUserIds.indexOf(tempUserId), 1)
  }

  const { data: teacherForbidden } = await teacher.client.rpc('rpc_create_class', {
    p_name: `${marker} should not create`,
    p_grade: 1,
    p_academic_year: new Date().getFullYear(),
  })
  check('teacher cannot create unassigned class', teacherForbidden?.error || teacherForbidden == null, JSON.stringify(teacherForbidden))
} finally {
  if (clients.student) {
    const { error: repeatCleanupError } = await clients.student.client.from('wrong_answers')
      .delete().eq('question_id', repeatQuestionId)
    check('repeat wrong-answer check cleaned up', !repeatCleanupError, repeatCleanupError?.message)
    const { error } = await clients.student.client.from('notifications')
      .delete().like('title', '[출시검증 %')
    check('student release-test messages cleaned up', !error, error?.message)
  }
  if (clients.teacher) {
    const { error } = await clients.teacher.client.from('notifications')
      .delete().like('title', '%답장: [출시검증 %')
    check('teacher release-test replies cleaned up', !error, error?.message)
  }
  if (createdMissionIds.length && clients.teacher) {
    const { error } = await clients.teacher.client.from('missions').delete().in('id', createdMissionIds)
    check('release-test missions cleaned up', !error, error?.message)
  }
  if (createdUserIds.length && clients.school_admin) {
    for (const userId of createdUserIds) {
      const { error } = await clients.school_admin.client.rpc('rpc_admin_delete_member', { p_uid: userId })
      check(`temporary member cleanup ${userId}`, !error, error?.message)
    }
  }
  if (classId && clients.teacher) {
    const { data, error } = await clients.teacher.client.rpc('rpc_end_class_session', { p_class_id: classId })
    check('teacher ends class', !error && Number(data?.ended) >= 0, error?.message)
  }
  for (const entry of Object.values(clients)) await entry.client.auth.signOut()
  fs.mkdirSync('output', { recursive: true })
  fs.writeFileSync('output/production-flow-report.json', `${JSON.stringify(report, null, 2)}\n`)
}

const failures = report.checks.filter(item => !item.pass)
console.log(`Production flow checks: ${report.checks.length - failures.length}/${report.checks.length} passed`)
for (const item of report.checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? `: ${item.detail}` : ''}`)
if (failures.length) process.exitCode = 1

function check(name, pass, detail = '') {
  report.checks.push({ name, pass: Boolean(pass), detail: detail || '' })
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }))
}
