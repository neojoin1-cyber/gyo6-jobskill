import integrityManifest from '../../data/question-integrity-quarantine.json' with { type: 'json' }

const quarantined = integrityManifest.quarantined || {}
const normalizeToSingle = new Set(integrityManifest.normalizeToSingle || [])
const augmentDistractors = new Set(integrityManifest.augmentDistractors || [])

function answerIndexes(question) {
  const answers = Array.isArray(question.answer) ? question.answer : [question.answer]
  return answers.map(answer => {
    if (Number.isInteger(answer)) return answer
    const value = String(answer ?? '').trim().toUpperCase()
    if (value === 'O') return 0
    if (value === 'X') return 1
    if (/^[A-Z]$/.test(value)) return value.charCodeAt(0) - 65
    if (/^[1-9]$/.test(value)) return Number(value) - 1
    return -1
  }).filter(index => index >= 0)
}

export function questionIntegrityId(question) {
  return [question?.id, question?.sourceQuestionId].filter(Boolean).find(id => quarantined[id]) || null
}

export function applyQuestionIntegrity(question) {
  if (!question) return question
  const integrityId = questionIntegrityId(question)
  const normalize = normalizeToSingle.has(question.id) || normalizeToSingle.has(question.sourceQuestionId)
  const augment = augmentDistractors.has(question.id) || augmentDistractors.has(question.sourceQuestionId)
  const choices = question.choices || question.options || []
  const correct = new Set(answerIndexes(question))
  const distractorTypes = augment && !question.distractorTypes?.length
    ? choices
        .map((choice, index) => ({ choice, index }))
        .filter(item => !correct.has(item.index))
        .map(item => `이 보기(${String(item.choice).trim()})는 제시문의 조건과 정답 근거를 다시 대조해야 합니다.`)
    : question.distractorTypes
  return {
    ...question,
    ...(normalize ? { questionMode: 'mcq', type: question.type === 'multi' ? 'mcq' : question.type } : {}),
    ...(augment ? {
      distractorTypes,
      integrityEnhancement: 'distractor-guidance',
    } : {}),
    ...(integrityId ? {
      excludeFromQuiz: true,
      integrityStatus: 'quarantined',
      integrityReference: integrityId,
    } : {}),
  }
}

export function applyQuestionIntegrityToPool(questions) {
  return (questions || []).map(applyQuestionIntegrity)
}

export function questionIntegritySummary() {
  return {
    quarantined: Object.keys(quarantined).length,
    augmentedDistractors: augmentDistractors.size,
    normalizedToSingle: normalizeToSingle.size,
    source: integrityManifest.generatedFrom,
  }
}
