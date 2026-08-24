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
  const area = q.area ?? q.lessonTitle ?? q._mockArea ?? q.lessonId ?? null   // 약점 분석용 영역
  try {
    await supabase.rpc('rpc_save_wrong_answer', {
      p_question_id:    q.id,
      p_course_id:      courseId,
      p_question_text:  (q.stem ?? q.heading ?? '').slice(0, 300),
      p_correct_answer: correctLabel,
      p_user_answer:    userAnswerLabel,
      p_area:           area ? String(area).slice(0, 40) : null,
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

/**
 * 우선 복습에서 오답 재풀이 결과 기록. 정답 3연속 시 서버가 자동 resolved.
 * @returns {Promise<'open'|'resolved'|null>} 갱신된 status
 */
export async function reviewWrongAnswer(questionId, correct) {
  if (!questionId) return null
  try {
    const { data } = await supabase.rpc('rpc_review_wrong', { p_question_id: questionId, p_correct: !!correct })
    return data ?? null
  } catch { return null }
}

/** 오픈 오답 목록(빈도 포함) 조회 — 우선 복습 큐 구성용 */
export async function fetchOpenWrongAnswers() {
  try {
    const { data } = await supabase.from('wrong_answers')
      .select('question_id, course_id, wrong_count, review_streak, question_text, correct_answer')
      .eq('status', 'open')
      .order('wrong_count', { ascending: false })
      .limit(300)
    return data || []
  } catch { return [] }
}
