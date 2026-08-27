const learningAsset = (name) => `${import.meta.env?.BASE_URL || '/'}images/learning/${name}`

const VISUALS = [
  {
    src: learningAsset('workplace-documents.webp'),
    alt: '학생 인턴이 이메일과 업무 문서의 날짜와 조건을 대조하는 모습',
    words: ['문서', '독해', '의사소통', '이메일', '안내', '공지', '보고', '회의록', '읽기', '영어', '지시어', '요지'],
  },
  {
    src: learningAsset('workplace-data.webp'),
    alt: '학생 인턴이 물류 자료와 그래프를 계산기로 검산하는 모습',
    words: ['수리', '계산', '자료', '그래프', '표', '비율', '단위', '수량', '시간', '통계', '금융', '예산'],
  },
  {
    src: learningAsset('workplace-teamwork.webp'),
    alt: '학생 인턴들이 부품과 점검표를 보며 해결책을 함께 찾는 모습',
    words: ['문제해결', '팀워크', '협업', '대인관계', '갈등', '기술', '안전', '품질', '의사결정', '자원', '조직'],
  },
  {
    src: learningAsset('workplace-interview.webp'),
    alt: '학생이 모의 면접에서 자신의 경험을 구조적으로 설명하는 모습',
    words: ['면접', '자기소개', '지원동기', 'star', 'prep', '블라인드', '채용'],
  },
  {
    src: learningAsset('workplace-reflection.webp'),
    alt: '학생이 상담교사와 직장 상황의 대응 원칙을 차분히 비교하는 모습',
    words: ['인성', '윤리', '태도', '성찰', '자기관리', '직업윤리', '책임', '정직', '가치관'],
  },
]

const STOP_WORDS = new Set(['그리고', '에서', '으로', '하는', '한다', '하기', '확인', '이해', '개념', '문항', '문제', '정답', '선택지'])

