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

const CATEGORY_SITUATIONS = {
  '오리엔테이션': {
    context: '지원서 초안을 만든 뒤 채용공고의 면접 일정과 제출 서류가 수정됨.',
    stem: '지금 가장 먼저 할 행동은?',
    choices: ['공식 채용페이지의 변경 공고를 확인하고 제출 서류와 준비 일정을 다시 정리함', '처음 내려받은 공고가 기준이라고 보고 변경 안내는 별도로 확인하지 않음', '지난해 합격후기에 적힌 일정이 더 익숙해 그 순서대로 면접 준비를 이어 감', '같은 회사에 지원한 친구가 정리한 일정표만 받아 개인 준비표에 그대로 옮김'],
    explanation: '지원 시점의 공식 공고가 일정·제출물·평가 방식의 최종 기준임.',
  },
  '면접절차': {
    context: '문이 열려 있어 입장했지만 면접관이 서류를 보고 있어 “앉으세요”라는 말이 없음.',
    stem: '가장 자연스러운 행동은?',
    choices: ['가볍게 인사한 뒤 안내를 기다리고, 착석 권유를 받으면 의자를 정리해 앉음', '면접관이 서류를 보는 중이므로 방해하지 않으려고 말없이 빈 의자에 먼저 앉음', '자신감 있는 첫인상을 주기 위해 문 앞에서 큰 목소리로 소속과 이름을 반복해 말함', '입장 안내를 빨리 받기 위해 면접관 책상 가까이 다가가 보고 있는 서류를 확인함'],
    explanation: '입장·인사·착석은 현장 안내를 살피며 차분하게 이어 가는 것이 안전함.',
  },
  '평가기준': {
    context: '“책임감을 보여 준 경험이 있나요?”라는 질문에 “저는 원래 책임감이 강합니다”라고만 답함.',
    stem: '답변을 가장 먼저 어떻게 보완해야 할까?',
    choices: ['마감이 늦어진 원인을 확인하고 작업표를 다시 나눠 기한 안에 끝낸 경험을 덧붙임', '책임감이 강하고 성실하다는 표현을 여러 번 반복해 장점이 확실히 들리게 답함', '책임감 외에도 친화력과 리더십이 있다는 내용을 함께 나열해 장점을 풍부하게 만듦', '팀이 함께 완성한 결과를 자신의 단독 성과처럼 바꾸어 역할이 크게 보이도록 설명함'],
    explanation: '평가자는 장점의 이름보다 실제 행동과 결과를 통해 역량을 확인함.',
  },
  '자기소개': {
    context: '1분 자기소개가 1분 40초이며 성장 배경과 취미 설명이 대부분임.',
    stem: '실전 면접용으로 가장 적절한 수정은?',
    choices: ['직무 강점 한 가지와 이를 증명한 행동, 입사 후 기여를 골라 40~60초로 다시 구성함', '현재 원고의 내용은 그대로 둔 채 말하는 속도만 높여 정확히 1분 안에 읽도록 연습함', '성장 배경은 유지하고 가족 이야기 한 문단만 삭제해 분량을 조금 줄이는 데 집중함', '직무 관련성이 낮더라도 취득한 자격증 이름을 모두 추가해 준비가 많아 보이게 만듦'],
    explanation: '1분 자기소개는 자기소개서의 핵심 사실을 직무 강점과 기여 중심으로 압축해야 함.',
  },
  '지원동기': {
    context: '“안정적이고 유명한 회사라 지원했습니다”라고 답한 뒤 면접관이 “왜 우리 회사인가요?”라고 다시 물음.',
    stem: '가장 설득력 있는 다음 답변은?',
    choices: ['공식 사업과 직무의 특징을 짚고 그에 맞춰 준비한 경험과 입사 후 기여를 연결함', '급여와 복지가 안정적이라는 점을 다시 강조하고 오래 근무할 수 있다는 장점을 덧붙임', '회사에 대한 구체적인 근거 대신 어떤 업무든 시키는 대로 하며 오래 다니겠다고 약속함', '지원처 이름만 바꾸면 다른 회사에서도 사용할 수 있는 성실성과 열정 중심 답변을 말함'],
    explanation: '지원처만의 공식 근거와 자신의 직무 준비가 연결돼야 지원 이유가 구체화됨.',
  },
  '경험답변': {
    context: '팀 프로젝트 성공 경험을 설명했지만 “우리가 열심히 해서 잘됐습니다”로 끝남.',
    stem: '꼬리질문 전에 가장 먼저 보완할 내용은?',
    choices: ['내 역할과 선택한 행동, 팀과 확인한 과정, 전후 결과를 구분해 구체적으로 말함', '함께 참여한 팀원의 이름과 담당 업무를 모두 소개해 팀 활동의 규모를 자세히 보여 줌', '실제 결과보다 성과 수치를 크게 바꾸고 자신이 핵심 역할을 했다고 강조해 답변을 보강함', '프로젝트를 시작하게 된 배경과 당시 분위기를 길게 설명하고 자신의 행동은 짧게 마무리함'],
    explanation: '팀 경험에서도 본인의 판단과 행동, 공동 결과가 분리되어 보여야 함.',
  },
  '인성면접': {
    context: '갈등 경험을 묻자 “팀원이 일을 못해서 제가 다 했습니다”라고 답함.',
    stem: '책임감과 협업을 함께 보여 주는 수정은?',
    choices: ['의견 차이의 원인과 확인한 사실, 조정한 행동, 함께 만든 결과를 차례로 말함', '팀원이 약속을 지키지 않은 횟수와 잘못을 자세히 설명해 자신에게 책임이 없음을 밝힘', '협업에 불리할 수 있으므로 실제 갈등 경험을 빼고 팀원과 항상 잘 지냈다고 답변함', '결과를 지키기 위해 자신이 팀원의 일까지 모두 대신했다는 희생과 책임감을 강조함'],
    explanation: '인성 답변은 타인 비난보다 사실 확인과 조정 행동으로 태도를 증명해야 함.',
  },
  '블라인드': {
    context: '면접관이 학교 활동을 묻자 학교명과 지역을 말할 뻔함.',
    stem: '블라인드 원칙을 지키며 답하는 방법은?',
    choices: ['학교명 대신 전공 수업과 프로젝트에서 맡은 역할, 직접 한 행동과 결과를 설명함', '경험의 신뢰성을 높이기 위해 학교명과 지도 교사의 이름까지 구체적으로 함께 밝힘', '학교 정보가 포함될 수 있으므로 관련 경험에 대한 질문에는 아무 답도 하지 않고 넘어감', '학교명은 말하지 않고 지역과 학교 유형만 밝힌 뒤 해당 학교의 특징을 자세히 설명함'],
    explanation: '편견정보는 빼되 질문과 관련된 교육 경험·행동 근거는 구체적으로 답할 수 있음.',
  },
  '상황면접': {
    context: '선배가 납기를 맞추기 위해 안전 점검표 한 항목을 생략하자고 요청함.',
    stem: '지원자가 취할 가장 적절한 대응은?',
    choices: ['위험과 기준을 확인해 점검은 유지하고, 가능한 일정 대안을 제시한 뒤 필요 시 보고함', '현장 경험이 많은 선배의 판단을 존중해 점검표 한 항목을 생략하고 납기를 먼저 맞춤', '요청을 거절하면 관계가 불편해질 수 있으므로 답하지 않은 채 다른 작업장으로 자리를 옮김', '실제 점검은 생략하되 문서에는 정상 점검한 것으로 기록해 일정과 절차를 모두 맞춘 것처럼 처리함'],
    explanation: '안전·윤리 원칙을 지키면서 사실 확인, 대안 제시, 보고까지 연결해야 함.',
  },
  'PT/발표': {
    context: '발표 5분 전, 준비한 수치 하나가 공식 자료와 다르다는 것을 발견함.',
    stem: '가장 신뢰를 지키는 조치는?',
    choices: ['확인된 수치로 수정하고 불확실한 범위를 밝힌 뒤 주장과 근거, 대안을 다시 정리함', '발표 직전 수정하면 더 혼란스러울 수 있으므로 틀린 수치를 유지하고 확신 있게 설명함', '수치가 하나라도 틀렸으므로 준비한 자료를 모두 삭제하고 기억나는 내용만 즉석에서 말함', '자료의 출처 표시는 지우고 전체 흐름에는 영향이 없는 대략적인 값이라고 설명하며 넘어감'],
    explanation: '발표는 화려함보다 정확한 근거와 제한시간 안의 구조가 우선임.',
  },
  '토론/그룹': {
    context: '의견을 말하는 중 다른 지원자가 끼어들었고, 토론 시간이 얼마 남지 않음.',
    stem: '협업 역량을 보여 주는 대응은?',
    choices: ['상대 의견을 짧게 확인한 뒤 내 핵심 근거를 덧붙이고 남은 시간에 맞는 합의안을 제안함', '발언권을 먼저 얻었음을 강조하며 목소리를 높여 준비한 의견을 끝까지 모두 설명함', '다시 끼어드는 상황을 피하기 위해 이후 발언은 포기하고 마지막 표결에만 조용히 참여함', '토론 규칙을 어긴 행동부터 공개적으로 지적하고 사과를 받은 뒤 원래 발언을 다시 시작함'],
    explanation: '토론에서는 발언량보다 경청·요약·근거·합의 형성 행동이 중요함.',
  },
  '직무면접': {
    context: '전공 실습과 관련된 질문이지만 정확한 수치가 기억나지 않음.',
    stem: '가장 적절한 답변 방식은?',
    choices: ['아는 범위를 밝히고 작업 원리와 확인 절차를 설명한 뒤 정확한 값은 재확인하겠다고 함', '정확히 기억나지 않는다는 인상을 피하려고 비슷하게 떠오르는 수치를 확정된 값처럼 답함', '수치 질문에는 직접 답하지 않고 관련 실습에서 취득한 자격증과 수상 경험을 길게 나열함', '잘못 답하는 것보다 안전하다고 판단해 모른다고만 말하고 추가로 아는 원리도 설명하지 않음'],
    explanation: '모르는 부분을 숨기기보다 알고 있는 원리·판단 과정·확인 방법을 정직하게 보여 줌.',
  },
  '직장태도': {
    context: '퇴근 직전 인수인계 중 작은 불량 가능성을 발견했지만 확인하면 시간이 더 걸림.',
    stem: '신입사원에게 기대되는 행동은?',
    choices: ['사실과 영향 범위를 확인해 기록하고 담당자에게 인계한 뒤 필요한 후속 조치를 남김', '아직 불량으로 확정되지 않았고 근무시간도 끝났으므로 발견 사실을 기록하지 않고 퇴근함', '다음 근무자가 다시 검사할 예정이므로 별도 설명 없이 눈에 잘 띄는 곳에 제품만 옮겨 둠', '확인하는 데 시간이 걸리므로 큰 품질 사고라고 먼저 단정해 전체 단체방에 긴급 공지를 올림'],
    explanation: '품질·안전 문제는 사실 확인, 기록, 정확한 인수인계로 책임 있게 처리함.',
  },
  '모의면접': {
    context: '녹화 영상을 보니 답변마다 “약간”, “그냥”을 반복하고 시선이 계속 아래로 향함.',
    stem: '다음 연습에서 가장 효과적인 수정은?',
    choices: ['한 번에 고칠 습관 하나를 정해 재촬영하고 전후 영상을 같은 체크표로 비교함', '긴장하면 자연히 사라질 습관이라고 보고 영상을 확인하지 않은 채 같은 답변만 반복함', '말버릇과 시선을 동시에 없애기 위해 기존 답변을 버리고 새로운 원고 전체를 다시 외움', '머뭇거릴 틈이 없으면 말버릇도 줄어든다고 보고 답변 속도를 최대한 빠르게 높임'],
    explanation: '녹화·관찰·한 가지 수정·재답변의 반복이 실제 행동을 바꾸기 쉬움.',
  },
  '준비 루틴': {
    context: '면접 전날인데 기업 소개 암기만 했고 직무기술서와 자신의 경험 정리가 비어 있음.',
    stem: '남은 시간을 가장 효과적으로 쓰는 순서는?',
    choices: ['최신 공고와 직무 요구 확인 → 대표 경험 연결 → 핵심 답변을 소리 내어 점검함', '기업에 대한 관심을 보여 주는 것이 우선이므로 창립 연도와 역대 대표 이름을 밤새 암기함', '직무에 맞는 경험이 부족하므로 실제로 하지 않은 활동을 만들어 예상 질문 답변에 넣음', '전날 새로 준비하면 더 긴장할 수 있으므로 복장과 이동 경로만 확인하고 답변 연습은 하지 않음'],
    explanation: '지원처·직무·내 경험·말하기를 연결한 짧은 루틴이 실전 대응력을 높임.',
  },
  '블라인드 안전': {
    context: '답변 중 실수로 학교 이름 첫 글자를 말한 것을 바로 알아챔.',
    stem: '당황하지 않고 수습하는 방법은?',
    choices: ['짧게 정정한 뒤 “전공 프로젝트에서”처럼 편견정보를 뺀 경험 중심 표현으로 이어 감', '첫 글자까지 말했으므로 숨기기 어렵다고 판단해 학교명을 끝까지 밝히고 답변을 계속함', '블라인드 원칙을 위반했을 수 있으므로 즉시 면접을 중단해 달라고 요청하고 답변을 멈춤', '학교 경험을 더 말하면 실수할 수 있으므로 질문과 관련 없는 개인 취미 이야기로 답변을 바꿈'],
    explanation: '실수는 짧게 정정하고 편견정보를 제거한 경험·행동 답변으로 자연스럽게 복귀함.',
  },
}

