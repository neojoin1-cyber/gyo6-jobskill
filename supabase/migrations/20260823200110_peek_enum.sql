DROP TABLE IF EXISTS public._peek;
CREATE TABLE public._peek(v jsonb);
INSERT INTO public._peek
SELECT jsonb_build_object('notification_type',
  (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
     FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname='notification_type'));
ALTER TABLE public._peek ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk ON public._peek FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public._peek TO anon, authenticated;
