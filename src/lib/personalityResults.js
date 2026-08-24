/**
 * personalityResults.js — 인성검사 결과 저장(학생) / 학급 경향 조회(교사)
 * 정답 없는 검사 → 점수가 아니라 6요인 프로필 + 신뢰도 요약을 저장.
 */
import { supabase } from './supabase.js'
import { currentUserId } from './authUser.js'

// 저장은 best-effort — 비로그인·오류 시 조용히 무시(학습 흐름 방해 금지)
export async function savePersonalityResult({ mode, paperNo, result }) {
  try {
    const uid = await currentUserId()
    const user = uid ? { id: uid } : null
    if (!user) return { ok: false, reason: 'anon' }
    const profile = (result.profile || []).map(p => ({ key: p.key, name: p.name, score: p.score, band: p.band }))
    const R = result.reliability || {}
    const reliability = {
      consistency: R.consistency, social: R.social,
      infrequencyOk: R.infrequency?.ok, reliable: R.reliable,
    }
    const { error } = await supabase.from('personality_results')
      .insert({ mode, paper_no: paperNo, profile, reliability })
    if (error) return { ok: false, reason: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) }
  }
}

// 교사: 담당 학급 학생들의 최신 인성검사 결과 목록 (rpc_class_personality)
export async function loadClassPersonality(classId) {
  const { data, error } = await supabase.rpc('rpc_class_personality', { p_class_id: classId })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// 학급 경향 집계: 6요인 평균 + 신뢰도 도달률 + 응시 인원
export function aggregateClassPersonality(rows) {
  const done = rows.filter(r => Array.isArray(r.profile) && r.profile.length > 0)
  const dimSum = {}, dimCnt = {}, dimName = {}
  let reliableCnt = 0
  for (const r of done) {
    for (const p of r.profile) {
      dimSum[p.key] = (dimSum[p.key] || 0) + (p.score || 0)
      dimCnt[p.key] = (dimCnt[p.key] || 0) + 1
      dimName[p.key] = p.name
    }
    if (r.reliability?.reliable) reliableCnt++
  }
  const dims = Object.keys(dimSum).map(k => ({
    key: k, name: dimName[k], avg: Math.round(dimSum[k] / dimCnt[k]),
  }))
  return {
    totalStudents: rows.length,
    doneCount: done.length,
    reliableRate: done.length ? Math.round((reliableCnt / done.length) * 100) : null,
    dims,
  }
}
