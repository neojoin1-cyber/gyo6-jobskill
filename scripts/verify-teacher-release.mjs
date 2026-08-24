import fs from 'node:fs'

const errors = []
const read = path => fs.readFileSync(path, 'utf8')
const json = path => JSON.parse(read(path))

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const deckProjector = read('src/screens/teacher/DeckProjector.jsx')
const missionCreate = read('src/screens/teacher/MissionCreateScreen.jsx')
const missionRun = read('src/screens/student/MissionScreen.jsx')
const teacherShell = read('src/screens/teacher/TeacherShell.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const teacherLayout = read('src/lib/teacherLayout.js')
const app = read('src/App.jsx')
const bootstrapMigration = read('supabase/migrations/20260825000000_bootstrap_mission_subject.sql')
const css = read('src/index.css')

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
if (app.includes('window.location.reload()')) errors.push('Native update startup can still force a WebView reload')
if (!app.includes("localStorage.setItem(KEY, String(info.build || '0'))")) errors.push('Native update build marker is missing')
if (!teacherLayout.includes("width >= 860 ? 'wide' : 'tall'")) errors.push('Narrow-screen wide-layout guard is missing')
if (!bootstrapMigration.includes('ms.subject_id')) errors.push('Student bootstrap still drops mission subject_id')
if (!css.includes('.screen-header {') || !css.includes('.classroom-entry {')) errors.push('Classroom lobby styling is missing')

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

if (errors.length) {
  console.error('Teacher release verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`PASS: Teacher release verification (${talks.length} talks, ${deckIndex.length} deck subjects, ${interview.length} interview questions, ${personality.items.length} personality items)`)
