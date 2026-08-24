function clean(value) {
  return String(value ?? '').replace(/^\s*["“]|["”]\s*$/g, '').trim()
}

const CATEGORY_GUIDE = {
  '오리엔테이션': '현재 채용공고와 직무기술서로 준비 범위를 정함',
  '면접절차': '전형 단계의 목적과 제출 자료·일정을 먼저 확인함',
  '평가기준': '질문의 의도에 맞는 실제 행동 근거를 제시함',
  '자기소개': '전공·강점·대표 근거·직무 기여를 짧게 연결함',
  '지원동기': '개인 계기·지원처 근거·직무 기여를 연결함',
  '경험답변': '자신의 행동과 확인 가능한 결과를 구체적으로 말함',
  '인성면접': '정직성·책임·협업을 실제 행동으로 증명함',
  '블라인드': '편견을 만들 수 있는 개인정보를 답변에서 제외함',
  '상황면접': '사실 확인·원칙·행동·보고·재발 방지 순서로 답함',
  'PT/발표': '주장·근거·대안·기대효과를 제한시간 안에 구조화함',
  '토론/그룹': '경청·요약·근거 제시·합의 형성 과정을 보여 줌',
  '직무면접': '직무기술서의 요구와 전공 실습 경험을 연결함',
  '직장태도': '안전·품질·시간·인수인계 원칙을 지킴',
  '모의면접': '녹화·피드백·재답변으로 행동을 수정함',
  '준비 루틴': '공고·지원처·직무·경험·말하기를 순서대로 점검함',
  '블라인드 안전': '서류와 답변에서 편견정보 노출을 사전에 제거함',
}

export function buildInterviewConceptChecks(lesson, quizQuestions = []) {
  if (!lesson) return []
  const questions = quizQuestions.filter(question => question.lessonId === lesson.id)
  const guide = CATEGORY_GUIDE[lesson.category] || '질문의 의도와 자신의 실제 행동 근거를 연결함'
  const templates = [
    [`${lesson.title} 준비 원칙으로 가장 알맞은 것은?`, [guide, '합격후기 문장을 그대로 외움', '다른 지원처 답변에서 이름만 바꿈', '근거 없이 장점만 반복함'], `${lesson.category}의 핵심은 ${guide}`],
    [`${lesson.title} 답변의 근거로 가장 강한 것은?`, ['자신이 한 행동과 확인 가능한 결과', '누구나 쓰는 성격 장점', '출처를 모르는 기업 칭찬', '팀의 성과를 모두 자신의 성과로 바꾼 설명'], '면접 답변은 본인이 실제로 한 행동과 확인 가능한 결과로 신뢰를 얻음.'],
    [`${lesson.title} 연습 중 공식 공고와 교재 내용이 다르면?`, ['현재 공식 공고를 우선해 답변을 고침', '교재 문장을 그대로 유지함', '과거 후기만 따름', '차이를 숨기고 단정함'], '전형과 요구역량은 바뀔 수 있어 실제 지원 시점의 공식 공고가 기준임.'],
    [`${lesson.title} 답변을 더 구체적으로 고치는 방법은?`, ['결론 뒤에 자신의 행동과 결과를 붙임', '수식어와 외래어를 늘림', '지원처 칭찬을 반복함', '경험 없이 포부만 길게 말함'], '결론과 실제 행동, 결과가 연결될 때 질문 의도에 맞는 근거가 됨.'],
    [`${lesson.title}에서 피해야 할 행동은?`, ['기억나지 않는 성과와 수치를 만들어 냄', '모르는 정보는 확인하겠다고 말함', '질문의 의도를 다시 확인함', '답변 후 사실관계를 점검함'], '면접과 자기소개서는 사실에 근거해야 하며 확인할 수 없는 경험을 만들면 안 됨.'],
  ]
  let index = 0
  while (questions.length < 5) {
    const [stem, choices, explanation] = templates[index % templates.length]
    if (!questions.some(question => question.stem === stem)) {
      questions.push({
        id: `IVS-${lesson.id}-${index + 1}`,
        lessonId: lesson.id,
        category: lesson.category,
        stem,
        choices,
        answer: 'A',
        explanation,
        questionMode: 'mcq',
        learningLane: 'study',
      })
    }
    index++
  }
  return questions
}

