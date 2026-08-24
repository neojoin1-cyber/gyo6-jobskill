-- 학교관리자 회원관리 화면은 관리자 공용 RPC를 사용한다. 기존 함수들이
-- 총괄관리자만 허용해 목록·수정·이력·비밀번호·삭제가 모두 실패하므로,
-- 학교관리자는 자기 학교 구성원에게만 같은 기능을 사용할 수 있게 제한한다.

CREATE OR REPLACE FUNCTION public.rpc_admin_members()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_role user_role := my_profile_role();
  v_school uuid := my_school_id();
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN RAISE EXCEPTION '관리자 권한이 필요합니다'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    FROM (
      SELECT p.id, p.display_name, p.nickname, p.role, p.approved, p.created_at,
             p.school_id, s.name AS school_name, s.region AS school_region, u.email,
             sc.class_id, c.name AS class_name, c.department AS class_department,
             c.grade AS class_grade, c.class_num
        FROM profiles p
        LEFT JOIN schools s ON s.id=p.school_id
        LEFT JOIN auth.users u ON u.id=p.id
        LEFT JOIN LATERAL (
          SELECT class_id FROM student_classes WHERE student_id=p.id ORDER BY joined_at DESC LIMIT 1
        ) sc ON true
        LEFT JOIN classes c ON c.id=sc.class_id
       WHERE p.role <> 'admin' AND (v_role='admin' OR p.school_id=v_school)
       ORDER BY p.created_at DESC
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_update_user(
  p_user_id uuid, p_display_name text DEFAULT NULL, p_nickname text DEFAULT NULL,
  p_email text DEFAULT NULL, p_role user_role DEFAULT NULL, p_school_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL, p_approved boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_caller user_role := my_profile_role();
  v_school uuid := my_school_id();
  v_target profiles%ROWTYPE;
  v_old_email text;
  v_new_role user_role;
BEGIN
  IF v_caller NOT IN ('admin','school_admin') THEN RAISE EXCEPTION '관리자 권한이 필요합니다'; END IF;
  SELECT * INTO v_target FROM profiles WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION '대상 회원을 찾을 수 없습니다'; END IF;
  IF v_caller='school_admin' AND (v_target.school_id IS DISTINCT FROM v_school OR v_target.role='admin') THEN
    RAISE EXCEPTION '다른 학교 회원을 수정할 수 없습니다';
  END IF;
  IF v_caller='school_admin' AND p_school_id IS NOT NULL AND p_school_id IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION '다른 학교로 이동할 수 없습니다';
  END IF;
  IF v_caller='school_admin' AND p_role='admin' THEN RAISE EXCEPTION '총괄관리자 역할을 지정할 수 없습니다'; END IF;
  IF p_class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM classes WHERE id=p_class_id AND (v_caller='admin' OR school_id=v_school)
  ) THEN RAISE EXCEPTION '해당 학급을 지정할 권한이 없습니다'; END IF;

  UPDATE profiles SET
    display_name=coalesce(nullif(p_display_name,''),display_name),
    nickname=CASE WHEN p_nickname IS NULL THEN nickname ELSE nullif(p_nickname,'') END,
    school_id=coalesce(p_school_id,school_id), role=coalesce(p_role,role),
    approved=coalesce(p_approved,approved)
  WHERE id=p_user_id;

  IF p_email IS NOT NULL AND p_email<>'' THEN
    SELECT email INTO v_old_email FROM auth.users WHERE id=p_user_id;
    IF p_email IS DISTINCT FROM v_old_email THEN
      IF EXISTS (SELECT 1 FROM auth.users WHERE email=p_email AND id<>p_user_id) THEN
        RAISE EXCEPTION '이미 사용 중인 이메일입니다';
      END IF;
      UPDATE auth.users SET email=p_email, email_confirmed_at=coalesce(email_confirmed_at,now()), updated_at=now()
       WHERE id=p_user_id;
      UPDATE auth.identities SET identity_data=jsonb_set(identity_data,'{email}',to_jsonb(p_email)), updated_at=now()
       WHERE user_id=p_user_id AND provider='email';
    END IF;
  END IF;

  SELECT role INTO v_new_role FROM profiles WHERE id=p_user_id;
  IF p_class_id IS NOT NULL AND v_new_role='student' THEN
    DELETE FROM student_classes WHERE student_id=p_user_id;
    INSERT INTO student_classes(student_id,class_id) VALUES(p_user_id,p_class_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_reset_password(p_user_id uuid, p_new_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role user_role := my_profile_role();
  v_school uuid := my_school_id();
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN RAISE EXCEPTION '관리자 권한이 필요합니다'; END IF;
  IF v_role='school_admin' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id=p_user_id AND school_id=v_school AND role<>'admin'
  ) THEN RAISE EXCEPTION '다른 학교 회원의 비밀번호를 바꿀 수 없습니다'; END IF;
  IF length(coalesce(p_new_password,''))<6 THEN RAISE EXCEPTION '비밀번호는 6자 이상이어야 합니다'; END IF;
  UPDATE auth.users SET encrypted_password=extensions.crypt(p_new_password,extensions.gen_salt('bf')),
    email_confirmed_at=coalesce(email_confirmed_at,now()), updated_at=now() WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION '대상 회원을 찾을 수 없습니다'; END IF;
  RETURN jsonb_build_object('ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_member_history(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role user_role := my_profile_role(); v_school uuid := my_school_id();
  v_subs jsonb; v_mocks jsonb;
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN RAISE EXCEPTION '관리자 권한이 필요합니다'; END IF;
  IF v_role='school_admin' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_user_id AND school_id=v_school) THEN
    RAISE EXCEPTION '다른 학교 회원의 이력을 볼 수 없습니다'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_subs FROM (
    SELECT s.id,m.title,m.subject_id,m.mission_type,s.score,s.total_questions,s.grading_status,s.time_taken_sec,s.completed_at
      FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.student_id=p_user_id
      ORDER BY s.completed_at DESC LIMIT 100) t;
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_mocks FROM (
    SELECT id,title,subject_id,kind,auto_score,auto_total,total_questions,grading_status,created_at
      FROM mock_assessments WHERE student_id=p_user_id ORDER BY created_at DESC LIMIT 100) t;
  RETURN jsonb_build_object('submissions',v_subs,'mocks',v_mocks);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_delete_member(p_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_role user_role := my_profile_role(); v_school uuid := my_school_id();
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN RAISE EXCEPTION '관리자 권한이 필요합니다'; END IF;
  IF p_uid=auth.uid() THEN RAISE EXCEPTION '자기 자신은 삭제할 수 없습니다'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id=p_uid AND role='admin') THEN RAISE EXCEPTION '총괄관리자 계정은 삭제할 수 없습니다'; END IF;
  IF v_role='school_admin' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_uid AND school_id=v_school) THEN
    RAISE EXCEPTION '다른 학교 회원을 삭제할 수 없습니다'; END IF;
  DELETE FROM auth.users WHERE id=p_uid;
END;
$$;
