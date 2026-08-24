/**
 * subjectAccess.js — 학생 유효교재(배정된 교재) 조회.
 * rpc_my_subjects(): 개인 배정 ∪ 소속 학급 배정. 빈 배열이면 '전체 표시'로 폴백(하위호환).
 */
import { supabase } from './supabase.js'

// @returns {Promise<Set<string>|null>} 허용 교재 id 집합. null = 제한 없음(전체 표시).
export async function loadMySubjects() {
  try {
    const { data, error } = await supabase.rpc('rpc_my_subjects')
    if (error) return null                       // 오류 시 전체 표시(콘텐츠 잠금 방지)
    const arr = Array.isArray(data) ? data : []
    return arr.length === 0 ? null : new Set(arr) // 미배정 = 전체 표시
  } catch {
    return null
  }
}
