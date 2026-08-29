export const CAREER_CONTEXT_KEY = 'iv_personalized_example_context'

export const QUALIFICATION_STATUSES = [
  { id: 'preparing', label: '준비 중' },
  { id: 'acquired', label: '취득' },
  { id: 'planned', label: '준비 예정' },
]

export const EXTRACURRICULAR_CATEGORIES = [
  { id: 'club', label: '동아리', sourceType: 'club' },
  { id: 'volunteer', label: '봉사활동', sourceType: 'volunteer' },
  { id: 'competition', label: '대회', sourceType: 'team-project' },
  { id: 'award', label: '수상', sourceType: 'team-project' },
  { id: 'other', label: '기타', sourceType: 'major-practice' },
]

const q = (id, name, issuer, type, majorGroups = [], profileId = '') => ({ id, name, issuer, type, majorGroups, profileId })

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

export function normalizeCareerContext(value = {}) {
  const qualifications = Array.isArray(value.qualifications) ? value.qualifications.filter(item => item?.name) : []
  const extracurricularActivities = Array.isArray(value.extracurricularActivities) ? value.extracurricularActivities.filter(item => item?.name) : []
  return {
    ...value,
    majorGroup: value.majorGroup || 'general',
    departmentName: value.departmentName || '',
    styleId: value.styleId || 'clear',
    sourceType: value.sourceType || 'major-practice',
    certificateId: value.certificateId || '',
    qualifications,
    extracurricularActivities,
  }
}

export function careerContextForEngine(value = {}) {
  const context = normalizeCareerContext(value)
  const qualification = context.qualifications[0]
  const activity = context.extracurricularActivities[0]
  const category = EXTRACURRICULAR_CATEGORIES.find(item => item.id === activity?.category)
  return {
    ...context,
    certificateId: qualification?.profileId || context.certificateId || '',
    qualificationName: qualification?.name || '',
    qualificationIssuer: qualification?.issuer || '',
    sourceType: category?.sourceType || context.sourceType || 'major-practice',
    activityName: activity?.name || '',
  }
}

export function createRecordId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
