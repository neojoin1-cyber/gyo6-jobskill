import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import StudySummary from '../src/screens/student/StudySummary.jsx'
import { buildLearningPoints, buildQuestionDrivenSummary } from '../src/lib/learningExperience.js'
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

const failures = []
let units = 0
let cards = 0

function inspect(scope, summary, questions) {
  if (!summary) return
  units += 1
  const points = buildLearningPoints(summary, questions)
  points.forEach((point, index) => {
    cards += 1
    let html = ''
    try {
      html = renderToStaticMarkup(React.createElement(StudySummary, {
        summary,
        questions,
        initialStep: index + 1,
      }))
    } catch (error) {
      failures.push(`${scope} 핵심 ${index + 1}: 렌더링 중단 (${error.message})`)
      return
    }
    const $ = load(html)
    const sample = point?.sampleQuestion
    if (!sample) {
      failures.push(`${scope} 핵심 ${index + 1}: 화면 문항 없음`)
      return
    }
    if (/결론\s*[｜|:]\s*[A-E](?:\b|[.])/i.test($.root().text())) {
      failures.push(`${scope} 핵심 ${index + 1}: 선택 전 정답 문자 노출`)
    }
    if (sample.isInterview) {
      if (!$('button').toArray().some(button => $(button).text().includes('면접에서는 어떻게 물을까'))) {
        failures.push(`${scope} 핵심 ${index + 1}: 면접 질문 열기 버튼 없음`)
      }
      return
    }
    if (sample.type === 'pulldown') {
      const expected = sample.blanks?.length || 0
      if ($('select').length !== expected) failures.push(`${scope} 핵심 ${index + 1}: 풀다운 ${$('select').length}/${expected}개 렌더링`)
      return
    }
    const expected = sample.choices?.length || 0
    const shown = $('[data-learning-choice]').length
    if (shown !== expected || shown < 2) failures.push(`${scope} 핵심 ${index + 1}: 선택지 버튼 ${shown}/${expected}개 렌더링`)
    if ($('[data-learning-answer-state="hidden"]').length !== 1) failures.push(`${scope} 핵심 ${index + 1}: 선택 전 정답 숨김 상태 없음`)
    if ($('[data-correct]').length || $('[aria-label="정답"]').length) failures.push(`${scope} 핵심 ${index + 1}: 선택 전 정답 표시됨`)
  })
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
  const questions = recruitQuestions.filter(question => !question.excludeFromQuiz && question.recruitmentTrack === track.id && recruitAreaId(question.area) === area.id && recruitLessonTitle(question) === lesson.id)
  inspect(`채용심화/${track.id}/${lesson.id}`, studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'recruitment' }), questions)
}

const interviewQuiz = studyQuestionsById(interviewQuizData.questions || [])
for (const lesson of interviewStudy.lessons || []) {
  const summary = studySummaries[`iv:${lesson.id}`]
  const questions = buildInterviewLearningQuestions(lesson, interviewQuiz)
  inspect(`면접/${lesson.id}`, summary ? { ...summary, courseKind: 'interview' } : null, questions)
}

if (failures.length) {
  console.error(`[학습화면 렌더링] 실패 ${failures.length}건`)
  failures.slice(0, 50).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}
console.log(`[학습화면 렌더링] 통과 — ${units}단원 · ${cards}개 핵심 카드 · 선택지·정답 숨김·특수유형 DOM 확인`)
