-- ============================================================
-- 016: XP + 레벨 시스템 + 주간 학급 랭킹 RPC
-- ============================================================

-- XP 테이블 (사용자별 누적/주간 XP + 레벨)
CREATE TABLE IF NOT EXISTS user_xp (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_xp   int NOT NULL DEFAULT 0,
  weekly_xp  int NOT NULL DEFAULT 0,
  week_start date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  level      int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_xp_weekly_idx ON user_xp(weekly_xp DESC);

ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_owner"    ON user_xp;
DROP POLICY IF EXISTS "xp_read_all" ON user_xp;

CREATE POLICY "xp_owner" ON user_xp FOR ALL USING (user_id = auth.uid());
CREATE POLICY "xp_read_all" ON user_xp FOR SELECT USING (true);

GRANT ALL ON user_xp TO authenticated, service_role;

-- XP → 레벨 순수 함수 (immutable)
CREATE OR REPLACE FUNCTION xp_to_level(xp int) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp <  500  THEN 1   -- 신입
    WHEN xp < 2000  THEN 2   -- 견습생
    WHEN xp < 5000  THEN 3   -- 전문가
    ELSE                 4   -- 마이스터
  END
$$;

-- RPC: XP 추가 + 주간 자동 리셋
CREATE OR REPLACE FUNCTION rpc_add_xp(
  p_amount int  DEFAULT 10,
  p_reason text DEFAULT 'study'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_total      int  := 0;
  v_weekly     int  := 0;
  v_prev_level int  := 1;
  v_stored_wk  date;
  v_level      int;
BEGIN
  SELECT total_xp, weekly_xp, level, week_start
    INTO v_total, v_weekly, v_prev_level, v_stored_wk
    FROM user_xp WHERE user_id = v_uid;

  IF v_stored_wk IS NULL THEN
    -- 최초 XP 부여
    v_total  := p_amount;
    v_weekly := p_amount;
  ELSIF v_stored_wk < v_week_start THEN
    -- 새 주 시작 → weekly_xp 리셋
    v_total  := COALESCE(v_total, 0)  + p_amount;
    v_weekly := p_amount;
  ELSE
    v_total  := COALESCE(v_total, 0)  + p_amount;
    v_weekly := COALESCE(v_weekly, 0) + p_amount;
  END IF;

  v_level := xp_to_level(v_total);

  INSERT INTO user_xp(user_id, total_xp, weekly_xp, week_start, level)
  VALUES (v_uid, v_total, v_weekly, v_week_start, v_level)
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = EXCLUDED.total_xp,
    weekly_xp  = EXCLUDED.weekly_xp,
    week_start = EXCLUDED.week_start,
    level      = EXCLUDED.level,
    updated_at = now();

  RETURN jsonb_build_object(
    'total_xp',   v_total,
    'weekly_xp',  v_weekly,
    'level',      v_level,
    'leveled_up', v_level > COALESCE(v_prev_level, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_add_xp TO authenticated;

-- RPC: 내 학급 주간 랭킹 상위 10명
CREATE OR REPLACE FUNCTION rpc_class_weekly_rank()
RETURNS TABLE (
  student_id   uuid,
  display_name text,
  weekly_xp    int,
  rank_pos     int,
  is_me        bool
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_class_id uuid;
BEGIN
  SELECT sc.class_id INTO v_class_id
    FROM student_classes sc WHERE sc.student_id = v_uid LIMIT 1;

  IF v_class_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      p.id                          AS student_id,
      p.display_name                AS display_name,
      COALESCE(x.weekly_xp, 0)      AS weekly_xp,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(x.weekly_xp, 0) DESC
      )::int                        AS rank_pos
    FROM student_classes sc2
    JOIN profiles  p ON p.id  = sc2.student_id
    LEFT JOIN user_xp x ON x.user_id = p.id
    WHERE sc2.class_id = v_class_id
  )
  SELECT r.student_id, r.display_name, r.weekly_xp, r.rank_pos,
         (r.student_id = v_uid) AS is_me
  FROM ranked r
  ORDER BY r.rank_pos
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_class_weekly_rank TO authenticated;

-- RPC: 내 XP + 레벨 조회 (없으면 기본값)
CREATE OR REPLACE FUNCTION rpc_my_xp()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row user_xp%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM user_xp WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('total_xp', 0, 'weekly_xp', 0, 'level', 1);
  END IF;
  RETURN jsonb_build_object(
    'total_xp',  v_row.total_xp,
    'weekly_xp', v_row.weekly_xp,
    'level',     v_row.level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_my_xp TO authenticated;
