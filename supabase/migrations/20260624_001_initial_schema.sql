-- =============================================================================
-- GYO6 직업공통능력 학습 플랫폼 — 초기 스키마
-- 2026-06-24
-- =============================================================================

-- ── 확장 ──────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── ENUM 타입 ─────────────────────────────────────────────────────────────────
create type user_role as enum ('teacher', 'student');
create type mission_type as enum (
  '이번시간', '오늘', '이번주', '중간고사', '기말고사', '인증평가'
);
create type mission_status as enum ('draft', 'active', 'closed');
create type notification_type as enum (
  'mission_assigned', 'mission_due_soon', 'mission_closed',
  'ranking_updated', 'reward_earned', 'system'
);

-- =============================================================================
-- 1. schools
-- =============================================================================
create table schools (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  region                  text,                        -- 시/도 (선택)
  national_ranking_opt_in boolean not null default false,
  created_at              timestamptz not null default now()
);

-- =============================================================================
-- 2. profiles  (auth.users 1:1)
-- =============================================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         user_role not null,
  display_name text not null,
  nickname     text,          -- 전국 랭킹용 닉네임 (미성년자 실명 보호)
  school_id    uuid references schools(id),
  created_at   timestamptz not null default now()
);

comment on column profiles.nickname is
  '전국 랭킹에서만 표시. 실명 대신 사용. 학교 opt-in 시에만 전국 랭킹 노출.';

-- =============================================================================
-- 3. classes
-- =============================================================================
create table classes (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id),
  name          text not null,             -- ex) "2-3반", "직업기초능력반"
  grade         smallint,                  -- 1·2·3학년 (nullable — 비학교 기관 대비)
  academic_year smallint not null default extract(year from now())::smallint,
  class_code    char(8) not null unique,   -- 학생 입장 코드 (대문자+숫자)
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- 4. teacher_classes  (교사 ↔ 학급 다대다)
-- =============================================================================
create table teacher_classes (
  teacher_id uuid not null references profiles(id) on delete cascade,
  class_id   uuid not null references classes(id)  on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (teacher_id, class_id)
);

-- =============================================================================
-- 5. student_classes  (학생 ↔ 학급; 일반적으로 1:1 이지만 재수강 등 고려)
-- =============================================================================
create table student_classes (
  student_id  uuid not null references profiles(id) on delete cascade,
  class_id    uuid not null references classes(id)  on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (student_id, class_id)
);

-- =============================================================================
-- 6. missions
-- =============================================================================
create table missions (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references classes(id),
  created_by      uuid not null references profiles(id),
  title           text not null,
  mission_type    mission_type not null,
  status          mission_status not null default 'draft',
  -- 문항 풀: questions.json id 배열 (area_ids 필터 결과를 교사가 확정)
  question_ids    text[] not null default '{}',
  area_ids        text[] not null default '{}',  -- a01-a09 필터 기록용
  question_count  smallint not null default 10,
  time_limit_min  smallint,                       -- null = 시간 제한 없음
  shuffle         boolean not null default true,
  due_at          timestamptz,
  created_at      timestamptz not null default now(),
  activated_at    timestamptz,
  closed_at       timestamptz
);

-- =============================================================================
-- 7. submissions
-- =============================================================================
create table submissions (
  id              uuid primary key default gen_random_uuid(),
  mission_id      uuid not null references missions(id),
  student_id      uuid not null references profiles(id),
  -- answers: { "question_id": "A" | "B" | "C" | "D" | "E" | null }
  answers         jsonb not null default '{}',
  score           smallint not null default 0,   -- 정답 수
  total_questions smallint not null,
  time_taken_sec  int,
  completed_at    timestamptz not null default now(),
  unique (mission_id, student_id)                -- 1회만 제출
);

-- =============================================================================
-- 8. rewards  (정답 보너스, 미션 완료 뱃지 등)
-- =============================================================================
create table rewards (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  mission_id   uuid references missions(id),
  reward_type  text not null,    -- 'mission_complete', 'perfect_score', 'streak_3', ...
  amount       int  not null default 1,
  earned_at    timestamptz not null default now()
);

-- =============================================================================
-- 9. notifications  (인앱 전용 — 이메일/SMS 없음)
-- =============================================================================
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  type         notification_type not null,
  title        text not null,
  body         text,
  payload      jsonb default '{}',
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_user_unread on notifications(user_id, is_read)
  where is_read = false;

-- =============================================================================
-- 10. 랭킹 뷰
-- =============================================================================

