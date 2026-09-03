-- PostgREST cannot choose between the legacy enum overload and the current
-- text contract. Keep one public signature so account creation is callable.
DROP FUNCTION IF EXISTS public.rpc_admin_create_user(
  text, text, text, public.user_role, uuid, uuid, text
);
