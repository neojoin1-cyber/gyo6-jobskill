-- =============================================================================
-- 과목별 모의고사 — 교사 오픈 게이트
-- 2026-06-26
--  - 교사가 학급에 모의고사를 '열면' 학생에게 노출, 시간제한으로 응시.
-- =============================================================================
create table if not exists open_mock_exams (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id) on delete cascade,
  subject_id     text not null,
  title          text not null,
  question_count smallint not null default 50,
  time_limit_min smallint not null default 60,
  opened_by      uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);

create index if not exists idx_ome_class on open_mock_exams(class_id) where closed_at is null;

grant all on open_mock_exams to authenticated, service_role;
alter table open_mock_exams enable row level security;

-- 교사: 담당 학급 모의고사 전체 관리(열기/닫기/조회)
drop policy if exists "ome_teacher_manage" on open_mock_exams;
create policy "ome_teacher_manage" on open_mock_exams for all
  using (exists (select 1 from teacher_classes tc where tc.class_id = open_mock_exams.class_id and tc.teacher_id = auth.uid()))
  with check (exists (select 1 from teacher_classes tc where tc.class_id = open_mock_exams.class_id and tc.teacher_id = auth.uid()));

-- 학생: 자기 학급의 '열린'(closed_at null) 모의고사만 조회
drop policy if exists "ome_student_read" on open_mock_exams;
create policy "ome_student_read" on open_mock_exams for select
  using (closed_at is null and exists (select 1 from student_classes sc where sc.class_id = open_mock_exams.class_id and sc.student_id = auth.uid()));

-- 관리자 조회
drop policy if exists "ome_admin_read" on open_mock_exams;
create policy "ome_admin_read" on open_mock_exams for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
