import { existsSync, statSync } from 'node:fs'
import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import {
  buildEngagementCopy,
  buildLearningMistakes,
  buildLearningPoints,
  buildQuestionDrivenSummary,
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

const failures = []
const metrics = {
  units: 0, points: 0, covered: 0, visuals: 0, mistakes: 0, special: 0,
  engagementPrompts: new Set(),
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
    metrics.engagementPrompts.add(engagement.first)
    if (!engagement.first || !engagement.reveal || !engagement.twist) {
      failures.push(`${scope} 핵심 ${index + 1}: 장면별 판단·근거·조건변화 문구 누락`)
    }
    if (engagement.first === '설명을 읽기 전에 현장에서 내가 할 행동을 먼저 판단하세요.') {
      failures.push(`${scope} 핵심 ${index + 1}: 공통 판단 문구가 장면별 문구로 교체되지 않음`)
    }
    if (sample?.stem) metrics.covered += 1
    else failures.push(`${scope} 핵심 ${index + 1}: 실제 문항 연결 없음`)
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

for (const program of [COVER_STUDY_PROGRAM, PERSONALITY_STUDY_PROGRAM]) {
  for (const area of program.areas || []) for (const lesson of area.lessons || []) {
    auditSummary(`${program.title}/${area.id}/${lesson.id}`, lesson.summary, [], { requireMistakes: false })
  }
}

for (const name of ['documents', 'data', 'teamwork', 'interview', 'reflection']) {
  const path = `public/images/learning/workplace-${name}.webp`
  if (!existsSync(path) || statSync(path).size < 40_000) failures.push(`학습 삽화 누락 또는 저용량: ${path}`)
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

console.log(`[학습경험] 통과 — ${metrics.units}학습단원 + 특수진단 ${metrics.special}개 · 핵심 ${metrics.points}개 · 장면별 판단 문구 ${metrics.engagementPrompts.size}개 · 실제 문항 ${metrics.covered}개 · 실제 오답 ${metrics.mistakes}개 · 상황 삽화 ${metrics.visuals}개`)
console.log(`  직업공통 ${metrics.courses.직업공통}학습+진단 ${metrics.special} · NCS ${metrics.courses.NCS} · 채용필기 심화 ${metrics.courses.채용심화} · 고졸면접 ${metrics.courses.면접}`)