-- 학급 내 개인 랭킹
-- rank_in_class 는 학급별 누적 총점 기준. 윈도우 함수 중첩 금지이므로 CTE 사용.
create view class_rankings as
with student_class_totals as (
  select
    s2.student_id,
    m2.class_id,
    sum(s2.score) as total_score
  from submissions s2
  join missions m2 on m2.id = s2.mission_id
  group by s2.student_id, m2.class_id
)
select
  s.student_id,
  p.display_name,
  p.nickname,
  s.mission_id,
  m.class_id,
  s.score,
  s.total_questions,
  round(s.score::numeric / nullif(s.total_questions, 0) * 100, 1) as pct,
  s.time_taken_sec,
  s.completed_at,
  rank() over (
    partition by m.class_id, s.mission_id
    order by s.score desc, s.time_taken_sec asc nulls last
  ) as rank_in_mission,
  rank() over (
    partition by m.class_id
    order by sct.total_score desc
  ) as rank_in_class
from submissions s
join missions              m   on m.id  = s.mission_id
join profiles              p   on p.id  = s.student_id
join student_class_totals  sct on sct.student_id = s.student_id
                               and sct.class_id  = m.class_id;

comment on view class_rankings is '학급 내 랭킹. display_name 포함. 학급 구성원만 접근.';

-- 전국 랭킹 (학교 opt-in + 닉네임만)
create view national_rankings as
select
  s.student_id,
  p.nickname,                              -- 실명 없음
  sc.id   as school_id,
  sc.name as school_name,
  sc.region,
  m.mission_type,
  sum(s.score)           as total_score,
  count(*)               as missions_done,
  round(avg(s.score::numeric / nullif(s.total_questions,0) * 100), 1) as avg_pct,
  rank() over (
    order by sum(s.score) desc
  ) as national_rank
from submissions s
join missions  m  on m.id  = s.mission_id
join classes   cl on cl.id = m.class_id
join schools   sc on sc.id = cl.school_id
join profiles  p  on p.id  = s.student_id
where sc.national_ranking_opt_in = true
  and p.nickname is not null             -- 닉네임 미설정자 제외
group by s.student_id, p.nickname, sc.id, sc.name, sc.region, m.mission_type;

comment on view national_rankings is
  '전국 랭킹. 학교 opt-in + 학생 닉네임 설정 시에만 노출. 실명·이메일 없음.';

-- =============================================================================
-- GRANT (authenticated 역할에 테이블 접근 권한 부여 — RLS로 행 필터링)
-- =============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

-- =============================================================================
-- RLS 헬퍼 함수 (SECURITY DEFINER — profiles 자기참조 순환 방지)
-- =============================================================================
create or replace function my_profile_role() returns user_role
language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_school_id() returns uuid
language sql security definer stable as $$
  select school_id from profiles where id = auth.uid()
$$;

-- =============================================================================
-- RLS (Row-Level Security)
-- =============================================================================
alter table schools         enable row level security;
alter table profiles        enable row level security;
alter table classes         enable row level security;
alter table teacher_classes enable row level security;
alter table student_classes enable row level security;
alter table missions        enable row level security;
alter table submissions     enable row level security;
alter table rewards         enable row level security;
alter table notifications   enable row level security;

-- ── schools ──────────────────────────────────────────────────────────────────
-- 누구나 읽기 (학교 이름/지역 공개); 생성은 서비스 롤
create policy "schools_read_all" on schools for select using (true);

-- ── profiles ─────────────────────────────────────────────────────────────────
create policy "profiles_read_own" on profiles for select
  using (id = auth.uid());

create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own" on profiles for insert
  with check (id = auth.uid());

-- 교사는 같은 학교 학생 프로필 읽기 (헬퍼 함수로 자기참조 순환 방지)
create policy "profiles_teacher_read_school" on profiles for select
  using (
    my_profile_role() = 'teacher'
    and my_school_id() = profiles.school_id
  );

-- ── classes ──────────────────────────────────────────────────────────────────
-- 교사: 자신이 담당하는 학급만 읽기/쓰기
create policy "classes_teacher_manage" on classes for all
  using (
    exists (
      select 1 from teacher_classes tc
      where tc.class_id   = classes.id
        and tc.teacher_id = auth.uid()
    )
  );

-- 학생: 자신이 속한 학급 읽기
create policy "classes_student_read" on classes for select
  using (
    exists (
      select 1 from student_classes sc
      where sc.class_id  = classes.id
        and sc.student_id = auth.uid()
    )
  );

-- ── teacher_classes ───────────────────────────────────────────────────────────
create policy "tc_own" on teacher_classes for all
  using (teacher_id = auth.uid());

