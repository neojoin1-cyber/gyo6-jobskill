import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relativePath =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const readText = relativePath =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')
const asQuestions = value => Array.isArray(value) ? value : (value.questions || [])
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const officialFoodUnits = new Set(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08'])
const foodSources = [
  readJson('data/food-service-questions.json'),
  readJson('data/food-service-c02-paper.json'),
  readJson('data/food-service-exam-bank.json'),
  readJson('data/food-service-official-spec.json'),
  readJson('data/food-service-ncs-lm.json'),
]
const rawFood = foodSources.flatMap(asQuestions)
const safeFood = rawFood.filter(q =>
  officialFoodUnits.has(q?.lessonId) &&
  q?.answerSource !== 'ollama' &&
  q?.answerSource !== 'unverified-quarantined' &&
  !q?.excludeFromQuiz &&
  !q?.needsManualReview
)

check(safeFood.length > 0, '식음료 학생 노출 풀이 비어 있습니다.')
check(safeFood.every(q => officialFoodUnits.has(q.lessonId)), '식음료 풀이 C01~C08 외 단원을 포함합니다.')
check(
  safeFood.every(q => !q.excludeFromQuiz && !q.needsManualReview && q.answerSource !== 'unverified-quarantined'),
  '식음료 풀이 격리·수동검수 문항을 포함합니다.',
)
for (const unit of officialFoodUnits) {
  check(safeFood.some(q => q.lessonId === unit), `식음료 ${unit} 문항이 없습니다.`)
}

const foodByPresentation = new Map()
for (const q of rawFood) {
  const choices = (q.choices || []).map(choice =>
    normalize(typeof choice === 'string' ? choice : choice?.text)
  )
  if (!q.stem || choices.length < 2) continue
  const key = `${normalize(q.stem)}\n${choices.join('\n')}`
  const group = foodByPresentation.get(key) || []
  group.push(q)
  foodByPresentation.set(key, group)
}
for (const group of foodByPresentation.values()) {
  const answers = new Set(group.map(q => normalize(q.answer)))
  check(
    answers.size === 1,
    `동일 식음료 문항의 정답이 상충합니다: ${group.map(q => `${q.id}=${q.answer}`).join(', ')}`,
  )
}

const correctedQuestion = rawFood.find(q => q.id === 'FS-M4-122')
check(correctedQuestion?.answer === 'D', 'FS-M4-122 정답은 D(표준 레시피)여야 합니다.')

const qualityPractice = readJson('data/quality-mgmt-practice.json')
const qualityStudy = readJson('data/quality-mgmt-study.json')
const qualityMock = readJson('data/quality-mgmt-mockexam.json')
const foodMock = readJson('data/food-service-mockexam.json')
const qualityQuestions = qualityPractice.units.flatMap(unit => unit.questions || [])
const safeQuality = qualityQuestions.filter(q =>
  q?.answerSource !== 'unverified-quarantined' &&
  !q?.excludeFromQuiz &&
  !q?.needsManualReview
)
const qualityIds = new Set(qualityQuestions.map(q => q.id))

check(
  qualityQuestions.some(q => q.answerSource === 'unverified-quarantined'),
  '품질 격리 데이터가 사라졌습니다. 검수 전 원본은 보존해야 합니다.',
)
check(
  safeQuality.every(q => q.answerSource !== 'unverified-quarantined'),
  '품질 학생 노출 풀에 미검증 문항이 포함됐습니다.',
)

for (const section of qualityMock.sections) {
  const ids = section.questionIds || []
  check(ids.length === new Set(ids).size, `${section.sectionId}에 중복 문항 ID가 있습니다.`)
  for (const id of ids) {
    check(qualityIds.has(id), `${section.sectionId}가 존재하지 않는 문항 ${id}를 참조합니다.`)
  }
}

const progressKeys = []
for (const [source, data] of Object.entries({ textbook: qualityStudy, practice: qualityPractice })) {
  for (const unit of data.units || []) {
    for (const [index, q] of (unit.questions || []).entries()) {
      if (q.answerSource === 'unverified-quarantined' || q.excludeFromQuiz || q.needsManualReview) continue
      progressKeys.push(`${source}:${unit.id}:${q.id}:${index}`)
    }
  }
}
check(
  progressKeys.length === new Set(progressKeys).size,
  '품질 진도키 생성 규칙이 전역 고유하지 않습니다.',
)
check(qualityMock.status === 'learning-only', '품질 모의세트가 내부 학습용으로 표시되지 않았습니다.')
check(qualityMock.standard === 'internal-learning-v1', '품질 모의세트가 과거 규격을 현재 공식 기준으로 노출합니다.')
check(foodMock.status === 'archived-reference', '식음료 22V2 모의세트가 보관 참고자료로 격리되지 않았습니다.')
check(foodMock.useForOfficialSimulation === false, '식음료 22V2 모의세트가 공식 시뮬레이션에 사용됩니다.')

const foodBankSource = readText('src/lib/foodServiceBank.js')
const qualityScreenSource = readText('src/screens/student/QualityMgmtScreen.jsx')
const passExamSource = readText('src/lib/passExam.js')
const mockScreenSource = readText('src/screens/student/MockAssessmentScreen.jsx')
const courseListSource = readText('src/screens/student/CourseListScreen.jsx')
const ebookExportSource = readText('scripts/export-ebook.cjs')
const ebookBuildSource = readText('scripts/build-ebooks.cjs')

check(foodBankSource.includes('OFFICIAL_UNITS.has'), '식음료 공식 단원 허용목록 필터가 없습니다.')
check(foodBankSource.includes('!q?.excludeFromQuiz'), '식음료 제외 문항 필터가 없습니다.')
check(foodBankSource.includes('modelAnswer: q.answer'), '식음료 연결형 정답 정규화가 없습니다.')
check(qualityScreenSource.includes("q?.answerSource !== 'unverified-quarantined'"), '품질 격리 필터가 없습니다.')
check(qualityScreenSource.includes('_progressKey'), '품질 범위형 진도키가 없습니다.')
check(passExamSource.includes('function pickInterview'), '식음료 면접 전용 선별기가 없습니다.')
check(passExamSource.includes("big.filter(q => !isAuto(q))"), '면접 시험지가 구술·자가확인형으로 제한되지 않았습니다.')
check(!mockScreenSource.includes('합격 판정 실전 모의고사'), '학습용 점검이 합격 판정으로 표시됩니다.')
check(!courseListSource.includes('745문항'), '식음료 구식 문항 수가 화면에 남아 있습니다.')
check(!courseListSource.includes('8단원 · 티키타카'), '품질경영 구식 8단원 표기가 남아 있습니다.')
check(!courseListSource.includes('STEP 1'), '선택형 학습 메뉴에 단계형 STEP 표기가 남아 있습니다.')
check(!mockScreenSource.includes('{sp.standard}'), '앱이 검증되지 않은 규격 버전을 사용자에게 직접 노출합니다.')
check(ebookExportSource.includes("q.answerSource !== 'unverified-quarantined'"), '전자책 품질·식음료 격리 필터가 없습니다.')
check(ebookExportSource.includes("rawType === 'paper'"), '식음료 paper 문항의 실제 유형 변환이 없습니다.')
check(ebookExportSource.includes('mockexam?.useForOfficialSimulation === true'), '보관 식음료 모의세트의 전자책 사용 잠금이 없습니다.')
check(ebookExportSource.includes('<summary>정답과 해설 보기</summary>'), '전자책 정답·해설 기본 접힘이 없습니다.')
check(!ebookBuildSource.includes("badge:'도제학교 외부평가 25V3'"), '전자책 카드에 검증되지 않은 25V3 표기가 남아 있습니다.')

const countMatch = courseListSource.match(/검증 완료 (\d+)문항/)
check(Boolean(countMatch), '식음료 검증 완료 문항 수 표기가 없습니다.')
if (countMatch) {
  check(Number(countMatch[1]) === safeFood.length, `식음료 화면 수 ${countMatch[1]}와 실제 ${safeFood.length}가 다릅니다.`)
}

if (failures.length) {
  console.error(`품질경영·식음료서비스 출시 게이트 실패 (${failures.length}건)`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('품질경영·식음료서비스 출시 게이트 통과')
console.log(`- 식음료 검증 완료 문항: ${safeFood.length}`)
console.log(`- 품질경영 검증 완료 문제풀이 문항: ${safeQuality.length}`)
console.log(`- 품질경영 전자책 모의 섹션: ${qualityMock.sections.length}개, 중복 0건`)
console.log(`- 품질경영 진도키: ${progressKeys.length}개, 충돌 0건`)
