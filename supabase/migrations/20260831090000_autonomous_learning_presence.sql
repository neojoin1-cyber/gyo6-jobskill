-- 학생이 실제 학습 화면에 머무는 동안에만 담당 교사에게 연결 상태와
-- 학습 영역을 알린다. 답안, 키 입력, 다른 앱 정보는 저장하지 않는다.

CREATE TABLE IF NOT EXISTS public.student_learning_presence (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('active', 'away')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_learning_presence_seen_idx
  ON public.student_learning_presence(last_seen DESC);

ALTER TABLE public.student_learning_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_learning_presence FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_learning_presence_ping(
  p_state text DEFAULT 'active',
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text;
  v_context jsonb;
  v_previous public.student_learning_presence%ROWTYPE;
BEGIN
  IF p_state NOT IN ('active', 'away') THEN
    RETURN jsonb_build_object('error', 'bad_state');
  END IF;
  IF jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('error', 'bad_context');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'student' THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_classes WHERE student_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'ignored', 'no_class');
  END IF;

  v_context := jsonb_strip_nulls(jsonb_build_object(
    'subject', nullif(left(trim(p_context->>'subject'), 80), ''),
    'mode', nullif(left(trim(p_context->>'mode'), 80), ''),
    'area', nullif(left(trim(p_context->>'area'), 100), ''),
    'lesson', nullif(left(trim(p_context->>'lesson'), 100), ''),
    'label', nullif(left(trim(p_context->>'label'), 180), '')
  ));

  SELECT * INTO v_previous
    FROM public.student_learning_presence
   WHERE student_id = v_uid;

  IF v_previous.student_id IS NOT NULL
     AND v_previous.state = p_state
     AND v_previous.context = v_context
     AND v_previous.last_seen > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  INSERT INTO public.student_learning_presence(student_id, state, context, started_at, last_seen, updated_at)
  VALUES (v_uid, p_state, v_context, now(), now(), now())
  ON CONFLICT (student_id) DO UPDATE SET
    state = excluded.state,
    context = excluded.context,
    started_at = CASE
      WHEN excluded.state = 'active'
       AND (student_learning_presence.state <> 'active'
         OR student_learning_presence.last_seen < now() - interval '210 seconds')
        THEN now()
      ELSE student_learning_presence.started_at
    END,
    last_seen = now(),
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'at', now());
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_learning_presence_ping(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_class_live(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text;
  v_ok boolean;
  v_rows jsonb;
  v_sum jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  v_ok := v_role IN ('admin', 'school_admin')
          OR EXISTS (SELECT 1 FROM public.teacher_classes tc
                      WHERE tc.class_id = p_class_id AND tc.teacher_id = v_uid);
  IF NOT v_ok THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  WITH roster AS (
    SELECT sc.student_id, p.display_name
      FROM public.student_classes sc
      JOIN public.profiles p ON p.id = sc.student_id
     WHERE sc.class_id = p_class_id
  ),
  today AS (
    SELECT d.user_id,
           coalesce(d.quiz_count, 0) + coalesce(d.study_count, 0)
             + coalesce(d.mission_count, 0) AS solved,
           d.updated_at
      FROM public.daily_activity d
      JOIN roster r ON r.student_id = d.user_id
     WHERE d.activity_date = CURRENT_DATE
  ),
  wrong_today AS (
    SELECT w.student_id, count(*) AS n
      FROM public.wrong_answers w
      JOIN roster r ON r.student_id = w.student_id
     WHERE w.created_at >= CURRENT_DATE
     GROUP BY w.student_id
  ),
  wrong_open AS (
    SELECT w.student_id, count(*) AS n
      FROM public.wrong_answers w
      JOIN roster r ON r.student_id = w.student_id
     WHERE w.status = 'open'
     GROUP BY w.student_id
  )
  SELECT coalesce(jsonb_agg(x ORDER BY x.presence_rank, x.solved DESC, x.display_name), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT r.student_id, r.display_name,
             coalesce(t.solved, 0) AS solved,
             coalesce(wt.n, 0) AS wrong_today,
             coalesce(wo.n, 0) AS wrong_open,
             greatest(t.updated_at, lp.last_seen) AS last_seen,
             lp.context->>'label' AS presence_label,
             CASE
               WHEN lp.state = 'active' AND lp.last_seen >= now() - interval '210 seconds' THEN 'active'
               WHEN lp.state = 'away' AND lp.last_seen >= now() - interval '10 minutes' THEN 'away'
               WHEN lp.state = 'active' AND lp.last_seen >= now() - interval '10 minutes' THEN 'lost'
               WHEN t.user_id IS NOT NULL OR lp.last_seen::date = CURRENT_DATE THEN 'today'
               ELSE 'idle'
             END AS presence_state,
             CASE
               WHEN lp.state = 'active' AND lp.last_seen >= now() - interval '210 seconds' THEN 0
               WHEN lp.state = 'away' AND lp.last_seen >= now() - interval '10 minutes' THEN 1
               WHEN lp.state = 'active' AND lp.last_seen >= now() - interval '10 minutes' THEN 2
               WHEN t.user_id IS NOT NULL OR lp.last_seen::date = CURRENT_DATE THEN 3
               ELSE 4
             END AS presence_rank,
             (t.user_id IS NULL AND lp.last_seen::date IS DISTINCT FROM CURRENT_DATE) AS idle
        FROM roster r
        LEFT JOIN today t ON t.user_id = r.student_id
        LEFT JOIN wrong_today wt ON wt.student_id = r.student_id
        LEFT JOIN wrong_open wo ON wo.student_id = r.student_id
        LEFT JOIN public.student_learning_presence lp ON lp.student_id = r.student_id
    ) x;

  SELECT jsonb_build_object(
           'total', count(*),
           'active', count(*) FILTER (WHERE e->>'presence_state' = 'active'),
           'away', count(*) FILTER (WHERE e->>'presence_state' = 'away'),
           'lost', count(*) FILTER (WHERE e->>'presence_state' = 'lost'),
           'participated', count(*) FILTER (WHERE e->>'presence_state' <> 'idle'),
           'idle', count(*) FILTER (WHERE e->>'presence_state' = 'idle'),
           'solved', coalesce(sum((e->>'solved')::int), 0),
           'avg', round(coalesce(avg((e->>'solved')::int), 0), 1))
    INTO v_sum
    FROM jsonb_array_elements(v_rows) e;

  RETURN jsonb_build_object('students', v_rows, 'summary', v_sum, 'at', now());
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_class_live(uuid) TO authenticated;
