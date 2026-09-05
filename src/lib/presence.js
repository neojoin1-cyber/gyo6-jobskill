/**
 * 수업 참여 신호 — 「지금 앱을 보고 있나」를 담당 교사에게 알린다.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────
 * 실습을 지시해도 학생이 정말 하고 있는지 교사가 알 수 없다. 교실을 한
 * 바퀴 도는 사이 앞자리는 다시 다른 화면으로 간다. 30명을 한 사람이
 * 눈으로 지키는 것은 불가능하다.
 *
 * ── 선을 어디에 긋나 ──────────────────────────────────────────────
 * 미성년자를 보는 기능이다. 네 가지를 지킨다.
 *
 *   1. 교사가 **수업을 연 동안만** 돈다. 집에서 자습할 때는 아무것도 안 보낸다.
 *   2. 보내는 것은 **active / away 두 글자뿐**이다. 어떤 앱으로 갔는지,
 *      무엇을 보는지는 브라우저가 알려 주지도 않고 우리도 받지 않는다.
 *   3. 학생 화면에 **수업 중 띠가 뜬다.** 모르게 보지 않는다.
 *   4. 수업이 끝나면 즉시 멈춘다.
 *
 * ── 무엇으로 판단하나 ─────────────────────────────────────────────
 * `document.visibilityState` 하나다. 화면이 꺼지거나, 다른 앱이 위로
 * 올라오거나, 홈으로 나가면 'hidden' 이 된다. 웹 표준이라 안드로이드
 * 웹뷰·iOS·PC 브라우저에서 모두 같게 동작한다.
 *
 * 창 포커스(blur)는 쓰지 않는다. 화면 분할이나 알림 팝업에도 blur 가
 * 뜨는데, 그건 딴짓이 아니다. 잘못 세면 교사가 기능을 믿지 않게 된다.
 *
 * ── 얼마나 자주 보내나 ────────────────────────────────────────────
 * 처음엔 45초마다 보내게 했다. 한 학교(900명)라면 초당 20회로 아무 문제가
 * 없다. 그런데 전국 3만 명이 1교시에 함께 수업하면 **초당 667회**다.
 * 이 DB 의 실측 처리 한계가 850 req/s 였으니 참여 신호 하나가 용량의
 * 78%를 먹는다. 학생들이 정작 문제를 풀 자리가 없어진다.
 *
 * 자주 보내는 것과 교사가 빨리 알아채는 것은 다른 문제다.
 *
 *   앱을 벗어남·돌아옴   즉시 — visibilitychange 가 그 순간 뜬다
 *   아무 일 없음         150초마다 (± 흔들기)
 *
 * 교사가 알아야 할 「지금 나갔다」는 그대로 즉시 뜬다. 줄어드는 것은
 * 「아직 잘 보고 있다」를 반복해 말하는 부분뿐이다. 3만 명이어도
 * **초당 200회**(용량의 24%)로 내려간다.
 *
 * ── 흔들기를 왜 넣나 ──────────────────────────────────────────────
 * 1교시 종이 울리면 3만 명이 동시에 앱을 연다. 간격이 정확히 150초면
 * 그 뒤로도 150초마다 3만 명이 한꺼번에 몰린다. 초당 200회가 아니라
 * 150초마다 3만 회의 파도가 된다. ±15% 흔들어 고르게 편다.
 */
import { supabase } from './supabase.js'

const PING_MS = 150_000
/** 파도를 만들지 않으려고 ±15% 흔든다. 127~172초 사이에서 고르게 퍼진다. */
const jitter = () => PING_MS * (0.85 + Math.random() * 0.3)

let sessionId = null
let timer = null
let lastState = null
let bound = false
let onFocus = null   // 선생님 위치가 바뀌면 알려 줄 곳

/** 지금 수업 중인가. 앱을 열 때·동기화할 때 함께 묻는다. */
export async function fetchMyClassSession() {
  const { data } = await supabase.rpc('rpc_my_class_session')
  return data?.session_id ? data : null
}

function currentState() {
  return document.visibilityState === 'visible' ? 'active' : 'away'
}

async function ping(state) {
  if (!sessionId) return
  lastState = state
  const { data } = await supabase.rpc('rpc_presence_ping', {
    p_session_id: sessionId, p_state: state,
  })
  // 교사가 수업을 닫으면 서버가 알려 준다. 그때 스스로 멈춘다.
  if (data?.error === 'no_session') {
    stopPresence()
    onFocus?.(null, { sessionClosed: true })
    return
  }
  // 신호 응답에 선생님이 보는 자리가 함께 온다. **조회가 늘지 않는다** —
  // 어차피 오가던 요청에 얹어 보낸 것이다.
  if (data && 'focus' in data) onFocus?.(data.focus ?? null)
}

function onVisibility() {
  const s = currentState()
  if (s === lastState) return
  // 상태가 바뀐 순간은 기다리지 않는다. 교사가 볼 것이 바로 이 순간이다.
  ping(s)
}

/**
 * 신호를 보내기 시작한다.
 * @param {string} id 수업 세션 id
 */
/** 선생님 위치가 갱신될 때 호출된다. 화면이 띠를 다시 그린다. */
export function setFocusListener(fn) { onFocus = fn }

export function startPresence(id) {
  if (!id) return
  if (sessionId === id && timer) return   // 이미 같은 세션으로 돌고 있다
  stopPresence()
  sessionId = id
  ping(currentState())
  // setInterval 이 아니라 매번 새로 잡는다. 그래야 간격마다 다시 흔들 수 있다.
  const tick = () => {
    ping(currentState())
    timer = setTimeout(tick, jitter())
  }
  timer = setTimeout(tick, jitter())
  if (!bound) {
    document.addEventListener('visibilitychange', onVisibility)
    // 앱을 완전히 닫을 때 마지막으로 한 번. 실패해도 그만이다 —
    // 210초 뒤 서버가 알아서 '끊김'으로 본다.
    window.addEventListener('pagehide', () => ping('away'))
    bound = true
  }
}

export function stopPresence() {
  if (timer) clearTimeout(timer)
  timer = null
  sessionId = null
  lastState = null
}

export const isPresenceOn = () => !!timer
export const currentSessionId = () => sessionId