function plain(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function clip(value, max = 220) {
  const text = plain(value)
  return [...text].length > max ? `${[...text].slice(0, max).join('').trim()}...` : text
}

function engagementSubject(point = {}) {
  const sample = typeof point.sampleQuestion === 'object' ? point.sampleQuestion : {}
  const value = point.topic || sample.stem || point.situation || sample.context || '이 장면의 판단'
  return clip(value.replace(/[?？.!。]+$/g, ''), 34)
}

/**
 * 학습 장면별 판단 문구를 만든다. 콘텐츠에 직접 작성한 문구가 있으면 항상 우선한다.
 * 과목 공통 문구만 반복하지 않고 현재 주제·자료 유형·응답 방식을 문장에 반영한다.
 */
export function buildEngagementCopy({ courseKind, point = {}, contextKind = '', isListening = false } = {}) {
  const custom = point.engagementCopy || point.engagement || {}
  if (custom.first && custom.reveal && custom.twist) return custom

  const sample = typeof point.sampleQuestion === 'object' ? point.sampleQuestion : {}
  const source = sample.sourceQuestion || {}
  const subject = engagementSubject(point)
  const quoted = `“${subject}”`
  const hasVisual = Boolean(source.visual || sample.visual || point.visual)
  const isWriting = sample.type === 'writing-practice' || courseKind === 'cover-letter'
  const isInterview = Boolean(sample.isInterview) || courseKind === 'interview'
  const isReflection = sample.type === 'reflection' || courseKind === 'personality'

  let generated
  if (isListening) generated = {
    first: `음성을 먼저 듣고, 질문 ${quoted}에 답할 단서를 한 가지 메모하세요.`,
    reveal: `질문 ${quoted}의 결정 단서가 실제 음성의 어느 표현에 있었는지 확인하세요.`,
    twist: `음성을 한 번만 다시 들을 수 있다면 해당 질문과 관련된 어떤 표현을 먼저 확인할까요?`,
  }
  else if (isWriting) generated = {
    first: `지원 문항에서 주제 ${quoted}에 필요한 사실을 표시한 뒤 첫 문장을 직접 고쳐 쓰세요.`,
    reveal: `내 문장의 행동과 결과가 주제 ${quoted}와 어떻게 연결되는지 확인하세요.`,
    twist: `지원 직무가 바뀐다면 주제 ${quoted}에 맞는 근거도 그대로 사용할 수 있을까요?`,
  }
  else if (isInterview) generated = {
    first: `질문 ${quoted}에 답할 내 경험 한 가지를 고른 뒤 20초 동안 먼저 말해 보세요.`,
    reveal: `내 답에서 해당 질문과 연결되는 본인 행동과 확인 가능한 결과를 찾으세요.`,
    twist: `면접관이 질문 ${quoted}에 대해 “본인이 직접 한 일은 무엇인가요?”라고 되묻는다면?`,
  }
  else if (isReflection) generated = {
    first: `주제 ${quoted}에 가장 가까운 평소 행동을 고르고 실제 장면 하나를 떠올리세요.`,
    reveal: `선택한 응답이 해당 주제와 관련된 평소 행동과 일관되는지 확인하세요.`,
    twist: `상대와 장소가 달라져도 주제 ${quoted}에 같은 기준으로 답할 수 있을까요?`,
  }
  else if (contextKind === 'misread') generated = {
    first: `제시문과 잘못 읽은 뜻을 비교해 질문 ${quoted}에서 달라지는 행동을 먼저 말하세요.`,
    reveal: `질문 ${quoted}의 판단을 바꾼 원문 표현을 정확히 짚으세요.`,
    twist: `오해한 표현이 반대 의미였다면 질문 ${quoted}에 대한 판단도 바뀌어야 할까요?`,
  }
  else if (contextKind === 'mistake') generated = {
    first: `상황 속 실수를 찾아 질문 ${quoted}의 기준으로 가장 먼저 고칠 행동을 고르세요.`,
    reveal: `그 행동이 질문 ${quoted}의 원칙과 어긋난 구체적인 이유를 확인하세요.`,
    twist: `실수의 원인이 개인이 아니라 업무 절차였다면 질문 ${quoted}의 해결 순서도 달라질까요?`,
  }
  else if (hasVisual) generated = {
    first: `자료에서 질문 ${quoted}에 답할 숫자·표현·조건을 먼저 하나 표시하세요.`,
    reveal: `표시한 자료가 질문 ${quoted}의 결론과 어떻게 연결되는지 확인하세요.`,
    twist: `자료의 핵심 수치나 조건 하나가 달라지면 질문 ${quoted}의 판단도 바뀔까요?`,
  }
  else if (courseKind === 'recruitment' || courseKind === 'ncs') generated = {
    first: `질문 ${quoted}에 답하기 전에 제시문에서 결정 조건 하나를 표시하세요.`,
    reveal: `질문 ${quoted}의 정답 근거와 가장 그럴듯한 함정의 차이를 한 문장으로 설명하세요.`,
    twist: `결정 조건 하나가 반대로 바뀐다면 질문 ${quoted}의 선택도 바뀌어야 할까요?`,
  }
  else generated = {
    first: `질문 ${quoted}에 맞는 행동을 먼저 고르고 상황 속 근거를 한 가지 짚으세요.`,
    reveal: `처음 판단이 질문 ${quoted}의 실제 기준과 어디에서 같거나 달랐는지 확인하세요.`,
    twist: `현장 조건 하나가 달라져도 질문 ${quoted}에 같은 판단을 유지할 수 있을까요?`,
  }

  return {
    first: custom.first || generated.first,
    reveal: custom.reveal || generated.reveal,
    twist: custom.twist || generated.twist,
  }
}

function tokens(value) {
  return new Set((plain(value).toLowerCase().match(/[가-힣]{2,}|[a-z]{3,}|\d+(?:\.\d+)?/g) || [])
    .filter(token => !STOP_WORDS.has(token)))
}

export function learningVisualFor(value, courseKind) {
  if (courseKind === 'interview') return VISUALS[3]
  if (courseKind === 'cover-letter') return VISUALS[0]
  if (courseKind === 'personality') return VISUALS[4]
  const text = plain(value).toLowerCase()
  let best = VISUALS[0]
  let bestScore = -1
  for (const visual of VISUALS) {
    const score = visual.words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0)
    if (score > bestScore) { best = visual; bestScore = score }
  }
  return best
}

