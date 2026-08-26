-- 학급별 수업 단원 여정. 화면 내용을 복제하지 않고 식별자와 마지막 위치만 저장한다.
CREATE TABLE IF NOT EXISTS public.class_lesson_progress (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  area_id text NOT NULL DEFAULT '',
  lesson_id text NOT NULL,
  last_session_id uuid REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  last_focus jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (class_id, subject_id, area_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS class_lesson_progress_class_updated_idx
  ON public.class_lesson_progress(class_id, updated_at DESC);

ALTER TABLE public.class_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clp_teacher_read ON public.class_lesson_progress;
CREATE POLICY clp_teacher_read ON public.class_lesson_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_classes tc
           WHERE tc.class_id = class_lesson_progress.class_id
             AND tc.teacher_id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.classes c ON c.school_id = p.school_id
              WHERE p.id = (select auth.uid()) AND p.role IN ('school_admin','admin')
                AND c.id = class_lesson_progress.class_id)
);

CREATE OR REPLACE FUNCTION public.rpc_set_class_focus(p_session_id uuid, p_focus jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_class_id uuid;
  v_subject text := nullif(p_focus->>'subject', '');
  v_area text := coalesce(nullif(p_focus->>'area', ''), '');
  v_lesson text := nullif(p_focus->>'lesson', '');
  v_stage text := coalesce(p_focus->>'stage', '');
BEGIN
  UPDATE class_sessions
     SET focus = p_focus, focus_at = now()
   WHERE id = p_session_id AND ended_at IS NULL AND teacher_id = v_uid
   RETURNING class_id INTO v_class_id;
  IF v_class_id IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  IF v_subject IS NOT NULL AND v_lesson IS NOT NULL THEN
    INSERT INTO class_lesson_progress(class_id, subject_id, area_id, lesson_id, last_session_id, last_focus, completed_at)
    VALUES (v_class_id, v_subject, v_area, v_lesson, p_session_id, p_focus,
      CASE WHEN v_stage IN ('end','complete','completed','result') THEN now() ELSE NULL END)
    ON CONFLICT (class_id, subject_id, area_id, lesson_id) DO UPDATE SET
      last_session_id = excluded.last_session_id,
      last_focus = excluded.last_focus,
      updated_at = now(),
      completed_at = CASE
        WHEN class_lesson_progress.completed_at IS NOT NULL THEN class_lesson_progress.completed_at
        WHEN v_stage IN ('end','complete','completed','result') THEN now()
        ELSE NULL
      END;
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $fn$;

GRANT SELECT ON public.class_lesson_progress TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_class_focus(uuid, jsonb) TO authenticated;
