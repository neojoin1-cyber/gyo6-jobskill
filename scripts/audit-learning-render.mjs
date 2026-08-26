import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { existsSync, statSync } from 'node:fs'
import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import StudySummary, { buildStudySummaryCards } from '../src/screens/student/StudySummary.jsx'
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
import { COVER_STUDY_PROGRAM } from '../src/lib/coverStudyProgram.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'

const failures = []
let units = 0
let cards = 0
let audioCards = 0
let sourceMediaCards = 0
let activeExitCards = 0
let formativeCards = 0
let rawSourceQuestions = 0
const inspectedRawSources = new Set()

const SOURCE_REFERENCE = /(?:다음|위|아래)(?:의|은|에서|에)?\s*(?:대화|통화|전화|내용|지문|글|문서|자료|표|그래프|도표|안내|공지|보고서|회의록|사례|상황)/

function hasInlineSource(question) {
  const stem = String(question?.stem || question?.question || '').trim()
  if (question?.pairs?.length || question?.blanks?.length) return true
  if (/\*[^*]{10,}\*/.test(stem)) return true
  if (/\?\s*.{8,}$/.test(stem)) return true
  if ((stem.match(/\d+(?:\.\d+)?/g) || []).length >= 4) return true
  return [...stem].length >= 80 && /[.!?。:]|\d/.test(stem)
}

function inspectRequiredSource(scope, point, $, index) {
  const sample = point?.sampleQuestion
  const source = sample?.sourceQuestion || sample
  if (!source || sample?.isInterview || sample?.type === 'writing-practice' || sample?.type === 'reflection') return

  const stem = String(source.stem || source.question || '')
  const hasContext = String(source.context || source.passage || '').trim().length >= 10
  const hasAudio = String(source.audioText || '').trim().length >= 10
  const hasVisual = !!source.visual

  if (SOURCE_REFERENCE.test(stem) && !hasContext && !hasAudio && !hasVisual && !hasInlineSource(source)) {
    failures.push(`${scope} 핵심 ${index + 1}: 발문이 가리키는 대화·지문·자료·상황 원문 누락 (${source.id || 'id 없음'})`)
  }

  const expectsAudio = /(?:ENG-dialog|JC26-KO-LISTEN|듣기)/.test(`${scope} ${source.lessonId || ''} ${source.lessonTitle || ''}`)
  if (expectsAudio && !hasAudio) {
    failures.push(`${scope} 핵심 ${index + 1}: 듣기 차시인데 음성 원문 누락 (${source.id || 'id 없음'})`)
  }
  if (hasAudio) {
    audioCards += 1
    if (!source.audioLang || !String(source.transcript || '').trim()) {
      failures.push(`${scope} 핵심 ${index + 1}: 듣기 언어 또는 접근성 대본 누락 (${source.id || 'id 없음'})`)
    }
    const audioPath = `public/audio/listening/${source.id}.mp3`
    if (!existsSync(audioPath) || statSync(audioPath).size < 1_000) {
      failures.push(`${scope} 핵심 ${index + 1}: 패키지 듣기 음원 누락·손상 (${audioPath})`)
    }
    if ($('[data-listening-prompt="study"]').length !== 1) {
      failures.push(`${scope} 핵심 ${index + 1}: 자율학습 반복 듣기 재생기 미렌더링 (${source.id || 'id 없음'})`)
    }
    const transcript = String(source.transcript || source.audioText).trim()
    if (transcript.length >= 10 && $.root().text().includes(transcript)) {
      failures.push(`${scope} 핵심 ${index + 1}: 재생·정답 확인 전에 듣기 대본 노출 (${source.id || 'id 없음'})`)
    }
  }

  if (hasVisual) {
    sourceMediaCards += 1
    const type = source.visual.type
    if (!$(`[data-question-media="${type}"]`).length) {
      failures.push(`${scope} 핵심 ${index + 1}: 표·그래프 원자료 미렌더링 (${source.id || 'id 없음'} / ${type})`)
    }
  }

  const expectsReadingSource = /(?:ENG-reading|문서 읽기|독해)/.test(`${scope} ${source.lessonId || ''} ${source.lessonTitle || ''}`)
  if (expectsReadingSource && !hasContext && !hasVisual && !hasInlineSource(source)) {
    failures.push(`${scope} 핵심 ${index + 1}: 읽기 차시인데 읽을 지문 누락 (${source.id || 'id 없음'})`)
  }
}

