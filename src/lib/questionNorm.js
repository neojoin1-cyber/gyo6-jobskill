// 문항 정답·유형 정규화 — 뱅크 포맷 불문 일관 처리 (OX 오채점·무보기 문항 실사고, 2026-07-10)
// 정답 표기 지원: 'A'~'E' · '①'~'⑤' · '1'~'5' · 숫자 인덱스 · O/X(○×)
// 원칙(§0-7): 화면별 개별 파싱 금지 — 모든 채점·표시는 이 모듈을 통해서만.

export function isOXAnswer(a) { return /^[OX○×ox]$/.test(String(a ?? '').trim()) }

export function isOXQuestion(q) {
  if (!q) return false
  if (q.questionMode === 'ox' || q.type === 'ox' || q.practiceType === 'ox') return true
  const ch = q.choices
  if (Array.isArray(ch) && ch.length === 2 &&
      /^[O○o]$/.test(String(ch[0]).trim()) && /^[X×x]$/.test(String(ch[1]).trim())) return true
  return !(ch && ch.length) && isOXAnswer(q.answer)
}

// 문항의 정답 인덱스(선택지 기준 0-base). OX는 O=0, X=1 (렌더 순서 [O, X] 기준).
export function answerIdxOf(q) {
  if (!q) return -1
  const a = q.answer
  if (typeof a === 'number' && isFinite(a)) return a
  const s = String(a ?? '').trim()
  if (!s) return -1
  if (isOXQuestion(q)) {
    if (/^[O○o]/.test(s) || s === 'A') return 0
    if (/^[X×x]/.test(s) || s === 'B') return 1
  }
  if (/^[A-Ea-e]$/.test(s)) return s.toUpperCase().charCodeAt(0) - 65
  const ci = '①②③④⑤'.indexOf(s)
  if (ci >= 0) return ci
  if (/^[1-5]$/.test(s)) return parseInt(s, 10) - 1
  return -1
}

// 보기(choices)가 없는 선다형: 문두 안의 ①②③… 나열에서 보기를 분리 추출
// (NCS 61문항 실사고 — 보기가 stem 텍스트에 붙어 있어 고를 버튼이 없던 문제)
export function withExtractedChoices(q) {
  if (!q || (q.choices && q.choices.length) || isOXQuestion(q)) return q
  const key = q.question != null ? 'question' : (q.stem != null ? 'stem' : null)
  if (!key) return q
  const s = String(q[key])
  const parts = s.split(/\s*(?=[①②③④⑤])/)
  if (parts.length >= 3) {
    const choices = parts.slice(1).map(p => p.replace(/^[①②③④⑤]\s*/, '').trim()).filter(Boolean)
    if (choices.length >= 2 && parts[0].trim().length >= 5) return { ...q, [key]: parts[0].trim(), choices }
  }
  return q
}

// 복수선택형(정답이 배열) — 미션·자율학습 공용
export function isMultiQuestion(q) {
  return !!q && (q.type === 'multi' || Array.isArray(q.answer))
}

// 복수선택 정답 인덱스 집합 (A~E 문자 배열 기준)
export function answerSetOf(q) {
  const arr = Array.isArray(q?.answer) ? q.answer : (q?.answer != null ? [q.answer] : [])
  const out = new Set()
  for (const a of arr) {
    const s2 = String(a).trim()
    if (/^[A-Ea-e]$/.test(s2)) out.add(s2.toUpperCase().charCodeAt(0) - 65)
    else if (/^[1-5]$/.test(s2)) out.add(parseInt(s2, 10) - 1)
    else { const ci = '①②③④⑤'.indexOf(s2); if (ci >= 0) out.add(ci) }
  }
  return out
}

// 배열 응답과 정답 집합의 완전 일치 채점
export function gradeMulti(q, selArr) {
  const ans = answerSetOf(q)
  const sel = new Set(Array.isArray(selArr) ? selArr : [])
  return ans.size > 0 && ans.size === sel.size && [...ans].every(x => sel.has(x))
}
