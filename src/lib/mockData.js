/**
 * 모의고사 범위(영역)·시험지 데이터. 교사(오픈 목록)·학생(응시 시험지 생성) 공유.
 */
import foodServiceBank, { examPriority } from './foodServiceBank.js'
import { ncs2026Questions as ncsQuestions } from './ncs2026.js'
import { recruitWrittenQuestions, RECRUIT_WRITTEN_TRACKS } from './recruitWritten.js'
import jobQuestions from '../../data/questions.json'
import areaMapping  from '../../data/areaMapping.json'
import foodVariantsFile from '../../data/food-service-variants.json'
import ncsVariantsFile  from '../../data/ncs-variants.json'
import jobVariantsFile  from '../../data/job-variants.json'
import qualityMock   from '../../data/mock-quality-pool.json'   // 경량 풀(HTML 제외) — scripts/build-mock-pools.cjs
import interviewMock from '../../data/mock-interview-pool.json'
import { buildMockPaper, MOCK_COUNT, MOCK_PAPERS } from './mockPaper.js'
import { englishStudyQuestions, jobCommonMediaQuestions, jcAssessmentQuestions, jcOfficialArea, JC_AREAS_ORDER } from './jobCommonAreas.js'
import { ncsKeyCompare } from './ncsAreaPriority.js'
import { COMMON_ABILITY_COURSES } from './officialStandards.js'
import { assessmentQuestions, assessmentQuestionsById } from './assessmentPartition.js'
import { INTERVIEW_CAREER_ASSESSMENT_QUESTIONS, INTERVIEW_CAREER_SCOPES } from './interviewCareerContent.js'
import { INTERVIEW_FOUNDATION_COURSES, interviewFoundationArea } from './interviewFoundationCourses.js'
import { questionPriorityWeight } from './questionPriority.js'
import independentAssessmentBank from '../../data/assessment-banks/interview.json'

const base = Array.isArray(jobQuestions) ? jobQuestions : (jobQuestions.questions || [])
// 직무적응은 정답 없는 전용 리커트 진단으로 제공하므로 지식형 시험지 풀에서 제외한다.
const jobPool = jcAssessmentQuestions(
  [...base, ...englishStudyQuestions, ...jobCommonMediaQuestions]
    .filter(q => jcOfficialArea(q) !== '직무적응')
)
const foodVariantMap = foodVariantsFile?.variants || {}
const ncsVariantMap  = ncsVariantsFile?.variants || {}
const jobVariantMap  = jobVariantsFile?.variants || {}

const FOOD_AREAS = [
  { key: 'C01', name: '식음료 영업 준비' }, { key: 'C02', name: '식음료 영업장 예약 관리' },
  { key: 'C03', name: '환영 환송' },        { key: 'C04', name: '식음료 주문' },
  { key: 'C05', name: '음료 서비스' },       { key: 'C06', name: '음식 서비스' },
  { key: 'C07', name: '식음료 영업장 마감' }, { key: 'C08', name: '식음료 영업장 위생·안전' },
]

// 직업공통 lessonId → 영역명
const lessonToArea = {}
for (const a of areaMapping.areas) for (const l of (a.lessons || [])) lessonToArea[l.id] = a.displayName

// 품질경영·면접스킬: 경량 풀(quiz만, area 태깅됨)
const qualityPool     = qualityMock.pool
const qualityScopes   = qualityMock.scopes
const interviewPool   = [
  ...assessmentQuestionsById(interviewMock.pool),
  ...INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
  ...(independentAssessmentBank.questions || []),
]
const interviewScopes = [
  ...INTERVIEW_FOUNDATION_COURSES.map(course => ({ key: course.label, name: course.label })),
  ...INTERVIEW_CAREER_SCOPES,
]

