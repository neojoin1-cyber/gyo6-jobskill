-- 학습 진행율(숙달도) 서버 동기화 + 교사·관리자 학급 진행현황 열람
-- 숙달도 재정의: "과목 전체 영역/단원을 실제로 풀어 익힌 비율"(패시브 열람 제외).
-- 계산은 클라이언트(콘텐츠 구조 보유)가 수행하고, 결과 pct만 서버에 미러링해
-- 학생 카드와 교사·관리자 학습현황이 동일 기준으로 보이게 한다.

create table if not exists public.student_subject_progress (
  student_id     uuid not null references auth.users(id) on delete cascade,
  subject_id     text not null,
  pct            smallint not null default 0,   -- 0..100 과목 진행율
  sections_done  smallint,                      -- 학습 인정된 영역/단원 수(부분 포함)
  sections_total smallint,                      -- 과목 전체 영역/단원 수
  answered       integer,                        -- 실제 응답 문항 누계(패시브 제외)
  updated_at     timestamptz not null default now(),
  primary key (student_id, subject_id)
);

alter table public.student_subject_progress enable row level security;

-- 학생 본인만 읽고 쓰기(관리자 열람은 아래 SECURITY DEFINER RPC로만 허용)
drop policy if exists ssp_self_rw on public.student_subject_progress;
create policy ssp_self_rw on public.student_subject_progress
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

grant select, insert, update on public.student_subject_progress to authenticated;

-- 학생이 계산한 과목 진행율 업서트(본인 것만)
create or replace function public.rpc_sync_subject_progress(
  p_subject_id text, p_pct integer, p_sections_done integer,
  p_sections_total integer, p_answered integer default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.student_subject_progress
    (student_id, subject_id, pct, sections_done, sections_total, answered, updated_at)
  values
    (auth.uid(), p_subject_id, greatest(0, least(100, p_pct)),
     p_sections_done, p_sections_total, p_answered, now())
  on conflict (student_id, subject_id) do update set
    pct            = greatest(0, least(100, excluded.pct)),
    sections_done  = excluded.sections_done,
    sections_total = excluded.sections_total,
    answered       = excluded.answered,
    updated_at     = now();
end; $$;
grant execute on function public.rpc_sync_subject_progress(text, integer, integer, integer, integer) to authenticated;

-- 관리자(교사·학급관리자·학교관리자·총괄) 학급 진행현황 열람
-- 반환: { students:[{student_id, display_name, subjects:[{subject_id,pct,sections_done,sections_total,updated_at}], overall}], subjects:[{subject_id, avg_pct, learner_count}] }
create or replace function public.rpc_class_progress(p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  -- 권한: 담당 교사이거나, 학교관리자(자기 학교 학급)·총괄관리자
  if not exists (select 1 from teacher_classes tc where tc.class_id = p_class_id and tc.teacher_id = auth.uid())
     and coalesce(my_profile_role()::text, '') not in ('school_admin', 'admin') then
    raise exception '권한이 없습니다.';
  end if;
  if my_profile_role()::text = 'school_admin'
     and not exists (select 1 from classes c where c.id = p_class_id and c.school_id = my_school_id()) then
    raise exception '권한이 없습니다.';
  end if;

  with roster as (
    select sc.student_id, p.display_name
    from student_classes sc join profiles p on p.id = sc.student_id
    where sc.class_id = p_class_id
  ),
  prog as (
    select sp.student_id, sp.subject_id, sp.pct, sp.sections_done, sp.sections_total, sp.updated_at
    from student_subject_progress sp join roster r on r.student_id = sp.student_id
  ),
  per_student as (
    select r.student_id, r.display_name,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'subject_id', pr.subject_id, 'pct', pr.pct,
          'sections_done', pr.sections_done, 'sections_total', pr.sections_total,
          'updated_at', pr.updated_at) order by pr.subject_id)
        from prog pr where pr.student_id = r.student_id), '[]'::jsonb) as subjects,
      coalesce((select round(avg(pr.pct)) from prog pr where pr.student_id = r.student_id), 0) as overall
    from roster r order by r.display_name
  ),
  per_subject as (
    select subject_id, round(avg(pct)) as avg_pct, count(*) as learner_count
    from prog group by subject_id order by subject_id
  )
  select jsonb_build_object(
    'students', coalesce((select jsonb_agg(row_to_json(s)) from per_student s), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(row_to_json(x)) from per_subject x), '[]'::jsonb)
  ) into v;
  return v;
end; $$;
grant execute on function public.rpc_class_progress(uuid) to authenticated;
