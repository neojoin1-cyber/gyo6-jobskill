-- ============================================================
-- 021: 수업 중 학급 현황 — 지금 이 시간, 우리 반이 어디까지 왔나
-- ============================================================
--
-- ── 왜 따로 만드나 ─────────────────────────────────────────────────
-- rpc_class_progress 는 **누적 진도**를 준다. 학기 전체를 보는 숫자라
-- 수업 한 시간 동안은 거의 움직이지 않는다. 교사가 수업 중에 알고 싶은
-- 것은 다르다.
--   지금 몇 명이 하고 있나        접속은 했는데 안 푸는 학생이 보인다
--   오늘 몇 문항이나 풀었나        진도가 계획대로 나가는지
--   누가 뒤처지고 있나            수업 중에 바로 가서 도와줄 수 있다
--
-- ── 실시간 연결은 쓰지 않는다 ──────────────────────────────────────
-- Realtime 구독은 학생 수만큼 동시 연결을 만든다. 한 학교 30학급이 같은
-- 교시에 수업하면 그것만으로 요금제 쿼터를 넘는다. 교사가 새로고침을
-- 누르는 방식이면 **수업 한 시간에 몇 번**이고, 그 정도는 공짜다.
--
-- ── 비용 ───────────────────────────────────────────────────────────
-- 학급 하나(30명) 조회에 daily_activity 30행, wrong_answers 인덱스 조회.
-- 인덱스가 이미 (student_id, status) 로 잡혀 있어 순차 읽기가 없다.

CREATE OR REPLACE FUNCTION public.rpc_class_live(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := (select auth.uid());
  v_role  text;
  v_ok    boolean;
  v_rows  jsonb;
  v_sum   jsonb;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  -- 담당 학급만 본다. 관리자는 전부.
  v_ok := v_role IN ('admin', 'school_admin')
          OR EXISTS (SELECT 1 FROM teacher_classes tc
                      WHERE tc.class_id = p_class_id AND tc.teacher_id = v_uid);
  IF NOT v_ok THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  WITH roster AS (
    SELECT sc.student_id, p.display_name
      FROM student_classes sc
      JOIN profiles p ON p.id = sc.student_id
     WHERE sc.class_id = p_class_id
  ),
  today AS (
    SELECT d.user_id,
           coalesce(d.quiz_count, 0) + coalesce(d.study_count, 0)
             + coalesce(d.mission_count, 0) AS solved,
           d.updated_at
      FROM daily_activity d
      JOIN roster r ON r.student_id = d.user_id
     WHERE d.activity_date = CURRENT_DATE
  ),
  wrong_today AS (
    SELECT w.student_id, count(*) AS n
      FROM wrong_answers w
      JOIN roster r ON r.student_id = w.student_id
     WHERE w.created_at >= CURRENT_DATE
     GROUP BY w.student_id
  ),
  wrong_open AS (
    SELECT w.student_id, count(*) AS n
      FROM wrong_answers w
      JOIN roster r ON r.student_id = w.student_id
     WHERE w.status = 'open'
     GROUP BY w.student_id
  )
  SELECT coalesce(jsonb_agg(x ORDER BY x.solved, x.display_name), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT r.student_id, r.display_name,
             coalesce(t.solved, 0)   AS solved,      -- 오늘 푼 것
             coalesce(wt.n, 0)       AS wrong_today, -- 오늘 틀린 것
             coalesce(wo.n, 0)       AS wrong_open,  -- 아직 안 푼 오답
             t.updated_at            AS last_seen,
             (t.solved IS NULL)      AS idle         -- 오늘 한 번도 안 함
        FROM roster r
        LEFT JOIN today      t  ON t.user_id    = r.student_id
        LEFT JOIN wrong_today wt ON wt.student_id = r.student_id
        LEFT JOIN wrong_open  wo ON wo.student_id = r.student_id
    ) x;

  SELECT jsonb_build_object(
           'total',    count(*),
           'active',   count(*) FILTER (WHERE NOT (e->>'idle')::boolean),
           'idle',     count(*) FILTER (WHERE (e->>'idle')::boolean),
           'solved',   coalesce(sum((e->>'solved')::int), 0),
           'avg',      round(coalesce(avg((e->>'solved')::int), 0), 1))
    INTO v_sum
    FROM jsonb_array_elements(v_rows) e;

  RETURN jsonb_build_object('students', v_rows, 'summary', v_sum, 'at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_class_live(uuid) TO authenticated;