function cfg(subjectId) {
  if (subjectId === 'food-service')
    return { pool: foodServiceBank, areaKey: q => q.lessonId, weight: examPriority,
             scopes: FOOD_AREAS, variantMap: foodVariantMap }
  if (subjectId === 'ncs-basic') {
    const areas = [...new Set(ncsQuestions.filter(q => !q.excludeFromQuiz && q.area).map(q => q.area))].sort(ncsKeyCompare)
    return { pool: assessmentQuestions(ncsQuestions), areaKey: q => q.area, weight: q => questionPriorityWeight(q, 'ncs-basic'),
             scopes: areas.map(a => ({ key: a, name: a })), variantMap: ncsVariantMap }
  }
  if (subjectId === 'recruit-written')
    return {
      pool: assessmentQuestions(recruitWrittenQuestions),
      areaKey: q => q.recruitmentTrackLabel,
      weight: q => questionPriorityWeight(q, 'recruit-written'),
      scopes: RECRUIT_WRITTEN_TRACKS.map(track => ({ key: track.label, name: track.label })),
      variantMap: null,
    }
  if (subjectId === 'job-common')
    return { pool: jobPool,
             areaKey: q => jcOfficialArea({ id: q.id, area: q.area || lessonToArea[q.lessonId] }),
             weight: q => questionPriorityWeight(q, 'job-common'),
             scopes: JC_AREAS_ORDER.filter(a => a !== '직무적응').map(a => ({ key: a, name: a })),
             variantMap: jobVariantMap }
  if (subjectId === 'quality')
    return { pool: qualityPool, areaKey: q => q._mockArea, weight: () => 1,
             scopes: qualityScopes, variantMap: null }
  if (subjectId === 'interview')
    return { pool: interviewPool, areaKey: q => interviewFoundationArea(q._mockArea), weight: () => 1,
             scopes: interviewScopes, variantMap: null }
  return null
}

export const MOCK_SUBJECTS = [
  { id: 'job-common',   name: COMMON_ABILITY_COURSES['job-common'].title },
  { id: 'ncs-basic',    name: COMMON_ABILITY_COURSES['ncs-basic'].title },
  { id: 'recruit-written', name: '채용필기 심화·확장' },
  { id: 'interview',    name: '고졸 공정채용 면접' },
  { id: 'food-service', name: '식음료서비스' },
  { id: 'quality',      name: '품질경영' },
]

// 교사 오픈 목록용: [{ key, name, papers }] (전체 10회 + 각 영역 5회)
export function getMockScopes(subjectId) {
  const c = cfg(subjectId); if (!c) return []
  const selectable = selectableQuestions(c)
  const paperTotal = capacity => Math.max(1, Math.ceil(capacity / MOCK_COUNT))
  return [
    { key: '__all__', name: '전체 영역', papers: Math.max(MOCK_PAPERS.all, paperTotal(selectable.length)) },
    ...c.scopes.map(s => {
      const capacity = selectable.filter(question => c.areaKey(question) === s.key).length
      return { key: s.key, name: s.name, papers: Math.max(MOCK_PAPERS.area, paperTotal(capacity)) }
    }),
  ]
}

// 학생 응시용: (과목, 범위, 회차) → 30문항 시험지(결정적·빈출가중)
export function buildSubjectMockPaper(subjectId, scope, paperNo, count = MOCK_COUNT) {
  const c = cfg(subjectId); if (!c) return []
  return buildMockPaper(c.pool, scope, paperNo, {
    count, areaKey: c.areaKey, weight: c.weight, variantMap: c.variantMap,
  })
}

function selectableQuestions(c) {
  return c.pool.filter(q =>
    !q.excludeFromQuiz &&
    Array.isArray(q.choices) &&
    q.choices.length >= 2 &&
    /^[A-E]$/.test(q.answer || '')
  )
}

