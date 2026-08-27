import { courseKindForSubject, learningCaseProvenance } from './learningCaseProvenance.js'

function plain(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

function clip(value, max = 220) {
  const text = plain(value)
  return [...text].length > max ? `${[...text].slice(0, max).join('').trim()}…` : text
}

function items(value, limit = 6) {
  if (Array.isArray(value)) return value.flatMap(item => items(item, limit)).filter(Boolean).slice(0, limit)
  const text = plain(value)
  if (!text) return []
  const rows = text
    .split(/\n+|\s*[•·]\s+|(?<=[.!?。])\s+(?=[가-힣A-Za-z0-9])/)
    .map(row => row.replace(/^(?:[-*]\s*|[①②③④⑤⑥⑦⑧⑨]\s*|\d+[.)]\s*)/, '').trim())
    .filter(row => row.length >= 3)
  return (rows.length ? rows : [text]).map(row => clip(row, 180)).slice(0, limit)
}

function unique(values, limit = 8) {
  const seen = new Set()
  return values.flat().filter(value => {
    const text = plain(typeof value === 'string' ? value : value?.text)
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  }).slice(0, limit)
}

function choiceRows(question) {
  const source = question?.choices?.length ? question.choices : question?.options || []
  return source.map((choice, index) => ({
    label: choice?.value ?? choice?.label ?? String.fromCharCode(65 + index),
    text: plain(typeof choice === 'object' ? (choice.text ?? choice.label ?? choice.value) : choice),
    detail: plain(typeof choice === 'object' ? (choice.explanation ?? choice.reason ?? choice.feedback) : ''),
    index,
  })).filter(choice => choice.text)
}

function choiceReason(question, choice, fallback = '') {
  if (choice.detail) return choice.detail

  const numberToken = `${choice.index + 1}번`
  const labelToken = `${choice.label}번`
  const reasonLines = plain(question?.explanation)
    .split(/(?<=[.!?。])\s+(?=[가-힣A-Za-z0-9])/)
    .map(line => line.trim())
    .filter(Boolean)
  const reason = reasonLines.find(line => (
    line.includes(numberToken) || line.toUpperCase().includes(labelToken.toUpperCase())
  ))
  return reason || fallback
}

function quoteText(value, max = 72) {
  return clip(value, max).replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
}

function answerIndexes(question, choices) {
  if (Number.isInteger(question?.answerIndex)) return [question.answerIndex]
  const source = Array.isArray(question?.answer) ? question.answer : [question?.answer ?? question?.correctAnswer]
  return source.map(answer => {
    if (Number.isInteger(answer)) return answer
    const value = String(answer ?? '').trim().toUpperCase()
    if (/^[A-Z]$/.test(value)) return value.charCodeAt(0) - 65
    if (/^[1-9]$/.test(value)) return Number(value) - 1
    return choices.findIndex(choice => String(choice.label).toUpperCase() === value)
  }).filter(index => index >= 0 && index < choices.length)
}

function summarySource(content) {
  const summary = content.summary || {}
  const card = content.card || {}
  const point = card.point || {}
  const mistake = card.mistake || {}

  if (card.type === 'intro') return {
    heading: `${summary.title || '단원'} 개요`,
    explanation: summary.intro,
    examples: (summary.keyPoints || []).slice(0, 4).map(item => item?.topic || item),
  }
  if (card.type === 'point') return {
    heading: point.topic || card.text || `핵심 ${card.n || 1}`,
    situation: point.situation,
    explanation: point.learn || card.text,
    example: point.example,
    question: point.sampleQuestion,
    checklist: point.sampleQuestion?.thinkingSteps,
    courseKind: summary.courseKind,
  }
  if (card.type === 'recap') return {
    heading: '꼭 기억할 것',
    explanation: summary.mustRemember,
  }
  if (card.type === 'term') return {
    heading: card.term,
    situation: card.def,
    explanation: `${card.term}: ${plain(card.def)}`,
  }
  if (card.type === 'tip') return {
    heading: mistake.stem || '실제 오답으로 고쳐 보기',
    situation: mistake.context || mistake.stem,
    explanation: mistake.correction,
    question: mistake.sourceQuestion,
    mistake,
    checklist: mistake.checklist,
  }
  if (card.type === 'mission') return {
    heading: card.practical ? '실전 답변 마무리' : '다음 문제 행동 정하기',
    situation: card.practical
      ? '학생이 가장 먼저 고칠 기준과 실제 수정 문장 또는 답변 행동을 직접 확정하는 단계임.'
      : '학생이 다음 문제에서 가장 먼저 실행할 판단 기준을 직접 선택하는 단계임.',
    explanation: card.criteria,
    checklist: card.criteria,
  }
  return {
    heading: summary.title || '단원 마무리',
    explanation: summary.mustRemember,
  }
}

