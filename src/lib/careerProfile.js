export const CAREER_CONTEXT_KEY = 'iv_personalized_example_context'
export const CAREER_PROFILE_VERSION = 4

export const SCHOOL_GRADE_OPTIONS = [
  { id: 1, label: '1학년' },
  { id: 2, label: '2학년' },
  { id: 3, label: '3학년' },
]

export const QUALIFICATION_STATUSES = [
  { id: 'planned', label: '준비 예정' },
  { id: 'preparing', label: '준비 중' },
  { id: 'writtenPassed', label: '필기 합격' },
  { id: 'practicalPassed', label: '실기 합격' },
  { id: 'acquired', label: '최종 합격·취득' },
  { id: 'custom', label: '직접 입력' },
]

export const QUALIFICATION_VALIDITY_TYPES = [
  { id: 'none', label: '유효기간 없음' },
  { id: 'expires', label: '유효기간 있음' },
  { id: 'check', label: '확인 필요' },
]

export const EXTRACURRICULAR_CATEGORIES = [
  { id: 'club', label: '동아리', sourceType: 'club', evidenceSource: '동아리', nameLabel: '동아리명', organizerLabel: '소속·지도교사', roleLabel: '맡은 역할', outcomeLabel: '완성한 결과·변화' },
  { id: 'volunteer', label: '봉사활동', sourceType: 'volunteer', evidenceSource: '봉사', nameLabel: '봉사활동명', organizerLabel: '봉사기관', roleLabel: '담당 활동', outcomeLabel: '도움을 준 내용·변화', usesHours: true },
  { id: 'competition', label: '대회·경진대회', sourceType: 'team-project', evidenceSource: '대회', nameLabel: '대회명', organizerLabel: '주최·주관기관', roleLabel: '팀 역할·담당 과제', outcomeLabel: '성과·본선·완성 결과', usesRank: true },
  { id: 'award', label: '수상·표창', sourceType: 'team-project', evidenceSource: '수상', nameLabel: '수상·표창명', organizerLabel: '수여기관', roleLabel: '수상에 기여한 역할', outcomeLabel: '선정 이유·성과', usesRank: true },
  { id: 'project', label: '프로젝트·과제', sourceType: 'team-project', evidenceSource: '프로젝트', nameLabel: '프로젝트명', organizerLabel: '교과·팀·기관', roleLabel: '담당 업무', outcomeLabel: '산출물·개선 결과' },
  { id: 'leadership', label: '학생자치·리더십', sourceType: 'team-project', evidenceSource: '학생자치', nameLabel: '조직·활동명', organizerLabel: '학교·학급·학생회', roleLabel: '직책·담당 역할', outcomeLabel: '운영 결과·변화' },
  { id: 'careerExperience', label: '진로체험·캠프', sourceType: 'major-practice', evidenceSource: '진로체험', nameLabel: '체험·캠프명', organizerLabel: '운영기관·기업', roleLabel: '수행한 활동', outcomeLabel: '완성 결과·배운 점' },
  { id: 'fieldPractice', label: '현장실습·인턴', sourceType: 'major-practice', evidenceSource: '현장실습', nameLabel: '실습·인턴명', organizerLabel: '기업·기관·부서', roleLabel: '담당 업무', outcomeLabel: '업무 결과·피드백' },
  { id: 'workExperience', label: '근로·아르바이트', sourceType: 'major-practice', evidenceSource: '근로경험', nameLabel: '근무·업무명', organizerLabel: '근무처', roleLabel: '담당 업무', outcomeLabel: '고객·업무 개선 결과' },
  { id: 'other', label: '기타·직접 입력', sourceType: 'major-practice', evidenceSource: '기타 활동', nameLabel: '활동명', organizerLabel: '관련 기관·단체', roleLabel: '내가 한 일', outcomeLabel: '결과·변화' },
]

export const CAREER_PROFILE_REFERENCES = [
  { id: 'career-net', label: '커리어넷 진로개발역량', url: 'https://www.career.go.kr/' },
  { id: 'student-record', label: '교육부 학교생활기록부', url: 'https://star.moe.go.kr/' },
  { id: 'hifive', label: '교육부 HIFIVE 학과정보', url: 'https://www.hifive.go.kr/' },
  { id: 'qnet', label: 'Q-Net 국가자격정보', url: 'https://www.q-net.or.kr/' },
]

