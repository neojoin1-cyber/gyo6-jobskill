-- 4.8.16 release integrity contracts.
-- Keep the repository schema aligned with the live app and make teacher-class
-- assignment an atomic, observable administrator operation.

DROP FUNCTION IF EXISTS public.rpc_student_join(text, text, character);
DROP FUNCTION IF EXISTS public.rpc_student_join(text, text, uuid);

CREATE FUNCTION public.rpc_student_join(
  p_display_name text,
  p_nickname text,
  p_class_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_class record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인 후 가입을 다시 진행해 주세요';
  END IF;

  SELECT id, school_id, name INTO v_class
    FROM public.classes
   WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '선택한 학급을 찾을 수 없습니다';
  END IF;

  INSERT INTO public.profiles(id, role, display_name, nickname, school_id, approved)
  VALUES (v_uid, 'student', btrim(p_display_name), nullif(btrim(p_nickname), ''), v_class.school_id, false)
  ON CONFLICT (id) DO UPDATE SET
    role = 'student',
    display_name = excluded.display_name,
    nickname = excluded.nickname,
    school_id = excluded.school_id,
    approved = false;

  DELETE FROM public.student_classes WHERE student_id = v_uid;
  INSERT INTO public.student_classes(student_id, class_id) VALUES (v_uid, v_class.id);

  RETURN jsonb_build_object('class_id', v_class.id, 'class_name', v_class.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_student_join(text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role user_role := my_profile_role();
  v_school uuid := my_school_id();
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    FROM (
      SELECT p.id, p.display_name, p.nickname, p.role, p.approved, p.created_at,
             p.school_id, s.name AS school_name, s.region AS school_region, u.email,
             sc.class_id, c.name AS class_name, c.department AS class_department,
             c.grade AS class_grade, c.class_num,
             coalesce(tc.class_ids, ARRAY[]::uuid[]) AS teacher_class_ids,
             coalesce(tc.class_names, ARRAY[]::text[]) AS teacher_class_names
        FROM public.profiles p
        LEFT JOIN public.schools s ON s.id = p.school_id
        LEFT JOIN auth.users u ON u.id = p.id
        LEFT JOIN LATERAL (
          SELECT class_id FROM public.student_classes
           WHERE student_id = p.id ORDER BY joined_at DESC LIMIT 1
        ) sc ON true
        LEFT JOIN public.classes c ON c.id = sc.class_id
        LEFT JOIN LATERAL (
          SELECT array_agg(link.class_id ORDER BY cls.grade, cls.class_num, cls.name) AS class_ids,
                 array_agg(cls.name ORDER BY cls.grade, cls.class_num, cls.name) AS class_names
            FROM public.teacher_classes link
            JOIN public.classes cls ON cls.id = link.class_id
           WHERE link.teacher_id = p.id
        ) tc ON true
       WHERE p.role <> 'admin' AND (v_role = 'admin' OR p.school_id = v_school)
       ORDER BY p.created_at DESC
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_v2(
  p_user_id uuid,
  p_display_name text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_role user_role DEFAULT NULL,
  p_school_id uuid DEFAULT NULL,
  p_class_ids uuid[] DEFAULT NULL,
  p_approved boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller user_role := my_profile_role();
  v_caller_school uuid := my_school_id();
  v_target profiles%ROWTYPE;
  v_new_role user_role;
  v_new_school uuid;
  v_old_email text;
  v_assigned integer := 0;
BEGIN
  IF v_caller NOT IN ('admin','school_admin') THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '대상 회원을 찾을 수 없습니다'; END IF;
  IF v_caller = 'school_admin'
     AND (v_target.school_id IS DISTINCT FROM v_caller_school OR v_target.role = 'admin') THEN
    RAISE EXCEPTION '다른 학교 회원을 수정할 수 없습니다';
  END IF;
  IF v_caller = 'school_admin' AND p_school_id IS NOT NULL
     AND p_school_id IS DISTINCT FROM v_caller_school THEN
    RAISE EXCEPTION '다른 학교로 이동할 수 없습니다';
  END IF;
  IF v_caller = 'school_admin' AND p_role = 'admin' THEN
    RAISE EXCEPTION '총괄관리자 역할을 지정할 수 없습니다';
  END IF;

  v_new_role := coalesce(p_role, v_target.role);
  v_new_school := coalesce(p_school_id, v_target.school_id);

  IF p_class_ids IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_class_ids) requested(class_id)
    LEFT JOIN public.classes cls ON cls.id = requested.class_id
    WHERE cls.id IS NULL OR cls.school_id IS DISTINCT FROM v_new_school
  ) THEN
    RAISE EXCEPTION '선택한 학급 중 소속 학교와 일치하지 않는 학급이 있습니다';
  END IF;
  IF p_class_ids IS NOT NULL AND v_new_role = 'student'
     AND cardinality(p_class_ids) <> 1 THEN
    RAISE EXCEPTION '학생은 학급 한 곳을 선택해야 합니다';
  END IF;

  UPDATE public.profiles SET
    display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
    nickname = CASE WHEN p_nickname IS NULL THEN nickname ELSE nullif(btrim(p_nickname), '') END,
    school_id = v_new_school,
    role = v_new_role,
    approved = coalesce(p_approved, approved)
  WHERE id = p_user_id;

  IF p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    SELECT email INTO v_old_email FROM auth.users WHERE id = p_user_id;
    IF lower(btrim(p_email)) IS DISTINCT FROM lower(v_old_email) THEN
      IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(btrim(p_email)) AND id <> p_user_id) THEN
        RAISE EXCEPTION '이미 사용 중인 이메일입니다';
      END IF;
      UPDATE auth.users SET email = lower(btrim(p_email)),
        email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
       WHERE id = p_user_id;
      UPDATE auth.identities SET
        identity_data = jsonb_set(identity_data, '{email}', to_jsonb(lower(btrim(p_email)))),
        updated_at = now()
       WHERE user_id = p_user_id AND provider = 'email';
    END IF;
  END IF;

  IF v_new_role <> 'student' THEN
    DELETE FROM public.student_classes WHERE student_id = p_user_id;
  ELSIF p_class_ids IS NOT NULL THEN
    DELETE FROM public.student_classes WHERE student_id = p_user_id;
    INSERT INTO public.student_classes(student_id, class_id) VALUES (p_user_id, p_class_ids[1]);
  END IF;

  IF v_new_role NOT IN ('teacher','class_admin') THEN
    DELETE FROM public.teacher_classes WHERE teacher_id = p_user_id;
  ELSIF p_class_ids IS NOT NULL THEN
    DELETE FROM public.teacher_classes WHERE teacher_id = p_user_id;
    INSERT INTO public.teacher_classes(teacher_id, class_id)
      SELECT p_user_id, requested.class_id
      FROM (SELECT DISTINCT unnest(p_class_ids) AS class_id) requested;
  END IF;

  IF v_new_role = 'student' THEN
    SELECT count(*) INTO v_assigned FROM public.student_classes WHERE student_id = p_user_id;
  ELSIF v_new_role IN ('teacher','class_admin') THEN
    SELECT count(*) INTO v_assigned FROM public.teacher_classes WHERE teacher_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_new_role,
    'assigned_class_count', v_assigned,
    'assigned_class_ids', coalesce(p_class_ids, ARRAY[]::uuid[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_update_user_v2(uuid, text, text, text, user_role, uuid, uuid[], boolean) TO authenticated;

-- Backward-compatible contract for older clients and operational probes. A
-- teacher class assignment through p_class_id must never return ok without
-- creating the teacher_classes row.
CREATE OR REPLACE FUNCTION public.rpc_admin_update_user(
  p_user_id uuid,
  p_display_name text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_role user_role DEFAULT NULL,
  p_school_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_approved boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.rpc_admin_update_user_v2(
    p_user_id,
    p_display_name,
    p_nickname,
    p_email,
    p_role,
    p_school_id,
    CASE WHEN p_class_id IS NULL THEN NULL ELSE ARRAY[p_class_id]::uuid[] END,
    p_approved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_update_user(uuid, text, text, text, user_role, uuid, uuid, boolean) TO authenticated;
