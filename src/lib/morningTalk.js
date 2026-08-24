// 아침 출석 — 그냥 누르는 버튼이 아니라 짧은 의례로 만든다.
//
// ── 왜 ────────────────────────────────────────────────────────────────────
// 스트릭(연속 학습일)은 이미 있었지만, 그것을 **채우는 행동**이 따로 없었다.
// 학생이 앱을 열 이유는 "숙제가 있을 때"뿐이었고, 없으면 열지 않는다.
//
// 출석에 두 가지를 붙였다.
//   1. 오늘의 훈화 한 편 — 2분 분량. 읽을거리가 있어야 여는 이유가 된다.
//   2. 훈화 연계 문항 한 개 — 읽었는지 확인한다. 안 읽으면 못 푼다.
//
// 같은 원고를 교사 조회 자료로도 쓴다(teacherNote). 학생이 아침에 읽은 글을
// 교사가 교실에서 다시 꺼내면 그날 하루가 이어진다 — 그게 이 구조의 목적이다.
//
// ── 어떤 훈화가 오늘인가 ──────────────────────────────────────────────────
// 날짜를 씨앗으로 **한 바퀴 다 돌 때까지 겹치지 않게** 고른다. 무작위로 뽑으면
// 며칠 만에 같은 글이 또 나오고, 그러면 학생은 읽지 않고 넘긴다.

import talks from '../../data/morning-talks.json'

const KEY = 'kbs_attendance_v1'
const ORDER_KEY = 'kbs_talk_order_v1'

export const MORNING_TALKS = talks

function today() { return new Date().toISOString().slice(0, 10) }

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 저장 실패는 무시 */ }
}

/** 날짜를 씨앗으로 한 섞기. 같은 기기에서 같은 순서가 유지된다. */
function shuffled(seed) {
  const arr = talks.map((_, i) => i)
  let s = seed >>> 0
  const rand = () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0xffffffff
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 오늘의 훈화. 한 바퀴(전체 편수)를 다 돌기 전에는 같은 글이 나오지 않는다.
 * 다 돌면 새 순서로 섞어 다시 시작한다.
 */
export function todaysTalk() {
  if (!talks.length) return null
  let state = readJson(ORDER_KEY, null)
  if (!state?.order?.length || state.cursor >= state.order.length) {
    state = { order: shuffled(Number(today().replace(/-/g, '')) + (state?.round ?? 0)),
      cursor: 0, round: (state?.round ?? 0) + 1, date: null }
  }
  // 하루에 한 편. 날짜가 바뀌었을 때만 다음으로 넘어간다.
  if (state.date && state.date !== today()) state.cursor += 1
  if (state.cursor >= state.order.length) {
    state = { order: shuffled(Number(today().replace(/-/g, '')) + state.round),
      cursor: 0, round: state.round + 1, date: null }
  }
  state.date = today()
  writeJson(ORDER_KEY, state)
  return talks[state.order[state.cursor]] ?? talks[0]
}

/** 오늘 출석했는가. { done, correct, talkId } */
export function getAttendance() {
  const s = readJson(KEY, null)
  if (s?.date !== today()) return { done: false, correct: null, talkId: null }
  return { done: !!s.done, correct: s.correct ?? null, talkId: s.talkId ?? null }
}

export function markAttendance(talkId, correct) {
  if (getAttendance().done) return false        // 하루 한 번. XP 중복 지급을 막는다
  writeJson(KEY, { date: today(), done: true, correct: !!correct, talkId })
  return true
}
