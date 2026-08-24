-- ============================================================
-- 022: 수업 세션과 참여 상태 — 「지금 실제로 앱을 보고 있나」
-- ============================================================
--
-- ── 무엇을 푸는 문제인가 ───────────────────────────────────────────
-- 교사가 실습을 지시해도 학생이 정말 하고 있는지 알 수 없다. 교실을 한
-- 바퀴 돌면 그 사이 앞자리는 다시 다른 화면으로 간다. 30명을 한 사람이
-- 눈으로 지키는 것은 불가능하다.
--
-- ── 무엇을 보고 무엇을 보지 않는가 ─────────────────────────────────
-- 이건 미성년자 감시 기능이다. 선을 분명히 긋는다.
--
--   본다        우리 앱이 화면 맨 앞에 있는가 (foreground / background)
--               마지막으로 신호를 보낸 시각
--               수업 중 앱을 몇 번 벗어났는가
--
--   보지 않는다  어떤 앱으로 갔는지 · 무엇을 보는지 · 위치 · 화면 내용
--               (브라우저·OS 가 알려 주지도 않고, 알려 줘도 받지 않는다)
--
-- ── 항상 켜 두지 않는다 ────────────────────────────────────────────
-- **교사가 수업 세션을 연 동안, 그 학급만** 신호를 보낸다. 세션이 닫히면
-- 즉시 멈춘다. 집에서 자습하는 학생은 아무 신호도 보내지 않는다.
-- 학생 화면에는 수업 중임을 알리는 띠가 뜬다 — 모르게 보지 않는다.
--
-- ── 비용 ───────────────────────────────────────────────────────────
-- 45초에 한 번, 학생당 1행 갱신. 30명 학급이면 초당 0.67회.
-- 한 학교 30학급이 동시에 수업해도 초당 20회 — Micro 로 충분하다.
-- 실시간 구독(WebSocket)을 쓰지 않는 이유가 여기 있다. 3만 명 동시 연결은
-- 요금제 쿼터를 넘지만, 45초 간격 작은 UPDATE 는 넘지 않는다.

