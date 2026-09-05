import jobBank from '../data/assessment-banks/job-common.json' with { type: 'json' }
import ncsBank from '../data/assessment-banks/ncs-basic.json' with { type: 'json' }
import recruitBank from '../data/assessment-banks/recruit-written.json' with { type: 'json' }
import interviewBank from '../data/assessment-banks/interview.json' with { type: 'json' }
import coverBank from '../data/assessment-banks/cover-letter.json' with { type: 'json' }
import interviewStudy from '../data/interview-study.json' with { type: 'json' }
import { buildJcOfficialAreas } from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions, buildNcs2026Areas } from '../src/lib/ncs2026.js'
import { recruitWrittenQuestions, RECRUIT_WRITTEN_TRACKS, buildRecruitWrittenAreas, recruitAreaId, recruitLessonTitle } from '../src/lib/recruitWritten.js'
import { assessmentQuestions, studyQuestions } from '../src/lib/assessmentPartition.js'
import { markAssessmentPracticeExposure, practiceCoverageWindow, rotatingPracticeWindow } from '../src/lib/assessmentExposure.js'
import { buildMockPaper } from '../src/lib/mockPaper.js'
import { readFileSync } from 'node:fs'

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  key: index => [...storage.keys()][index] ?? null,
  get length() { return storage.size },
}

const jobAreas = new Set(buildJcOfficialAreas().map(area => area.id))
for (const question of jobBank.questions || []) {
  check(jobAreas.has(question.officialArea), `${question.id}: 자율학습에 없는 직업공통 영역`)
}

const ncsScopes = new Set(buildNcs2026Areas(studyQuestions(ncs2026Questions))
  .flatMap(area => area.lessons.map(lesson => `${area.id}:${lesson.id}`)))
for (const question of ncsBank.questions || []) {
  check(ncsScopes.has(`${question.area}:${question.ncsAbility}`), `${question.id}: 자율학습에 없는 NCS 영역·능력`)
}

const recruitScopes = new Set(RECRUIT_WRITTEN_TRACKS.flatMap(track =>
  buildRecruitWrittenAreas(track.id, studyQuestions(recruitWrittenQuestions))
    .flatMap(area => area.lessons.map(lesson => `${track.id}:${area.id}:${lesson.id}`))))
for (const question of recruitBank.questions || []) {
  const key = `${question.recruitmentTrack}:${recruitAreaId(question.area)}:${recruitLessonTitle(question)}`
  check(recruitScopes.has(key), `${question.id}: 자율학습에 없는 채용필기 트랙·영역·단원`)
}

const interviewLessons = new Set((interviewStudy.lessons || []).map(lesson => lesson.id))
const interviewCategories = new Set((interviewStudy.lessons || []).map(lesson => lesson.category))
let interviewStudyReachable = 0
for (const question of interviewBank.questions || []) {
  const direct = interviewLessons.has(question.lessonId)
  const foundation = question.lessonId?.startsWith('FOUNDATION-') && interviewCategories.has(question.category)
  if (direct || foundation) interviewStudyReachable++
  else check(question.lessonId?.startsWith('ORG-') || question.lessonId?.startsWith('COVER-'), `${question.id}: 자율학습 또는 평가 경로에 분류되지 않은 면접 문항`)
}

const sample = ncsBank.questions?.[0]
check(rotatingPracticeWindow(ncsBank.questions, 'audit', 10).length === 10, '일일 독립 문제은행 묶음이 10문항이 아님')
check(practiceCoverageWindow(ncsBank.questions, 'audit-extra', 2, 0).length === 2, '추가 학습 2문항 묶음이 아님')
check(assessmentQuestions([sample]).length === 1, '노출 전 신규 문항이 평가 풀에서 누락됨')
markAssessmentPracticeExposure(sample.id)
check(assessmentQuestions([sample]).length === 0, '자율학습에서 본 문항이 진단·모의고사 풀에서 제외되지 않음')

const coveragePool = Array.from({ length: 23 }, (_, index) => ({
  id: `COVERAGE-${index + 1}`,
  area: `A${index % 4}`,
  stem: `coverage stem ${index + 1}`,
  choices: ['a', 'b', 'c', 'd'],
  answer: 'A',
}))
const coverageIds = new Set()
for (let paperNo = 1; paperNo <= Math.ceil(coveragePool.length / 5); paperNo++) {
  buildMockPaper(coveragePool, '__all__', paperNo, { count: 5, areaKey: question => question.area, seedScope: 'coverage-audit' })
    .forEach(question => coverageIds.add(question.id))
}
check(coverageIds.size === coveragePool.length, `순환 출제기가 전체 문항을 소진하지 못함 (${coverageIds.size}/${coveragePool.length})`)

const studyScreenSource = readFileSync('src/screens/student/StudyScreen.jsx', 'utf8')
const guidedSource = readFileSync('src/screens/student/GuidedStudyScreen.jsx', 'utf8')
const interviewSource = readFileSync('src/screens/student/InterviewStudyScreen.jsx', 'utf8')
const diagnosticSource = readFileSync('src/screens/student/DiagnosticScreen.jsx', 'utf8')
const mockDataSource = readFileSync('src/lib/mockData.js', 'utf8')
const extraSource = readFileSync('src/screens/student/ExtraPracticeQuiz.jsx', 'utf8')
check(studyScreenSource.includes('onQuickPractice={independentPracticeCandidates.length'), '직업공통·NCS·채용필기 단원 마무리에 추가 2문제 버튼이 없음')
check(guidedSource.includes('onQuickPractice={extraPracticeQuestions.length'), '자기소개서·인성 단원 마무리에 추가 연습 버튼이 없음')
check(interviewSource.includes('quickPracticeLabel="새로운 면접 2문제 더 풀기"'), '면접 단원 마무리에 추가 2문제 버튼이 없음')
check(extraSource.includes('saveWrongAnswer') && extraSource.includes('markAssessmentPracticeExposure'), '추가 문제의 오답노트·평가 노출 분리가 연결되지 않음')
check(diagnosticSource.includes('diag_attempt_') && diagnosticSource.includes('attempt + 1'), '진단평가 회차가 최근 기록 보관 한도와 분리되지 않음')
check(mockDataSource.includes('Math.ceil(capacity / MOCK_COUNT)'), '모의고사 전체 문항 소진 회차가 문항 풀 크기로 계산되지 않음')

if (failures.length) {
  console.error('[문제은행 전달경로] 실패')
  failures.slice(0, 30).forEach(message => console.error(`- ${message}`))
  if (failures.length > 30) console.error(`- 그 외 ${failures.length - 30}건`)
  process.exit(1)
}

console.log(`[문제은행 전달경로] 통과 · 객관식 자율학습 후보 ${jobBank.questions.length + ncsBank.questions.length + recruitBank.questions.length + interviewStudyReachable + coverBank.questions.length}문항 · 인성 응답 연습 포함 · 추가 2문제/오답노트/평가 순환 소진 확인`)
