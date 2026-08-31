import fs from 'node:fs'
import { buildTeacherContextMaterials } from '../src/lib/teacherContextMaterials.js'
import { STUDENT_CAMPUS_HALLS } from '../src/lib/studentCampusRoutes.js'
import {
  demoClassDiagnostics,
  demoClassPersonality,
  demoClassProgress,
  demoClassResults,
  demoClassWeakness,
} from '../src/lib/teacherDemoAnalytics.js'

const errors = []
const read = path => fs.readFileSync(path, 'utf8')
const json = path => JSON.parse(read(path))

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const missionCreate = read('src/screens/teacher/MissionCreateScreen.jsx')
const missionRun = read('src/screens/student/MissionScreen.jsx')
const teacherShell = read('src/screens/teacher/TeacherShell.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const teacherLearningPreview = read('src/screens/teacher/TeacherLearningPreview.jsx')
const teacherLayout = read('src/lib/teacherLayout.js')
const app = read('src/App.jsx')
const bootstrapMigration = read('supabase/migrations/20260825000000_bootstrap_mission_subject.sql')
const classProgressMigration = read('supabase/migrations/20260826200000_class_lesson_progress.sql')
const autonomousPresenceMigration = read('supabase/migrations/20260831090000_autonomous_learning_presence.sql')
const learningPresence = read('src/lib/learningPresence.js')
const css = read('src/index.css')
const campusCss = read('src/styles/campus.css')
const coverReviewCss = read('src/styles/cover-letter-review.css')
const coverReview = read('src/screens/teacher/CoverLetterReviewScreen.jsx')
const interviewCareer = read('src/screens/student/InterviewCareerLab.jsx')
const interviewCareerCss = read('src/styles/interview-career.css')
const courseList = read('src/screens/student/CourseListScreen.jsx')
const studentShell = read('src/screens/student/StudentShell.jsx')
const studentHome = read('src/screens/student/StudentCampusHome.jsx')
const classJourney = read('src/lib/classLessonJourney.js')
const studentJourney = read('src/lib/studentLearningJourney.js')
const practicalCss = read('src/styles/interview-practical.css')
const diagnosticsScreen = read('src/screens/teacher/ClassDiagnosticsScreen.jsx')
const weaknessScreen = read('src/screens/teacher/ClassWeaknessScreen.jsx')
const progressScreen = read('src/screens/teacher/ClassProgressScreen.jsx')
const resultsScreen = read('src/screens/teacher/ClassResultsScreen.jsx')
const personalityScreen = read('src/screens/teacher/ClassPersonalityScreen.jsx')

if (!classroom.includes('TeacherLearningPreview') || !classroom.includes('teachingMode')) {
  errors.push('Classroom does not render the shared student learning surface')
}
if (classroom.includes('DeckProjector') || classroom.includes('ClassroomQuestion')) {
  errors.push('Classroom still renders a separately authored teaching deck')
}
for (const hall of STUDENT_CAMPUS_HALLS) {
  if (!courseList.includes(`id: '${hall.id}'`)) errors.push(`Shared classroom hall is missing: ${hall.id}`)
}

for (const subject of ["'interview':", "'personality':"]) {
  if (!missionRun.includes(subject)) errors.push(`Student mission pool is missing: ${subject}`)
}

if (!missionCreate.includes('PERSONALITY_AREAS')) errors.push('Personality mission areas are not connected')
if (!missionCreate.includes('guidedQuestionIds')) errors.push('Guided mission question IDs are not resolved')
if (teacherShell.includes('enterProjection(')) errors.push('Teacher workspace toggle still enters fullscreen')
if (!teacherShell.includes('자동 맞춤') || !teacherShell.includes('넓게 보기')) errors.push('Teacher layout controls are ambiguous')
if (teacherShell.includes("if (layout.effective !== 'wide') return")) errors.push('Teacher class data is still restricted to wide layout')
if (teacherShell.includes("navigate('mission-create')")) errors.push('Teacher mission shortcut uses an unhandled route')
if (!teacherWorkspace.includes('teacher-empty-workspace')) errors.push('Teacher no-class workspace is missing preparation tools')
if (!teacherWorkspace.includes('ClassLessonJourney') || !teacherWorkspace.includes(".from('class_sessions')")) errors.push('Teacher class-specific lesson journey is missing')
if (!teacherShell.includes('demo={Boolean(isTrial)}')) errors.push('Public teacher trial does not demonstrate multiple class journeys')
if (!teacherWorkspace.includes('demo={demo}')) errors.push('Teacher analytics panes do not receive the trial-data boundary')
for (const [name, source, marker] of [
  ['diagnostics', diagnosticsScreen, 'demoClassDiagnostics(classId)'],
  ['weakness', weaknessScreen, 'demoClassWeakness(classId)'],
  ['progress', progressScreen, 'demoClassProgress(classId)'],
  ['results', resultsScreen, 'demoClassResults(classId)'],
  ['personality', personalityScreen, 'demoClassPersonality(classId)'],
]) {
  if (!source.includes(marker)) errors.push(`Teacher trial ${name} pane can still query the production database with a demo class ID`)
}
for (const [name, source] of [
  ['diagnostics', diagnosticsScreen],
  ['weakness', weaknessScreen],
  ['progress', progressScreen],
  ['personality', personalityScreen],
]) {
  if (!source.includes('if (!onBack) return') || !source.includes('{onBack && <button')) {
    errors.push(`Embedded teacher ${name} pane can expose a no-op back control or consume Android back`)
  }
}
if (!resultsScreen.includes('{onBack && <button')) errors.push('Embedded teacher results pane exposes a no-op back control')
if (!teacherShell.includes('<TeacherInterviewPracticeScreen') || !teacherShell.includes('demo={Boolean(isTrial)}')) {
  errors.push('Teacher interview coaching does not receive trial classes and students')
}
if (!teacherWorkspace.includes('initialContext') || !teacherShell.includes('initialClassId={screen.classId}')) errors.push('Selected class and resume position do not reach the classroom')
if (!classJourney.includes('STUDENT_CAMPUS_HALLS.map') || !classJourney.includes('completedCount') || !classJourney.includes('inProgressCount')) errors.push('Six-hall class journey states are incomplete')
if (!classProgressMigration.includes('class_lesson_progress') || !classProgressMigration.includes('completed_at') || !classProgressMigration.includes('rpc_set_class_focus')) errors.push('Class lesson progress persistence is missing')
if (!studentHome.includes('learning-compass') || !studentHome.includes('buildStudentLearningRoutes') || !studentJourney.includes('GOALS') || !studentJourney.includes('nextLabel')) errors.push('Student subject goals and next-learning route are missing')
if (!studentShell.includes('rememberStudentLearningContext')) errors.push('Student resume position is not recorded from the shared learning context')
if (!teacherLearningPreview.includes('ClassroomConnectionPanel') || !teacherLearningPreview.includes("rpc('rpc_class_presence'")) {
  errors.push('Shared classroom cannot show student connection state')
}
if (!teacherWorkspace.includes('presence_label') || !teacherWorkspace.includes('participated') || !teacherWorkspace.includes('30_000')) {
  errors.push('Teacher workspace still confuses today activity with current learning presence')
}
if (!learningPresence.includes('rpc_learning_presence_ping') || !autonomousPresenceMigration.includes('REVOKE ALL ON TABLE')) {
  errors.push('Autonomous learning presence is missing its privacy boundary')
}
if (teacherWorkspace.includes('문항·훈화·수업 덱')) errors.push('Teacher workspace still advertises the retired classroom deck')
if (teacherLearningPreview.includes('setCoachOpen(true)') &&
    (!teacherLearningPreview.includes('initialCoachOpen') ||
      !teacherLearningPreview.includes('restoreCoachRef.current') ||
      !teacherLearningPreview.includes('!contextReady'))) {
  errors.push('Teacher lesson support opens without an explicit classroom-transition restore guard')
}
if (teacherLearningPreview.includes('useState(true)') && teacherLearningPreview.includes('coachOpen')) {
  errors.push('Teacher lesson support still opens automatically')
}
if (!campusCss.includes('.teacher-lesson-coach { position: absolute;')) errors.push('Teacher lesson support still consumes the student lesson layout')
if (!campusCss.includes('.teacher-learning-preview.is-teaching .teacher-preview-body')) errors.push('Shared classroom responsive layout is missing')
if (!css.includes('html.shared-classroom-mode #root')) errors.push('Shared classroom cannot leave the desktop phone frame')
if (!teacherLearningPreview.includes('toggleClassroomFocus') || !teacherLearningPreview.includes('classroom-focus-bar')) {
  errors.push('Shared classroom focus mode or its exit control is missing')
}
for (const [capability, marker] of [
  ['stepped classroom zoom', 'CLASSROOM_ZOOM_LEVELS'],
  ['persisted classroom zoom', 'CLASSROOM_ZOOM_STORAGE_KEY'],
  ['mouse drag panning', 'onPointerMove={movePan}'],
  ['arrow-key panning', 'ArrowRight: [distance, 0]'],
  ['zoom reset control', 'onReset={() => applyClassroomZoom(1)}'],
]) {
  if (!teacherLearningPreview.includes(marker)) errors.push(`Shared classroom is missing ${capability}`)
}
if (!campusCss.includes('.teacher-preview-stage.is-pannable') || !campusCss.includes('cursor: grab')) {
  errors.push('Enlarged classroom content cannot be panned without leaving the lesson')
}
if (!campusCss.includes('.teacher-learning-preview.is-focus .teacher-preview-context { display: none; }')) {
  errors.push('Classroom focus mode still leaves teacher-only chrome on screen')
}
if (!css.includes('html.classroom-focus-mode .trial-session-bar { display: none; }')) {
  errors.push('Public trial status bar still consumes classroom focus space')
}
if (!teacherLearningPreview.includes("rpc('rpc_start_class_session'") || !teacherLearningPreview.includes("rpc('rpc_set_class_focus'")) {
  errors.push('Shared classroom does not connect the active student learning position')
}
if (!studentShell.includes('classSession.focus?.subject') || !studentShell.includes("mode: focus.mode || 'study'")) {
  errors.push('Student follow cannot open every shared classroom learning mode')
}
if (app.includes('window.location.reload()')) errors.push('Native update startup can still force a WebView reload')
if (!app.includes("localStorage.setItem(KEY, String(info.build || '0'))")) errors.push('Native update build marker is missing')
if (!teacherLayout.includes("width >= 860 ? 'wide' : 'tall'")) errors.push('Narrow-screen wide-layout guard is missing')
if (!bootstrapMigration.includes('ms.subject_id')) errors.push('Student bootstrap still drops mission subject_id')
if (courseList.includes('원하는 학습 기능을 바로 선택하세요')) errors.push('Non-clickable learning legend still describes itself as selectable')
if (!interviewCareer.includes('SECTOR_FORM_EXAMPLES') || interviewCareer.includes('placeholder="예: 한국전력공사"')) {
  errors.push('Cover-letter application placeholders are not sector-specific')
}
if (!interviewCareerCss.includes('padding-bottom: calc(92px + env(safe-area-inset-bottom))')) {
  errors.push('Cover-letter sticky actions can overlap the final content')
}

const demoAnswerLengths = [...coverReview.matchAll(/  (\w+): `([^`]*)`/g)]
  .filter(([, key]) => /^(ibk|kepco)/.test(key))
  .map(([, key, answer]) => [key, [...answer].length])
if (demoAnswerLengths.length !== 6) errors.push(`Expected 6 complete cover-letter demo answers, found ${demoAnswerLengths.length}`)
for (const [key, length] of demoAnswerLengths) {
  const max = key === 'ibkContribution' ? 650 : 700
  if (length < 500 || length > max) errors.push(`Cover-letter demo ${key} is outside its guide: ${length}/500-${max}`)
}

for (const [name, source, selector] of [
  ['Teacher message screen', campusCss, '.teacher-message'],
  ['Cover letter review screen', coverReviewCss, '.cover-review-screen'],
  ['Teacher practical interview screen', practicalCss, '.teacher-practical-screen'],
]) {
  const block = source.split(`${selector} {`)[1]?.split('}')[0] ?? ''
  if (!block.includes('height: 100%') || !block.includes('min-height: 0')) {
    errors.push(`${name} can lose its mobile scroll root`)
  }
}

const talks = json('data/morning-talks.json')
for (const talk of talks) {
  if (!talk.id || !talk.title || !talk.body) errors.push(`Malformed morning talk: ${talk.id ?? '(no id)'}`)
  if (talk.question && typeof talk.question !== 'object') errors.push(`Morning talk question is not structured: ${talk.id}`)
  if (talk.question && (!talk.question.stem || !Array.isArray(talk.question.choices))) errors.push(`Morning talk question fields are incomplete: ${talk.id}`)
  if (talk.teacherNote && typeof talk.teacherNote !== 'object') errors.push(`Morning talk teacher note is not structured: ${talk.id}`)
}

const interview = json('data/interview-quiz.json').questions ?? []
const personality = json('data/personality-test-bank.json')
if (interview.length < 100) errors.push(`Interview mission pool too small: ${interview.length}`)
if ((personality.items ?? []).filter(item => item.kind === 'trait').length < 500) errors.push('Personality mission pool is incomplete')

const contextQuestion = json('data/questions.json').find(question => question.id === 'JC-RSM-C020')
if (!contextQuestion) {
  errors.push('Teacher context verification question is missing')
} else {
  const hidden = buildTeacherContextMaterials(
    { stage: 'question', revealed: false, content: { kind: 'question', question: contextQuestion } },
    {},
    { publicView: true },
  )
  const revealed = buildTeacherContextMaterials(
    { stage: 'question', revealed: true, content: { kind: 'question', question: contextQuestion } },
    {},
    { publicView: true },
  )
  const hiddenText = JSON.stringify(hidden)
  const correctChoice = contextQuestion.choices[1]
  if (hidden.answerSummary || hiddenText.includes(correctChoice)) errors.push('Classroom context reveals the answer before reveal')
  if (!hidden.explanations.some(line => line.includes('선지 확인 항목'))) errors.push('Classroom context lacks question-specific pre-reveal support')
  if (!revealed.answerSummary || !revealed.good.length || revealed.bad.length < 3) errors.push('Classroom context lacks post-reveal answer cases')
  if (revealed.bad.some(item => item.detail.includes('조건 중 하나'))) errors.push('Classroom context still uses generic wrong-choice feedback')
}

for (const classId of ['c1', 'c2', 'c3']) {
  const diagnostics = demoClassDiagnostics(classId)
  const weakness = demoClassWeakness(classId)
  const progress = demoClassProgress(classId)
  const results = demoClassResults(classId)
  const personalityRows = demoClassPersonality(classId)
  if (!diagnostics.length || !diagnostics.some(row => row.total > 0)) errors.push(`Teacher demo ${classId} has no diagnostic results`)
  if (!weakness.areas.length || !weakness.students.length) errors.push(`Teacher demo ${classId} has no weakness analysis`)
  if (!progress.students.length || !progress.subjects.length) errors.push(`Teacher demo ${classId} has no learning progress`)
  if (!results.missions.length || !results.rankings.length) errors.push(`Teacher demo ${classId} has no formative results`)
  if (!personalityRows.some(row => row.profile.length)) errors.push(`Teacher demo ${classId} has no personality tendency data`)
}

if (errors.length) {
  console.error('Teacher release verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`PASS: Teacher release verification (${STUDENT_CAMPUS_HALLS.length} shared classroom halls, ${talks.length} talks, ${interview.length} interview questions, ${personality.items.length} personality items)`)
