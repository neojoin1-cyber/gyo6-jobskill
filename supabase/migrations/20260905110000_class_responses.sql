-- 열린 교실 수업에서 학생이 현재 카드에 남긴 응답을 교사에게 모아 보여 준다.
-- 수업 세션이 끝나면 기록은 남지만 학생 본인과 해당 세션 교사만 접근할 수 있다.
CREATE TABLE IF NOT EXISTS public.class_responses (
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_key text NOT NULL,
  focus jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, response_key)
);

CREATE INDEX IF NOT EXISTS class_responses_session_key_idx
  ON public.class_responses(session_id, response_key, submitted_at DESC);

ALTER TABLE public.class_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cr_read_own_or_teacher ON public.class_responses;
CREATE POLICY cr_read_own_or_teacher ON public.class_responses FOR SELECT USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.class_sessions s
     WHERE s.id = class_responses.session_id
       AND s.teacher_id = (select auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.class_response_key(p_focus jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT md5(jsonb_build_object(
    'kind', coalesce(p_focus->>'kind', 'learning'),
    'subject', coalesce(p_focus->>'subject', ''),
    'mode', coalesce(p_focus->>'mode', ''),
    'track', coalesce(p_focus->>'track', ''),
    'area', coalesce(p_focus->>'area', ''),
    'lesson', coalesce(p_focus->>'lesson', ''),
    'stage', coalesce(p_focus->>'stage', ''),
    'questionId', coalesce(p_focus->>'questionId', ''),
    'index', coalesce(p_focus->>'index', ''),
    'step', coalesce(p_focus->>'step', ''),
    'position', coalesce(p_focus->>'position', '')
  )::text)
$fn$;

CREATE OR REPLACE FUNCTION public.rpc_submit_class_response(
  p_session_id uuid,
  p_focus jsonb,
  p_response jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_key text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF jsonb_typeof(p_focus) <> 'object' OR jsonb_typeof(p_response) <> 'object' THEN
    RETURN jsonb_build_object('error', 'bad_payload');
  END IF;
  IF length(p_focus::text) > 4000 OR length(p_response::text) > 8000 THEN
    RETURN jsonb_build_object('error', 'payload_too_large');
  END IF;
  IF coalesce(p_response->>'kind', '') = '' THEN
    RETURN jsonb_build_object('error', 'missing_response_kind');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_sessions s
    JOIN public.student_classes sc ON sc.class_id = s.class_id
    WHERE s.id = p_session_id AND s.ended_at IS NULL AND sc.student_id = v_uid
  ) THEN
    RETURN jsonb_build_object('error', 'no_session');
  END IF;

  v_key := public.class_response_key(p_focus);
  INSERT INTO public.class_responses(session_id, user_id, response_key, focus, response, submitted_at)
  VALUES (p_session_id, v_uid, v_key, p_focus, p_response, now())
  ON CONFLICT (session_id, user_id, response_key) DO UPDATE SET
    focus = excluded.focus,
    response = excluded.response,
    submitted_at = now();

  RETURN jsonb_build_object('ok', true, 'response_key', v_key);
END; $fn$;

CREATE OR REPLACE FUNCTION public.rpc_class_responses(p_session_id uuid, p_focus jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_key text := public.class_response_key(p_focus);
  v_rows jsonb;
  v_total int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.class_sessions s
    WHERE s.id = p_session_id
      AND (
        s.teacher_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = v_uid AND p.role IN ('admin', 'school_admin')
        )
      )
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'student_id', r.user_id,
           'display_name', p.display_name,
           'response', r.response,
           'submitted_at', r.submitted_at
         ) ORDER BY r.submitted_at DESC), '[]'::jsonb), count(*)
    INTO v_rows, v_total
    FROM public.class_responses r
    JOIN public.profiles p ON p.id = r.user_id
   WHERE r.session_id = p_session_id AND r.response_key = v_key;

  RETURN jsonb_build_object(
    'response_key', v_key,
    'focus', p_focus,
    'count', v_total,
    'responses', v_rows,
    'at', now()
  );
END; $fn$;

REVOKE ALL ON FUNCTION public.class_response_key(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_submit_class_response(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_class_responses(uuid, jsonb) TO authenticated;
