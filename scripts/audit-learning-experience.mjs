import { existsSync, statSync } from 'node:fs'
import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import {
  buildEngagementCopy,
  buildLearningMistakes,
  buildLearningPoints,
  buildQuestionDrivenSummary,
  buildReasoningLink,
  learningVisualFor,
  learningPromptIntegrity,
  splitQuestionStem,
} from '../src/lib/learningExperience.js'
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
import interviewStudy from '../data/interview-study.json'
import interviewQuizData from '../data/interview-quiz.json'
import { buildInterviewLearningQuestions } from '../src/lib/interviewLearning.js'
import { COVER_STUDY_PROGRAM } from '../src/lib/coverStudyProgram.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'
import { englishLearningSupport, isEnglishLearningQuestion } from '../src/lib/englishLearningSupport.js'

const failures = []
const metrics = {
  units: 0, points: 0, covered: 0, visuals: 0, mistakes: 0, special: 0,
  engagementPrompts: new Set(),
  deepeningKinds: new Set(),
  deepeningMaterials: new Set(),
  englishSupport: 0,
  promptLinks: 0,
  causalLinks: 0,
  sourcePrompts: 0,
  sourceCausalLinks: 0,
  courses: { 직업공통: 0, NCS: 0, 채용심화: 0, 면접: 0 },
}

