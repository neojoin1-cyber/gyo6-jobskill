-- ⚠ 부하 측정 전용. 끝나면 20260823190100 이 지운다.
--
-- 지금 DB 는 25MB 라 전부 캐시에 있다(적중률 100%). 그 상태로 잰 숫자는
-- 수만 명 규모를 말해 주지 않는다. 캐시가 식은 뒤에야 진짜 값이 나온다.
--
-- 계정을 만들지 않고 **데이터 양만** 재현한다. 기존 계정 이름으로 행을
-- 부풀리면 RAM 압박과 인덱스 크기는 실제와 같아진다. subject='__bloat__'
-- 로 표시해 두어 나중에 정확히 지운다.
--
-- 목표: shared_buffers(256MB)를 넘겨 캐시에서 밀려나게 만든다.
INSERT INTO public.review_schedule
  (user_id, subject, unit_id, item_id, ease, interval_days, reps, due_at, updated_at)
SELECT p.id,
       '__bloat__',
       'unit-' || (g % 50),
       '__bloat__-' || p.id || '-' || g,
       2.5, (g % 30), (g % 5),
       now() + ((g % 60) || ' days')::interval,
       now()
  FROM profiles p
  CROSS JOIN generate_series(1, 120000) g
 WHERE p.role IN ('student', 'teacher')
ON CONFLICT (user_id, item_id) DO NOTHING;
ANALYZE public.review_schedule;
