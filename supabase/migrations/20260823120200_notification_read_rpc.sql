-- 알림 읽음 처리 RPC 두 개 — DB 에 없어서 알림이 한 번도 읽음이 되지 않았다.
--
-- 컬럼 이름 주의: 저장소의 004 파일은 read 로 만들지만, 운영 DB 의
-- notifications 는 **is_read** 다(대시보드에서 따로 만든 테이블이라 갈렸다).
-- 앱 코드도 n.read 를 보고 있어서 모든 알림이 영원히 '안 읽음'이었다.
-- 여기서는 실제 컬럼인 is_read 를 쓴다. 앱도 같은 이름으로 맞췄다.
--
-- 004 를 통째로 돌리지 않는 이유: notifications 테이블과 정책(notif_own)이
-- 이미 있어서, 004 는 같은 뜻의 정책을 하나 더 만들 뿐이다.

DO $do$
DECLARE v_missing text;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'notifications 테이블이 없습니다.';
  END IF;
  SELECT string_agg(c, ', ')
    INTO v_missing
    FROM unnest(array['id', 'user_id', 'is_read']) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = c
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'notifications 에 없는 컬럼: %', v_missing;
  END IF;
END
$do$;
CREATE OR REPLACE FUNCTION public.rpc_mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
     SET is_read = true
   WHERE id = p_notification_id
     AND user_id = (select auth.uid());
END;
$$;
CREATE OR REPLACE FUNCTION public.rpc_mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
     SET is_read = true
   WHERE user_id = (select auth.uid())
     AND is_read = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_mark_notification_read(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_mark_all_notifications_read() TO authenticated;
