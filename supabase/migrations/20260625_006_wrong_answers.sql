-- ⚠️ 폐기됨 — 실행하지 마세요 (2026-08-23 확인)
--
-- 이 파일은 자율학습 오답을 study_wrong_answers 라는 별도 테이블에 담는
-- 옛 설계다. 지금 앱은 그 테이블을 **한 곳에서도 쓰지 않는다**(src 전체 검색
-- 결과 0건). 오답은 wrong_answers 한 테이블로 모은다.
--
-- 그리고 이 파일을 지금 실행하면 **오답노트가 망가진다.**
--   여기의 rpc_save_wrong_answer / rpc_resolve_wrong_answer 는 인자 타입이
--   현재 운영 중인 함수(20260708_002_wrong_priority.sql)와 같다. 따라서
--   CREATE OR REPLACE 가 **덮어쓰기**로 동작해, wrong_answers 에 쓰던 최신
--   함수가 study_wrong_answers 에 쓰는 옛 함수로 바뀐다.
--
-- 진단에서 "study_wrong_answers 없음"이 떠도 그것이 정상이다. 기록으로만 남긴다.
--
-- ============================================================
-- 006: 자유 학습 오답 자동 저장
-- ============================================================

CREATE TABLE IF NOT EXISTS study_wrong_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 문항 식별
  question_id  text NOT NULL,        -- questions.json 의 id 값
  course_id    int,                   -- 과목 (1=직업기초, 2=품질경영, 3=식음료, 4=면접)
  question_text text NOT NULL,       -- 문항 본문 (비정규화 — JSON 변경에 독립)
  correct_answer text NOT NULL,      -- 정답 레이블 (예: "B", "O", 모범답안 앞 50자)
  user_answer  text,                  -- 선택한 답 (null = 정답 보기만 눌렀을 때)
  -- 복습 추적
  review_count  int NOT NULL DEFAULT 0,
  last_wrong_at timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,         -- 퀴즈에서 맞혔을 때 null→타임스탬프
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)       -- 같은 문항은 1행으로 관리 (중복 upsert)
);

CREATE INDEX IF NOT EXISTS swa_user_idx      ON study_wrong_answers(user_id);
CREATE INDEX IF NOT EXISTS swa_unresolved_idx ON study_wrong_answers(user_id, resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE study_wrong_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swa_owner" ON study_wrong_answers;
CREATE POLICY "swa_owner" ON study_wrong_answers FOR ALL USING (user_id = auth.uid());
GRANT ALL ON study_wrong_answers TO authenticated;

-- ── RPC: 오답 저장 (upsert) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_save_wrong_answer(
  p_question_id   text,
  p_course_id     int,
  p_question_text text,
  p_correct_answer text,
  p_user_answer   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO study_wrong_answers(
    user_id, question_id, course_id,
    question_text, correct_answer, user_answer,
    review_count, last_wrong_at, resolved_at
  )
  VALUES (
    auth.uid(), p_question_id, p_course_id,
    p_question_text, p_correct_answer, p_user_answer,
    1, now(), NULL
  )
  ON CONFLICT (user_id, question_id) DO UPDATE SET
    review_count  = study_wrong_answers.review_count + 1,
    last_wrong_at = now(),
    user_answer   = EXCLUDED.user_answer,
    resolved_at   = NULL;   -- 다시 틀렸으면 resolved 취소
END;
$$;

-- ── RPC: 오답 해결 처리 (복습에서 맞혔을 때) ─────────────────────────
CREATE OR REPLACE FUNCTION rpc_resolve_wrong_answer(p_question_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE study_wrong_answers
     SET resolved_at = now()
   WHERE user_id = auth.uid()
     AND question_id = p_question_id
     AND resolved_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_save_wrong_answer    TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_resolve_wrong_answer TO authenticated;
