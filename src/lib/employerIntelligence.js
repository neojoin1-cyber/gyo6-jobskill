import {
  activityExampleProfile,
  certificateOptions,
  departmentSpecialtyProfile,
  majorExampleProfile,
} from './personalizedCareerExamples.js'
import { userLocalStorage as localStorage } from './userLocalStorage.js'
import { careerContextForEngine } from './careerProfile.js'

const SOURCE_REGISTRY = {
  finance: {
    label: '금융기관 공식 자료와 은행연합회',
    url: 'https://www.kfb.or.kr/',
    caution: '금융소비자 보호·직무 정보는 해당 회사의 현재 채용공고를 마지막으로 확인함.',
  },
  public: {
    label: '기관 공식 자료와 JOB-ALIO',
    url: 'https://job.alio.go.kr/orginfo.do',
    caution: '기관 지정 유형과 고졸 채용 직무는 JOB-ALIO의 현재 공고를 마지막으로 확인함.',
  },
  enterprise: {
    label: '기업 공식 자료와 KRX 공시',
    url: 'https://kind.krx.co.kr/',
    caution: '사업·지속가능경영 정보는 최근 공시와 현재 채용공고를 함께 확인함.',
  },
}

const MAJOR_MATCH_RULES = [
  { id: 'business', pattern: /금융|은행|보험|증권|회계|고객|사무|행정|영업|자산|심사|보증|무역|유통|물류/ },
  { id: 'software', pattern: /IT|정보|디지털|데이터|소프트웨어|보안|통신|AI|클라우드|전산|자동화/ },
  { id: 'electrical', pattern: /전기|전자|계측|전력|통신|반도체|디스플레이|제어/ },
  { id: 'mechanical', pattern: /기계|정비|생산|설비|자동차|철도|조선|용접|가공|품질|공정|항공/ },
  { id: 'architecture', pattern: /건축|토목|시설|도시|주택|건설|측량|인프라/ },
  { id: 'food', pattern: /식품|조리|제과|위생|농수산|농식품/ },
  { id: 'service', pattern: /관광|호텔|고객|서비스|항공|공항|여객|콘텐츠/ },
  { id: 'design', pattern: /디자인|콘텐츠|미디어|마케팅|시각/ },
  { id: 'bio', pattern: /바이오|의약|보건|보험|복지|환경|화학|시험|검사/ },
]

