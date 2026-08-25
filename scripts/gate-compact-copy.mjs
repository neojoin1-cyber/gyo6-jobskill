import { readFileSync } from 'node:fs'
import { compactInstructionHtml, compactTextLines } from '../src/lib/compactCopy.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const fail = message => {
  console.error(`[간결 학습문구] 실패 — ${message}`)
  process.exitCode = 1
}

const examples = [
  '아이디어 생성 단계에서는 한 가지 정답을 빨리 찾으려 하지 말고 여러 관점에서 후보를 최대한 늘린다. 브레인스토밍은 평가를 뒤로 미루고 양을 늘리는 기법이고, 벤치마킹은 다른 사례를 참고해 발상을 넓히는 기법이다.',
  '정답 근거: 정답은 평가를 잠시 보류하고 다양한 관점의 대안을 넓게 모은다입니다. 다른 선택지는 핵심 기준을 확인하지 않거나 실행 검증 단계를 빠뜨립니다.',
]

for (const example of examples) {
  const lines = compactTextLines(example, { maxItemChars: 68 })
  if (lines.length < 2) fail('대표 장문이 핵심 목록으로 분리되지 않음')
  for (const { text } of lines) {
    if ([...text].length > 68) fail(`대표 목록이 68자를 초과함: ${text}`)
    if (/(?:입니다|합니다|됩니다|늘린다|모은다|빠뜨립니다)[.!]?$/u.test(text)) {
      fail(`서술형 종결이 남음: ${text}`)
    }
  }
}

const ordinaryAnswerSentence = compactTextLines('정답을 맞히는 시험이 아니라 평소 행동 경향을 살피는 자료입니다.')
if (ordinaryAnswerSentence[0]?.text !== '정답을 맞히는 시험이 아니라 평소 행동 경향을 살피는 자료임') {
  fail('정답으로 시작하는 일반 문장의 앞말이 잘림')
}

const htmlResult = compactInstructionHtml('<table><tr><td>보존</td></tr></table><p>첫째, 판단을 보류합니다. 둘째, 대안을 충분히 모읍니다.</p>')
if (!htmlResult.includes('<table>') || !htmlResult.includes('compact-copy')) {
  fail('교사용 덱에서 표를 보존하며 문단을 목록으로 바꾸지 못함')
}

const rawBindingChecks = [
  ['src/screens/student/MissionScreen.jsx', /<p[^>]*>[^<]*\{q\.explanation\}/],
  ['src/screens/student/StudentHome.jsx', />\s*💡\s*\{q\.explanation\}/],
  ['src/screens/student/WrongAnswerScreen.jsx', /<p[^>]*>\{q\.explanation\}<\/p>/],
  ['src/screens/teacher/ClassroomScreen.jsx', /<p>\{q\.explanation\}<\/p>/],
]
for (const [path, pattern] of rawBindingChecks) {
  if (pattern.test(read(path))) fail(`${path}에 장문 해설 직접 출력이 남음`)
}

const summarySource = read('src/screens/student/StudySummary.jsx')
if (summarySource.includes('더 보기')) fail('학습 요약에 장문 절단용 더 보기 버튼이 남음')
for (const protectedBinding of ['p.situation', 'p.sampleQuestion.modelAnswer', 'p.sampleQuestion.context', 'p.sampleQuestion.stem']) {
  const protectedPattern = new RegExp(`<CompactText[^>]+text=\\{${protectedBinding.replaceAll('.', '\\.')}\\}`)
  if (protectedPattern.test(summarySource)) fail(`${protectedBinding} 원문이 간결 문구 변환기에 연결됨`)
}
for (const path of ['src/screens/student/StudyScreen.jsx', 'src/screens/student/DiagnosticScreen.jsx', 'src/screens/student/QuizRunner.jsx']) {
  const source = read(path)
  if (/<CompactText[^>]+text=\{(?:q\.)?(?:context|stem)\}/.test(source)) {
    fail(`${path}에서 지문 또는 문항을 간결 문구로 변환함`)
  }
}
if (!read('src/screens/teacher/DeckProjector.jsx').includes('compactInstructionHtml')) {
  fail('교사용 가로 덱에 간결 문구 변환이 연결되지 않음')
}

if (!process.exitCode) {
  console.log('[간결 학습문구] 통과 — 학생 해설·개념·오답 및 교사용 가로 덱을 목록형 문구로 통일')
}
