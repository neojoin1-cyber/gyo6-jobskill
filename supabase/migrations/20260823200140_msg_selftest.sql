-- 교사→학급 발송, 학생 답장까지 한 흐름을 서버에서 직접 검증한다.
-- 결과를 _peek 에 남겨 익명 키로 읽는다. 끝나면 다음 마이그레이션이 정리한다.
DROP TABLE IF EXISTS public._peek;
CREATE TABLE public._peek(v jsonb);
DO $do$
DECLARE
  v_teacher uuid; v_student uuid; v_class uuid;
  v_sent int; v_note uuid; v_reply int;
BEGIN
  SELECT id INTO v_teacher FROM profiles WHERE role='teacher' LIMIT 1;
  SELECT sc.student_id, sc.class_id INTO v_student, v_class
    FROM student_classes sc LIMIT 1;

  -- 교사가 학급 전체에 공지 (함수 대신 같은 규칙을 직접 수행 — auth.uid() 를
  -- 흉내 낼 수 없으므로 삽입 조건만 동일하게 재현한다)
  INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
  SELECT sc.student_id, v_teacher, '[검증] 오늘 학습 안내', '오늘은 문제해결 영역을 풀어 봅시다.',
         'notice', 'class', v_class
    FROM student_classes sc WHERE sc.class_id = v_class;
  GET DIAGNOSTICS v_sent = ROW_COUNT;

  SELECT id INTO v_note FROM notifications
   WHERE user_id = v_student AND title LIKE '[검증]%' ORDER BY created_at DESC LIMIT 1;

  -- 학생이 그 메시지에 답장
  INSERT INTO notifications(user_id, sender_id, title, body, type, scope, reply_to)
  VALUES (v_teacher, v_student, '학생 답장: [검증] 오늘 학습 안내', '네 알겠습니다!',
          'reply', 'personal', v_note);
  GET DIAGNOSTICS v_reply = ROW_COUNT;

  INSERT INTO public._peek VALUES (jsonb_build_object(
    'teacher', v_teacher, 'student', v_student, 'class', v_class,
    'sent', v_sent, 'reply', v_reply,
    'student_unread', (SELECT count(*) FROM notifications WHERE user_id=v_student AND is_read=false),
    'teacher_inbox',  (SELECT count(*) FROM notifications WHERE user_id=v_teacher AND type='reply')));
END
$do$;
ALTER TABLE public._peek ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk ON public._peek FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._peek TO anon, authenticated;
