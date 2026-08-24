-- 초안·검증 미션을 삭제할 때 제출 FK가 삭제를 막아 고아 테스트 자료가 남았다.
-- 제출은 미션에 종속된 답안이므로 미션 삭제 시 함께 정리한다.
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_mission_id_fkey;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;
