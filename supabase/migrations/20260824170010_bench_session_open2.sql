-- 부하 측정용 임시 수업 세션 (담당 교사 배정이 없어 아무 교사로 연다).
INSERT INTO public.class_sessions (id, class_id, teacher_id, title)
SELECT '11111111-1111-1111-1111-111111111111',
       '80538940-dd10-4441-93bb-9e655b16ccad',
       (SELECT id FROM public.profiles
         WHERE role IN ('teacher','school_admin','admin') ORDER BY created_at LIMIT 1),
       '부하 측정'
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE role IN ('teacher','school_admin','admin'))
ON CONFLICT (id) DO NOTHING;
