-- Applied installations need the same explicit RPC permission hardening as fresh installs.
REVOKE ALL ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_my_cover_letters() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_submit_cover_letter(text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_my_cover_letters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_cover_letters(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_cover_letter(uuid, text, jsonb, text) TO authenticated;
