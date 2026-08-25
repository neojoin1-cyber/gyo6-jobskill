-- ============================================================
-- 공개 웹 체험 계정: 서버 쓰기 차단
-- ============================================================
-- 클라이언트는 체험 중 변경 요청을 로컬 성공으로 처리해 화면 흐름을 보여 준다.
-- 이 트리거는 공개 비밀번호나 access token을 직접 사용한 우회 요청까지 차단한다.

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
       AND lower(u.email) IN (
         'demo.student@sugarsalt.kr',
         'demo.teacher@sugarsalt.kr',
         'demo.admin@sugarsalt.kr'
       )
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_trial_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_trial_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_public_trial_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_public_trial_user() THEN
    RAISE EXCEPTION 'Public trial accounts are read only.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_public_trial_write() FROM PUBLIC;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname NOT LIKE '\_%' ESCAPE '\'
       AND c.relname <> 'spatial_ref_sys'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS public_trial_read_only ON %I.%I',
      target.schema_name,
      target.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER public_trial_read_only '
      'BEFORE INSERT OR UPDATE OR DELETE ON %I.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.reject_public_trial_write()',
      target.schema_name,
      target.table_name
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION public.reject_public_trial_write() IS
  '공개 체험 계정의 public 스키마 변경을 서버에서 차단한다.';

