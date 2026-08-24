-- =============================================================================
-- 모의평가 (Mock Assessment) — 학생 자율 응시 + 결과 교사 전송
-- 2026-06-26
--
-- 설계 원칙:
--  - 기존 missions/submissions/랭킹 뷰는 절대 건드리지 않는다 (운영 랭킹 보호).
--  - 모의평가는 별도 테이블에 격리한다 (자율학습 성격, 학급 랭킹과 분리).
--  - 객관식은 클라이언트 자동채점, 서술형은 교사 채점 대기(pending).
-- =============================================================================

-- =============================================================================
-- 1. mock_assessments 테이블
-- =============================================================================
create table if not exists mock_assessments (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id) on delete cascade,
  class_id        uuid references classes(id) on delete set null,  -- 교사 조회용(없을 수 있음)
  subject_id      text not null,                  -- job-common / ncs-basic / food-service ...
  kind            text not null default 'area'
                    check (kind in ('area', 'exam')),  -- 영역별 모의평가 / 과목별 모의고사
  title           text not null,
  area_ids        text[] not null default '{}',
  question_ids    text[] not null default '{}',

  -- 채점 결과
  answers         jsonb not null default '{}',    -- 객관식 선택 { qId: idx }
  typed_answers   jsonb not null default '{}',    -- 서술형 답안 { qId: "텍스트" }
  auto_score      smallint not null default 0,    -- 객관식 정답 수
  auto_total      smallint not null default 0,    -- 객관식 문항 수
  typed_total     smallint not null default 0,    -- 서술형 문항 수
  total_questions smallint not null default 0,
  teacher_grades  jsonb,                           -- { qId: 'O'|'X' }
  bonus_score     smallint not null default 0,     -- 서술형 정답(O) 수
  grading_status  text not null default 'auto'
                    check (grading_status in ('auto', 'pending', 'graded')),

  time_taken_sec  int,
  time_limit_min  smallint,
  created_at      timestamptz not null default now()
);

create index if not exists idx_mock_student   on mock_assessments(student_id, created_at desc);
create index if not exists idx_mock_class     on mock_assessments(class_id, created_at desc);
create index if not exists idx_mock_pending   on mock_assessments(grading_status)
  where grading_status = 'pending';

-- =============================================================================
-- 2. 권한 + RLS
-- =============================================================================
grant all on mock_assessments to authenticated, service_role;

alter table mock_assessments enable row level security;

-- 학생: 본인 모의평가 전체 접근
drop policy if exists "mock_student_own" on mock_assessments;
create policy "mock_student_own" on mock_assessments for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- 교사: 담당 학급 학생의 모의평가 읽기
drop policy if exists "mock_teacher_read" on mock_assessments;
create policy "mock_teacher_read" on mock_assessments for select
  using (
    exists (
      select 1 from teacher_classes tc
      where tc.class_id   = mock_assessments.class_id
        and tc.teacher_id = auth.uid()
    )
  );

-- 교사: 담당 학급 학생의 서술형 채점(업데이트)
drop policy if exists "mock_teacher_grade" on mock_assessments;
create policy "mock_teacher_grade" on mock_assessments for update
  using (
    exists (
      select 1 from teacher_classes tc
      where tc.class_id   = mock_assessments.class_id
        and tc.teacher_id = auth.uid()
    )
  );

