// 문항의 **요구 수준**을 공식 등급기술에 맞춰 매긴다.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────────
// 기존 `level`(기초/표준/심화)은 실측하니 난이도와 무관했다.
//   심화 212문항 중 150개(71%)가 최저 인지수준인 '정보 확인'
//   기초 242문항 중 184개(76%)도 똑같이 '정보 확인'
// 두 등급의 인지 프로필이 사실상 같다. 게다가 직업공통 226문항은 level 이
// 아예 없고, '진단'·'종합' 같은 차시 구분값이 문항 등급에 섞여 있었다.
// 이 상태로는 "약한 수준부터 채우기" 같은 학습 설계가 불가능하다.
//
// ── 무엇을 기준으로 하나 ────────────────────────────────────────────────
// 교육부·대한상의가 공개한 인증 등급기술의 양 끝을 앵커로 쓴다.
//   5등급: "간단한 연산 적용, 표·도표 정보를 찾고 읽기"
//   1등급: "통계를 계산·해석해 합리적 의사결정, 자료를 근거로 추론,
//           자료를 종합 파악해 적합한 결과 도출"
// 즉 공식 기준이 나누는 축은 **찾기·읽기 → 적용 → 종합·추론**이다.
//
// 공개된 등급기술은 1등급과 5등급 둘뿐이다. 2·3·4등급 기술은 공개돼 있지
// 않으므로 5단계로 나누면 없는 근거를 지어내는 것이 된다. 그래서 3단계다.
//
// ── 한계를 분명히 해 둔다 ───────────────────────────────────────────────
// 이것은 **실측 난이도가 아니다.** 실제 난이도는 학생 응답의 정답률로만
// 정해지는데 아직 응답 데이터가 없다. 여기서 매기는 것은 문항이 요구하는
// 인지 작업의 종류이며, 응답이 쌓이면 정답률로 보정해야 한다.
// 그래서 이름을 '난이도'가 아니라 `demandLevel`(요구 수준)로 둔다.

export const DEMAND_LEVELS = {
  확인: { id: '확인', order: 1, label: '정보 확인', anchor: '5등급 수준',
    desc: '제시된 자료에서 필요한 정보를 찾아 읽거나 단순 연산을 적용합니다.' },
  적용: { id: '적용', order: 2, label: '직무 적용', anchor: '3등급 안팎',
    desc: '알고 있는 절차·규정을 실제 업무 상황에 맞게 적용합니다.' },
  종합: { id: '종합', order: 3, label: '종합·추론', anchor: '1등급 수준',
    desc: '여러 정보를 견주어 근거를 세우고 최적의 판단을 이끌어 냅니다.' },
}

export const DEMAND_ORDER = ['확인', '적용', '종합']

// 1등급 기술의 핵심 동사 — 여러 정보를 견주고 근거를 세우는 작업.
const SYNTHESIS = /추론|종합|분석|비교|판단|평가|타당|근거|최적|우선순위|원인|영향|왜|이유|성찰|검증|개선|대안|전략/
// 5등급과 1등급 사이 — 아는 절차를 상황에 옮기는 작업.
const APPLICATION = /계산|적용|작성|대응|조치|실행|절차|방법|처리|수행|해야 할|어떻게/
// 5등급 기술의 핵심 동사 — 찾아 읽기.
const RETRIEVAL = /무엇|뜻|의미|고르|찾|해당하는|알맞은 것은|옳은 것은/
// 부정 발문은 보기 전체를 검토해야 하므로 요구 수준을 한 칸 올린다.
const NEGATIVE = /옳지 않은|알맞지 않은|아닌 것|거리가 먼|적절하지 않은|틀린 것/

const textOf = q => `${q.stem || q.question || ''} ${q.context || ''}`

function choiceValues(choices) {
  if (Array.isArray(choices)) return choices
  if (choices && typeof choices === 'object') return Object.values(choices)
  return []
}

