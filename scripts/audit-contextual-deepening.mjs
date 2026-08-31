import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import interviewStudy from '../data/interview-study.json'
import interviewQuizData from '../data/interview-quiz.json'
import { buildEngagementCopy, buildLearningPoints, buildQuestionDrivenSummary } from '../src/lib/learningExperience.js'
import { learningCaseProvenance } from '../src/lib/learningCaseProvenance.js'
import { buildJcOfficialAreas, jcLessonMatches, jcStudyQuestions } from '../src/lib/jobCommonAreas.js'
import { buildNcs2026Areas, ncs2026Questions } from '../src/lib/ncs2026.js'
import {
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  recruitAreaId,
  recruitLessonTitle,
  recruitWrittenQuestions,
} from '../src/lib/recruitWritten.js'
import { studyQuestions, studyQuestionsById } from '../src/lib/assessmentPartition.js'
import { buildInterviewLearningQuestions } from '../src/lib/interviewLearning.js'
import { COVER_STUDY_PROGRAM } from '../src/lib/coverStudyProgram.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'

const failures = []
const records = []
const exactPackages = new Map()
const provenanceDetails = new Set()
const scenarios = new Set()
const scenarioByProfile = new Map()

function plain(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function addCount(map, key, value) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}

function engagementSubject(point = {}) {
  const sample = typeof point.sampleQuestion === 'object' ? point.sampleQuestion : {}
  const value = point.topic || sample.stem || point.situation || sample.context || '현재 판단'
  const text = plain(value).replace(/[?？.!。]+$/g, '')
  return [...text].slice(0, 34).join('')
}

function answerValue(sample = {}) {
  const answers = new Set((Array.isArray(sample.answer) ? sample.answer : [sample.answer])
    .map(value => String(value ?? '').trim().toUpperCase()).filter(Boolean))
  return (sample.choices || [])
    .filter(choice => answers.has(String(choice?.value ?? '').trim().toUpperCase()))
    .map(choice => plain(choice?.text ?? choice))[0] || ''
}

function inspect(scope, summary, questions = []) {
  if (!summary) return
  const points = buildLearningPoints(summary, questions)
  for (const [index, point] of points.entries()) {
    if (!point || typeof point !== 'object') continue
    const sample = point.sampleQuestion || {}
    const engagement = buildEngagementCopy({
      courseKind: summary.courseKind,
      point,
      isListening: Boolean(sample?.sourceQuestion?.audioText),
    })
    const deepen = engagement.deepen || {}
    const id = `${scope} 핵심 ${index + 1}`
    const output = plain(JSON.stringify(deepen))
    const subject = engagementSubject(point)
    const primaryText = plain([
      point.topic, point.situation, sample.stem, sample.context,
      sample.sourceQuestion?.area, sample.sourceQuestion?.subAbility,
      sample.sourceQuestion?.ncsAbility, sample.sourceQuestion?.lessonTitle,
    ].join(' ')).toLowerCase()
    const profileSourceText = plain([
      point.topic, point.learn, point.situation, sample.stem,
      sample.sourceQuestion?.area, sample.sourceQuestion?.lessonTitle,
    ].join(' ')).toLowerCase()
    const options = deepen.options || []
    records.push({ id, profile: deepen.kind, scenario: deepen.scenario, subject, deepen })

    const hasMathTask = /(수리|계산|산출|비율|백분율|증가율|감소율|단위\s*(?:환산|변환)|통계|평균|중앙값|최빈값|표준편차|확률|속도|거리|작업률|(?:예산|금액).{0,12}(?:계산|합계|차이|비율))/.test(profileSourceText)
    if (deepen.kind === 'math' && !hasMathTask) failures.push(`${id}: 날짜·시간·금액만으로 수리 학습에 오분류됨`)
    const asksCustomerResponse = /(?:고객|민원|불만).{0,28}(?:응대|처리|요청|행동|대응|조치)|(?:응대|처리|대응).{0,20}(?:고객|민원|불만)/.test(primaryText)
    if (deepen.kind === 'workplace'
      && asksCustomerResponse
      && !/(사고|위험|보호구|작업\s*중지|보안\s*사고)/.test(primaryText)
      && deepen.scenario !== 'workplace:customer') {
      failures.push(`${id}: 고객 상황이 ${deepen.scenario || '미분류'}로 오분류됨`)
    }
    if (/(공지사항|회사 게시판|업무 이메일|회의록)/.test(primaryText)
      && !hasMathTask
      && deepen.kind === 'math') {
      failures.push(`${id}: 문서 읽기 상황이 수리 학습으로 오분류됨`)
    }

    if (!deepen.scenario || !String(deepen.scenario).includes(':')) failures.push(`${id}: 세부 상황 분류 없음`)
    if (!plain(deepen.material).includes('현재 초점:')) failures.push(`${id}: 현재 문항 초점이 확인 자료에 없음`)
    if (!plain(deepen.material).includes(subject.slice(0, Math.min(18, subject.length)))) failures.push(`${id}: 확인 자료가 현재 문항 제목과 연결되지 않음`)
    if (options.length !== 3) failures.push(`${id}: 후속 선택지가 3개가 아님`)
    if (/(핵심 답변을 흔들림 없이 유지하기|학습 장면에서 결정 근거를 한 곳 표시합니다)/.test(output)) {
      failures.push(`${id}: 폐기한 공통 후속 문구가 다시 노출됨`)
    }
    if (options.map(option => option.label).join('|') === '답변 유지|답변 보완|경험 재확인') {
      failures.push(`${id}: 면접 공통 세 버튼이 상황 구분 없이 재사용됨`)
    }

    const optionFields = options.map(option => plain([
      option.label, option.feedback, option.followUp?.title,
      ...(option.followUp?.actions || []), option.followUp?.frame,
    ].join(' | ')))
    if (new Set(optionFields).size !== options.length) failures.push(`${id}: 선택 후 활동이 서로 구분되지 않음`)
    if (new Set(options.map(option => plain(option.followUp?.title))).size !== options.length) failures.push(`${id}: 후속 과제 제목이 선택별로 같음`)
    if (new Set(options.map(option => plain(option.followUp?.actions?.[0]))).size !== options.length) failures.push(`${id}: 첫 행동이 선택별로 같음`)
    for (const option of options) {
      if (!plain(option.followUp?.actions?.[0]).includes(subject.slice(0, Math.min(18, subject.length)))) failures.push(`${id}/${option.label}: 현재 문항을 직접 짚는 행동 없음`)
      if ((option.followUp?.actions || []).length < 2) failures.push(`${id}/${option.label}: 실행 단계 2개 미만`)
      if (!/[___]/.test(option.followUp?.frame || '')) failures.push(`${id}/${option.label}: 학생이 채워 말할 틀 없음`)
    }

    const signature = plain(JSON.stringify({
      label: deepen.label,
      material: deepen.material,
      options: options.map(option => ({
        label: option.label,
        feedback: option.feedback,
        title: option.followUp?.title,
        actions: option.followUp?.actions,
        frame: option.followUp?.frame,
      })),
    }))
    addCount(exactPackages, signature, id)
    scenarios.add(deepen.scenario)
    if (!scenarioByProfile.has(deepen.kind)) scenarioByProfile.set(deepen.kind, new Set())
    scenarioByProfile.get(deepen.kind).add(deepen.scenario)

    const provenance = learningCaseProvenance(summary.courseKind, sample)
    if (provenance.kind === 'aligned-practice') {
      provenanceDetails.add(plain(`${provenance.label} ${provenance.detail}`))
      const correctText = answerValue(sample)
      if (correctText.length >= 8 && plain(provenance.caution).includes(correctText)) {
        failures.push(`${id}: 정답 공개 전 출처 안내가 정답 문구를 누설함`)
      }
      if (!/(이번 화면에서는|현재 학습 목표)/.test(provenance.detail)) failures.push(`${id}: 출처 안내가 현재 화면의 학습 목표를 설명하지 않음`)
    }
  }
}