const CAREER_GRADE_ROADMAP = {
  1: {
    stage: '탐색·기록 시작',
    headline: '잘한 일을 찾기보다 직접 해 본 일을 빠짐없이 남기는 시기',
    actions: ['학과 수업과 실습에서 맡은 역할을 월 1회 기록', '관심 직무 2개를 정하고 필요한 역량 비교', '첫 자격 준비 일정과 작은 교과외활동 계획'],
  },
  2: {
    stage: '집중·근거 강화',
    headline: '관심 직무와 연결되는 자격·활동을 결과까지 완성하는 시기',
    actions: ['대표 활동에 역할·행동·결과·확인 자료 보완', '취득 자격 또는 준비 과정의 실제 적용 경험 기록', '관심 기업·기관 3곳의 직무와 요구 역량 비교'],
  },
  3: {
    stage: '지원·검증',
    headline: '지원처별로 가장 강한 근거를 골라 작성하고 교사 피드백으로 고치는 시기',
    actions: ['지원처별 자기소개서와 면접 답변 세트 작성', '근거 카드의 수치·역할·증빙을 최종 확인', '첨삭 이력과 면접 피드백을 반영해 최종본 관리'],
  },
}

const MAJOR_DEVELOPMENT_ACTIONS = {
  business: ['문서·회계·고객 응대 중 한 업무를 정해 정확도와 처리 과정을 기록', '엑셀·회계·사무 자격의 기능을 실제 과제에 적용'],
  software: ['코드·설정·테스트 전후의 문제와 해결 기록을 저장', '작동 화면·저장소·테스트 결과처럼 다시 확인 가능한 산출물 확보'],
  electrical: ['측정값·배선·안전 기준을 작업 전후 기록', '오류 원인과 재측정 결과를 근거 카드로 정리'],
  mechanical: ['도면·공정·공차·안전 기준과 완성 결과를 함께 기록', '작업 시간이나 불량 감소처럼 비교 가능한 결과 확보'],
  architecture: ['도면·측량·시공 과정에서 적용한 기준과 수정 이력 기록', '완성 도면·측정표·현장 점검표 등 증빙 확보'],
  food: ['위생·계량·공정·서비스 기준과 완성 결과 기록', '조리 시간·품질 피드백·원가 개선처럼 확인 가능한 변화 확보'],
  design: ['요구사항·시안·수정 이유·최종 결과를 한 묶음으로 저장', '사용자나 지도교사의 피드백 전후를 비교'],
  bio: ['관찰·측정·안전·환경 기준을 일지로 기록', '조건 변화와 결과를 수치 또는 사진 설명으로 남김'],
  service: ['고객 요구를 확인한 질문과 처리 과정을 기록', '불편 감소·만족 피드백·재발 방지 결과를 확보'],
  general: ['수업·학급·동아리에서 맡은 일을 행동과 결과로 나누어 기록', '관심 직무를 정한 뒤 필요한 자격과 활동을 비교'],
}

const QUALIFICATION_DETAILS = {
  'kcci-computer-skills': { levels: ['1급', '2급'] },
  'kcci-computer-accounting': { levels: ['1급', '2급', '3급'] },
  'kcci-distribution': { levels: ['1급', '2급', '3급'] },
  'kcci-electronic-commerce': { levels: ['1급', '2급'] },
  'kcci-trade-english': { levels: ['1급', '2급', '3급'] },
  'kcci-secretary': { levels: ['1급', '2급', '3급'] },
  'kpc-itq': { levels: ['A등급', 'B등급', 'C등급'] },
  'kpc-gtq': { levels: ['1급', '2급', '3급'] },
  'kpc-gtqi': { levels: ['1급', '2급', '3급'] },
  'kpc-erp': { levels: ['1급', '2급'] },
  'kacpta-computer-accounting': { levels: ['1급', '2급'] },
  'kacpta-computer-tax': { levels: ['1급', '2급'] },
  'kicpa-fat': { levels: ['1급', '2급'] },
  'kicpa-tat': { levels: ['1급', '2급'] },
  history: { levels: ['1급', '2급', '3급', '4급', '5급', '6급'] },
  toeic: { levelLabel: '점수·등급', validityType: 'expires', validityMonths: 24, validityNote: '공식 성적 유효기간은 시험일로부터 2년', validitySource: 'https://exam.toeic.co.kr/common/template/viewContents.php?contentsCode=87' },
  opic: { levels: ['AL', 'IH', 'IM3', 'IM2', 'IM1', 'IL', 'NH', 'NM', 'NL'], levelLabel: '등급', validityType: 'expires', validityMonths: 24, validityNote: '공식 성적 유효기간은 응시일로부터 2년', validitySource: 'https://www.opic.or.kr/opics/servlet/controller.opic.site.applyinfor.ActflTestRuleServlet?p_process=move-actfl_test_rule' },
}

