-- 부하 측정용 임시 수업 세션. 측정이 끝나면 20260824170100 이 닫는다.
INSERT INTO public.class_sessions (id, class_id, teacher_id, title)
SELECT '11111111-1111-1111-1111-111111111111',
       '80538940-dd10-4441-93bb-9e655b16ccad',
       (SELECT teacher_id FROM public.teacher_classes
         WHERE class_id = '80538940-dd10-4441-93bb-9e655b16ccad' LIMIT 1),
       '부하 측정'
WHERE EXISTS (SELECT 1 FROM public.teacher_classes
               WHERE class_id = '80538940-dd10-4441-93bb-9e655b16ccad')
ON CONFLICT (id) DO NOTHING;
