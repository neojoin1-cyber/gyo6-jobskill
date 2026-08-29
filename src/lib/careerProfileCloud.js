import { supabase } from './supabase.js'
import { careerProfileReadiness, normalizeCareerContext } from './careerProfile.js'

export async function publishCareerProfile(value, { evidenceCount = 0 } = {}) {
  const profile = normalizeCareerContext(value)
  const readiness = careerProfileReadiness(profile, { evidenceCount })
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, offline: true }
  const { data, error } = await supabase.rpc('rpc_upsert_my_career_profile', {
    p_profile: profile,
    p_readiness_score: readiness.score,
    p_evidence_count: Number(evidenceCount || 0),
  })
  if (error || data?.error) return { ok: false, error: error || new Error(data?.error || 'career_profile_publish_failed') }
  return { ok: true, updatedAt: data?.updated_at || new Date().toISOString(), readiness }
}

export async function loadMyCareerFeedback() {
  const { data, error } = await supabase
    .from('student_career_feedback')
    .select('note, next_action, review_on, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { ok: false, error }
  return { ok: true, feedback: data || null }
}
