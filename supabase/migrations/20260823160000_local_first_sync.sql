-- ============================================================
-- 018: 로컬 우선 구조를 위한 두 개의 관문
-- ============================================================
--
-- ── 왜 ─────────────────────────────────────────────────────────────
-- 문항·시험지는 이미 앱 안에 있다. 서버를 치는 것은 **사용자 상태**뿐인데,
-- 그게 화면을 열 때마다 6번, 세트를 채점할 때마다 2번씩 나간다.
--
-- 동시 30,000명이면 초당 3,200요청. Micro(2코어 버스트·1GB)로는 불가능하고
-- 4XL(월 $960)이 필요하다. 그런데 이 요청들은 **몇 분 늦어도 아무 문제가
-- 없는 것들**이다. 스트릭이 5분 전 값이어도 학생은 모른다.
--
-- 그래서 관문을 둘로 줄인다.
--   rpc_bootstrap      앱을 열 때 한 번. 홈에 필요한 전부를 한 번에.
--   rpc_sync_progress  쌓아 둔 학습 기록을 주기적으로 한 번에.
--
-- 초당 3,200요청 → 200요청(5분 주기). 등급을 올리지 않고도 감당한다.
--
-- ── 위변조 ─────────────────────────────────────────────────────────
-- 로컬에서 계산한 값을 그대로 믿으면 학생이 XP·스트릭을 조작할 수 있다.
-- 랭킹에 쓰이는 값이라 그냥 둘 수 없다.
--
-- 그래서 클라이언트는 **근거만** 보낸다 — 맞힌 문항 수, 활동 종류.
-- XP 는 서버가 계산하고(rpc_add_xp), 스트릭도 서버가 날짜를 보고 정한다.
-- 보낸 값을 그대로 저장하는 곳은 간격반복 스케줄(개인 학습용, 남과 비교하지
-- 않는 값)뿐이다.

