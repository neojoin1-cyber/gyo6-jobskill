import {
  EXTRACURRICULAR_CATEGORIES,
  QUALIFICATION_CATALOG,
  QUALIFICATION_STATUSES,
  QUALIFICATION_VALIDITY_TYPES,
  careerContextForEngine,
  extracurricularCategoryLabel,
  normalizeCareerContext,
  qualificationStatusLabel,
} from '../src/lib/careerProfile.js'
import { hifiveDepartment, hifiveDepartmentOptions, searchHifiveDepartments } from '../src/lib/hifiveDepartmentCatalog.js'

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }
const departments = hifiveDepartmentOptions({ includeExpansion: true })

expect(departments.length >= 1200, `전체 학과 목록 부족: ${departments.length}`)
expect(departments.every((item, index) => index === 0 || departments[index - 1].name.localeCompare(item.name, 'ko-KR', { sensitivity: 'base' }) <= 0), '학과 목록 가나다 정렬 실패')
expect(searchHifiveDepartments('스마트', { limit: 100 }).every(item => item.name.includes('스마트')), '학과 이름 중간 포함검색 실패')
expect(hifiveDepartment(' 스마트 기계과 ')?.majorGroup === 'mechanical', '공백을 포함한 학과 직접입력 인식 실패')

expect(QUALIFICATION_CATALOG.length >= 70, `자격 사전 부족: ${QUALIFICATION_CATALOG.length}`)
expect(new Set(QUALIFICATION_CATALOG.map(item => item.id)).size === QUALIFICATION_CATALOG.length, '자격 사전 ID 중복')
expect(QUALIFICATION_CATALOG.every(item => item.name && item.issuer && item.type), '자격 명칭·기관·유형 누락')
for (const issuer of ['대한상공회의소', '한국산업인력공단', '한국생산성본부']) {
  expect(QUALIFICATION_CATALOG.some(item => item.issuer === issuer), `${issuer} 자격 사전 누락`)
}

const legacy = normalizeCareerContext({ majorGroup: 'electrical', departmentName: '전기과', certificateId: 'electrician', sourceType: 'major-practice' })
expect(legacy.certificateId === 'electrician' && Array.isArray(legacy.qualifications), '기존 단일 자격 데이터 호환 실패')
const expanded = careerContextForEngine({
  ...legacy,
  qualifications: [{ id: 'q1', name: '전기기능사', issuer: '한국산업인력공단', profileId: 'electrician' }],
  extracurricularActivities: [{ id: 'a1', category: 'competition', name: '기능경기대회' }],
})
expect(expanded.certificateId === 'electrician' && expanded.qualificationName === '전기기능사', '복수 자격의 맞춤 엔진 연결 실패')
expect(expanded.sourceType === 'team-project' && expanded.activityName === '기능경기대회', '교과외활동의 맞춤 엔진 연결 실패')
for (const status of ['preparing', 'writtenPassed', 'practicalPassed', 'acquired', 'custom']) {
  expect(QUALIFICATION_STATUSES.some(item => item.id === status), `자격 진행 상태 누락: ${status}`)
}
expect(QUALIFICATION_VALIDITY_TYPES.map(item => item.id).join(',') === 'none,expires,check', '자격 유효기간 유형 계약 실패')
expect(QUALIFICATION_CATALOG.find(item => item.id === 'kcci-computer-skills')?.levels.join(',') === '1급,2급', '컴퓨터활용능력 급수 추천 누락')
expect(QUALIFICATION_CATALOG.find(item => item.id === 'kpc-itq')?.levels.join(',') === 'A등급,B등급,C등급', 'ITQ 등급 추천 누락')
expect(QUALIFICATION_CATALOG.find(item => item.id === 'toeic')?.validityMonths === 24, 'TOEIC 2년 유효기간 추천 누락')
expect(QUALIFICATION_CATALOG.find(item => item.id === 'toeic')?.validitySource?.startsWith('https://'), 'TOEIC 공식 유효기간 출처 누락')
expect(QUALIFICATION_CATALOG.find(item => item.id === 'opic')?.validitySource?.startsWith('https://'), 'OPIc 공식 유효기간 출처 누락')
expect(EXTRACURRICULAR_CATEGORIES.length >= 10, `교과외활동 구분 부족: ${EXTRACURRICULAR_CATEGORIES.length}`)
for (const category of ['club', 'volunteer', 'competition', 'award', 'project', 'leadership', 'careerExperience', 'fieldPractice', 'workExperience', 'other']) {
  const item = EXTRACURRICULAR_CATEGORIES.find(value => value.id === category)
  expect(item?.nameLabel && item?.organizerLabel && item?.roleLabel && item?.outcomeLabel, `활동별 입력 안내 누락: ${category}`)
}

const detailed = normalizeCareerContext({
  qualifications: [{ name: '직접 만든 자격', issuer: '학교', status: '서류 확인 중', statusDetail: '서류 확인 중', level: '심화', levelKind: 'custom', validityType: 'expires', validFrom: '2026-01-01', validUntil: '2027-01-01' }],
  extracurricularActivities: [{ category: 'other', customCategoryName: '교내 방송 제작', name: '졸업 영상', customFields: [{ label: '담당 장비', value: '카메라' }] }],
})
expect(detailed.qualifications[0].status === 'custom' && qualificationStatusLabel(detailed.qualifications[0]) === '서류 확인 중', '직접 입력 자격 상태 보존 실패')
expect(detailed.qualifications[0].level === '심화' && detailed.qualifications[0].validUntil === '2027-01-01', '직접 급수·유효기간 보존 실패')
expect(extracurricularCategoryLabel(detailed.extracurricularActivities[0]) === '교내 방송 제작', '직접 활동 구분명 보존 실패')
expect(detailed.extracurricularActivities[0].customFields[0].value === '카메라', '활동 추가 입력칸 보존 실패')

if (failures.length) {
  failures.forEach(message => console.error(`[career-profile] FAIL: ${message}`))
  process.exit(1)
}

console.log(`[career-profile] PASS - 학과 ${departments.length}개 가나다·포함검색 · 자격 ${QUALIFICATION_CATALOG.length}개 · 복수 활동/기존 데이터/맞춤 엔진 연결`)
