-- ============================================================
-- 026: 「invalid input value for enum user_role: ""」 고치기
-- ============================================================
--
-- ── 무엇이 터졌나 ──────────────────────────────────────────────────
-- 교사가 「진단 현황」·「인성검사」 탭을 열면 화면에 이 오류가 떴다.
--
--     invalid input value for enum user_role: ""
--
-- ── 왜 ─────────────────────────────────────────────────────────────
-- 권한 검사에 이렇게 쓰여 있었다.
--
--     coalesce(my_profile_role(), '') <> 'admin'
--
-- `my_profile_role()` 은 **user_role 열거형**을 돌려준다. coalesce 는 두
-- 인자의 타입을 맞추려 하고, 그래서 `''` 를 user_role 로 바꾸려다 터진다.
-- 빈 문자열은 그 열거형의 값이 아니다.
--
-- 프로필이 있든 없든 **호출되는 순간 무조건** 실패한다. 즉 이 두 화면은
-- 지금까지 아무에게도 열리지 않았다.
--
-- ── 어떻게 고치나 ──────────────────────────────────────────────────
-- 같은 계열의 다른 두 함수(rpc_class_weakness, rpc_class_progress)는 이미
-- `my_profile_role()::text` 로 되어 있어 멀쩡했다. 그 방식에 맞춘다.
-- 본문은 원본을 그대로 옮기고 **그 한 줄만** 바꾼다 — 반환 모양을 새로
-- 지어내면 화면 쪽이 깨진다.
--
-- ── 왜 지금 발견됐나 ───────────────────────────────────────────────
-- 체험 계정으로 교사 화면을 전수로 눌러 보다 나왔다. 실제 교사들은 이 탭을
-- 열었다가 오류만 보고 지나갔을 것이다.

create or replace function rpc_class_diagnostics(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- 요청자가 해당 학급 담당 교사인지 확인
  if not exists (
    select 1 from teacher_classes tc
    where tc.class_id = p_class_id and tc.teacher_id = auth.uid()
  ) and coalesce(my_profile_role()::text, '') not in ('school_admin', 'admin') then
    raise exception '권한이 없습니다.';
  end if;

  -- 학급 학생별 최신 진단 결과
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select distinct on (sc.student_id)
      sc.student_id,
      p.display_name,
      ma.auto_score      as score,
      ma.total_questions as total,
      ma.area_scores,
      ma.created_at
    from student_classes sc
    join profiles p on p.id = sc.student_id
    left join mock_assessments ma
      on ma.student_id = sc.student_id
     and ma.kind = 'diagnostic'
    where sc.class_id = p_class_id
    order by sc.student_id, ma.created_at desc nulls last
  ) t;

  return v_result;
end;
$$;
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
  ) and coalesce(my_profile_role()::text, '') not in ('school_admin', 'admin') then
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
grant execute on function rpc_class_diagnostics(uuid) to authenticated;
grant execute on function rpc_class_personality(uuid) to authenticated;
