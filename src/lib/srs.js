/**
 * SRS(간격 반복) — 학습과학 '분산 학습(Spacing Effect)' 적용.
 * SM-2 경량 구현. 인출 퀴즈 결과(quality 0~5)로 문항별 다음 복습일을 계산.
 * 저장: Supabase review_schedule (본인 행만, RLS). 비로그인·오프라인은 조용히 무시.
 */
import { supabase } from './supabase.js'
import { currentUserId } from './authUser.js'
import { queueReview } from './localFirst.js'

const DAY = 24 * 60 * 60 * 1000

// SM-2: 이전 상태 + 응답 품질(q) → 다음 상태
function nextState(prev, q) {
  let { ease = 2.5, interval_days = 0, reps = 0 } = prev || {}
  if (q < 3) {
    // 실패/애매 → 다시 학습 단계로. 당일(짧은 간격) 재출제.
    reps = 0
    interval_days = 0
  } else {
    reps += 1
    if (reps === 1)      interval_days = 1
    else if (reps === 2) interval_days = 3
    else                 interval_days = Math.round(interval_days * ease)
    ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if (ease < 1.3) ease = 1.3
  }
  return { ease: Math.round(ease * 100) / 100, interval_days, reps }
}

// 요구 수준마다 되돌아올 간격이 달라야 한다.
//
// '찾아 읽기'(확인)는 정확도보다 **속도**가 목표라 자주 만나야 빨라진다.
// '근거 세우기'(종합)는 한 문항에 드는 시간이 길어, 같은 주기로 돌리면
// 하루 복습량이 몇 문항으로 줄고 학생이 지친다. 대신 간격을 넓게 잡는다.
//
// 학습 화면에서 "짧은 간격으로 다시 물어볼게요"라고 말하는 이상, 실제로
// 그렇게 동작해야 한다. 말만 하고 코드는 같으면 그게 곧 거짓말이 된다.
const DEMAND_SPACING = { 확인: 0.6, 적용: 1, 종합: 1.4 }

// ── 모아서 한 번에 보내기 ────────────────────────────────────────────
//
// 채점은 문항 단위가 아니라 **세트 단위로 한꺼번에** 일어난다. 30문항을
// 채점하면 recordReview 가 30번 연달아 불린다. 예전에는 한 번마다
//   ① 인증 서버 왕복  ② 이전 상태 SELECT  ③ UPSERT
// 세 번을 다녀왔다 — 학생 한 명이 **왕복 90번**. 동시 접속이 수만이면
// 그대로 곱해진다.
//
// 지금은 큐에 쌓아 두고 한 번만 내보낸다. 같은 세트면
//   ① 큐에 담긴 문항의 이전 상태를 SELECT 한 번  ② UPSERT 한 번
// 으로 끝난다. 왕복 90번 → **2번**.
//
// 같은 문항이 한 세트에서 두 번 나오면 응답 순서대로 SM-2 를 이어서
// 적용한다(그래야 낱개로 보낼 때와 결과가 같다).
const queue = []          // {subject, unitId, itemId, demand, quality}
let flushTimer = null
let flushing = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => { flushTimer = null; flushReviews() }, 700)
}

/**
 * 인출 결과를 복습 스케줄에 반영. 큐에 담고 곧바로 반환한다.
 * @param {{subject,unitId,itemId,demand?}} it  demand: '확인'|'적용'|'종합'
 * @param {number} quality 0~5 (오답=1, 애매=3, 정답=4, 확실=5)
 */
export function recordReview(it, quality) {
  if (!it?.itemId) return
  queue.push({ ...it, quality })
  scheduleFlush()
}

