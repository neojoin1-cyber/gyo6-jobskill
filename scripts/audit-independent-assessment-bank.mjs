import { readFile } from 'node:fs/promises'

import baseline from '../data/assessment-expansion-baseline.json'
import jobCommonBank from '../data/assessment-banks/job-common.json'
import ncsBank from '../data/assessment-banks/ncs-basic.json'
import recruitBank from '../data/assessment-banks/recruit-written.json'
import interviewBank from '../data/assessment-banks/interview.json'
import coverBank from '../data/assessment-banks/cover-letter.json'
import adaptationBank from '../data/assessment-banks/job-adaptation.json'
import personalityBank from '../data/assessment-banks/personality.json'
import personalitySource from '../data/personality-test-bank.json'
import interviewQuiz from '../data/interview-quiz.json'
import {
  assessmentQuestions,
  assessmentQuestionsById,
  questionContentKey,
} from '../src/lib/assessmentPartition.js'
import {
  buildJcAreaPaper,
  buildJcMockAreas,
  JC_OFFICIAL_SPECS,
} from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../src/lib/ncs2026.js'
import {
  recruitWrittenQuestions,
  recruitAreaId,
} from '../src/lib/recruitWritten.js'
import {
  getDiagnosticScopes,
  getMockScopes,
  buildDiagnosticPaper,
  buildSubjectMockPaper,
} from '../src/lib/mockData.js'
import {
  COVER_DIAGNOSTIC_QUESTIONS,
  buildCoverDiagnosticPaper,
} from '../src/lib/coverAssessmentBank.js'
import {
  INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
} from '../src/lib/interviewCareerContent.js'
import {
  buildJobAdaptationItems,
} from '../src/lib/jobAdaptationTest.js'
import {
  buildPersonalityItems,
  paperCount as personalityPaperCount,
  PERSONALITY_ITEM_COUNT,
} from '../src/lib/personalityTest.js'

const PREFIX = baseline.generatedPrefix
const generatedBank = {
  subjects: {
    'job-common': jobCommonBank.questions,
    'ncs-basic': ncsBank.questions,
    'recruit-written': recruitBank.questions,
    interview: interviewBank.questions,
    'cover-letter': coverBank.questions,
    'job-adaptation': adaptationBank.questions,
    personality: personalityBank.questions,
  },
}
const failures = []
const notes = []
let independentCalculationCount = 0
const isGenerated = item => String(item?.id || '').startsWith(PREFIX)
const normalize = value => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]+/g, '')

function itemTextKey(item) {
  if (item.text) return normalize(item.text)
  return questionContentKey(item)
}

function objectiveGenerated() {
  return Object.entries(generatedBank.subjects)
    .filter(([subject]) => !['job-adaptation', 'personality'].includes(subject))
    .flatMap(([subject, items]) => items.map(item => ({ subject, item })))
}

