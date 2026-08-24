-- ============================================================
-- 020: 교사↔학생 메시지 (공지·격려·답장)
-- ============================================================
--
-- ── 무엇이 이미 있었나 ─────────────────────────────────────────────
-- notifications 테이블(id·user_id·title·body·type·is_read·created_at)과
-- 학생 알림 화면은 이미 있다. 없는 것은 셋이다.
--   보낸 사람이 누구인지  — sender_id 컬럼이 없어 답장할 대상을 모른다
--   교사의 발송 수단      — 교사 화면에 알림 관련 코드가 한 줄도 없다
--   학생의 답장           — 위 둘이 없으니 애초에 불가능
--
-- ── 안전 ───────────────────────────────────────────────────────────
-- 학생끼리 주고받는 길은 열지 않는다. 학교 앱에서 학생 간 사적 메시지는
-- 학교폭력 경로가 된다. **교사→학생, 학생→담당 교사** 두 방향만 연다.
-- 이건 화면에서 막는 것이 아니라 함수에서 강제한다.
--
-- ── 비용 ───────────────────────────────────────────────────────────
-- 메시지 1건 약 300바이트. 학생 3만 명이 월 20건이면 연 180MB다.
-- 읽지 않은 개수는 rpc_bootstrap 응답에 얹어 보내므로 **추가 요청이 없다**.
-- 실시간 연결은 쓰지 않는다 — 3만 개 동시 연결은 요금제 쿼터를 넘는다.

-- ── 보낸 사람과 답장 실마리 ────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to   uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope      text,      -- 'personal' | 'class' | 'school'
  ADD COLUMN IF NOT EXISTS scope_id   uuid;
-- 학급 id 또는 학교 id

CREATE INDEX IF NOT EXISTS notifications_sender_idx ON public.notifications(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx2
  ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
-- 학생도 자기가 보낸 것을 볼 수 있어야 대화가 이어진다.
DROP POLICY IF EXISTS notif_sender_read ON public.notifications;
CREATE POLICY notif_sender_read ON public.notifications
  FOR SELECT USING (sender_id = (select auth.uid()));
-- ── 교사 → 학생 (개인·학급·학교) ───────────────────────────────────
--
-- p_scope: 'personal'(p_target=학생id) | 'class'(p_target=학급id) | 'school'(p_target=학교id)
CREATE OR REPLACE FUNCTION public.rpc_send_message(
  p_scope  text,
  p_target uuid,
  p_title  text,
  p_body   text,
  p_type   text DEFAULT 'info'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := (select auth.uid());
  v_role  text;
  v_school uuid;
  v_n     int := 0;
BEGIN
  SELECT role, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher', 'school_admin', 'admin') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  IF coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_body), '') = '' THEN
    RETURN jsonb_build_object('error', 'empty');
  END IF;

  IF p_scope = 'personal' THEN
    -- 담당 학급의 학생에게만 보낼 수 있다.
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT p_target, v_uid, p_title, p_body, p_type, 'personal', NULL
     WHERE EXISTS (
       SELECT 1 FROM student_classes sc
        WHERE sc.student_id = p_target
          AND (v_role IN ('admin','school_admin')
               OR EXISTS (SELECT 1 FROM teacher_classes tc
                           WHERE tc.class_id = sc.class_id AND tc.teacher_id = v_uid)));
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSIF p_scope = 'class' THEN
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT sc.student_id, v_uid, p_title, p_body, p_type, 'class', p_target
      FROM student_classes sc
     WHERE sc.class_id = p_target
       AND (v_role IN ('admin','school_admin')
            OR EXISTS (SELECT 1 FROM teacher_classes tc
                        WHERE tc.class_id = p_target AND tc.teacher_id = v_uid));
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSIF p_scope = 'school' THEN
    -- 학교 전체는 학교관리자·관리자만.
    IF v_role NOT IN ('admin', 'school_admin') THEN
      RETURN jsonb_build_object('error', 'forbidden');
    END IF;
    INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
    SELECT p.id, v_uid, p_title, p_body, p_type, 'school', p_target
      FROM profiles p
     WHERE p.school_id = p_target
       AND p.role = 'student'
       AND (v_role = 'admin' OR p_target = v_school);
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSE
    RETURN jsonb_build_object('error', 'bad_scope');
  END IF;

  RETURN jsonb_build_object('sent', v_n);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_send_message(text, uuid, text, text, text) TO authenticated;
-- ── 학생 → 보낸 교사에게 답장 ──────────────────────────────────────
--
-- 아무에게나 못 보낸다. **자기가 받은 메시지에만** 답한다. 그래서 대상이
-- 자동으로 정해지고, 학생끼리 주고받을 길이 생기지 않는다.
CREATE OR REPLACE FUNCTION public.rpc_reply_message(
  p_notification_id uuid,
  p_body            text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := (select auth.uid());
  v_sender uuid;
  v_title  text;
  v_name   text;
BEGIN
  IF coalesce(btrim(p_body), '') = '' THEN RETURN jsonb_build_object('error', 'empty'); END IF;

  SELECT n.sender_id, n.title INTO v_sender, v_title
    FROM notifications n
   WHERE n.id = p_notification_id AND n.user_id = v_uid;

  IF v_sender IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = v_uid;

  INSERT INTO notifications(user_id, sender_id, title, body, type, scope, reply_to)
  VALUES (v_sender, v_uid,
          coalesce(v_name, '학생') || ' 답장: ' || left(coalesce(v_title, ''), 30),
          p_body, 'reply', 'personal', p_notification_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_reply_message(uuid, text) TO authenticated;
-- ── 교사 수신함 ────────────────────────────────────────────────────
--
-- LANGUAGE sql 은 함수를 만들 때 본문을 검사한다. 이 마이그레이션이 방금
-- 추가한 컬럼(reply_to)을 참조하니 그 검사에서 걸렸다. plpgsql 은 본문을
-- 실행할 때 해석하므로 같은 트랜잭션 안에서도 문제가 없다.
CREATE OR REPLACE FUNCTION public.rpc_teacher_inbox(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_out jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_out
    FROM (SELECT n.id, n.title, n.body, n.is_read, n.created_at, n.reply_to,
                 p.display_name AS from_name
            FROM notifications n
            LEFT JOIN profiles p ON p.id = n.sender_id
           WHERE n.user_id = (select auth.uid())
             AND n.type = 'reply'
           ORDER BY n.created_at DESC
           LIMIT least(p_limit, 200)) x;
  RETURN v_out;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_inbox(int) TO authenticated;
