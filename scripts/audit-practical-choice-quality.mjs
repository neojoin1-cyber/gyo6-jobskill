import fs from 'node:fs'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../src/lib/coverAssessmentBank.js'
import { COVER_QUESTION_GUIDES } from '../src/lib/coverLetterGuidance.js'
import { buildInterviewConceptChecks } from '../src/lib/interviewLearning.js'

const interviewStudy = JSON.parse(fs.readFileSync('data/interview-study.json', 'utf8'))
const interviewQuestions = interviewStudy.lessons.flatMap(lesson => buildInterviewConceptChecks(lesson))
const failures = []
const lengthOf = value => [...String(value || '').trim()].length
const answerIndex = question => String(question.answer).toUpperCase().charCodeAt(0) - 65
const isMetaDraft = value => /(?:작성|정리|제시|강조|설명)함[.!?]?\s*$/.test(String(value || '').trim())

for (const [id, guide] of Object.entries(COVER_QUESTION_GUIDES)) {
  if (isMetaDraft(guide.good) || isMetaDraft(guide.trap)) failures.push(`자기소개서 ${id}: 실제 지원서 문장 대신 작성 설명문을 사용함`)
}

function auditQuestion(question, kind, { minStem, minChoice, maxSpread, maxRatio }) {
  const choices = question.choices || []
  if (lengthOf(question.stem) < minStem) failures.push(`${kind} ${question.id}: 상황·발문이 너무 짧음`)
  if (choices.length !== 4) failures.push(`${kind} ${question.id}: 보기가 ${choices.length}개임`)
  if (kind === '자기소개서' && choices.some(isMetaDraft)) failures.push(`${kind} ${question.id}: '~작성함' 형태의 설명 보기가 남음`)
  const lengths = choices.map(lengthOf)
  const shortest = Math.min(...lengths)
  const longest = Math.max(...lengths)
  if (shortest < minChoice) failures.push(`${kind} ${question.id}: 가장 짧은 보기 ${shortest}자`)
  if (longest - shortest > maxSpread) failures.push(`${kind} ${question.id}: 보기 길이 차 ${longest - shortest}자`)
  if (longest / Math.max(1, shortest) > maxRatio) failures.push(`${kind} ${question.id}: 보기 길이 비율 ${(longest / shortest).toFixed(2)}`)
  const correct = kind === '자기소개서' ? question.answer : answerIndex(question)
  if (correct < 0 || correct >= choices.length) failures.push(`${kind} ${question.id}: 정답 위치 오류`)
  return { correct, lengths }
}

const coverResults = COVER_DIAGNOSTIC_QUESTIONS.map(question =>
  auditQuestion(question, '자기소개서', { minStem: 45, minChoice: 42, maxSpread: 28, maxRatio: 1.55 }))
const interviewResults = interviewQuestions.map(question => {
  if (lengthOf(question.context) < 22) failures.push(`면접 ${question.id}: 실제 상황이 너무 짧음`)
  return auditQuestion(question, '면접', { minStem: 12, minChoice: 24, maxSpread: 34, maxRatio: 1.9 })
})

function positionCounts(results) {
  return results.reduce((counts, result) => {
    counts[result.correct] = (counts[result.correct] || 0) + 1
    return counts
  }, [0, 0, 0, 0])
}

const coverPositions = positionCounts(coverResults)
const interviewPositions = positionCounts(interviewResults)
if (coverPositions.some(count => count !== 3)) failures.push(`자기소개서 정답 위치 불균형: ${coverPositions.join('/')}`)
if (Math.max(...interviewPositions) - Math.min(...interviewPositions) > 5) failures.push(`면접 정답 위치 불균형: ${interviewPositions.join('/')}`)

function longestCorrectRate(results) {
  return results.filter(result => {
    const longest = Math.max(...result.lengths)
    return result.lengths[result.correct] === longest && result.lengths.filter(length => length === longest).length === 1
  }).length / results.length
}

const coverLongestRate = longestCorrectRate(coverResults)
const interviewLongestRate = longestCorrectRate(interviewResults)
if (coverLongestRate > .34) failures.push(`자기소개서 정답 단독 최장 보기 비율 ${(coverLongestRate * 100).toFixed(1)}%`)
if (interviewLongestRate > .34) failures.push(`면접 정답 단독 최장 보기 비율 ${(interviewLongestRate * 100).toFixed(1)}%`)

if (failures.length) {
  failures.forEach(failure => console.error(`FAIL ${failure}`))
  process.exit(1)
}

console.log(`[실전 선다형 품질] 통과 — 자기소개서 ${COVER_DIAGNOSTIC_QUESTIONS.length}문항 · 면접 ${interviewQuestions.length}상황 · 정답 위치 ${interviewPositions.join('/')} · 최장 정답 ${(interviewLongestRate * 100).toFixed(1)}%`)