function checkGeneratedSchema() {
  const ids = new Set()
  const content = new Map()
  const answerRows = new Map()
  const longestRows = new Map()
  for (const { subject, item } of objectiveGenerated()) {
    if (!item.id || ids.has(item.id)) failures.push(`${subject}: 중복 또는 빈 id ${item.id || '(없음)'}`)
    ids.add(item.id)
    if (!Array.isArray(item.choices) || item.choices.length !== 4 || new Set(item.choices.map(normalize)).size !== 4) {
      failures.push(`${item.id}: 고유한 4개 보기가 아님`)
      continue
    }
    const answerIndex = 'ABCD'.indexOf(item.answer)
    if (answerIndex < 0 || answerIndex > 3) failures.push(`${item.id}: 정답 인덱스 오류 ${item.answer}`)
    if (item.choices[answerIndex] !== item.answerText) failures.push(`${item.id}: 정답 코드와 정답 문구 불일치`)
    if (normalize(item.explanation).length < 25) failures.push(`${item.id}: 해설이 너무 짧거나 없음`)
    if (item.learningLane !== 'assessment') failures.push(`${item.id}: 평가 전용 learningLane 누락`)
    if (item.sourceUse !== 'structure-and-competency-only-no-source-item-text') failures.push(`${item.id}: 독립 생성 출처 정책 누락`)

    const key = itemTextKey(item)
    if (content.has(key)) failures.push(`${item.id}: 신규 문항 완전 중복 (${content.get(key)})`)
    content.set(key, item.id)

    if (!answerRows.has(subject)) answerRows.set(subject, [0, 0, 0, 0])
    answerRows.get(subject)[answerIndex] += 1
    const lengths = item.choices.map(choice => normalize(choice).length)
    const max = Math.max(...lengths)
    if (!longestRows.has(subject)) longestRows.set(subject, { total: 0, longest: 0 })
    const stat = longestRows.get(subject)
    stat.total += 1
    if (lengths[answerIndex] === max && lengths.filter(length => length === max).length === 1) stat.longest += 1
  }

  for (const [subject, counts] of answerRows) {
    const spread = Math.max(...counts) - Math.min(...counts)
    const tolerance = Math.max(2, Math.ceil(counts.reduce((a, b) => a + b, 0) * 0.03))
    if (spread > tolerance) failures.push(`${subject}: 정답 위치 편차 과다 ${counts.join('/')}`)
    notes.push(`${subject} 정답분포 A-D ${counts.join('/')}`)
  }
  for (const [subject, stat] of longestRows) {
    const ratio = stat.longest / stat.total
    if (ratio > 0.65) failures.push(`${subject}: 정답만 최장 보기인 비율 ${(ratio * 100).toFixed(1)}%`)
    notes.push(`${subject} 정답 최장 단서 ${(ratio * 100).toFixed(1)}%`)
  }
}

function answerNumber(item) {
  const match = String(item.answerText || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : Number.NaN
}

function checkExpected(item, expected, label) {
  independentCalculationCount += 1
  if (typeof expected === 'number') {
    const actual = answerNumber(item)
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.11) {
      failures.push(`${item.id}: ${label} 독립 재계산 ${expected}와 정답 ${item.answerText}이 다름`)
    }
    const expectedText = Number.isInteger(expected) ? String(expected) : expected.toFixed(1)
    if (!String(item.explanation || '').replace(/,/g, '').includes(expectedText)) {
      failures.push(`${item.id}: ${label} 재계산값 ${expectedText}이 해설에 없음`)
    }
    return
  }
  if (item.answerText !== expected) failures.push(`${item.id}: ${label} 자료 최댓값 ${expected}와 정답 ${item.answerText}이 다름`)
  if (!String(item.explanation || '').includes(expected)) failures.push(`${item.id}: ${label} 정답 ${expected}이 해설에 없음`)
}

function checkIndependentCalculations() {
  const generated = objectiveGenerated().map(row => row.item)
  for (const item of generated) {
    const id = String(item.id || '')
    if (/^NEW26-(?:JC-MA|NCS-02)-/.test(id)) {
      if (item.visual?.type === 'bar') {
        const max = Math.max(...item.visual.items.map(entry => Number(entry.value)))
        checkExpected(item, item.visual.items.find(entry => Number(entry.value) === max)?.label, '도표')
        continue
      }
      if (item.visual?.type === 'table' && item.visual.rows?.[0]?.[0] === '처리 건수') {
        const previous = Number(item.visual.rows[0][1])
        const current = Number(item.visual.rows[0][2])
        checkExpected(item, Math.round(((current - previous) / previous) * 1000) / 10, '증가율')
        continue
      }
      if (item.visual?.type === 'table' && item.visual.rows?.length === 2) {
        const [, averageA, countA] = item.visual.rows[0]
        const [, averageB, countB] = item.visual.rows[1]
        checkExpected(item, (Number(averageA) * Number(countA) + Number(averageB) * Number(countB)) / (Number(countA) + Number(countB)), '가중평균')
        continue
      }
      const weight = String(item.context || '').match(/무게는\s*([\d.]+)kg.*상자\s*(\d+)개/)
      if (weight) {
        checkExpected(item, Number(weight[1]) * Number(weight[2]) * 1000, '단위환산')
        continue
      }
      const production = String(item.context || '').match(/시간당\s*(\d+)개.*작업자\s*(\d+)명.*\s(\d+)시간/)
      if (production) checkExpected(item, Number(production[1]) * Number(production[2]) * Number(production[3]), '비례 생산량')
      continue
    }
    if (/^NEW26-RW-.*-인적성-/.test(id)) {
      const sequence = String(item.context || '').match(/번호가\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/)
      if (sequence) checkExpected(item, Number(sequence[5]) + Number(sequence[2]) - Number(sequence[1]), '등차수열')
      continue
    }
    if (/^NEW26-RW-.*-금융상식-/.test(id)) {
      const values = String(item.context || '').match(/원금\s*(\d+)만원.*연\s*(\d+)%/)
      if (values) checkExpected(item, Number(values[1]) * Number(values[2]) / 100, '단리 이자')
      continue
    }
    if (/^NEW26-RW-.*-경영상식-/.test(id)) {
      const values = String(item.context || '').match(/고정비는\s*(\d+)만원.*공헌이익은\s*([\d.]+)만원/)
      if (values) checkExpected(item, Number(values[1]) / Number(values[2]), '손익분기')
    }
  }
  notes.push(`수치·도표 문항 독립 재계산 ${independentCalculationCount}건`)
}

