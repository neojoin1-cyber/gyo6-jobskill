-- ============================================================
-- 009: 학교관리자 계정 지정
-- ▸ susong8989@gmail.com → 경주정보고등학교
-- ▸ gyo6com@gmail.com   → 경주여자정보고등학교
--
-- 실행 위치: Supabase Dashboard > SQL Editor (postgres 권한)
-- 주의: <<초기비밀번호>> 부분을 실제 비밀번호로 교체 후 실행
-- ============================================================

DO $$
DECLARE
  v_uid1        uuid;
  v_uid2        uuid;
  v_school1     uuid := '71b68a79-900b-4152-9c60-8c4ee6ebde2a'; -- 경주정보고등학교
  v_school2     uuid := '1b077d68-a31f-4cc2-88bf-06a31746a4c6'; -- 경주여자정보고등학교
  v_instance_id uuid;
  -- ↓ 신규 계정 생성 시 부여할 초기 비밀번호 (계정이 이미 있으면 사용 안 함)
  v_init_pw1    text := 'REPLACE_WITH_PASSWORD_FOR_SUSONG';
  v_init_pw2    text := 'REPLACE_WITH_PASSWORD_FOR_GYO6COM';
BEGIN
  -- auth.users의 instance_id 가져오기 (프로젝트마다 고정값)
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  v_instance_id := COALESCE(v_instance_id, '00000000-0000-0000-0000-000000000000');

  -- ① susong8989@gmail.com → 경주정보고등학교 school_admin
  SELECT id INTO v_uid1 FROM auth.users WHERE email = 'susong8989@gmail.com';

  IF v_uid1 IS NULL THEN
    -- 계정이 없으면 신규 생성
    v_uid1 := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_uid1, v_instance_id, 'authenticated', 'authenticated',
      'susong8989@gmail.com',
      extensions.crypt(v_init_pw1, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    );
    RAISE NOTICE '신규 계정 생성 완료: susong8989@gmail.com (uid: %)', v_uid1;
  ELSE
    RAISE NOTICE '기존 계정 확인: susong8989@gmail.com (uid: %)', v_uid1;
  END IF;

  -- 프로필: school_admin으로 설정 (기존 계정이어도 역할 업데이트)
  INSERT INTO profiles (id, role, display_name, school_id, approved)
  VALUES (v_uid1, 'school_admin', '경주정보고 관리자', v_school1, true)
  ON CONFLICT (id) DO UPDATE SET
    role         = 'school_admin',
    school_id    = v_school1,
    approved     = true;

  RAISE NOTICE '경주정보고등학교 학교관리자 지정 완료: susong8989@gmail.com';

  -- ② gyo6com@gmail.com → 경주여자정보고등학교 school_admin
  SELECT id INTO v_uid2 FROM auth.users WHERE email = 'gyo6com@gmail.com';

  IF v_uid2 IS NULL THEN
    v_uid2 := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_uid2, v_instance_id, 'authenticated', 'authenticated',
      'gyo6com@gmail.com',
      extensions.crypt(v_init_pw2, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    );
    RAISE NOTICE '신규 계정 생성 완료: gyo6com@gmail.com (uid: %)', v_uid2;
  ELSE
    RAISE NOTICE '기존 계정 확인: gyo6com@gmail.com (uid: %)', v_uid2;
  END IF;

  INSERT INTO profiles (id, role, display_name, school_id, approved)
  VALUES (v_uid2, 'school_admin', '경주여자정보고 관리자', v_school2, true)
  ON CONFLICT (id) DO UPDATE SET
    role         = 'school_admin',
    school_id    = v_school2,
    approved     = true;

  RAISE NOTICE '경주여자정보고등학교 학교관리자 지정 완료: gyo6com@gmail.com';

  RAISE NOTICE '=== 전체 완료 ===';
END;
$$;

-- 결과 확인
SELECT
  au.email,
  p.role,
  p.display_name,
  p.approved,
  s.name AS school_name
FROM profiles p
JOIN auth.users au ON au.id = p.id
JOIN schools s ON s.id = p.school_id
WHERE p.role = 'school_admin'
ORDER BY s.name;