function questionScore(point, question) {
  const wanted = tokens(`${point.topic ?? ''} ${point.learn ?? ''}`)
  const haystack = plain(`${question.stem ?? ''} ${question.context ?? ''} ${question.explanation ?? ''} ${question.area ?? ''} ${question.lessonTitle ?? ''}`).toLowerCase()
  let score = 0
  for (const token of wanted) if (haystack.includes(token)) score += token.length >= 4 ? 3 : 2
  if (question.context) score += 2
  if (question.visual) score += 2
  if (Array.isArray(question.choices) && question.choices.length >= 4) score += 1
  const type = question.type || question.questionMode
  const hasScreenChoices = Array.isArray(question.choices) && question.choices.length >= 2
  score += hasScreenChoices || type === 'ox' ? 12 : -20
  return score
}

function answerLetter(answer) {
  if (Number.isInteger(answer)) return String.fromCharCode(65 + answer)
  const value = String(answer ?? '').trim().toUpperCase()
  if (/^[1-9]$/.test(value)) return String.fromCharCode(64 + Number(value))
  return value
}

function formatLabel(question) {
  if (question.type === 'matching') return '연결형'
  if (question.type === 'pulldown') return '풀다운형'
  if (question.type === 'multi') return '복수선택형'
  if (question.type === 'text') return '단답형'
  if (question.type === 'ox' || question.questionMode === 'ox') return '학습용 O/X'
  const count = question.choices?.length
  return count ? `${count}지선다형` : '선택형'
}

function strategyFor(value) {
  const text = plain(value).toLowerCase()
  if (/(수리|계산|비율|단위|그래프|표|통계|금융|예산)/.test(text)) {
    return ['구하려는 값·단위 먼저 표시', '주어진 수치·조건만 식에 대입', '결과의 단위·크기 재검산']
  }
  if (/(면접|자기소개|지원동기|star|prep|블라인드)/.test(text)) {
    return ['경험·의견·직무 중 질문 요구부터 구분', 'STAR 또는 PREP으로 답변 순서 구성', '추상적 장점 대신 행동·결과 제시']
  }
  if (/(인성|윤리|태도|성찰|책임|정직|가치관)/.test(text)) {
    return ['좋아 보이는 답보다 실제 행동 기준 확인', '안전·정직·책임·협업 원칙과 상황 함께 검토', '비슷한 상황에서도 응답 기준 일관성 확인']
  }
  if (/(문서|독해|이메일|안내|공지|회의록|요지|지시어|영어)/.test(text)) {
    return ['일치·불일치·요지 중 발문 요구 먼저 표시', '날짜·수량·조건·결정 표현을 지문에서 직접 확인', '선택지와 지문 근거를 한 항목씩 대조']
  }
  return ['발문이 요구하는 판단을 한 문장으로 정리', '확인된 사실과 추측을 분리', '선택지를 원칙·근거에 대조']
}