const q = (id, name, issuer, type, majorGroups = [], profileId = '') => ({
  id,
  name,
  issuer,
  type,
  majorGroups,
  profileId,
  levels: [],
  levelLabel: '급수·등급',
  validityType: type === '어학시험' ? 'check' : 'none',
  validityMonths: 0,
  validityNote: '',
  validitySource: '',
  ...(QUALIFICATION_DETAILS[id] || {}),
})

export const QUALIFICATION_CATALOG = [
  q('kcci-computer-skills', '컴퓨터활용능력', '대한상공회의소', '국가기술자격', ['business', 'software', 'general'], 'computer-skills'),
  q('kcci-word', '워드프로세서', '대한상공회의소', '국가기술자격', ['business', 'general'], 'word-processing'),
  q('kcci-computer-accounting', '전산회계운용사', '대한상공회의소', '국가기술자격', ['business'], 'computer-accounting'),
  q('kcci-distribution', '유통관리사', '대한상공회의소', '국가전문자격', ['business', 'service']),
  q('kcci-electronic-commerce', '전자상거래관리사', '대한상공회의소', '국가기술자격', ['business', 'software']),
  q('kcci-trade-english', '무역영어', '대한상공회의소', '공인자격', ['business', 'service']),
  q('kcci-secretary', '비서', '대한상공회의소', '공인자격', ['business', 'service']),
  q('kcci-flex', 'FLEX 외국어능력시험', '대한상공회의소', '국가공인 민간자격', ['business', 'service', 'general']),
  q('kpc-itq', 'ITQ 정보기술자격', '한국생산성본부', '국가공인 민간자격', ['business', 'software', 'general']),
  q('kpc-gtq', 'GTQ 그래픽기술자격', '한국생산성본부', '국가공인 민간자격', ['design', 'software'], 'computer-graphics'),
  q('kpc-gtqi', 'GTQi 일러스트', '한국생산성본부', '공인자격', ['design', 'software']),
  q('kpc-erp', 'ERP정보관리사', '한국생산성본부', '국가공인 민간자격', ['business', 'software']),
  q('kpc-icdl', 'ICDL', '한국생산성본부', '국제공인자격', ['business', 'software', 'general']),
  q('kpc-smat', 'SMAT 서비스경영자격', '한국생산성본부', '국가공인 민간자격', ['business', 'service']),
  q('kpc-dat', '데이터 아키텍처 준전문가(DAsP)', '한국데이터산업진흥원', '국가공인 민간자격', ['software']),
  q('kdata-adsp', '데이터분석 준전문가(ADsP)', '한국데이터산업진흥원', '국가공인 민간자격', ['software', 'business']),
  q('kdata-sqld', 'SQL 개발자(SQLD)', '한국데이터산업진흥원', '국가공인 민간자격', ['software']),
  q('hrdk-information-processing', '정보처리기능사', '한국산업인력공단', '국가기술자격', ['software'], 'information-processing'),
  q('hrdk-web-design', '웹디자인개발기능사', '한국산업인력공단', '국가기술자격', ['software', 'design'], 'web-design'),
  q('hrdk-computer-graphics', '컴퓨터그래픽스운용기능사', '한국산업인력공단', '국가기술자격', ['design', 'software'], 'computer-graphics'),
  q('hrdk-electrician', '전기기능사', '한국산업인력공단', '국가기술자격', ['electrical'], 'electrician'),
  q('hrdk-electronic-device', '전자기기기능사', '한국산업인력공단', '국가기술자격', ['electrical'], 'electronic-device'),
  q('hrdk-production-automation', '생산자동화기능사', '한국산업인력공단', '국가기술자격', ['electrical', 'mechanical'], 'production-automation'),
  q('hrdk-electronic-cad', '전자캐드기능사', '한국산업인력공단', '국가기술자격', ['electrical', 'design']),
  q('hrdk-computer-lathe', '컴퓨터응용선반기능사', '한국산업인력공단', '국가기술자격', ['mechanical'], 'computer-lathe'),
  q('hrdk-computer-milling', '컴퓨터응용밀링기능사', '한국산업인력공단', '국가기술자격', ['mechanical'], 'computer-milling'),
  q('hrdk-automotive', '자동차정비기능사', '한국산업인력공단', '국가기술자격', ['mechanical'], 'automotive-maintenance'),
  q('hrdk-machine-maintenance', '설비보전기능사', '한국산업인력공단', '국가기술자격', ['mechanical'], 'machine-maintenance'),
  q('hrdk-welding', '용접기능사', '한국산업인력공단', '국가기술자격', ['mechanical']),
  q('hrdk-special-welding', '특수용접기능사', '한국산업인력공단', '국가기술자격', ['mechanical']),
  q('hrdk-cad-mechanical', '전산응용기계제도기능사', '한국산업인력공단', '국가기술자격', ['mechanical', 'design']),
  q('hrdk-interior', '실내건축기능사', '한국산업인력공단', '국가기술자격', ['architecture', 'design'], 'interior-architecture'),
  q('hrdk-architecture-cad', '전산응용건축제도기능사', '한국산업인력공단', '국가기술자격', ['architecture'], 'computer-drawing-architecture'),
  q('hrdk-civil-cad', '전산응용토목제도기능사', '한국산업인력공단', '국가기술자격', ['architecture']),
  q('hrdk-surveying', '측량기능사', '한국산업인력공단', '국가기술자격', ['architecture'], 'surveying'),
  q('hrdk-construction-paint', '건축도장기능사', '한국산업인력공단', '국가기술자격', ['architecture'], 'architectural-painting'),
  q('hrdk-korean-food', '한식조리기능사', '한국산업인력공단', '국가기술자격', ['food'], 'korean-cuisine'),
  q('hrdk-western-food', '양식조리기능사', '한국산업인력공단', '국가기술자격', ['food'], 'western-cuisine'),
  q('hrdk-chinese-food', '중식조리기능사', '한국산업인력공단', '국가기술자격', ['food']),
  q('hrdk-japanese-food', '일식조리기능사', '한국산업인력공단', '국가기술자격', ['food']),
  q('hrdk-confectionery', '제과기능사', '한국산업인력공단', '국가기술자격', ['food'], 'confectionery'),
  q('hrdk-bread', '제빵기능사', '한국산업인력공단', '국가기술자격', ['food'], 'bread-making'),
  q('hrdk-bartender', '조주기능사', '한국산업인력공단', '국가기술자격', ['food', 'service'], 'bartender'),
  q('hrdk-food-processing', '식품가공기능사', '한국산업인력공단', '국가기술자격', ['food', 'bio']),
  q('hrdk-hairdresser', '미용사(일반)', '한국산업인력공단', '국가기술자격', ['design', 'service'], 'hairdresser'),
  q('hrdk-skin', '미용사(피부)', '한국산업인력공단', '국가기술자격', ['design', 'service']),
  q('hrdk-nail', '미용사(네일)', '한국산업인력공단', '국가기술자격', ['design', 'service'], 'nail-art'),
  q('hrdk-makeup', '미용사(메이크업)', '한국산업인력공단', '국가기술자격', ['design', 'service'], 'makeup-artist'),
  q('hrdk-florist', '화훼장식기능사', '한국산업인력공단', '국가기술자격', ['design', 'bio']),
  q('hrdk-landscape', '조경기능사', '한국산업인력공단', '국가기술자격', ['bio', 'architecture']),
  q('hrdk-organic', '유기농업기능사', '한국산업인력공단', '국가기술자격', ['bio']),
  q('hrdk-livestock', '축산기능사', '한국산업인력공단', '국가기술자격', ['bio']),
  q('hrdk-forest', '산림기능사', '한국산업인력공단', '국가기술자격', ['bio']),
  q('hrdk-chemical-analysis', '화학분석기능사', '한국산업인력공단', '국가기술자격', ['bio']),
  q('hrdk-environment', '환경기능사', '한국산업인력공단', '국가기술자격', ['bio']),
  q('hrdk-dangerous', '위험물기능사', '한국산업인력공단', '국가기술자격', ['bio', 'mechanical', 'electrical']),
  q('hrdk-industrial-safety', '산업안전산업기사', '한국산업인력공단', '국가기술자격', ['mechanical', 'electrical', 'architecture', 'bio']),
  q('hrdk-cad-map', '지도제작기능사', '한국산업인력공단', '국가기술자격', ['architecture', 'design']),
  q('hrdk-printing', '인쇄기능사', '한국산업인력공단', '국가기술자격', ['design']),
  q('hrdk-photo', '사진기능사', '한국산업인력공단', '국가기술자격', ['design', 'service']),
  q('hrdk-jewelry', '귀금속가공기능사', '한국산업인력공단', '국가기술자격', ['design']),
  q('hrdk-craftsman', '도자공예기능사', '한국산업인력공단', '국가기술자격', ['design']),
  q('hrdk-information-device', '정보기기운용기능사', '한국산업인력공단', '국가기술자격', ['software', 'electrical']),
  q('hrdk-network', '통신기기기능사', '한국방송통신전파진흥원', '국가기술자격', ['software', 'electrical']),
  q('ihd-linux', '리눅스마스터', '한국정보통신진흥협회', '국가공인 민간자격', ['software'], 'linux-master'),
  q('icqa-network', '네트워크관리사', '한국정보통신자격협회', '국가공인 민간자격', ['software'], 'network-manager'),
  q('kacpta-computer-accounting', '전산회계', '한국세무사회', '국가공인 민간자격', ['business'], 'computer-accounting'),
  q('kacpta-computer-tax', '전산세무', '한국세무사회', '국가공인 민간자격', ['business'], 'computer-tax'),
  q('kicpa-fat', 'FAT 회계정보처리', '한국공인회계사회', '국가공인 민간자격', ['business']),
  q('kicpa-tat', 'TAT 세무정보처리', '한국공인회계사회', '국가공인 민간자격', ['business']),
  q('history', '한국사능력검정시험', '국사편찬위원회', '인증시험', ['general', 'business'], 'korean-history'),
  q('toeic', 'TOEIC', 'ETS·한국TOEIC위원회', '어학시험', ['general', 'business', 'service']),
  q('opic', 'OPIc', 'ACTFL·멀티캠퍼스', '어학시험', ['general', 'business', 'service']),
].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR', { sensitivity: 'base' }))

