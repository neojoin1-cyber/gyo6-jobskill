-- 측정용으로 넣은 행을 지운다. subject='__bloat__' 로 표시해 두었다.
SET statement_timeout = '900s';
DELETE FROM public.review_schedule WHERE subject = '__bloat__';
DROP TABLE IF EXISTS public._peek;
VACUUM (ANALYZE) public.review_schedule;
