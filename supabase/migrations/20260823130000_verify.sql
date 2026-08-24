-- 검증 결과를 잠깐 담아 두는 표. 바로 다음 마이그레이션에서 지운다.
DROP TABLE IF EXISTS public._verify_scale;
CREATE TABLE public._verify_scale (k text primary key, v text);
INSERT INTO public._verify_scale(k, v)
SELECT 'RLS 미최적화 정책', count(*)::text
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (coalesce(qual,'') ~ 'auth\.(uid|role|jwt)\(\)'
     OR coalesce(with_check,'') ~ 'auth\.(uid|role|jwt)\(\)')
   AND (coalesce(qual,'') ~ '(?<!SELECT )auth\.' IS NOT FALSE)
   AND NOT (coalesce(qual,'') || coalesce(with_check,'')) ~ 'SELECT auth\.';
INSERT INTO public._verify_scale(k, v)
SELECT '인덱스 없는 외래키', count(*)::text
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
 WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
   AND array_length(con.conkey,1) = 1
   AND NOT EXISTS (SELECT 1 FROM pg_index idx
                     JOIN pg_attribute ia ON ia.attrelid = idx.indexrelid AND ia.attnum = 1
                    WHERE idx.indrelid = con.conrelid AND ia.attname = att.attname);
INSERT INTO public._verify_scale(k, v)
SELECT '없는 알림 RPC', count(*)::text
  FROM unnest(array['rpc_mark_notification_read','rpc_mark_all_notifications_read']) f
 WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname='public' AND p.proname = f);
INSERT INTO public._verify_scale(k, v)
SELECT '전체 RLS 정책 수', count(*)::text FROM pg_policies WHERE schemaname='public';
INSERT INTO public._verify_scale(k, v)
SELECT '새로 생긴 인덱스', count(*)::text
  FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%\_idx';
ALTER TABLE public._verify_scale ENABLE ROW LEVEL SECURITY;
CREATE POLICY vs_read ON public._verify_scale FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._verify_scale TO anon, authenticated;
