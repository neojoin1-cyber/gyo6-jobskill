-- 부하 테스트가 남긴 행 정리.
-- run.mjs 의 쓰기 시나리오는 subject='loadtest' 로 표시해 둔다. 그 표시가
-- 없으면 실제 학습 기록과 섞여 지울 수 없다 — 표시는 선택이 아니라 필수다.
DELETE FROM public.review_schedule WHERE subject = 'loadtest';
