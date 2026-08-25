/**
 * personalityTest.js — 인성검사 모의 채점·분석 엔진 (정답 없음)
 * 6요인 프로필 + 신뢰도 3척도(일관성·사회적바람직성 L·비전형성) + 요인별/종합 조언.
 * 근거: 실제 채용 인성검사(KHAI/KPDI형)의 신뢰도 척도 구조 — 응답 신뢰도를 먼저 판정.
 */
import bank from '../../data/personality-test-bank.json'

export const SCALE = bank.meta.scale                 // {min,max,labels[5]}
export const DIMENSIONS = bank.dimensions            // [{key,name,short,high,low,job,advice*}]
const DIM_BY = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]))
const ITEMS = bank.items

const traitItems = ITEMS.filter(i => i.kind === 'trait')
const lieItems   = ITEMS.filter(i => i.kind === 'lie')
const infItems   = ITEMS.filter(i => i.kind === 'infrequency')

// 시드 셔플(결정적) — Date.random 미사용 환경 대비 시드 기반
function seeded(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
function shuffle(arr, seed) {
  const a = [...arr], rnd = seeded(seed)
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// 모드별 회차 수: 진단(간이)은 문항이 적어 서로 겹치지 않게 더 많은 회차 제공.
export const PAPER_COUNTS = { quick: 20, full: 10 }
export function paperCount(mode) { return PAPER_COUNTS[mode] || PAPER_COUNTS.full }
export const PAPER_COUNT = 10   // (구) 기본값 — 하위호환

// 요인별 정·역 쌍 목록(일관성 채점 유지를 위해 쌍 단위로 표본추출)
const pairsByDim = {}
const singlesByDim = {}
for (const d of DIMENSIONS) { pairsByDim[d.key] = []; singlesByDim[d.key] = [] }
{
  const seen = new Set()
  for (const i of traitItems) {
    if (seen.has(i.id)) continue
    if (i.pair && ITEMS.find(x => x.id === i.pair)) {
      const j = ITEMS.find(x => x.id === i.pair)
      pairsByDim[i.dim].push([i, j]); seen.add(i.id); seen.add(j.id)
    } else { singlesByDim[i.dim].push(i); seen.add(i.id) }
  }
}

// 회차당 목표 문항 수 (1030문항 풀 기준)
const SPEC = {
  quick: { size: 48,  seed: 4000 },   // 간이 진단
  full:  { size: 190, seed: 9000 },   // 실전 모의 (초대형 ≈ 190문항, 약 50~60분)
}

// 성향 단위(일관성 쌍 [f,r] + 단독) / 신뢰도 척도 단위(L·비전형 단독)
const TRAIT_UNITS = []
for (const d of DIMENSIONS) {
  for (const p of pairsByDim[d.key]) TRAIT_UNITS.push(p)
  for (const s of singlesByDim[d.key]) TRAIT_UNITS.push([s])
}
const VAL_UNITS = [...lieItems, ...infItems].map(i => [i])

/**
 * 균형 딜(balanced deal): 각 문항(단위)을 '회차 쌍'에 균등 배분해, 어떤 두 회차를 골라도
 * 겹치는 문항 수가 거의 같도록(균일) 만든다 → 전 회차 조합 중복률 최소·균일.
 * - 성향 쌍은 [f,r] 단위로 함께 배치(일관성 척도 유지).
 * - totalSlots ≤ 단위수: 각 단위 1회만 사용 → 회차들이 서로 겹치지 않음(진단이 여기).
 * - 단위수 < totalSlots ≤ 2×단위수: 일부 1회 + 일부 2회(회차 쌍에 균등) → 균일한 최소 중복(실전 모의).
 */
function assignBalanced(rounds, units, unitsPerRound, seed, nRounds) {
  const su = shuffle(units, seed)
  const P = su.length
  const totalSlots = nRounds * unitsPerRound
  if (totalSlots <= P) {
    for (let i = 0; i < totalSlots; i++) rounds[i % nRounds].push(...su[i])
    return
  }
  const roundPairs = []
  for (let a = 0; a < nRounds; a++) for (let b = a + 1; b < nRounds; b++) roundPairs.push([a, b])
  const twice = Math.min(totalSlots - P, P)   // 2회 사용 단위 수
  const once = P - twice                        // 1회 사용 단위 수
  let idx = 0
  for (let i = 0; i < once; i++) { rounds[i % nRounds].push(...su[idx]); idx++ }
  const pairOrder = shuffle(roundPairs, seed + 71)
  for (let j = 0; j < twice && idx < P; j++) {
    const [a, b] = pairOrder[j % pairOrder.length]
    rounds[a].push(...su[idx]); rounds[b].push(...su[idx]); idx++
  }
}

const _dealCache = {}
function dealRounds(mode) {
  if (_dealCache[mode]) return _dealCache[mode]
  const { size, seed } = SPEC[mode] || SPEC.full
  const nRounds = paperCount(mode)
  const rounds = Array.from({ length: nRounds }, () => [])
  const valPerRound = Math.max(4, Math.round(size * 0.065))   // 190→~12, 48→~4
  const traitPerRound = size - valPerRound
  const unitsPerRound = Math.max(1, Math.round(traitPerRound / 2))   // 대부분 크기2(쌍)
  assignBalanced(rounds, TRAIT_UNITS, unitsPerRound, seed, nRounds)
  // 신뢰도 척도(소수) — 순차 배치로 회차 간 겹침 최소화
  let vseq = [], pass = 0
  while (vseq.length < nRounds * valPerRound + valPerRound) { vseq = vseq.concat(shuffle(VAL_UNITS, seed + 700 + pass * 17)); pass++ }
  let vidx = 0
  for (let r = 0; r < nRounds; r++) for (let k = 0; k < valPerRound; k++) { rounds[r].push(...vseq[vidx % vseq.length]); vidx++ }
  _dealCache[mode] = rounds
  return rounds
}

/**
 * 모의 문항 셋 구성 — 회차(paperNo)마다 다른 문항·순서(결정적).
 * @param {'quick'|'full'} mode  quick=진단(간이 ~48), full=모의(실전 ~190)
 * @param {number} paperNo  1..PAPER_COUNT (회차)
 */
export function buildPersonalityItems(mode = 'full', paperNo = 1) {
  const rounds = dealRounds(mode)
  const n = rounds.length
  const round = rounds[(((paperNo - 1) % n) + n) % n]
  const seed = (SPEC[mode] || SPEC.full).seed + paperNo * 17
  return shuffle(round, seed).map(pub)
}

// 화면 노출용(정답/역채점 힌트 숨김)
function pub(i) { return { id: i.id, text: i.text, dim: i.dim } }

const band = (v) => v >= 66 ? 'high' : v >= 40 ? 'mid' : 'low'
const bandLabel = { high: '높음', mid: '보통', low: '낮음' }

/**
 * 채점·분석.
 * @param {Object} responses  { itemId: 1..5 }
 * @returns 분석 결과 객체
 */
export function scorePersonality(responses) {
  const answered = Object.keys(responses).length
  // ── 요인별 점수 (역문항 역채점, 0~100 정규화) ──
  const profile = DIMENSIONS.map(d => {
    const its = traitItems.filter(i => i.dim === d.key && responses[i.id] != null)
    let sum = 0, cnt = 0
    for (const i of its) { const v = responses[i.id]; sum += i.reverse ? (6 - v) : v; cnt++ }
    const avg = cnt ? sum / cnt : 3
    const score = Math.round(((avg - 1) / 4) * 100)
    const b = band(score)
    const advice = b === 'high' ? d.adviceHigh : b === 'mid' ? d.adviceMid : d.adviceLow
    return { key: d.key, name: d.name, short: d.short, score, band: b, bandLabel: bandLabel[b],
      meaning: b === 'low' ? d.low : d.high, job: d.job, advice }
  })

  // ── 일관성 척도 (정·역 쌍 모순도) ──
  let pairCnt = 0, diffSum = 0
  const seenPair = new Set()
  for (const i of traitItems) {
    if (!i.pair || seenPair.has(i.id)) continue
    const j = ITEMS.find(x => x.id === i.pair)
    if (!j) continue
    seenPair.add(i.id); seenPair.add(j.id)
    const vi = responses[i.id], vj = responses[j.id]
    if (vi == null || vj == null) continue
    // 정문항 vi 와 역문항 vj → 일관되면 vi ≈ (6 - vj)
    const fwd = i.reverse ? vj : vi
    const rev = i.reverse ? vi : vj
    diffSum += Math.abs(fwd - (6 - rev)); pairCnt++
  }
  const avgDiff = pairCnt ? diffSum / pairCnt : 0
  const consistency = Math.round(100 - (avgDiff / 4) * 100)   // 100=완전일관
  const consistencyOk = consistency >= 65

  // ── 사회적바람직성(L척도): 이상화 문항 동의 정도 → 과장 지표(50 기준) ──
  const lie = lieItems.filter(i => responses[i.id] != null)
  const lieAvg = lie.length ? lie.reduce((s, i) => s + responses[i.id], 0) / lie.length : 1
  const social = Math.round(((lieAvg - 1) / 4) * 100)         // 높을수록 과장
  const socialOk = social <= 55

  // ── 비전형성(부주의·무선응답): 기대응답 이탈 수 ──
  let infDeviant = 0, infTotal = 0
  for (const i of infItems) {
    const v = responses[i.id]; if (v == null) continue; infTotal++
    const dev = i.expected === 'agree' ? v <= 2 : v >= 4
    if (dev) infDeviant++
  }
  const infrequencyOk = infDeviant < 2

  // ── 종합 신뢰도 판정 ──
  const flags = []
  if (!consistencyOk) flags.push('비슷한 문항의 응답 기준이 달랐음 · 평소 행동을 기준으로 다시 점검')
  if (!socialOk)      flags.push('이상적인 모습으로 응답한 경향이 나타남 · 실제 행동을 기준으로 다시 점검')
  if (!infrequencyOk) flags.push('일부 문항에서 응답 이탈 확인 · 문항을 끝까지 읽고 다시 점검')
  const reliable = consistencyOk && socialOk && infrequencyOk

  return {
    answered,
    profile,
    reliability: {
      consistency, consistencyOk,
      social, socialOk,
      infrequency: { deviant: infDeviant, total: infTotal, ok: infrequencyOk },
      reliable, flags,
      verdict: reliable ? '신뢰할 수 있는 응답' : '응답 신뢰도 주의',
    },
    summary: buildSummary(profile, reliable),
  }
}

function buildSummary(profile, reliable) {
  const top = [...profile].sort((a, b) => b.score - a.score).slice(0, 2).map(p => p.name)
  const low = [...profile].sort((a, b) => a.score - b.score)[0]
  let s = `두드러진 성향 · ${top.join(' · ')}. `
  if (low.band === 'low') s += `점검할 성향 · ${low.name}. 관련 행동과 습관을 돌아보세요. `
  s += reliable
    ? '응답 신뢰도 양호 · 현재 결과를 자기 이해 자료로 활용하세요.'
    : '응답 신뢰도 우선 점검 · 성향 점수 해석은 신뢰도를 확인한 뒤 진행하세요.'
  return s
}
