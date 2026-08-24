DROP TABLE IF EXISTS public._cap;
CREATE TABLE public._cap (k text primary key, v text);
INSERT INTO public._cap(k,v)
SELECT name, setting || coalesce(' ' || unit, '')
  FROM pg_settings
 WHERE name IN ('max_connections','shared_buffers','effective_cache_size','work_mem',
                'maintenance_work_mem','max_worker_processes','max_parallel_workers',
                'server_version','statement_timeout','max_wal_size');
INSERT INTO public._cap(k,v) VALUES
  ('_db_size', pg_size_pretty(pg_database_size(current_database()))),
  ('_authenticator_limit', (SELECT rolconnlimit::text FROM pg_roles WHERE rolname='authenticator')),
  ('_rows_review_schedule', (SELECT count(*)::text FROM public.review_schedule)),
  ('_rows_profiles', (SELECT count(*)::text FROM public.profiles)),
  ('_rows_wrong_answers', (SELECT count(*)::text FROM public.wrong_answers));
ALTER TABLE public._cap ENABLE ROW LEVEL SECURITY;
CREATE POLICY cap_read ON public._cap FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._cap TO anon, authenticated;
