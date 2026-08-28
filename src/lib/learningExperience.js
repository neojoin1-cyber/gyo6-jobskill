import { isEnglishLearningQuestion } from './englishLearningSupport.js'

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

function engagementProfile({ courseKind, point, contextKind, isListening, hasVisual, isWriting, isInterview, isReflection }) {
  const sample = typeof point.sampleQuestion === 'object' ? point.sampleQuestion : {}
  const source = sample.sourceQuestion || {}
  const text = plain(`${point.topic ?? ''} ${point.learn ?? ''} ${point.situation ?? ''} ${sample.stem ?? ''} ${source.area ?? ''} ${source.lessonTitle ?? ''}`).toLowerCase()
  if (isListening) return 'listening'
  if (isWriting) return 'writing'
  if (isInterview) return 'interview'
  if (isReflection) return 'reflection'
  if (contextKind === 'misread') return 'misread'
  if (contextKind === 'mistake') return 'mistake'
  if (isEnglishLearningQuestion(source.id ? source : sample)) return 'english'
  if (/(수리|계산|비율|단위|수량|시간|통계|예산|금액|확률|속도)/.test(text)) return 'math'
  if (/(문서|독해|이메일|안내|공지|보고|회의록|요지|접속어|어휘|영어|지시어)/.test(text)) return 'document'
  if (hasVisual || /(표|그래프|도표|차트|자료 해석)/.test(text)) return 'visual'
  if (/(안전|품질|협업|갈등|고객|윤리|절차|우선순위|문제해결|자원|업무)/.test(text)) return 'workplace'
  if (courseKind === 'ncs' || courseKind === 'recruitment') return 'workplace'
  return 'general'
}

