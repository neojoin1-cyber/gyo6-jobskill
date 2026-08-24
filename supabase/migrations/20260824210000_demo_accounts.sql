-- ============================================================
-- 025: 홈페이지 체험 계정 — 학생·교사·학교관리자 하나씩
-- ============================================================
--
-- ── 왜 별도 학교로 격리하나 ────────────────────────────────────────
-- 체험 계정을 실제 학교·학급에 넣으면 그 반 명단과 통계에 섞인다. 교사가
-- 「우리 반 현황」을 열었을 때 모르는 이름이 하나 끼어 있고, 랭킹에도
-- 올라온다. 그래서 **체험 전용 학교와 학급**을 만들고 그 안에만 둔다.
-- 나중에 학교 한 줄만 지우면 전부 정리된다.
--
-- ── 교재는 배정하지 않는다 ─────────────────────────────────────────
-- 앱은 「교재 미배정 = 전체 열람」이다(TeacherTextbookScreen.jsx:16,
-- CourseListScreen.jsx:155). 그러므로 **아무것도 배정하지 않는 것이**
-- 모든 교재의 모든 단원을 여는 방법이다. 배정을 넣으면 오히려 좁아진다.
--
-- ── 전국 랭킹에 올리지 않는다 ──────────────────────────────────────
-- 체험 계정이 전국 순위에 뜨면 실제 학생들 사이에 유령이 섞인다.
-- 학교의 national_ranking_opt_in 을 꺼 둔다.
--
-- ── 다시 실행해도 안전하다 ─────────────────────────────────────────
-- 이미 있으면 만들지 않고 비밀번호만 다시 맞춘다. 마이그레이션이 두 번
-- 돌아도 계정이 두 벌 생기지 않는다.

-- pgcrypto 가 어느 스키마에 있든 찾도록. 기존 rpc_admin_create_user 도
-- 같은 경로를 쓴다(SET search_path = public, auth, extensions).
SET search_path = public, auth, extensions;

DO $$
DECLARE
  v_school  uuid;
  v_class   uuid;
  v_pw      text := 'sugarsalt2026';   -- 공개용 체험 비밀번호
  v_inst    uuid;
  v_student uuid; v_teacher uuid; v_admin uuid;
BEGIN
  -- uuid 에는 min() 이 없다. 아무 행에서 하나 집어 오면 된다.
  SELECT instance_id INTO v_inst FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
  v_inst := coalesce(v_inst, '00000000-0000-0000-0000-000000000000');

  -- ── 체험 학교 ────────────────────────────────────────────────
  SELECT id INTO v_school FROM public.schools WHERE name = '설탕과소금 체험학교';
  IF v_school IS NULL THEN
    INSERT INTO public.schools(name, region, national_ranking_opt_in)
    VALUES ('설탕과소금 체험학교', '체험', false)
    RETURNING id INTO v_school;
  ELSE
    UPDATE public.schools SET national_ranking_opt_in = false WHERE id = v_school;
  END IF;

  -- ── 체험 학급 ────────────────────────────────────────────────
  SELECT id INTO v_class FROM public.classes WHERE school_id = v_school AND name = '체험 1반';
  IF v_class IS NULL THEN
    INSERT INTO public.classes(school_id, name, grade, class_code)
    VALUES (v_school, '체험 1반', 1, 'DEMO2026')
    RETURNING id INTO v_class;
  END IF;

  -- ── 계정 셋 ──────────────────────────────────────────────────
  -- auth.users 에 직접 넣는다. rpc_admin_create_user 와 같은 방식이지만
  -- 그 함수는 호출자가 관리자여야 해서 마이그레이션에서는 못 쓴다.
  -- 학생
  SELECT id INTO v_student FROM auth.users WHERE email = 'demo.student@sugarsalt.kr';
  IF v_student IS NULL THEN
    v_student := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    VALUES (v_student, v_inst, 'authenticated', 'authenticated',
            'demo.student@sugarsalt.kr', extensions.crypt(v_pw, extensions.gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}'::jsonb,
            '{"email":"demo.student@sugarsalt.kr"}'::jsonb, now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
                          email_confirmed_at = coalesce(email_confirmed_at, now())
     WHERE id = v_student;
  END IF;
  INSERT INTO public.profiles(id, role, display_name, nickname, school_id)
  VALUES (v_student, 'student', '체험 학생', '체험학생', v_school)
  ON CONFLICT (id) DO UPDATE SET role = 'student', display_name = '체험 학생', school_id = v_school;
  INSERT INTO public.student_classes(student_id, class_id) VALUES (v_student, v_class)
  ON CONFLICT DO NOTHING;

  -- 교사
  SELECT id INTO v_teacher FROM auth.users WHERE email = 'demo.teacher@sugarsalt.kr';
  IF v_teacher IS NULL THEN
    v_teacher := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    VALUES (v_teacher, v_inst, 'authenticated', 'authenticated',
            'demo.teacher@sugarsalt.kr', extensions.crypt(v_pw, extensions.gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}'::jsonb,
            '{"email":"demo.teacher@sugarsalt.kr"}'::jsonb, now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
                          email_confirmed_at = coalesce(email_confirmed_at, now())
     WHERE id = v_teacher;
  END IF;
  INSERT INTO public.profiles(id, role, display_name, school_id)
  VALUES (v_teacher, 'teacher', '체험 선생님', v_school)
  ON CONFLICT (id) DO UPDATE SET role = 'teacher', display_name = '체험 선생님', school_id = v_school;
  INSERT INTO public.teacher_classes(teacher_id, class_id) VALUES (v_teacher, v_class)
  ON CONFLICT DO NOTHING;

  -- 학교관리자
  SELECT id INTO v_admin FROM auth.users WHERE email = 'demo.admin@sugarsalt.kr';
  IF v_admin IS NULL THEN
    v_admin := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    VALUES (v_admin, v_inst, 'authenticated', 'authenticated',
            'demo.admin@sugarsalt.kr', extensions.crypt(v_pw, extensions.gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}'::jsonb,
            '{"email":"demo.admin@sugarsalt.kr"}'::jsonb, now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
                          email_confirmed_at = coalesce(email_confirmed_at, now())
     WHERE id = v_admin;
  END IF;
  INSERT INTO public.profiles(id, role, display_name, school_id)
  VALUES (v_admin, 'school_admin', '체험 학교관리자', v_school)
  ON CONFLICT (id) DO UPDATE SET role = 'school_admin', display_name = '체험 학교관리자', school_id = v_school;
END $$;
