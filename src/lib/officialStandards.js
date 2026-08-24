export const STANDARD_AUTHORITIES = {
  teenup2026: {
    id: 'moe-korcham-teenup-2026',
    authority: '교육부·대한상공회의소',
    ministry: '교육부',
    operator: '대한상공회의소',
    title: '교육부 직업공통능력 인증',
    shortTitle: '직업공통능력 인증',
    productTitle: '교육부 직업공통능력 인증',
    audience: '직업계고 1·2학년 자가진단 및 3학년 인증진단',
    framework: '3개 능력군·5개 인증영역',
    version: '2026',
    sourceUrl: 'https://www.teenup.or.kr/intro/intro-01-00.do',
    areaSourceUrl: 'https://www.teenup.or.kr/intro/intro-02-00.do',
    assessmentSourceUrl: 'https://www.teenup.or.kr/intro/intro-03-00.do',
    disclaimer: '앱의 학습·모의 결과는 공식 인증 결과나 등급을 대신하지 않습니다.',
  },
  ncs2026: {
    id: 'moel-hrdkorea-ncs-common-26v1',
    authority: '고용노동부·한국산업인력공단',
    ministry: '고용노동부',
    operator: '한국산업인력공단',
    title: 'NCS 직업기초능력 26v1',
    shortTitle: 'NCS 직업기초능력',
    productTitle: 'NCS 직업기초능력 26v1',
    audience: '채용·교육훈련·자격·직무능력개발 학습자',
    framework: '7개 영역·21개 하위능력',
    version: '26v1',
    sourceUrl: 'https://www.ncs.go.kr/unity/th03/TH0308.do',
    standardSourceUrl: 'https://www.ncs.go.kr/unity/th03/TH0309.do',
    disclaimer: '앱의 진단 결과는 학습 보완용이며 국가 공인 합격 판정이 아닙니다.',
  },
}

// 같은 '직업공통능력' 명칭을 쓰는 두 제도를 UI에서 혼동하지 않도록
// 모든 과목명과 기관 배지는 이 상수에서만 가져간다.
export const COMMON_ABILITY_COURSES = {
  'job-common': {
    standardId: STANDARD_AUTHORITIES.teenup2026.id,
    title: STANDARD_AUTHORITIES.teenup2026.productTitle,
    authorityBadge: '교육부 주관 · 대한상공회의소 시행',
    frameworkLabel: '5개 인증영역',
  },
  'ncs-basic': {
    standardId: STANDARD_AUTHORITIES.ncs2026.id,
    title: STANDARD_AUTHORITIES.ncs2026.productTitle,
    authorityBadge: '고용노동부 · 한국산업인력공단',
    frameworkLabel: '7영역 · 21하위능력',
  },
}

export const TEENUP_2026 = {
  authority: STANDARD_AUTHORITIES.teenup2026,
  certification: {
    grade: 3,
    totalCount: 342,
    assessedMinutes: 240,
    areas: [
      { id: '의사소통 국어', count: 50, minutes: 50, multimediaRatio: 0.3 },
      { id: '의사소통 영어', count: 50, minutes: 50, multimediaRatio: 0.3 },
      { id: '수리활용', count: 50, minutes: 50, multimediaRequired: true },
      { id: '문제해결', count: 32, minutes: 50 },
      { id: '직무적응', count: 160, minutes: 40, assessmentType: 'likert' },
    ],
  },
  selfDiagnosis: {
    grades: [1, 2],
    totalCount: 215,
    areas: [
      { id: '의사소통 국어', count: 40, minutes: 50 },
      { id: '의사소통 영어', count: 40, minutes: 50 },
      { id: '수리활용', count: 25, minutes: 50 },
      { id: '문제해결', count: 30, minutes: 50 },
      { id: '직무적응', count: 80, minutes: 20, assessmentType: 'likert' },
    ],
  },
  workContexts: ['개인 업무', '동료·상사 협업', '고객 응대'],
  problemSolving: {
    bigIdeas: ['자원관리', '정보활용', '기술활용', '시스템적 사고'],
    processes: ['문제인식', '대안탐색 및 선택', '전략수립 및 실행', '평가 및 성찰'],
  },
  // TeenUp이 공개한 인증영역-NCS(구 10능력) 연계표. 이 항목들은
  // 인증의 최상위 메뉴가 아니라 5개 인증영역 안의 연계 학습요소다.
  legacyNcsCrosswalk: {
    '의사소통 국어': ['의사소통능력'],
    '의사소통 영어': ['의사소통능력'],
    '수리활용': ['수리능력'],
    '문제해결': ['문제해결능력', '정보능력', '기술능력', '자원관리능력', '조직이해능력'],
    '직무적응': ['대인관계능력', '자기개발능력', '직업윤리'],
  },
}