function checkNoExistingCopies() {
  const generated = objectiveGenerated().map(row => row.item)
  const baselineItems = [
    ...buildJcMockAreas().flatMap(area => area.questions || []),
    ...assessmentQuestions(ncs2026Questions),
    ...assessmentQuestions(recruitWrittenQuestions),
    ...assessmentQuestionsById(interviewQuiz.questions || []),
    ...INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
    ...COVER_DIAGNOSTIC_QUESTIONS,
  ].filter(item => !isGenerated(item))
  const baselineKeys = new Set(baselineItems.map(itemTextKey))
  const overlaps = generated.filter(item => baselineKeys.has(itemTextKey(item)))
  if (overlaps.length) failures.push(`기존 문항과 완전 중복 ${overlaps.length}건: ${overlaps.slice(0, 5).map(item => item.id).join(', ')}`)
  notes.push(`기존 ${baselineItems.length}문항 대조 · 완전 중복 ${overlaps.length}`)
}

function checkExpansionCounts() {
  for (const subject of ['job-common', 'ncs-basic', 'recruit-written', 'interview', 'cover-letter', 'job-adaptation', 'personality']) {
    const source = baseline[`${subject}Total`]
    const added = generatedBank.subjects?.[subject]?.length || 0
    if (added !== source * 2) failures.push(`${subject}: 기준 ${source}, 신규 ${added}, 필요한 신규 ${source * 2}`)
    notes.push(`${subject} ${source}+${added}=${source + added} (${Math.round((source + added) / source * 100)}%)`)
  }

  const jobAreas = Object.fromEntries(buildJcMockAreas()
    .filter(area => JC_OFFICIAL_SPECS[area.id]?.assessmentType !== 'likert')
    .map(area => [area.id, area.questions.length]))
  for (const row of baseline.subjects['job-common']) {
    if (jobAreas[row.key] !== row.count * 3) failures.push(`job-common/${row.key}: ${jobAreas[row.key]}문항, 목표 ${row.count * 3}`)
  }

  const ncsAreaCounts = new Map()
  for (const question of assessmentQuestions(ncs2026Questions)) ncsAreaCounts.set(question.area, (ncsAreaCounts.get(question.area) || 0) + 1)
  const ncsBaselineAreas = new Map()
  for (const row of baseline.subjects['ncs-basic']) {
    const area = row.key.split(' > ')[0]
    ncsBaselineAreas.set(area, (ncsBaselineAreas.get(area) || 0) + row.count)
  }
  for (const [area, count] of ncsBaselineAreas) {
    if (ncsAreaCounts.get(area) !== count * 3) failures.push(`ncs-basic/${area}: ${ncsAreaCounts.get(area)}문항, 목표 ${count * 3}`)
  }

  const recruitCounts = new Map()
  for (const question of assessmentQuestions(recruitWrittenQuestions)) {
    const key = `${question.recruitmentTrack} > ${recruitAreaId(question.area)}`
    recruitCounts.set(key, (recruitCounts.get(key) || 0) + 1)
  }
  const recruitBaseline = new Map()
  for (const row of baseline.subjects['recruit-written']) {
    const [track, area] = row.key.split(' > ')
    const key = `${track} > ${area}`
    recruitBaseline.set(key, (recruitBaseline.get(key) || 0) + row.count)
  }
  for (const [key, count] of recruitBaseline) {
    if (recruitCounts.get(key) !== count * 3) failures.push(`recruit-written/${key}: ${recruitCounts.get(key)}문항, 목표 ${count * 3}`)
  }

  const interviewCount = getDiagnosticScopes('interview').find(scope => scope.key === '__all__')?.count
  if (interviewCount !== baseline.interviewTotal * 3) failures.push(`interview: 실제 진단 풀 ${interviewCount}, 목표 ${baseline.interviewTotal * 3}`)
  for (const row of baseline.subjects.interview) {
    const lessonId = row.key.split(' > ')[1]
    const added = generatedBank.subjects.interview.filter(question => question.lessonId === lessonId).length
    if (added !== row.count * 2) failures.push(`interview/${row.key}: 신규 ${added}문항, 목표 ${row.count * 2}`)
  }

  if (COVER_DIAGNOSTIC_QUESTIONS.length !== baseline['cover-letterTotal'] * 3) failures.push(`cover-letter: 실제 진단 풀 ${COVER_DIAGNOSTIC_QUESTIONS.length}, 목표 ${baseline['cover-letterTotal'] * 3}`)
  for (const row of baseline.subjects['cover-letter']) {
    const added = generatedBank.subjects['cover-letter'].filter(question => question.area === row.key).length
    if (added !== row.count * 2) failures.push(`cover-letter/${row.key}: 신규 ${added}문항, 목표 ${row.count * 2}`)
  }

  if (PERSONALITY_ITEM_COUNT !== baseline.personalityTotal * 3) failures.push(`personality: 실제 풀 ${PERSONALITY_ITEM_COUNT}, 목표 ${baseline.personalityTotal * 3}`)
  for (const row of baseline.subjects.personality) {
    const [kind, dim] = row.key.split(' > ')
    const added = generatedBank.subjects.personality.filter(question => question.kind === kind && question.dim === dim).length
    if (added !== row.count * 2) failures.push(`personality/${row.key}: 신규 ${added}문항, 목표 ${row.count * 2}`)
  }
}

