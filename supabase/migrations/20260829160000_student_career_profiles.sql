-- 학년별 취업 준비 프로필과 교사 지도 이력.
-- 학생 원본은 학생 본인만 수정하고, 담당 교사는 RPC로 필요한 요약만 조회한다.

ALTER TABLE public.cover_letter_evidence
  ADD COLUMN IF NOT EXISTS school_grade smallint CHECK (school_grade BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS occurred_period text NOT NULL DEFAULT '' CHECK (char_length(occurred_period) <= 80),
  ADD COLUMN IF NOT EXISTS career_source_id text NOT NULL DEFAULT '' CHECK (char_length(career_source_id) <= 120),
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS public.student_career_profiles (
  student_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_data     jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_score  integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  evidence_count   integer NOT NULL DEFAULT 0 CHECK (evidence_count BETWEEN 0 AND 10000),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_career_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id     uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  note         text NOT NULL CHECK (char_length(note) BETWEEN 5 AND 1200),
  next_action  text NOT NULL CHECK (char_length(next_action) BETWEEN 2 AND 300),
  review_on    date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_career_profiles_updated_idx
  ON public.student_career_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS student_career_feedback_student_idx
  ON public.student_career_feedback(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_career_feedback_class_idx
  ON public.student_career_feedback(class_id, created_at DESC);

ALTER TABLE public.student_career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_profile_owner_read ON public.student_career_profiles;
CREATE POLICY career_profile_owner_read ON public.student_career_profiles
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS career_feedback_student_read ON public.student_career_feedback;
CREATE POLICY career_feedback_student_read ON public.student_career_feedback
  FOR SELECT TO authenticated USING (student_id = auth.uid());

REVOKE ALL ON public.student_career_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_career_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_career_profiles TO authenticated;
GRANT SELECT ON public.student_career_feedback TO authenticated;
GRANT ALL ON public.student_career_profiles, public.student_career_feedback TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_upsert_my_career_profile(
  p_profile jsonb,
  p_readiness_score integer DEFAULT 0,
  p_evidence_count integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = v_uid AND p.role::text = 'student'
  ) THEN
    RETURN jsonb_build_object('error', 'student_only');
  END IF;
  IF jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object'
     OR pg_column_size(coalesce(p_profile, '{}'::jsonb)) > 240000 THEN
    RETURN jsonb_build_object('error', 'invalid_profile');
  END IF;

  INSERT INTO student_career_profiles(student_id, profile_data, readiness_score, evidence_count, updated_at)
  VALUES (
    v_uid,
    coalesce(p_profile, '{}'::jsonb),
    greatest(0, least(100, coalesce(p_readiness_score, 0))),
    greatest(0, least(10000, coalesce(p_evidence_count, 0))),
    now()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    profile_data = excluded.profile_data,
    readiness_score = excluded.readiness_score,
    evidence_count = excluded.evidence_count,
    updated_at = excluded.updated_at;

  RETURN jsonb_build_object('ok', true, 'updated_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_class_career_profiles(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  profile_data jsonb,
  readiness_score integer,
  evidence_count integer,
  profile_updated_at timestamptz,
  feedback_note text,
  feedback_next_action text,
  feedback_review_on date,
  feedback_created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM teacher_classes tc
     WHERE tc.teacher_id = auth.uid() AND tc.class_id = p_class_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.display_name::text,
         coalesce(cp.profile_data, '{}'::jsonb),
         coalesce(cp.readiness_score, 0),
         coalesce(cp.evidence_count, 0),
         cp.updated_at,
         latest.note,
         latest.next_action,
         latest.review_on,
         latest.created_at
    FROM student_classes sc
    JOIN profiles p ON p.id = sc.student_id
    LEFT JOIN student_career_profiles cp ON cp.student_id = p.id
    LEFT JOIN LATERAL (
      SELECT f.note, f.next_action, f.review_on, f.created_at
        FROM student_career_feedback f
       WHERE f.student_id = p.id AND f.class_id = p_class_id
       ORDER BY f.created_at DESC LIMIT 1
    ) latest ON true
   WHERE sc.class_id = p_class_id
   ORDER BY p.display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_review_student_career_profile(
  p_student_id uuid,
  p_note text,
  p_next_action text,
  p_review_on date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_class uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF char_length(btrim(coalesce(p_note, ''))) < 5
     OR char_length(btrim(coalesce(p_next_action, ''))) < 2 THEN
    RETURN jsonb_build_object('error', 'invalid_feedback');
  END IF;

  SELECT sc.class_id INTO v_class
    FROM student_classes sc
    JOIN teacher_classes tc ON tc.class_id = sc.class_id
   WHERE sc.student_id = p_student_id AND tc.teacher_id = v_uid
   ORDER BY sc.joined_at DESC LIMIT 1;
  IF v_class IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  INSERT INTO student_career_feedback(student_id, teacher_id, class_id, note, next_action, review_on)
  VALUES (
    p_student_id,
    v_uid,
    v_class,
    left(btrim(p_note), 1200),
    left(btrim(p_next_action), 300),
    p_review_on
  );
  RETURN jsonb_build_object('ok', true, 'class_id', v_class);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_upsert_my_career_profile(jsonb, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_class_career_profiles(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_review_student_career_profile(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_my_career_profile(jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_class_career_profiles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_student_career_profile(uuid, text, text, date) TO authenticated;
