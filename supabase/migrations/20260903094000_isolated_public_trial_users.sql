-- Every public trial session receives its own short-lived auth identity while
-- inheriting only the read scope of the role template account.
CREATE TABLE IF NOT EXISTS public.public_trial_ephemeral_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_role text NOT NULL CHECK (trial_role IN ('student', 'teacher', 'school_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_trial_ephemeral_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_trial_ephemeral_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_trial_ephemeral_users TO service_role;

CREATE OR REPLACE FUNCTION public.provision_public_trial_identity(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_school uuid;
  v_template_id uuid;
  v_email text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION '서비스 역할만 체험 사용자를 준비할 수 있습니다';
  END IF;
  IF p_role NOT IN ('student', 'teacher', 'school_admin') THEN
    RAISE EXCEPTION '지원하지 않는 체험 역할입니다';
  END IF;

  v_email := CASE p_role
    WHEN 'student' THEN 'demo.student@sugarsalt.kr'
    WHEN 'teacher' THEN 'demo.teacher@sugarsalt.kr'
    ELSE 'demo.admin@sugarsalt.kr'
  END;

  SELECT p.school_id, u.id INTO v_school, v_template_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = v_email;
  IF v_template_id IS NULL THEN RAISE EXCEPTION '체험 역할 원본 계정을 찾을 수 없습니다'; END IF;

  INSERT INTO public.profiles (id, role, display_name, school_id, approved)
  VALUES (
    p_user_id,
    p_role::public.user_role,
    CASE p_role WHEN 'student' THEN '체험 학생' WHEN 'teacher' THEN '체험 선생님' ELSE '체험 학교관리자' END,
    v_school,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = excluded.role,
    display_name = excluded.display_name,
    school_id = excluded.school_id,
    approved = true;

  DELETE FROM public.student_classes WHERE student_id = p_user_id;
  DELETE FROM public.teacher_classes WHERE teacher_id = p_user_id;
  IF p_role = 'student' THEN
    INSERT INTO public.student_classes (student_id, class_id)
    SELECT p_user_id, class_id FROM public.student_classes WHERE student_id = v_template_id
    ON CONFLICT DO NOTHING;
  ELSIF p_role = 'teacher' THEN
    INSERT INTO public.teacher_classes (teacher_id, class_id)
    SELECT p_user_id, class_id FROM public.teacher_classes WHERE teacher_id = v_template_id
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.public_trial_ephemeral_users (user_id, trial_role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET trial_role = excluded.trial_role, created_at = now();

  RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_public_trial_identity(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_public_trial_identity(uuid, text) TO service_role;
