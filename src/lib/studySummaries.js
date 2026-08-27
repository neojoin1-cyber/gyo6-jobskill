/**
 * 학습(요점정리) 콘텐츠 접근자.
 * 우선순위: Supabase(최신) > localStorage 캐시 > 앱 번들 JSON(오프라인 폴백).
 * → Supabase study_summaries 테이블만 갱신하면 앱 재빌드 없이 내용이 반영된다.
 */
import bundle from '../../data/study-summaries.json'
import { supabase } from './supabase.js'
import abilitySummaries from '../../data/ability-summaries.json'

const CACHE_KEY = 'gyo6.studySummaries.v2'
const REFRESH_KEY = 'gyo6.studySummaries.updatedAt.v1'
const FIRST_REFRESH_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

// 번들로 초기화(오프라인에서도 즉시 동작)
let store = { ...bundle }
let cachedOverrides = {}

// localStorage 캐시 병합(앱 시작 직후, 네트워크 전에도 최신 사용)
try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  if (cached && typeof cached === 'object') {
    cachedOverrides = cached
    store = { ...bundle, ...cachedOverrides }
  }
} catch { /* 무시 */ }

// 26v1 영역 이름 → 요점정리가 저장된 옛 영역 키.
//
// 요점정리는 구 NCS 10영역 이름으로 저장돼 있는데(`area:의사소통`), 앱은
// 26v1 이름(`의사소통능력`)으로 찾는다. 그래서 **자료가 있는데도** 7영역 중
// 6영역에서 요점정리가 안 떴다. 이름이 그대로인 직업윤리 하나만 우연히 맞았다.
//
// 학생 화면에서는 "NCS 자율학습은 공부 단계 없이 바로 문제로 간다"로 보였다.
// 콘텐츠가 없어서가 아니라 열쇠가 안 맞아서였다.
//
// 합쳐진 영역은 원래 것들을 순서대로 본다 — 26v1 이 정보·기술을 디지털로,
// 자원관리·조직이해를 문제해결로 합쳤다.
const AREA_SUMMARY_KEYS = {
  의사소통능력: ['area:의사소통'],
  수리능력: ['area:수리'],
  문제해결능력: ['area:문제해결', 'area:자원관리', 'area:조직이해'],
  자기관리능력: ['area:자기개발'],
  대인관계능력: ['area:대인관계'],
  디지털능력: ['area:정보능력', 'area:기술능력'],
  직업윤리: ['area:직업윤리'],
}

/** 합쳐진 영역은 요점정리도 합쳐서 보여 준다. 하나만 보이면 나머지는 영영 안 읽힌다. */
function mergeSummaries(list) {
  const parts = list.map(k => store[k]).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return {
    ...parts[0],
    keyPoints: parts.flatMap(p => p.keyPoints ?? []),
    mustRemember: parts.flatMap(p => p.mustRemember ?? []),
    terms: parts.flatMap(p => p.terms ?? []),
    tips: parts.flatMap(p => p.tips ?? []),
  }
}

export function getSummary(key) {
  if (!key) return null
  if (store[key]) return store[key]
  // 하위능력(문서소통능력 등) 단위 요점정리. NCS 자율학습은 하위능력을 골라
  // 들어오므로, 고른 것과 같은 단위의 요점이 있으면 그것이 우선이다.
  if (abilitySummaries[key]) return abilitySummaries[key]
  // `area:의사소통능력` 처럼 26v1 이름으로 물어보면 옛 키로 바꿔 찾는다.
  if (key.startsWith('area:')) {
    const mapped = AREA_SUMMARY_KEYS[key.slice(5)]
    if (mapped) return mergeSummaries(mapped)
  }
  return null
}

let refreshed = false
export async function refreshStudySummaries() {
  if (refreshed) return
  try {
    const since = localStorage.getItem(REFRESH_KEY)
      || new Date(Date.now() - FIRST_REFRESH_LOOKBACK_MS).toISOString()
    const { data, error } = await supabase
      .from('study_summaries')
      .select('key, data, updated_at')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
    if (error || !data) return
    for (const row of data) cachedOverrides[row.key] = row.data
    store = { ...bundle, ...cachedOverrides }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cachedOverrides))
      localStorage.setItem(
        REFRESH_KEY,
        data.at(-1)?.updated_at || new Date().toISOString(),
      )
    } catch { /* 용량 초과 등 무시 */ }
    refreshed = true
  } catch { /* 오프라인 등 → 번들/캐시 유지 */ }
}
