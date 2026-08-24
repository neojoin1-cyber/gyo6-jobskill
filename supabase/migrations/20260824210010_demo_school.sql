-- 체험 학교와 학급만 먼저. auth.users 는 다음 단계에서.
INSERT INTO public.schools(name, region, national_ranking_opt_in)
SELECT '설탕과소금 체험학교', '체험', false
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE name = '설탕과소금 체험학교');
INSERT INTO public.classes(school_id, name, grade, class_code)
SELECT s.id, '체험 1반', 1, 'DEMO2026'
  FROM public.schools s
 WHERE s.name = '설탕과소금 체험학교'
   AND NOT EXISTS (SELECT 1 FROM public.classes c
                    WHERE c.school_id = s.id AND c.name = '체험 1반');
