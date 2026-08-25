-- 자기소개서를 지원처 이름이 아닌 실제 지원 건 단위로 묶는다.
-- 기존 행은 그대로 조회하고, 새 앱에서 제출한 행부터 application_key를 사용한다.

ALTER TABLE public.cover_letter_submissions
  ADD COLUMN IF NOT EXISTS application_key text,
  ADD COLUMN IF NOT EXISTS recruitment_title text,
  ADD COLUMN IF NOT EXISTS application_deadline date;

CREATE INDEX IF NOT EXISTS cover_letter_application_version_idx
  ON public.cover_letter_submissions(student_id, application_key, revision_no DESC);

CREATE OR REPLACE FUNCTION public.rpc_submit_cover_letter(
  p_sector          text,
  p_organization_id text,
  p_target_name     text,
  p_role            text,
  p_draft           jsonb,
  p_generated_text  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid               uuid := (select auth.uid());
  v_role               text;
  v_school             uuid;
  v_class              uuid;
  v_revision           integer;
  v_id                 uuid;
  v_application_key    text := nullif(btrim(p_draft->>'applicationProjectId'), '');
  v_recruitment_title  text := nullif(btrim(p_draft->>'recruitmentTitle'), '');
  v_deadline           date;
BEGIN
  SELECT role::text, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role <> 'student' THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  SELECT class_id INTO v_class
    FROM student_classes
   WHERE student_id = v_uid
   ORDER BY joined_at DESC
   LIMIT 1;
  IF v_class IS NULL THEN RETURN jsonb_build_object('error', 'no_class'); END IF;

  IF p_sector NOT IN ('finance', 'public', 'enterprise')
     OR length(btrim(coalesce(p_target_name, ''))) < 2
     OR length(btrim(coalesce(p_role, ''))) < 2
     OR jsonb_typeof(p_draft) <> 'object'
     OR length(btrim(coalesce(p_generated_text, ''))) < 120 THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  BEGIN
    v_deadline := nullif(btrim(p_draft->>'applicationDeadline'), '')::date;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_deadline := NULL;
  END;

  SELECT coalesce(max(revision_no), 0) + 1 INTO v_revision
    FROM cover_letter_submissions
   WHERE student_id = v_uid
     AND (
       (v_application_key IS NOT NULL AND application_key = v_application_key)
       OR (v_application_key IS NULL AND application_key IS NULL
           AND target_name = btrim(p_target_name) AND role_name = btrim(p_role))
     );

  INSERT INTO cover_letter_submissions(
    student_id, class_id, school_id, sector, organization_id,
    target_name, role_name, draft, generated_text, revision_no,
    application_key, recruitment_title, application_deadline
  ) VALUES (
    v_uid, v_class, v_school, p_sector, nullif(btrim(p_organization_id), ''),
    btrim(p_target_name), btrim(p_role), p_draft, p_generated_text, v_revision,
    v_application_key, coalesce(v_recruitment_title, btrim(p_target_name) || ' 채용'), v_deadline
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'revision_no', v_revision, 'application_key', v_application_key);
END;
$$;

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
             s.application_key, s.recruitment_title, s.application_deadline,
             f.summary AS feedback_summary, f.section_feedback, f.decision
        FROM cover_letter_submissions s
        LEFT JOIN cover_letter_feedback f ON f.submission_id = s.id
       WHERE s.student_id = (select auth.uid())
       ORDER BY s.created_at DESC
       LIMIT 100
    ) x;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_teacher_cover_letters(
  p_class_id uuid DEFAULT NULL,
  p_limit    integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := (select auth.uid());
  v_role   text;
  v_school uuid;
  v_out    jsonb;
BEGIN
  SELECT role::text, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher', 'school_admin', 'admin') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_out
    FROM (
      SELECT s.id, s.student_id, p.display_name AS student_name,
             s.class_id, c.name AS class_name, s.sector, s.organization_id,
             s.target_name, s.role_name, s.draft, s.generated_text,
             s.revision_no, s.status, s.created_at, s.reviewed_at,
             s.application_key, s.recruitment_title, s.application_deadline,
             f.summary AS feedback_summary, f.section_feedback, f.decision
        FROM cover_letter_submissions s
        JOIN profiles p ON p.id = s.student_id
        JOIN classes c ON c.id = s.class_id
        LEFT JOIN cover_letter_feedback f ON f.submission_id = s.id
       WHERE (p_class_id IS NULL OR s.class_id = p_class_id)
         AND (
           v_role = 'admin'
           OR (v_role = 'school_admin' AND s.school_id = v_school)
           OR EXISTS (SELECT 1 FROM teacher_classes tc
                       WHERE tc.teacher_id = v_uid AND tc.class_id = s.class_id)
         )
       ORDER BY s.created_at DESC
       LIMIT least(greatest(p_limit, 1), 300)
    ) x;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_my_cover_letters() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_my_cover_letters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) TO authenticated;
