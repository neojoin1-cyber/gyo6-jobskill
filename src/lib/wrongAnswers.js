import { supabase } from './supabase.js'

/**
 * 퀴즈 모드에서 오답 확인 시 호출
 * @param {object} q  - questions.json 문항 객체
 * @param {number} courseId - 1:직업기초 2:품질경영 3:식음료 4:면접
 * @param {string|null} userAnswerLabel - 선택한 답 라벨 ('A','B','C'... or 'O'/'X' or null)
 */
export async function saveWrongAnswer(q, courseId, userAnswerLabel = null) {
  if (!q?.id) return
  const correctLabel = q.answer ?? (q.modelAnswer?.slice(0, 50)) ?? '모범답안 참조'
  try {
    await supabase.rpc('rpc_save_wrong_answer', {
      p_question_id:    q.id,
      p_course_id:      courseId,
      p_question_text:  (q.stem ?? q.heading ?? '').slice(0, 300),
      p_correct_answer: correctLabel,
      p_user_answer:    userAnswerLabel,
    })
  } catch {
    // 비로그인·네트워크 오류 시 조용히 실패
  }
}

export async function resolveWrongAnswer(questionId) {
  if (!questionId) return
  try {
    await supabase.rpc('rpc_resolve_wrong_answer', { p_question_id: questionId })
  } catch { /* silent */ }
}
