/**
 * 부하 시나리오 — 앱이 실제로 던지는 요청을 그대로 옮긴다.
 *
 * 지어낸 부하는 의미가 없다. 각 시나리오는 소스의 어느 줄에서 나온
 * 요청인지 주석으로 적어 둔다. 앱이 바뀌면 여기도 바뀌어야 한다.
 *
 * weight 는 하루 동안 그 동작이 일어나는 상대 빈도다.
 *   홈 진입   : 앱을 열 때마다 — 가장 잦다
 *   학습 채점 : 한 세션에 한 번, 쓰기가 있다
 *   복습 조회 : 홈 배지와 도전 카드
 *   랭킹      : 가끔 들어간다
 */

/** 학생 한 명이 홈 화면을 열 때 나가는 요청 (StudentHome.jsx: load()) */
export const home = {
  name: '홈 진입',
  weight: 50,
  steps: [
    { label: 'student_classes', method: 'GET',
      path: '/rest/v1/student_classes?select=class_id' },
    { label: 'user_streaks', method: 'GET',
      path: (c) => `/rest/v1/user_streaks?select=*&user_id=eq.${c.uid}` },
    { label: 'rpc_my_xp', method: 'POST', path: '/rest/v1/rpc/rpc_my_xp', body: {} },
    { label: 'rpc_my_subjects', method: 'POST', path: '/rest/v1/rpc/rpc_my_subjects', body: {} },
  ],
}

/** 홈 배지·오늘의 도전 (srs.js getDueCount, dailyChallenge.js fetchSignals) */
export const review = {
  name: '복습 조회',
  weight: 25,
  steps: [
    { label: 'review_schedule(due)', method: 'GET',
      path: (c) => `/rest/v1/review_schedule?select=item_id&user_id=eq.${c.uid}`
                 + `&due_at=lte.${encodeURIComponent(new Date().toISOString())}&limit=60` },
    { label: 'wrong_answers(open)', method: 'GET',
      path: (c) => `/rest/v1/wrong_answers?select=question_id&student_id=eq.${c.uid}`
                 + `&status=eq.open&limit=120` },
  ],
}

/**
 * 학습 세트 채점 — 유일한 쓰기 경로이자 가장 무겁다. (srs.js flushReviews)
 * 예전에는 문항마다 3회씩 왕복했다. 지금은 세트당 2회다.
 * 부하 테스트의 핵심은 이 2회가 정말 2회인지, 그리고 쓰기가 몰릴 때
 * 버티는지를 보는 것이다.
 */
export const grade = {
  name: '세트 채점(쓰기)',
  weight: 20,
  steps: [
    { label: 'review_schedule(prev)', method: 'GET',
      path: (c) => `/rest/v1/review_schedule?select=item_id,ease,interval_days,reps`
                 + `&user_id=eq.${c.uid}&item_id=in.(${c.itemIds.join(',')})` },
    { label: 'review_schedule(upsert)', method: 'POST',
      path: '/rest/v1/review_schedule?on_conflict=user_id,item_id',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: (c) => c.itemIds.map((id, i) => ({
        user_id: c.uid,
        subject: 'loadtest',
        unit_id: 'loadtest-unit',
        item_id: id,
        ease: 2.5,
        interval_days: (i % 5),
        reps: (i % 3),
        due_at: new Date(Date.now() + 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      })) },
  ],
}

/** 학급 주간 랭킹 (RankingScreen.jsx) — 서버에서 집계, LIMIT 10 */
export const ranking = {
  name: '랭킹',
  weight: 5,
  steps: [
    { label: 'rpc_class_weekly_rank', method: 'POST',
      path: '/rest/v1/rpc/rpc_class_weekly_rank', body: {} },
  ],
}

export const ALL = { home, review, grade, ranking }

/** 읽기만 하는 시나리오 — 운영 DB 를 더럽히지 않고 재는 용도 */
export const READ_ONLY = { home, review, ranking }

// ── 로컬 우선 구조 (2026-08-23 이후) ───────────────────────────────
//
// 앱이 서버를 만나는 지점이 둘로 줄었다. 앞의 시나리오들은 **바꾸기 전**
// 구조를 재려고 남겨 둔다 — 비교할 대상이 없으면 개선을 증명할 수 없다.

/** 앱을 열 때 한 번. 그 뒤 5분간은 로컬 캐시에서 그린다. */
export const bootstrap = {
  name: '앱 시작(부트스트랩)',
  weight: 50,
  steps: [{ label: 'rpc_bootstrap', method: 'POST', path: '/rest/v1/rpc/rpc_bootstrap', body: {} }],
}

/** 쌓아 둔 학습 기록을 5분마다 한 번에. 24문항 한 세트를 담아 보낸다. */
export const syncProgress = {
  name: '진도 동기화',
  weight: 50,
  steps: [{
    label: 'rpc_sync_progress', method: 'POST', path: '/rest/v1/rpc/rpc_sync_progress',
    body: (c) => ({ p_payload: {
      reviews: c.itemIds.map((id, i) => ({
        item_id: id, subject: 'loadtest', unit_id: 'u',
        ease: 2.5, interval_days: i % 5, reps: i % 3,
        due_at: new Date(Date.now() + 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      })),
      wrong: [], resolved: [],
      activity: { study: 1, quiz: 0, mission: 0 },
      correct: 0,      // XP 는 서버가 계산한다. 부하 측정에서는 0 으로 둔다.
    } }),
  }],
}

export const LOCAL_FIRST = { bootstrap, syncProgress }