function toSampleQuestion(question, point) {
  if (!question) return null
  if (question.type === 'writing-practice') {
    return {
      type: 'writing-practice',
      questionId: question.questionId,
      format: question.format || '실전 고쳐쓰기',
      stem: plain(question.stem),
      context: plain(question.context),
      purpose: plain(question.purpose),
      required: (question.required || []).map(plain).filter(Boolean),
      structure: (question.structure || []).map(plain).filter(Boolean),
      draft: plain(question.draft),
      checklist: (question.checklist || []).map(plain).filter(Boolean),
      modelAnswer: plain(question.modelAnswer),
      explanation: plain(question.explanation),
      limit: Number(question.limit) || 700,
      thinkingSteps: strategyFor(`자기소개서 ${point.topic ?? ''} ${point.learn ?? ''}`),
      sourceQuestion: question,
    }
  }
  if (question.type === 'reflection') {
    return {
      stem: plain(question.stem || question.question),
      context: plain(question.context),
      choices: (question.choices || []).map((choice, index) => ({
        value: String.fromCharCode(65 + index),
        text: plain(choice),
      })),
      answer: null,
      type: 'reflection',
      feedback: plain(question.feedback || question.explanation),
      explanation: plain(question.feedback || question.explanation),
      format: '응답 기준 성찰',
      thinkingSteps: ['문장이 묻는 행동을 한 문장으로 정리', '좋아 보이는 답 대신 평소 행동 기준 확인', '선택 이유를 실제 경험과 연결'],
      sourceQuestion: question,
    }
  }
  if (question.isInterview) {
    return {
      stem: plain(question.stem || question.question),
      context: plain(question.context),
      choices: [],
      answer: null,
      explanation: plain(question.explanation),
      format: question.format || '면접 질문형',
      isInterview: true,
      modelAnswer: plain(question.modelAnswer),
      answerPoints: (question.answerPoints || []).map(plain).filter(Boolean),
      thinkingSteps: strategyFor(`면접 ${point.topic ?? ''} ${point.learn ?? ''}`),
      sourceQuestion: question,
    }
  }
  const isOx = question.type === 'ox' || question.questionMode === 'ox'
  const answer = Array.isArray(question.answer)
    ? question.answer.map(answerLetter)
    : answerLetter(question.answer)
  const sourceChoices = question.choices?.length ? question.choices : (isOx ? ['O', 'X'] : [])
  const choices = sourceChoices.map((choice, index) => ({
    value: isOx ? (index === 0 ? 'O' : 'X') : String.fromCharCode(65 + index),
    text: plain(typeof choice === 'object' ? (choice.text ?? choice.label ?? choice.value) : choice),
  }))
  return {
    stem: plain(question.stem),
    context: plain(question.context),
    choices,
    answer,
    type: question.type || question.questionMode || (isOx ? 'ox' : 'choice'),
    blanks: question.blanks,
    table: question.table,
    explanation: plain(question.explanation),
    format: formatLabel(question),
    thinkingSteps: strategyFor(`${point.topic ?? ''} ${point.learn ?? ''}`),
    sourceQuestion: question,
  }
}

function toInterviewSample(value, point) {
  const text = plain(value)
  const parts = text.split(/\s*(?:→|=>)\s*(?:모범\s*답안(?:\s*예시)?\s*[:：]?)?/)
  return {
    stem: parts[0] || text,
    context: '',
    choices: [],
    answer: null,
    explanation: '',
    format: '면접 질문형',
    isInterview: true,
    modelAnswer: parts.slice(1).join(' ').trim(),
    answerPoints: [],
    thinkingSteps: strategyFor(`면접 ${point.topic ?? ''} ${point.learn ?? ''}`),
  }
}

export function buildLearningPoints(summary, questions = []) {
  const points = summary?.keyPoints ?? []
  const usable = questions.filter(question => question && !question.excludeFromQuiz && plain(question.stem))
  const used = new Set()

  return points.map((point, index) => {
    if (typeof point !== 'object' || !point) return point
    let picked = null
    const providedObject = point.sampleQuestion && typeof point.sampleQuestion === 'object'
    const providedInterview = summary?.courseKind === 'interview' &&
      typeof point.sampleQuestion === 'string' && !!plain(point.sampleQuestion)
    if (!providedObject && !providedInterview && usable.length) {
      const ranked = usable
        .map((question, questionIndex) => ({
          question,
          questionIndex,
          score: questionScore(point, question) +
            (summary?.courseKind === 'interview' && question.isInterview ? 10 : 0),
        }))
        .filter(item => !used.has(item.question.id ?? item.questionIndex))
        .sort((a, b) => b.score - a.score || a.questionIndex - b.questionIndex)
      picked = ranked[0]?.question ?? usable[index % usable.length]
      used.add(picked?.id ?? usable.indexOf(picked))
    }
    const sampleQuestion = providedInterview
      ? toInterviewSample(point.sampleQuestion, point)
      : providedObject
      ? toSampleQuestion({
          ...point.sampleQuestion,
          explanation: point.sampleQuestion.explanation || plain(point.example),
        }, point)
      : toSampleQuestion(picked, point)
    const visual = learningVisualFor(`${summary?.title ?? ''} ${point.topic ?? ''} ${point.learn ?? ''}`, summary?.courseKind)
    // 발문 자체를 별도의 '상황'으로 중복 표시하지 않음. 실제 맥락이 있을 때만 상황 영역을 만듦.
    const situation = point.situation || sampleQuestion?.context || ''
    const example = point.example || (typeof point.sampleQuestion === 'string' ? point.sampleQuestion : '')
    return { ...point, example, sampleQuestion, visual, situation }
  })
}