const text = value => String(value || '').trim()
const grade = value => Math.max(1, Math.min(3, Number(value) || 1))
const list = value => Array.isArray(value) ? value.filter(Boolean) : []

function normalizeQualification(item = {}, index = 0, currentGrade = 1) {
  const catalog = QUALIFICATION_CATALOG.find(value => value.id === item.catalogId)
  const knownStatus = !item.status ? 'preparing' : QUALIFICATION_STATUSES.some(status => status.id === item.status) ? item.status : 'custom'
  const inferredLevelKind = item.levelKind || (item.level ? (catalog?.levels?.includes(item.level) ? 'preset' : 'custom') : 'none')
  const validityType = QUALIFICATION_VALIDITY_TYPES.some(value => value.id === item.validityType)
    ? item.validityType
    : catalog?.validityType || 'none'
  return {
    ...item,
    id: item.id || `qualification-legacy-${index}`,
    name: text(item.name),
    issuer: text(item.issuer),
    status: knownStatus,
    statusDetail: knownStatus === 'custom' ? text(item.statusDetail || item.status) : text(item.statusDetail),
    level: text(item.level),
    levelKind: ['none', 'preset', 'custom'].includes(inferredLevelKind) ? inferredLevelKind : 'custom',
    validityType,
    validFrom: text(item.validFrom),
    validUntil: text(item.validUntil),
    validityMonths: Math.max(0, Math.min(240, Number(item.validityMonths ?? catalog?.validityMonths) || 0)),
    validityNote: text(item.validityNote || catalog?.validityNote),
    validitySource: text(item.validitySource || catalog?.validitySource),
    grade: grade(item.grade || currentGrade),
    achievedAt: text(item.achievedAt),
    targetDate: text(item.targetDate),
    proof: text(item.proof),
    notes: text(item.notes),
    profileId: text(item.profileId),
    catalogId: text(item.catalogId),
  }
}