function sectionPracticeQuestions(lesson) {
  const questions = []
  let heading = ''
  let lastQuestion = null
  let pendingWeakAnswer = ''

  const add = (stem, extra = {}) => {
    const text = clean(stem)
    if (!text || questions.some(question => question.stem === text)) return null
    const question = {
      id: `${lesson.id}-section-${questions.length + 1}`,
      stem: text,
      context: heading,
      isInterview: true,
      format: extra.format || '면접 질문형',
      modelAnswer: extra.modelAnswer || '',
      weakAnswer: extra.weakAnswer || '',
      answerPoints: extra.answerPoints || [],
      explanation: extra.explanation || '',
    }
    questions.push(question)
    lastQuestion = question
    return question
  }

  for (const section of lesson.sections || []) {
    if (section.type === 'h3' || section.type === 'h4') {
      heading = section.text || ''
      continue
    }
    if (section.type === 'p') {
      const text = String(section.text || '').trim()
      const explicit = text.match(/^질문\s*[:：]\s*(.+)$/)
      if (explicit) add(explicit[1])
      else if ((/^Q\d+/i.test(heading) || /실전\s*예상/.test(heading)) && /^["“].+["”]$/.test(text)) add(text)
      else if (/^문제점\s*[:：]/.test(text) && lastQuestion) {
        lastQuestion.explanation = text.replace(/^문제점\s*[:：]\s*/, '')
        lastQuestion.weakAnswer = pendingWeakAnswer
      }
      continue
    }
    if (section.type === 'ol' && /질문/.test(heading)) {
      for (const item of section.items || []) add(item)
      continue
    }
    if (section.type === 'table') {
      const rows = section.rows || []
      const taskIndex = rows[0]?.findIndex(cell => /할 일|연습|과제/.test(String(cell))) ?? -1
      const resultIndex = rows[0]?.findIndex(cell => /결과물|결과/.test(String(cell))) ?? -1
      if (taskIndex >= 0) {
        for (const row of rows.slice(1)) {
          add(row[taskIndex], {
            format: '면접 수행 과제',
            answerPoints: resultIndex >= 0 && row[resultIndex] ? [`완성할 결과물: ${row[resultIndex]}`] : [],
          })
        }
      }
      continue
    }
    if (section.type === 'pre') {
      pendingWeakAnswer = clean(section.text)
      continue
    }
    if (section.type === 'good_answer' && lastQuestion) {
      lastQuestion.modelAnswer = clean(section.text)
      lastQuestion.weakAnswer = pendingWeakAnswer
      pendingWeakAnswer = ''
    }
  }
  return questions
}

export function buildInterviewLearningQuestions(lesson, quizQuestions = []) {
  if (!lesson) return quizQuestions
  const practices = (lesson.practiceQuestions || []).map((question, index) => ({
    ...question,
    id: question.id || `${lesson.id}-practice-${index + 1}`,
    stem: question.question,
    context: question.structHint,
    explanation: (question.answerPoints || []).join(' '),
    isInterview: true,
    format: '면접 질문형',
  }))
  const questions = [
    ...practices,
    ...sectionPracticeQuestions(lesson),
    ...quizQuestions.filter(question => question.lessonId === lesson.id),
  ]
  const fallbackTasks = [
    {
      stem: `${lesson.title} 원칙을 적용해 40초 답변 초안을 작성해 보세요.`,
      context: '핵심 원칙 적용',
      answerPoints: ['상황보다 자신의 행동을 구체적으로 말함', '결과 또는 배운 점으로 마무리함'],
    },
    {
      stem: '작성한 답변에서 추상적인 표현 한 곳을 찾아 실제 행동으로 고쳐 보세요.',
      context: '답변 고쳐쓰기',
      answerPoints: ['막연한 장점을 행동 근거로 바꿈', '개인정보나 블라인드 위반 요소를 제거함'],
    },
    {
      stem: '면접관의 추가 질문 한 개를 예상하고 20초 후속 답변을 준비해 보세요.',
      context: '꼬리질문 대비',
      answerPoints: ['앞선 답변과 사실관계를 일치시킴', '새로운 행동 근거를 덧붙임'],
    },
    {
      stem: `${lesson.title} 답변을 휴대전화로 녹음한 뒤, 군더더기 표현 한 곳을 줄여 다시 말해 보세요.`,
      context: '말하기 다듬기',
      answerPoints: ['첫 문장에서 결론을 밝힘', '40~60초 안에 핵심 근거를 전달함'],
    },
    {
      stem: '같은 경험을 지원 직무의 요구역량과 연결해 마지막 한 문장을 다시 작성해 보세요.',
      context: '직무 연결',
      answerPoints: ['지원 직무를 구체적으로 밝힘', '경험에서 배운 점을 입사 후 행동으로 연결함'],
    },
  ]
  let interviewCount = questions.filter(question => question.isInterview).length
  for (const task of fallbackTasks) {
    if (interviewCount >= 5) break
    if (questions.some(question => question.stem === task.stem)) continue
    questions.push({
      ...task,
      id: `${lesson.id}-guided-${questions.length + 1}`,
      isInterview: true,
      format: '면접 수행 과제',
      modelAnswer: '',
      explanation: task.answerPoints.join(' '),
    })
    interviewCount++
  }
  return questions
}