function choiceText(choice) {
  return plain(typeof choice === 'object' ? (choice.text ?? choice.label ?? choice.value) : choice)
}

function answerIndexes(question) {
  const source = Array.isArray(question.answer) ? question.answer : [question.answer]
  return source.map(answer => {
    if (Number.isInteger(answer)) return answer
    const value = String(answer ?? '').trim().toUpperCase()
    if (value === 'O') return 0
    if (value === 'X') return 1
    if (/^[A-Z]$/.test(value)) return value.charCodeAt(0) - 65
    if (/^[1-9]$/.test(value)) return Number(value) - 1
    return -1
  }).filter(index => index >= 0)
}

function questionChoices(question) {
  const isOx = question.type === 'ox' || question.questionMode === 'ox'
  const source = question.choices?.length ? question.choices : (isOx ? ['O', 'X'] : [])
  return source.map(choiceText)
}

function questionTopic(question, fallbackTitle, index) {
  const stem = plain(question.stem || question.question)
    .replace(/^다음\s+/, '')
    .replace(/[?？]\s*$/, '')
  if (stem && [...stem].length <= 62) return stem
  const label = plain(question.subAbility || question.ncsAbility || question.lessonTitle || fallbackTitle)
  return label || `핵심 판단 ${index + 1}`
}

function noteStyle(value) {
  return plain(value)
    .replace(/(?:입니다|이에요|예요)(?=[.!?]?\s*$)/, '임')
    .replace(/(?:합니다|해야 합니다|하여야 합니다)(?=[.!?]?\s*$)/, '함')
    .replace(/(?:됩니다|되어야 합니다)(?=[.!?]?\s*$)/, '됨')
    .replace(/(?:없습니다)(?=[.!?]?\s*$)/, '없음')
    .replace(/(?:아닙니다)(?=[.!?]?\s*$)/, '아님')
    .replace(/(?:이다)(?=[.!?]?\s*$)/, '임')
    .replace(/(?:한다)(?=[.!?]?\s*$)/, '함')
    .replace(/(?:된다)(?=[.!?]?\s*$)/, '됨')
    .replace(/(?:있다)(?=[.!?]?\s*$)/, '있음')
    .replace(/(?:없다)(?=[.!?]?\s*$)/, '없음')
    .replace(/[.!?。]+$/, '')
}

function answerLeadRemoved(value) {
  return plain(value)
    .replace(/^(?:정답(?:은|:)?\s*)?(?:[A-E]|[1-9]|[①②③④⑤])(?:번)?(?:\([^)]*\))?(?:이다|다|입니다)?[.。:]?\s*/i, '')
    .replace(/^(?:정답\s*및\s*해설\s*)?(?:기초|표준|심화|진단|재도전)?\s*\d*번?\s*정답(?:은|:)?\s*(?:[A-E]|[1-9]|[①②③④⑤])(?:번)?[.。:]?\s*/i, '')
}

function equationFrom(value) {
  const text = plain(value).replace(/\s+/g, '')
  const unit = '(?:건\/시간|개\/시간|명\/시간|시간|분|초|건|개|명|원|만원|%|km|m|kg|g|점|일|회)?'
  const term = `(?:\\([^()]{1,36}\\)|[\\d,.]+${unit})`
  const match = text.match(new RegExp(`${term}(?:[+×xX*÷/−-]${term})+=[\\d,.]+${unit}`))
  return match?.[0]?.replace(/[xX*]/g, '×') || ''
}

