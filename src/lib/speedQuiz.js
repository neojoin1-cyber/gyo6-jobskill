// 주간 스피드 퀴즈 — 앱을 여는 이유 하나를 더 만든다.
//
// ── 왜 게임인가 ───────────────────────────────────────────────────────────
// 학습 화면은 정확도를 다룬다. 시간을 재지 않으니 '확인' 수준 문항을 아무리
// 반복해도 **빨라졌는지**를 학생도 교사도 알 수 없다. 실제 필기시험은
// 시간 제한이 있고, 정보 찾기·단순 연산은 속도가 곧 점수다.
//
// 그래서 게임의 규칙이 곧 학습 목표가 되게 했다.
//   · 60초 동안 최대한 많이 — '확인'과 '적용' 수준만 낸다(종합은 60초에 맞지 않는다)
//   · 틀리면 3초 감점 — 찍어서 넘기는 것이 이득이 되지 않게
//   · 연속 정답 보너스 — 흐름을 타면 점수가 붙는다
//
// 주간 단위인 이유는 앱에 이미 **주간 XP 랭킹**이 있기 때문이다. 새 표를
// 만들지 않고 그 위에 얹으면 반 대항전이 저절로 성립한다.

import { ncs2026Questions } from './ncs2026.js'
import jobQuestions from '../../data/questions.json'
import { normArea } from './ncsAreaAlias.js'
import { demandLevel } from './demandLevel.js'

export const ROUND_SECONDS = 60
export const WRONG_PENALTY = 3          // 초
export const STORAGE_KEY = 'kbs_speed_quiz_v1'

/** 60초 안에 읽고 풀 수 있는 문항만. 지문이 길면 게임이 아니라 독해가 된다. */
function isQuick(q) {
  if (q.excludeFromQuiz) return false
  const ch = Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
  if (ch.length < 2 || ch.length > 5) return false
  if (!q.stem || !/^[A-E]$/.test(q.answer || '')) return false
  if (q.visual) return false                       // 표·그래프는 60초에 맞지 않는다
  if ((q.context || '').length > 120) return false
  if (q.stem.length > 90) return false
  // demandLevel 은 26v1 문항에만 붙어 있다. 구 문항은 그 자리에서 매기지 않으면
  // 종합 문항이 그대로 섞인다 — 실측하니 풀의 절반이 미태깅이었다.
  if ((q.demandLevel ?? demandLevel(q)) === '종합') return false
  return ch.every(c => String(c).length <= 40)
}

// 영역 이름을 26v1 로 통일한다. 그러지 않으면 영역 고르기 화면에
// '자기개발능력'과 '자기관리능력'이 나란히 떠서 같은 것을 둘로 보이게 한다.
export const SPEED_POOL = [...ncs2026Questions, ...jobQuestions]
  .filter(isQuick)
  .map(q => ({ ...q, area: normArea(q.area) }))

export const SPEED_AREAS = (() => {
  const m = {}
  for (const q of SPEED_POOL) m[q.area] = (m[q.area] || 0) + 1
  return Object.entries(m)
    .filter(([, n]) => n >= 20)                   // 20문항도 없으면 매번 같은 것이 나온다
    .sort((a, b) => b[1] - a[1])
    .map(([area, n]) => ({ area, count: n }))
})()

/** 이번 주 월요일(로컬). 주간 기록의 기준. */
export function weekKey(d = new Date()) {
  const t = new Date(d)
  const day = (t.getDay() + 6) % 7               // 월=0
  t.setDate(t.getDate() - day)
  return t.toISOString().slice(0, 10)
}

function read() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
}

/** 이번 주 최고 점수. 주가 바뀌면 0부터 다시. */
export function getWeeklyBest() {
  const s = read()
  return s?.week === weekKey() ? (s.best ?? 0) : 0
}

export function getPlaysThisWeek() {
  const s = read()
  return s?.week === weekKey() ? (s.plays ?? 0) : 0
}

export function saveResult(score) {
  const wk = weekKey()
  const s = read()
  const base = s?.week === wk ? s : { week: wk, best: 0, plays: 0 }
  const next = { week: wk, best: Math.max(base.best ?? 0, score), plays: (base.plays ?? 0) + 1 }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 무시 */ }
  return next
}

/** 한 판에 낼 문항. 넉넉히 뽑아 두고 시간이 끝날 때까지 이어 낸다. */
export function drawRound(area, size = 40) {
  const pool = area ? SPEED_POOL.filter(q => q.area === area) : SPEED_POOL
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, size)
}

/**
 * 점수 = 맞힌 수 × 10 + 최대 연속 보너스.
 * 정확도만 세면 찍기가 이득이라 연속을 함께 본다.
 */
export function scoreOf(correct, bestStreak) {
  return correct * 10 + Math.max(0, bestStreak - 2) * 5
}
