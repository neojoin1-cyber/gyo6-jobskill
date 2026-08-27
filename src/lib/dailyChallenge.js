import { userLocalStorage as localStorage } from './userLocalStorage.js'

// 오늘의 도전 — 학생이 지금 필요한 문항을 고른다.
//
// ── 왜 다시 만드나 ─────────────────────────────────────────────────────────
// 화면은 "5문항 · 빈출 우선 출제"라고 말하지만 실측하니 셋 다 사실이 아니었다.
//
//   examPriority === 'high' 인 문항        0개  ← "빈출 우선"이 작동한 적 없음
//   NCS 1,445문항 중 후보에 오른 것        0개  ← questionMode 필터가 전부 걸러냄
//   실제 후보                              직업공통 751개 중 **앞에서 300개만**
//   학생 신호(오답·취약영역·복습예정·진도)  전혀 보지 않음
//
// 결과적으로 "고정된 300개를 날짜 시드로 뽑는" 구조였다. 나머지 60%는 영원히
// 나오지 않았고, 어제 틀린 문제도 오늘 복습할 문제도 도전에 오르지 않았다.
//
// ── 무엇을 기준으로 고르나 ────────────────────────────────────────────────
// 앱에는 이미 학습 신호가 있는데 서로 이어져 있지 않았다. 다섯 문항을 목적별로
// 나눠 담고, **왜 이 문항이 나왔는지 학생에게 보여 준다.** 이유를 알아야 오늘의
// 도전이 숙제가 아니라 자기 학습이 된다.
//
//   2문항  복습 예정(간격 반복 due)  잊을 때가 됐다
//   1문항  미해결 오답               지난번에 틀렸다
//   1문항  최근 학습한 영역          요즘 공부한 곳
//   1문항  취약 영역의 새 문항       약한 영역이다
//
// 몫이 비면 다음 순위가 흡수하고, 신호가 하나도 없는 첫 사용자는 '확인'
// 수준(정보 찾기) 문항으로 시작한다 — 처음부터 종합·추론을 만나면 막힌다.
//
// 서버 왕복은 하루 한 번, 두 개의 가벼운 조회뿐이다(복습 예정 id, 미해결 오답).
// 실패하면 조용히 신호 없이 진행한다 — 오프라인에서도 도전은 떠야 한다.

import { supabase } from './supabase.js'
import { ncs2026Questions } from './ncs2026.js'
import jobQuestions from '../../data/questions.json'
import { normArea } from './ncsAreaAlias.js'
import { currentUserId } from './authUser.js'
import { findQuestion } from './questionIndex.js'

const STORAGE_KEY = 'kbs_daily_challenge_v3'   // v2 는 구조가 달라 재사용하지 않는다
const RECENT_KEY = 'kbs_recent_study_v1'
const CHALLENGE_SIZE = 5

// 몫과 표시 문구. 순서가 곧 우선순위다.
export const PICK_REASONS = {
  review: { share: 2, icon: '🔁', label: '잊을 때가 됐어요', hint: '전에 풀어 본 문항이에요' },
  wrong: { share: 1, icon: '📌', label: '지난번에 틀렸어요', hint: '다시 한 번 확인해요' },
  recent: { share: 1, icon: '📖', label: '요즘 공부한 곳', hint: '배운 걸 굳혀요' },
  weak: { share: 1, icon: '🎯', label: '약한 영역이에요', hint: '오답이 많았던 곳이에요' },
  fresh: { share: 0, icon: '✨', label: '새로 만나는 문항', hint: '' },
}

function today() { return new Date().toISOString().slice(0, 10) }

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 저장 실패는 무시 */ }
}

/** 자율학습에서 문항을 풀 때마다 불러 최근 학습 영역을 남긴다(기기 전용). */
export function noteStudied(subjectId, area) {
  if (!area) return
  const log = readJson(RECENT_KEY, [])
  const next = [{ subjectId, area, at: Date.now() }, ...log.filter(x => x.area !== area)].slice(0, 8)
  writeJson(RECENT_KEY, next)
}

function recentAreas() {
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000
  return readJson(RECENT_KEY, []).filter(x => x.at > week).map(x => normArea(x.area))
}

/** 풀 수 있는 객관식만. questionMode 로 거르면 NCS 전체가 사라진다(이전 버그). */
function isUsable(q) {
  if (q.excludeFromQuiz) return false
  const ch = Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
  return ch.length >= 2 && !!q.stem && !!q.answer
}

function allQuestions() {
  return [...ncs2026Questions, ...jobQuestions].filter(isUsable)
}

