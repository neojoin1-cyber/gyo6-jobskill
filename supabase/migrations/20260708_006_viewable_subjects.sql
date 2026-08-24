-- 교사·학급관리자가 열람 가능한 교재(과목) resolver
-- 학급관리자: 담당 학급에 배정된 교재(class_subjects). 일반 교사: 본인에게 배정된 과목(teacher_subjects).
create or replace function public.rpc_my_viewable_subjects()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct sid), '{}')
  from (
    -- 학급관리자: 담당 학급 배정 교재
    select cs.subject_id as sid
    from class_subjects cs
    join teacher_classes tc on tc.class_id = cs.class_id
    where tc.teacher_id = auth.uid()
    union
    -- 일반 교사: 본인에게 배정된 과목
    select ts.subject_id
    from teacher_subjects ts
    where ts.teacher_id = auth.uid()
  ) t;
$$;
grant execute on function public.rpc_my_viewable_subjects() to authenticated;
