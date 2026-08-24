import fs from 'node:fs'
import assert from 'node:assert/strict'
import {
  isCurrentNcsQuestion,
  recruitmentTrackIds,
  recruitResidualKind,
} from '../src/lib/recruitWrittenPolicy.js'

const ncsAbilityQuestions = JSON.parse(
  fs.readFileSync(new URL('../data/ncs-questions.json', import.meta.url), 'utf8'),
)
const generalKnowledge = JSON.parse(
  fs.readFileSync(new URL('../data/general-knowledge-questions.json', import.meta.url), 'utf8'),
)
const rawNcsQuestions = [
  ...ncsAbilityQuestions,
  ...(generalKnowledge.questions || []),
]

const expectedTrackCounts = {
  public: 122,
  finance: 227,
  enterprise: 96,
}

const expectedResidualCounts = {
  'resource-allocation': 34,
  'organization-understanding': 47,
  'technical-foundation': 33,
  'customer-service-negotiation': 8,
}

assert.equal(rawNcsQuestions.length, 972, '원본 채용/NCS 문항 수가 변경되었습니다.')
const clonedIds = rawNcsQuestions.flatMap(q =>
  recruitmentTrackIds(q).map(trackId => `RW-${trackId}-${q.id}`)
)
assert.equal(new Set(clonedIds).size, clonedIds.length, '트랙별 복제 문항 ID는 모두 고유해야 합니다.')

const residualCounts = rawNcsQuestions.reduce((counts, q) => {
  const kind = recruitResidualKind(q)
  if (kind) counts[kind] = (counts[kind] || 0) + 1
  return counts
}, {})
assert.deepEqual(residualCounts, expectedResidualCounts, '채용 잔여역량 분류 수가 변경되었습니다.')
assert.equal(
  rawNcsQuestions.filter(isCurrentNcsQuestion).length,
  610,
  '현행 NCS 후보 문항 수가 변경되었습니다.',
)

for (const [trackId, expectedCount] of Object.entries(expectedTrackCounts)) {
  const questions = rawNcsQuestions.filter(q => recruitmentTrackIds(q).includes(trackId))
  const selectable = questions.filter(q =>
    !q.excludeFromQuiz &&
    Array.isArray(q.choices) &&
    q.choices.length >= 2 &&
    /^[A-E]$/.test(q.answer || '')
  )
  assert.equal(questions.length, expectedCount, `${trackId} 문항 수 불일치`)
  assert.ok(selectable.length >= 30, `${trackId} 트랙에 30문항 모의평가 풀이 부족합니다.`)
}

const courseSource = fs.readFileSync(new URL('../src/screens/student/CourseListScreen.jsx', import.meta.url), 'utf8')
const studySource = fs.readFileSync(new URL('../src/screens/student/StudyScreen.jsx', import.meta.url), 'utf8')
const helperSource = fs.readFileSync(new URL('../src/lib/recruitWritten.js', import.meta.url), 'utf8')
const ncsSource = fs.readFileSync(new URL('../src/lib/ncs2026.js', import.meta.url), 'utf8')
const mockSource = fs.readFileSync(new URL('../src/lib/mockData.js', import.meta.url), 'utf8')