-- ── student_classes ───────────────────────────────────────────────────────────
create policy "sc_own" on student_classes for all
  using (student_id = auth.uid());

-- 교사는 담당 학급 학생 목록 읽기
create policy "sc_teacher_read" on student_classes for select
  using (
    exists (
      select 1 from teacher_classes tc
      where tc.class_id   = student_classes.class_id
        and tc.teacher_id = auth.uid()
    )
  );

-- ── missions ──────────────────────────────────────────────────────────────────
create policy "missions_teacher_manage" on missions for all
  using (created_by = auth.uid());

create policy "missions_student_read_active" on missions for select
  using (
    status in ('active', 'closed')
    and exists (
      select 1 from student_classes sc
      where sc.class_id  = missions.class_id
        and sc.student_id = auth.uid()
    )
  );

-- ── submissions ──────────────────────────────────────────────────────────────
create policy "submissions_own" on submissions for all
  using (student_id = auth.uid());

-- 교사: 담당 학급 제출물 읽기
create policy "submissions_teacher_read" on submissions for select
  using (
    exists (
      select 1 from missions m
      join teacher_classes tc on tc.class_id = m.class_id
      where m.id           = submissions.mission_id
        and tc.teacher_id  = auth.uid()
    )
  );

-- ── rewards ──────────────────────────────────────────────────────────────────
create policy "rewards_own" on rewards for select
  using (student_id = auth.uid());

-- ── notifications ────────────────────────────────────────────────────────────
create policy "notif_own" on notifications for all
  using (user_id = auth.uid());

-- =============================================================================
-- RPC 함수
-- =============================================================================

-- ── class_code 생성 헬퍼 ──────────────────────────────────────────────────────
create or replace function generate_class_code()
returns char(8)
language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 혼동 글자 제외
  code  char(8);
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from classes where class_code = code);
  end loop;
  return code;
end;
$$;

-- ── 교사 프로필 생성 (회원가입 후 호출) ────────────────────────────────────────
create or replace function rpc_create_teacher_profile(
  p_display_name text,
  p_school_id    uuid
)
returns uuid
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into profiles(id, role, display_name, school_id)
  values (v_uid, 'teacher', p_display_name, p_school_id)
  on conflict (id) do update
    set display_name = excluded.display_name,
        school_id    = excluded.school_id;

  return v_uid;
end;
$$;

