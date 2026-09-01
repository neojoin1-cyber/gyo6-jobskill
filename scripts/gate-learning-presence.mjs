import assert from 'node:assert/strict'
import { normalizeLearningPresenceContext } from '../src/lib/learningPresenceContext.js'

const empty = {
  subject: null,
  mode: null,
  area: null,
  lesson: null,
  label: '학습관 탐색',
}

for (const value of [undefined, null, false, '', 0, [], {}]) {
  assert.deepEqual(
    normalizeLearningPresenceContext(value),
    empty,
    `최초 메뉴 진입의 불완전 위치값을 처리하지 못함: ${String(value)}`,
  )
}

assert.deepEqual(
  normalizeLearningPresenceContext({
    subject: 'job-common',
    mode: 'study',
    areaId: 'communication',
    lessonId: 'lesson-1',
    subjectLabel: '직업공통능력',
    areaLabel: '의사소통 국어',
  }),
  {
    subject: 'job-common',
    mode: 'study',
    area: 'communication',
    lesson: 'lesson-1',
    label: '직업공통능력 · 의사소통 국어',
  },
)

console.log('[학습연결] 통과 — 최초 메뉴 진입 null과 정상 학습 위치를 모두 안전하게 처리')