function auditSummary(scope, summary, questions, { requireMistakes = true } = {}) {
  if (!summary) {
    failures.push(`${scope}: 개념 학습 없음`)
    return
  }
  metrics.units += 1
  const course = Object.keys(metrics.courses).find(name => scope.startsWith(`${name}/`))
  if (course) metrics.courses[course] += 1
  const points = buildLearningPoints(summary, questions)
  if (!points.length) failures.push(`${scope}: 핵심 개념 카드 없음`)
  if (scope.startsWith('면접/') && !points.some(point => point?.sampleQuestion?.isInterview)) {
    failures.push(`${scope}: 실제 면접 질문·모범답변 연결 없음`)
  }
  points.forEach((point, index) => {
    if (!point || typeof point !== 'object') return
    metrics.points += 1
    if (point.visual?.src) metrics.visuals += 1
    const sample = point.sampleQuestion
    const engagement = buildEngagementCopy({
      courseKind: summary.courseKind,
      point,
      isListening: Boolean(sample?.sourceQuestion?.audioText),
    })
    if (!String(point.situation || sample?.context || '').trim() && /^위 상황에서/.test(engagement.first || '')) {
      failures.push(`${scope} 핵심 ${index + 1}: 상황문이 없는데 위 상황을 가리키는 적용 문구 사용`)
    }
    metrics.engagementPrompts.add(engagement.first)
    if (engagement.deepen?.kind) metrics.deepeningKinds.add(engagement.deepen.kind)
    if (engagement.deepen?.material) metrics.deepeningMaterials.add(engagement.deepen.material)
    if (!engagement.first || !engagement.reveal || !engagement.twist) {
      failures.push(`${scope} 핵심 ${index + 1}: 장면별 판단·근거·조건변화 문구 누락`)
    }
    if (engagement.first === '설명을 읽기 전에 현장에서 내가 할 행동을 먼저 판단하세요.') {
      failures.push(`${scope} 핵심 ${index + 1}: 공통 판단 문구가 장면별 문구로 교체되지 않음`)
    }
    if (!engagement.deepen?.label || !engagement.deepen?.material || engagement.deepen?.options?.length !== 3) {
      failures.push(`${scope} 핵심 ${index + 1}: 영역별 심화 질문·확인 자료·3개 선택 구조 누락`)
    } else if (engagement.deepen.options.some(option => !option.label || !option.feedback || !option.followUp?.actions?.length || !option.followUp?.frame)) {
      failures.push(`${scope} 핵심 ${index + 1}: 심화 선택 뒤 자료·행동·말하기 틀 누락`)
    }
    if (sample?.stem) metrics.covered += 1
    else failures.push(`${scope} 핵심 ${index + 1}: 실제 문항 연결 없음`)
    if (sample?.stem && !sample.isInterview && sample.type !== 'reflection' && sample.type !== 'writing-practice') {
      const integrity = learningPromptIntegrity(sample)
      if (!integrity.valid) {
        failures.push(`${scope} 핵심 ${index + 1}: 발문이 가리키는 상황·빈칸·원인/결과 근거 연결 누락 (${sample.sourceQuestion?.id || sample.stem})`)
      }
      const reasoningLink = buildReasoningLink(sample)
      if (!reasoningLink?.items?.every(item => item.label && item.text)) {
        failures.push(`${scope} 핵심 ${index + 1}: 단서→판단→결론 근거 연결을 만들 수 없음 (${sample.sourceQuestion?.id || sample.stem})`)
      } else {
        metrics.promptLinks += 1
        if (integrity.asksCausalLink) metrics.causalLinks += 1
      }
    }
    if (sample && !sample.isInterview) {
      const type = sample.type || 'choice'
      const choices = Array.isArray(sample.choices) ? sample.choices : []
      const values = choices.map(choice => choice?.value).filter(Boolean)
      const answers = Array.isArray(sample.answer) ? sample.answer : [sample.answer]
      const sourceLabel = sample.sourceQuestion?.id || sample.stem || 'id 없음'
      if (type === 'writing-practice') {
        if (!sample.context || !sample.draft || !sample.modelAnswer || !sample.checklist?.length) {
          failures.push(`${scope} 핵심 ${index + 1}: 작성 실습의 지원 문항·감점 초안·점검 기준·개선 예시 누락 (${sourceLabel})`)
        }
      } else if (type === 'reflection') {
        if (choices.length < 2 || sample.answer != null || !sample.feedback) {
          failures.push(`${scope} 핵심 ${index + 1}: 정답 없는 성찰 선택지·피드백 구조 오류 (${sourceLabel})`)
        }
      } else if (type === 'pulldown') {
        const blanks = sample.blanks || []
        if (!blanks.length) failures.push(`${scope} 핵심 ${index + 1}: 풀다운 빈칸 누락 (${sourceLabel})`)
        if (blanks.some(blank => !Array.isArray(blank.options) || blank.options.length < 2 || !Number.isInteger(blank.answer) || !blank.options[blank.answer])) {
          failures.push(`${scope} 핵심 ${index + 1}: 풀다운 선택지·정답 연결 오류 (${sourceLabel})`)
        }
      } else {
        if (choices.length < 2) failures.push(`${scope} 핵심 ${index + 1}: 선택형 문항 보기 누락 (${sourceLabel})`)
        if (choices.some(choice => !choice?.value || !choice?.text)) {
          failures.push(`${scope} 핵심 ${index + 1}: 화면용 보기 값·본문 누락`)
        }
        if (!answers.length || answers.some(answer => !values.includes(answer))) {
          failures.push(`${scope} 핵심 ${index + 1}: 정답이 화면 보기와 연결되지 않음 (${answers.join(', ')} / ${sourceLabel})`)
        }
      }
    }
    if (/결론\s*[｜|:]\s*[A-E](?:\b|[.])/i.test(String(point.learn || ''))) {
      failures.push(`${scope} 핵심 ${index + 1}: 선택 전 정답 문자 노출`)
    }
    if (!sample?.thinkingSteps?.length) failures.push(`${scope} 핵심 ${index + 1}: 풀이 순서 없음`)
    if (sample && isEnglishLearningQuestion(sample)) {
      metrics.englishSupport += 1
      if (!englishLearningSupport(sample)?.passage) {
        failures.push(`${scope} 핵심 ${index + 1}: 영어 문항 해석 자료 누락 (${sample.sourceQuestion?.id || 'id 없음'})`)
      }
      if (!/(영어|듣고)/.test(sample.thinkingLabel || '')) {
        failures.push(`${scope} 핵심 ${index + 1}: 영어 문항 전용 풀이 순서 제목 누락 (${sample.sourceQuestion?.id || 'id 없음'})`)
      }
      if ((sample.thinkingSteps || []).some(step => /계산식|구하려는 값|단위.*재검산/.test(step))) {
        failures.push(`${scope} 핵심 ${index + 1}: 영어 문항에 수리 풀이 안내 노출 (${sample.sourceQuestion?.id || 'id 없음'})`)
      }
      if (point.engagement?.deepen?.kind === 'math' || /(계산 유지|다시 계산|수치·단위)/.test(JSON.stringify(point.engagement?.deepen || {}))) {
        failures.push(`${scope} 핵심 ${index + 1}: 영어 문항에 수리 심화 자료 노출 (${sample.sourceQuestion?.id || 'id 없음'})`)
      }
    }
    if (!point.visual?.src) failures.push(`${scope} 핵심 ${index + 1}: 상황 삽화 없음`)
  })
  const mistakes = buildLearningMistakes(summary, questions)
  metrics.mistakes += mistakes.filter(mistake => mistake.wrongChoice && mistake.correctChoice?.length).length
  if (requireMistakes && !mistakes.some(mistake => mistake.wrongChoice && mistake.correctChoice?.length)) {
    failures.push(`${scope}: 실제 오답 선택·교정 카드 없음`)
  }
}

