import { userLocalStorage as localStorage } from './userLocalStorage.js'

const STORAGE_KEY = 'gyo6.assessment.practice-exposure.v1'

function hash(value) {
  let result = 2166136261
  for (const char of String(value || '')) {
    result ^= char.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function exposedAssessmentIds() {
  try {
    const values = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return new Set(Array.isArray(values) ? values.filter(Boolean) : [])
  } catch {
    return new Set()
  }
}

export function markAssessmentPracticeExposure(questionId) {
  if (!questionId) return
  const ids = exposedAssessmentIds()
  if (ids.has(questionId)) return
  ids.add(questionId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function assessmentItemsNotSeenInPractice(items = []) {
  const exposed = exposedAssessmentIds()
  return exposed.size ? items.filter(item => !exposed.has(item?.id)) : items
}

export function rotatingPracticeWindow(items = [], scope = '', size = 10) {
  if (items.length <= size) return items
  const day = Math.floor(Date.now() / 86_400_000)
  const start = (hash(scope) + day * size) % items.length
  return Array.from({ length: size }, (_, index) => items[(start + index) % items.length])
}

function orderedPracticeItems(items = [], scope = '') {
  const unique = [...new Map(items.filter(item => item?.id).map(item => [item.id, item])).values()]
  return unique.sort((left, right) => {
    const delta = hash(`${scope}:${left.id}`) - hash(`${scope}:${right.id}`)
    return delta || String(left.id).localeCompare(String(right.id))
  })
}

/**
 * Returns the next small, non-repeating practice set for a lesson. Unseen items
 * are exhausted first; completed items only return after the lesson bank cycles.
 */
export function practiceCoverageWindow(items = [], scope = '', size = 2, round = 0) {
  const ordered = orderedPracticeItems(items, scope)
  if (!ordered.length) return []
  const exposed = exposedAssessmentIds()
  const unseen = ordered.filter(item => !exposed.has(item.id))
  const source = unseen.length >= Math.min(size, ordered.length) ? unseen : ordered
  const start = (Math.max(0, round) * size) % source.length
  return Array.from({ length: Math.min(size, source.length) }, (_, index) => source[(start + index) % source.length])
}
