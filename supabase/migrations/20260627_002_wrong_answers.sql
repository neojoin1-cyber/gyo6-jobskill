-- 크로스기기 오답노트: 자율학습·미션 오답을 학생별로 저장(기기 간 동기화)
create table if not exists public.wrong_answers (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users(id) on delete cascade,
  question_id   text not null,
  course_id     integer,
  question_text text,
  correct_answer text,
  user_answer   text,
  status        text not null default 'open',  -- open | resolved
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (student_id, question_id)
);
create index if not exists wrong_answers_student_idx on public.wrong_answers (student_id, status);

alter table public.wrong_answers enable row level security;
drop policy if exists wa_select on public.wrong_answers;
drop policy if exists wa_insert on public.wrong_answers;
drop policy if exists wa_update on public.wrong_answers;
drop policy if exists wa_delete on public.wrong_answers;
create policy wa_select on public.wrong_answers for select using (student_id = auth.uid());
create policy wa_insert on public.wrong_answers for insert with check (student_id = auth.uid());
create policy wa_update on public.wrong_answers for update using (student_id = auth.uid());
create policy wa_delete on public.wrong_answers for delete using (student_id = auth.uid());
grant all on public.wrong_answers to authenticated;

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
    question_text  = excluded.question_text,
    correct_answer = excluded.correct_answer,
    user_answer    = excluded.user_answer,
    status         = 'open',
    resolved_at    = null,
    updated_at     = now();
end; $$;

create or replace function public.rpc_resolve_wrong_answer(p_question_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.wrong_answers
    set status = 'resolved', resolved_at = now(), updated_at = now()
    where student_id = auth.uid() and question_id = p_question_id;
end; $$;

grant execute on function public.rpc_save_wrong_answer(text, integer, text, text, text) to authenticated;
grant execute on function public.rpc_resolve_wrong_answer(text) to authenticated;
