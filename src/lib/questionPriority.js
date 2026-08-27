const PRIORITY_ORDER = ['latest', 'frequent', 'past', 'important']

export const QUESTION_PRIORITY = {
  latest: {
    key: 'latest',
    label: '최신',
    description: '최근 개정되거나 새롭게 중요성이 커진 학습 주제',
    color: '#075985',
    background: '#E0F2FE',
    border: '#7DD3FC',
  },
  frequent: {
    key: 'frequent',
    label: '빈출',
    description: '복수의 공식 시행 범위나 채용공고에서 반복 확인된 주제',
    color: '#9A3412',
    background: '#FFF7ED',
    border: '#FDBA74',
  },
  past: {
    key: 'past',
    label: '기출',
    description: '실제 시행된 평가의 공식 출제 범위에서 확인된 주제',
    color: '#166534',
    background: '#F0FDF4',
    border: '#86EFAC',
  },
  important: {
    key: 'important',
    label: '중요',
    description: '공식 평가틀과 직무 수행에서 반드시 확인해야 하는 핵심 주제',
    color: '#4338CA',
    background: '#EEF2FF',
    border: '#A5B4FC',
  },
}

const SOURCES = {
  teenup: {
    label: '교육부·대한상공회의소 직업공통능력 인증 개요·평가영역',
    url: 'https://www.teenup.or.kr/intro/intro-01-00.do',
    year: '2026',
  },
  ncs26: {
    label: '한국산업인력공단 NCS 직업기초능력 26v1',
    url: 'https://www.ncs.go.kr/unity/th03/TH0308.do',
    year: '2026',
  },
  alio2026a: {
    label: 'ALIO 2026 채용 직업기초능력검사 범위',
    url: 'https://job.alio.go.kr/recruitview.do?idx=301060',
    year: '2026',
  },
  alio2026b: {
    label: 'ALIO 2026 정규직 채용 NCS 평가 범위',
    url: 'https://job.alio.go.kr/recruitview.do?idx=294492',
    year: '2026',
  },
  alio2024: {
    label: 'ALIO 2024 직원 채용 NCS 평가 범위',
    url: 'https://job.alio.go.kr/recruitview.do?idx=276840',
    year: '2024',
  },
  alioDigital2026: {
    label: 'ALIO 2026 채용 디지털능력·대인관계능력 평가 범위',
    url: 'https://job.alio.go.kr/recruitview.do?idx=303212',
    year: '2026',
  },
  alioEthics2025: {
    label: 'ALIO 2025 채용 직업윤리 포함 필기 범위',
    url: 'https://www.alio.go.kr/download/download.json?fileNo=2985401',
    year: '2025',
  },
  alioInterview2021: {
    label: 'ALIO 상황·경험면접 공식 시행 범위',
    url: 'https://www.alio.go.kr/download/download.json?fileNo=2630896',
    year: '2021',
  },
}

const NCS_FREQUENT = new Set(['의사소통능력', '수리능력', '문제해결능력'])
const NCS_LATEST = new Set(['자기관리능력', '디지털능력'])
const NCS_PAST = new Set(['대인관계능력', '직업윤리'])
const TEENUP_AREAS = new Set(['의사소통 국어', '의사소통 영어', '수리활용', '문제해결', '직무적응'])

