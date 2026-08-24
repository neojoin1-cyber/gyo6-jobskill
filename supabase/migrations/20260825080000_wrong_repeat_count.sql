-- 반복 오답 횟수 복구
-- 1) 영역 저장 RPC가 뒤에서 재정의되며 빠진 wrong_count 증가를 복원한다.
-- 2) 오답노트 재풀이에서 다시 틀린 경우도 반복 오답으로 센다.

create or replace function public.rpc_save_wrong_answer(
  p_question_id text, p_course_id integer, p_question_text text,
  p_correct_answer text, p_user_answer text, p_area text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;

  insert into public.wrong_answers
    (student_id, question_id, course_id, question_text, correct_answer, user_answer,
     area, status, wrong_count, review_streak, updated_at)
  values
    (auth.uid(), p_question_id, p_course_id, p_question_text, p_correct_answer,
     p_user_answer, p_area, 'open', 1, 0, now())
  on conflict (student_id, question_id) do update set
    course_id      = excluded.course_id,
    question_text  = coalesce(excluded.question_text, wrong_answers.question_text),
    correct_answer = coalesce(excluded.correct_answer, wrong_answers.correct_answer),
    user_answer    = excluded.user_answer,
    area           = coalesce(excluded.area, wrong_answers.area),
    status         = 'open',
    resolved_at    = null,
    wrong_count    = coalesce(wrong_answers.wrong_count, 1) + 1,
    review_streak  = 0,
    updated_at     = now();
end;
$$;

create or replace function public.rpc_review_wrong(p_question_id text, p_correct boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then return null; end if;

  if p_correct then
    update public.wrong_answers
       set review_streak = review_streak + 1,
           status = case when review_streak + 1 >= 3 then 'resolved' else status end,
           resolved_at = case when review_streak + 1 >= 3 then now() else resolved_at end,
           updated_at = now()
     where student_id = auth.uid() and question_id = p_question_id
     returning status into v_status;
  else
    update public.wrong_answers
       set wrong_count = coalesce(wrong_count, 1) + 1,
           review_streak = 0,
           status = 'open',
           resolved_at = null,
           updated_at = now()
     where student_id = auth.uid() and question_id = p_question_id
     returning status into v_status;
  end if;

  return v_status;
end;
$$;

grant execute on function public.rpc_save_wrong_answer(text, integer, text, text, text, text) to authenticated;
grant execute on function public.rpc_review_wrong(text, boolean) to authenticated;
