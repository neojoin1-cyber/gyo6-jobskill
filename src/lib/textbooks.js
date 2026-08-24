/**
 * 완전교재(10블록) 콘텐츠 접근자.
 * 우선순위: Supabase textbook_units(최신) > 앱 번들 JSON(오프라인/최초설치 폴백).
 * → Supabase 테이블만 갱신하면 앱 재빌드 없이 내용이 반영된다.
 *   (테이블이 비었거나 오프라인이면 번들로 자동 폴백 → 지금도 정상 동작)
 */
import { supabase } from './supabase.js'

const BUNDLE_LOADERS = {
  'ncs-basic':    () => import('../../data/textbook-ncs-basic.json'),
  'interview':    () => import('../../data/textbook-interview.json'),
  'personality':  () => import('../../data/textbook-personality.json'),
}

// 세션 내 메모리 캐시(같은 과목 재진입 시 재조회 방지)
const cache = {}

/**
 * @param {string} subjectId 'food-service' | 'job-common'
 * @returns {Promise<{units: Array<{unitId,title,area,html,quiz}>, source:'supabase'|'bundle'}>}
 */
export async function loadTextbook(subjectId) {
  if (subjectId === 'job-common') {
    throw new Error('교육부 직업공통능력 인증은 공식 5영역 자율학습 화면에서만 제공합니다.')
  }
  if (cache[subjectId]) return cache[subjectId]

  // 1) Supabase 우선
  try {
    const { data, error } = await supabase
      .from('textbook_units')
      .select('unit_id, title, area, sort_order, html, quiz')
      .eq('subject', subjectId)
      .order('sort_order', { ascending: true })
    if (!error && Array.isArray(data) && data.length > 0) {
      const units = data.map(r => ({
        unitId: r.unit_id, title: r.title, area: r.area,
        html: r.html, quiz: r.quiz || [],
      }))
      const result = { units, source: 'supabase' }
      cache[subjectId] = result
      return result
    }
  } catch { /* 오프라인·오류 → 번들 폴백 */ }

  // 2) 번들 폴백 — 캐시하지 않는다(일시 오류 시 다음 호출에서 Supabase 재시도).
  const loader = BUNDLE_LOADERS[subjectId]
  if (!loader) throw new Error('unknown subject: ' + subjectId)
  const m = await loader()
  return { units: m.default?.units ?? [], source: 'bundle' }
}
