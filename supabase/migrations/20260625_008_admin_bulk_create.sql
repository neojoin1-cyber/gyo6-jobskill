-- ============================================================
-- 008: 관리자 일괄 회원 생성 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_admin_create_user(
  p_email        text,
  p_password     text,
  p_display_name text,
  p_role         text,
  p_school_id    uuid,
  p_class_id     uuid  DEFAULT NULL,
  p_nickname     text  DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  text;
  v_caller_school uuid;
  v_user_id      uuid;
  v_instance_id  uuid;
  v_encrypted_pw text;
BEGIN
  -- 호출자 권한 확인
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('admin', 'school_admin') THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  -- school_admin은 자기 학교만
  IF v_caller_role = 'school_admin' AND v_caller_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION '다른 학교에 등록할 수 없습니다';
  END IF;

  -- 역할 값 검증
  IF p_role NOT IN ('student','teacher','class_admin','school_admin') THEN
    RAISE EXCEPTION '유효하지 않은 역할: %', p_role;
  END IF;

  -- auth.users 인스턴스 ID 가져오기
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  v_instance_id := COALESCE(v_instance_id, '00000000-0000-0000-0000-000000000000');

  v_user_id      := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- auth.users 직접 삽입
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    lower(trim(p_email)), v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  );

  -- 프로필 생성 (일괄 등록은 즉시 승인)
  INSERT INTO profiles (id, display_name, role, school_id, class_id, nickname, approved)
  VALUES (v_user_id, p_display_name, p_role, p_school_id, p_class_id, p_nickname, true);

  -- 학생이면 학급 배정
  IF p_role = 'student' AND p_class_id IS NOT NULL THEN
    INSERT INTO student_classes (student_id, class_id)
    VALUES (v_user_id, p_class_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('user_id', v_user_id, 'email', p_email);

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '이미 존재하는 이메일: %', p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_admin_create_user TO authenticated;