function deckSource(content) {
  const beat = content.beat || {}
  const question = beat.example || (beat._t === 'quiz' ? {
    stem: beat.stem,
    choices: beat.options,
    answerIndex: beat.answerIndex,
    explanation: beat.explHtml,
  } : null)
  return {
    heading: beat.h || beat.title || beat.ctitle || beat.keyline,
    situation: beat.ask || beat.quote || beat.stem || beat.qHtml,
    explanation: [beat.html, beat.board, beat.objectives, beat.memo, beat.previewList, beat.answerHtml, beat.explHtml, beat.link],
    example: beat.example?.stem || beat.homework,
    question,
    mistake: { trap: beat.trapHtml },
    checklist: beat.thinkText,
  }
}

function talkSource(content) {
  const talk = content.talk || {}
  return {
    heading: talk.title,
    situation: talk.body,
    explanation: [talk.oneLine, talk.teacherNote?.tip],
    example: talk.oneLine,
    question: talk.question,
    prompts: talk.teacherNote?.openQuestions,
  }
}

function sourceFor(context) {
  const content = context.content || {}
  if (content.kind === 'summary') return summarySource(content)
  if (content.kind === 'deck') return deckSource(content)
  if (content.kind === 'talk') return talkSource(content)
  if (content.kind === 'question') return {
    heading: content.question?.stem || content.question?.question,
    situation: content.question?.context || content.question?.passage || content.question?.audioText,
    explanation: content.question?.teachingNote || content.question?.explanation || content.question?.modelAnswer,
    question: content.question,
    checklist: content.question?.thinkingSteps,
  }
  return { heading: context.title }
}

