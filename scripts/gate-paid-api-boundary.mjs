import fs from 'node:fs'
import path from 'node:path'

const runtimeRoots = ['src']
const paidMarkers = [
  'api.elevenlabs.io',
  'ELEVENLABS_API_KEY',
  'xi-api-key',
  'api.openai.com',
  'OPENAI_API_KEY',
  'api.anthropic.com',
  'ANTHROPIC_API_KEY',
  'generativelanguage.googleapis.com',
  'GEMINI_API_KEY',
  'api.stripe.com',
  'STRIPE_SECRET_KEY',
]
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const failures = []

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(target)
    return sourceExtensions.has(path.extname(entry.name)) ? [target] : []
  })
}

for (const root of runtimeRoots) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8')
    for (const marker of paidMarkers) {
      if (source.includes(marker)) failures.push(`런타임 유료 API 표식 발견: ${file} · ${marker}`)
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const automaticScripts = ['prebuild', 'build', 'postbuild'].map(name => packageJson.scripts?.[name] || '').join(' && ')
for (const command of ['audio:generate', 'audio:regenerate', 'gen-listening-audio']) {
  if (automaticScripts.includes(command)) failures.push(`자동 빌드가 유료 음성 생성을 실행함: ${command}`)
}

const audioGenerator = fs.readFileSync('scripts/gen-listening-audio.mjs', 'utf8')
if (!audioGenerator.includes('ELEVENLABS_API_KEY') || !audioGenerator.includes('api.elevenlabs.io')) {
  failures.push('ElevenLabs 제작용 스크립트 경계 확인 실패')
}

const coverStudent = fs.readFileSync('src/screens/student/InterviewCareerLab.jsx', 'utf8')
const coverTeacher = fs.readFileSync('src/screens/teacher/CoverLetterReviewScreen.jsx', 'utf8')
for (const [name, source] of [['학생 제출', coverStudent], ['교사 첨삭', coverTeacher]]) {
  if (paidMarkers.some(marker => source.includes(marker))) failures.push(`${name} 화면에 유료 API 호출 표식 존재`)
}

if (failures.length) {
  console.error(`Paid API boundary gate FAILED (${failures.length})`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Paid API boundary gate PASS: 앱 런타임 0개 · ElevenLabs는 수동 정적 음원 제작 전용')
