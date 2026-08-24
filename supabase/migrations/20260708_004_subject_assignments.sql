-- 역할별 교재(과목) 배정: 학급/학생 단위 배정 + 학생 유효교재 resolver
-- 학교관리자=학교 범위 배정(학급/학생), 학급관리자=담당 학급 학생 배정, 학생=본인 유효교재 조회.

-- 0) subjects 6종 동기화(누락 3종 추가) — 배정이 실제 6개 교재를 참조하도록
insert into subjects (id, name, data_file) values
  ('quality',     '품질경영',        'textbook-quality.json'),
  ('interview',   '고졸취업 면접스킬', 'textbook-interview.json'),
  ('personality', '인성검사',        'textbook-personality.json')
on conflict (id) do update set name = excluded.name;

-- 1) 학급별 교재 배정 (학교관리자가 관리)
create table if not exists class_subjects (
  class_id   uuid not null references classes(id) on delete cascade,
  subject_id text not null,
  school_id  uuid references schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, subject_id)
);
alter table class_subjects enable row level security;
grant all on class_subjects to authenticated, service_role;

drop policy if exists cs_admin_all on class_subjects;
create policy cs_admin_all on class_subjects for all to authenticated
  using (my_profile_role()::text = 'admin'
      or (my_profile_role()::text = 'school_admin' and school_id = my_school_id()))
  with check (my_profile_role()::text = 'admin'
      or (my_profile_role()::text = 'school_admin' and school_id = my_school_id()));
-- 학급관리자/교사: 담당 학급의 배정 조회
drop policy if exists cs_teacher_read on class_subjects;
create policy cs_teacher_read on class_subjects for select to authenticated
  using (exists (select 1 from teacher_classes tc where tc.class_id = class_subjects.class_id and tc.teacher_id = auth.uid()));

-- 2) 학생별 교재 배정 (학교관리자 또는 담당 학급관리자가 관리)
create table if not exists student_subjects (
  student_id uuid not null references profiles(id) on delete cascade,
  subject_id text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);
alter table student_subjects enable row level security;
grant all on student_subjects to authenticated, service_role;

-- 학생: 본인 배정 조회
drop policy if exists ss_self_read on student_subjects;
create policy ss_self_read on student_subjects for select to authenticated
  using (student_id = auth.uid());
-- 학교관리자/총괄: 같은 학교 학생 배정 관리
drop policy if exists ss_admin_all on student_subjects;
create policy ss_admin_all on student_subjects for all to authenticated
  using (my_profile_role()::text = 'admin'
      or (my_profile_role()::text = 'school_admin'
          and exists (select 1 from profiles p where p.id = student_subjects.student_id and p.school_id = my_school_id())))
  with check (my_profile_role()::text = 'admin'
      or (my_profile_role()::text = 'school_admin'
          and exists (select 1 from profiles p where p.id = student_subjects.student_id and p.school_id = my_school_id())));
-- 학급관리자: 담당 학급 소속 학생 배정 관리
drop policy if exists ss_classadmin_all on student_subjects;
create policy ss_classadmin_all on student_subjects for all to authenticated
  using (my_profile_role()::text = 'class_admin'
      and exists (select 1 from teacher_classes tc join student_classes sc on sc.class_id = tc.class_id
                  where tc.teacher_id = auth.uid() and sc.student_id = student_subjects.student_id))
  with check (my_profile_role()::text = 'class_admin'
      and exists (select 1 from teacher_classes tc join student_classes sc on sc.class_id = tc.class_id
                  where tc.teacher_id = auth.uid() and sc.student_id = student_subjects.student_id));

-- 3) 학생 유효교재 resolver: 개인 배정 ∪ 소속 학급 배정. (빈 배열이면 클라이언트가 '전체 표시'로 폴백)
create or replace function rpc_my_subjects()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct sid), '{}')
  from (
    select subject_id as sid from student_subjects where student_id = auth.uid()
    union
    select cs.subject_id from class_subjects cs
      join student_classes sc on sc.class_id = cs.class_id
      where sc.student_id = auth.uid()
  ) t;
$$;
grant execute on function rpc_my_subjects() to authenticated;

-- 4) 교사(학급관리자 포함) 담당 학급의 학생 목록 조회용 — 배정 UI에서 사용
create or replace function rpc_my_class_students()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select distinct sc.student_id, p.display_name, sc.class_id, c.name as class_name
    from teacher_classes tc
    join student_classes sc on sc.class_id = tc.class_id
    join classes c on c.id = tc.class_id
    join profiles p on p.id = sc.student_id
    where tc.teacher_id = auth.uid()
    order by c.name, p.display_name
  ) t;
$$;
grant execute on function rpc_my_class_students() to authenticated;
