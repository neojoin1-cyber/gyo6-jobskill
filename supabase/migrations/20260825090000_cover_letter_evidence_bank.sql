-- 학생 자기소개서 근거은행
-- 초안과 분리해 여러 지원처에서 재사용하고, 학생 본인만 관리한다.

CREATE TABLE IF NOT EXISTS public.cover_letter_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  major_group   text NOT NULL CHECK (char_length(major_group) BETWEEN 2 AND 40),
  source_type   text NOT NULL CHECK (char_length(source_type) BETWEEN 2 AND 40),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  situation     text NOT NULL CHECK (char_length(situation) BETWEEN 10 AND 1200),
  task          text NOT NULL DEFAULT '' CHECK (char_length(task) <= 1200),
  action        text NOT NULL CHECK (char_length(action) BETWEEN 15 AND 2400),
  result        text NOT NULL CHECK (char_length(result) BETWEEN 8 AND 1600),
  proof         text NOT NULL DEFAULT '' CHECK (char_length(proof) <= 600),
  skills        text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cover_letter_evidence_student_idx
  ON public.cover_letter_evidence(student_id, created_at DESC);

ALTER TABLE public.cover_letter_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cover_letter_evidence_owner_select ON public.cover_letter_evidence;
CREATE POLICY cover_letter_evidence_owner_select ON public.cover_letter_evidence
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS cover_letter_evidence_owner_insert ON public.cover_letter_evidence;
CREATE POLICY cover_letter_evidence_owner_insert ON public.cover_letter_evidence
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS cover_letter_evidence_owner_update ON public.cover_letter_evidence;
CREATE POLICY cover_letter_evidence_owner_update ON public.cover_letter_evidence
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS cover_letter_evidence_owner_delete ON public.cover_letter_evidence;
CREATE POLICY cover_letter_evidence_owner_delete ON public.cover_letter_evidence
  FOR DELETE TO authenticated USING (student_id = auth.uid());

REVOKE ALL ON public.cover_letter_evidence FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cover_letter_evidence TO authenticated;
