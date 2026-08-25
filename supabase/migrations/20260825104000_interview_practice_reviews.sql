CREATE TABLE IF NOT EXISTS public.interview_practice_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  stage_id text NOT NULL CHECK (stage_id IN ('arrival','call','entry','greeting','delivery','answer','habits','closing','exit')),
  ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, stage_id)
);

ALTER TABLE public.interview_practice_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_practice_reviews FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.interview_practice_reviews TO authenticated;

DROP POLICY IF EXISTS interview_practice_teacher_own ON public.interview_practice_reviews;
CREATE POLICY interview_practice_teacher_own ON public.interview_practice_reviews
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rpc_interview_practice_review(
  p_student_id uuid,
  p_stage_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.interview_practice_reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_row
  FROM public.interview_practice_reviews
  WHERE teacher_id = v_uid AND student_id = p_student_id AND stage_id = p_stage_id;

  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'ratings', v_row.ratings,
    'note', v_row.note,
    'savedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_save_interview_practice_review(
  p_class_id uuid,
  p_student_id uuid,
  p_stage_id text,
  p_ratings jsonb,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF p_stage_id NOT IN ('arrival','call','entry','greeting','delivery','answer','habits','closing','exit') THEN
    RETURN jsonb_build_object('error', 'invalid_stage');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    WHERE tc.teacher_id = v_uid AND tc.class_id = p_class_id
  ) THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_classes sc
    WHERE sc.student_id = p_student_id AND sc.class_id = p_class_id
  ) THEN RETURN jsonb_build_object('error', 'student_outside_class'); END IF;

  INSERT INTO public.interview_practice_reviews (teacher_id, student_id, class_id, stage_id, ratings, note)
  VALUES (v_uid, p_student_id, p_class_id, p_stage_id, COALESCE(p_ratings, '{}'::jsonb), left(COALESCE(p_note, ''), 1000))
  ON CONFLICT (teacher_id, student_id, stage_id) DO UPDATE SET
    class_id = EXCLUDED.class_id,
    ratings = EXCLUDED.ratings,
    note = EXCLUDED.note,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'saved', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_interview_practice_review(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_save_interview_practice_review(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_interview_practice_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_save_interview_practice_review(uuid, uuid, text, jsonb, text) TO authenticated;
