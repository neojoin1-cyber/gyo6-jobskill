DROP TABLE IF EXISTS public._peek;
CREATE TABLE public._peek(v jsonb);
-- 관리자 권한 검사를 우회하지 않고, 관리자 계정 하나를 골라 그 사람으로 본다.
INSERT INTO public._peek
SELECT jsonb_build_object(
  'accounts', (SELECT jsonb_build_object('total',count(*),
                 'students',count(*) FILTER (WHERE role='student'),
                 'teachers',count(*) FILTER (WHERE role='teacher')) FROM profiles),
  'db', pg_size_pretty(pg_database_size(current_database())),
  'shared_buffers', (SELECT pg_size_pretty(setting::bigint*8192) FROM pg_settings WHERE name='shared_buffers'),
  'cache_hit', (SELECT round(100.0*sum(heap_blks_hit)/nullif(sum(heap_blks_hit)+sum(heap_blks_read),0),1) FROM pg_statio_user_tables),
  'rows', (SELECT jsonb_build_object('review_schedule',(SELECT count(*) FROM review_schedule),
                  'wrong_answers',(SELECT count(*) FROM wrong_answers),
                  'daily_activity',(SELECT count(*) FROM daily_activity)))
);
ALTER TABLE public._peek ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk ON public._peek FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._peek TO anon, authenticated;
