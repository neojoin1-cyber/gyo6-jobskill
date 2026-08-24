/**
 * 로컬 우선 — 서버는 가끔만 만난다.
 *
 * ── 왜 ─────────────────────────────────────────────────────────────
 * 문항도 시험지도 이미 앱 안에 있다. 서버를 치는 것은 **사용자 상태**뿐인데
 * 그게 화면을 열 때마다 6번, 채점할 때마다 2번씩 나갔다. 동시 30,000명이면
 * 초당 3,200요청 — Micro(2코어·1GB)로는 어림도 없고 4XL(월 $960)이 든다.
 *
 * 그런데 이 요청들은 **몇 분 늦어도 학생이 알아채지 못하는 것들**이다.
 * 스트릭이 5분 전 값이어도, XP가 조금 뒤에 오르더라도 학습에 지장이 없다.
 *
 * 그래서 두 가지만 남긴다.
 *   읽기 — 앱을 열 때 rpc_bootstrap 한 번, 그 뒤 CACHE_TTL 동안은 로컬에서.
 *   쓰기 — 학습 기록을 outbox 에 쌓았다가 SYNC_EVERY 마다 한 번에.
 *
 * 초당 3,200요청 → 200요청. 등급을 올리지 않고도 감당한다.
 *
 * ── 믿지 않는 것 ───────────────────────────────────────────────────
 * 로컬에서 계산한 XP·스트릭을 그대로 보내면 학생이 조작할 수 있다. 랭킹에
 * 쓰이는 값이라 그냥 둘 수 없다. 그래서 outbox 는 **근거만** 담는다 —
 * 맞힌 문항 수, 활동 종류. XP 와 스트릭은 서버가 계산한다.
 *
 * ── 잃지 않는 것 ───────────────────────────────────────────────────
 * 앱을 지우면 아직 안 보낸 기록이 사라진다. 그래서 화면이 가려질 때
 * (visibilitychange·pagehide) 즉시 보내고, 그 사이에도 주기적으로 보낸다.
 * 손실 창을 최대 SYNC_EVERY 로 묶는다.
 */
import { supabase } from './supabase.js'
import { currentUserId } from './authUser.js'

const CACHE_KEY  = 'kbs_bootstrap_v1'
const OUTBOX_KEY = 'kbs_outbox_v1'
const CACHE_TTL  = 5 * 60 * 1000     // 부트스트랩 캐시 수명
const SYNC_EVERY = 5 * 60 * 1000     // outbox 를 비우는 주기

// ── 저장소 ─────────────────────────────────────────────────────────
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 용량 초과 무시 */ }
}

const emptyOutbox = () => ({
  reviews: {},                                  // item_id -> 최신 상태 (덮어쓰기)
  wrong: {},                                    // question_id -> 오답 1건
  resolved: [],
  activity: { study: 0, quiz: 0, mission: 0 },
  correct: 0,
})

// ── 부트스트랩 (읽기) ──────────────────────────────────────────────
let inflight = null

/**
 * 홈에 필요한 모든 것. 캐시가 살아 있으면 서버에 가지 않는다.
 * @param {{force?: boolean}} opts force 로 캐시를 무시하고 새로 받는다.
 */
export async function getBootstrap({ force = false } = {}) {
  const cached = read(CACHE_KEY, null)
  if (!force && cached?.at && Date.now() - cached.at < CACHE_TTL) return cached.data
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const uid = await currentUserId()
      if (!uid) return cached?.data ?? null
      const { data, error } = await supabase.rpc('rpc_bootstrap')
      if (error || !data || data.error) return cached?.data ?? null
      write(CACHE_KEY, { at: Date.now(), data })
      return data
    } catch {
      return cached?.data ?? null       // 오프라인이면 지난 값이라도 보여 준다
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 캐시를 즉시 무효화한다(미션 제출처럼 화면이 바로 바뀌어야 할 때). */
export function invalidateBootstrap() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* 무시 */ }
}

/** 서버에 가지 않고 캐시 안의 값만 고친다(낙관적 갱신). */
export function patchBootstrap(patch) {
  const cached = read(CACHE_KEY, null)
  if (!cached?.data) return
  write(CACHE_KEY, { at: cached.at, data: { ...cached.data, ...patch } })
}