function normalizeActivity(item = {}, index = 0, currentGrade = 1) {
  return {
    ...item,
    id: item.id || `activity-legacy-${index}`,
    category: EXTRACURRICULAR_CATEGORIES.some(category => category.id === item.category) ? item.category : 'other',
    customCategoryName: text(item.customCategoryName),
    name: text(item.name),
    organizer: text(item.organizer),
    rank: text(item.rank),
    role: text(item.role),
    outcome: text(item.outcome),
    notes: text(item.notes),
    proof: text(item.proof),
    period: text(item.period),
    hours: text(item.hours),
    grade: grade(item.grade || currentGrade),
    skills: list(item.skills).map(text).filter(Boolean).slice(0, 8),
    customFields: list(item.customFields).map((field, fieldIndex) => ({
      id: text(field?.id) || `custom-field-${fieldIndex}`,
      label: text(field?.label),
      value: text(field?.value),
    })).filter(field => field.label || field.value).slice(0, 10),
  }
}

export function qualificationStatusLabel(item = {}) {
  if (item.status === 'custom') return text(item.statusDetail) || '직접 입력 상태'
  return QUALIFICATION_STATUSES.find(status => status.id === item.status)?.label || text(item.status) || '준비 중'
}

export function qualificationCatalogDefaults(item = {}) {
  return {
    levelKind: item.levels?.length ? 'preset' : 'none',
    level: '',
    validityType: item.validityType || 'none',
    validityMonths: Number(item.validityMonths) || 0,
    validityNote: text(item.validityNote),
    validitySource: text(item.validitySource),
    validFrom: '',
    validUntil: '',
  }
}