-- ── 수업 세션 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 한 학급에 열린 세션은 하나뿐이다. 두 개가 열리면 학생이 어느 쪽에
-- 보고해야 하는지 알 수 없다.
CREATE UNIQUE INDEX IF NOT EXISTS class_sessions_one_open
  ON public.class_sessions(class_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS class_sessions_teacher_idx
  ON public.class_sessions(teacher_id, started_at DESC);
-- ── 참여 상태 ──────────────────────────────────────────────────────
-- 학생 1명 = 1행. 기록을 쌓지 않는다 — 수업이 끝난 뒤까지 남길 이유가 없다.
CREATE TABLE IF NOT EXISTS public.class_presence (
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state      text NOT NULL DEFAULT 'active',   -- active | away
  last_seen  timestamptz NOT NULL DEFAULT now(),
  away_count int NOT NULL DEFAULT 0,           -- 수업 중 앱을 벗어난 횟수
  away_since timestamptz,
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_presence ENABLE ROW LEVEL SECURITY;
-- 학생은 자기 학급의 열린 세션을 읽을 수 있어야 한다. 그래야 수업 중임을
-- 알고 신호를 보낸다.
DROP POLICY IF EXISTS cs_read ON public.class_sessions;
CREATE POLICY cs_read ON public.class_sessions FOR SELECT USING (
  teacher_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM student_classes sc
              WHERE sc.class_id = class_sessions.class_id
                AND sc.student_id = (select auth.uid()))
);
-- 참여 상태는 본인 것과 담당 교사만.
DROP POLICY IF EXISTS cp_read ON public.class_presence;
CREATE POLICY cp_read ON public.class_presence FOR SELECT USING (
  user_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM class_sessions s
              WHERE s.id = class_presence.session_id AND s.teacher_id = (select auth.uid()))
);
-- ── 교사: 수업 시작 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_start_class_session(p_class_id uuid, p_title text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid  uuid := (select auth.uid());
  v_role text;
  v_id   uuid;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher','school_admin','admin') THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  IF v_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM teacher_classes WHERE class_id = p_class_id AND teacher_id = v_uid) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  -- 이미 열려 있으면 그것을 돌려준다. 새로 만들면 유니크 인덱스에 걸린다.
  SELECT id INTO v_id FROM class_sessions
   WHERE class_id = p_class_id AND ended_at IS NULL LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO class_sessions(class_id, teacher_id, title)
    VALUES (p_class_id, v_uid, p_title) RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('session_id', v_id);
END; $fn$;
-- ── 교사: 수업 종료 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_end_class_session(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_n   int;
BEGIN
  UPDATE class_sessions SET ended_at = now()
   WHERE class_id = p_class_id AND ended_at IS NULL
     AND (teacher_id = v_uid
          OR (SELECT role FROM profiles WHERE id = v_uid) IN ('admin','school_admin'));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ended', v_n);
END; $fn$;
-- ── 학생: 지금 수업 중인가 ─────────────────────────────────────────
-- 앱을 열 때와 동기화할 때 함께 묻는다. 이것만 따로 자주 부르지 않는다.
CREATE OR REPLACE FUNCTION public.rpc_my_class_session()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_out jsonb;
BEGIN
  SELECT jsonb_build_object('session_id', s.id, 'class_id', s.class_id,
                            'title', s.title, 'started_at', s.started_at)
    INTO v_out
    FROM class_sessions s
    JOIN student_classes sc ON sc.class_id = s.class_id
   WHERE sc.student_id = (select auth.uid()) AND s.ended_at IS NULL
   ORDER BY s.started_at DESC LIMIT 1;
  RETURN coalesce(v_out, '{}'::jsonb);
END; $fn$;
-- ── 학생: 신호 보내기 ──────────────────────────────────────────────
-- p_state 는 'active' 또는 'away' 뿐이다. 어디로 갔는지는 받지 않는다.
CREATE OR REPLACE FUNCTION public.rpc_presence_ping(p_session_id uuid, p_state text DEFAULT 'active')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_uid uuid := (select auth.uid());
BEGIN
  IF p_state NOT IN ('active','away') THEN RETURN jsonb_build_object('error','bad_state'); END IF;

  -- 자기 학급의 열린 세션에만 보고할 수 있다.
  IF NOT EXISTS (SELECT 1 FROM class_sessions s
                   JOIN student_classes sc ON sc.class_id = s.class_id
                  WHERE s.id = p_session_id AND s.ended_at IS NULL AND sc.student_id = v_uid) THEN
    RETURN jsonb_build_object('error','no_session');
  END IF;

  INSERT INTO class_presence(session_id, user_id, state, last_seen, away_count, away_since)
  VALUES (p_session_id, v_uid, p_state, now(),
          CASE WHEN p_state = 'away' THEN 1 ELSE 0 END,
          CASE WHEN p_state = 'away' THEN now() END)
  ON CONFLICT (session_id, user_id) DO UPDATE SET
    state      = excluded.state,
    last_seen  = now(),
    -- active 에서 away 로 바뀌는 순간에만 센다. away 가 이어지는 동안은 아니다.
    away_count = class_presence.away_count
                 + CASE WHEN p_state = 'away' AND class_presence.state <> 'away' THEN 1 ELSE 0 END,
    away_since = CASE WHEN p_state = 'away'
                      THEN coalesce(class_presence.away_since, now()) ELSE NULL END;

  RETURN jsonb_build_object('ok', true);
END; $fn$;
-- ── 교사: 참여 상태 보기 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_class_presence(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid  uuid := (select auth.uid());
  v_role text;
  v_sid  uuid;
  v_rows jsonb;
  v_sum  jsonb;
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
             -- 45초마다 신호가 온다. 100초가 넘으면 앱이 꺼졌거나 신호가
             -- 끊긴 것으로 본다.
             CASE WHEN cp.last_seen IS NULL THEN 'offline'
                  WHEN cp.last_seen < now() - interval '100 seconds' THEN 'lost'
                  ELSE cp.state END AS shown,
             CASE WHEN cp.last_seen IS NULL THEN 3
                  WHEN cp.last_seen < now() - interval '100 seconds' THEN 2
                  WHEN cp.state = 'away' THEN 1 ELSE 0 END AS rank
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
GRANT EXECUTE ON FUNCTION public.rpc_start_class_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_end_class_session(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_my_class_session()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_presence_ping(uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_class_presence(uuid)            TO authenticated;
