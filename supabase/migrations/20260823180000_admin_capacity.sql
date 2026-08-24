-- ============================================================
-- 019: 관리자 용량 신호판 — 언제 서버를 올려야 하는지 스스로 알려 준다
-- ============================================================
--
-- ── 왜 ─────────────────────────────────────────────────────────────
-- 지금은 Micro(1GB·2코어 버스트)로 충분하다. DB 23MB, 계정 11개, 캐시
-- 적중률 1.00 — 데이터가 전부 메모리에 있다. 미리 등급을 올리면 그냥 낭비다.
--
-- 문제는 **언제 올려야 하는지 알아채는 것**이다. 캐시 적중률이 떨어지는
-- 순간을 놓치면 어느 날 갑자기 앱이 느려지고, 그때는 이미 학생들이 겪은
-- 뒤다. 그래서 관리자 화면이 매번 그 신호를 보여 준다.
--
-- ── 허수 ───────────────────────────────────────────────────────────
-- 계정 수는 실제 부하와 다르다. 만들어 놓고 안 쓰는 계정이 섞이면 등급을
-- 잘못 판단한다. 그래서 셋을 나눠 센다.
--   한 번도 활동 없음 · 학급 미배정 · 180일 넘게 잠듦
-- **자동으로 지우지는 않는다.** 방학 중 안 쓴 학생이 지워지면 안 된다.
-- 목록만 보여 주고 지우는 것은 사람이 정한다.

