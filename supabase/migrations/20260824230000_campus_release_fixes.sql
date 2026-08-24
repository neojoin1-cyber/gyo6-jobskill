-- Release blockers found during the Skill Campus adversarial review.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Teachers manage only classes assigned through teacher_classes. Creating a new
-- school class is an administrator action; the creator may assign teachers later.
CREATE OR REPLACE FUNCTION public.rpc_create_class(
  p_name text,
  p_grade smallint DEFAULT NULL,
  p_academic_year smallint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text;
  v_school uuid;
  v_code char(8);
  v_class_id uuid;
BEGIN
  SELECT p.role, p.school_id INTO v_role, v_school
    FROM public.profiles p WHERE p.id = v_uid;

  IF v_role NOT IN ('school_admin', 'admin') THEN
    RAISE EXCEPTION 'Only school administrators can create classes';
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Class name is required';
  END IF;

  v_code := public.generate_class_code();
  INSERT INTO public.classes(school_id, name, grade, academic_year, class_code)
  VALUES (v_school, btrim(p_name), p_grade,
          coalesce(p_academic_year, extract(year from now())::smallint), v_code)
  RETURNING id INTO v_class_id;

  RETURN jsonb_build_object('class_id', v_class_id, 'class_code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_class(text, smallint, smallint) TO authenticated;
