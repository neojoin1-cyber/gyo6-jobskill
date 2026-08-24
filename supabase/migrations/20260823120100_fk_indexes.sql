-- 인덱스 없는 외래키에 인덱스를 만든다.
--
-- pg_index.indkey 는 int2vector 라 첨자 규칙이 헷갈린다(0-base, 캐스팅하면
-- 1-base). 거기서 한 번 실패했다. 그래서 첨자를 쓰지 않고 **인덱스의 첫
-- 컬럼 이름**을 직접 읽어 비교한다.
--
-- 단일 컬럼 외래키만 다룬다. 복합 외래키는 어느 순서로 걸지가 질의에 따라
-- 달라서 기계가 정할 일이 아니다.
DO $do$
DECLARE
  r     record;
  v_idx text;
  v_n   int := 0;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl,
           att.attname                  AS col,
           con.confrelid::regclass::text AS ref
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum   = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.connamespace = 'public'::regnamespace
       AND array_length(con.conkey, 1) = 1
       AND NOT EXISTS (
             SELECT 1
               FROM pg_index idx
               JOIN pg_attribute ia
                 ON ia.attrelid = idx.indexrelid
                AND ia.attnum   = 1
              WHERE idx.indrelid = con.conrelid
                AND ia.attname   = att.attname
           )
     ORDER BY 1, 2
  LOOP
    v_idx := left(replace(r.tbl, 'public.', '') || '_' || r.col || '_idx', 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', v_idx, r.tbl, r.col);
    RAISE NOTICE '인덱스 생성: %  (%.% → %)', v_idx, r.tbl, r.col, r.ref;
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE '외래키 인덱스 % 개.', v_n;
END
$do$;
-- 홈의 '오늘 복습'은 과목을 가리지 않고 user_id + due_at 으로 조회한다.
-- 기존 인덱스는 (user_id, subject, due_at) 이라 subject 가 비면 그 사람 행을 다 훑는다.
CREATE INDEX IF NOT EXISTS review_schedule_user_due_idx
  ON public.review_schedule (user_id, due_at);
ANALYZE;