async function fetchSignals() {
  const empty = { dueIds: [], wrongIds: [], weakAreas: [] }
  try {
    const uid = await currentUserId()
    if (!uid) return empty

    const [due, wrong] = await Promise.all([
      supabase.from('review_schedule').select('item_id')
        .eq('user_id', uid).lte('due_at', new Date().toISOString()).limit(60),
      // wrong_answers 의 실제 컬럼은 student_id · status('open'|'resolved') 다.
      // user_id/resolved 로 묻고, 있지도 않은 area 까지 뽑으려 해서 이 조회는
      // **늘 400** 이었다. catch 가 삼켜 "오늘의 도전"의 오답·약점 반영이
      // 통째로 죽어 있었고, 화면은 아무 일 없다는 듯 떴다.
      // 영역은 서버에 없다 — 문항 id 로 로컬 문제은행에서 찾는다(왕복 0회).
      supabase.from('wrong_answers').select('question_id')
        .eq('student_id', uid).eq('status', 'open').limit(120),
    ])

    const counts = {}
    for (const r of wrong.data ?? []) {
      const area = normArea(findQuestion(r.question_id)?.area)
      if (area) counts[area] = (counts[area] || 0) + 1
    }
    return {
      dueIds: (due.data ?? []).map(r => r.item_id),
      wrongIds: (wrong.data ?? []).map(r => r.question_id),
      weakAreas: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([a]) => a),
    }
  } catch {
    return empty                 // 오프라인·비로그인에서도 도전은 떠야 한다
  }
}

/** 하루 안에서는 같은 순서가 나오도록 날짜를 씨앗으로 쓴다. */
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0xffffffff
  }
}

function pickFrom(candidates, count, rng, used) {
  const out = []
  const pool = candidates.filter(q => !used.has(q.id))
  while (out.length < count && pool.length) {
    const [q] = pool.splice(Math.floor(rng() * pool.length), 1)
    used.add(q.id)
    out.push(q)
  }
  return out
}

function selectQuestions(pool, signals, rng) {
  const byId = new Map(pool.map(q => [q.id, q]))
  const used = new Set()
  const picked = []
  const recent = recentAreas()
  const weak = signals.weakAreas.map(normArea)

  const buckets = [
    ['review', signals.dueIds.map(id => byId.get(id)).filter(Boolean)],
    ['wrong', signals.wrongIds.map(id => byId.get(id)).filter(Boolean)],
    ['recent', recent.length ? pool.filter(q => recent.includes(normArea(q.area))) : []],
    ['weak', weak.length ? pool.filter(q => weak.includes(normArea(q.area))) : []],
  ]

  for (const [reason, candidates] of buckets) {
    for (const q of pickFrom(candidates, PICK_REASONS[reason].share, rng, used)) {
      picked.push({ ...q, pickReason: reason })
    }
  }

  // 남은 자리는 새 문항으로. 신호가 없는 첫 사용자는 여기만 채워지므로,
  // 처음부터 종합·추론이 나오지 않도록 쉬운 것부터 준다.
  if (picked.length < CHALLENGE_SIZE) {
    const order = { 확인: 0, 적용: 1, 종합: 2 }
    const fresh = pool
      .filter(q => !used.has(q.id))
      .sort((a, b) => (order[a.demandLevel] ?? 1) - (order[b.demandLevel] ?? 1))
    const head = picked.length === 0 ? fresh.slice(0, 120) : fresh
    for (const q of pickFrom(head, CHALLENGE_SIZE - picked.length, rng, used)) {
      picked.push({ ...q, pickReason: 'fresh' })
    }
  }
  return picked
}

export async function getDailyChallenge() {
  const date = today()
  const stored = readJson(STORAGE_KEY, null)
  if (stored?.date === date) return stored

  const pool = allQuestions()
  const signals = await fetchSignals()
  const rng = seeded(parseInt(date.replace(/-/g, ''), 10))
  const questions = selectQuestions(pool, signals, rng)

  const challenge = {
    date, questions, completed: false, score: 0, total: questions.length,
    // 왜 이 조합이 나왔는지 화면에 한 줄로 설명하기 위한 요약
    mix: questions.reduce((m, q) => ({ ...m, [q.pickReason]: (m[q.pickReason] || 0) + 1 }), {}),
  }
  writeJson(STORAGE_KEY, challenge)
  return challenge
}

export function completeDailyChallenge(score) {
  const stored = readJson(STORAGE_KEY, null)
  if (!stored || stored.date !== today() || stored.completed) return
  writeJson(STORAGE_KEY, { ...stored, completed: true, score })
}

export function isDailyCompleted() {
  const stored = readJson(STORAGE_KEY, null)
  return stored?.date === today() && stored?.completed === true
}

export function getDailyStatus() {
  const stored = readJson(STORAGE_KEY, null)
  if (stored?.date !== today()) return { completed: false, score: 0, total: CHALLENGE_SIZE, mix: null }
  return {
    completed: !!stored.completed,
    score: stored.score ?? 0,
    total: stored.total ?? CHALLENGE_SIZE,
    mix: stored.mix ?? null,
  }
}

/** 카드에 띄울 한 줄 설명. 무엇으로 채워졌는지 학생이 알아야 한다. */
export function describeMix(mix) {
  if (!mix) return `${CHALLENGE_SIZE}문항 · 완료 시 +50 XP`
  const parts = []
  if (mix.review) parts.push(`복습 ${mix.review}`)
  if (mix.wrong) parts.push(`지난 오답 ${mix.wrong}`)
  if (mix.recent) parts.push(`요즘 공부한 곳 ${mix.recent}`)
  if (mix.weak) parts.push(`약한 영역 ${mix.weak}`)
  if (mix.fresh) parts.push(`새 문항 ${mix.fresh}`)
  return `${parts.join(' · ')} · 완료 시 +50 XP`
}
