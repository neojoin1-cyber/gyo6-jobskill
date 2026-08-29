-- 운영 자동검증과 계정 복구 도구가 학생 근거은행의 존재 여부를 확인할 수 있게 한다.
-- 학생 앱의 RLS 소유자 제한은 그대로 유지된다.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.cover_letter_evidence
  TO service_role;