function unitOfQuestion(subjectId, q) {
  if (subjectId === 'ncs-basic') return q.ncsAbility || q.lessonTitle || q.lessonId || areaOfQuestion(subjectId, q)
  if (subjectId === 'recruit-written') return q.lessonTitle || q.lessonId || q.area || areaOfQuestion(subjectId, q)
  if (subjectId === 'job-common') return q.lessonTitle || q.lessonId || q.teenupBlueprint?.contentDomain || areaOfQuestion(subjectId, q)
  if (subjectId === 'food-service') return q.lessonTitle || q.lessonId || areaOfQuestion(subjectId, q)
  return q.lessonTitle || q.lessonId || q._mockArea || areaOfQuestion(subjectId, q)
}

const scopeKey = (level, area = '', unit = '') =>
  [level, encodeURIComponent(area), encodeURIComponent(unit)].join(':')

function parseScope(key = '__all__') {
  if (!key || key === '__all__') return { level: 'all', area: '', unit: '' }
  const [level, area = '', unit = ''] = String(key).split(':')
  return { level, area: decodeURIComponent(area), unit: decodeURIComponent(unit) }
}

/**
 * 진단 범위. 영역은 공식 과목 구분, 소단원은 문항 메타데이터의 학습 단위다.
 * 소단원은 최소 5문항이 확보된 경우만 노출해 1~2문항 점수를 진단처럼 보이지 않게 한다.
 */
export function getDiagnosticScopes(subjectId) {
  const c = cfg(subjectId)
  if (!c) return []
  const pool = selectableQuestions(c)
  const areas = new Map()
  for (const q of pool) {
    const area = areaOfQuestion(subjectId, q)
    const unit = unitOfQuestion(subjectId, q)
    if (!areas.has(area)) areas.set(area, { count: 0, units: new Map() })
    const rec = areas.get(area)
    rec.count++
    rec.units.set(unit, (rec.units.get(unit) || 0) + 1)
  }

  const rows = [{ key: '__all__', level: 'all', name: '전체 영역', area: '', unit: '', count: pool.length }]
  for (const [area, rec] of areas) {
    rows.push({ key: scopeKey('area', area), level: 'area', name: area, area, unit: '', count: rec.count })
    for (const [unit, count] of rec.units) {
      if (count < 5 || unit === area) continue
      rows.push({ key: scopeKey('unit', area, unit), level: 'unit', name: unit, area, unit, count })
    }
  }
  return rows
}

export function diagnosticGroupOfQuestion(subjectId, q) {
  return {
    area: areaOfQuestion(subjectId, q),
    unit: unitOfQuestion(subjectId, q),
    unitId: q.ncsAbility || q.lessonId || q._mockArea || q.lessonTitle || '',
  }
}

export function getMockScopeCapacity(subjectId, scope = '__all__') {
  const c = cfg(subjectId)
  if (!c) return 0
  const pool = selectableQuestions(c)
  return scope === '__all__' ? pool.length : pool.filter(q => c.areaKey(q) === scope).length
}

// 진단평가용: 문항의 영역 키(과목별 areaKey 적용)
export function areaOfQuestion(subjectId, q) {
  const c = cfg(subjectId)
  return (c ? (c.areaKey(q) || '기타') : '기타')
}

// 진단평가 시험지: 선택 범위 안에서 균형 샘플(결정적, 회차로 변형)
export function buildDiagnosticPaper(subjectId, attempt = 0, count = 40, scope = '__all__') {
  const c = cfg(subjectId)
  if (!c) return []
  const parsed = parseScope(scope)
  const selectable = selectableQuestions(c).filter(q => {
    if (parsed.level === 'all') return true
    if (areaOfQuestion(subjectId, q) !== parsed.area) return false
    return parsed.level !== 'unit' || unitOfQuestion(subjectId, q) === parsed.unit
  })
  return buildMockPaper(selectable, '__all__', 1000 + attempt, {
    count,
    areaKey: c.areaKey,
    weight: c.weight,
    variantMap: c.variantMap,
    seedScope: `diagnostic:${subjectId}:${scope}`,
  })
}

export { MOCK_COUNT, MOCK_PAPERS }
