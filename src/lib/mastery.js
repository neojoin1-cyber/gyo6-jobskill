import { userLocalStorage as localStorage } from './userLocalStorage.js'

const STORAGE_KEY = 'kbs_mastery_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function key(subjectId, lessonId) { return `${subjectId}:${lessonId}` }

export function recordAnswer(subjectId, lessonId, correct) {
  if (!subjectId || !lessonId) return
  const data = load()
  const k = key(subjectId, lessonId)
  if (!data[k]) data[k] = { c: 0, t: 0 }
  data[k].t += 1
  if (correct) data[k].c += 1
  save(data)
}

export function getMastery(subjectId, lessonId) {
  return load()[key(subjectId, lessonId)] ?? null
}

export function getMasteryPct(subjectId, lessonId) {
  const m = getMastery(subjectId, lessonId)
  if (!m || m.t === 0) return null
  return Math.round((m.c / m.t) * 100)
}

export function getMasteryColor(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= 90) return '#10B981'
  if (pct >= 70) return '#F59E0B'
  return '#EF4444'
}

// subjectId 전체의 레슨별 마스터리 맵 반환
export function getAllMastery(subjectId) {
  const data = load()
  const prefix = subjectId + ':'
  const result = {}
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(prefix)) result[k.slice(prefix.length)] = v
  }
  return result
}

// 과목 전체 평균 숙달도 (모든 레슨 합산)
export function getSubjectMasteryPct(subjectId) {
  const data = load()
  const prefix = subjectId + ':'
  let c = 0, t = 0
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(prefix)) { c += v.c; t += v.t }
  }
  return t === 0 ? null : Math.round((c / t) * 100)
}