function inspectQuestionPool(scope, questions) {
  for (const question of questions || []) {
    const key = question.id || `${scope}:${question.stem || question.question}`
    if (inspectedRawSources.has(key)) continue
    inspectedRawSources.add(key)
    rawSourceQuestions += 1

    const stem = String(question.stem || question.question || '')
    const context = String(question.context || question.passage || '').trim()
    const audioText = String(question.audioText || '').trim()
    const transcript = String(question.transcript || '').trim()
    const hasContext = context.length >= 10
    const hasAudio = audioText.length >= 10
    const hasVisual = !!question.visual
    const label = `${scope} ${question.lessonId || ''} ${question.lessonTitle || ''}`

    if (SOURCE_REFERENCE.test(stem) && !hasContext && !hasAudio && !hasVisual && !hasInlineSource(question)) {
      failures.push(`${scope}: 발문이 가리키는 대화·지문·자료·상황 원문 누락 (${question.id || 'id 없음'})`)
    }
    if (/(?:ENG-dialog|JC26-KO-LISTEN|듣기)/.test(label) && !hasAudio) {
      failures.push(`${scope}: 듣기 차시 원문항에 음성 누락 (${question.id || 'id 없음'})`)
    }
    if (/(?:ENG-reading|문서 읽기|독해)/.test(label) && !hasContext && !hasVisual && !hasInlineSource(question)) {
      failures.push(`${scope}: 읽기 차시 원문항에 지문 누락 (${question.id || 'id 없음'})`)
    }
    if (question.mediaType === 'audio' && !hasAudio) {
      failures.push(`${scope}: audio 유형인데 audioText 누락 (${question.id || 'id 없음'})`)
    }
    if (question.mediaType === 'visual' && !hasVisual) {
      failures.push(`${scope}: visual 유형인데 구조화 자료 누락 (${question.id || 'id 없음'})`)
    }
    if (hasAudio) {
      if (!question.audioLang || !transcript) failures.push(`${scope}: 듣기 언어·대본 메타데이터 누락 (${question.id || 'id 없음'})`)
      const audioPath = `public/audio/listening/${question.id}.mp3`
      if (!existsSync(audioPath) || statSync(audioPath).size < 1_000) failures.push(`${scope}: 듣기 음원 누락·손상 (${audioPath})`)
    }
    if (hasVisual && !['table', 'bar'].includes(question.visual?.type)) {
      failures.push(`${scope}: 화면이 지원하지 않는 시각자료 유형 (${question.id || 'id 없음'} / ${question.visual?.type || 'type 없음'})`)
    }
  }
}

