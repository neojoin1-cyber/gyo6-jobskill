import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const handoff = path.join(root, 'verification', 'adversarial-4.8.13', 'handoff')
const audit = JSON.parse(fs.readFileSync(path.join(handoff, 'CNT_explanation_audit_result.json'), 'utf8')).results
const structural = JSON.parse(fs.readFileSync(path.join(handoff, 'CNT_structural_defects.json'), 'utf8'))
const fixedMulti = JSON.parse(fs.readFileSync(path.join(root, 'verification', 'adversarial-4.8.13', 'private', 'CNT_multi_answers_fixed.json'), 'utf8'))

const quarantined = new Map()
const augmentDistractors = new Set()
for (const result of audit) {
  const flags = (result.expFlags || []).filter(flag => flag !== 'single_answer_multi')
  const actionable = flags.filter(flag => flag !== 'no_distractor_analysis')
  if (result.verdict === '일치' && actionable.length === 0) {
    if (flags.includes('no_distractor_analysis')) augmentDistractors.add(result.questionId)
    continue
  }
  quarantined.set(result.questionId, {
    verdict: result.verdict,
    flags,
    reason: result.fixNeeded || result.rationale || '독립 검증 재확인 필요',
  })
}

for (const [category, ids] of Object.entries(structural)) {
  for (const id of ids) {
    const existing = quarantined.get(id) || { verdict: '구조결함', flags: [], reason: category }
    const flags = new Set(existing.flags)
    flags.add(`structural:${category}`)
    quarantined.set(id, { ...existing, flags: [...flags] })
  }
}

const normalizeToSingle = Object.entries(fixedMulti)
  .filter(([, detail]) => Number(detail.size) === 1)
  .map(([id]) => id)
  .sort()

const output = {
  generatedFrom: 'verification/adversarial-4.8.13',
  policy: '정답·해설·구조 결함은 격리하고, 유일한 결함이 오답 분석 부족인 문항은 런타임에서 보기별 피드백을 보강',
  auditedAt: '2026-09-01T15:43:43.882087+00:00',
  quarantined: Object.fromEntries([...quarantined.entries()].sort(([a], [b]) => a.localeCompare(b))),
  augmentDistractors: [...augmentDistractors].sort(),
  normalizeToSingle,
}

fs.writeFileSync(path.join(root, 'data', 'question-integrity-quarantine.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(`question integrity manifest: quarantined=${quarantined.size}, augmented=${augmentDistractors.size}, normalized=${normalizeToSingle.length}`)
