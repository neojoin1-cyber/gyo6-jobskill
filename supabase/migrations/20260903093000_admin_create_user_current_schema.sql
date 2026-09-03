-- Align the account creation RPC with the current normalized class-membership
-- schema. profiles.class_id was removed; student_classes is authoritative.
CREATE OR REPLACE FUNCTION public.rpc_admin_create_user(
  p_email        text,
  p_password     text,
  p_display_name text,
  p_role         text,
  p_school_id    uuid,
  p_class_id     uuid DEFAULT NULL,
  p_nickname     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role text;
  v_caller_school uuid;
  v_user_id uuid;
  v_instance_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('admin', 'school_admin') THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;
  IF v_caller_role = 'school_admin' AND v_caller_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION '다른 학교에 등록할 수 없습니다';
  END IF;
  IF p_role NOT IN ('student', 'teacher', 'class_admin', 'school_admin') THEN
    RAISE EXCEPTION '유효하지 않은 역할: %', p_role;
  END IF;

  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000');
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('email', v_email), now(), now()
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email,
      'email_verified', true, 'phone_verified', false),
    'email', NULL, now(), now()
  );

  INSERT INTO public.profiles (id, display_name, role, school_id, nickname, approved)
  VALUES (v_user_id, p_display_name, p_role::public.user_role, p_school_id, p_nickname, true);

  IF p_role = 'student' AND p_class_id IS NOT NULL THEN
    INSERT INTO public.student_classes (student_id, class_id)
    VALUES (v_user_id, p_class_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('user_id', v_user_id, 'email', v_email);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '이미 존재하는 이메일: %', p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_create_user(text, text, text, text, uuid, uuid, text) TO authenticated;