export function extracurricularCategory(item = {}) {
  return EXTRACURRICULAR_CATEGORIES.find(category => category.id === item.category)
    || EXTRACURRICULAR_CATEGORIES.find(category => category.id === 'other')
}

export function extracurricularCategoryLabel(item = {}) {
  const category = extracurricularCategory(item)
  return item.category === 'other' && text(item.customCategoryName) ? text(item.customCategoryName) : category.label
}

function qualificationStrength(item = {}) {
  return (item.status === 'acquired' ? 40 : item.status === 'practicalPassed' ? 32 : item.status === 'writtenPassed' ? 27 : item.status === 'preparing' ? 22 : 10)
    + (item.profileId ? 8 : 0) + (item.proof ? 8 : 0) + (item.level ? 4 : 0) + (item.achievedAt || item.targetDate ? 4 : 0)
}

function activityStrength(item = {}) {
  return (item.outcome ? 24 : 0) + (item.role ? 18 : 0) + (item.proof ? 12 : 0)
    + (item.organizer ? 6 : 0) + (item.period ? 4 : 0) + Math.min(8, list(item.skills).length * 2)
}

export function normalizeCareerContext(value = {}) {
  const currentGrade = grade(value.currentGrade)
  const qualifications = list(value.qualifications).filter(item => item?.name).map((item, index) => normalizeQualification(item, index, currentGrade))
  const extracurricularActivities = list(value.extracurricularActivities).filter(item => item?.name).map((item, index) => normalizeActivity(item, index, currentGrade))
  return {
    ...value,
    profileVersion: CAREER_PROFILE_VERSION,
    currentGrade,
    majorGroup: value.majorGroup || 'general',
    departmentName: text(value.departmentName),
    targetIndustry: text(value.targetIndustry),
    targetRole: text(value.targetRole),
    semesterGoal: text(value.semesterGoal),
    lastReviewedAt: text(value.lastReviewedAt),
    styleId: value.styleId || 'clear',
    sourceType: value.sourceType || 'major-practice',
    certificateId: value.certificateId || '',
    qualifications,
    extracurricularActivities,
  }
}

