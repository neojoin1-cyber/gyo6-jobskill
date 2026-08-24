-- 부하 테스트가 남긴 행까지 지우고 디스크를 되돌린다.
--
-- 일반 VACUUM 은 페이지를 재사용 가능으로만 표시해 파일 크기가 그대로다.
-- 측정 때문에 1.5GB 로 부푼 것을 그대로 두면 디스크 요금이 계속 나간다.
-- 남은 행이 1만 개뿐이라 VACUUM FULL 이 순식간에 끝난다.
SET statement_timeout = '900s';
DELETE FROM public.review_schedule WHERE subject IN ('loadtest', 'synctest', '__bloat__');
VACUUM FULL public.review_schedule;
ANALYZE public.review_schedule;
