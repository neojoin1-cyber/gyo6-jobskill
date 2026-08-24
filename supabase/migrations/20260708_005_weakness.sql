-- 약점 분석: wrong_answers에 영역(area) 저장 + 관리자용 학급 약점 집계 RPC
-- 학생은 본인 오답(RLS)을 영역별로 집계해 약점 파악. 관리자는 담당 범위 학생 약점 열람.

alter table public.wrong_answers add column if not exists area text;

-- 저장 RPC에 p_area 추가(마지막 파라미터, 기본 null) — 기존 5-인자 버전 대체
drop function if exists public.rpc_save_wrong_answer(text, integer, text, text, text);
create or replace function public.rpc_save_wrong_answer(
  p_question_id text, p_course_id integer, p_question_text text,
  p_correct_answer text, p_user_answer text, p_area text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.wrong_answers
    (student_id, question_id, course_id, question_text, correct_answer, user_answer, area, status, updated_at)
  values
    (auth.uid(), p_question_id, p_course_id, p_question_text, p_correct_answer, p_user_answer, p_area, 'open', now())
  on conflict (student_id, question_id) do update set
    course_id      = excluded.course_id,
    question_text  = excluded.question_text,
    correct_answer = excluded.correct_answer,
    user_answer    = excluded.user_answer,
    area           = coalesce(excluded.area, public.wrong_answers.area),
    status         = 'open',
    updated_at     = now();
end; $$;
grant execute on function public.rpc_save_wrong_answer(text, integer, text, text, text, text) to authenticated;

-- 관리자(교사·학급관리자·학교관리자·총괄) 학급 약점 집계
-- 반환: { areas:[{course_id,area,wrong_count,student_count}], students:[{student_id,display_name,open_count,top_area}] }
create or replace function public.rpc_class_weakness(p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from teacher_classes tc where tc.class_id = p_class_id and tc.teacher_id = auth.uid())
     and coalesce(my_profile_role()::text, '') not in ('school_admin', 'admin') then
    raise exception '권한이 없습니다.';
  end if;
  -- 학교관리자는 자기 학교 학급만
  if my_profile_role()::text = 'school_admin'
     and not exists (select 1 from classes c where c.id = p_class_id and c.school_id = my_school_id()) then
    raise exception '권한이 없습니다.';
  end if;

  with roster as (
    select sc.student_id, p.display_name
    from student_classes sc join profiles p on p.id = sc.student_id
    where sc.class_id = p_class_id
  ),
  wa as (
    select w.student_id, coalesce(nullif(w.area,''), '기타') as area, w.course_id
    from wrong_answers w join roster r on r.student_id = w.student_id
    where w.status = 'open'
  ),
  areas as (
    select course_id, area, count(*) as wrong_count, count(distinct student_id) as student_count
    from wa group by course_id, area order by count(*) desc limit 30
  ),
  per_student as (
    select r.student_id, r.display_name,
      (select count(*) from wa where wa.student_id = r.student_id) as open_count,
      (select area from wa where wa.student_id = r.student_id group by area order by count(*) desc limit 1) as top_area
    from roster r order by open_count desc
  )
  select jsonb_build_object(
    'areas',    coalesce((select jsonb_agg(row_to_json(a)) from areas a), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(row_to_json(s)) from per_student s), '[]'::jsonb)
  ) into v;
  return v;
end; $$;
grant execute on function public.rpc_class_weakness(uuid) to authenticated;