const DEEPENING = {
  listening: {
    label: '다른 말을 들었다면?', materialLabel: '다시 확인할 듣기 자료',
    material: '화자 순서 · 빈칸 앞뒤 발화 · 상대가 기대하는 응답 기능',
    options: [
      ['응답 유지', '같은 응답이 가능한 빈칸 앞뒤 표현을 짚어 보세요.', '응답 기능이 유지되는 근거 찾기', '빈칸 앞뒤에서 요청·질문·감정 표현을 각각 확인합니다.', '“___라는 말을 들었으므로 ___라고 응답하겠다.”'],
      ['응답 바꾸기', '응답을 바꾸게 만든 새 발화를 정확히 말해 보세요.', '달라진 발화에 맞춰 응답 고치기', '처음 들은 표현과 달라진 표현의 의도를 비교합니다.', '“처음에는 ___로 들었지만, ___이므로 응답을 ___로 바꾸겠다.”'],
      ['다시 들을 부분', '전체가 아니라 결정에 필요한 발화 위치를 골라 보세요.', '다시 들을 한 구간 정하기', '화자와 빈칸의 앞·뒤 중 어느 지점이 필요한지 고릅니다.', '“___의 ___번째 말을 다시 들으면 ___을 판단할 수 있다.”'],
    ],
  },
  english: {
    label: '원문의 조건이 달라지면?', materialLabel: '다시 대조할 영어 근거',
    material: '발문이 묻는 것 · 핵심 영어 표현 · 대상·순서·조건 · 선택지의 바뀐 뜻',
    options: [
      ['근거 유지', '조건이 달라져도 그대로인 원문 표현을 짚어 보세요.', '같은 답을 유지할 영어 근거 찾기', '발문과 직접 연결되는 원문 문장과 변하지 않은 조건을 표시합니다.', '“원문의 ___가 그대로이므로 선택지 ___의 판단을 유지한다.”'],
      ['판단 수정', '바뀐 영어 표현이 대상·순서·조건을 어떻게 바꾸는지 말해 보세요.', '달라진 원문에 맞춰 판단 고치기', '처음 표현과 바뀐 표현을 나란히 읽고 뜻이 달라진 부분을 연결합니다.', '“___가 ___로 바뀌어 대상·순서·조건이 ___이므로 답을 ___로 수정한다.”'],
      ['문맥 더 확인', '한 문장만으로 결정하기 어렵다면 앞뒤에서 확인할 표현을 고르세요.', '판단에 필요한 영어 문맥 찾기', '지시어·순서어·부정어·조건 표현 중 답을 확정할 단서를 찾습니다.', '“앞뒤의 ___ 표현을 확인하면 ___의 뜻과 답을 확정할 수 있다.”'],
    ],
  },
  writing: {
    label: '지원 조건이 달라지면?', materialLabel: '다시 대조할 작성 자료',
    material: '지원 문항의 필수 요구 · 지원 직무 키워드 · 내 경험의 행동과 결과',
    options: [
      ['근거 유지', '새 지원 조건에도 그대로 쓸 수 있는 경험 근거를 확인하세요.', '같은 경험을 유지할 이유 찾기', '문항 요구와 경험의 행동·결과가 계속 연결되는지 대조합니다.', '“___ 경험은 ___ 직무에서도 ___을 보여 주므로 유지한다.”'],
      ['근거 교체', '새 직무와 더 직접 연결되는 경험을 하나 고르세요.', '지원 조건에 맞는 경험으로 교체하기', '기존 경험에서 빠진 직무 행동을 찾고 다른 실제 경험과 비교합니다.', '“기존 ___보다 ___ 경험이 ___ 직무의 요구를 더 직접 보여 준다.”'],
      ['지원처 확인', '결정 전에 확인할 지원처 정보 한 가지를 질문으로 만드세요.', '지원처 정보의 빈칸 확인하기', '채용공고·직무기술서·기관 사업 중 필요한 자료를 고릅니다.', '“지원처의 ___을 확인한 뒤 ___ 경험을 사용할지 결정하겠다.”'],
    ],
  },
  interview: {
    label: '꼬리 질문이 나오면?', materialLabel: '다시 확인할 답변 근거',
    material: '질문의 의도 · 본인이 직접 한 행동 · 수치나 관찰로 확인되는 결과',
    options: [
      ['답변 유지', '꼬리 질문에도 유지할 핵심 행동 근거를 짚어 보세요.', '핵심 답변을 흔들림 없이 유지하기', '내 역할과 결과가 질문 의도에 직접 답하는지 확인합니다.', '“제가 직접 한 일은 ___이고, 그 결과 ___을 확인했습니다.”'],
      ['답변 보완', '면접관이 다시 물을 만한 빠진 행동이나 결과를 보태세요.', '빈 근거를 한 문장으로 보완하기', '추상 표현을 걷어내고 행동·수치·결과 중 빠진 항목을 채웁니다.', '“앞 답변에 ___이 빠졌습니다. 저는 실제로 ___했고 결과는 ___입니다.”'],
      ['경험 재확인', '내 기억만으로 단정하기 어려운 사실을 구분하세요.', '말해도 되는 사실의 범위 정하기', '본인이 확인한 사실과 팀 전체 성과를 나누어 봅니다.', '“제가 확인한 범위는 ___이며, ___은 추가 확인이 필요합니다.”'],
    ],
  },
  reflection: {
    label: '사람·장소가 달라지면?', materialLabel: '다시 살펴볼 행동 기준',
    material: '평소 행동 · 안전·정직·책임 원칙 · 상황에 따른 예외 조건',
    options: [
      ['기준 유지', '누구와 함께 있어도 유지할 행동 원칙을 말해 보세요.', '일관된 행동 기준 확인하기', '실제 평소 행동과 선택한 응답이 같은 방향인지 확인합니다.', '“나는 보통 ___할 때도 ___ 원칙을 지킨다.”'],
      ['행동 조정', '원칙은 지키면서 상황에 맞게 바꿀 행동을 고르세요.', '원칙과 방법을 구분해 조정하기', '바꾸지 않을 원칙과 바꿀 행동 방법을 한 가지씩 정합니다.', '“___ 원칙은 유지하되, 이 상황에서는 ___ 방식으로 행동하겠다.”'],
      ['상황 더 확인', '응답 전에 알아야 할 사람·규정·위험 정보를 고르세요.', '판단 전 확인 질문 만들기', '상대의 역할과 적용 규정, 안전 위험 중 빠진 정보를 찾습니다.', '“___을 확인해야 평소 기준을 이 상황에 적용할 수 있다.”'],
    ],
  },
  math: {
    label: '수치·단위가 달라지면?', materialLabel: '다시 계산할 자료',
    material: '구하려는 값 · 주어진 수치와 단위 · 적용할 식 · 결과의 크기',
    options: [
      ['계산 유지', '값이 달라도 같은 식을 쓸 수 있는 이유를 확인하세요.', '같은 계산식의 적용 조건 찾기', '문제가 묻는 값과 단위가 그대로인지 먼저 대조합니다.', '“구하려는 값이 ___이고 단위가 ___이므로 식 ___을 유지한다.”'],
      ['다시 계산', '바뀐 수치나 단위를 식의 정확한 자리에 넣으세요.', '변경 조건으로 다시 계산하기', '달라진 값 하나만 표시하고 나머지 조건은 그대로 둡니다.', '“___이 ___로 바뀌었으므로 ___을 다시 계산하면 ___이다.”'],
      ['조건 더 확인', '계산 전에 빠진 수치·단위·기준 시점을 찾으세요.', '계산 불가능한 빈칸 찾기', '값을 구하는 데 꼭 필요한 입력값을 하나씩 점검합니다.', '“___ 값과 ___ 단위를 확인해야 식을 완성할 수 있다.”'],
    ],
  },
  document: {
    label: '기한·담당자가 달라지면?', materialLabel: '다시 읽을 문서 근거',
    material: '원문 표현 · 담당자 · 기한 · 요청 행동 · 예외 조건',
    options: [
      ['판단 유지', '바뀐 조건에도 유지되는 원문 근거를 표시하세요.', '문서에서 변하지 않은 요구 찾기', '담당자·기한·행동 중 그대로인 항목을 구분합니다.', '“문서의 ___가 그대로이므로 ___ 행동을 유지한다.”'],
      ['행동 수정', '새 기한이나 담당자에 맞춰 첫 행동을 고치세요.', '달라진 문서 조건으로 행동 바꾸기', '바뀐 표현과 그에 따라 달라지는 행동을 연결합니다.', '“___가 ___로 바뀌었으므로 먼저 ___해야 한다.”'],
      ['문서 더 확인', '원문에서 확인해야 할 문장이나 표 항목을 고르세요.', '문서 속 빈 정보 찾기', '제목·본문·표·주의사항 중 근거가 있을 위치를 정합니다.', '“문서의 ___ 항목을 확인하면 ___ 여부를 판단할 수 있다.”'],
    ],
  },
  visual: {
    label: '표의 기준이 달라지면?', materialLabel: '다시 볼 시각 자료',
    material: '표·그래프의 제목 · 기준 열과 축 · 단위 · 비교할 핵심 수치',
    options: [
      ['해석 유지', '축과 단위가 같아 해석을 유지할 수 있는지 확인하세요.', '같은 비교 기준 유지하기', '제목·축·단위가 처음 자료와 같은지 대조합니다.', '“___ 기준과 ___ 단위가 같으므로 ___ 해석을 유지한다.”'],
      ['해석 수정', '달라진 축·단위·수치가 결론을 어떻게 바꾸는지 말하세요.', '바뀐 자료로 결론 고치기', '변경된 시각 요소 하나와 새 결론을 연결합니다.', '“___이 ___로 바뀌어 비교 결과는 ___가 된다.”'],
      ['자료 더 확인', '표나 그래프에서 빠진 기준값을 찾아보세요.', '해석 전에 필요한 자료 찾기', '범례·단위·기간·모집단 중 빠진 항목을 확인합니다.', '“___ 정보가 있어야 ___을 정확히 비교할 수 있다.”'],
    ],
  },
  workplace: {
    label: '업무 제약이 달라지면?', materialLabel: '다시 대조할 업무 자료',
    material: '담당 역할 · 우선순위 · 안전·규정 · 시간·인력 제약 · 기대 결과',
    options: [
      ['판단 유지', '새 제약에도 지켜야 할 업무 원칙을 짚어 보세요.', '변하지 않는 업무 기준 찾기', '안전·규정·고객 영향 중 반드시 지킬 기준을 확인합니다.', '“___ 원칙은 바뀌지 않으므로 먼저 ___하겠다.”'],
      ['순서 수정', '새 제약 때문에 달라질 첫 행동과 다음 행동을 정하세요.', '업무 순서를 다시 배치하기', '긴급도와 중요도, 선행 조건을 다시 비교합니다.', '“___ 제약이 생겨 ___을 먼저 하고 그다음 ___하겠다.”'],
      ['정보 더 확인', '담당자·규정·자원 중 빠진 정보를 질문으로 만드세요.', '결정 전 업무 정보 확인하기', '권한과 가용 자원, 마감 중 무엇이 불명확한지 찾습니다.', '“___을 확인해야 ___ 행동을 결정할 수 있다.”'],
    ],
  },
  misread: {
    label: '원문을 바로 읽으면?', materialLabel: '다시 비교할 표현',
    material: '원문 문장 · 잘못 읽은 뜻 · 행동 방향을 바꾸는 핵심 단어',
    options: [
      ['해석 유지', '원문과 오해한 뜻이 실제로 같은지 근거를 대세요.', '해석을 유지할 수 있는 표현 찾기', '두 문장의 행동 방향과 조건을 나란히 비교합니다.', '“원문의 ___는 ___ 뜻이므로 기존 해석을 유지한다.”'],
      ['해석 수정', '오해를 바로잡는 원문 단어를 정확히 짚으세요.', '원문에 맞춰 행동 방향 고치기', '부정·조건·대상 표현 중 놓친 부분을 찾습니다.', '“___를 ___로 잘못 읽었으므로 행동을 ___로 수정한다.”'],
      ['원문 더 확인', '앞뒤 문장 중 뜻을 확정할 근거 위치를 정하세요.', '문맥 확인 범위 정하기', '해당 문장만 볼지 앞뒤 문장까지 볼지 결정합니다.', '“___ 문장까지 확인하면 ___의 뜻을 확정할 수 있다.”'],
    ],
  },
  mistake: {
    label: '실수 원인이 달라지면?', materialLabel: '다시 볼 오류 근거',
    material: '실제 행동 · 놓친 절차 · 실수가 생긴 원인 · 다시 확인할 결과',
    options: [
      ['수정 유지', '원인이 달라도 같은 수정이 필요한 이유를 확인하세요.', '같은 수정이 필요한 기준 찾기', '실수 결과와 필수 절차가 그대로인지 대조합니다.', '“원인은 달라도 ___ 절차가 필요하므로 ___로 고친다.”'],
      ['수정 변경', '개인 실수와 절차 문제에 맞는 해결을 구분하세요.', '원인에 맞춰 수정 방법 바꾸기', '교육·확인·시스템 개선 중 원인에 맞는 조치를 고릅니다.', '“원인이 ___이므로 개인 행동 대신 ___을 수정해야 한다.”'],
      ['원인 더 확인', '재발을 막기 위해 확인할 기록이나 절차를 고르세요.', '실수 원인을 검증할 자료 찾기', '작업 기록·지시·점검표 중 필요한 자료를 정합니다.', '“___ 기록을 확인하면 실수 원인이 ___인지 알 수 있다.”'],
    ],
  },
  general: {
    label: '핵심 조건이 달라지면?', materialLabel: '다시 확인할 판단 자료',
    material: '질문의 요구 · 상황 속 결정 조건 · 선택에 따른 결과',
    options: [
      ['판단 유지', '새 조건에도 유지되는 근거를 한 가지 짚어 보세요.', '판단을 유지할 근거 찾기', '질문의 요구와 변하지 않은 조건을 다시 연결합니다.', '“___라는 근거가 유지되므로 ___라고 판단한다.”'],
      ['판단 수정', '처음 판단을 바꾸게 만든 조건을 정확히 말하세요.', '달라진 조건으로 판단 고치기', '처음 조건과 새 조건을 나란히 비교합니다.', '“처음에는 ___였지만 ___로 바뀌어 판단을 ___로 수정한다.”'],
      ['정보 더 필요', '결정에 꼭 필요한 빈 정보를 질문으로 만드세요.', '판단 전에 필요한 정보 찾기', '현재 자료에 없는 조건과 확인 방법을 정합니다.', '“___을 확인할 수 있나요? 그 정보가 ___라면 ___라고 판단하겠다.”'],
    ],
  },
}

