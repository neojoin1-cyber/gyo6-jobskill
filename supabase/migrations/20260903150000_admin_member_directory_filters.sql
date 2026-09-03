-- Make the administrator member directory complete and filterable while
-- preserving the school administrator's single-school security boundary.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS education_office text;

CREATE OR REPLACE FUNCTION public.rpc_admin_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role user_role := my_profile_role();
  v_school uuid := my_school_id();
BEGIN
  IF v_role NOT IN ('admin','school_admin') THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    FROM (
      SELECT p.id, p.display_name, p.nickname, p.role, p.approved, p.created_at,
             p.school_id, s.name AS school_name, s.region AS school_region,
             s.education_office AS school_education_office, u.email,
             sc.class_id, c.name AS class_name, c.department AS class_department,
             c.grade AS class_grade, c.class_num,
             coalesce(tc.class_ids, ARRAY[]::uuid[]) AS teacher_class_ids,
             coalesce(tc.class_names, ARRAY[]::text[]) AS teacher_class_names
        FROM public.profiles p
        LEFT JOIN public.schools s ON s.id = p.school_id
        LEFT JOIN auth.users u ON u.id = p.id
        LEFT JOIN LATERAL (
          SELECT class_id FROM public.student_classes
           WHERE student_id = p.id ORDER BY joined_at DESC LIMIT 1
        ) sc ON true
        LEFT JOIN public.classes c ON c.id = sc.class_id
        LEFT JOIN LATERAL (
          SELECT array_agg(link.class_id ORDER BY cls.grade, cls.class_num, cls.name) AS class_ids,
                 array_agg(cls.name ORDER BY cls.grade, cls.class_num, cls.name) AS class_names
            FROM public.teacher_classes link
            JOIN public.classes cls ON cls.id = link.class_id
           WHERE link.teacher_id = p.id
        ) tc ON true
       WHERE v_role = 'admin'
          OR (p.role <> 'admin' AND p.school_id = v_school)
       ORDER BY p.created_at DESC
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_members() TO authenticated;