const jcQuestions = jcStudyQuestions()
for (const area of buildJcOfficialAreas()) {
  for (const lesson of area.lessons || []) {
    if (lesson.kind === 'self-report') {
      metrics.special += 1
      continue
    }
    const questions = jcQuestions.filter(question => !question.excludeFromQuiz && jcLessonMatches(question, lesson.id))
    const summary = studySummaries[lesson.id] || buildQuestionDrivenSummary({
      title: lesson.label,
      questions,
      courseKind: 'education-certification',
    })
    auditSummary(`직업공통/${lesson.id}`, summary, questions)
  }
}

const ncsStudyQuestions = studyQuestions(ncs2026Questions)
for (const area of buildNcs2026Areas(ncsStudyQuestions)) {
  for (const lesson of area.lessons || []) {
    const summary = studySummaries[lesson.id] || abilitySummaries[lesson.id]
    const questions = ncsStudyQuestions.filter(question =>
      !question.excludeFromQuiz && question.area === area.id && question.ncsAbility === lesson.id)
    auditSummary(`NCS/${lesson.id}`, summary || buildQuestionDrivenSummary({
      title: lesson.label,
      questions,
      courseKind: 'ncs',
    }), questions)
  }
}

const recruitStudyQuestions = studyQuestions(recruitWrittenQuestions)
for (const track of RECRUIT_WRITTEN_TRACKS) {
  for (const area of buildRecruitWrittenAreas(track.id, recruitStudyQuestions)) {
    for (const lesson of area.lessons || []) {
      const questions = recruitStudyQuestions.filter(question =>
        !question.excludeFromQuiz &&
        question.recruitmentTrack === track.id &&
        recruitAreaId(question.area) === area.id &&
        recruitLessonTitle(question) === lesson.id)
      const summary = studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({
        title: lesson.label,
        questions,
        courseKind: 'recruitment',
      })
      auditSummary(`채용심화/${track.id}/${lesson.id}`, summary, questions)
    }
  }
}

const interviewQuiz = studyQuestionsById(interviewQuizData.questions || [])
for (const lesson of interviewStudy.lessons || []) {
  const summary = studySummaries[`iv:${lesson.id}`]
  const questions = buildInterviewLearningQuestions(lesson, interviewQuiz)
  auditSummary(`면접/${lesson.id}`, summary ? { ...summary, courseKind: 'interview' } : null, questions)
}