function checkPaperContracts() {
  for (const subject of ['ncs-basic', 'recruit-written', 'interview']) {
    for (const scope of getMockScopes(subject)) {
      for (let paper = 1; paper <= Math.min(3, scope.papers); paper += 1) {
        const questions = buildSubjectMockPaper(subject, scope.key, paper)
        if (questions.length !== 30) failures.push(`${subject}/${scope.name}/${paper}회: 모의고사 ${questions.length}/30`)
        if (new Set(questions.map(itemTextKey)).size !== questions.length) failures.push(`${subject}/${scope.name}/${paper}회: 시험지 안 중복`)
      }
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const questions = buildDiagnosticPaper(subject, attempt)
      if (questions.length !== 40) failures.push(`${subject}/${attempt + 1}차 진단: ${questions.length}/40`)
    }
  }

  for (const [area, spec] of Object.entries(JC_OFFICIAL_SPECS)) {
    if (spec.assessmentType === 'likert') continue
    for (let paper = 1; paper <= 3; paper += 1) {
      const questions = buildJcAreaPaper(area, paper)
      if (questions.length !== spec.count) failures.push(`job-common/${area}/${paper}회: ${questions.length}/${spec.count}`)
    }
  }

  const coverReachable = new Set()
  for (let paper = 1; paper <= 3; paper += 1) {
    const questions = buildCoverDiagnosticPaper('all', paper, 12)
    if (questions.length !== 12) failures.push(`cover-letter/${paper}회: ${questions.length}/12`)
    questions.forEach(question => coverReachable.add(question.id))
  }
  if (coverReachable.size !== COVER_DIAGNOSTIC_QUESTIONS.length) failures.push(`cover-letter: 3회 내 도달 ${coverReachable.size}/${COVER_DIAGNOSTIC_QUESTIONS.length}`)

  const adaptationReachable = new Set()
  for (let paper = 1; paper <= 3; paper += 1) {
    const questions = buildJobAdaptationItems('full', paper)
    if (questions.length !== 160) failures.push(`job-adaptation/${paper}회: ${questions.length}/160`)
    questions.forEach(question => adaptationReachable.add(question.id))
  }
  if (adaptationReachable.size !== baseline['job-adaptationTotal'] * 3) failures.push(`job-adaptation: 3회 내 도달 ${adaptationReachable.size}/${baseline['job-adaptationTotal'] * 3}`)

  const personalityReachable = new Set()
  for (const mode of ['quick', 'full']) {
    for (let paper = 1; paper <= personalityPaperCount(mode); paper += 1) {
      buildPersonalityItems(mode, paper).forEach(question => personalityReachable.add(question.id))
    }
  }
  if (personalityReachable.size !== PERSONALITY_ITEM_COUNT) failures.push(`personality: 전체 회차 도달 ${personalityReachable.size}/${PERSONALITY_ITEM_COUNT}`)
  notes.push(`도달성 자기소개서 ${coverReachable.size}, 직무적응 ${adaptationReachable.size}, 인성검사 ${personalityReachable.size}`)
}