/** 점수와 근거를 함께 돌려준다 — 왜 그 등급인지 되짚을 수 있어야 검수가 된다. */
export function scoreDemand(q) {
  const text = textOf(q)
  const ctx = (q.context || '').trim()
  const choices = choiceValues(q.choices).map(String)
  const reasons = []
  let score = 0

  // 표·그래프 문항은 자료가 context 가 아니라 visual 에 들어 있다.
  // 이걸 빼먹어 표 데이터로 2단계 계산을 요구하는 문항 11개가 '확인'으로
  // 잘못 분류됐다(자료 글자수만 보면 50자짜리 짧은 배경 설명만 보인다).
  const v = q.visual
  const cells = v?.type === 'table'
    ? (v.rows?.length || 0) * (v.columns?.length || 0)
    : v?.type === 'bar' ? (v.items?.length || 0) * 2 : 0

  if (ctx || cells) { score += 1; reasons.push(cells ? '표·그래프 자료 제시형' : '자료 제시형') }
  if (ctx.length >= 120) { score += 1; reasons.push('자료가 길어 선별이 필요') }
  // 칸이 많을수록 한 값만 읽고 끝나지 않는다(3행 4열이면 견줄 대상이 여럿).
  if (cells >= 9) { score += 1; reasons.push('표의 값이 많아 비교가 필요') }
  if (SYNTHESIS.test(text)) { score += 2; reasons.push('종합·추론 발문') }
  else if (APPLICATION.test(text)) { score += 1; reasons.push('절차 적용 발문') }
  else if (RETRIEVAL.test(text)) { reasons.push('정보 확인 발문') }
  if (NEGATIVE.test(text)) { score += 1; reasons.push('부정 발문 — 보기 전수 검토') }

  const avgChoice = choices.length
    ? choices.reduce((s, c) => s + c.length, 0) / choices.length : 0
  if (avgChoice >= 30) { score += 1; reasons.push('보기가 길어 대안 비교가 필요') }

  // 수치가 여럿이면 한 번 읽고 끝나지 않는다(5등급의 '간단한 연산'을 넘어섬).
  // 표 안의 숫자도 세어야 한다. 텍스트만 보면 표 문항의 수치가 0으로 잡힌다.
  const tableNums = v?.type === 'table'
    ? (v.rows || []).flat().filter(c => typeof c === 'number' || /^\d[\d,.]*$/.test(String(c))).length
    : v?.type === 'bar' ? (v.items || []).length : 0
  const numbers = (text.match(/\d[\d,.]*/g) || []).length + tableNums
  if (numbers >= 3) { score += 1; reasons.push('수치 다수 — 다단계 계산') }

  // 복수정답은 보기를 각각 판정해야 한다.
  if (Array.isArray(q.answer) && q.answer.length > 1) { score += 1; reasons.push('복수정답') }

  // 아무 분기에도 안 걸리면 근거가 비어 검수가 불가능해진다.
  // '단서가 없다'는 것 자체가 5등급 앵커(단일 정보 찾기)에 해당한다는 근거다.
  if (!reasons.length) reasons.push('자료·조건·비교 요소 없이 단일 정보만 묻는 발문')

  const level = score <= 1 ? '확인' : score <= 3 ? '적용' : '종합'
  return { level, score, reasons }
}

export function demandLevel(q) {
  return scoreDemand(q).level
}

/** 문항에 요구 수준을 붙인다. 기존 `level`(차시 배지용)은 건드리지 않는다. */
export function attachDemand(q) {
  const { level, score, reasons } = scoreDemand(q)
  return {
    ...q,
    demandLevel: level,
    demandBasis: {
      score,
      reasons,
      anchor: DEMAND_LEVELS[level].anchor,
      source: 'teenup-2026-grade-descriptor-anchors',
      note: '응답 데이터 기반 실측 난이도가 아니라 문항이 요구하는 인지 작업 수준',
    },
  }
}