// 핵심 카드로 뽑힌 대표 문항뿐 아니라 자율학습 원문항 전체도 검사한다.
// "위 상황/다음 자료/빈칸/원인/결과"라고 묻고 정작 화면 근거가 없는 문항은
// 대표 카드에 우연히 선택되지 않았더라도 출시를 막아야 한다.
const auditedSourceIds = new Set()
for (const question of [...jcQuestions, ...ncsStudyQuestions, ...recruitStudyQuestions, ...interviewQuiz]) {
  if (!question || question.excludeFromQuiz || !question.stem) continue
  const key = String(question.id || `${question.stem}:${question.answer}`)
  if (auditedSourceIds.has(key)) continue
  auditedSourceIds.add(key)
  metrics.sourcePrompts += 1
  const integrity = learningPromptIntegrity(question)
  if (integrity.asksCausalLink) metrics.sourceCausalLinks += 1
  if (!integrity.valid) failures.push(`원문항 ${key}: 상황·사례·빈칸·원인/결과 발문과 화면 근거 연결 누락`)
}

for (const program of [COVER_STUDY_PROGRAM, PERSONALITY_STUDY_PROGRAM]) {
  for (const area of program.areas || []) for (const lesson of area.lessons || []) {
    auditSummary(`${program.title}/${area.id}/${lesson.id}`, lesson.summary, [], { requireMistakes: false })
  }
}

for (const name of ['documents', 'data', 'teamwork', 'interview', 'reflection']) {
  const path = `public/images/learning/workplace-${name}.webp`
  if (!existsSync(path) || statSync(path).size < 40_000) failures.push(`학습 삽화 누락 또는 저용량: ${path}`)
}

const mboSplit = splitQuestionStem('유통회사 기획팀 직원 강민지 씨는 기업 목표 설정 방법론을 정리하고 있다. 다음 중 MBO(목표관리법, Management by Objectives)에 대한 설명으로 가장 적절한 것은?')
if (mboSplit.context !== '유통회사 기획팀 직원 강민지 씨는 기업 목표 설정 방법론을 정리하고 있다.' || !mboSplit.stem.startsWith('다음 중 MBO')) {
  failures.push('한 줄 문항의 현장 맥락과 실제 발문 분리 실패')
}
const mboVisual = learningVisualFor('조직·인사·리더십·성과관리 MBO 목표 설정', 'recruitment')
if (!mboVisual.src.endsWith('workplace-teamwork.webp')) {
  failures.push('MBO의 목표 안 글자 표를 데이터 표로 오인하여 학습 삽화가 잘못 연결됨')
}

if (failures.length) {
  console.error(`[학습경험] 실패 ${failures.length}건`)
  failures.slice(0, 40).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

if (metrics.engagementPrompts.size < Math.ceil(metrics.points * 0.55)) {
  console.error(`[학습경험] 실패 - 장면별 판단 문구 다양성 부족 (${metrics.engagementPrompts.size}/${metrics.points})`)
  process.exit(1)
}

if (metrics.deepeningKinds.size < 7 || metrics.deepeningMaterials.size < 7) {
  console.error(`[학습경험] 실패 - 과목·자료별 심화 구조 다양성 부족 (유형 ${metrics.deepeningKinds.size} / 자료 ${metrics.deepeningMaterials.size})`)
  process.exit(1)
}

console.log(`[학습경험] 통과 — ${metrics.units}학습단원 + 특수진단 ${metrics.special}개 · 핵심 ${metrics.points}개 · 장면별 판단 문구 ${metrics.engagementPrompts.size}개 · 심화 유형 ${metrics.deepeningKinds.size}개 · 확인 자료 ${metrics.deepeningMaterials.size}종 · 영어 해석 ${metrics.englishSupport}개 · 화면 근거 연결 ${metrics.promptLinks}개(원인·결과 ${metrics.causalLinks}개) · 원문항 연결 검사 ${metrics.sourcePrompts}개(원인·결과 ${metrics.sourceCausalLinks}개) · 실제 오답 ${metrics.mistakes}개 · 상황 삽화 ${metrics.visuals}개`)
console.log(`  직업공통 ${metrics.courses.직업공통}학습+진단 ${metrics.special} · NCS ${metrics.courses.NCS} · 채용필기 심화 ${metrics.courses.채용심화} · 고졸면접 ${metrics.courses.면접}`)