function checkPsychometricPairs() {
  for (const subject of ['job-adaptation', 'personality']) {
    const items = generatedBank.subjects[subject]
    const ids = new Set(items.map(item => item.id))
    const text = new Set()
    for (const item of items) {
      const key = normalize(item.text)
      if (!key || text.has(key)) failures.push(`${subject}/${item.id}: 빈 문장 또는 완전 중복`)
      text.add(key)
      if (item.kind === 'trait') {
        if (!item.pair || !ids.has(item.pair)) failures.push(`${subject}/${item.id}: 정·역 짝 누락 ${item.pair}`)
      }
    }
  }
}

async function checkGeneratorIndependence() {
  const source = await readFile('scripts/generate-independent-assessment-bank.mjs', 'utf8')
  const forbidden = [
    'data/questions.json',
    'data/ncs-questions.json',
    'data/interview-quiz.json',
    'data/personality-test-bank.json',
    'data/mock-interview-pool.json',
    'data/general-knowledge-questions.json',
  ]
  for (const path of forbidden) if (source.includes(path)) failures.push(`생성기가 기존 문제은행을 입력으로 읽음: ${path}`)
}

function checkMediaRatios() {
  const generated = generatedBank.subjects['job-common']
  for (const [area, minimum] of [['의사소통 국어', 0.24], ['의사소통 영어', 0.3], ['수리활용', 0.4]]) {
    const questions = generated.filter(question => question.officialArea === area)
    const media = questions.filter(question => ['audio', 'visual'].includes(question.mediaType)).length
    const ratio = media / questions.length
    if (ratio < minimum) failures.push(`${area}: 신규 매체 문항 ${(ratio * 100).toFixed(1)}%, 최소 ${(minimum * 100).toFixed(0)}%`)
    notes.push(`${area} 신규 매체 문항 ${media}/${questions.length} (${(ratio * 100).toFixed(1)}%)`)
  }
}

checkGeneratedSchema()
checkIndependentCalculations()
checkNoExistingCopies()
checkExpansionCounts()
checkPaperContracts()
checkPsychometricPairs()
checkMediaRatios()
await checkGeneratorIndependence()

console.log('[독립문항감사]')
for (const note of notes) console.log(`  ${note}`)
if (failures.length) {
  console.error(`[독립문항감사] 실패 ${failures.length}건`)
  failures.slice(0, 100).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}
console.log(`[독립문항감사] 통과 · 신규 ${Object.values(generatedBank.subjects).reduce((sum, items) => sum + items.length, 0)}문항 · 7개 평가 풀 300%`)
