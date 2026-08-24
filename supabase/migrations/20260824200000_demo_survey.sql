-- 현재 학교·학급·계정 상태를 로그로 남긴다(변경 없음).
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '── 학교';
  FOR r IN SELECT id, name FROM public.schools ORDER BY created_at LIMIT 5 LOOP
    RAISE NOTICE '  % | %', r.id, r.name;
  END LOOP;
  RAISE NOTICE '── 학급';
  FOR r IN SELECT id, name, class_code, school_id FROM public.classes ORDER BY created_at LIMIT 8 LOOP
    RAISE NOTICE '  % | % | %', r.id, r.name, r.class_code;
  END LOOP;
  RAISE NOTICE '── 계정(역할별)';
  FOR r IN SELECT role, count(*) n FROM public.profiles GROUP BY role LOOP
    RAISE NOTICE '  % : %', r.role, r.n;
  END LOOP;
  RAISE NOTICE '── demo 계정이 이미 있나';
  FOR r IN SELECT p.id, p.display_name, p.role, u.email
             FROM public.profiles p JOIN auth.users u ON u.id = p.id
            WHERE u.email LIKE '%demo%' OR p.display_name LIKE '%데모%' LOOP
    RAISE NOTICE '  % | % | % | %', r.id, r.email, r.role, r.display_name;
  END LOOP;
END $$;
