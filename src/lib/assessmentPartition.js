/**
 * Keeps guided self-study items separate from diagnostic and mock assessments.
 * The lane is content-derived so duplicate stems cannot leak under new ids.
 */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]+/g, '')
}

function choiceText(choice) {
  return typeof choice === 'object'
    ? (choice?.text ?? choice?.label ?? choice?.value ?? '')
    : choice
}

export function questionContentKey(question) {
  const stem = question?.stem ?? question?.question ?? question?.prompt ?? ''
  const context = question?.context ?? question?.passage ?? ''
  const choices = (question?.choices || []).map(choiceText).map(normalize).sort()
  const content = `${normalize(stem)}|${normalize(context)}|${choices.join('|')}`
  return content.replace(/^\|+|\|+$/g, '') || `id:${question?.id ?? 'unknown'}`
}

function hashContent(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function questionPartitionIndex(question, partitions = 2) {
  return hashContent(questionContentKey(question)) % Math.max(1, partitions)
}

export function questionLane(question) {
  if (question?.learningLane === 'study' || question?.learningLane === 'assessment') {
    return question.learningLane
  }
  return questionPartitionIndex(question, 2) === 0 ? 'assessment' : 'study'
}

export function selectQuestionLane(questions, lane) {
  return (questions || []).filter(question => questionLane(question) === lane)
}

export const studyQuestions = questions => selectQuestionLane(questions, 'study')
export const assessmentQuestions = questions => selectQuestionLane(questions, 'assessment')

export function questionIdLane(question) {
  const identity = String(question?._baseId || question?.id || questionContentKey(question))
  return hashContent(identity) % 2 === 0 ? 'assessment' : 'study'
}

export const studyQuestionsById = questions =>
  (questions || []).filter(question => questionIdLane(question) === 'study')
export const assessmentQuestionsById = questions =>
  (questions || []).filter(question => questionIdLane(question) === 'assessment')