export function careerContextForEngine(value = {}) {
  const context = normalizeCareerContext(value)
  const qualification = [...context.qualifications].sort((a, b) => qualificationStrength(b) - qualificationStrength(a))[0]
  const activity = [...context.extracurricularActivities].sort((a, b) => activityStrength(b) - activityStrength(a))[0]
  const category = EXTRACURRICULAR_CATEGORIES.find(item => item.id === activity?.category)
  return {
    ...context,
    certificateId: qualification?.profileId || context.certificateId || '',
    qualificationName: qualification?.name || '',
    qualificationIssuer: qualification?.issuer || '',
    qualificationStatus: qualification?.status || '',
    qualificationStatusLabel: qualificationStatusLabel(qualification),
    qualificationLevel: qualification?.level || '',
    qualificationValidUntil: qualification?.validUntil || '',
    qualificationSummary: context.qualifications.slice().sort((a, b) => qualificationStrength(b) - qualificationStrength(a)).slice(0, 3).map(item => `${item.name}${item.level ? ` ${item.level}` : ''}(${qualificationStatusLabel(item)})`),
    sourceType: category?.sourceType || context.sourceType || 'major-practice',
    activityName: activity?.name || '',
    activitySummary: context.extracurricularActivities.slice().sort((a, b) => activityStrength(b) - activityStrength(a)).slice(0, 3).map(item => [extracurricularCategoryLabel(item), item.name, item.role, item.outcome].filter(Boolean).join(' · ')),
    activityRole: activity?.role || '',
    activityOutcome: activity?.outcome || '',
    activityProof: activity?.proof || '',
  }
}

export function careerProfileReadiness(value = {}, { evidenceCount = 0 } = {}) {
  const context = normalizeCareerContext(value)
  const acquired = context.qualifications.filter(item => item.status === 'acquired')
  const detailedActivities = context.extracurricularActivities.filter(item => item.role && item.outcome)
  const provenActivities = context.extracurricularActivities.filter(item => item.proof)
  const representedGrades = new Set(context.extracurricularActivities.map(item => item.grade))
  const checks = [
    { id: 'direction', label: '진로 방향', score: (context.departmentName ? 7 : 0) + (context.targetRole ? 5 : 0) + (context.targetIndustry ? 3 : 0), max: 15 },
    { id: 'qualification', label: '자격 준비', score: Math.min(20, (context.qualifications.length ? 6 : 0) + (acquired.length ? 8 : 0) + (context.qualifications.some(item => item.targetDate || item.achievedAt) ? 3 : 0) + (context.qualifications.some(item => item.proof) ? 3 : 0)), max: 20 },
    { id: 'activity', label: '활동 기록', score: Math.min(30, (context.extracurricularActivities.length ? 8 : 0) + Math.min(12, detailedActivities.length * 6) + (provenActivities.length ? 5 : 0) + (representedGrades.size > 1 ? 5 : 0)), max: 30 },
    { id: 'evidence', label: '작성 근거', score: Math.min(25, Number(evidenceCount || 0) * 7 + (provenActivities.length ? 4 : 0)), max: 25 },
    { id: 'plan', label: '다음 계획', score: (context.semesterGoal ? 7 : 0) + (context.lastReviewedAt ? 3 : 0), max: 10 },
  ]
  const score = checks.reduce((sum, item) => sum + item.score, 0)
  const gaps = []
  if (!context.targetRole) gaps.push('관심 직무를 1개 이상 정하기')
  if (!context.qualifications.length) gaps.push('학과·직무 관련 자격 준비 일정 등록하기')
  else if (!context.qualifications.some(item => item.targetDate || item.achievedAt)) gaps.push('자격 취득일 또는 목표일 기록하기')
  if (!context.extracurricularActivities.length) gaps.push('수업·동아리·봉사에서 직접 한 활동 1개 기록하기')
  else if (!detailedActivities.length) gaps.push('활동에 내 역할과 확인 가능한 결과 보완하기')
  if (!provenActivities.length) gaps.push('파일·작업일지·교사 피드백 등 확인 자료 남기기')
  if (!evidenceCount) gaps.push('활동 하나를 상황·역할·행동·결과 근거 카드로 발전시키기')
  if (!context.semesterGoal) gaps.push('이번 학기 취업 준비 목표 한 가지 정하기')
  return {
    score,
    level: score >= 80 ? '지원 활용 가능' : score >= 55 ? '근거 강화 중' : score >= 30 ? '기록 축적 중' : '첫 기록 필요',
    checks,
    gaps: gaps.slice(0, 4),
    counts: {
      qualifications: context.qualifications.length,
      acquired: acquired.length,
      activities: context.extracurricularActivities.length,
      detailedActivities: detailedActivities.length,
      evidence: Number(evidenceCount || 0),
      grades: representedGrades.size,
    },
  }
}

