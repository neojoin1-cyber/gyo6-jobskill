-- =============================================================================
-- 관리자 파워 기능: 비밀번호 재설정 · 학습이력 조회 · 학급 관리
-- 2026-06-26
-- =============================================================================

-- =============================================================================
-- 1. rpc_admin_reset_password — 임의 회원 임시 비밀번호 설정 (admin 전용)
-- =============================================================================
create or replace function rpc_admin_reset_password(
  p_user_id      uuid,
  p_new_password text
)
returns jsonb
language plpgsql security definer as $$
begin
  if my_profile_role() <> 'admin' then
    raise exception '관리자 권한이 필요합니다';
  end if;
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception '비밀번호는 6자 이상이어야 합니다';
  end if;

  update auth.users set
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at         = now()
  where id = p_user_id;

  if not found then
    raise exception '대상 회원을 찾을 수 없습니다';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- =============================================================================
-- 2. rpc_admin_member_history — 회원 학습 이력 (제출 + 모의평가) (admin 전용)
-- =============================================================================
create or replace function rpc_admin_member_history(p_user_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  v_subs  jsonb;
  v_mocks jsonb;
begin
  if my_profile_role() <> 'admin' then
    raise exception '관리자 권한이 필요합니다';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_subs
  from (
    select s.id, m.title, m.subject_id, m.mission_type,
           s.score, s.total_questions, s.grading_status,
           s.time_taken_sec, s.completed_at
    from submissions s
    join missions m on m.id = s.mission_id
    where s.student_id = p_user_id
    order by s.completed_at desc
    limit 100
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_mocks
  from (
    select id, title, subject_id, kind,
           auto_score, auto_total, total_questions, grading_status, created_at
    from mock_assessments
    where student_id = p_user_id
    order by created_at desc
    limit 100
  ) t;

  return jsonb_build_object('submissions', v_subs, 'mocks', v_mocks);
end;
$$;

-- =============================================================================
-- 3. 학급 관리: 관리자 RLS 정책 + 생성 RPC
-- =============================================================================
-- 관리자는 모든 학급 CRUD (기존 admin_read_all_classes는 SELECT만 → ALL 추가)
drop policy if exists "classes_admin_all" on classes;
create policy "classes_admin_all" on classes for all
  using (my_profile_role() = 'admin')
  with check (my_profile_role() = 'admin');

-- 관리자는 학급별 학생 명단(student_classes) 조회
drop policy if exists "student_classes_admin_read" on student_classes;
create policy "student_classes_admin_read" on student_classes for select
  using (my_profile_role() = 'admin');

-- class_code 자동 생성을 위해 생성은 RPC로 (admin 전용)
create or replace function rpc_admin_create_class(
  p_school_id  uuid,
  p_name       text,
  p_grade      smallint default null,
  p_department text     default null,
  p_class_num  smallint default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_id   uuid;
  v_code char(8);
begin
  if my_profile_role() <> 'admin' then
    raise exception '관리자 권한이 필요합니다';
  end if;
  if coalesce(p_name, '') = '' then
    raise exception '학급 이름을 입력하세요';
  end if;

  v_code := generate_class_code();

  insert into classes(school_id, name, grade, department, class_num, class_code, academic_year)
  values (p_school_id, p_name, p_grade, p_department, p_class_num, v_code,
          extract(year from now())::smallint)
  returning id into v_id;

  return jsonb_build_object('class_id', v_id, 'class_code', v_code);
end;
$$;
