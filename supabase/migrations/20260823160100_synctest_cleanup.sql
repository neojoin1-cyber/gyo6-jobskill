-- rpc_sync_progress 동작 확인에 쓴 행 정리
DELETE FROM public.review_schedule WHERE subject IN ('synctest', 'loadtest');