-- ── ① 앱 시작 한 방 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := (select auth.uid());
  v_profile   jsonb;
  v_classes   uuid[];
  v_streak    jsonb;
  v_xp        jsonb;
  v_missions  jsonb;
  v_due       int;
  v_wrong     int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'anon'); END IF;

  SELECT to_jsonb(p) INTO v_profile
    FROM (SELECT id, display_name, role, school_id, approved
            FROM profiles WHERE id = v_uid) p;

  SELECT coalesce(array_agg(class_id), '{}') INTO v_classes
    FROM student_classes WHERE student_id = v_uid;

  SELECT to_jsonb(s) INTO v_streak
    FROM (SELECT current_streak, longest_streak, last_active_date, total_days
            FROM user_streaks WHERE user_id = v_uid) s;

  SELECT to_jsonb(x) INTO v_xp
    FROM (SELECT total_xp, weekly_xp, level FROM user_xp WHERE user_id = v_uid) x;

  -- 미션은 교사가 낸 것이라 신선해야 한다. 다만 목록만 가볍게 준다.
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC), '[]'::jsonb)
    INTO v_missions
    FROM (SELECT ms.id, ms.title, ms.mission_type, ms.status, ms.question_count,
                 ms.time_limit_min, ms.due_at, ms.class_id, ms.created_at,
                 (sb.mission_id IS NOT NULL) AS submitted, sb.score, sb.total_questions
            FROM missions ms
            LEFT JOIN submissions sb
              ON sb.mission_id = ms.id AND sb.student_id = v_uid
           WHERE ms.class_id = ANY(v_classes)
             AND ms.status IN ('active', 'closed')
           ORDER BY ms.created_at DESC
           LIMIT 30) m;

  -- 오늘 복습할 개수·미해결 오답 개수는 배지에만 쓴다. 목록은 앱이 갖고 있다.
  SELECT count(*) INTO v_due FROM review_schedule
   WHERE user_id = v_uid AND due_at <= now();
  SELECT count(*) INTO v_wrong FROM wrong_answers
   WHERE student_id = v_uid AND status = 'open';

  RETURN jsonb_build_object(
    'profile',   coalesce(v_profile, 'null'::jsonb),
    'class_ids', to_jsonb(v_classes),
    'streak',    coalesce(v_streak, jsonb_build_object('current_streak', 0, 'longest_streak', 0, 'total_days', 0)),
    'xp',        coalesce(v_xp, jsonb_build_object('total_xp', 0, 'weekly_xp', 0, 'level', 1)),
    'missions',  v_missions,
    'due_count',   v_due,
    'wrong_count', v_wrong,
    'server_time', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_bootstrap() TO authenticated;
-- ── ② 모아 둔 학습 기록 한 방 ──────────────────────────────────────
--
-- p_payload 형태:
--   {
--     "reviews":  [{item_id, subject, unit_id, ease, interval_days, reps, due_at, updated_at}, ...],
--     "wrong":    [{question_id, course_id, question_text, correct_answer, user_answer}, ...],
--     "resolved": ["문항id", ...],
--     "activity": {"study": 1, "quiz": 1, "mission": 0},
--     "correct":  12          -- 맞힌 문항 수(XP 근거). 서버가 XP 를 계산한다.
--   }
CREATE OR REPLACE FUNCTION public.rpc_sync_progress(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (select auth.uid());
  v_n_rev   int := 0;
  v_n_wrong int := 0;
  v_n_res   int := 0;
  v_xp      jsonb := NULL;
  v_correct int := greatest(0, least(500, coalesce((p_payload->>'correct')::int, 0)));
  r         jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'anon'); END IF;

  -- 간격반복 스케줄 — 문항별 last-write-wins. 기기 두 대를 함께 써도
  -- 나중에 푼 쪽이 이긴다(updated_at 비교).
  IF jsonb_typeof(p_payload->'reviews') = 'array' THEN
    INSERT INTO review_schedule
      (user_id, subject, unit_id, item_id, ease, interval_days, reps, due_at, updated_at)
    SELECT v_uid,
           coalesce(e->>'subject', 'unknown'),
           coalesce(e->>'unit_id', ''),
           e->>'item_id',
           coalesce((e->>'ease')::real, 2.5),
           coalesce((e->>'interval_days')::int, 0),
           coalesce((e->>'reps')::int, 0),
           coalesce((e->>'due_at')::timestamptz, now()),
           coalesce((e->>'updated_at')::timestamptz, now())
      FROM jsonb_array_elements(p_payload->'reviews') e
     WHERE e->>'item_id' IS NOT NULL
    ON CONFLICT (user_id, item_id) DO UPDATE SET
      subject       = EXCLUDED.subject,
      unit_id       = EXCLUDED.unit_id,
      ease          = EXCLUDED.ease,
      interval_days = EXCLUDED.interval_days,
      reps          = EXCLUDED.reps,
      due_at        = EXCLUDED.due_at,
      updated_at    = EXCLUDED.updated_at
     WHERE review_schedule.updated_at <= EXCLUDED.updated_at;
    GET DIAGNOSTICS v_n_rev = ROW_COUNT;
  END IF;

  -- 오답 — 기존 RPC 를 그대로 쓴다(빈도·연속정답 규칙이 그 안에 있다).
  IF jsonb_typeof(p_payload->'wrong') = 'array' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_payload->'wrong') LOOP
      PERFORM rpc_save_wrong_answer(
        r->>'question_id',
        coalesce((r->>'course_id')::int, 0),
        coalesce(r->>'question_text', ''),
        coalesce(r->>'correct_answer', ''),
        r->>'user_answer');
      v_n_wrong := v_n_wrong + 1;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_payload->'resolved') = 'array' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_payload->'resolved') LOOP
      PERFORM rpc_resolve_wrong_answer(r #>> '{}');
      v_n_res := v_n_res + 1;
    END LOOP;
  END IF;

  -- 활동 기록·스트릭 — 날짜 판단은 서버가 한다(기기 시계를 믿지 않는다).
  IF (p_payload->'activity'->>'study')::int   > 0 THEN PERFORM rpc_record_activity('study');   END IF;
  IF (p_payload->'activity'->>'quiz')::int    > 0 THEN PERFORM rpc_record_activity('quiz');    END IF;
  IF (p_payload->'activity'->>'mission')::int > 0 THEN PERFORM rpc_record_activity('mission'); END IF;

  -- XP 는 서버가 계산한다. 클라이언트가 준 것은 '맞힌 개수'뿐이고,
  -- 한 번에 인정하는 상한을 둔다(위 v_correct 의 least(500, ...)).
  IF v_correct > 0 THEN
    v_xp := rpc_add_xp(v_correct * 10, 'sync');
  END IF;

  RETURN jsonb_build_object(
    'reviews', v_n_rev, 'wrong', v_n_wrong, 'resolved', v_n_res,
    'xp', coalesce(v_xp, 'null'::jsonb), 'server_time', now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_sync_progress(jsonb) TO authenticated;