-- ── 학급 생성 ────────────────────────────────────────────────────────────────
create or replace function rpc_create_class(
  p_name          text,
  p_grade         smallint default null,
  p_academic_year smallint default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid      uuid := auth.uid();
  v_school   uuid;
  v_code     char(8);
  v_class_id uuid;
begin
  -- 교사인지 확인 + 학교 가져오기
  select school_id into v_school
  from profiles
  where id = v_uid and role = 'teacher';

  if not found then
    raise exception 'Only teachers can create classes';
  end if;

  v_code := generate_class_code();

  insert into classes(school_id, name, grade, academic_year, class_code)
  values (
    v_school,
    p_name,
    p_grade,
    coalesce(p_academic_year, extract(year from now())::smallint),
    v_code
  )
  returning id into v_class_id;

  insert into teacher_classes(teacher_id, class_id)
  values (v_uid, v_class_id);

  return jsonb_build_object(
    'class_id',   v_class_id,
    'class_code', v_code
  );
end;
$$;

-- ── 학생 프로필 생성 + 학급 입장 ──────────────────────────────────────────────
create or replace function rpc_student_join(
  p_display_name text,
  p_nickname     text,
  p_class_code   char(8)
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid      uuid := auth.uid();
  v_class    record;
begin
  -- 학급 코드 확인
  select id, school_id, name into v_class
  from classes
  where class_code = upper(p_class_code);

  if not found then
    raise exception 'Invalid class code: %', p_class_code;
  end if;

  -- 프로필 생성(없으면) 또는 업데이트
  insert into profiles(id, role, display_name, nickname, school_id)
  values (v_uid, 'student', p_display_name, p_nickname, v_class.school_id)
  on conflict (id) do update
    set display_name = excluded.display_name,
        nickname     = excluded.nickname,
        school_id    = excluded.school_id;

  -- 학급 입장 (중복 방지)
  insert into student_classes(student_id, class_id)
  values (v_uid, v_class.id)
  on conflict do nothing;

  return jsonb_build_object(
    'class_id',   v_class.id,
    'class_name', v_class.name
  );
end;
$$;

-- ── 미션 생성 ────────────────────────────────────────────────────────────────
create or replace function rpc_create_mission(
  p_class_id       uuid,
  p_title          text,
  p_mission_type   mission_type,
  p_question_ids   text[],
  p_area_ids       text[],
  p_question_count smallint  default 10,
  p_time_limit_min smallint  default null,
  p_shuffle        boolean   default true,
  p_due_at         timestamptz default null,
  p_activate_now   boolean   default false
)
returns uuid
language plpgsql security definer as $$
declare
  v_uid       uuid := auth.uid();
  v_mission   uuid;
  v_status    mission_status := case when p_activate_now then 'active'::mission_status else 'draft'::mission_status end;
begin
  -- 교사가 해당 학급 담당인지 확인
  if not exists (
    select 1 from teacher_classes
    where teacher_id = v_uid and class_id = p_class_id
  ) then
    raise exception 'Not a teacher of this class';
  end if;

  insert into missions(
    class_id, created_by, title, mission_type, status,
    question_ids, area_ids, question_count,
    time_limit_min, shuffle, due_at,
    activated_at
  ) values (
    p_class_id, v_uid, p_title, p_mission_type, v_status,
    p_question_ids, p_area_ids, p_question_count,
    p_time_limit_min, p_shuffle, p_due_at,
    case when p_activate_now then now() end
  )
  returning id into v_mission;

  -- 미션 배정 알림 발송
  if p_activate_now then
    insert into notifications(user_id, type, title, body, payload)
    select
      sc.student_id,
      'mission_assigned',
      '새 미션이 배정됐어요',
      p_title,
      jsonb_build_object('mission_id', v_mission)
    from student_classes sc
    where sc.class_id = p_class_id;
  end if;

  return v_mission;
end;
$$;

-- ── 제출 ─────────────────────────────────────────────────────────────────────
create or replace function rpc_submit_mission(
  p_mission_id    uuid,
  p_answers       jsonb,   -- { "C01-0-Q01": "A", ... }
  p_time_taken_sec int default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid          uuid := auth.uid();
  v_mission      record;
  v_score        smallint := 0;
  v_total        smallint;
  v_sub_id       uuid;
  v_correct_json jsonb;
begin
  -- 미션 존재 + active 확인
  select * into v_mission from missions where id = p_mission_id and status = 'active';
  if not found then
    raise exception 'Mission not found or not active';
  end if;

  -- 학생이 해당 학급 소속인지
  if not exists (
    select 1 from student_classes
    where student_id = v_uid and class_id = v_mission.class_id
  ) then
    raise exception 'Not enrolled in this class';
  end if;

  v_total := coalesce(array_length(v_mission.question_ids, 1), 0);

  -- NOTE: 실제 채점은 questions.json을 참조해야 함.
  --       여기선 RPC 레이어에서 채점하지 않고 score를 0으로 저장 후
  --       클라이언트가 채점한 결과를 넘기거나, 별도 채점 RPC를 호출.
  --       (questions.json의 정답 데이터가 DB에 없기 때문)
  --       임시: p_answers 내 _score 키가 있으면 사용
  if p_answers ? '_score' then
    v_score := (p_answers->>'_score')::smallint;
  end if;

  insert into submissions(
    mission_id, student_id, answers, score, total_questions, time_taken_sec
  ) values (
    p_mission_id, v_uid,
    p_answers - '_score',    -- _score 메타 키 제거 후 저장
    v_score, v_total, p_time_taken_sec
  )
  returning id into v_sub_id;

  -- 완료 알림 (자신에게)
  insert into notifications(user_id, type, title, payload)
  values (
    v_uid, 'mission_closed', '미션을 완료했어요!',
    jsonb_build_object('mission_id', p_mission_id, 'score', v_score, 'total', v_total)
  );

  return jsonb_build_object(
    'submission_id', v_sub_id,
    'score',  v_score,
    'total',  v_total
  );
end;
$$;

-- =============================================================================
-- 더미 데이터 (개발·검증용)
-- =============================================================================

-- 학교
insert into schools(id, name, region, national_ranking_opt_in)
values ('00000000-0000-0000-0000-000000000001', '한빛직업학교', '서울', true);

-- 교사·학생 auth 계정은 Supabase Auth로 생성 후 RPC 호출로 프로필 등록.
-- 아래는 dummy UUID를 직접 삽입하는 검증용 데이터 (실제 프로덕션에서는 삭제).

-- 교사 프로필 (auth.users 행 없이는 FK 에러. 실제 적용 시 주석 해제 후 사용.)
-- insert into profiles values ('...', 'teacher', '김선생', null, '00000000-0000-0000-0000-000000000001', now());
