const KEY = (subjectId) => `nova_unit_${subjectId}_v1`

export function loadProgress(subjectId) {
  try {
    const raw = localStorage.getItem(KEY(subjectId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function persist(subjectId, p) {
  localStorage.setItem(KEY(subjectId), JSON.stringify(p))
  return p
}

export function getUnitState(p, unitId) {
  return p?.[unitId] ?? { attempts: [], stars: 0, lastScore: null, bestScore: null }
}

// 이전 단원에 별 1개 이상이면 다음 단원 해금
export function isUnitUnlocked(p, unitIds, idx) {
  if (idx === 0) return true
  return (getUnitState(p, unitIds[idx - 1]).stars ?? 0) >= 1
}

// score 기준: 80+ → 별3, 65~79 → 별2, 50~64 → 별1, 미만 → 별0 (해금 불가)
export function recordUnitResult(subjectId, p, unitId, score) {
  const prev = getUnitState(p, unitId)
  const stars = score >= 80 ? 3 : score >= 65 ? 2 : score >= 50 ? 1 : 0
  const attempts = [...(prev.attempts ?? []), score]
  const avgScore = Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length)
  return persist(subjectId, {
    ...p,
    [unitId]: {
      attempts,
      stars: Math.max(prev.stars ?? 0, stars),
      lastScore: score,
      bestScore: Math.max(prev.bestScore ?? 0, score),
      avgScore,
    },
  })
}

export function resetSubjectProgress(subjectId) {
  localStorage.removeItem(KEY(subjectId))
}
