-- 검증용으로 넣은 메시지와 임시 표 정리
DELETE FROM public.notifications
 WHERE title LIKE '[검증]%' OR title LIKE '학생 답장: [검증]%';
DROP TABLE IF EXISTS public._peek;