const SHARED_SITUATIONS = [
  lesson => ({
    context: `${lesson.title} 답변을 마친 뒤 면접관이 “그 행동을 본인이 했다는 근거가 있나요?”라고 물음.`,
    stem: '가장 신뢰를 높이는 후속 답변은?',
    choices: ['내 역할과 작업 기록, 완성물, 전후 변화를 구분해 확인 가능한 사실대로 설명함', '팀 결과도 내 기여로 볼 수 있다고 판단해 공동 성과 전체를 자신이 한 일처럼 바꾸어 설명함', '정확한 수치가 없어 보이면 약해 보일 수 있으므로 기억나지 않는 결과값을 그럴듯하게 만들어 답함', '근거를 바로 찾기 어려우므로 질문과 관계없는 성실성과 책임감 이야기를 길게 덧붙여 답함'],
    explanation: '꼬리질문에는 처음 답변과 일치하는 역할·행동·확인 가능한 결과로 답함.',
  }),
  lesson => ({
    context: `${lesson.title} 준비 자료와 현재 공식 채용공고의 내용이 서로 다름.`,
    stem: '실전 답변을 고치는 기준은?',
    choices: ['현재 공식 공고와 직무기술서를 우선해 준비하고, 기존 자료와 달라진 요구를 답변에 반영함', '실제 합격자의 경험이 더 정확하다고 보고 게시 시점이 오래된 합격후기 내용을 우선해 준비함', '교재가 여러 사례를 종합했을 것이라 판단해 지원처의 최신 변경과 관계없이 문장을 그대로 외움', '서로 다른 내용 중 자신이 이미 준비한 경험에 유리한 정보만 골라 공식 기준처럼 사용함'],
    explanation: '전형과 직무 요구는 바뀔 수 있으므로 실제 지원 시점의 공식 자료를 기준으로 함.',
  }),
  lesson => ({
    context: `${lesson.title} 답변을 40초로 연습했지만 첫 문장에 결론이 없고 배경 설명만 30초가 걸림.`,
    stem: '가장 먼저 고칠 부분은?',
    choices: ['첫 문장에 핵심 답을 제시하고 배경을 줄여 직접 한 행동과 결과를 말할 시간을 확보함', '현재 원고가 모두 중요하므로 내용을 줄이지 않고 말하는 속도만 두 배로 높여 40초에 맞춤', '면접관이 상황을 정확히 이해해야 하므로 배경 설명을 더 추가하고 행동과 결과는 한 문장으로 줄임', '과정이 역량을 보여 준다고 판단해 결과 부분을 삭제하고 준비 과정과 어려움을 더 자세히 말함'],
    explanation: '면접 답변은 핵심 답을 먼저 제시하고 행동과 결과에 충분한 시간을 배분함.',
  }),
  lesson => ({
    context: `${lesson.title} 연습 중 준비하지 않은 질문을 받아 5초간 생각이 멈춤.`,
    stem: '가장 안정적인 대응은?',
    choices: ['질문의 핵심을 짧게 확인하고 생각을 정리한 뒤 자신이 아는 사실과 경험부터 답함', '답변이 늦으면 준비 부족으로 보일 수 있으므로 떠오르는 경험을 실제 있었던 일처럼 바로 만들어 말함', '침묵을 피하는 것이 중요하므로 질문과 맞지 않더라도 가장 자신 있게 외운 지원동기를 이어서 말함', '잘못 답해 감점받는 일을 피하려고 아무 설명 없이 침묵한 채 면접관이 다음 질문을 하기를 기다림'],
    explanation: '잠깐 정리한 뒤 질문에 맞는 사실 범위에서 답하는 편이 신뢰를 지킴.',
  }),
]