function splitOutsideCommas(value) {
  const parts = []
  let current = ''
  let depth = 0
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if ((char === ',' || char === '，') && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function evidenceFrom(value) {
  const rationale = answerLeadRemoved(value)
    .split(/\s(?=(?:반면|[1-5]번|[A-E]는|[①②③④⑤]))/)[0]
  const fragments = rationale
    .split(/(?<=[.!?。])\s+/)
    .flatMap(splitOutsideCommas)
    .map(fragment => fragment.trim())
    .filter(fragment => [...fragment].length >= 14 && [...fragment].length <= 125)
    .filter(fragment => !/[=＝]/.test(fragment))
    .filter(fragment => !/(?:고|며|면서|인데|지만|므로|하면|해서|하여)\s*$/.test(fragment))
  const ranked = fragments.map((fragment, index) => ({
    fragment,
    index,
    score: (/(모두|충족|일치|맞|근거|직접|병목|목표|기준|가능|불가능|따라서)/.test(fragment) ? 4 : 0) +
      (/(?:다|함|임|됨|없음|있음)[.!?。]?\s*$/.test(fragment) ? 5 : 0) +
      (/(?:시에|에는|에서|으로|에게|부터|까지)\s*$/.test(fragment) ? -5 : 0) +
      (/(아니|오답|틀림|위반)/.test(fragment) ? -3 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index)
  return ranked[0]?.fragment || ''
}

function conceptText(question) {
  const source = plain(question.teachingNote || question.explanation || question.modelAnswer)
  const lines = []
  const evidence = evidenceFrom(source)
  lines.push(`핵심｜${evidence ? noteStyle(evidence) : '자료의 수치·조건을 판단 기준과 대조'}`)
  const equation = equationFrom(source)
  if (equation) lines.push(`계산｜${equation}`)
  const check = strategyFor(`${question.area ?? ''} ${question.lessonTitle ?? ''} ${question.stem ?? ''}`)[0]
  lines.push(`확인｜${noteStyle(check)}`)
  return lines.join('\n')
}

function representativeQuestions(questions, limit = 5) {
  const usable = questions.filter(question =>
    question && !question.excludeFromQuiz && plain(question.stem || question.question))
  const ranked = usable.map((question, index) => ({
    question,
    index,
    score: (question.context ? 4 : 0) + (question.explanation ? 4 : 0) +
      (question.distractorTypes?.length ? 3 : 0) + (question.visual ? 2 : 0) +
      (question.isInterview ? 3 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index)

  const picked = []
  const seen = new Set()
  for (const item of ranked) {
    const signature = tokens(`${item.question.stem || item.question.question} ${item.question.explanation}`)
    const key = [...signature].slice(0, 5).sort().join('|')
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    picked.push(item.question)
    if (picked.length >= limit) break
  }
  for (const item of ranked) {
    if (picked.includes(item.question)) continue
    picked.push(item.question)
    if (picked.length >= limit) break
  }
  return picked
}

const COURSE_INTROS = {
  'education-certification': '교육부·대한상공회의소 직업공통능력 인증의 공식 영역 안에서, 상황의 근거를 찾고 상위 등급 판단까지 연결합니다.',
  ncs: '고용노동부·한국산업인력공단 NCS 직업기초능력의 개념과 직무 적용 원리를 익힌 뒤 문제로 확인합니다.',
  recruitment: 'NCS 주과정을 바탕으로 지원 분야에서 추가로 요구되는 채용필기 심화 내용을 학습합니다.',
  interview: '실제 면접 상황에서 적절한 대응을 판단하고, 자신의 경험으로 직접 답한 뒤 고쳐 봅니다.',
  personality: '정답을 만들지 않고 검사 형식과 자신의 평소 행동 기준을 이해한 뒤 안정적인 응답 습관을 익힙니다.',
  'cover-letter': '지원 문항의 필수 요구를 표시하고, 감점 초안을 자신의 사실 근거로 직접 고쳐 씁니다.',
}

/**
 * 요점 JSON이 없는 단원도 문제로 곧장 떨어지지 않게 만드는 오프라인 폴백.
 * 새 사실을 만들지 않고 현재 문항의 지문·정답·해설만 학습 문장으로 사용한다.
 */
export function buildQuestionDrivenSummary({ title, questions = [], courseKind = 'practice', intro }) {
  const picked = representativeQuestions(questions)
  if (!picked.length) return null
  const keyPoints = picked.map((question, index) => ({
    topic: questionTopic(question, title, index),
    mode: question.level === '심화' || question.isAGrade ? '암기' : '이해',
    situation: plain(question.context || question.stem || question.question),
    learn: conceptText(question),
  }))
  const mustRemember = picked.slice(0, 3).map((question, index) => {
    const choices = questionChoices(question)
    const correct = answerIndexes(question).map(answerIndex => choices[answerIndex]).filter(Boolean)
    const topic = questionTopic(question, title, index)
    return correct.length ? `${topic}: ${correct.join(', ')}` : clip(conceptText(question), 120)
  })
  return {
    title,
    intro: intro || COURSE_INTROS[courseKind] || '상황의 근거를 이해하고 실제 문제에 적용합니다.',
    keyPoints,
    mustRemember,
    terms: [],
    tips: [],
    generatedFromQuestions: true,
    courseKind,
  }
}

function distractorType(question, wrongIndex, correctIndexes) {
  const types = question.distractorTypes || []
  const wrongIndexes = questionChoices(question).map((_, index) => index)
    .filter(index => !correctIndexes.includes(index))
  return plain(types[wrongIndexes.indexOf(wrongIndex)])
}

function sentenceForChoice(explanation, choiceIndex) {
  const sentences = plain(explanation).split(/(?<=[.!?。])\s+/)
  const number = choiceIndex + 1
  return sentences.find(sentence =>
    new RegExp(`(?:${number}번|${'①②③④⑤⑥⑦⑧⑨'[choiceIndex] || ''})`).test(sentence)) || ''
}

/** 실제 문항의 오답 선택지와 해설을 연결한 오답 학습 카드. */
export function buildLearningMistakes(summary, questions = []) {
  const sourceTips = summary?.tips || []
  const usable = questions.filter(question => {
    if (!question || question.excludeFromQuiz || question.isInterview) return false
    const choices = questionChoices(question)
    return choices.length >= 2 && answerIndexes(question).length > 0
  })
  const count = Math.max(sourceTips.length, Math.min(3, usable.length))
  if (!count) return sourceTips.map(tip => typeof tip === 'object' ? tip : { point: plain(tip) })

  const mistakes = []
  const usedQuestions = new Set()
  for (let index = 0; index < count; index++) {
    const rawTip = sourceTips[index % Math.max(1, sourceTips.length)]
    if (rawTip && typeof rawTip === 'object' && rawTip.wrongChoice) {
      mistakes.push(rawTip)
      continue
    }
    const question = rawTip
      ? usable
          .map((candidate, candidateIndex) => ({
            candidate,
            candidateIndex,
            score: questionScore({ topic: plain(rawTip), learn: plain(rawTip) }, candidate),
          }))
          .filter(item => !usedQuestions.has(item.candidate.id ?? item.candidateIndex))
          .sort((a, b) => b.score - a.score || a.candidateIndex - b.candidateIndex)[0]?.candidate
      : usable[index % usable.length]
    if (!question) {
      mistakes.push({ point: plain(rawTip) })
      continue
    }
    usedQuestions.add(question.id ?? usable.indexOf(question))
    const choices = questionChoices(question)
    const correctIndexes = answerIndexes(question)
    const wrongIndexes = choices.map((_, choiceIndex) => choiceIndex)
      .filter(choiceIndex => !correctIndexes.includes(choiceIndex))
    const wrongIndex = wrongIndexes[index % wrongIndexes.length]
    const trap = distractorType(question, wrongIndex, correctIndexes)
    const specificReason = sentenceForChoice(question.explanation, wrongIndex)
    const correctChoice = correctIndexes.map(answerIndex => ({
      label: String.fromCharCode(65 + answerIndex),
      text: choices[answerIndex],
    })).filter(choice => choice.text)
    mistakes.push({
      point: plain(rawTip) || trap || '선택지의 표현보다 지문과 발문의 근거를 먼저 확인합니다.',
      stem: plain(question.stem),
      context: plain(question.context),
      wrongChoice: { label: String.fromCharCode(65 + wrongIndex), text: choices[wrongIndex] },
      trap: trap || '근거와 조건을 끝까지 대조하지 않은 선택',
      whyWrong: specificReason || clip(question.explanation, 260),
      correctChoice,
      correction: clip(question.explanation, 320),
      checklist: strategyFor(`${summary?.title ?? ''} ${question.stem ?? ''}`),
      sourceQuestion: question,
    })
  }
  return mistakes
}
