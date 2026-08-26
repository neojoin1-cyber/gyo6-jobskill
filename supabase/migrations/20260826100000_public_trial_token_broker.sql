-- Public web trial: one-time login broker, password rotation, and future-table guard.

CREATE TABLE IF NOT EXISTS public.public_trial_access_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_hash text NOT NULL,
  ip_hash text NOT NULL,
  trial_role text NOT NULL CHECK (trial_role IN ('student', 'teacher', 'school_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_trial_access_device_idx
  ON public.public_trial_access_events (device_hash, trial_role, created_at DESC);
CREATE INDEX IF NOT EXISTS public_trial_access_ip_idx
  ON public.public_trial_access_events (ip_hash, trial_role, created_at DESC);

ALTER TABLE public.public_trial_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_trial_access_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.public_trial_access_events_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_public_trial_session(
  p_device_hash text,
  p_ip_hash text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next timestamptz;
  v_ip_count integer;
BEGIN
  IF p_role NOT IN ('student', 'teacher', 'school_admin')
     OR length(p_device_hash) <> 64 OR length(p_ip_hash) <> 64 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  END IF;

  -- Serialize claims for one browser and role so parallel clicks cannot mint two tickets.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_hash || ':' || p_role, 0));

  SELECT max(created_at) + interval '60 minutes'
    INTO v_next
    FROM public.public_trial_access_events
   WHERE device_hash = p_device_hash
     AND trial_role = p_role
     AND created_at > now() - interval '60 minutes';

  IF v_next IS NOT NULL AND v_next > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown', 'nextAllowedAt', v_next);
  END IF;

  SELECT count(*) INTO v_ip_count
    FROM public.public_trial_access_events
   WHERE ip_hash = p_ip_hash
     AND trial_role = p_role
     AND created_at > now() - interval '60 minutes';

  IF v_ip_count >= 12 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'network_limit');
  END IF;

  INSERT INTO public.public_trial_access_events(device_hash, ip_hash, trial_role)
  VALUES (p_device_hash, p_ip_hash, p_role);

  DELETE FROM public.public_trial_access_events
   WHERE created_at < now() - interval '7 days';

  RETURN jsonb_build_object('allowed', true, 'expiresInSeconds', 900);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_trial_session(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_public_trial_session(text, text, text) TO service_role;

-- Trial identity is metadata-based; the public client no longer knows account emails.
UPDATE auth.users
   SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
       || jsonb_build_object(
         'is_public_trial', true,
         'trial_role', CASE lower(email)
           WHEN 'demo.student@sugarsalt.kr' THEN 'student'
           WHEN 'demo.teacher@sugarsalt.kr' THEN 'teacher'
           WHEN 'demo.admin@sugarsalt.kr' THEN 'school_admin'
         END
       ),
       encrypted_password = extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')),
       updated_at = now()
 WHERE lower(email) IN (
   'demo.student@sugarsalt.kr',
   'demo.teacher@sugarsalt.kr',
   'demo.admin@sugarsalt.kr'
 );

DELETE FROM auth.refresh_tokens
 WHERE user_id IN (
   SELECT id::text FROM auth.users
    WHERE coalesce((raw_user_meta_data ->> 'is_public_trial')::boolean, false)
 );
DELETE FROM auth.sessions
 WHERE user_id IN (
   SELECT id FROM auth.users
    WHERE coalesce((raw_user_meta_data ->> 'is_public_trial')::boolean, false)
 );

CREATE OR REPLACE FUNCTION public.is_public_trial_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users u
     WHERE u.id = (select auth.uid())
       AND coalesce((u.raw_user_meta_data ->> 'is_public_trial')::boolean, false)
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_trial_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_trial_user() TO authenticated;

-- Attach the read-only trigger to the broker audit table created above.
DROP TRIGGER IF EXISTS public_trial_read_only ON public.public_trial_access_events;
CREATE TRIGGER public_trial_read_only
BEFORE INSERT OR UPDATE OR DELETE ON public.public_trial_access_events
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_public_trial_write();

-- Every future public table receives the same guard automatically.
CREATE OR REPLACE FUNCTION public.attach_public_trial_guard_to_new_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  command record;
  target record;
BEGIN
  FOR command IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    SELECT n.nspname AS schema_name, c.relname AS table_name
      INTO target
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = command.objid
       AND n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname <> 'spatial_ref_sys';

    IF target.table_name IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid = command.objid
         AND t.tgname = 'public_trial_read_only'
         AND NOT t.tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER public_trial_read_only BEFORE INSERT OR UPDATE OR DELETE ON %I.%I '
        'FOR EACH STATEMENT EXECUTE FUNCTION public.reject_public_trial_write()',
        target.schema_name,
        target.table_name
      );
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS ensure_public_trial_guard;
CREATE EVENT TRIGGER ensure_public_trial_guard
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'ALTER TABLE')
  EXECUTE FUNCTION public.attach_public_trial_guard_to_new_tables();

COMMENT ON FUNCTION public.claim_public_trial_session(text, text, text) IS
  '서버 전용 공개 체험 발급 제한: 역할별 기기 60분, 접속망 시간당 12회.';