-- 관리자: 전체 읽기
drop policy if exists "mock_admin_read" on mock_assessments;
create policy "mock_admin_read" on mock_assessments for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- =============================================================================
-- 3. rpc_submit_mock_assessment — 학생 제출
-- =============================================================================
create or replace function rpc_submit_mock_assessment(
  p_subject_id      text,
  p_kind            text,
  p_title           text,
  p_area_ids        text[],
  p_question_ids    text[],
  p_answers         jsonb,            -- { qId: idx, _score: 자동채점점수 }
  p_typed_answers   jsonb default '{}',
  p_auto_total      int  default 0,   -- 객관식 문항 수
  p_time_taken_sec  int  default null,
  p_time_limit_min  int  default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid          uuid := auth.uid();
  v_class_id     uuid;
  v_auto_score   smallint := 0;
  v_typed_total  smallint := 0;
  v_total        smallint;
  v_status       text;
  v_id           uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 학생의 학급 1개 선택(최근 입장 우선) — 없으면 null(자율 응시)
  select sc.class_id into v_class_id
  from student_classes sc
  where sc.student_id = v_uid
  order by sc.joined_at desc
  limit 1;

  -- 자동채점 점수(_score)
  if p_answers ? '_score' then
    v_auto_score := (p_answers->>'_score')::smallint;
  end if;

  -- 서술형 문항 수
  select count(*) into v_typed_total
  from jsonb_object_keys(coalesce(p_typed_answers, '{}'::jsonb));

  v_total  := p_auto_total + v_typed_total;
  v_status := case when v_typed_total > 0 then 'pending' else 'auto' end;

  insert into mock_assessments(
    student_id, class_id, subject_id, kind, title,
    area_ids, question_ids, answers, typed_answers,
    auto_score, auto_total, typed_total, total_questions,
    grading_status, time_taken_sec, time_limit_min
  ) values (
    v_uid, v_class_id, p_subject_id, coalesce(p_kind, 'area'), p_title,
    coalesce(p_area_ids, '{}'), coalesce(p_question_ids, '{}'),
    p_answers - '_score', coalesce(p_typed_answers, '{}'),
    v_auto_score, p_auto_total, v_typed_total, v_total,
    v_status, p_time_taken_sec, p_time_limit_min
  )
  returning id into v_id;

  -- 본인 완료 알림
  insert into notifications(user_id, type, title, payload)
  values (
    v_uid, 'system', '모의평가를 완료했어요!',
    jsonb_build_object(
      'mock_id', v_id, 'subject_id', p_subject_id,
      'score', v_auto_score, 'total', v_total, 'grading_status', v_status
    )
  );

  -- 서술형 채점 대기 시, 담당 교사에게 알림
  if v_status = 'pending' and v_class_id is not null then
    insert into notifications(user_id, type, title, body, payload)
    select tc.teacher_id, 'system', '학생 모의평가 채점 요청',
           p_title,
           jsonb_build_object('mock_id', v_id, 'student_id', v_uid)
    from teacher_classes tc
    where tc.class_id = v_class_id;
  end if;

  return jsonb_build_object(
    'mock_id',        v_id,
    'score',          v_auto_score,
    'total',          v_total,
    'grading_status', v_status
  );
end;
$$;

-- =============================================================================
-- 4. rpc_grade_mock_assessment — 교사 서술형 채점 (Stage 4 교사 UI에서 사용)
-- =============================================================================
create or replace function rpc_grade_mock_assessment(
  p_mock_id  uuid,
  p_grades   jsonb     -- { qId: 'O'|'X' }
)
returns jsonb
language plpgsql security definer as $$
declare
  v_mock   mock_assessments%rowtype;
  v_bonus  int := 0;
  v_key    text;
  v_val    text;
begin
  select * into v_mock from mock_assessments where id = p_mock_id;
  if not found then raise exception '모의평가 제출 내역을 찾을 수 없습니다'; end if;

  -- 담당 교사 확인
  if not exists (
    select 1 from teacher_classes tc
    where tc.class_id = v_mock.class_id and tc.teacher_id = auth.uid()
  ) then
    raise exception '채점 권한이 없습니다';
  end if;

  if v_mock.grading_status = 'graded' then
    raise exception '이미 채점이 완료되었습니다';
  end if;

  for v_key, v_val in select * from jsonb_each_text(p_grades) loop
    if v_val = 'O' then v_bonus := v_bonus + 1; end if;
  end loop;

  update mock_assessments set
    teacher_grades = p_grades,
    bonus_score    = v_bonus,
    grading_status = 'graded'
  where id = p_mock_id;

  -- 학생에게 채점 완료 알림
  insert into notifications(user_id, type, title, payload)
  values (
    v_mock.student_id, 'system', '모의평가 서술형 채점이 완료되었어요!',
    jsonb_build_object('mock_id', p_mock_id, 'bonus_score', v_bonus)
  );

  return jsonb_build_object(
    'graded_count', (select count(*) from jsonb_object_keys(p_grades)),
    'bonus_score',  v_bonus
  );
end;
$$;
