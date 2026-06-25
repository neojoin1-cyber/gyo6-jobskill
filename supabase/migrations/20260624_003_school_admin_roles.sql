-- =============================================================================
-- GYO6 — school_admin / class_admin 역할 + 승인 흐름 + 학교 쿼터 + 과목 테이블
-- 2026-06-24
-- =============================================================================

-- ── 1. user_role enum 확장 ────────────────────────────────────────────────────
alter type user_role add value if not exists 'school_admin';
alter type user_role add value if not exists 'class_admin';

-- ── 2. profiles — approved 컬럼 추가 ─────────────────────────────────────────
-- 기존 admin 계정은 자동 승인 처리
alter table profiles add column if not exists approved boolean not null default false;
update profiles set approved = true where role = 'admin';

-- ── 3. schools — 회원 쿼터 컬럼 ─────────────────────────────────────────────
alter table schools add column if not exists max_members  integer not null default 500;
alter table schools add column if not exists max_teachers integer not null default 30;

-- ── 4. courses (교과목 마스터 — 기존 subjects 테이블과 별도) ─────────────────
-- 주의: 기존 subjects 테이블은 NCS 게임 영역 데이터이므로 건드리지 않음
create table if not exists courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- 기본 교과목 데이터
insert into courses (name, sort_order) values
  ('직업기초능력',    1),
  ('품질경영',        2),
  ('식음료서비스',    3),
  ('생산시스템',      4),
  ('안전관리',        5)
on conflict (name) do update set sort_order = excluded.sort_order;