function buildDeepening(profile, subject) {
  const config = DEEPENING[profile] || DEEPENING.general
  return {
    kind: profile,
    label: config.label,
    materialLabel: config.materialLabel,
    material: config.material,
    options: config.options.map(([label, feedback, title, action, frame]) => ({
      label,
      feedback,
      followUp: {
        title,
        actions: [`${subject} 학습 장면에서 결정 근거를 한 곳 표시합니다.`, action],
        frame,
      },
    })),
  }
}

function profileTwist(profile, quoted) {
  const prompts = {
    listening: `빈칸 앞뒤에서 들린 요청이나 질문이 달라진다면 질문 ${quoted}의 응답도 바뀌어야 할까요?`,
    english: `원문의 대상·순서·조건을 나타내는 영어 표현 하나가 바뀐다면 질문 ${quoted}의 판단도 달라질까요?`,
    writing: `지원 직무나 문항의 필수 요구가 달라진다면 주제 ${quoted}에 사용할 경험 근거도 바뀌어야 할까요?`,
    interview: `면접관이 질문 ${quoted}에 대해 본인 행동이나 결과를 다시 묻는다면 무엇을 보완해야 할까요?`,
    reflection: `함께 있는 사람이나 장소가 달라져도 주제 ${quoted}의 행동 원칙을 같은 방식으로 적용할까요?`,
    math: `문제의 핵심 수치나 단위 하나가 바뀐다면 질문 ${quoted}의 계산식과 결과 중 무엇이 달라질까요?`,
    document: `문서의 담당자·기한·요청 행동 중 하나가 바뀐다면 질문 ${quoted}의 첫 행동도 달라질까요?`,
    visual: `표·그래프의 축·단위·기준값 중 하나가 바뀐다면 질문 ${quoted}의 해석도 달라질까요?`,
    workplace: `업무의 우선순위·안전 규정·가용 자원 중 하나가 바뀐다면 질문 ${quoted}의 행동 순서도 달라질까요?`,
    misread: `오해한 표현을 원문 뜻대로 바로잡으면 질문 ${quoted}의 행동 방향도 바뀌어야 할까요?`,
    mistake: `실수 원인이 개인 행동이 아니라 절차나 시스템이라면 질문 ${quoted}의 수정 방법도 달라질까요?`,
    general: `상황의 결정 조건 하나가 바뀐다면 질문 ${quoted}의 판단도 달라져야 할까요?`,
  }
  return prompts[profile] || prompts.general
}

