import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const studentShell = readFileSync(new URL('../src/screens/student/StudentShell.jsx', import.meta.url), 'utf8')
const presence = readFileSync(new URL('../src/lib/presence.js', import.meta.url), 'utf8')

assert.match(studentShell, /classCheckRef\.current\?\.\(\)/, '학습관 진입·이동 시 수업 상태를 다시 확인해야 함')
assert.match(studentShell, /tab !== 'study'/, '수업 상태 추가 확인은 학습관에서만 수행해야 함')
assert.match(studentShell, /lastClassCheckAtRef\.current < 10_000/, '연속 학습 이동의 수업 조회를 제한해야 함')
assert.match(studentShell, /meta\?\.sessionClosed/, '종료된 수업 띠를 학생 화면에서 제거해야 함')
assert.match(presence, /onFocus\?\.\(null, \{ sessionClosed: true \}\)/, '서버가 수업 종료를 알리면 화면까지 전달해야 함')

console.log('[학습연결] 통과 — 학습 위치·수업 재확인·종료 감지를 모두 안전하게 처리')
