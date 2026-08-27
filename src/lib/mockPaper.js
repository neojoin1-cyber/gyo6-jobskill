/**
 * 모의고사 시험지 생성기 (결정적·근거 중요도가중·영역 stratified·변형 출제).
 * 같은 (scope, paperNo)는 항상 같은 시험지를 만든다 → DB에 문항 ID를 저장할 필요 없음.
 *
 *  - 전체 학습내용을 모두 수용: 영역(area)별 라운드로빈으로 고르게 출제
 *  - 근거 중요도 가중: 최신·빈출·기출·중요 근거가 있는 주제를 우선 반영
 *  - 랜덤이되 시험지별 고정: scope+paperNo로 시드 → 회차마다 다른 조합, 매번 동일 재현
 *  - 변형 출제: 검증된 변형뱅크가 있으면 (scope,paperNo,id) 시드로 변형을 결정적 선택
 *    → 같은 개념을 회차마다 다른 표현·선지로 묻어 "새 문제처럼" 반복 학습(정답·개념 동일)
 */

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// 가중 결정적 정렬: weight가 클수록 앞으로(작은 키). 동일 가중 내 순서는 시드로 섞임.
function weightedOrder(arr, weight, rnd) {
  return arr
    .map(q => ({ q, k: -Math.log(rnd() + 1e-9) / Math.max(0.0001, weight(q)) }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.q)
}

// 변형 선택: (scope,paperNo,baseId) 시드로 결정적. 0이면 원본, 그 외 변형[n-1]을 덮어씀.
// id는 원본 유지(채점·오답노트가 '개념' 기준으로 매핑되도록). keyTerms 등은 원본 유지.
function applyVariant(q, variants, scope, paperNo) {
  if (!variants || !variants.length) return q
  const pickN = hashStr(`var|${scope}|${paperNo}|${q.id}`) % (variants.length + 1)
  if (pickN === 0) return q
  const v = variants[pickN - 1]
  if (!v || !v.stem) return q
  return {
    ...q,
    stem:         v.stem ?? q.stem,
    context:      v.context ?? q.context,
    choices:      v.choices ?? q.choices,
    answer:       v.answer ?? q.answer,
    explanation:  v.explanation ?? q.explanation,
    questionMode: v.questionMode ?? q.questionMode,
    _baseId:      q.id,
    _variant:     pickN,
  }
}

/**
 * @param {object[]} pool      과목 전체 문항(이미 과목 필터됨)
 * @param {string}   scope     '__all__' 또는 특정 영역 키
 * @param {number}   paperNo   회차(1~)
 * @param {object}   opts      { count=30, areaKey(q)->string, weight(q)->number, variantMap:{id:[변형]} }
 * @returns {object[]} 선택된 문항(시험지) — 변형뱅크가 있으면 변형 반영
 */
export function buildMockPaper(pool, scope, paperNo, opts = {}) {
  const count      = opts.count || 30
  const areaKey    = opts.areaKey || (q => q.area || q.lessonId || '기타')
  const weight     = opts.weight  || (() => 1)
  const variantMap = opts.variantMap || null

  let qs = (pool || []).filter(q => q && q.id && !q.excludeFromQuiz)
  if (scope && scope !== '__all__') qs = qs.filter(q => areaKey(q) === scope)
  if (qs.length === 0) return []

  const rnd = mulberry32(hashStr(`${scope}|${paperNo}`))

  let ordered
  if (qs.length <= count) {
    ordered = weightedOrder(qs, weight, rnd)
  } else {
    // 영역별 그룹 → 각 그룹 내부를 근거 중요도가중 결정적 정렬
    const groups = {}
    for (const q of qs) { const a = areaKey(q); (groups[a] ||= []).push(q) }
    const areaList = Object.keys(groups).sort()
    for (const a of areaList) groups[a] = weightedOrder(groups[a], weight, rnd)

    // 라운드로빈으로 영역을 고르게 채움(전체 내용 수용)
    const picked = []
    const idx = Object.fromEntries(areaList.map(a => [a, 0]))
    let guard = 0
    while (picked.length < count && guard < count * areaList.length + areaList.length) {
      let progressed = false
      for (const a of areaList) {
        if (picked.length >= count) break
        const g = groups[a]
        if (idx[a] < g.length) { picked.push(g[idx[a]++]); progressed = true }
      }
      guard++
      if (!progressed) break
    }
    // 시험지 내 문제 순서도 시드로 섞음(영역이 뭉치지 않게)
    ordered = weightedOrder(picked, () => 1, mulberry32(hashStr(`order|${scope}|${paperNo}`)))
  }

  // 변형 적용(있을 때만). 회차마다 다른 변형이 결정적으로 선택돼 반복이 신선해진다.
  if (variantMap) ordered = ordered.map(q => applyVariant(q, variantMap[q.id], scope, paperNo))
  return ordered
}

// 회차 수: 전체=10, 영역별=5
export const MOCK_PAPERS = { all: 10, area: 5 }
export const MOCK_COUNT = 30
