-- ============================================================
-- 024: 수업 위치 맞추기 — 「선생님이 지금 어디를 보고 있나」
-- ============================================================
--
-- ── 무엇을 푸는 문제인가 ───────────────────────────────────────────
-- 교실 뒷자리에서 투사 화면의 글씨가 안 보인다. 글자를 키우면 한 화면에
-- 들어가는 내용이 줄고, 지문이 긴 문항은 아무리 키워도 뒷자리엔 부족하다.
--
-- 그런데 학생은 **자기 손에 같은 앱**을 들고 있다. 투사 화면이 「지금 어디」
-- 를 알려 주면, 읽는 것은 각자 자기 기기에서 하면 된다. 그러면 투사 화면의
-- 글자 크기는 더 이상 병목이 아니다.
--
-- ── 밀지 않고 당긴다 ───────────────────────────────────────────────
-- 교사 화면이 바뀔 때마다 학생 3만 명에게 밀어 넣으면(push) 그 순간마다
-- 3만 번의 쓰기가 필요하다. 반대로 학생이 계속 물어보게 해도(polling)
-- 마찬가지다.
--
-- 그래서 **교사는 자기 위치를 한 곳에 적어 두고, 학생은 따라가고 싶을 때
-- 한 번 읽는다.**
--
--   교사가 화면을 넘길 때   세션 1행 갱신 (학급당, 몇 초에 한 번)
--   학생이 「따라가기」를 누를 때   1회 조회
--
-- 30학급이 동시에 수업해도 쓰기는 초당 몇 회다. 학생 조회는 누를 때만
-- 생기므로 애초에 몰리지 않는다.
--
-- ── 무엇을 적나 ────────────────────────────────────────────────────
-- 학생 앱이 그 자리로 갈 수 있을 만큼만 적는다. 화면 내용은 적지 않는다.
--   { kind: 'question'|'deck', subject, area, lesson, index, label }
-- label 은 사람이 읽을 한 줄이다 — 「의사소통 국어 · 업무 공지문 · 3/12」.

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS focus       jsonb,
  ADD COLUMN IF NOT EXISTS focus_at    timestamptz;
-- ── 교사: 지금 보는 자리를 적는다 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_set_class_focus(p_session_id uuid, p_focus jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_uid uuid := (select auth.uid()); v_n int;
BEGIN
  -- 세션을 연 교사만. 관리자도 자기가 연 것이 아니면 못 적는다 — 남의
  -- 수업 위치를 바꾸면 그 반 학생 화면이 엉뚱한 곳으로 간다.
  UPDATE class_sessions
     SET focus = p_focus, focus_at = now()
   WHERE id = p_session_id AND ended_at IS NULL AND teacher_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $fn$;
-- ── 학생: 지금 수업 중인가 + 선생님이 어디를 보나 ─────────────────
-- 이미 있던 함수에 focus 를 얹는다. **조회 횟수가 늘지 않는다** —
-- 앱을 열 때 어차피 부르던 것이다.
CREATE OR REPLACE FUNCTION public.rpc_my_class_session()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_out jsonb;
BEGIN
  SELECT jsonb_build_object('session_id', s.id, 'class_id', s.class_id,
                            'title', s.title, 'started_at', s.started_at,
                            'focus', s.focus, 'focus_at', s.focus_at)
    INTO v_out
    FROM class_sessions s
    JOIN student_classes sc ON sc.class_id = s.class_id
   WHERE sc.student_id = (select auth.uid()) AND s.ended_at IS NULL
   ORDER BY s.started_at DESC LIMIT 1;
  RETURN coalesce(v_out, '{}'::jsonb);
END; $fn$;
-- ── 학생: 신호를 보내면서 위치도 함께 받는다 ───────────────────────
-- 참여 신호는 어차피 150초마다 오간다. 그 응답에 위치를 실어 보내면
-- 학생이 따로 물어볼 일이 줄어든다. 요청 수는 그대로다.
CREATE OR REPLACE FUNCTION public.rpc_presence_ping(p_session_id uuid, p_state text DEFAULT 'active')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid   uuid := (select auth.uid());
  v_prev  text;
  v_seen  timestamptz;
  v_focus jsonb;
BEGIN
  IF p_state NOT IN ('active','away') THEN RETURN jsonb_build_object('error','bad_state'); END IF;

  SELECT s.focus INTO v_focus
    FROM class_sessions s
    JOIN student_classes sc ON sc.class_id = s.class_id
   WHERE s.id = p_session_id AND s.ended_at IS NULL AND sc.student_id = v_uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','no_session'); END IF;

  SELECT state, last_seen INTO v_prev, v_seen
    FROM class_presence WHERE session_id = p_session_id AND user_id = v_uid;

  -- 상태가 그대로이고 방금 찍었으면 쓰지 않는다. 위치는 그래도 돌려준다.
  IF v_prev = p_state AND v_seen > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'focus', v_focus);
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

  RETURN jsonb_build_object('ok', true, 'focus', v_focus);
END; $fn$;
GRANT EXECUTE ON FUNCTION public.rpc_set_class_focus(uuid, jsonb) TO authenticated;
