-- Phase 5: 오답노트 지능화 — 틀린 빈도(wrong_count)·연속정답(review_streak) 추적으로
-- 우선 복습 큐(자주 틀림 × 빈출) + 정복(3연속 정답) 시 자동 해결.

alter table public.wrong_answers
  add column if not exists wrong_count   int not null default 1,
  add column if not exists review_streak int not null default 0;

-- 오답 저장: 재오답 시 빈도 +1, 연속정답 리셋(정석)
create or replace function public.rpc_save_wrong_answer(
  p_question_id text, p_course_id integer, p_question_text text,
  p_correct_answer text, p_user_answer text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.wrong_answers
    (student_id, question_id, course_id, question_text, correct_answer, user_answer, status, updated_at)
  values
    (auth.uid(), p_question_id, p_course_id, p_question_text, p_correct_answer, p_user_answer, 'open', now())
  on conflict (student_id, question_id) do update set
    course_id      = excluded.course_id,
    question_text  = coalesce(excluded.question_text, wrong_answers.question_text),
    correct_answer = coalesce(excluded.correct_answer, wrong_answers.correct_answer),
    user_answer    = excluded.user_answer,
    status         = 'open',
    resolved_at    = null,
    wrong_count    = wrong_answers.wrong_count + 1,
    review_streak  = 0,
    updated_at     = now();
end; $$;

-- 복습 결과 기록: 정답이면 연속정답 +1(3연속 시 resolved), 오답이면 연속정답 리셋
create or replace function public.rpc_review_wrong(p_question_id text, p_correct boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_streak int; v_status text;
begin
  if auth.uid() is null then return null; end if;
  if p_correct then
    update public.wrong_answers
      set review_streak = review_streak + 1,
          status = case when review_streak + 1 >= 3 then 'resolved' else status end,
          resolved_at = case when review_streak + 1 >= 3 then now() else resolved_at end,
          updated_at = now()
      where student_id = auth.uid() and question_id = p_question_id
      returning review_streak, status into v_streak, v_status;
  else
    update public.wrong_answers
      set review_streak = 0, status = 'open', resolved_at = null, updated_at = now()
      where student_id = auth.uid() and question_id = p_question_id
      returning review_streak, status into v_streak, v_status;
  end if;
  return v_status;
end; $$;

grant execute on function public.rpc_review_wrong(text, boolean) to authenticated;