function inspect(scope, summary, questions) {
  if (!summary) return
  units += 1
  inspectQuestionPool(scope, questions)
  const points = buildLearningPoints(summary, questions)
  const summaryCards = buildStudySummaryCards(summary, questions)
  const missionIndex = summaryCards.findIndex(card => card.type === 'mission')
  const formativeIndex = summaryCards.findIndex(card => card.type === 'formative')
  if (missionIndex < 0) {
    failures.push(`${scope}: 행동을 확정하는 능동 마무리 카드 없음`)
  } else {
    const missionHtml = renderToStaticMarkup(React.createElement(StudySummary, { summary, questions, initialStep: missionIndex }))
    const missionPage = load(missionHtml)
    if (missionPage('[data-learning-card="active-exit"]').length !== 1) failures.push(`${scope}: 능동 마무리 화면 미렌더링`)
    if (!missionPage('.learning-exit-confirm').is(':disabled')) failures.push(`${scope}: 행동 선택 전 마무리 확정 버튼 활성화됨`)
    activeExitCards += 1
  }
  if (formativeIndex < 0) {
    failures.push(`${scope}: 자율학습 3문항 형성평가 카드 없음`)
  } else {
    const assessment = summaryCards[formativeIndex].assessment
    if (assessment?.questions?.length !== 3 || assessment.questions[2]?.kind !== 'transfer') {
      failures.push(`${scope}: 형성평가 2개 복습+1개 변형 구조 불일치`)
    }
    const formativeHtml = renderToStaticMarkup(React.createElement(StudySummary, { summary, questions, initialStep: formativeIndex }))
    const formativePage = load(formativeHtml)
    if (formativePage('[data-learning-card="formative-assessment"] > ol > li').length !== 3) {
      failures.push(`${scope}: 3문항 형성평가 화면 미렌더링`)
    }
    formativeCards += 1
  }
  if (['cover-letter', 'interview'].includes(summary.courseKind)) {
    const passiveCards = summaryCards.filter(card => ['recap', 'term', 'tip'].includes(card.type))
    if (passiveCards.length) failures.push(`${scope}: 실전 과정에 수동형 마무리 카드 ${passiveCards.length}개 잔존`)
  }
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
    inspectRequiredSource(scope, point, $, index)
    if ($('[data-engagement-phase="first-judgment"]').length !== 1) {
      failures.push(`${scope} 핵심 ${index + 1}: 설명 전 먼저 판단 단계 없음`)
    }
    if ($('[data-engagement-phase="evidence-reveal"]').length) {
      failures.push(`${scope} 핵심 ${index + 1}: 학생 응답 전 근거·설명 공개됨`)
    }
    if (/결론\s*[｜|:]\s*[A-E](?:\b|[.])/i.test($.root().text())) {
      failures.push(`${scope} 핵심 ${index + 1}: 선택 전 정답 문자 노출`)
    }
    if (sample.type === 'writing-practice') {
      if ($('[data-learning-question="writing-practice"] textarea').length !== 1) {
        failures.push(`${scope} 핵심 ${index + 1}: 직접 고쳐쓰기 입력란 미렌더링`)
      }
      return
    }
    if (sample.type === 'reflection') {
      const expected = sample.choices?.length || 0
      const shown = $('[data-learning-question="reflection"] button').length
      if (shown !== expected || shown < 2) failures.push(`${scope} 핵심 ${index + 1}: 성찰 선택지 ${shown}/${expected}개 렌더링`)
      if ($('[data-correct]').length || $('[aria-label="정답"]').length) failures.push(`${scope} 핵심 ${index + 1}: 정답 없는 성찰에 정답 표시됨`)
      return
    }
    if (sample.isInterview) {
      if (!$('button').toArray().some(button => $(button).text().includes('20초 동안 먼저 답한 뒤 핵심 보기'))) {
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

for (const program of [COVER_STUDY_PROGRAM, PERSONALITY_STUDY_PROGRAM]) {
  for (const area of program.areas || []) for (const lesson of area.lessons || []) {
    inspect(`${program.title}/${area.id}/${lesson.id}`, lesson.summary, [])
  }
}

if (failures.length) {
  console.error(`[학습화면 렌더링] 실패 ${failures.length}건`)
  failures.slice(0, 50).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}
console.log(`[학습화면 렌더링] 통과 — ${units}단원 · 원문항 ${rawSourceQuestions}개 · ${cards}개 핵심 카드 · 능동 마무리 ${activeExitCards}개 · 3문항 형성평가 ${formativeCards}개 · 듣기 ${audioCards}개 · 표·그래프 ${sourceMediaCards}개 · 먼저 판단·정답 숨김 DOM 확인`)
