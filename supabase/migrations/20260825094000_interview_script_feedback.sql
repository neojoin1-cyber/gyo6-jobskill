-- 자기소개서와 면접 답변은 같은 첨삭 테이블을 사용하되 학생 알림에서 문서 종류를 구분한다.
CREATE OR REPLACE FUNCTION public.rpc_my_cover_letters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_out jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_out
    FROM (
      SELECT s.id, s.target_name, s.role_name, s.sector, s.revision_no,
             s.status, s.created_at, s.reviewed_at, s.draft,
             f.summary AS feedback_summary,
             f.section_feedback, f.decision
        FROM cover_letter_submissions s
        LEFT JOIN cover_letter_feedback f ON f.submission_id = s.id
       WHERE s.student_id = (select auth.uid())
       ORDER BY s.created_at DESC
       LIMIT 30
    ) x;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_review_cover_letter(
  p_submission_id    uuid,
  p_summary          text,
  p_section_feedback jsonb,
  p_decision         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := (select auth.uid());
  v_role          text;
  v_school        uuid;
  v_student       uuid;
  v_target        text;
  v_document_type text;
  v_document_name text;
BEGIN
  SELECT role::text, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher', 'school_admin', 'admin')
     OR p_decision NOT IN ('revision_requested', 'approved')
     OR length(btrim(coalesce(p_summary, ''))) < 10
     OR jsonb_typeof(coalesce(p_section_feedback, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  SELECT s.student_id, s.target_name, coalesce(s.draft->>'documentType', 'cover-letter')
    INTO v_student, v_target, v_document_type
    FROM cover_letter_submissions s
   WHERE s.id = p_submission_id
     AND (
       v_role = 'admin'
       OR (v_role = 'school_admin' AND s.school_id = v_school)
       OR EXISTS (SELECT 1 FROM teacher_classes tc
                   WHERE tc.teacher_id = v_uid AND tc.class_id = s.class_id)
     );
  IF v_student IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  v_document_name := CASE WHEN v_document_type = 'interview-script' THEN '면접 답변' ELSE '자기소개서' END;

  INSERT INTO cover_letter_feedback(submission_id, teacher_id, summary, section_feedback, decision)
  VALUES (p_submission_id, v_uid, btrim(p_summary), coalesce(p_section_feedback, '{}'::jsonb), p_decision)
  ON CONFLICT (submission_id) DO UPDATE SET
    teacher_id = excluded.teacher_id,
    summary = excluded.summary,
    section_feedback = excluded.section_feedback,
    decision = excluded.decision,
    updated_at = now();

  UPDATE cover_letter_submissions
     SET status = p_decision, reviewed_at = now()
   WHERE id = p_submission_id;

  INSERT INTO notifications(user_id, sender_id, title, body, type, scope, scope_id)
  VALUES (
    v_student, v_uid,
    CASE WHEN p_decision = 'approved' THEN v_document_name || ' 첨삭이 완료됐어요' ELSE v_document_name || ' 수정 조언이 도착했어요' END,
    v_target || ' ' || v_document_name || ': ' || left(btrim(p_summary), 180),
    'notice', 'personal', NULL
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_my_cover_letters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_my_cover_letters() TO authenticated;
