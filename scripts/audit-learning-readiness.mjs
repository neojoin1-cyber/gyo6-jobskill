import fs from 'node:fs'
import { jcStudyQuestions, buildJcOfficialAreas, jcLessonMatches } from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions, buildNcs2026Areas, ncs2026Coverage } from '../src/lib/ncs2026.js'
import {
  RECRUIT_WRITTEN_TRACKS,
  getRecruitTrackQuestions,
  buildRecruitWrittenAreas,
} from '../src/lib/recruitWritten.js'
import interviewStudy from '../data/interview-study.json'
import interviewQuiz from '../data/interview-quiz.json'
import mockInterview from '../data/mock-interview-pool.json'

const flattenLessons = areas => areas.flatMap(area => area.lessons || [])
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()

function questionAudit(questions) {
  const seen = new Map()
  const duplicates = []
  const answerCounts = {}
  let missingExplanation = 0
  let malformedChoices = 0

  for (const question of questions) {
    const key = normalize(`${question.context || question.ctx || ''} ${question.stem || question.question || ''}`)
    if (key && seen.has(key)) duplicates.push([seen.get(key), question.id])
    else if (key) seen.set(key, question.id)
    if (!normalize(question.explanation)) missingExplanation += 1
    const mode = question.questionMode || question.type || 'mcq'
    const isFourChoice = mode === 'mcq' || mode === 'choice' || (!question.questionMode && !question.type)
    if (isFourChoice && (!Array.isArray(question.choices) || question.choices.length < 4)) malformedChoices += 1
    answerCounts[question.answer || question.ans || 'missing'] = (answerCounts[question.answer || question.ans || 'missing'] || 0) + 1
  }

  return {
    count: questions.length,
    missingExplanation,
    malformedChoices,
    duplicateStemCount: duplicates.length,
    duplicateExamples: duplicates.slice(0, 20),
    answerCounts,
  }
}

function groupCount(items, key) {
  return Object.fromEntries([...items.reduce((map, item) => {
    const value = item[key] || '미분류'
    map.set(value, (map.get(value) || 0) + 1)
    return map
  }, new Map())].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ko')))
}

const jcQuestions = jcStudyQuestions()
const jcAreas = buildJcOfficialAreas()
const ncsAreas = buildNcs2026Areas()
const interviewLessons = interviewStudy.lessons || []
const interviewPractice = interviewLessons.flatMap(lesson => lesson.practiceQuestions || [])
const interviewSections = interviewLessons.flatMap(lesson => lesson.sections || [])

const prohibitedGradePattern = /A\s*등급\s*(?:답안|문제해결|판단|역량|도전)/gi
const jcGradeTerminology = jcQuestions.flatMap(question => {
  const text = JSON.stringify(question)
  const matches = [...text.matchAll(prohibitedGradePattern)].map(match => match[0])
  return matches.length ? [{ id: question.id, matches }] : []
})

const recruitTracks = RECRUIT_WRITTEN_TRACKS.map(track => {
  const questions = getRecruitTrackQuestions(track.id)
  const areas = buildRecruitWrittenAreas(track.id)
  return {
    id: track.id,
    label: track.label,
    questionAudit: questionAudit(questions),
    areaCounts: groupCount(questions, 'area'),
    lessons: flattenLessons(areas).length,
    notice: track.notice,
  }
})

const report = {
  generatedAt: new Date().toISOString(),
  teenup: {
    officialAreaCount: jcAreas.length,
    officialAreas: jcAreas.map(area => ({
      id: area.id,
      name: area.name,
      lessons: area.lessons?.length || 0,
      questions: jcQuestions.filter(question =>
        question.officialArea === area.id && area.lessons.some(lesson => jcLessonMatches(question, lesson.id))).length,
    })),
    questionAudit: questionAudit(jcQuestions),
    areaCounts: groupCount(jcQuestions, 'area'),
    demandLevelCounts: groupCount(jcQuestions, 'demandLevel'),
    prohibitedLetterGradeReferences: jcGradeTerminology,
  },
  ncs2026: {
    officialAreaCount: ncsAreas.length,
    officialAreas: ncsAreas.map(area => ({
      id: area.id,
      name: area.name,
      lessons: area.lessons?.length || 0,
      questions: ncs2026Questions.filter(question => question.area === area.id).length,
    })),
    coverage: ncs2026Coverage(),
    questionAudit: questionAudit(ncs2026Questions),
    areaCounts: groupCount(ncs2026Questions, 'area'),
    abilityCounts: groupCount(ncs2026Questions, 'ncsAbility'),
    demandLevelCounts: groupCount(ncs2026Questions, 'demandLevel'),
  },
  recruitment: {
    tracks: recruitTracks,
  },
  interview: {
    lessonCount: interviewLessons.length,
    categoryCounts: groupCount(interviewLessons, 'category'),
    levelCounts: groupCount(interviewLessons, 'level'),
    totalDurationMin: interviewLessons.reduce((sum, lesson) => sum + Number(lesson.durationMin || 0), 0),
    theorySectionCount: interviewSections.length,
    practiceQuestionCount: interviewPractice.length,
    practiceWithModelAnswer: interviewPractice.filter(item => normalize(item.modelAnswer)).length,
    practiceWithCheckPoints: interviewPractice.filter(item => Array.isArray(item.answerPoints) && item.answerPoints.length).length,
    quizAudit: questionAudit(interviewQuiz.questions || []),
    mockPoolAudit: questionAudit(mockInterview.pool || []),
    mockScopes: (mockInterview.scopes || []).map(scope => scope.name),
  },
}

fs.mkdirSync('output', { recursive: true })
fs.writeFileSync('output/learning-readiness-report.json', `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify(report, null, 2))
if (jcGradeTerminology.length) process.exitCode = 2
