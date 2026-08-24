-- ① rpc_send_message: 기본 종류를 enum 에 있는 값으로 바로잡고, 넘어온
--    값이 허용 목록 밖이면 조용히 notice 로 떨어뜨린다(호출 쪽 오타 방어).
CREATE OR REPLACE FUNCTION public.rpc_send_message(
  p_scope text, p_target uuid, p_title text, p_body text, p_type text DEFAULT 'notice')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text; v_school uuid; v_n int := 0;
  v_type notification_type;
BEGIN
  SELECT role, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher','school_admin','admin') THEN
    RETURN jsonb_build_object('error','forbidden'); END IF;
  IF coalesce(btrim(p_title),'')='' OR coalesce(btrim(p_body),'')='' THEN
    RETURN jsonb_build_object('error','empty'); END IF;

  v_type := CASE WHEN p_type IN ('notice','encourage','system') THEN p_type::notification_type
                 ELSE 'notice'::notification_type END;

  IF p_scope = 'personal' THEN
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT p_target, v_uid, p_title, p_body, v_type, 'personal', NULL
     WHERE EXISTS (SELECT 1 FROM student_classes sc
                    WHERE sc.student_id = p_target
                      AND (v_role IN ('admin','school_admin')
                           OR EXISTS (SELECT 1 FROM teacher_classes tc
                                       WHERE tc.class_id = sc.class_id AND tc.teacher_id = v_uid)));
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_scope = 'class' THEN
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT sc.student_id, v_uid, p_title, p_body, v_type, 'class', p_target
      FROM student_classes sc
     WHERE sc.class_id = p_target
       AND (v_role IN ('admin','school_admin')
            OR EXISTS (SELECT 1 FROM teacher_classes tc
                        WHERE tc.class_id = p_target AND tc.teacher_id = v_uid));
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_scope = 'school' THEN
    IF v_role NOT IN ('admin','school_admin') THEN
      RETURN jsonb_build_object('error','forbidden'); END IF;
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT p.id, v_uid, p_title, p_body, v_type, 'school', p_target
      FROM profiles p
     WHERE p.school_id = p_target AND p.role = 'student'
       AND (v_role = 'admin' OR p_target = v_school);
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('error','bad_scope');
  END IF;
  RETURN jsonb_build_object('sent', v_n);
END;
$$;
-- ② 안 읽은 메시지 개수를 부트스트랩에 얹는다. 배지 때문에 따로 조회하면
--    요청이 하나 더 는다. 어차피 앱을 열 때 부르는 함수다 — 추가 요청 0회.
CREATE OR REPLACE FUNCTION public.rpc_bootstrap()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_profile jsonb; v_classes uuid[]; v_streak jsonb; v_xp jsonb; v_missions jsonb;
  v_due int; v_wrong int; v_unread int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','anon'); END IF;

  SELECT to_jsonb(p) INTO v_profile
    FROM (SELECT id, display_name, role, school_id, approved FROM profiles WHERE id=v_uid) p;
  SELECT coalesce(array_agg(class_id),'{}') INTO v_classes FROM student_classes WHERE student_id=v_uid;
  SELECT to_jsonb(s) INTO v_streak
    FROM (SELECT current_streak, longest_streak, last_active_date, total_days
            FROM user_streaks WHERE user_id=v_uid) s;
  SELECT to_jsonb(x) INTO v_xp
    FROM (SELECT total_xp, weekly_xp, level FROM user_xp WHERE user_id=v_uid) x;

  SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) INTO v_missions
    FROM (SELECT ms.id, ms.title, ms.mission_type, ms.status, ms.question_count,
                 ms.time_limit_min, ms.due_at, ms.class_id, ms.created_at,
                 ms.question_ids, ms.area_ids, ms.shuffle,
                 jsonb_build_object('name', cl.name) AS classes,
                 sb.score, sb.total_questions, sb.completed_at, sb.grading_status
            FROM missions ms
            LEFT JOIN classes cl ON cl.id = ms.class_id
            LEFT JOIN submissions sb ON sb.mission_id = ms.id AND sb.student_id = v_uid
           WHERE ms.class_id = ANY(v_classes) AND ms.status IN ('active','closed')
           ORDER BY ms.created_at DESC LIMIT 30) m;

  SELECT count(*) INTO v_due    FROM review_schedule WHERE user_id=v_uid AND due_at<=now();
  SELECT count(*) INTO v_wrong  FROM wrong_answers  WHERE student_id=v_uid AND status='open';
  SELECT count(*) INTO v_unread FROM notifications  WHERE user_id=v_uid AND is_read=false;

  RETURN jsonb_build_object(
    'profile', coalesce(v_profile,'null'::jsonb),
    'class_ids', to_jsonb(v_classes),
    'streak', coalesce(v_streak, jsonb_build_object('current_streak',0,'longest_streak',0,'total_days',0)),
    'xp', coalesce(v_xp, jsonb_build_object('total_xp',0,'weekly_xp',0,'level',1)),
    'missions', v_missions,
    'due_count', v_due, 'wrong_count', v_wrong, 'unread_count', v_unread,
    'server_time', now());
END;
$$;