/** 큐에 쌓인 것을 지금 내보낸다. 화면을 떠나거나 앱이 가려질 때 부른다. */
export async function flushReviews() {
  if (flushing) return flushing
  if (!queue.length) return
  const batch = queue.splice(0, queue.length)
  flushing = (async () => {
    try {
      const uid = await currentUserId()
      if (!uid) return
      const ids = [...new Set(batch.map(b => b.itemId))]
      const { data: rows } = await supabase
        .from('review_schedule')
        .select('item_id, ease, interval_days, reps')
        .eq('user_id', uid).in('item_id', ids)
      const prevOf = new Map((rows || []).map(r => [r.item_id, r]))

      const now = Date.now()
      const merged = new Map()
      for (const b of batch) {
        // 같은 문항이 여러 번이면 앞의 결과를 이어받는다.
        const prev = merged.get(b.itemId)?.state ?? prevOf.get(b.itemId) ?? null
        const s = nextState(prev, b.quality)
        // 간격 조정은 due 계산에만 쓴다. interval_days 를 곱해 저장하면 다음 번
        // 계산에 또 곱해져 배수가 누적된다(확인 문항이 몇 회 만에 사실상 사라진다).
        const spacing = DEMAND_SPACING[b.demand] ?? 1
        const days = s.interval_days > 0 ? Math.max(1, Math.round(s.interval_days * spacing)) : 0
        merged.set(b.itemId, {
          state: s,
          row: {
            user_id: uid, subject: b.subject, unit_id: b.unitId, item_id: b.itemId,
            ease: s.ease, interval_days: s.interval_days, reps: s.reps,
            due_at: new Date(now + days * DAY).toISOString(),
            updated_at: new Date(now).toISOString(),
          },
        })
      }
      // 예전에는 여기서 바로 UPSERT 했다. 지금은 outbox 에 담고 5분마다
      // 한 번에 보낸다(localFirst.sync). 세트당 왕복 2회 → 0회가 되고,
      // 동기화는 여러 세트를 모아 한 번에 처리한다.
      for (const v of merged.values()) queueReview(v.row)
    } catch {
      /* 오프라인·비로그인 무시 */
    } finally {
      flushing = null
    }
  })()
  return flushing
}

// 채점 직후 학생이 화면을 닫아도 기록이 남아야 한다.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushReviews()
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushReviews() })
}

/**
 * 전 과목 통틀어 '오늘 복습할' 문항 수(홈 배지용).
 * @returns {Promise<number>}
 */
export async function getDueCount() {
  try {
    const uid = await currentUserId()
    if (!uid) return 0
    const { count } = await supabase
      .from('review_schedule')
      .select('item_id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .lte('due_at', new Date().toISOString())
    return count || 0
  } catch { return 0 }
}

/**
 * 전 과목 '오늘 복습할' 문항. 홈의 복습 카드가 실제 세션을 열 때 쓴다.
 *
 * 과목별 조회(getDueItemIds)만 있어서 홈 카드는 개수만 세고 정작 그 문항을
 * 불러올 방법이 없었다. 그래서 카드를 눌러도 교재 선택 화면으로 보내 버렸다.
 * 오래 잊은 것부터 준다 — 가장 위태로운 기억이 먼저다.
 *
 * @returns {Promise<Array<{itemId:string, subject:string, unitId:string}>>}
 */
export async function getDueItems(limit = 20) {
  try {
    const uid = await currentUserId()
    if (!uid) return []
    const { data } = await supabase
      .from('review_schedule')
      .select('item_id, subject, unit_id, due_at')
      .eq('user_id', uid)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit)
    return (data || []).map(r => ({ itemId: r.item_id, subject: r.subject, unitId: r.unit_id }))
  } catch { return [] }
}

/**
 * 과목의 '오늘 복습할' 문항 id 목록(due_at <= now).
 * @returns {Promise<string[]>}
 */
export async function getDueItemIds(subject) {
  try {
    const uid = await currentUserId()
    if (!uid) return []
    const { data } = await supabase
      .from('review_schedule')
      .select('item_id')
      .eq('user_id', uid).eq('subject', subject)
      .lte('due_at', new Date().toISOString())
    return (data || []).map(r => r.item_id)
  } catch { return [] }
}
