import {
  EXTRACURRICULAR_CATEGORIES,
  QUALIFICATION_CATALOG,
  careerContextForEngine,
  normalizeCareerContext,
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
expect(EXTRACURRICULAR_CATEGORIES.map(item => item.id).join(',') === 'club,volunteer,competition,award,other', '교과외활동 5개 구분 계약 실패')

if (failures.length) {
  failures.forEach(message => console.error(`[career-profile] FAIL: ${message}`))
  process.exit(1)
}

console.log(`[career-profile] PASS - 학과 ${departments.length}개 가나다·포함검색 · 자격 ${QUALIFICATION_CATALOG.length}개 · 복수 활동/기존 데이터/맞춤 엔진 연결`)
