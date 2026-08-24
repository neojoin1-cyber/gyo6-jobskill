-- 2026-07-10: 교사 학생 승인/거절 + 관리자 회원 삭제가 RLS로 무반응(no-op)이던 실사고 수정.
-- 클라이언트 직접 update/delete 대신 서버에서 담당 관계를 검증하는 security definer RPC 제공.
-- (auth.users 삭제 시 profiles·student_classes는 FK cascade로 함께 정리 — 유령 계정/재가입 불가 방지)

-- 교사(담당 학급)·학교관리자(자기 학교)·총관리자만 학생 승인
create or replace function rpc_approve_student(p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (
      select 1 from student_classes sc
      join teacher_classes tc on tc.class_id = sc.class_id
      where sc.student_id = p_student and tc.teacher_id = auth.uid()
    )
    or (my_profile_role() = 'school_admin' and exists (
      select 1 from profiles p where p.id = p_student and p.school_id = my_school_id()
    ))
    or my_profile_role() = 'admin'
  ) then
    raise exception '해당 학생을 승인할 권한이 없습니다';
  end if;
  update profiles set approved = true where id = p_student and role = 'student';
end $$;

-- 거절: 미승인 학생만 계정 정리(승인된 학생 오삭제 방지). auth.users 삭제 → 전체 cascade.
create or replace function rpc_reject_student(p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (
      select 1 from student_classes sc
      join teacher_classes tc on tc.class_id = sc.class_id
      where sc.student_id = p_student and tc.teacher_id = auth.uid()
    )
    or (my_profile_role() = 'school_admin' and exists (
      select 1 from profiles p where p.id = p_student and p.school_id = my_school_id()
    ))
    or my_profile_role() = 'admin'
  ) then
    raise exception '해당 학생을 거절할 권한이 없습니다';
  end if;
  if exists (select 1 from profiles where id = p_student and role = 'student' and approved = false) then
    delete from auth.users where id = p_student;
  else
    -- 이미 승인됐거나 학생이 아니면 학급 신청만 철회
    delete from student_classes where student_id = p_student;
  end if;
end $$;

-- 총관리자 회원 삭제: profiles만 지우면 auth.users가 남아 재가입 불가·유령 계정 발생 → auth까지 정리
create or replace function rpc_admin_delete_member(p_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_profile_role() <> 'admin' then
    raise exception '총관리자만 회원을 삭제할 수 있습니다';
  end if;
  if p_uid = auth.uid() then
    raise exception '자기 자신은 삭제할 수 없습니다';
  end if;
  if exists (select 1 from profiles where id = p_uid and role = 'admin') then
    raise exception '다른 총관리자 계정은 삭제할 수 없습니다';
  end if;
  delete from auth.users where id = p_uid;
end $$;

grant execute on function rpc_approve_student(uuid)    to authenticated;
grant execute on function rpc_reject_student(uuid)     to authenticated;
grant execute on function rpc_admin_delete_member(uuid) to authenticated;
