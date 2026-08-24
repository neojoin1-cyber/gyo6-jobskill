-- 학생 부트스트랩 미션에 subject_id가 빠지면 MissionScreen이 job-common으로
-- 폴백한다. 교사가 면접·인성검사 미션을 만들었는데 직업공통 문항이 열리는
-- 교차 과목 사고를 막기 위해 과목 식별자를 응답에 포함한다.
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
    FROM (SELECT ms.id, ms.title, ms.subject_id, ms.mission_type, ms.status, ms.question_count,
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
