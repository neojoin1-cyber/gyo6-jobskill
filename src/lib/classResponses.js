import { supabase } from './supabase.js'

export function classResponseFocus(context = {}) {
  if (!context?.subject) return null
  return {
    kind: 'learning',
    subject: context.subject,
    mode: context.mode || null,
    track: context.track || context.trackId || null,
    stage: context.stage || null,
    area: context.area || context.areaId || null,
    lesson: context.lesson || context.lessonId || null,
    questionId: context.questionId || context.question?.id || null,
    index: Number.isInteger(context.index) ? context.index : null,
    step: Number.isInteger(context.step) ? context.step : null,
    position: Number.isInteger(context.position) ? context.position : null,
    label: context.lessonLabel || context.areaLabel || context.title || '수업 학습 화면',
  }
}

export function classResponseFromContext(context = {}) {
  const response = context?.content?.interaction?.response
  if (!response?.kind) return null
  return response
}

export async function submitClassResponse(sessionId, context) {
  const focus = classResponseFocus(context)
  const response = classResponseFromContext(context)
  if (!sessionId || !focus || !response) return { skipped: true }
  const { data, error } = await supabase.rpc('rpc_submit_class_response', {
    p_session_id: sessionId,
    p_focus: focus,
    p_response: response,
  })
  return { data, error }
}

export async function fetchClassResponses(sessionId, context) {
  const focus = classResponseFocus(context)
  if (!sessionId || !focus) return { data: null, error: null }
  return supabase.rpc('rpc_class_responses', {
    p_session_id: sessionId,
    p_focus: focus,
  })
}
