import { answerIdxOf } from './questionNorm.js'

const BAD_CHOICES = [
  '좋아 보이는 표현만 외워 그대로 반복한다.',
  '자료의 조건을 확인하지 않고 첫인상으로 결정한다.',
  '한 번의 예외를 전체 상황의 기준으로 삼는다.',
]

function plain(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function choiceText(choice) {
  return plain(typeof choice === 'object' ? (choice.text ?? choice.label ?? choice.value) : choice)
}

function rotateAnswer(correct, distractors, seed) {
  const unique = [...new Set(distractors.map(plain).filter(item => item && item !== correct))].slice(0, 3)
  while (unique.length < 3) unique.push(BAD_CHOICES[unique.length])
  const answer = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
  const choices = [...unique]
  choices.splice(answer, 0, correct)
  return { choices, answer }
}

function sourceCandidates(summary, questions) {
  const direct = Array.isArray(questions) ? questions : []
  const embedded = (summary?.keyPoints || [])
    .map(point => typeof point === 'object' ? point?.sampleQuestion : null)
    .filter(Boolean)
  const seen = new Set()
  return [...direct, ...embedded].filter(question => {
    const stem = plain(question?.stem ?? question?.question)
    const choices = question?.choices
    const answer = answerIdxOf(question)
    if (!stem || !Array.isArray(choices) || choices.length < 2 || choices.length > 5) return false
    if (answer < 0 || answer >= choices.length || seen.has(stem)) return false
    seen.add(stem)
    return true
  })
}

function sourceQuestion(question) {
  const choices = question.choices.map(choiceText)
  const answer = answerIdxOf(question)
  return {
    stem: plain(question.stem ?? question.question),
    choices,
    answer,
    explanation: plain(question.explanation ?? question.feedback) || `정답은 ${answer + 1}번입니다. 오늘 학습한 판단 기준과 선택지의 조건을 다시 대조하세요.`,
    kind: 'review',
  }
}

function fallbackQuestion(summary, index) {
  const takeaways = (summary?.mustRemember || []).map(plain).filter(Boolean)
  const topics = (summary?.keyPoints || []).map(point => plain(typeof point === 'object' ? (point.topic || point.learn) : point)).filter(Boolean)
  const correct = takeaways[index] || topics[index] || topics[0] || '발문과 자료의 조건을 확인한 뒤 근거로 판단한다.'
  const stem = index === 0
    ? `‘${plain(summary?.title) || '이번 단원'}’에서 가장 먼저 적용할 기준은?`
    : '오늘 배운 내용을 실제 학습 행동으로 가장 바르게 옮긴 것은?'
  return {
    stem,
    ...rotateAnswer(correct, BAD_CHOICES, `${summary?.title}:${index}`),
    explanation: `오늘 학습에서 확인한 핵심 기준은 “${correct}”입니다. 표현을 외우기보다 실제 자료와 조건에 이 기준을 적용해야 합니다.`,
    kind: 'review',
  }
}

function transferQuestion(summary) {
  const kind = summary?.courseKind
  if (kind === 'personality') return {
    stem: '처음 보는 문항에 부정 표현이 들어 있고 앞 문항과 뜻의 방향도 반대다. 가장 적절한 응답 절차는?',
    choices: ['앞 문항에서 누른 번호를 그대로 선택한다.', '좋아 보이는 방향에 최고점을 준다.', '부정 표현을 확인하고 문장을 짧게 바꾼 뒤 평소 행동 기준으로 판단한다.', '뜻이 헷갈리므로 모든 문항에 중간값을 준다.'],
    answer: 2,
    explanation: '새 문항에서도 문장의 방향을 먼저 정확히 읽고 같은 실제 행동 기준을 적용해야 합니다. 번호를 반복하는 것이 일관성은 아닙니다.',
    kind: 'transfer',
  }
  if (kind === 'cover-letter') return {
    stem: '새 지원처의 문항이 “지원 동기와 입사 후 기여”를 함께 요구한다. 기존 자기소개서에서 회사 이름만 바꾸면 안 되는 가장 중요한 이유는?',
    choices: ['글자 수가 항상 짧아지기 때문에', '지원처 근거·지원 직무·입사 후 행동이 새 문항 요구와 연결되지 않기 때문에', '맞춤법 검사를 사용할 수 없기 때문에', '모든 지원처가 서로 다른 글꼴을 요구하기 때문에'],
    answer: 1,
    explanation: '변형 문항에서는 지원처의 실제 근거, 지원 직무, 입사 후 기여 행동을 새 요구에 맞춰 다시 연결해야 합니다.',
    kind: 'transfer',
  }
  if (kind === 'interview') return {
    stem: '준비하지 않은 후속 질문을 받았다. 오늘 배운 기준을 적용한 대응으로 가장 적절한 것은?',
    choices: ['외운 답변을 질문과 관계없이 끝까지 말한다.', '결론을 먼저 말하고 내가 직접 한 행동과 확인 가능한 결과를 근거로 덧붙인다.', '좋아 보이는 장점을 여러 개 나열한다.', '학교명과 가족 배경으로 신뢰를 얻는다.'],
    answer: 1,
    explanation: '새 질문에서도 질문 의도를 확인한 뒤 결론과 실제 행동 근거를 연결해야 합니다. 블라인드 정보와 추상적인 장점 나열은 근거가 되지 않습니다.',
    kind: 'transfer',
  }
  return {
    stem: '처음 보는 자료가 나왔지만 오늘 배운 판단 기준은 같다. 가장 적절한 풀이 행동은?',
    choices: ['익숙한 단어가 있는 선택지를 바로 고른다.', '발문 요구와 바뀐 조건을 표시하고 자료의 근거를 선택지와 다시 대조한다.', '예전에 본 문제의 정답 번호를 반복한다.', '자료보다 가장 긴 선택지를 먼저 고른다.'],
    answer: 1,
    explanation: '변형 문제는 겉모양이 아니라 발문, 조건, 근거를 다시 대조해야 풀 수 있습니다. 오늘 배운 기준을 새 자료에 적용하는 것이 핵심입니다.',
    kind: 'transfer',
  }
}

export function buildAutonomousFormative(summary, questions = []) {
  if (!summary) return null
  const review = sourceCandidates(summary, questions).slice(0, 2).map(sourceQuestion)
  while (review.length < 2) review.push(fallbackQuestion(summary, review.length))
  const takeaways = (summary.mustRemember || []).map(plain).filter(Boolean).slice(0, 3)
  const topicFallback = (summary.keyPoints || []).map(point => plain(typeof point === 'object' ? point.topic : point)).filter(Boolean).reverse()
  while (takeaways.length < 3 && topicFallback.length) takeaways.push(topicFallback.shift())
  while (takeaways.length < 3) takeaways.push('발문·조건·근거를 확인하고 배운 기준을 새 상황에 적용함.')
  return {
    title: `${plain(summary.title) || '이번 단원'} 형성평가`,
    objective: '두 문항으로 오늘의 핵심을 확인하고, 마지막 변형 문항으로 새 상황에 적용합니다.',
    takeaways: takeaways.slice(0, 3),
    questions: [...review, transferQuestion(summary)],
    scope: 'all-autonomous-study',
  }
}