function inferMajorGroup(departmentName = '') {
  const value = String(departmentName)
  const rules = [
    ['business', /경영|회계|세무|금융|상업|무역|유통|마케팅|사무/],
    ['software', /소프트웨어|정보|컴퓨터|인공지능|빅데이터|게임|IT|AI|네트워크/i],
    ['electrical', /전기|전자|반도체|디스플레이|제어|통신/],
    ['mechanical', /기계|자동차|로봇|메카|금형|가공|용접|조선|설비/],
    ['architecture', /건축|토목|건설|측량|공간/],
    ['food', /조리|식품|제과|제빵|외식/],
    ['service', /관광|호텔|항공|서비스/],
    ['design', /디자인|미용|콘텐츠|영상|애니|패션/],
    ['bio', /보건|간호|바이오|생명|화학|제약/],
  ]
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'general'
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function inferredThemes(organization) {
  return unique([
    organization.values?.[0],
    organization.roles?.[0],
    organization.sector === 'public'
      ? '공공서비스와 사회적 가치'
      : organization.sector === 'finance'
        ? '금융소비자 보호와 신뢰'
        : '고객 품질과 지속가능한 생산',
  ]).slice(0, 3)
}

export function buildEmployerIntelligence(organization) {
  const source = SOURCE_REGISTRY[organization.sector]
  const themes = organization.themes?.length ? organization.themes : inferredThemes(organization)
  return {
    sourceLevel: organization.themes?.length ? '확장 검증' : '핵심 검증',
    source,
    themes,
    timeline: [
      {
        year: '2024',
        title: '사업·고객의 변화 확인',
        detail: `${themes[0]} 관련 사업이 공식 연차자료에서 어떻게 설명됐는지 확인하고, 일회성 홍보 문장과 지속된 방향을 구분함.`,
        status: '연차 비교',
      },
      {
        year: '2025',
        title: '인재상·직무 요구 연결',
        detail: `${themes[1]} 요구가 채용공고의 실제 업무·자격·전형에서 어떻게 나타났는지 근거 문장을 저장함.`,
        status: '직무 비교',
      },
      {
        year: '2026',
        title: '현재 공고로 최종 갱신',
        detail: `${themes[2]} 관점에서 현재 채용공고와 최신 공식 보고서를 다시 확인한 뒤 지원 문장에 사용함.`,
        status: '최신 확인',
      },
    ],
    provenance: [
      { label: `${organization.name} 공식 사이트`, url: organization.officialUrl, kind: '기관·기업 원문' },
      { label: source.label, url: source.url, kind: '교차 확인' },
    ],
    notice: `이 화면의 문장은 공식 원문 인용이 아니라 지원 준비를 위한 분석임. ${source.caution}`,
  }
}

export function readEmployerStudentContext() {
  let personalized = {}
  try {
    personalized = JSON.parse(localStorage.getItem('iv_personalized_example_context') || '{}')
  } catch { /* 맞춤 설정 없이 근거은행을 확인함 */ }
  let evidence = null
  let draft = {}
  try {
    const items = JSON.parse(localStorage.getItem('iv_cover_evidence_cache_v2') || '[]')
    evidence = Array.isArray(items) ? items[0] : null
  } catch { /* 저장 근거 없음 */ }
  try { draft = JSON.parse(localStorage.getItem('iv_cover_draft') || '{}') } catch { /* 작성 초안 없음 */ }
  const career = careerContextForEngine(personalized)
  const departmentName = career.departmentName || draft.major || ''
  const hasStudentData = Boolean(career.majorGroup || departmentName || career.certificateId || career.qualificationName || career.sourceType || career.activityName || evidence)
  return {
    ...career,
    hasStudentData,
    departmentName,
    majorGroup: career.majorGroup || evidence?.majorGroup || inferMajorGroup(departmentName),
    sourceType: career.sourceType || evidence?.sourceType || '',
    certificateId: career.certificateId || '',
    qualificationName: career.qualificationName || '',
    qualificationIssuer: career.qualificationIssuer || '',
    activityName: career.activityName || '',
    evidenceTitle: evidence?.title || '',
    evidenceSkills: Array.isArray(evidence?.skills) ? evidence.skills : [],
    evidenceAction: evidence?.action || '',
    evidenceResult: evidence?.result || '',
  }
}

function matchingMajorIds(organization) {
  const corpus = `${organization.group} ${organization.identity} ${(organization.roles || []).join(' ')} ${(organization.values || []).join(' ')} ${(organization.intelligence?.themes || []).join(' ')}`
  return MAJOR_MATCH_RULES.filter(item => item.pattern.test(corpus)).map(item => item.id)
}

export function buildEmployerFit(organization, context = {}) {
  const major = majorExampleProfile(context.majorGroup || 'general')
  const specialty = departmentSpecialtyProfile(context.departmentName || '')
  const activity = activityExampleProfile(context.sourceType || 'major-practice')
  const certificate = certificateOptions(context.majorGroup || 'general').find(item => item.id === context.certificateId)
    || (context.qualificationName ? { label: context.qualificationName, competency: `${context.qualificationIssuer ? `${context.qualificationIssuer}의 ` : ''}시험 기준을 과제에 적용하는 연습` } : null)
  const matchingIds = matchingMajorIds(organization)
  const majorMatched = context.majorGroup && matchingIds.includes(context.majorGroup)
  const specialtyCorpus = `${specialty?.role || ''} ${specialty?.field || ''}`
  const specialtyMatched = Boolean(specialtyCorpus && organization.roles.some(role => specialtyCorpus.includes(role.split('·')[0]) || role.includes((specialty?.role || '').split('·')[0])))
  const hasEvidence = Boolean(context.evidenceTitle || context.evidenceAction || context.evidenceResult)
  const score = Math.min(96, 54 + (majorMatched ? 18 : 0) + (specialtyMatched ? 8 : 0) + (certificate ? 8 : 0) + (context.sourceType ? 6 : 0) + (hasEvidence ? 6 : 0))
  const level = score >= 82 ? '근거 연결 좋음' : score >= 68 ? '연결 가능' : '직무 확인 필요'
  const role = organization.roles.find(item => {
    const rule = MAJOR_MATCH_RULES.find(entry => entry.id === context.majorGroup)
    return rule?.pattern.test(item)
  }) || organization.roles[0]
  const studentBase = context.departmentName || major.label
  const matches = unique([
    majorMatched || specialtyMatched ? `${studentBase}에서 익힌 ${specialty?.field || major.field}을 ${role} 직무와 연결할 수 있음.` : `${studentBase}의 수행 경험 중 ${role} 업무와 닮은 작업을 먼저 찾아야 함.`,
    certificate ? `${certificate.label} 준비 과정은 자격 명칭보다 “${certificate.competency}” 행동으로 설명할 수 있음.` : null,
    hasEvidence ? `근거은행의 “${context.evidenceTitle || activity.label}”에서 ${context.evidenceSkills?.join('·') || '직접 한 행동'}과 ${context.evidenceResult || '확인 가능한 결과'}를 꺼내 쓸 수 있음.` : context.sourceType ? `${activity.label} 경험에서 맡은 역할·사용 도구·확인 가능한 결과를 근거로 사용할 수 있음.` : null,
  ])
  const gaps = unique([
    `현재 채용공고에서 ${role} 직무의 지원 자격과 우대 자격증을 다시 확인함.`,
    `공식 자료에서 “${organization.intelligence.themes[0]}”을 보여 주는 사업·서비스 한 가지를 저장함.`,
    certificate ? '자격증 취득 사실만 쓰지 말고 실제로 적용한 과제와 결과를 한 문장으로 보완함.' : `${major.certificates[0]?.label || '직무 관련 자격'} 준비 필요성을 확인하고 학습 계획을 정함.`,
  ])
  return {
    score,
    level,
    role,
    matches,
    gaps,
    studentLabel: studentBase,
    draftBridge: hasEvidence
      ? `${context.evidenceTitle || studentBase}에서 ${context.evidenceAction || '[직접 한 행동]'} 그 결과 ${context.evidenceResult || '[확인 가능한 결과]'} 이 경험을 ${organization.name}의 ${organization.intelligence.themes[0]} 방향과 연결해 지원 이유를 설명합니다.`
      : `${studentBase}에서 ${role}에 가까운 작업을 맡아 [사용 도구]로 [기준]을 확인했고 [결과]를 만들었습니다. 이 경험을 ${organization.name}의 ${organization.intelligence.themes[0]} 방향과 연결해 지원 이유를 설명합니다.`,
  }
}
