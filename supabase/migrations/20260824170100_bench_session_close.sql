-- 부하 측정용 임시 세션을 지운다. class_presence 는 ON DELETE CASCADE 로 함께 사라진다.
DELETE FROM public.class_sessions WHERE id = '11111111-1111-1111-1111-111111111111';