function placeCorrectChoice(choices, targetIndex) {
  const arranged = choices.slice(1)
  arranged.splice(targetIndex, 0, choices[0])
  return { choices: arranged, answer: String.fromCharCode(65 + targetIndex) }
}

function lessonSequence(id) {
  const number = Number(String(id).match(/\d+/)?.[0] || 1)
  return String(id).startsWith('S') ? 45 + number - 1 : number - 1
}

export function buildInterviewConceptChecks(lesson, _quizQuestions = []) {
  if (!lesson) return []
  const categorySituation = CATEGORY_SITUATIONS[lesson.category] || {
    context: `${lesson.title} 실전 연습 중 답변이 추상적인 장점만으로 끝남.`,
    stem: '가장 먼저 보완할 내용은?',
    choices: [CATEGORY_GUIDE[lesson.category] || '자신의 실제 행동과 확인 가능한 결과를 연결해 답함', '추상적인 장점이 더 잘 들리도록 긍정적인 수식어를 여러 문장에 반복해 사용함', '검증된 답변이라고 판단한 합격후기 문장을 자신의 경험으로 바꾸지 않고 그대로 외워 말함', '여러 회사에 같은 답변을 쓸 수 있도록 내용은 유지하고 지원처 이름만 바꾸어 준비함'],
    explanation: '면접 답변은 질문에 맞는 실제 행동과 확인 가능한 결과로 신뢰를 얻음.',
  }
  return [categorySituation, ...SHARED_SITUATIONS.map(factory => factory(lesson))].map((item, index) => {
    const targetIndex = (lessonSequence(lesson.id) * 5 + index) % 4
    const { choices, answer } = placeCorrectChoice(item.choices, targetIndex)
    return {
      id: `IVS-${lesson.id}-${index + 1}`,
      lessonId: lesson.id,
      category: lesson.category,
      context: item.context,
      stem: item.stem,
      choices,
      answer,
      explanation: item.explanation,
      questionMode: 'mcq',
      learningLane: 'study',
      isPractical: true,
    }
  })
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
    if (section.type === 'blockquote' && /질문|실전\s*예상|Q\d+/i.test(heading)) {
      add(section.text)
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
  const practices = (lesson.practiceQuestions || [])
    .map((question, index) => ({
      ...question,
      id: question.id || `${lesson.id}-practice-${index + 1}`,
      stem: clean(question.question),
      context: question.structHint,
      explanation: (question.answerPoints || []).join(' '),
      isInterview: true,
      format: '면접 질문형',
    }))
    .filter(question => question.stem.length >= 10 && !/^(?:셀프\s*체크\s*기준|상황|과제|행동|결과|구조\s*힌트)\s*[:：]?$/.test(question.stem))
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
