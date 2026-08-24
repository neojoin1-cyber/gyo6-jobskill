-- 인성검사 모의검사 결과 저장 + 교사 학급 경향 집계
-- 정답 없는 검사 → 점수가 아니라 6요인 프로필 + 신뢰도(jsonb) 저장.

create table if not exists personality_results (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  mode        text not null check (mode in ('quick', 'full')),
  paper_no    smallint,
  profile     jsonb not null default '[]'::jsonb,   -- [{key,name,score,band}]
  reliability jsonb not null default '{}'::jsonb,    -- {consistency, social, infrequency, reliable}
  created_at  timestamptz not null default now()
);

create index if not exists idx_personality_results_student on personality_results(student_id, created_at desc);

alter table personality_results enable row level security;
grant all on personality_results to authenticated, service_role;

-- 학생: 본인 결과만 insert/select
drop policy if exists pr_self_ins on personality_results;
create policy pr_self_ins on personality_results for insert to authenticated with check (student_id = auth.uid());
drop policy if exists pr_self_sel on personality_results;
create policy pr_self_sel on personality_results for select to authenticated using (student_id = auth.uid());

-- 교사: 담당 학급 학생들의 최신 인성검사 결과(경향 집계용) — security definer로 통제
create or replace function rpc_class_personality(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from teacher_classes tc
    where tc.class_id = p_class_id and tc.teacher_id = auth.uid()
  ) and coalesce(my_profile_role(), '') <> 'admin' then
    raise exception '권한이 없습니다.';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select distinct on (sc.student_id)
      sc.student_id,
      p.display_name,
      pr.mode,
      pr.paper_no,
      pr.profile,
      pr.reliability,
      pr.created_at
    from student_classes sc
    join profiles p on p.id = sc.student_id
    left join personality_results pr on pr.student_id = sc.student_id
    where sc.class_id = p_class_id
    order by sc.student_id, pr.created_at desc nulls last
  ) t;

  return v_result;
end;
$$;

grant execute on function rpc_class_personality(uuid) to authenticated;
