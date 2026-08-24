-- =============================================================================
-- 관리자 회원 전체 정보 조회·편집 확장
-- 2026-06-26
--
--  - rpc_admin_members()       : 모든 회원의 전체 정보(이메일·닉네임·학반 포함) 조회
--  - rpc_admin_update_user(...) : 이름·이메일·닉네임·역할·학교·학반·승인 일괄 수정
--    (auth.users 이메일 변경 포함 — identities.email은 GENERATED라 identity_data만 갱신)
-- =============================================================================

-- =============================================================================
-- 1. rpc_admin_members — 전체 회원 상세 목록 (admin 전용)
-- =============================================================================
create or replace function rpc_admin_members()
returns jsonb
language plpgsql security definer as $$
begin
  if my_profile_role() <> 'admin' then
    raise exception '관리자 권한이 필요합니다';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    from (
      select
        p.id, p.display_name, p.nickname, p.role, p.approved, p.created_at,
        p.school_id,
        s.name   as school_name,
        s.region as school_region,
        u.email,
        sc.class_id,
        c.name       as class_name,
        c.department as class_department,
        c.grade      as class_grade,
        c.class_num  as class_num
      from profiles p
      left join schools s on s.id = p.school_id
      left join auth.users u on u.id = p.id
      left join lateral (
        select class_id
        from student_classes
        where student_id = p.id
        order by joined_at desc
        limit 1
      ) sc on true
      left join classes c on c.id = sc.class_id
      where p.role <> 'admin'
      order by p.created_at desc
    ) t
  );
end;
$$;

-- =============================================================================
-- 2. rpc_admin_update_user — 회원 전체 정보 일괄 수정 (admin 전용)
--    전달된 값만 반영 (null = 변경 안 함)
-- =============================================================================
create or replace function rpc_admin_update_user(
  p_user_id      uuid,
  p_display_name text      default null,
  p_nickname     text      default null,
  p_email        text      default null,
  p_role         user_role default null,
  p_school_id    uuid      default null,
  p_class_id     uuid      default null,
  p_approved     boolean   default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_old_email text;
  v_role      user_role;
begin
  if my_profile_role() <> 'admin' then
    raise exception '관리자 권한이 필요합니다';
  end if;

  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception '대상 회원을 찾을 수 없습니다';
  end if;

  -- 프로필 필드 (전달된 값만)
  update profiles set
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    nickname     = case when p_nickname is null then nickname else nullif(p_nickname, '') end,
    school_id    = coalesce(p_school_id, school_id),
    role         = coalesce(p_role, role),
    approved     = coalesce(p_approved, approved)
  where id = p_user_id;

  -- 이메일 변경 (auth.users + identities.identity_data)
  if p_email is not null and p_email <> '' then
    select email into v_old_email from auth.users where id = p_user_id;
    if p_email is distinct from v_old_email then
      if exists (select 1 from auth.users where email = p_email and id <> p_user_id) then
        raise exception '이미 사용 중인 이메일입니다';
      end if;
      update auth.users set
        email              = p_email,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at         = now()
      where id = p_user_id;
      update auth.identities set
        identity_data = jsonb_set(identity_data, '{email}', to_jsonb(p_email)),
        updated_at    = now()
      where user_id = p_user_id and provider = 'email';
    end if;
  end if;

  -- 학반 재배정 (학생만)
  select role into v_role from profiles where id = p_user_id;
  if p_class_id is not null and v_role = 'student' then
    delete from student_classes where student_id = p_user_id;
    insert into student_classes(student_id, class_id)
    values (p_user_id, p_class_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
