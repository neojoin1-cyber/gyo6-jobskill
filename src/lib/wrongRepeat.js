const positiveCount = value => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : null
}

/**
 * 서버 wrong_answers 행이 있으면 wrong_count를 기준으로 삼는다.
 * 서버 행이 없는 옛 미션 기록만 동일 문항의 제출 횟수로 보완한다.
 */
export function buildWrongAttemptCounts(items = []) {
  const occurrences = {}
  const persisted = {}

  for (const item of items) {
    if (!item?.qId) continue
    occurrences[item.qId] = (occurrences[item.qId] ?? 0) + 1
    const count = positiveCount(item.wrongCount)
    if (count !== null) persisted[item.qId] = Math.max(persisted[item.qId] ?? 0, count)
  }

  const counts = {}
  for (const questionId of Object.keys(occurrences)) {
    counts[questionId] = persisted[questionId] ?? occurrences[questionId]
  }
  return counts
}

export function countRepeatedQuestions(counts = {}) {
  return Object.values(counts).filter(count => count >= 2).length
}
