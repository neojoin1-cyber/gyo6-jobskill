// 전 과목 문항 통합 인덱스 (id → 표준 문항). 우선 복습·오답 재풀이에서 문항 객체 복원용.
import jobQuestions   from '../../data/questions.json'
import { ncs2026Questions as ncsQuestions } from './ncs2026.js'
import ncsExtracted   from '../../data/ncs-extracted-bank.json'
import englishBank    from '../../data/jc-english-bank.json'
import foodServiceBank from './foodServiceBank.js'
import qualityPractice from '../../data/quality-mgmt-practice.json'
import { jobCommonMediaQuestions } from './jobCommonAreas.js'

const qualityQs = qualityPractice.units.flatMap(u => [
  ...(u.questions || []),
  ...((u.sections || []).flatMap(s => s.questions || [])),
])

// 품질 {value,text} choices·value answer → 표준(문자열 배열 + 'A'~ letter)
function normalize(q) {
  if (!q) return null
  let choices = q.choices || []
  let answer = q.answer
  if (choices.length && typeof choices[0] === 'object') {
    const vals = choices.map(c => c.value)
    choices = choices.map(c => c.text ?? String(c))
    if (answer != null && vals.includes(answer)) answer = String.fromCharCode(65 + vals.indexOf(answer))
  }
  return {
    id: q.id, stem: q.stem ?? q.heading ?? '', context: q.context ?? null,
    choices, answer, explanation: q.explanation ?? '', examPriority: q.examPriority,
    lessonId: q.lessonId, area: q.area,
  }
}

// 발문이 질문 구실을 하는가.
// `ncs-extracted-bank.json` 은 원본 교재에서 기계로 뽑아낸 미검수 은행이라
// 1,329문항 중 727개가 발문 자리에 지문 조각이나 문서 제목("□ 상담 처리 현황")을
// 달고 있다. 퀴즈 경로에는 나가지 않지만 이 인덱스는 복습·오답 재풀이에서
// id 로 문항을 되살리므로, 걸러 두지 않으면 예전 학습 기록을 통해
// "무엇을 묻는지 알 수 없는 문항"이 복습 화면에 뜬다.
const HAS_QUESTION = /[?？]|것은|것을|무엇|어느|고르|하는가|인가|알맞은|적절한|옳은|옳지|쓰시오|하시오|골라|구하면|얼마|몇|바르게|틀린|까요|나요|_{2,}|\(\s*\)/

function isRenderable(q) {
  const stem = q?.stem ?? q?.heading ?? ''
  if (!stem) return false
  // 보기가 2개 미만이면 O/X·단답형이라 진술문 발문이 정상이다.
  if ((q.choices?.length ?? 0) < 2) return true
  return HAS_QUESTION.test(stem)
}

const IDX = {}
for (const q of [
  ...jobQuestions, ...ncsQuestions, ...(ncsExtracted.questions || []),
  ...(englishBank.questions || []), ...jobCommonMediaQuestions, ...foodServiceBank, ...qualityQs,
]) {
  if (q?.id && !IDX[q.id] && isRenderable(q)) IDX[q.id] = q
}

export function findQuestion(id) { return normalize(IDX[id]) }
export function priorityWeight(examPriority) {
  return examPriority === 'high' ? 3 : examPriority === 'medium' ? 2 : 1
}
