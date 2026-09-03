import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { STUDENT_CAMPUS_HALLS } from '../src/lib/studentCampusRoutes.js'
import { formatReadableScenario, formatStructuredLearningText } from '../src/lib/structuredLearningText.js'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const errors = []
const read = path => readFileSync(join(root, path), 'utf8')

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const teacherLearningPreview = read('src/screens/teacher/TeacherLearningPreview.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const teacherLessonCoach = read('src/screens/teacher/TeacherLessonCoach.jsx')
const courseList = read('src/screens/student/CourseListScreen.jsx')
const studentHome = read('src/screens/student/StudentCampusHome.jsx')
const studentShell = read('src/screens/student/StudentShell.jsx')
const learningPresence = read('src/lib/learningPresence.js')
const autonomousPresenceMigration = read('supabase/migrations/20260831090000_autonomous_learning_presence.sql')
const supabaseClient = read('src/lib/supabase.js')
const notifications = read('src/screens/student/NotificationsScreen.jsx')
const listening = read('src/screens/student/ListeningPrompt.jsx')
const diagnostic = read('src/screens/student/DiagnosticScreen.jsx')
const study = read('src/screens/student/StudyScreen.jsx')
const studySummary = read('src/screens/student/StudySummary.jsx')
const missionCreate = read('src/screens/teacher/MissionCreateScreen.jsx')
const teacherShell = read('src/screens/teacher/TeacherShell.jsx')
const campusCss = read('src/styles/campus.css')
const questions = JSON.parse(read('data/questions.json'))

if (!classroom.includes('TeacherLearningPreview') || !classroom.includes('teachingMode')) {
  errors.push('Teacher classroom does not reuse the shared student learning surface')
}
if (classroom.includes('DeckProjector') || classroom.includes('ClassroomQuestion')) {
  errors.push('Teacher classroom still depends on a separately authored deck or question surface')
}
if (!teacherLearningPreview.includes('StudentCampusHome') || !teacherLearningPreview.includes('CourseListScreen')) {
  errors.push('Shared classroom is not connected to the student campus and course screens')
}
if (!teacherLearningPreview.includes('onContextChange={setLearningContext}')) {
  errors.push('Shared classroom cannot derive teacher support from the active student lesson')
}
if (!teacherLearningPreview.includes('if (!desktopPresentation || typeof window') ||
    !teacherLearningPreview.includes('return 1\n  } catch {\n    return 1')) {
  errors.push('Teacher classroom must start at a complete 100% view before optional enlargement')
}
if (!teacherLearningPreview.includes('ClassroomConnectionPanel') ||
    !teacherLearningPreview.includes('setPresence(data)') ||
    !teacherLearningPreview.includes('학생 앱 위치 전달')) {
  errors.push('교실 수업 화면의 학생 연결 현황 또는 학생 앱 위치 전달 표시가 빠졌습니다.')
}
if (!teacherWorkspace.includes('30_000') || !teacherWorkspace.includes('presence_state') ||
    !teacherWorkspace.includes('지금 학습 중') || !teacherWorkspace.includes('현재 상태·위치')) {
  errors.push('교사 자율학습 관리 화면이 실제 접속 상태를 자동 갱신하지 않습니다.')
}
if (!studentShell.includes('자율학습 연결') || !studentShell.includes('sharingSelfStudy') ||
    !learningPresence.includes("ping('away'") || !learningPresence.includes('visibilitychange')) {
  errors.push('학생 자율학습 연결이 공개 고지 또는 화면 이탈 상태를 빠뜨렸습니다.')
}
for (const marker of ['student_learning_presence', 'rpc_learning_presence_ping', 'presence_state', "interval '210 seconds'"]) {
  if (!autonomousPresenceMigration.includes(marker)) errors.push(`자율학습 연결 데이터 계약 누락: ${marker}`)
}
const trialRpcBlock = supabaseClient.split('const TRIAL_READ_RPCS')[1]?.split('])')[0] || ''
if (trialRpcBlock.includes('rpc_learning_presence_ping')) {
  errors.push('공개 체험이 자율학습 연결 상태를 운영 서버에 기록할 수 있습니다.')
}
for (const phrase of ['개인 판단', '짝 비교', '재선택', '이유 듣기', '한 문장 정리']) {
  if (!teacherLessonCoach.includes(phrase)) errors.push(`Teacher lesson rhythm is missing: ${phrase}`)
}
if (!teacherLessonCoach.includes('window.setInterval') || !teacherLessonCoach.includes('secondsLeft')) {
  errors.push('Teacher lesson coach does not provide a local classroom timer')
}
if (!studentShell.includes("mode: focus.mode || 'study'")) {
  errors.push('Student classroom follow drops diagnostic, mock, or practical learning modes')
}
for (const hall of STUDENT_CAMPUS_HALLS) {
  if (!courseList.includes(`id: '${hall.id}'`)) errors.push(`Shared classroom course is missing: ${hall.id}`)
}

const campusMapPosition = studentHome.indexOf('className="campus-map"')
const nextStepPosition = studentHome.indexOf('className="mission-dock campus-next-step"')
if (campusMapPosition < 0 || nextStepPosition < 0 || campusMapPosition > nextStepPosition) {
  errors.push('Student home must show the campus map before the recommended next-step card')
}
if (!/\.campus-topbar\s*\{[^}]*min-height:\s*calc\([^)]*var\(--safe-top\)/s.test(campusCss)
  || !/\.campus-topbar\s*\{[^}]*padding:\s*calc\([^)]*var\(--safe-top\)/s.test(campusCss)) {
  errors.push('Student campus header must reserve the native system-bar safe area')
}

const structuredStageText = formatStructuredLearningText('개발 단계별 정보: –기획단계(5일): A팀원만 가능 –UI설계(4일): B팀원만 가능')
const structuredProjectText = formatStructuredLearningText('【프로젝트 추진 현황】프로젝트명: 스마트 오피스PM: 기획팀■ 1단계(완료): 현황 분석회의 결정: A업체 추진')
const structuredDateText = formatReadableScenario('작성일: 2024.03.15.다음은 확정된 일정입니다.')
const structuredNoticeText = formatStructuredLearningText('전 직원 공지사항 제목: 정전 안내 일시: 2024.03.15 14:30 사유: 전기설비 점검 조치사항: 재택근무 문의: 총무팀')
if (!structuredStageText.includes('\n- 기획단계') || !structuredStageText.includes('\n- UI설계')) {
  errors.push('Learning source formatter does not separate stage bullets into readable lines')
}
for (const line of ['프로젝트명:', 'PM:', '■ 1단계', '회의 결정:']) {
  if (!structuredProjectText.split('\n').some(value => value.startsWith(line))) {
    errors.push(`Learning source formatter does not separate document field: ${line}`)
  }
}
if (!structuredDateText.includes('2024.03.15.') || structuredDateText.includes('2024.\n03.') || !structuredDateText.includes('\n다음은')) {
  errors.push('Learning source formatter must preserve dates while separating actual sentences')
}
for (const line of ['제목:', '일시: 2024.03.15', '사유:', '조치사항:', '문의:']) {
  if (!structuredNoticeText.split('\n').some(value => value.startsWith(line))) {
    errors.push(`Learning source formatter does not separate notice field: ${line}`)
  }
}
if (!study.includes('data-question-context') || !study.includes('formatStructuredLearningText(q?.context || embCtx)')) {
  errors.push('Document-like question passages are not rendered with readable source structure')
}
if (!studySummary.includes('pointRequiresReconsideration') || !studySummary.includes('Boolean(reconsidered[step])')) {
  errors.push('Changed-condition transfer activity can still be skipped')
}

if (!studentShell.includes('demo={Boolean(isTrial)}') || !studentShell.includes('<NotificationsScreen demo={Boolean(isTrial)}')) {
  errors.push('Student trial home and message screen do not share the same demo message source')
}
if (!notifications.includes(".from('notifications')") || notifications.includes(".eq('is_read', false)")) {
  errors.push('Read student messages are filtered out instead of being retained')
}
if (!notifications.includes(".delete().eq('id', id).eq('user_id', profile.id)")) {
  errors.push('Students cannot explicitly delete a retained message')
}

for (const label of ['교육부 · 대한상공회의소', '고용노동부']) {
  if (!STUDENT_CAMPUS_HALLS.some(hall => hall.authority.includes(label.replaceAll(' ', '')) || hall.authority.includes(label))) {
    errors.push(`Student home official destination is missing: ${label}`)
  }
}

if (listening.includes('disabled={!supported')) errors.push('MP3 playback is still blocked by browser speechSynthesis support')
if (!listening.includes("unlimited ? '수업에서는 필요한 만큼 다시 들을 수 있습니다.'")) {
  if (!listening.includes("'수업에서는 필요한 만큼 다시 들을 수 있습니다.'")) {
    errors.push('Teacher listening copy does not explain replayable classroom behavior')
  }
}
if (!listening.includes("'자율학습에서는 필요한 만큼 다시 들을 수 있습니다.'")) {
  errors.push('Self-study listening copy does not explain replayable learning behavior')
}
if (!read('src/screens/student/StudySummary.jsx').includes('mode="study"')) {
  errors.push('Self-study summary does not render its listening source as repeatable audio')
}
if (/\.\.\.card\s*,\s*borderColor/.test(diagnostic)) {
  errors.push('Diagnostic cards mix border shorthand with borderColor and trigger React style warnings')
}
if (!/async function loadPending\(\)\s*\{\s*if \(!profile\?\.id\) return/.test(teacherShell)) {
  errors.push('Teacher pending-count loader can read profile.id before the profile is ready')
}

const retiredContextPattern = /호텔|웨딩|연회|식음료서비스|품질경영/
const retiredContextQuestions = questions.filter(question =>
  !question.excludeFromQuiz && retiredContextPattern.test([
    question.stem,
    question.context,
    question.explanation,
    ...(question.choices || []),
  ].filter(Boolean).join(' '))
)
if (retiredContextQuestions.length) {
  errors.push(`Retired subject context leaked into active questions: ${retiredContextQuestions.slice(0, 5).map(question => question.id).join(', ')}`)
}
if (/food-service-questions|food-service-chapters|id:\s*'food-service'/.test(study)) {
  errors.push('Student study route still bundles the retired food-service course')
}
if (/food-service-questions|FOOD_SERVICE_AREAS|subjectId === 'food-service'/.test(missionCreate)) {
  errors.push('Teacher mission route still exposes the retired food-service course')
}

const requiredAssets = [
  'campus/skill-campus-map.webp',
  'campus/continue-travel.webp',
  'campus/stamp-listening.webp',
  'campus/stamp-expression.webp',
  'campus/stamp-perspective.webp',
  'learning/workplace-documents.webp',
  'learning/workplace-data.webp',
  'learning/workplace-teamwork.webp',
  'learning/workplace-interview.webp',
  'learning/workplace-reflection.webp',
]
for (const name of requiredAssets) {
  const path = join(root, 'public/images', name)
  if (!existsSync(path) || statSync(path).size < 10_000) errors.push(`Missing or undersized visual asset: ${name}`)
}

const audioDir = join(root, 'public/audio/listening')
const audioFiles = existsSync(audioDir) ? readdirSync(audioDir).filter(name => name.endsWith('.mp3')) : []
const englishBank = JSON.parse(read('data/jc-english-bank.json'))
const koreanListening = JSON.parse(read('data/jc-media-listening.json'))
const expectedAudio = [
  ...(englishBank.questions || []).filter(question => question.kind === 'dialog').map(question => ({ id: question.id, locale: 'en-US' })),
  ...(koreanListening.questions || []).filter(question => question.audioText).map(question => ({ id: question.id, locale: question.audioLang || 'ko-KR' })),
]
const expectedAudioFiles = new Set(expectedAudio.map(item => `${item.id}.mp3`))
const actualAudioFiles = new Set(audioFiles)
const missingAudio = [...expectedAudioFiles].filter(name => !actualAudioFiles.has(name))
const extraAudio = [...actualAudioFiles].filter(name => !expectedAudioFiles.has(name))
if (missingAudio.length) errors.push(`Listening audio files missing: ${missingAudio.slice(0, 8).join(', ')}`)
if (extraAudio.length) errors.push(`Unmapped listening audio files packaged: ${extraAudio.slice(0, 8).join(', ')}`)
const manifestPath = join(audioDir, 'manifest.json')
if (!existsSync(manifestPath)) errors.push('Listening audio manifest is missing')
else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.files?.length !== audioFiles.length) errors.push('Listening audio manifest coverage does not match packaged MP3 files')
  const manifestById = new Map((manifest.files || []).map(item => [item.questionId, item]))
  for (const expected of expectedAudio) {
    const item = manifestById.get(expected.id)
    const path = join(audioDir, `${expected.id}.mp3`)
    if (!item) { errors.push(`Listening manifest entry missing: ${expected.id}`); continue }
    if (item.locale !== expected.locale) errors.push(`Listening locale mismatch: ${expected.id} (${item.locale} / ${expected.locale})`)
    if (!existsSync(path)) continue
    const bytes = statSync(path).size
    const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex')
    if (bytes < 1_000 || item.bytes !== bytes) errors.push(`Listening byte size mismatch: ${expected.id}`)
    if (item.sha256 !== sha256) errors.push(`Listening hash mismatch: ${expected.id}`)
  }
}

if (errors.length) {
  console.error('Skill Campus release gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`PASS: Skill Campus release gate (${requiredAssets.length} visual assets, ${audioFiles.length} listening files, strict official-system boundaries)`)
