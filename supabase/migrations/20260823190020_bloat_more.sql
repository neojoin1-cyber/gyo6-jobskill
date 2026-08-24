-- ⚠ 부하 측정 전용. 캐시(256MB)를 확실히 넘긴다.
-- 역할을 가리지 않고 모든 계정 이름으로 넣어 행 수를 늘린다.
SET statement_timeout = '600s';
INSERT INTO public.review_schedule
  (user_id, subject, unit_id, item_id, ease, interval_days, reps, due_at, updated_at)
SELECT p.id, '__bloat__', 'unit-' || (g % 50),
       '__bloat2__-' || p.id || '-' || g,
       2.5, (g % 30), (g % 5),
       now() + ((g % 60) || ' days')::interval, now()
  FROM profiles p
  CROSS JOIN generate_series(1, 100000) g
ON CONFLICT (user_id, item_id) DO NOTHING;
ANALYZE public.review_schedule;
