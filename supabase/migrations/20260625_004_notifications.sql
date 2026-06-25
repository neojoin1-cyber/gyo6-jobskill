-- ============================================================
-- 004: notifications 테이블 생성 + 관련 RPC
-- Supabase Dashboard > SQL Editor에서 실행
-- ============================================================

-- notifications 테이블 (이미 있는 경우 대비)
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         text NOT NULL,
  type         text NOT NULL DEFAULT 'info',   -- 'mission' | 'result' | 'info' | 'streak'
  read         boolean NOT NULL DEFAULT false,
  action_url   text,                            -- 딥링크 (미래 확장용)
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read) WHERE read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회/수정 가능
DROP POLICY IF EXISTS "notifications_owner" ON notifications;
CREATE POLICY "notifications_owner" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- authenticated 권한 부여
GRANT ALL ON notifications TO authenticated;

-- ── RPC: 알림 읽음 처리 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
     SET read = true
   WHERE id = p_notification_id
     AND user_id = auth.uid();
END;
$$;

-- ── RPC: 전체 알림 읽음 처리 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
     SET read = true
   WHERE user_id = auth.uid()
     AND read = false;
END;
$$;

-- ── RPC: 알림 발송 (service_role 전용) ──────────────────────────────
CREATE OR REPLACE FUNCTION rpc_send_notification(
  p_user_id  uuid,
  p_title    text,
  p_body     text,
  p_type     text DEFAULT 'info',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO notifications(user_id, title, body, type, metadata)
  VALUES (p_user_id, p_title, p_body, p_type, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_mark_all_notifications_read TO authenticated;
