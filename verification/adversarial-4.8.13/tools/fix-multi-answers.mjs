// multi 문항 정답을 배열로 올바르게 직렬화한다. 앱 소스·데이터는 수정하지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { jcStudyQuestions, englishStudyQuestions } from '../../../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../../../src/lib/ncs2026.js'
import { recruitWrittenQuestions } from '../../../src/lib/recruitWritten.js'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../../../src/lib/coverAssessmentBank.js'
import { readFileSync as _rf } from 'node:fs'
const interviewQuiz = JSON.parse(_rf('data/interview-quiz.json','utf8'))
import { withExtractedChoices, isMultiQuestion, answerSetOf } from '../../../src/lib/questionNorm.js'

const all = []
const add = (x) => { const arr = typeof x === "function" ? x() : x; for (const q of (arr || [])) all.push(q) }
for (const src of [jcStudyQuestions, englishStudyQuestions, ncs2026Questions, recruitWrittenQuestions, COVER_DIAGNOSTIC_QUESTIONS, interviewQuiz.questions]) add(src)

const out = {}
let n = 0, empty = 0
for (const raw of all) {
  const q = withExtractedChoices(raw)
  if (!q?.id || !isMultiQuestion(q)) continue
  if (out[q.id]) continue
  const set = [...answerSetOf(q)].sort((a, b) => a - b)
  out[q.id] = { answerRaw: q.answer ?? null, answerNos: set.map(i => i + 1), size: set.length }
  n++; if (!set.length) empty++
}
writeFileSync('verification/adversarial-4.8.13/private/CNT_multi_answers_fixed.json',
  JSON.stringify(out, null, 1) + '\n')
console.log('multi 문항:', n, '· 정답 집합이 실제로 빈 것:', empty)
const sizes = {}
for (const v of Object.values(out)) sizes[v.size] = (sizes[v.size] || 0) + 1
console.log('정답 개수 분포:', JSON.stringify(sizes))
console.log('정답 1개뿐인 multi(모드 오라벨 후보):',
  Object.entries(out).filter(([, v]) => v.size === 1).length)