export function buildTeacherContextMaterials(context = {}, guide = {}, { publicView = false } = {}) {
  const source = sourceFor(context)
  const question = source.question || {}
  const provenance = learningCaseProvenance(
    source.courseKind || context.courseKind || courseKindForSubject(context.subject || guide.subject),
    question,
  )
  const choices = choiceRows(question)
  const correctIndexes = answerIndexes(question, choices)
  const correct = choices.filter(choice => correctIndexes.includes(choice.index))
  const wrong = choices.filter(choice => !correctIndexes.includes(choice.index))
  const mayShowAnswer = !publicView || Boolean(context.revealed)
  const privateExplanation = items(source.explanation).filter(line => !/^\d+번(?:입니다|이다)/.test(line))
  const distractorHints = unique(items(question.distractorTypes)).map(value => plain(value))
  const publicLead = unique([
    ...items(question.thinkingSteps),
    question.keyTerms?.length ? `핵심 용어: ${question.keyTerms.map(plain).filter(Boolean).join(' · ')}` : [],
    source.situation ? `확인할 조건: ${clip(source.situation, 180)}` : [],
    distractorHints.length ? `선지 확인 항목: ${distractorHints.join(' · ')}` : [],
  ], 4).map(value => plain(typeof value === 'string' ? value : value.text))
  const explanation = mayShowAnswer || !choices.length
    ? privateExplanation
    : publicLead
  const distractors = distractorHints
  const mistake = source.mistake || {}
  const mistakeDetails = unique([
    ...items(mistake.trap),
    ...items(mistake.whyWrong),
    ...items(mistake.point),
    ...distractors,
  ])

  const good = mayShowAnswer
    ? correct.map(choice => ({
        title: `타당한 사례 ${choice.label}`,
        text: choice.text,
        detail: choice.detail || explanation[0] || '현재 화면의 조건과 판단 기준을 모두 충족함.',
      }))
    : []
  if (!good.length && explanation.length) {
    good.push({ title: '좋은 설명', text: explanation[0], detail: explanation[1] || '' })
  }
  if (!good.length) {
    good.push(...(guide.good || []).slice(0, 4).map(([title, text, detail]) => ({ title, text, detail })))
  }

  const bad = mayShowAnswer
    ? wrong.slice(0, 3).map((choice, index) => ({
        title: `헷갈리기 쉬운 사례 ${choice.label}`,
        text: choice.text,
        detail: choiceReason(question, choice, distractors[index] || mistakeDetails[index]) || '현재 화면의 조건 중 하나를 놓친 선택임.',
      }))
    : []
  if (mistake.wrongChoice) {
    bad.unshift({
      title: `실제 오답 ${mistake.wrongChoice.label || ''}`.trim(),
      text: plain(mistake.wrongChoice.text),
      detail: plain(mistake.trap || mistake.whyWrong),
    })
  }
  if (!bad.length) {
    bad.push(...(guide.improve || []).slice(0, 4).map(([title, text, detail]) => ({ title, text, detail })))
  }

  const examples = unique([
    ...items(source.examples).map(text => ({ title: '이 단원의 적용 장면', text })),
    source.example ? { title: '추가 적용 예시', text: clip(source.example, 260) } : [],
    source.situation ? { title: '현재 상황의 핵심', text: clip(source.situation, 300) } : [],
    question.stem ? { title: '연결 문항', text: clip(question.stem, 220) } : [],
    !source.example && !source.situation && !question.stem && explanation[0]
      ? { title: '현재 카드 핵심', text: explanation[0] }
      : [],
    !source.example && !source.situation && !question.stem && guide.activity
      ? { title: '현재 단계 적용 활동', text: guide.activity }
      : [],
  ], 4)
  const resolvedExamples = examples.filter(example => plain(example.text).length >= 3)
  if (!resolvedExamples.length) {
    resolvedExamples.push({
      title: '현재 단계 적용 활동',
      text: plain(guide.activity || `${source.heading || context.title || '현재 내용'}의 핵심 기준을 다른 상황에 적용해 설명함.`),
    })
  }

  const heading = plain(source.heading || context.title || context.lessonLabel || guide.focus)
  const quotedSituation = quoteText(source.situation)
  const prompts = unique([
    ...(source.prompts || []).map(text => ({ text: plain(text) })),
    quotedSituation ? { text: `“${quotedSituation}”에서 판단 근거가 되는 정보는 무엇인가요?` } : [],
    choices.length ? { text: '가장 타당해 보이는 선택지와 탈락시킬 선택지를 한 개씩 근거와 함께 말해 볼까요?' } : [],
    mistakeDetails.length ? { text: `“${mistakeDetails[0]}” 실수를 막으려면 무엇부터 확인해야 할까요?` } : [],
    ...(!source.prompts?.length ? (guide.prompts || []).map(text => ({ text })) : []),
    { text: `${heading || '현재 내용'} 내용을 다른 직무 상황에 적용하면 어떤 행동이 달라지나요?` },
  ], 5).map(item => plain(item.text))

  const checklist = unique([
    ...items(source.checklist),
    ...items(question.thinkingSteps),
    ...mistakeDetails.slice(0, 3),
    ...(!source.checklist ? items(guide.checklist) : []),
  ], 6).map(item => plain(typeof item === 'string' ? item : item.text))

  const resolvedExplanations = explanation.length ? explanation : items(guide.explain)
  const resolvedMistakes = mistakeDetails.length
    ? mistakeDetails
    : (guide.improve || []).map(item => plain(item[1] || item[0])).filter(Boolean)

  return {
    heading,
    situation: plain(source.situation),
    explanations: resolvedExplanations.length ? resolvedExplanations : [clip(source.situation || heading, 180)].filter(Boolean),
    examples: resolvedExamples,
    good,
    bad,
    mistakes: resolvedMistakes,
    prompts,
    checklist: checklist.length ? checklist : [`${heading || '현재 내용'}의 핵심 조건을 화면에서 직접 짚음`],
    answerSummary: mayShowAnswer && correct.length
      ? correct.map(choice => `${choice.label}. ${choice.text}`).join(' / ')
      : '',
    provenance,
  }
}
