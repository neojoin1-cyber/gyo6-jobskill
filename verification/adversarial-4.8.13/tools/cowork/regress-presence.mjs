// 수정 전 publicContext 와 수정 후 normalizeLearningPresenceContext 의 출력이
// 정상 입력에서 동일한지, 비정상 입력에서 어떻게 갈리는지 비교한다. 앱은 수정하지 않는다.
import { normalizeLearningPresenceContext as NEW } from '../../../../src/lib/learningPresenceContext.js'

// b7c1b26 이전 원본 (git show 로 확인한 그대로)
function OLD(value = {}) {
  const label = [value.subjectLabel, value.modeLabel, value.areaLabel, value.lessonLabel].filter(Boolean).join(' · ')
  return {
    subject: value.subject || null,
    mode: value.mode || null,
    area: value.area || value.areaId || null,
    lesson: value.lesson || value.lessonId || null,
    label: label || '학습관 탐색',
  }
}

const cases = [
  ['정상 전체', { subject:'job-common', subjectLabel:'직업공통', mode:'study', modeLabel:'학습', area:'com', areaLabel:'의사소통', lesson:'L1', lessonLabel:'1차시' }],
  ['areaId 폴백', { subject:'ncs', areaId:'A1', lessonId:'L9' }],
  ['라벨만', { subjectLabel:'직업공통', modeLabel:'학습' }],
  ['빈 객체', {}],
  ['undefined', undefined],
  ['null', null],
  ['배열', []],
  ['문자열', 'study'],
  ['숫자', 0],
  ['빈 문자열 값', { subject:'', area:'', lesson:'' }],
]
let same = 0, diff = 0, oldThrew = 0
for (const [name, input] of cases) {
  let o, oErr = null
  try { o = OLD(input) } catch (e) { oErr = e.constructor.name; oldThrew++ }
  const n = NEW(input)
  const equal = oErr === null && JSON.stringify(o) === JSON.stringify(n)
  if (equal) same++; else diff++
  console.log(`${equal ? '동일' : '차이'}  ${name}`)
  if (!equal) {
    console.log(`      이전: ${oErr ? `예외 ${oErr}` : JSON.stringify(o)}`)
    console.log(`      이후: ${JSON.stringify(n)}`)
  }
}
console.log(`\n동일 ${same} · 차이 ${diff} · 이전 코드가 예외를 던진 입력 ${oldThrew}건`)
