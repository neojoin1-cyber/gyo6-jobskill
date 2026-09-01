// 제외된 68문항의 "구조"만 본다. 값은 출력하지 않는다(독립성 보존).
import { readFileSync } from 'node:fs'
const un = JSON.parse(readFileSync('verification/adversarial-4.8.13/private/CNT_unusable.json','utf8'))
const ids = new Set(un.unusable.map(u => u.id))
const files = ['data/questions.json','data/jc-synthesis-korean.json','data/jc-synthesis-math.json',
  'data/jc-synthesis-problem.json','data/jc-media-visual.json','data/jc-media-listening.json',
  'data/jc-job-adapt-study.json','data/jc-english-bank.json','data/jc-english-supplement.json',
  'data/block-inline-job-common.json','data/blueprint-fill.json','data/ncs-questions.json',
  'data/ncs-variants.json','data/job-variants.json','data/general-knowledge-questions.json']
const shapes = new Map(); let found = 0
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk)
  if (o && typeof o === 'object') {
    if (typeof o.id === 'string' && ids.has(o.id)) {
      found++
      const sig = Object.keys(o).sort().join(',')
      const detail = {}
      for (const [k,v] of Object.entries(o)) {
        detail[k] = Array.isArray(v)
          ? `array[${v.length}]` + (v[0] && typeof v[0]==='object' ? `{${Object.keys(v[0]).join('|')}}` : `<${typeof v[0]}>`)
          : typeof v
      }
      if (!shapes.has(sig)) shapes.set(sig, { n:0, detail, sample:o.id })
      shapes.get(sig).n++
    }
    Object.values(o).forEach(walk)
  }
}
for (const f of files) { try { walk(JSON.parse(readFileSync(f,'utf8'))) } catch {} }
console.log('찾은 문항:', found, '/ 68')
for (const [,v] of shapes) console.log(v.n, '건 · 예시 id', v.sample, '\n   ', JSON.stringify(v.detail))
