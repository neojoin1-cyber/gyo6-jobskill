-- Students already have row-level SELECT access only to sessions for their own
-- classes. Publishing this table lets the app discover lesson start/focus/end
-- changes immediately while Realtime continues to enforce those policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'class_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sessions;
  END IF;
END $$;
