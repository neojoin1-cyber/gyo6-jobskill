import { userLocalStorage as localStorage } from './userLocalStorage.js'

// 도장깨기 진행 상황 관리 (localStorage 기반)
const KEY = 'qm_quest_v1'

export function loadQuestProgress() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') }
  catch { return null }
}

export function saveQuestProgress(p) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function initQuestProgress(character) {
  const p = { character, startedAt: Date.now(), areas: {} }
  saveQuestProgress(p)
  return p
}

export function getAreaState(p, areaId) {
  return p?.areas?.[areaId] ?? {
    learnDone: false, attempts: [], avgScore: null,
    bestScore: null, cleared: false, lastScore: null,
  }
}

// 이전 영역 clear 여부로 잠금 해제 판단
export function isAreaUnlocked(p, areaIds, idx) {
  if (idx === 0) return true
  return getAreaState(p, areaIds[idx - 1]).cleared === true
}

export function markLearnDone(p, areaId) {
  const prev = getAreaState(p, areaId)
  const updated = {
    ...p,
    areas: { ...p.areas, [areaId]: { ...prev, learnDone: true } },
  }
  saveQuestProgress(updated)
  return updated
}

export function recordExamScore(p, areaId, score) {
  const prev = getAreaState(p, areaId)
  const attempts = [...(prev.attempts || []), score]
  const avgScore  = Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length)
  const bestScore = Math.max(...attempts)
  const cleared   = prev.cleared || score >= 80
  const updated = {
    ...p,
    areas: {
      ...p.areas,
      [areaId]: {
        ...prev,
        attempts, avgScore, bestScore, cleared,
        lastScore: score,
        learnDone: score < 60 ? false : prev.learnDone, // 60점 미만 → 재학습 필요
      },
    },
  }
  saveQuestProgress(updated)
  return updated
}

export function resetQuestProgress() {
  localStorage.removeItem(KEY)
}
