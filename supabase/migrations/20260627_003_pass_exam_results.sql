-- 합격 판정 실전 모의고사 결과 저장(교사 가시화·이력)
create table if not exists public.pass_exam_results (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users(id) on delete cascade,
  subject_id    text not null default 'food-service',
  paper_no      smallint,
  unit_scores   jsonb not null default '[]',   -- [{unit,name,score,pass,isWritten}]
  passed_count  smallint,
  verdict       text,                            -- pass | fail | pending
  weak_units    text[] default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists pass_results_student_idx on public.pass_exam_results(student_id, created_at desc);

alter table public.pass_exam_results enable row level security;
drop policy if exists per_ins on public.pass_exam_results;
drop policy if exists per_sel on public.pass_exam_results;
drop policy if exists per_teacher_sel on public.pass_exam_results;
create policy per_ins on public.pass_exam_results for insert with check (student_id = auth.uid());
create policy per_sel on public.pass_exam_results for select using (student_id = auth.uid());
create policy per_teacher_sel on public.pass_exam_results for select using (
  exists (
    select 1 from public.student_classes sc
    join public.teacher_classes tc on tc.class_id = sc.class_id
    where sc.student_id = public.pass_exam_results.student_id and tc.teacher_id = auth.uid()
  )
);
grant all on public.pass_exam_results to authenticated;

create or replace function public.rpc_save_pass_result(
  p_subject_id text, p_paper_no smallint, p_unit_scores jsonb,
  p_passed_count smallint, p_verdict text, p_weak_units text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return null; end if;
  insert into public.pass_exam_results (student_id, subject_id, paper_no, unit_scores, passed_count, verdict, weak_units)
  values (auth.uid(), coalesce(p_subject_id,'food-service'), p_paper_no, coalesce(p_unit_scores,'[]'::jsonb), p_passed_count, p_verdict, coalesce(p_weak_units,'{}'))
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.rpc_save_pass_result(text, smallint, jsonb, smallint, text, text[]) to authenticated;
