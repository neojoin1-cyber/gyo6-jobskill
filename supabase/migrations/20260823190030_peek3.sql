DROP TABLE IF EXISTS public._peek;
CREATE TABLE public._peek(v jsonb);
INSERT INTO public._peek
SELECT jsonb_build_object(
  'db', pg_size_pretty(pg_database_size(current_database())),
  'review_rows', (SELECT count(*) FROM review_schedule),
  'review_size', pg_size_pretty(pg_total_relation_size('public.review_schedule')),
  'shared_buffers', (SELECT pg_size_pretty(setting::bigint*8192) FROM pg_settings WHERE name='shared_buffers'));
ALTER TABLE public._peek ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk ON public._peek FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._peek TO anon, authenticated;
