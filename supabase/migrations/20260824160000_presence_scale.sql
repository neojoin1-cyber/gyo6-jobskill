-- ============================================================
-- 023: 참여 상태를 3만 명 규모로 — 신호를 줄이고 조회를 빠르게
-- ============================================================
--
-- ── 무엇이 문제였나 ────────────────────────────────────────────────
-- 45초 간격으로 신호를 보내게 만들었다. 한 학교(30학급 900명)라면 초당
-- 20회로 아무 문제가 없다. 그런데 전국 3만 명이 1교시에 함께 수업하면
--
--     30,000 ÷ 45초 = 초당 667회
--
-- 이다. 실측한 이 DB 의 처리 한계가 850 req/s 였다(400 VU 에서 811,
-- 프로세스를 늘려도 851). **참여 신호 하나가 서버 용량의 78%를 먹는다.**
-- 학생들이 정작 문제를 풀 자리가 남지 않는다.
--
-- ── 어떻게 줄이나 ──────────────────────────────────────────────────
-- 신호를 자주 보내는 것과, 교사가 빨리 알아채는 것은 다른 문제다.
-- **상태가 바뀌는 순간은 즉시 보내고, 아무 일 없을 때는 천천히 보낸다.**
--
--   앱을 벗어남 · 돌아옴   즉시 (visibilitychange 가 그 순간 뜬다)
--   아무 일 없음           150초마다 (± 흔들기)
--
-- 교사가 알아야 할 「지금 나갔다」는 여전히 즉시 뜬다. 줄어드는 것은
-- 「아직 잘 보고 있다」를 반복해 말하는 부분뿐이다.
--
--     30,000 ÷ 150초 = 초당 200회   (용량의 24%)
--
-- ── 나간 학생은 신호를 못 보낸다 ───────────────────────────────────
-- 앱이 뒤로 가면 브라우저가 타이머를 얼린다. 그래서 away 상태에서는
-- 신호가 끊기는 것이 **정상**이다. 이걸 「끊김」으로 표시하면 매 수업마다
-- 오탐이 쏟아진다.
--
-- 그래서 마지막 상태에 따라 다르게 읽는다.
--   active 였는데 소식 없음 → 끊김 (앱이 닫혔거나 전원이 나갔다)
--   away   였는데 소식 없음 → 나감 (당연하다. 뒤로 가 있으니까)
--
-- ── 인덱스 ─────────────────────────────────────────────────────────
-- student_classes 의 기본키가 (student_id, class_id) 다. 학생으로 찾을
-- 때는 빠르지만 **학급으로 찾을 때는 쓸 수 없다.** 참여 상태 조회는
-- 학급으로 찾는다. 지금은 학생이 적어 티가 안 나지만 3만 명이 되면
-- 학급 조회마다 전체를 훑는다.

CREATE INDEX IF NOT EXISTS student_classes_class_idx
  ON public.student_classes(class_id);
-- 교사 학급 조회도 같은 이유로.
CREATE INDEX IF NOT EXISTS teacher_classes_class_idx
  ON public.teacher_classes(class_id);
