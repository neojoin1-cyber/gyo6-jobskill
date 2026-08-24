-- rpc_sync_progress 가 갱신된 스트릭도 함께 돌려준다.
--
-- 활동을 마친 직후 화면은 스트릭을 새로 보여 줘야 한다. 그때마다
-- user_streaks 를 따로 조회하면 동기화 1회 + 조회 1회가 된다. 어차피
-- 이 함수가 방금 스트릭을 갱신했으니 결과를 같이 돌려주면 왕복이 하나 준다.
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
  v_streak  jsonb := NULL;
  v_correct int := greatest(0, least(500, coalesce((p_payload->>'correct')::int, 0)));
  r         jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'anon'); END IF;

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
      subject = EXCLUDED.subject, unit_id = EXCLUDED.unit_id,
      ease = EXCLUDED.ease, interval_days = EXCLUDED.interval_days,
      reps = EXCLUDED.reps, due_at = EXCLUDED.due_at, updated_at = EXCLUDED.updated_at
     WHERE review_schedule.updated_at <= EXCLUDED.updated_at;
    GET DIAGNOSTICS v_n_rev = ROW_COUNT;
  END IF;

  IF jsonb_typeof(p_payload->'wrong') = 'array' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_payload->'wrong') LOOP
      PERFORM rpc_save_wrong_answer(
        r->>'question_id', coalesce((r->>'course_id')::int, 0),
        coalesce(r->>'question_text', ''), coalesce(r->>'correct_answer', ''),
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

  IF (p_payload->'activity'->>'study')::int   > 0 THEN PERFORM rpc_record_activity('study');   END IF;
  IF (p_payload->'activity'->>'quiz')::int    > 0 THEN PERFORM rpc_record_activity('quiz');    END IF;
  IF (p_payload->'activity'->>'mission')::int > 0 THEN PERFORM rpc_record_activity('mission'); END IF;

  IF v_correct > 0 THEN
    v_xp := rpc_add_xp(v_correct * 10, 'sync');
  END IF;

  SELECT to_jsonb(s) INTO v_streak
    FROM (SELECT current_streak, longest_streak, last_active_date, total_days
            FROM user_streaks WHERE user_id = v_uid) s;

  RETURN jsonb_build_object(
    'reviews', v_n_rev, 'wrong', v_n_wrong, 'resolved', v_n_res,
    'xp', coalesce(v_xp, 'null'::jsonb),
    'streak', coalesce(v_streak, 'null'::jsonb),
    'server_time', now());
END;
$$;
