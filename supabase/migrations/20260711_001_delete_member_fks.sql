-- 2026-07-11: rpc_admin_delete_member 검증(T3)에서 발견 — profiles를 참조하는 비-cascade FK 3건이
-- 회원 완전 삭제를 차단(FK violation). 자료 성격에 맞게 정리:
--   · missions.created_by / open_mock_exams.opened_by = 작성자 표시 → SET NULL (학급 공용 자료는 보존)
--   · submissions.student_id = 학생 개인 답안 → CASCADE (본인 삭제 시 함께 정리)

alter table missions alter column created_by drop not null;
alter table missions drop constraint missions_created_by_fkey;
alter table missions add constraint missions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table open_mock_exams alter column opened_by drop not null;
alter table open_mock_exams drop constraint open_mock_exams_opened_by_fkey;
alter table open_mock_exams add constraint open_mock_exams_opened_by_fkey
  foreign key (opened_by) references profiles(id) on delete set null;

alter table submissions drop constraint submissions_student_id_fkey;
alter table submissions add constraint submissions_student_id_fkey
  foreign key (student_id) references profiles(id) on delete cascade;