CREATE OR REPLACE FUNCTION public.rpc_admin_capacity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := (select auth.uid());
  v_role     text;
  v_db_bytes bigint;
  v_ram_mb   int;
  v_shared   int;
  v_hit      numeric;
  v_warn     jsonb := '[]'::jsonb;
  v_accounts jsonb;
  v_active   jsonb;
  v_dormant  jsonb;
  v_rows     jsonb;
  v_tables   jsonb;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'school_admin' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- ── 계정 ──────────────────────────────────────────────────────
  SELECT jsonb_build_object(
           'total',    count(*),
           'students', count(*) FILTER (WHERE role = 'student'),
           'teachers', count(*) FILTER (WHERE role = 'teacher'),
           'admins',   count(*) FILTER (WHERE role IN ('admin','school_admin')))
    INTO v_accounts FROM profiles;

  -- ── 실사용 ────────────────────────────────────────────────────
  SELECT jsonb_build_object(
           'd7',  count(DISTINCT user_id) FILTER (WHERE activity_date >= CURRENT_DATE - 7),
           'd30', count(DISTINCT user_id) FILTER (WHERE activity_date >= CURRENT_DATE - 30))
    INTO v_active FROM daily_activity;

  -- ── 허수 후보 ─────────────────────────────────────────────────
  SELECT jsonb_build_object(
           'never_active', (SELECT count(*) FROM profiles p
                             WHERE p.role = 'student'
                               AND NOT EXISTS (SELECT 1 FROM daily_activity d WHERE d.user_id = p.id)),
           'no_class',     (SELECT count(*) FROM profiles p
                             WHERE p.role = 'student'
                               AND NOT EXISTS (SELECT 1 FROM student_classes s WHERE s.student_id = p.id)),
           'stale_180',    (SELECT count(*) FROM profiles p
                             WHERE p.role = 'student'
                               AND EXISTS (SELECT 1 FROM daily_activity d WHERE d.user_id = p.id)
                               AND NOT EXISTS (SELECT 1 FROM daily_activity d
                                                WHERE d.user_id = p.id
                                                  AND d.activity_date >= CURRENT_DATE - 180)))
    INTO v_dormant;

  -- ── 데이터 양 ─────────────────────────────────────────────────
  v_db_bytes := pg_database_size(current_database());

  SELECT jsonb_build_object(
           'review_schedule', (SELECT count(*) FROM review_schedule),
           'wrong_answers',   (SELECT count(*) FROM wrong_answers),
           'submissions',     (SELECT count(*) FROM submissions),
           'daily_activity',  (SELECT count(*) FROM daily_activity),
           'notifications',   (SELECT count(*) FROM notifications))
    INTO v_rows;

  SELECT coalesce(jsonb_agg(jsonb_build_object('name', relname, 'bytes', total) ORDER BY total DESC), '[]'::jsonb)
    INTO v_tables
    FROM (SELECT c.relname, pg_total_relation_size(c.oid) AS total
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
           ORDER BY total DESC LIMIT 6) t;

  -- ── 컴퓨트 사양과 캐시 상태 ───────────────────────────────────
  SELECT setting::int INTO v_shared FROM pg_settings WHERE name = 'shared_buffers';
  -- shared_buffers 는 대개 전체 RAM 의 1/4 로 잡힌다. 등급 추정에 쓴다.
  v_ram_mb := (v_shared * 8 / 1024) * 4;

  SELECT round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 1)
    INTO v_hit FROM pg_statio_user_tables;

  -- ── 경고 ──────────────────────────────────────────────────────
  -- 기준은 "데이터가 메모리를 넘어서기 시작하는가"다. shared_buffers 를
  -- 넘어서면 캐시에서 밀려나기 시작하고, 적중률이 먼저 떨어진다.
  IF v_db_bytes > (v_shared::bigint * 8192) THEN
    v_warn := v_warn || jsonb_build_array(
      format('데이터(%s)가 캐시 메모리(%s)를 넘었습니다. 등급 상향을 검토하세요.',
             pg_size_pretty(v_db_bytes), pg_size_pretty(v_shared::bigint * 8192)));
  ELSIF v_db_bytes > (v_shared::bigint * 8192) * 0.7 THEN
    v_warn := v_warn || jsonb_build_array(
      format('데이터가 캐시 메모리의 70%%를 넘었습니다(%s). 곧 상향이 필요합니다.',
             pg_size_pretty(v_db_bytes)));
  END IF;

  IF v_hit IS NOT NULL AND v_hit < 99 THEN
    v_warn := v_warn || jsonb_build_array(
      format('캐시 적중률이 %s%% 입니다. 99%% 아래면 조회가 디스크를 칩니다.', v_hit));
  END IF;

  IF (v_accounts->>'students')::int > 2000 AND v_ram_mb <= 1024 THEN
    v_warn := v_warn || jsonb_build_array('학생 2,000명을 넘었습니다. Micro(1GB) 로는 한계입니다.');
  END IF;

  RETURN jsonb_build_object(
    'accounts',  v_accounts,
    'active',    v_active,
    'dormant',   v_dormant,
    'rows',      v_rows,
    'tables',    v_tables,
    'storage',   jsonb_build_object('db_bytes', v_db_bytes, 'db_pretty', pg_size_pretty(v_db_bytes)),
    'compute',   jsonb_build_object(
                   'ram_mb_estimate', v_ram_mb,
                   'shared_buffers_mb', v_shared * 8 / 1024,
                   'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
                   'cache_hit_pct', v_hit),
    'warnings',  v_warn,
    'checked_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_admin_capacity() TO authenticated;
-- ── 허수 후보 목록 ─────────────────────────────────────────────────
-- 지우기 전에 누구인지 보여 준다. 삭제는 사람이 한다.
CREATE OR REPLACE FUNCTION public.rpc_admin_dormant_list(p_kind text DEFAULT 'never_active',
                                                         p_limit int DEFAULT 200)
RETURNS TABLE (id uuid, display_name text, school_id uuid, created_at timestamptz, last_active date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = (select auth.uid());
  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'school_admin' THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.school_id, p.created_at,
         (SELECT max(d.activity_date) FROM daily_activity d WHERE d.user_id = p.id)
    FROM profiles p
   WHERE p.role = 'student'
     AND CASE p_kind
           WHEN 'never_active' THEN NOT EXISTS (SELECT 1 FROM daily_activity d WHERE d.user_id = p.id)
           WHEN 'no_class'     THEN NOT EXISTS (SELECT 1 FROM student_classes s WHERE s.student_id = p.id)
           WHEN 'stale_180'    THEN EXISTS (SELECT 1 FROM daily_activity d WHERE d.user_id = p.id)
                                AND NOT EXISTS (SELECT 1 FROM daily_activity d
                                                 WHERE d.user_id = p.id
                                                   AND d.activity_date >= CURRENT_DATE - 180)
           ELSE false
         END
   ORDER BY p.created_at
   LIMIT least(p_limit, 500);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_admin_dormant_list(text, int) TO authenticated;
