-- =============================================================================
-- 개발용 시드 데이터
-- 실제 적용 방법:
--   1. Supabase Dashboard → Authentication → Users 에서 교사/학생 계정 생성
--   2. 아래 UUID를 실제 auth.users.id 로 교체한 뒤 실행
-- =============================================================================

-- ─ 학교 ───────────────────────────────────────────────────────────────────────
insert into schools(id, name, region, national_ranking_opt_in) values
  ('00000000-0000-0000-0000-000000000001', '한빛직업학교', '서울', true)
on conflict do nothing;

-- ─ 교사 2명 프로필 (UUID는 실제 auth.users.id 로 교체) ────────────────────────
-- insert into profiles(id, role, display_name, school_id) values
--   ('teacher-uuid-0001', 'teacher', '김지수', 'sch-0000-0000-0001'),
--   ('teacher-uuid-0002', 'teacher', '박민준', 'sch-0000-0000-0001');

-- ─ 학급 2개 ───────────────────────────────────────────────────────────────────
-- insert into classes(id, school_id, name, grade, class_code) values
--   ('cls-0000-0001', 'sch-0000-0000-0001', '2-1반', 2, 'ABCD1234'),
--   ('cls-0000-0002', 'sch-0000-0000-0001', '2-2반', 2, 'EFGH5678');

-- ─ teacher_classes ────────────────────────────────────────────────────────────
-- insert into teacher_classes(teacher_id, class_id) values
--   ('teacher-uuid-0001', 'cls-0000-0001'),
--   ('teacher-uuid-0002', 'cls-0000-0002');

-- ─ 학생 5명 ───────────────────────────────────────────────────────────────────
-- insert into profiles(id, role, display_name, nickname, school_id) values
--   ('student-uuid-0001', 'student', '이수연', '수연이', 'sch-0000-0000-0001'),
--   ('student-uuid-0002', 'student', '정민호', '민호짱', 'sch-0000-0000-0001'),
--   ('student-uuid-0003', 'student', '최유진', '유진별', 'sch-0000-0000-0001'),
--   ('student-uuid-0004', 'student', '강도현', '도현이', 'sch-0000-0000-0001'),
--   ('student-uuid-0005', 'student', '윤서아', '서아달', 'sch-0000-0000-0001');

-- insert into student_classes(student_id, class_id) values
--   ('student-uuid-0001', 'cls-0000-0001'),
--   ('student-uuid-0002', 'cls-0000-0001'),
--   ('student-uuid-0003', 'cls-0000-0001'),
--   ('student-uuid-0004', 'cls-0000-0002'),
--   ('student-uuid-0005', 'cls-0000-0002');

-- ─ 미션 1개 ───────────────────────────────────────────────────────────────────
-- (question_ids 는 실제 questions.json id 사용)
-- insert into missions(
--   id, class_id, created_by, title, mission_type, status,
--   question_ids, area_ids, question_count, due_at
-- ) values (
--   'msn-0000-0001', 'cls-0000-0001', 'teacher-uuid-0001',
--   '1학기 중간고사 의사소통능력', '중간고사', 'active',
--   ARRAY['C01-0-Q01','C01-0-Q02','C01-0-Q03','C01-0-Q04','C01-0-Q05',
--         'C09-8-Q01','C09-8-Q02','C09-8-Q03','C09-8-Q04','C09-8-Q05'],
--   ARRAY['a01'],
--   10,
--   now() + interval '7 days'
-- );
