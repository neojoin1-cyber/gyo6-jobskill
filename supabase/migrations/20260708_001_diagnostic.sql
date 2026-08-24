-- Phase 4: 진단평가(diagnostic) 서버 저장 지원
-- mock_assessments.kind 에 'diagnostic' 허용 + 영역별 성취도(area_scores) 컬럼 추가.
-- 교사가 학급 진단 현황(영역별 취약)을 보고 모의고사를 열 수 있도록 함.

-- 1) kind 체크 제약 교체 (area/exam → area/exam/diagnostic)
alter table mock_assessments drop constraint if exists mock_assessments_kind_check;
alter table mock_assessments
  add constraint mock_assessments_kind_check
  check (kind in ('area', 'exam', 'diagnostic'));

-- 2) 영역별 성취도 저장(jsonb): { "의사소통": {"total":3,"correct":1}, ... }
alter table mock_assessments
  add column if not exists area_scores jsonb default '{}'::jsonb;

-- 3) 학급 진단 현황 뷰: 교사 담당 학급 학생들의 최신 진단 성취도 + 취약 영역
--    (rpc가 아닌 뷰 — RLS는 mock_assessments 기존 정책을 따름. 교사 조회는 아래 rpc로 통제)
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
  ) and coalesce(my_profile_role(), '') <> 'admin' then
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

grant execute on function rpc_class_diagnostics(uuid) to authenticated;