const jcQuestions = jcStudyQuestions()
for (const area of buildJcOfficialAreas()) for (const lesson of area.lessons || []) {
  if (lesson.kind === 'self-report') continue
  const questions = jcQuestions.filter(question => !question.excludeFromQuiz && jcLessonMatches(question, lesson.id))
  inspect(`직업공통/${lesson.id}`, studySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'education-certification' }), questions)
}

const ncsQuestions = studyQuestions(ncs2026Questions)
for (const area of buildNcs2026Areas(ncsQuestions)) for (const lesson of area.lessons || []) {
  const questions = ncsQuestions.filter(question => !question.excludeFromQuiz && question.area === area.id && question.ncsAbility === lesson.id)
  inspect(`NCS/${lesson.id}`, studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'ncs' }), questions)
}

const recruitQuestions = studyQuestions(recruitWrittenQuestions)
for (const track of RECRUIT_WRITTEN_TRACKS) for (const area of buildRecruitWrittenAreas(track.id, recruitQuestions)) for (const lesson of area.lessons || []) {
  const questions = recruitQuestions.filter(question => !question.excludeFromQuiz
    && question.recruitmentTrack === track.id
    && recruitAreaId(question.area) === area.id
    && recruitLessonTitle(question) === lesson.id)
  inspect(`채용심화/${track.id}/${lesson.id}`, studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'recruitment' }), questions)
}

const interviewQuestions = studyQuestionsById(interviewQuizData.questions || [])
for (const lesson of interviewStudy.lessons || []) {
  const summary = studySummaries[`iv:${lesson.id}`]
  const questions = buildInterviewLearningQuestions(lesson, interviewQuestions)
  inspect(`면접/${lesson.id}`, summary ? { ...summary, courseKind: 'interview' } : null, questions)
}

for (const program of [COVER_STUDY_PROGRAM, PERSONALITY_STUDY_PROGRAM]) {
  for (const area of program.areas || []) for (const lesson of area.lessons || []) {
    inspect(`${program.title}/${area.id}/${lesson.id}`, lesson.summary, [])
  }
}