assert.match(helperSource, /id: `RW-\$\{trackId\}-\$\{q\.id\}`/, '새 교재 독립 문항 ID 생성 규칙이 없습니다.')
assert.match(helperSource, /rawNcsQuestions\.flatMap/, '한 문항을 필요한 복수 채용 트랙에 공유하는 구조가 없습니다.')
assert.match(helperSource, /recruitmentTrackIds\(q\)/, '채용 트랙 공통 분류 정책을 사용하지 않습니다.')
assert.match(helperSource, /금융시장·금융기관·예금보호/, '금융권 보충문항의 주제별 재분류가 없습니다.')
assert.match(helperSource, /언어이해·독해·비판적 사고/, '대기업 직무적성 문항의 주제별 재분류가 없습니다.')
assert.match(ncsSource, /\.filter\(isCurrentNcsQuestion\)/, '현행 NCS와 채용 잔여역량 분리 정책이 적용되지 않았습니다.')
for (const label of ['공공기관형', '금융권형', '대기업형']) {
  assert.ok(mockSource.includes(label) || helperSource.includes(label), `모의평가 트랙 누락: ${label}`)
}
assert.match(mockSource, /subjectId === 'recruit-written'/, '새 교재 진단·모의평가 설정이 없습니다.')
assert.doesNotMatch(
  courseSource,
  /setMode\('legacy'\)|initialSubject="ncs-legacy"/,
  '현행 NCS 교재에 구기준 NCS 중복 진입점이 남아 있습니다.',
)
assert.doesNotMatch(
  studySource,
  /id:\s*'ncs-legacy'|NCS 구기준 출제 대응/,
  '자율학습 내부에 구기준 NCS 중복 교재 전환이 남아 있습니다.',
)
assert.match(helperSource, /id:\s*'public'[\s\S]*?sourceAreas:/, '채용 잔여역량은 공공기관형에서 제공해야 합니다.')
assert.ok(
  rawNcsQuestions
    .filter(q => recruitResidualKind(q))
    .every(q => !isCurrentNcsQuestion(q)),
  '채용 잔여역량 문항이 현행 NCS에도 중복 포함되어 있습니다.',
)
assert.ok(
  rawNcsQuestions
    .filter(q => recruitResidualKind(q) === 'resource-allocation')
    .every(q => recruitmentTrackIds(q).includes('public') && recruitmentTrackIds(q).includes('finance')),
  '자원배분·관리 팩은 공공기관형과 금융권형에 함께 제공해야 합니다.',
)
assert.ok(
  rawNcsQuestions
    .filter(q => recruitResidualKind(q) === 'technical-foundation')
    .every(q => recruitmentTrackIds(q).includes('public') && recruitmentTrackIds(q).includes('enterprise')),
  '기술직 기초 팩은 공공기관형과 대기업형에 함께 제공해야 합니다.',
)
assert.ok(
  rawNcsQuestions
    .filter(q => recruitResidualKind(q) === 'customer-service-negotiation')
    .every(q => recruitmentTrackIds(q).length === 3),
  '고객서비스·협상 팩은 세 채용 트랙에 함께 제공해야 합니다.',
)

const byId = Object.fromEntries(rawNcsQuestions.map(q => [q.id, q]))
const answerText = q => q.choices[String(q.answer).charCodeAt(0) - 65]
assert.equal(answerText(byId['NCS-C161-diagnosis']), '화폐시장의 발행시장', '금융시장 분류 정답이 발행시장과 일치하지 않습니다.')
assert.match(answerText(byId['NCS-C174-diagnosis']), /정기예금 6개월/, '원금보장 조건에 MMF를 추천하면 안 됩니다.')
assert.equal(answerText(byId['NCS-C176-diagnosis']), '약 20,000원', '환전 손실 계산 선택지가 해설과 일치하지 않습니다.')
assert.ok(
  rawNcsQuestions.every(q => !/예금.{0,35}5천만|5천만.{0,35}예금/.test(JSON.stringify(q))),
  '2025년 9월 이전 예금보호 한도 문구가 남아 있습니다.',
)

const expectedOrder = [
  "id: 'job-common'",
  "id: 'ncs-basic'",
  "id: 'recruit-written'",
  "id: 'interview'",
  "id: 'personality'",
]
let lastIndex = -1
for (const marker of expectedOrder) {
  const index = courseSource.indexOf(marker)
  assert.ok(index > lastIndex, `교재 노출 순서 오류: ${marker}`)
  lastIndex = index
}

console.log('채용 필기시험 실전확장 게이트 통과')
console.log('트랙 문항: 공공기관형 122 · 금융권형 227 · 대기업형 96')
console.log('현행 NCS 중복 제거 · 직군별 잔여역량 공동 노출 · 트랙별 독립 ID 확인')