export const NCS_2026_AREAS = [
  {
    id: '의사소통능력',
    code: '01',
    abilities: [
      { id: '문서소통능력', elements: ['문서이해능력', '문서작성능력', '문서표현능력'] },
      { id: '구두소통능력', elements: ['경청능력', '의사표현능력', '대인소통능력'] },
      { id: '외국어소통능력', elements: ['외국어 이해능력', '외국어 표현능력', '외국어 상황대응능력'] },
    ],
  },
  {
    id: '수리능력',
    code: '02',
    abilities: [
      { id: '연산능력', elements: ['수와 연산', '어림값 계산', '단위 환산'] },
      { id: '통계활용능력', elements: ['통계의 기초', '자료의 요약과 분포', '확률과 추론'] },
      { id: '도표활용능력', elements: ['도표의 이해', '도표의 해석', '도표의 작성과 활용'] },
    ],
  },
  {
    id: '문제해결능력',
    code: '03',
    abilities: [
      { id: '문제분석능력', elements: ['문제 인식 및 정의', '정보 수집 및 검증', '원인 분석 및 구조화'] },
      { id: '대안발굴능력', elements: ['아이디어 생성 및 탐색', '대안 비교 및 평가', '실행가능성 검토'] },
      { id: '의사결정능력', elements: ['의사결정 기준 설정', '의사결정 수행 및 검토', '성찰 및 피드백'] },
    ],
  },
  {
    id: '자기관리능력',
    code: '04',
    abilities: [
      { id: '경력개발능력', elements: ['자기이해', '직업세계 이해', '경력개발계획 수립'] },
      { id: '적응학습능력', elements: ['변화대응 학습인식', '자기주도 학습실행', '지속적 자기개발'] },
      { id: '시간관리능력', elements: ['시간자원 인식', '시간활용 계획 수립', '효율적 시간 활용'] },
    ],
  },
  {
    id: '대인관계능력',
    code: '05',
    abilities: [
      { id: '협업능력', elements: ['역할 이해', '역할 조율', '협업을 통한 문제해결'] },
      { id: '리더십', elements: ['자기 리더십', '동료 리더십', '팀 리더십'] },
      { id: '갈등관리능력', elements: ['갈등 이해', '갈등 조정', '갈등 해소'] },
    ],
  },
  {
    id: '디지털능력',
    code: '06',
    abilities: [
      { id: '디지털활용능력', elements: ['디지털 도구 활용', '디지털 정보 처리', '디지털을 활용한 문제해결'] },
      { id: '인공지능(AI)활용능력', elements: ['AI 기술 이해', 'AI 도구 선택 및 적용', 'AI를 활용한 문제해결'] },
      { id: '디지털책임의식', elements: ['디지털 윤리 및 규범 의식', '디지털 윤리 및 규범 준수', '디지털 시민의식 실천'] },
    ],
  },
  {
    id: '직업윤리',
    code: '07',
    abilities: [
      { id: '근로윤리', elements: ['성실의식', '책임의식', '공정의식'] },
      { id: '직장공동체의식', elements: ['존중', '협력', '준법성'] },
      { id: '산업안전보건의식', elements: ['안전보건의식 및 책임 이해', '안전보건규범 준수', '위험예방 및 건강관리 실천'] },
    ],
  },
]

export const NCS_2026 = {
  authority: STANDARD_AUTHORITIES.ncs2026,
  areas: NCS_2026_AREAS,
  areaIds: NCS_2026_AREAS.map(area => area.id),
  abilityIds: NCS_2026_AREAS.flatMap(area => area.abilities.map(ability => ability.id)),
}

export function officialLabel(authority) {
  return `${authority.authority} · ${authority.version}`
}
