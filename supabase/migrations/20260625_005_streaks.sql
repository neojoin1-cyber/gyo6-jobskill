-- ============================================================
-- 005: 일별 학습 스트릭 시스템
-- ============================================================

-- 일별 활동 기록 (학습/퀴즈/미션 참여 시 upsert)
CREATE TABLE IF NOT EXISTS daily_activity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  -- 활동 카운트
  quiz_count      int NOT NULL DEFAULT 0,
  mission_count   int NOT NULL DEFAULT 0,
  study_count     int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

-- 스트릭 요약 (빠른 조회용)
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id          uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak   int NOT NULL DEFAULT 0,
  longest_streak   int NOT NULL DEFAULT 0,
  last_active_date date,
  total_days       int NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS daily_activity_user_date_idx ON daily_activity(user_id, activity_date DESC);

-- RLS
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_activity_owner" ON daily_activity;
CREATE POLICY "daily_activity_owner" ON daily_activity
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_streaks_owner" ON user_streaks;
CREATE POLICY "user_streaks_owner" ON user_streaks
  FOR SELECT USING (true);          -- 랭킹에서 다른 사람 스트릭도 볼 수 있음
DROP POLICY IF EXISTS "user_streaks_self_write" ON user_streaks;
CREATE POLICY "user_streaks_self_write" ON user_streaks
  FOR ALL USING (user_id = auth.uid());

GRANT ALL ON daily_activity TO authenticated;
GRANT ALL ON user_streaks TO authenticated;

-- ── RPC: 오늘 활동 기록 + 스트릭 자동 갱신 ──────────────────────────
CREATE OR REPLACE FUNCTION rpc_record_activity(
  p_type text DEFAULT 'study'   -- 'study' | 'quiz' | 'mission'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_today       date := CURRENT_DATE;
  v_yesterday   date := CURRENT_DATE - 1;
  v_streak      int;
  v_longest     int;
  v_last_active date;
  v_total       int;
BEGIN
  -- 오늘 활동 upsert
  INSERT INTO daily_activity(user_id, activity_date,
    quiz_count, mission_count, study_count)
  VALUES (v_uid, v_today,
    CASE WHEN p_type='quiz'    THEN 1 ELSE 0 END,
    CASE WHEN p_type='mission' THEN 1 ELSE 0 END,
    CASE WHEN p_type='study'   THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    quiz_count    = daily_activity.quiz_count    + EXCLUDED.quiz_count,
    mission_count = daily_activity.mission_count + EXCLUDED.mission_count,
    study_count   = daily_activity.study_count   + EXCLUDED.study_count,
    updated_at    = now();

  -- 스트릭 계산
  SELECT last_active_date, current_streak, longest_streak, total_days
    INTO v_last_active, v_streak, v_longest, v_total
    FROM user_streaks WHERE user_id = v_uid;

  IF v_last_active IS NULL THEN
    -- 최초 활동
    v_streak := 1; v_longest := 1; v_total := 1;
  ELSIF v_last_active = v_today THEN
    -- 오늘 이미 기록됨 → 스트릭 유지
    NULL;
  ELSIF v_last_active = v_yesterday THEN
    -- 연속 → 증가
    v_streak  := v_streak + 1;
    v_longest := GREATEST(v_longest, v_streak);
    v_total   := v_total + 1;
  ELSE
    -- 끊김 → 리셋
    v_streak := 1;
    v_total  := COALESCE(v_total, 0) + 1;
  END IF;

  INSERT INTO user_streaks(user_id, current_streak, longest_streak, last_active_date, total_days)
  VALUES (v_uid, v_streak, v_longest, v_today, COALESCE(v_total, 1))
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak   = EXCLUDED.current_streak,
    longest_streak   = GREATEST(user_streaks.longest_streak, EXCLUDED.longest_streak),
    last_active_date = EXCLUDED.last_active_date,
    total_days       = EXCLUDED.total_days,
    updated_at       = now();

  RETURN jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', GREATEST(COALESCE(v_longest, 0), v_streak),
    'total_days',     COALESCE(v_total, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_record_activity TO authenticated;
