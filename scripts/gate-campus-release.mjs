import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { STUDENT_CAMPUS_HALLS } from '../src/lib/studentCampusRoutes.js'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const errors = []
const read = path => readFileSync(join(root, path), 'utf8')

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const teacherLearningPreview = read('src/screens/teacher/TeacherLearningPreview.jsx')
const teacherLessonCoach = read('src/screens/teacher/TeacherLessonCoach.jsx')
const courseList = read('src/screens/student/CourseListScreen.jsx')
const studentShell = read('src/screens/student/StudentShell.jsx')
const listening = read('src/screens/student/ListeningPrompt.jsx')
const diagnostic = read('src/screens/student/DiagnosticScreen.jsx')
const study = read('src/screens/student/StudyScreen.jsx')
const missionCreate = read('src/screens/teacher/MissionCreateScreen.jsx')
const teacherShell = read('src/screens/teacher/TeacherShell.jsx')
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
