// multi 문항의 앱 원본 answer 필드가 실제로 비어 있는지 확인한다. 수정은 하지 않는다.
import { readFileSync } from 'node:fs'
const IDS = ['JC-TEC-MC001','JC-ORG-MC001','JC-PSV-MC003','JC-RSM-MC002','JC-INF-MC001','NCS-INFO-025']
const files = ['data/questions.json','data/job-variants.json','data/ncs-questions.json','data/ncs-variants.json',
  'data/block-inline-job-common.json','data/general-knowledge-questions.json','data/blueprint-fill.json']
const want = new Set(IDS); const seen = new Map()
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk)
  if (o && typeof o === 'object') {
    if (typeof o.id === 'string' && want.has(o.id) && !seen.has(o.id)) {
      seen.set(o.id, { type: o.type ?? null, answerType: typeof o.answer,
        answer: o.answer, answers: o.answers ?? null, correct: o.correct ?? null,
        choiceCount: Array.isArray(o.choices) ? o.choices.length : (o.choices ? 'object' : null),
        keys: Object.keys(o).join(',') })
    }
    Object.values(o).forEach(walk)
  }
}
for (const f of files) { try { walk(JSON.parse(readFileSync(f, 'utf8'))) } catch {} }
for (const [id, v] of seen) console.log(id, '\n  ', JSON.stringify(v).slice(0, 400), '\n')
console.log('찾지 못한 id:', IDS.filter(i => !seen.has(i)).join(', ') || '없음')
