-- ⚠ 부하 측정 전용. 총 RAM(1GB)을 넘겨 OS 페이지 캐시까지 밀어낸다.
-- 448MB 는 shared_buffers 는 넘었지만 OS 캐시에는 여전히 들어간다.
-- 디스크를 실제로 치게 만들어야 수만 명 규모의 값이 나온다.
SET statement_timeout = '900s';
INSERT INTO public.review_schedule
  (user_id, subject, unit_id, item_id, ease, interval_days, reps, due_at, updated_at)
SELECT p.id, '__bloat__', 'unit-' || (g % 50),
       '__bloat3__-' || p.id || '-' || g,
       2.5, (g % 30), (g % 5),
       now() + ((g % 60) || ' days')::interval, now()
  FROM profiles p
  CROSS JOIN generate_series(1, 300000) g
ON CONFLICT (user_id, item_id) DO NOTHING;
ANALYZE public.review_schedule;