function plain(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveSubject(subjectId) {
  const map = {
    'education-certification': 'job-common',
    ncs: 'ncs-basic',
    recruitment: 'recruit-written',
    'cover-letter': 'cover-letter',
    personality: 'personality',
    interview: 'interview',
  }
  return map[subjectId] || subjectId || ''
}

function sourceList(...keys) {
  return keys.map(key => SOURCES[key]).filter(Boolean)
}

function result(key, reason, sources, basis = 'official-scope') {
  return {
    ...QUESTION_PRIORITY[key],
    reason,
    sources,
    basis,
  }
}

function explicitPriority(question) {
  const entries = Array.isArray(question?.priorityEvidence)
    ? question.priorityEvidence
    : question?.priorityEvidence ? [question.priorityEvidence] : []
  for (const key of PRIORITY_ORDER) {
    const evidence = entries.find(item => item?.tag === key && item?.verified === true)
    if (!evidence) continue
    const sources = (evidence.sources || []).filter(item => item?.url && item?.label)
    if (!sources.length) continue
    return result(key, plain(evidence.reason) || QUESTION_PRIORITY[key].description, sources, 'item-evidence')
  }
  return null
}

function questionText(question) {
  return plain([
    question?.officialArea,
    question?.area,
    question?.ncsAbility,
    question?.subAbility,
    question?.lessonTitle,
    question?.lessonId,
    question?.category,
    question?.dimension,
    question?.stem,
    question?.question,
  ].filter(Boolean).join(' '))
}

export function questionPriority(question = {}, subjectId = '') {
  const explicit = explicitPriority(question)
  if (explicit) return explicit

  const subject = resolveSubject(subjectId)
  const text = questionText(question)
  const area = plain(question.area || question.officialArea)

  if (subject === 'job-common' && TEENUP_AREAS.has(plain(question.officialArea || question.area))) {
    return result('past', '직업공통능력 인증에서 실제 시행되는 공식 평가영역에 속한 주제입니다.', sourceList('teenup'))
  }

  if (subject === 'ncs-basic') {
    if (area === '디지털능력' || /인공지능|AI 활용|디지털책임/.test(text)) {
      return result('latest', 'NCS 26v1의 디지털·AI 체계이며 최근 채용 평가범위에서도 확인되는 역량입니다.', sourceList('ncs26', 'alioDigital2026'))
    }
    if (NCS_LATEST.has(area) || /적응학습|산업안전보건/.test(text)) {
      return result('latest', 'NCS 26v1에서 개정·신설되어 우선 확인해야 하는 역량입니다.', sourceList('ncs26'))
    }
    if (NCS_FREQUENT.has(area)) {
      return result('frequent', '최근 여러 공공기관 채용의 공식 필기 범위에서 반복 확인된 영역입니다.', sourceList('alio2026a', 'alio2026b', 'alio2024'))
    }
    if (NCS_PAST.has(area)) {
      const sources = area === '직업윤리' ? sourceList('alioEthics2025') : sourceList('alioDigital2026', 'alio2024')
      return result('past', '공공기관의 실제 채용 전형에서 평가 범위로 확인된 영역입니다.', sources)
    }
    if (area) return result('important', '현행 NCS 직업기초능력 체계의 핵심 학습영역입니다.', sourceList('ncs26'), 'official-framework')
  }

  if (subject === 'recruit-written') {
    if (/인공지능|디지털|정보보안|데이터/.test(text)) {
      return result('latest', '최근 채용에서 디지털·데이터 활용의 중요성이 커진 주제입니다.', sourceList('ncs26', 'alioDigital2026'))
    }
    if (/의사소통|수리|문제해결|자원관리|조직이해|정보능력/.test(text)) {
      return result('frequent', '복수의 공공기관 채용공고에서 반복 확인되는 필기 평가영역입니다.', sourceList('alio2026b', 'alio2024', 'alio2026a'))
    }
    return result('important', '지원 기관의 필기 범위에 따라 우선 확인해야 하는 채용 심화 주제입니다.', sourceList('ncs26'), 'course-priority')
  }

  if (subject === 'interview') {
    if (/상황|경험|행동|후속 질문|꼬리 질문/.test(text)) {
      return result('frequent', '공공기관 채용에서 상황면접과 경험면접이 반복 시행되는 평가 방식입니다.', sourceList('alioInterview2021', 'alio2026b', 'alioDigital2026'))
    }
    return result('important', '직무 적합성과 근거 있는 답변을 확인하는 면접 핵심 주제입니다.', sourceList('alioDigital2026'), 'course-priority')
  }

  if (subject === 'cover-letter') {
    if (/지원동기|경험|업무수행|입사 후|직무/.test(text)) {
      return result('frequent', '공식 채용공고의 서류·면접 평가에서 반복 확인되는 작성 주제입니다.', sourceList('alioInterview2021', 'alio2026a'))
    }
    return result('important', '지원 문항의 요구와 본인 근거를 연결하는 핵심 작성 주제입니다.', sourceList('alio2026a'), 'course-priority')
  }

  if (subject === 'personality') {
    return result('important', '인성검사는 여러 실제 채용 전형에서 활용되며 일관된 자기이해가 중요합니다.', sourceList('alio2026a', 'alio2026b'), 'course-priority')
  }

  return null
}

export function questionPriorityWeight(question, subjectId) {
  const priority = questionPriority(question, subjectId)
  if (!priority) return 1
  return {
    latest: 1.45,
    frequent: 1.4,
    past: 1.3,
    important: 1.2,
  }[priority.key] || 1
}

export function questionPrioritySources() {
  return { ...SOURCES }
}
