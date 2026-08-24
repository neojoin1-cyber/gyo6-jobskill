-- notifications.type 은 자유 문자열이 아니라 enum(notification_type) 이었다.
-- 답장은 목록에서 구분해야 하므로 값을 하나 늘린다.
--
-- PostgreSQL 12 부터 ALTER TYPE ... ADD VALUE 를 트랜잭션 안에서 실행할 수
-- 있다. 다만 **같은 트랜잭션에서 그 값을 쓸 수는 없다.** 여기서는 추가만
-- 하고, 실제 사용은 커밋 뒤 함수가 실행될 때다.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'notification_type' AND e.enumlabel = 'reply'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'reply';
    RAISE NOTICE 'notification_type 에 reply 추가';
  END IF;
END
$do$;
