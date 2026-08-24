-- 자기소개서 제출·교사 첨삭
-- 학생 초안은 버전별로 보존하고, 교사는 담당 학급 제출만 조회·첨삭한다.

CREATE TABLE IF NOT EXISTS public.cover_letter_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id         uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id        uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  sector           text NOT NULL CHECK (sector IN ('finance', 'public', 'enterprise')),
  organization_id  text,
  target_name      text NOT NULL,
  role_name        text NOT NULL,
  draft            jsonb NOT NULL,
  generated_text   text NOT NULL,
  revision_no      integer NOT NULL DEFAULT 1 CHECK (revision_no > 0),
  status           text NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted', 'in_review', 'revision_requested', 'approved')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.cover_letter_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid NOT NULL UNIQUE REFERENCES public.cover_letter_submissions(id) ON DELETE CASCADE,
  teacher_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary           text NOT NULL,
  section_feedback  jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision          text NOT NULL CHECK (decision IN ('revision_requested', 'approved')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cover_letter_student_idx
  ON public.cover_letter_submissions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cover_letter_class_status_idx
  ON public.cover_letter_submissions(class_id, status, created_at DESC);

ALTER TABLE public.cover_letter_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letter_feedback ENABLE ROW LEVEL SECURITY;

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
  v_uid      uuid := (select auth.uid());
  v_role     text;
  v_school   uuid;
  v_class    uuid;
  v_revision integer;
  v_id       uuid;
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

  SELECT coalesce(max(revision_no), 0) + 1 INTO v_revision
    FROM cover_letter_submissions
   WHERE student_id = v_uid
     AND target_name = btrim(p_target_name)
     AND role_name = btrim(p_role);

  INSERT INTO cover_letter_submissions(
    student_id, class_id, school_id, sector, organization_id,
    target_name, role_name, draft, generated_text, revision_no
  ) VALUES (
    v_uid, v_class, v_school, p_sector, nullif(btrim(p_organization_id), ''),
    btrim(p_target_name), btrim(p_role), p_draft, p_generated_text, v_revision
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'revision_no', v_revision);
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
             s.status, s.created_at, s.reviewed_at,
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
  v_uid      uuid := (select auth.uid());
  v_role     text;
  v_school   uuid;
  v_student  uuid;
  v_target   text;
BEGIN
  SELECT role::text, school_id INTO v_role, v_school FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('teacher', 'school_admin', 'admin')
     OR p_decision NOT IN ('revision_requested', 'approved')
     OR length(btrim(coalesce(p_summary, ''))) < 10
     OR jsonb_typeof(coalesce(p_section_feedback, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  SELECT s.student_id, s.target_name INTO v_student, v_target
    FROM cover_letter_submissions s
   WHERE s.id = p_submission_id
     AND (
       v_role = 'admin'
       OR (v_role = 'school_admin' AND s.school_id = v_school)
       OR EXISTS (SELECT 1 FROM teacher_classes tc
                   WHERE tc.teacher_id = v_uid AND tc.class_id = s.class_id)
     );
  IF v_student IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

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
    CASE WHEN p_decision = 'approved' THEN '자기소개서 첨삭이 완료됐어요' ELSE '자기소개서 수정 조언이 도착했어요' END,
    v_target || ' 자기소개서: ' || left(btrim(p_summary), 180),
    'notice', 'personal', NULL
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_my_cover_letters() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_my_cover_letters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) TO authenticated;
