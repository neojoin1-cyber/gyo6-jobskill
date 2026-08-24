-- ============================================================
-- 010: app_config 테이블 — 앱 버전 관리
-- 앱 시작 시 min_build / latest_build와 비교해 업데이트 안내
-- ============================================================

CREATE TABLE IF NOT EXISTS app_config (
  key            text PRIMARY KEY,                    -- 'android'
  min_build      integer NOT NULL DEFAULT 1,          -- 이 미만이면 강제 업데이트
  latest_build   integer NOT NULL DEFAULT 1,          -- 이 미만이면 권고 배너
  latest_version text    NOT NULL DEFAULT '1.0.0',    -- 표시용 버전명
  store_url      text                                  -- Play Store 링크
);

-- 초기값: 현재 배포 버전 (versionCode 8 = v1.2.0)
INSERT INTO app_config (key, min_build, latest_build, latest_version, store_url)
VALUES (
  'android',
  7,          -- 7 미만이면 강제 업데이트 (major 호환 깨진 경우에만 올릴 것)
  8,          -- 현재 최신 빌드 (새 AAB 올릴 때마다 업데이트)
  '1.2.0',
  'https://play.google.com/store/apps/details?id=com.gyo6.jobskill'
)
ON CONFLICT (key) DO UPDATE SET
  latest_build   = excluded.latest_build,
  latest_version = excluded.latest_version,
  store_url      = excluded.store_url;

-- RLS: 누구나 읽기 (로그인 전에도 체크해야 함)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config_public_read" ON app_config;
CREATE POLICY "app_config_public_read" ON app_config FOR SELECT USING (true);

-- admin만 수정 가능
DROP POLICY IF EXISTS "app_config_admin_write" ON app_config;
CREATE POLICY "app_config_admin_write" ON app_config
  FOR ALL USING (my_profile_role() = 'admin');

GRANT SELECT ON app_config TO anon, authenticated;
GRANT ALL    ON app_config TO service_role;