-- ── 5. school_courses (학교별 배정 교과목) ────────────────────────────────────
create table if not exists school_courses (
  school_id uuid not null references schools(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (school_id, course_id)
);

-- ── 6. GRANT ─────────────────────────────────────────────────────────────────
grant all on courses, school_courses to authenticated, service_role;
grant select on courses, school_courses to anon;

-- ── 7. RLS ───────────────────────────────────────────────────────────────────
alter table courses       enable row level security;
alter table school_courses enable row level security;

-- 누구나 읽기
create policy "courses_read_all"        on courses        for select using (true);
create policy "school_courses_read_all" on school_courses for select using (true);

-- admin만 courses 생성/수정
create policy "courses_admin_write" on courses
  for all using (my_profile_role() = 'admin');

-- admin / school_admin은 school_courses 관리
create policy "school_courses_admin_all" on school_courses
  for all using (my_profile_role() in ('admin', 'school_admin'));

-- ── 8. profiles RLS — school_admin 추가 ──────────────────────────────────────
-- school_admin: 자기 학교 프로필 읽기/쓰기
drop policy if exists "profiles_school_admin_manage" on profiles;
create policy "profiles_school_admin_manage" on profiles
  for all using (
    my_profile_role() = 'school_admin'
    and my_school_id() = profiles.school_id
  );

-- classes RLS — school_admin은 자기 학교 학급 전체 읽기
drop policy if exists "classes_school_admin_read" on classes;
create policy "classes_school_admin_read" on classes
  for select using (
    my_profile_role() = 'school_admin'
    and school_id = my_school_id()
  );

-- ── 9. 헬퍼 함수 업데이트 (새 역할 포함) ─────────────────────────────────────
create or replace function my_profile_role() returns user_role
language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_school_id() returns uuid
language sql security definer stable as $$
  select school_id from profiles where id = auth.uid()
$$;

-- 내가 admin 또는 school_admin인지 여부
create or replace function i_am_manager() returns boolean
language sql security definer stable as $$
  select coalesce(
    (select role in ('admin','school_admin') from profiles where id = auth.uid()),
    false
  )
$$;

-- ── 10. rpc_create_teacher_profile 수정 (approved 기본값 false) ───────────────
-- 기존 함수는 approved 컬럼이 없었으므로 재생성
create or replace function rpc_create_teacher_profile(
  p_display_name text,
  p_school_id    uuid
)
returns uuid
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated — sign in before calling this RPC';
  end if;

  insert into profiles(id, role, display_name, school_id, approved)
  values (v_uid, 'teacher', p_display_name, p_school_id, false)
  on conflict (id) do update
    set display_name = excluded.display_name,
        school_id    = excluded.school_id;

  return v_uid;
end;
$$;

-- ── 11. rpc_student_join 수정 (approved 기본값 false) ────────────────────────
-- 반환 타입이 uuid → jsonb로 바뀌므로 DROP 후 재생성
drop function if exists rpc_student_join(text, text, character);
create or replace function rpc_student_join(
  p_display_name text,
  p_nickname     text,
  p_class_code   char(8)
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid   uuid := auth.uid();
  v_class record;
begin
  if v_uid is null then
    raise exception 'Not authenticated — sign in before calling this RPC';
  end if;

  select id, school_id, name into v_class
  from classes
  where class_code = upper(p_class_code);

  if not found then
    raise exception '학급 코드가 올바르지 않습니다: %', p_class_code;
  end if;

  insert into profiles(id, role, display_name, nickname, school_id, approved)
  values (v_uid, 'student', p_display_name, p_nickname, v_class.school_id, false)
  on conflict (id) do update
    set display_name = excluded.display_name,
        nickname     = excluded.nickname,
        school_id    = excluded.school_id;

  insert into student_classes(student_id, class_id)
  values (v_uid, v_class.id)
  on conflict do nothing;

  return jsonb_build_object(
    'class_id',   v_class.id,
    'class_name', v_class.name
  );
end;
$$;

-- ── 12. rpc_create_school_admin — 기존 교사를 학교관리자로 승격 ────────────────
create or replace function rpc_create_school_admin(
  p_email        text,
  p_display_name text,
  p_school_id    uuid,
  p_uid          uuid default null   -- 이미 가입된 계정 UUID (옵션)
)
returns uuid
language plpgsql security definer as $$
declare
  v_caller_role user_role := my_profile_role();
  v_target_uid  uuid;
begin
  -- 호출자 권한 확인 (admin만 가능)
  if v_caller_role <> 'admin' then
    raise exception '권한 없음 — 총괄관리자만 학교관리자를 지정할 수 있습니다';
  end if;

  -- 대상 uid 결정: 직접 지정했으면 사용, 없으면 이메일로 조회
  if p_uid is not null then
    v_target_uid := p_uid;
  else
    select au.id into v_target_uid
    from auth.users au
    where au.email = p_email;

    if v_target_uid is null then
      raise exception '해당 이메일로 가입된 계정을 찾을 수 없습니다: %', p_email;
    end if;
  end if;

  -- 프로필 upsert (역할 변경 + 승인)
  insert into profiles(id, role, display_name, school_id, approved)
  values (v_target_uid, 'school_admin', p_display_name, p_school_id, true)
  on conflict (id) do update
    set role         = 'school_admin',
        display_name = excluded.display_name,
        school_id    = excluded.school_id,
        approved     = true;

  return v_target_uid;
end;
$$;

-- ── 13. rpc_admin_set_role — 총괄관리자가 임의 역할 변경 ─────────────────────
create or replace function rpc_admin_set_role(
  p_user_id uuid,
  p_role    user_role,
  p_approve boolean default true
)
returns void
language plpgsql security definer as $$
begin
  if my_profile_role() <> 'admin' then
    raise exception '권한 없음';
  end if;

  update profiles
  set role     = p_role,
      approved = case when p_approve then true else approved end
  where id = p_user_id;
end;
$$;

-- ── 14. rpc_admin_set_quota — 학교 쿼터 설정 ─────────────────────────────────
create or replace function rpc_admin_set_quota(
  p_school_id   uuid,
  p_max_members integer,
  p_max_teachers integer default null
)
returns void
language plpgsql security definer as $$
begin
  if my_profile_role() <> 'admin' then
    raise exception '권한 없음';
  end if;

  update schools
  set max_members  = p_max_members,
      max_teachers = coalesce(p_max_teachers, max_teachers)
  where id = p_school_id;
end;
$$;

-- ── 15. rpc_approve_member — 학교관리자 / 총괄관리자가 멤버 승인 ─────────────
create or replace function rpc_approve_member(
  p_user_id uuid,
  p_approve boolean default true
)
returns void
language plpgsql security definer as $$
declare
  v_role      user_role := my_profile_role();
  v_school_id uuid      := my_school_id();
  v_target    record;
begin
  if v_role not in ('admin', 'school_admin') then
    raise exception '권한 없음';
  end if;

  select school_id into v_target from profiles where id = p_user_id;

  -- school_admin은 자기 학교만
  if v_role = 'school_admin' and v_target.school_id <> v_school_id then
    raise exception '다른 학교 회원을 승인할 수 없습니다';
  end if;

  update profiles set approved = p_approve where id = p_user_id;
end;
$$;

-- ── 16. 학교 현재 회원 수 조회 뷰 ────────────────────────────────────────────
create or replace view school_member_counts as
select
  s.id                                  as school_id,
  s.max_members,
  s.max_teachers,
  count(*) filter (where p.role in ('teacher','school_admin','class_admin')) as teacher_count,
  count(*) filter (where p.role = 'student') as student_count,
  count(*) filter (where p.approved = false)  as pending_count
from schools s
left join profiles p on p.school_id = s.id
group by s.id, s.max_members, s.max_teachers;

grant select on school_member_counts to authenticated, service_role;
