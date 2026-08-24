-- 교사 메시지에 쓸 종류를 enum 에 추가한다.
-- rpc_send_message 의 기본값이 'info' 였는데 enum 에 없는 값이라 첫 발송에서
-- 바로 터졌을 것이다. 화면에서 색·아이콘을 나누려면 종류가 있어야 한다.
DROP TABLE IF EXISTS public._peek;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                  WHERE t.typname='notification_type' AND e.enumlabel='notice') THEN
    ALTER TYPE public.notification_type ADD VALUE 'notice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                  WHERE t.typname='notification_type' AND e.enumlabel='encourage') THEN
    ALTER TYPE public.notification_type ADD VALUE 'encourage';
  END IF;
END
$do$;
