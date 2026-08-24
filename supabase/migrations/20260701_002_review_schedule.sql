-- =============================================================================
-- SRS(간격 반복) 복습 스케줄 — 학습과학 '분산 학습' 적용
-- 2026-07-01
--  - 완전교재 인출 퀴즈 결과로 문항별 다음 복습일(due_at)을 계산·저장.
--  - 사용자 본인 행만 접근(RLS). 로그인 학생 기준.
-- =============================================================================
create table if not exists review_schedule (
  user_id       uuid not null references auth.users(id) on delete cascade,
  subject       text not null,               -- food-service | job-common ...
  unit_id       text not null,               -- 원 단원(마스터리 연동용)
  item_id       text not null,               -- 문항 id
  ease          real not null default 2.5,   -- SM-2 난이도 계수(>=1.3)
  interval_days int  not null default 0,
  reps          int  not null default 0,
  due_at        timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists review_schedule_due_idx on review_schedule (user_id, subject, due_at);

alter table review_schedule enable row level security;
grant select, insert, update, delete on review_schedule to authenticated;

drop policy if exists "review_own_select" on review_schedule;
create policy "review_own_select" on review_schedule for select using (user_id = auth.uid());
drop policy if exists "review_own_insert" on review_schedule;
create policy "review_own_insert" on review_schedule for insert with check (user_id = auth.uid());
drop policy if exists "review_own_update" on review_schedule;
create policy "review_own_update" on review_schedule for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "review_own_delete" on review_schedule;
create policy "review_own_delete" on review_schedule for delete using (user_id = auth.uid());