// ── outbox (쓰기) ──────────────────────────────────────────────────
/** 간격반복 결과. 같은 문항이 다시 오면 나중 것으로 덮는다. */
export function queueReview(row) {
  if (!row?.item_id) return
  const box = read(OUTBOX_KEY, emptyOutbox())
  box.reviews[row.item_id] = row
  write(OUTBOX_KEY, box)
  schedule()
}

/** 틀린 문항. 같은 문항은 한 번만 담는다(서버가 빈도를 센다). */
export function queueWrong(item) {
  if (!item?.question_id) return
  const box = read(OUTBOX_KEY, emptyOutbox())
  box.wrong[item.question_id] = item
  write(OUTBOX_KEY, box)
  schedule()
}

/** 오답을 해결했을 때. */
export function queueResolved(questionId) {
  if (!questionId) return
  const box = read(OUTBOX_KEY, emptyOutbox())
  if (!box.resolved.includes(questionId)) box.resolved.push(questionId)
  write(OUTBOX_KEY, box)
  schedule()
}

/**
 * 활동과 XP 근거. XP 값 자체를 보내지 않는다 — 맞힌 개수만 보내고
 * 서버가 계산한다.
 * @param {'study'|'quiz'|'mission'} type
 * @param {number} correct 맞힌 문항 수
 */
export function queueActivity(type, correct = 0) {
  const box = read(OUTBOX_KEY, emptyOutbox())
  if (type in box.activity) box.activity[type] += 1
  box.correct += Math.max(0, correct | 0)
  write(OUTBOX_KEY, box)
  schedule()
}

// ── 보내기 ─────────────────────────────────────────────────────────
let timer = null
let sending = null

function schedule() {
  if (timer) return
  timer = setTimeout(() => { timer = null; sync() }, SYNC_EVERY)
}

function isEmpty(box) {
  return !Object.keys(box.reviews).length && !Object.keys(box.wrong).length
    && !box.resolved.length && !box.correct
    && !box.activity.study && !box.activity.quiz && !box.activity.mission
}

/** 쌓인 것을 지금 보낸다. 화면을 떠날 때·앱이 가려질 때 부른다. */
export async function sync() {
  if (sending) return sending
  const box = read(OUTBOX_KEY, emptyOutbox())
  if (isEmpty(box)) return null

  // 보내기 전에 비운다. 실패하면 되돌린다 — 그 사이 새로 쌓인 것과 합쳐서.
  write(OUTBOX_KEY, emptyOutbox())

  sending = (async () => {
    try {
      const uid = await currentUserId()
      if (!uid) { restore(box); return null }
      const payload = {
        reviews: Object.values(box.reviews),
        wrong: Object.values(box.wrong),
        resolved: box.resolved,
        activity: box.activity,
        correct: box.correct,
      }
      const { data, error } = await supabase.rpc('rpc_sync_progress', { p_payload: payload })
      if (error) { restore(box); return null }
      // 서버가 계산한 XP·스트릭을 캐시에 반영해 두면 다음 홈 진입이 최신으로
      // 보이고, 활동 직후에 따로 조회할 필요도 없다.
      const fresh = {}
      if (data?.xp)     fresh.xp = data.xp
      if (data?.streak) fresh.streak = data.streak
      if (Object.keys(fresh).length) patchBootstrap(fresh)
      return data
    } catch {
      restore(box)
      return null
    } finally {
      sending = null
    }
  })()
  return sending
}

/** 실패한 묶음을 그 뒤 쌓인 것과 합쳐 되돌린다. */
function restore(box) {
  const now = read(OUTBOX_KEY, emptyOutbox())
  write(OUTBOX_KEY, {
    reviews: { ...box.reviews, ...now.reviews },      // 나중 것이 이긴다
    wrong: { ...box.wrong, ...now.wrong },
    resolved: [...new Set([...box.resolved, ...now.resolved])],
    activity: {
      study: box.activity.study + now.activity.study,
      quiz: box.activity.quiz + now.activity.quiz,
      mission: box.activity.mission + now.activity.mission,
    },
    correct: box.correct + now.correct,
  })
  schedule()
}

// 앱이 가려지거나 닫히면 지금 보낸다. 여기가 손실을 막는 마지막 지점이다.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync()
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { sync() })
}
