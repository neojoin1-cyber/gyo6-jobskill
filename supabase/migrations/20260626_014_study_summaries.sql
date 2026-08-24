-- =============================================================================
-- 학습(요점정리) 콘텐츠 Supabase 이전
-- 2026-06-26
--  - 앱 번들 JSON은 오프라인 폴백으로 유지, Supabase가 최신 내용을 덮어쓴다.
--  - 내용 수정/추가 시 앱 재빌드 없이 이 테이블만 갱신하면 된다.
-- =============================================================================
create table if not exists study_summaries (
  key        text primary key,            -- lessonId / area:<영역> / qm:<id> / iv:<id>
  data       jsonb not null,              -- { title, intro, keyPoints[], mustRemember[], terms[], tips[] }
  subject    text,                        -- 분류용(job-common/ncs-basic/food-service/quality/interview)
  updated_at timestamptz not null default now()
);

grant select on study_summaries to anon, authenticated;
grant all    on study_summaries to service_role;

alter table study_summaries enable row level security;
drop policy if exists "study_summaries_read_all" on study_summaries;
create policy "study_summaries_read_all" on study_summaries for select using (true);