export function careerGradeRoadmap(value = {}, { evidenceCount = 0 } = {}) {
  const context = normalizeCareerContext(value)
  const base = CAREER_GRADE_ROADMAP[context.currentGrade] || CAREER_GRADE_ROADMAP[1]
  const readiness = careerProfileReadiness(context, { evidenceCount })
  const qualifications = QUALIFICATION_CATALOG.filter(item => item.majorGroups.includes(context.majorGroup)).slice(0, 3).map(item => `${item.name} 필요성·일정 확인`)
  const majorActions = MAJOR_DEVELOPMENT_ACTIONS[context.majorGroup] || MAJOR_DEVELOPMENT_ACTIONS.general
  return {
    ...base,
    grade: context.currentGrade,
    nextActions: [...readiness.gaps, ...majorActions, ...qualifications].filter((item, index, array) => array.indexOf(item) === index).slice(0, 5),
  }
}

export function careerEvidenceSeeds(value = {}) {
  const context = normalizeCareerContext(value)
  return context.extracurricularActivities
    .slice()
    .sort((a, b) => activityStrength(b) - activityStrength(a))
    .map(item => {
      const category = extracurricularCategory(item)
      const customDetail = item.customFields.filter(field => field.label && field.value).map(field => `${field.label}: ${field.value}`).join(', ')
      return {
        id: item.id,
        careerSourceId: item.id,
        majorGroup: context.majorGroup,
        sourceType: item.category === 'other' && item.customCategoryName ? item.customCategoryName : category?.evidenceSource || '개인 학습',
        title: item.name,
        situation: [item.period ? `${item.period}에` : `${item.grade}학년에`, item.organizer ? `${item.organizer}에서` : '학교 활동에서', `${item.name}에 참여함.`, item.hours ? `기록 시간은 ${item.hours}입니다.` : '', customDetail ? `추가 기록은 ${customDetail}입니다.` : ''].filter(Boolean).join(' '),
        task: item.role ? `제가 맡은 역할은 ${item.role}입니다.` : '',
        action: '',
        result: [item.rank, item.outcome].filter(Boolean).join(' · '),
        proof: item.proof || '',
        skills: item.skills,
        grade: item.grade,
        occurredPeriod: item.period,
        missing: [!item.role && '내 역할', '직접 한 행동', !item.outcome && '확인 가능한 결과', !item.proof && '확인 자료'].filter(Boolean),
      }
    })
}

export function careerEvidenceQuality(item = {}) {
  const checks = [
    { id: 'situation', label: '상황', ok: text(item.situation).length >= 10 },
    { id: 'task', label: '내 역할', ok: text(item.task).length >= 8 },
    { id: 'action', label: '직접 행동', ok: text(item.action).length >= 15 },
    { id: 'result', label: '결과', ok: text(item.result).length >= 8 },
    { id: 'proof', label: '확인 자료', ok: text(item.proof).length >= 2 },
  ]
  const rawScore = checks.filter(item => item.ok).length * 20
  const actionReady = checks.find(item => item.id === 'action').ok
  const coreReady = checks.filter(item => ['situation', 'action', 'result'].includes(item.id)).every(item => item.ok)
  const score = coreReady ? rawScore : Math.min(rawScore, 60)
  const level = !actionReady
    ? '직접 행동 보완 필요'
    : !coreReady
      ? '핵심 근거 보완 필요'
      : score >= 100
        ? '검증 근거'
        : score >= 60
          ? '작성 활용 가능'
          : '기록 보완 필요'
  return { score, checks, level }
}

export function careerProfileSnapshot(value = {}, { evidenceCount = 0 } = {}) {
  const context = normalizeCareerContext(value)
  const readiness = careerProfileReadiness(context, { evidenceCount })
  const engine = careerContextForEngine(context)
  return {
    profileVersion: CAREER_PROFILE_VERSION,
    capturedAt: new Date().toISOString(),
    currentGrade: context.currentGrade,
    departmentName: context.departmentName,
    majorGroup: context.majorGroup,
    targetIndustry: context.targetIndustry,
    targetRole: context.targetRole,
    semesterGoal: context.semesterGoal,
    readiness,
    qualificationSummary: engine.qualificationSummary,
    activitySummary: engine.activitySummary,
    qualifications: context.qualifications,
    extracurricularActivities: context.extracurricularActivities,
  }
}

export function createRecordId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
