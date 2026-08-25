import fs from 'node:fs'
import { buildTeacherContextMaterials } from '../src/lib/teacherContextMaterials.js'

const errors = []
const read = path => fs.readFileSync(path, 'utf8')
const json = path => JSON.parse(read(path))

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const deckProjector = read('src/screens/teacher/DeckProjector.jsx')
const missionCreate = read('src/screens/teacher/MissionCreateScreen.jsx')
const missionRun = read('src/screens/student/MissionScreen.jsx')
const teacherShell = read('src/screens/teacher/TeacherShell.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const teacherLearningPreview = read('src/screens/teacher/TeacherLearningPreview.jsx')
const teacherLayout = read('src/lib/teacherLayout.js')
const app = read('src/App.jsx')
const bootstrapMigration = read('supabase/migrations/20260825000000_bootstrap_mission_subject.sql')
const css = read('src/index.css')
const campusCss = read('src/styles/campus.css')
const coverReviewCss = read('src/styles/cover-letter-review.css')
const practicalCss = read('src/styles/interview-practical.css')

for (const id of ['moe', 'ncs', 'recruit', 'interview', 'personality']) {
  if (!classroom.includes(`${id}: {`)) errors.push(`Classroom subject is missing: ${id}`)
}

for (const subject of ["'interview':", "'personality':"]) {
  if (!missionRun.includes(subject)) errors.push(`Student mission pool is missing: ${subject}`)
}

if (!missionCreate.includes('PERSONALITY_AREAS')) errors.push('Personality mission areas are not connected')
if (!missionCreate.includes('guidedQuestionIds')) errors.push('Guided mission question IDs are not resolved')
if (!deckProjector.includes('function useSwipe(')) errors.push('Deck projector swipe hook is undefined')
if (teacherShell.includes('enterProjection(')) errors.push('Teacher workspace toggle still enters fullscreen')
if (!teacherShell.includes('자동 맞춤') || !teacherShell.includes('넓게 보기')) errors.push('Teacher layout controls are ambiguous')
if (teacherShell.includes("if (layout.effective !== 'wide') return")) errors.push('Teacher class data is still restricted to wide layout')
if (teacherShell.includes("navigate('mission-create')")) errors.push('Teacher mission shortcut uses an unhandled route')
if (!teacherWorkspace.includes('teacher-empty-workspace')) errors.push('Teacher no-class workspace is missing preparation tools')
if (teacherLearningPreview.includes('setCoachOpen(true)')) errors.push('Teacher lesson support still opens automatically')
if (!campusCss.includes('.teacher-lesson-coach { position: absolute;')) errors.push('Teacher lesson support still consumes the student lesson layout')
if (!css.includes('.classroom-context-guide {\n  position: absolute;')) errors.push('Classroom lesson support still consumes the projector layout')
if (app.includes('window.location.reload()')) errors.push('Native update startup can still force a WebView reload')
if (!app.includes("localStorage.setItem(KEY, String(info.build || '0'))")) errors.push('Native update build marker is missing')
if (!teacherLayout.includes("width >= 860 ? 'wide' : 'tall'")) errors.push('Narrow-screen wide-layout guard is missing')
if (!bootstrapMigration.includes('ms.subject_id')) errors.push('Student bootstrap still drops mission subject_id')
if (!css.includes('.screen-header {') || !css.includes('.classroom-entry {')) errors.push('Classroom lobby styling is missing')

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

const deckIndex = json('data/decks/index.json').filter(subject => subject.id !== 'job-common')
for (const subject of deckIndex) {
  const lessons = json(`data/decks/${subject.id}.json`)
  if (!Array.isArray(lessons) || !lessons.length) errors.push(`Deck data is empty: ${subject.id}`)
  for (const lesson of lessons) {
    for (const chapter of lesson.chapters ?? []) {
      if (!Array.isArray(chapter.beats) || !chapter.beats.length) errors.push(`Deck chapter has no beats: ${subject.id}/${lesson.code}/${chapter.cno}`)
    }
  }
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

if (errors.length) {
  console.error('Teacher release verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`PASS: Teacher release verification (${talks.length} talks, ${deckIndex.length} deck subjects, ${interview.length} interview questions, ${personality.items.length} personality items)`)
