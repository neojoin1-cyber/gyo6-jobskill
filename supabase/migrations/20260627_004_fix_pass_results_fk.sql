-- pass_exam_results.student_id FK를 auth.users → profiles(id)로 수정
-- 이유: 교사가 결과 조회 시 profiles 테이블과의 조인이 가능해야 학생 이름을 표시할 수 있음.
-- auth.users.id = profiles.id (1:1) 이므로 기존 데이터 무결성에 영향 없음.
alter table public.pass_exam_results
  drop constraint if exists pass_exam_results_student_id_fkey;

alter table public.pass_exam_results
  add constraint pass_exam_results_student_id_fkey
  foreign key (student_id) references public.profiles(id) on delete cascade;
