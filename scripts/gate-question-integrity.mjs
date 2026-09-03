import manifest from '../data/question-integrity-quarantine.json' with { type: 'json' }
import { jcStudyQuestions, buildJcMissionAreas } from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../src/lib/ncs2026.js'
import { recruitWrittenQuestions } from '../src/lib/recruitWritten.js'
import { INTERVIEW_QUESTIONS } from '../src/lib/guidedSubjectContent.js'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../src/lib/coverAssessmentBank.js'

const blocked = new Set(Object.keys(manifest.quarantined || {}))
const normalized = new Set(manifest.normalizeToSingle || [])
const augmented = new Set(manifest.augmentDistractors || [])
const pools = {
  'job-common': jcStudyQuestions(),
  'ncs-basic': ncs2026Questions,
  'recruit-written': recruitWrittenQuestions,
  interview: INTERVIEW_QUESTIONS,
  'cover-letter': COVER_DIAGNOSTIC_QUESTIONS,
}

const failures = []
for (const [name, pool] of Object.entries(pools)) {
  const reachable = pool.filter(question => !question.excludeFromQuiz)
  if (reachable.length === 0) failures.push(`${name}: 출제 가능한 문항이 0개입니다`)
  for (const question of reachable) {
    if (blocked.has(question.id) || blocked.has(question.sourceQuestionId)) {
      failures.push(`${name}/${question.id}: 격리 문항이 출제 풀에 남았습니다`)
    }
    if (normalized.has(question.id) && question.questionMode !== 'mcq') {
      failures.push(`${name}/${question.id}: 단일 정답 문항 모드가 ${question.questionMode}입니다`)
    }
    if ((augmented.has(question.id) || augmented.has(question.sourceQuestionId)) && !question.distractorTypes?.length) {
      failures.push(`${name}/${question.id}: 오답 분석 보강이 출제 문항에 적용되지 않았습니다`)
    }
  }
  console.log(`[integrity] ${name}: total=${pool.length}, reachable=${reachable.length}, quarantined=${pool.length - reachable.length}`)
}

const jcById = new Map(pools['job-common'].map(question => [question.id, question]))
for (const area of buildJcMissionAreas()) {
  for (const lesson of area.lessons) {
    if (!lesson.questionIds.length) failures.push(`job-common/${lesson.id}: 미션 문항이 없습니다`)
    for (const id of lesson.questionIds) {
      const question = jcById.get(id)
      if (!question) failures.push(`job-common/${lesson.id}: 미션 ID ${id}가 학습 풀에 없습니다`)
      if (question?.type === 'matching' || question?.type === 'text') failures.push(`job-common/${id}: 미지원 문항 유형이 일반 미션에 포함됐습니다`)
    }
  }
}

if (normalized.size !== 35) failures.push(`단일 정답 모드 교정 목록이 35건이 아닙니다: ${normalized.size}`)
if (blocked.size + augmented.size < 778) failures.push(`검증팀 보완 대상보다 조치 목록이 작습니다: ${blocked.size + augmented.size}`)

if (failures.length) {
  console.error(failures.slice(0, 100).join('\n'))
  process.exit(1)
}
console.log(`[integrity] PASS: blocked=${blocked.size}, augmented=${augmented.size}, normalized=${normalized.size}`)
