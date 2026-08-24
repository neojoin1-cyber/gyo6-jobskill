import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { STUDENT_CAMPUS_HALLS } from '../src/lib/studentCampusRoutes.js'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const errors = []
const read = path => readFileSync(join(root, path), 'utf8')

const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const listening = read('src/screens/student/ListeningPrompt.jsx')
const diagnostic = read('src/screens/student/DiagnosticScreen.jsx')

if (classroom.includes('JC_AREA_MAP')) errors.push('ClassroomScreen still imports or uses JC_AREA_MAP cross-system mapping')
if (classroom.includes('jumpToQuestions')) errors.push('Legacy deck-to-question automatic crosswalk is still enabled')
if (!classroom.includes("subject.id !== 'job-common'")) errors.push('Legacy authority-less job-common deck is not excluded')
if (!classroom.includes("quizSystem === 'ncs'")) errors.push('Teacher classroom does not expose a separated NCS path')
if (!classroom.includes('교육부 · 대한상공회의소 인증진단')) errors.push('Education/KCCI classroom label is missing')
if (!classroom.includes('고용노동부 · 한국산업인력공단 NCS')) errors.push('MOEL/HRDKorea NCS classroom label is missing')

for (const label of ['교육부 · 대한상공회의소', '고용노동부']) {
  if (!STUDENT_CAMPUS_HALLS.some(hall => hall.authority.includes(label.replaceAll(' ', '')) || hall.authority.includes(label))) {
    errors.push(`Student home official destination is missing: ${label}`)
  }
}

if (listening.includes('disabled={!supported')) errors.push('MP3 playback is still blocked by browser speechSynthesis support')
if (!listening.includes("unlimited ? '수업에서는 필요한 만큼 다시 들을 수 있습니다.'")) {
  errors.push('Teacher listening copy does not explain replayable classroom behavior')
}
if (/\.\.\.card\s*,\s*borderColor/.test(diagnostic)) {
  errors.push('Diagnostic cards mix border shorthand with borderColor and trigger React style warnings')
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
if (audioFiles.length < 51) errors.push(`Listening audio coverage is ${audioFiles.length}/51`)
const manifestPath = join(audioDir, 'manifest.json')
if (!existsSync(manifestPath)) errors.push('Listening audio manifest is missing')
else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.files?.length !== audioFiles.length) errors.push('Listening audio manifest coverage does not match packaged MP3 files')
}

if (errors.length) {
  console.error('Skill Campus release gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`PASS: Skill Campus release gate (${requiredAssets.length} visual assets, ${audioFiles.length} listening files, strict official-system boundaries)`)