-- ── 조회 — 마지막 상태를 존중한다 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_class_presence(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid  uuid := (select auth.uid());
  v_role text;
  v_sid  uuid;
  v_rows jsonb;
  v_sum  jsonb;
  -- 150초 간격 + 흔들기(최대 172초) + 네트워크 지연. 210초면 넉넉하다.
  v_stale interval := interval '210 seconds';
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin','school_admin')
     AND NOT EXISTS (SELECT 1 FROM teacher_classes
                      WHERE class_id = p_class_id AND teacher_id = v_uid) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT id INTO v_sid FROM class_sessions
   WHERE class_id = p_class_id AND ended_at IS NULL LIMIT 1;
  IF v_sid IS NULL THEN RETURN jsonb_build_object('session', NULL); END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x.rank, x.display_name), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT p.id AS student_id, p.display_name,
             cp.last_seen,
             coalesce(cp.away_count, 0) AS away_count,
             CASE
               -- 한 번도 신호가 없었다 — 앱을 아직 안 열었다.
               WHEN cp.last_seen IS NULL THEN 'offline'
               -- 소식이 끊겼다. 마지막에 무엇이었는지가 갈림길이다.
               WHEN cp.last_seen < now() - v_stale
                 THEN CASE WHEN cp.state = 'away' THEN 'away' ELSE 'lost' END
               ELSE cp.state
             END AS shown,
             CASE
               WHEN cp.last_seen IS NULL THEN 3
               WHEN cp.last_seen < now() - v_stale
                 THEN CASE WHEN cp.state = 'away' THEN 1 ELSE 2 END
               WHEN cp.state = 'away' THEN 1
               ELSE 0
             END AS rank
        FROM student_classes sc
        JOIN profiles p ON p.id = sc.student_id
        LEFT JOIN class_presence cp ON cp.session_id = v_sid AND cp.user_id = p.id
       WHERE sc.class_id = p_class_id
    ) x;

  SELECT jsonb_build_object(
           'total',   count(*),
           'active',  count(*) FILTER (WHERE e->>'shown' = 'active'),
           'away',    count(*) FILTER (WHERE e->>'shown' = 'away'),
           'lost',    count(*) FILTER (WHERE e->>'shown' = 'lost'),
           'offline', count(*) FILTER (WHERE e->>'shown' = 'offline'))
    INTO v_sum FROM jsonb_array_elements(v_rows) e;

  RETURN jsonb_build_object('session', v_sid, 'students', v_rows, 'summary', v_sum, 'at', now());
END; $fn$;
-- ── 신호 — 값이 안 바뀌면 쓰지 않는다 ──────────────────────────────
-- 같은 상태로 들어온 keepalive 는 last_seen 만 갱신하면 된다. 그래도
-- UPDATE 는 UPDATE 라 새 행 버전이 생기고 autovacuum 이 따라와야 한다.
-- 30초 안에 또 들어온 같은 상태의 신호는 그냥 버린다 — 시계는 이미
-- 충분히 최신이고, 버리는 편이 싸다.
CREATE OR REPLACE FUNCTION public.rpc_presence_ping(p_session_id uuid, p_state text DEFAULT 'active')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid  uuid := (select auth.uid());
  v_prev text;
  v_seen timestamptz;
BEGIN
  IF p_state NOT IN ('active','away') THEN RETURN jsonb_build_object('error','bad_state'); END IF;

  IF NOT EXISTS (SELECT 1 FROM class_sessions s
                   JOIN student_classes sc ON sc.class_id = s.class_id
                  WHERE s.id = p_session_id AND s.ended_at IS NULL AND sc.student_id = v_uid) THEN
    RETURN jsonb_build_object('error','no_session');
  END IF;

  SELECT state, last_seen INTO v_prev, v_seen
    FROM class_presence WHERE session_id = p_session_id AND user_id = v_uid;

  -- 상태가 그대로이고 방금 찍었으면 아무것도 안 한다.
  IF v_prev = p_state AND v_seen > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  INSERT INTO class_presence(session_id, user_id, state, last_seen, away_count, away_since)
  VALUES (p_session_id, v_uid, p_state, now(),
          CASE WHEN p_state = 'away' THEN 1 ELSE 0 END,
          CASE WHEN p_state = 'away' THEN now() END)
  ON CONFLICT (session_id, user_id) DO UPDATE SET
    state      = excluded.state,
    last_seen  = now(),
    away_count = class_presence.away_count
                 + CASE WHEN p_state = 'away' AND class_presence.state <> 'away' THEN 1 ELSE 0 END,
    away_since = CASE WHEN p_state = 'away'
                      THEN coalesce(class_presence.away_since, now()) ELSE NULL END;

  RETURN jsonb_build_object('ok', true);
END; $fn$;
-- 자주 갱신되는 작은 테이블이다. 죽은 행이 쌓이면 조회가 느려지므로
-- 기본값(20%)보다 자주 청소하게 한다.
ALTER TABLE public.class_presence SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);
