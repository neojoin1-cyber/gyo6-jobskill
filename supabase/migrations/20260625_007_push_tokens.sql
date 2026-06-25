-- ============================================================
-- 007: Push 알림 토큰 저장 컬럼 추가
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token     text,
  ADD COLUMN IF NOT EXISTS push_platform  text;  -- 'fcm' | 'web-push'

-- ── RPC: Push 발송 (Edge Function에서 호출용 — service_role만 실행) ──
-- 실제 FCM/VAPID 발송은 Supabase Edge Function에서 처리합니다.
-- edge_functions/send-push/index.ts 파일 참조.