/**
 * 학습 장면별 판단 문구를 만든다. 콘텐츠에 직접 작성한 문구가 있으면 항상 우선한다.
 * 과목 공통 문구만 반복하지 않고 현재 주제·자료 유형·응답 방식을 문장에 반영한다.
 */
export function buildEngagementCopy({ courseKind, point = {}, contextKind = '', isListening = false } = {}) {
  const custom = point.engagementCopy || point.engagement || {}

  const sample = typeof point.sampleQuestion === 'object' ? point.sampleQuestion : {}
  const source = sample.sourceQuestion || {}
  const subject = engagementSubject(point)
  const quoted = `“${subject}”`
  const hasVisual = Boolean(source.visual || sample.visual || point.visual)
  const isWriting = sample.type === 'writing-practice' || courseKind === 'cover-letter'
  const isInterview = Boolean(sample.isInterview) || courseKind === 'interview'
  const isReflection = sample.type === 'reflection' || courseKind === 'personality'
  const profile = engagementProfile({ courseKind, point, contextKind, isListening, hasVisual, isWriting, isInterview, isReflection })

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
    twist: custom.twist || profileTwist(profile, quoted) || generated.twist,
    deepen: custom.deepen || point.deepening || buildDeepening(profile, subject),
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

function englishQuestionKind(question = {}) {
  if (!isEnglishLearningQuestion(question)) return ''
  const sourceChoices = (question.choices || []).map(choice => typeof choice === 'object'
    ? (choice.text ?? choice.label ?? choice.value ?? '')
    : choice).join(' ')
  const source = `${question.context ?? ''} ${question.stem ?? question.question ?? ''} ${sourceChoices}`
  const id = `${question.id ?? ''} ${question.lessonId ?? ''}`
  if (question.audioText || /dialog|listen/i.test(id)) return 'listening'
  if (/_{2,}|빈칸|blank/i.test(source) || /vocab/i.test(id)) return 'blank'
  if (/dialog|대화|응답|response/i.test(`${id} ${source}`)) return 'dialogue'
  return 'reading'
}

function strategyLabelFor(value, question = {}) {
  const englishKind = englishQuestionKind(question)
  if (englishKind === 'listening') return '영어 듣고 푸는 순서'
  if (englishKind === 'blank') return '영어 빈칸 푸는 순서'
  if (englishKind === 'dialogue') return '영어 대화 푸는 순서'
  if (englishKind === 'reading') return '영어 지문 읽는 순서'
  const text = plain(value).toLowerCase()
  if (question.visual || /(그래프|도표|차트|자료 해석)/.test(text)) return '표·그래프 읽는 순서'
  if (/(수리|계산|비율|단위|통계|금융|예산)/.test(text)) return '계산하는 순서'
  if (/(면접|자기소개|지원동기|star|prep|블라인드)/.test(text)) return '답변 구성 순서'
  if (/(인성|윤리|태도|성찰|책임|정직|가치관)/.test(text)) return '응답 기준 확인 순서'
  if (/(문서|독해|이메일|안내|공지|회의록|요지|지시어)/.test(text)) return '업무 문서 읽는 순서'
  return '판단하는 순서'
}

function strategyFor(value, question = {}) {
  const englishKind = englishQuestionKind(question)
  if (englishKind === 'listening') {
    return ['빈칸 앞 질문·요청과 뒤 응답을 먼저 듣기', '장소·관계·업무 목적을 나타내는 표현 메모', '보기를 넣어 대화 흐름과 말투가 자연스러운지 확인']
  }
  if (englishKind === 'blank') {
    return ['빈칸 앞뒤에서 필요한 품사와 문장 역할 확인', '업무 상황에 맞는 핵심 단어·표현 뜻 비교', '보기를 넣어 문법과 전체 의미를 함께 확인']
  }
  if (englishKind === 'dialogue') {
    return ['상대의 질문·요청·감정이 무엇인지 먼저 확인', '사과·확인·제안 등 빈칸에 필요한 응답 기능 결정', '보기를 넣어 앞뒤 대화가 자연스럽게 이어지는지 확인']
  }
  if (englishKind === 'reading') {
    return ['발문에서 일치·불일치·순서 중 무엇을 묻는지 표시', '지문의 순서 표현·날짜·조건·요청 행동을 직접 확인', '선지의 핵심 표현을 원문 근거와 한 항목씩 대조']
  }
  const text = plain(value).toLowerCase()
  if (question.visual || /(그래프|도표|차트|자료 해석)/.test(text)) {
    return ['자료 제목과 비교 대상을 먼저 확인', '축·범례·단위와 핵심 수치를 같은 기준으로 읽기', '선지의 주장과 실제 자료가 일치하는지 재확인']
  }
  if (/(수리|계산|비율|단위|통계|금융|예산)/.test(text)) {
    return ['발문에서 구하려는 값과 단위를 먼저 표시', '필요한 수치와 조건만 골라 계산식에 연결', '계산 결과의 단위와 가능한 크기인지 재검산']
  }
  if (/(면접|자기소개|지원동기|star|prep|블라인드)/.test(text)) {
    return ['경험·의견·직무 중 질문 요구부터 구분', 'STAR 또는 PREP으로 답변 순서 구성', '추상적 장점 대신 행동·결과 제시']
  }
  if (/(인성|윤리|태도|성찰|책임|정직|가치관)/.test(text)) {
    return ['좋아 보이는 답보다 실제 행동 기준 확인', '안전·정직·책임·협업 원칙과 상황 함께 검토', '비슷한 상황에서도 응답 기준 일관성 확인']
  }
  if (/(문서|독해|이메일|안내|공지|회의록|요지|지시어)/.test(text)) {
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
      thinkingLabel: '작성 순서',
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
      thinkingLabel: '답변 구성 순서',
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
    thinkingSteps: strategyFor(`${point.topic ?? ''} ${point.learn ?? ''}`, question),
    thinkingLabel: strategyLabelFor(`${point.topic ?? ''} ${point.learn ?? ''}`, question),
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
    thinkingLabel: '답변 구성 순서',
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
  const check = strategyFor(`${question.area ?? ''} ${question.lessonTitle ?? ''} ${question.stem ?? ''}`, question)[0]
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
      checklist: strategyFor(`${summary?.title ?? ''} ${question.stem ?? ''}`, question),
      sourceQuestion: question,
    })
  }
  return mistakes
}
