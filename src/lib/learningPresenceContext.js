export function normalizeLearningPresenceContext(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  const label = [
    source.subjectLabel,
    source.modeLabel,
    source.areaLabel,
    source.lessonLabel,
  ].filter(Boolean).join(' · ')

  return {
    subject: source.subject || null,
    mode: source.mode || null,
    area: source.area || source.areaId || null,
    lesson: source.lesson || source.lessonId || null,
    label: label || '학습관 탐색',
  }
}
