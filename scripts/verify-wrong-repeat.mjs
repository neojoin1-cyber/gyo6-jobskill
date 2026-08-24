import assert from 'node:assert/strict'
import { buildWrongAttemptCounts, countRepeatedQuestions } from '../src/lib/wrongRepeat.js'

const persisted = buildWrongAttemptCounts([
  { qId: 'A', source: 'self', wrongCount: 2 },
  { qId: 'A', source: 'mission' },
  { qId: 'B', source: 'self', wrongCount: 1 },
])
assert.deepEqual(persisted, { A: 2, B: 1 }, '서버 누적 횟수를 제출 목록과 중복 합산하면 안 됨')
assert.equal(countRepeatedQuestions(persisted), 1)

const legacy = buildWrongAttemptCounts([
  { qId: 'C', source: 'mission' },
  { qId: 'C', source: 'mission' },
  { qId: 'D', source: 'mission' },
])
assert.deepEqual(legacy, { C: 2, D: 1 }, '서버 행이 없는 옛 미션은 제출 횟수로 보완해야 함')
assert.equal(countRepeatedQuestions(legacy), 1)

console.log('Repeated wrong-answer checks: 5/5 passed')
