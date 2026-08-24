-- ============================================================
-- 017: 동시 접속 규모 대비 — RLS 재평가 제거 + 누락 인덱스
-- ============================================================
--
-- ── 왜 저장소가 아니라 DB 를 읽어서 고치나 ─────────────────────────
--
-- 처음에는 저장소의 마이그레이션을 훑어 정책을 다시 쓰는 파일을 만들었다.
-- 그런데 진단 결과 **DB 와 저장소가 양방향으로 어긋나 있었다.**
--
--   저장소에 있는데 DB 에 없다 : study_wrong_answers,
--                                rpc_mark_notification_read,
--                                rpc_mark_all_notifications_read
--   DB 에 있는데 저장소에 없다 : school_subjects / ss_school_read,
--                                teacher_subjects / ts_teacher_read,
--                                notifications / notif_own
--                                (대시보드에서 직접 만든 것들)
--
-- 저장소를 기준으로 삼으면 DB 에만 있는 정책은 영원히 최적화되지 않고,
-- DB 에 없는 테이블 때문에 전체가 롤백된다(실제로 그렇게 실패했다).
--
-- 그래서 이 파일은 **지금 DB 에 실제로 있는 것**(pg_policies, pg_constraint)을
-- 읽어서 고친다. 저장소 상태와 무관하게 동작하고, 몇 번을 돌려도 결과가 같다.
--
-- ── 무엇을 바꾸나 ─────────────────────────────────────────────────
--
-- ① RLS 정책의 auth.uid() 를 (select auth.uid()) 로 감싼다.
--    감싸지 않으면 Postgres 가 **검사하는 행마다** 함수를 다시 부른다.
--    감싸면 InitPlan 으로 한 번만 계산해 재사용한다. 술어의 뜻은 그대로고
--    속도만 달라진다. (Supabase 공식 권장 최적화)
--
-- ② 인덱스 없는 외래키에 인덱스를 만든다. 없으면 조인과 부모 행 삭제가
--    자식 테이블 전체 스캔이 된다.
--
-- 실행: Supabase SQL Editor (프로젝트 eniyjdmtbunvizrsomrp) 에 붙여 넣고 Run.
--       전체가 한 트랜잭션이라 중간에 실패하면 아무것도 적용되지 않는다.

-- ── ① RLS 정책 재작성 ────────────────────────────────────────────
DO $do$
DECLARE
  r        record;
  v_qual   text;
  v_check  text;
  v_sql    text;
  v_n      int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '')       ~ 'auth\.(uid|role|jwt)\(\)'
         OR coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)')
     ORDER BY tablename, policyname
  LOOP
    -- 이미 감싼 것을 먼저 풀고(중첩 방지) 다시 감싼다 → 몇 번 돌려도 같다.
    v_qual  := r.qual;
    v_check := r.with_check;

    v_qual  := regexp_replace(v_qual,
                 '\(\s*SELECT\s+auth\.(uid|role|jwt)\(\)(\s+AS\s+\w+)?\s*\)',
                 'auth.\1()', 'gi');
    v_qual  := regexp_replace(v_qual, 'auth\.(uid|role|jwt)\(\)',
                 '(select auth.\1())', 'g');

    v_check := regexp_replace(v_check,
                 '\(\s*SELECT\s+auth\.(uid|role|jwt)\(\)(\s+AS\s+\w+)?\s*\)',
                 'auth.\1()', 'gi');
    v_check := regexp_replace(v_check, 'auth\.(uid|role|jwt)\(\)',
                 '(select auth.\1())', 'g');

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                    r.policyname, r.schemaname, r.tablename,
                    CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
                    r.cmd,
                    array_to_string(r.roles, ', '));
    IF v_qual  IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual);       END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;

    EXECUTE v_sql;
    v_n := v_n + 1;
  END LOOP;

  RAISE NOTICE '정책 % 개를 (select auth.uid()) 형태로 다시 만들었습니다.', v_n;
END
$do$;