function isSharedTrackMirror(ids) {
  if (ids.length !== 3) return false
  const tracks = new Set(ids.map(id => id.match(/^채용심화\/(public|finance|enterprise)\//)?.[1]).filter(Boolean))
  const normalized = new Set(ids.map(id => id.replace(/^채용심화\/(?:public|finance|enterprise)\//, '채용심화/공통/')))
  return tracks.size === 3 && normalized.size === 1
}

const repeatedPackages = [...exactPackages.entries()].filter(([, ids]) => ids.length > 2 && !isSharedTrackMirror(ids))
if (repeatedPackages.length) {
  for (const [, ids] of repeatedPackages.slice(0, 10)) failures.push(`완전 동일 후속 학습 묶음 ${ids.length}회 반복: ${ids.slice(0, 4).join(', ')}`)
}

const uniqueRatio = exactPackages.size / Math.max(records.length, 1)
if (uniqueRatio < 0.84) failures.push(`현재 문항별 후속 학습 고유 비율 부족 (${exactPackages.size}/${records.length}, ${(uniqueRatio * 100).toFixed(1)}%)`)
if (scenarios.size < 28) failures.push(`세부 상황 분류 부족 (${scenarios.size}종)`)
if ((scenarioByProfile.get('interview')?.size || 0) < 8) failures.push(`면접 세부 상황 분류 부족 (${scenarioByProfile.get('interview')?.size || 0}종)`)
if (provenanceDetails.size / Math.max(records.length, 1) < 0.55) failures.push(`현재 문항별 출처·평가틀 안내 다양성 부족 (${provenanceDetails.size}/${records.length})`)

const adversarialCases = [
  ['interview', '지원동기', '우리 회사에 지원한 이유와 입사 후 기여를 말해 주세요.', 'interview:motivation', {}],
  ['interview', '갈등 조정 경험', '팀원과 의견이 달랐던 경험과 본인의 조율 행동을 말해 주세요.', 'interview:teamwork', {}],
  ['interview', '규정 준수', '상사가 안전 규정의 예외를 요구하면 어떻게 하겠습니까?', 'interview:ethics-safety', {}],
  ['cover-letter', '지원동기 작성', '지원 기업의 사업과 개인 계기를 연결해 작성하세요.', 'writing:motivation', { type: 'writing-practice' }],
  ['ncs', '영어 빈칸', 'Choose the best word for the blank ____ in the notice.', 'english:blank', { sourceQuestion: { id: 'ENG-BLANK-TEST', stem: 'Choose the best word for the blank ____ in the notice.' } }],
  ['math', '백분율 계산', '전체 대비 불량품의 비율을 계산하시오.', 'math:ratio-percent', {}],
  ['document', '업무 이메일', '담당자와 마감 기한을 확인해 첫 행동을 고르시오.', 'document:deadline-role', {}],
  ['workplace', '안전사고 대응', '보호구 없이 작업하라는 지시를 받았다.', 'workplace:safety', {}],
  ['ncs', '조직 내 역할과 책임 파악하기', '내 역할과 다른 팀원의 역할이 겹칠 때 공동목표와 업무분장표를 확인한다.', 'workplace:collaboration', {}],
  ['visual', '그래프 추세', '기간별 생산량의 증가와 감소를 판단하시오.', 'visual:trend', {}],
  ['general', '원인과 결과', '작업 지연의 원인과 그 결과를 고르시오.', 'general:cause-result', {}],
  ['education-certification', '업무 지시 확인', '긴급 고객 불만을 확인한 신입사원의 첫 행동은?', 'workplace:customer', {
    context: '고객 불만 접수일시 2024.03.15 14:30, 처리기한 당일 18:00',
    explanation: '먼저 상급자에게 보고해 권한을 확인하는 것이 안전합니다.',
  }],
  ['education-certification', '의사소통능력 진단평가', '회사 게시판의 공지사항에서 핵심 내용은?', 'document:deadline-role', {
    context: '정전 일시 3월 20일 13:00~17:00, 해당 시간 재택근무 또는 조기퇴근',
    explanation: '핵심은 정전 시간 동안의 업무 조정입니다.',
  }],
]
for (const [courseKind, topic, stem, expected, sampleOverrides] of adversarialCases) {
  const actual = buildEngagementCopy({
    courseKind,
    point: {
      topic,
      learn: stem,
      sampleQuestion: { stem, choices: [{ value: 'A', text: '가상 선택지' }], answer: 'A', explanation: '가상 근거', ...sampleOverrides },
    },
  }).deepen?.scenario
  if (actual !== expected) failures.push(`적대적 분류 실패: ${topic} → ${actual || '없음'} (예상 ${expected})`)
}

if (failures.length) {
  console.error(`[상황별 심화] 실패 ${failures.length}건`)
  failures.slice(0, 50).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

const profileSummary = [...scenarioByProfile.entries()]
  .map(([profile, values]) => `${profile} ${values.size}종`)
  .join(' · ')
console.log(`[상황별 심화] 통과 — ${records.length}개 카드 · 세부 상황 ${scenarios.size}종 · 완전 고유 묶음 ${exactPackages.size}종(${(uniqueRatio * 100).toFixed(1)}%) · 출처 안내 ${provenanceDetails.size}종`)
console.log(`  ${profileSummary}`)
