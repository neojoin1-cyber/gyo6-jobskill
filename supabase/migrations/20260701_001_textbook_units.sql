-- =============================================================================
-- 완전교재(10블록) 콘텐츠 Supabase 이전
-- 2026-07-01
--  - 앱 번들 JSON(data/textbook-*.json)은 오프라인/최초설치 폴백으로 유지.
--  - Supabase가 최신 내용을 덮어쓴다 → 이 테이블만 갱신하면 앱 재빌드 없이 반영.
--  - 대상: 식음료서비스(food-service)·직업공통능력(job-common) 우선.
-- =============================================================================
create table if not exists textbook_units (
  subject    text not null,                 -- food-service | job-common | ...
  unit_id    text not null,                 -- C01 / COM / C09-8 ...
  title      text not null,
  area       text,                          -- 영역명(직업공통 등), 없으면 null
  sort_order int  not null default 0,
  html       text not null,                 -- 단원 자기완결 HTML(10블록, 자체 <style>)
  quiz       jsonb not null default '[]',   -- [{id,stem,context,choices[],answer,explanation}]
  updated_at timestamptz not null default now(),
  primary key (subject, unit_id)
);

create index if not exists textbook_units_subject_idx on textbook_units (subject, sort_order);

grant select on textbook_units to anon, authenticated;
grant all    on textbook_units to service_role;

alter table textbook_units enable row level security;
drop policy if exists "textbook_units_read_all" on textbook_units;
create policy "textbook_units_read_all" on textbook_units for select using (true);
