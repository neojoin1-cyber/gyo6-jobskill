-- Play account deletion requirement: authenticated students and teachers can
-- remove their own account and all rows that cascade from auth.users.
CREATE OR REPLACE FUNCTION public.rpc_delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.user_role;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION '총괄관리자 계정은 관리자 콘솔에서 처리해야 합니다';
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION '삭제할 계정을 찾을 수 없습니다';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.rpc_delete_my_account() IS
  'Deletes the authenticated non-admin account and cascading application data.';
