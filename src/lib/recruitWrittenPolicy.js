export const RECRUITMENT_EXTRA_AREA_IDS = [
  '금융상식',
  '경제상식',
  '경영상식',
  '일반상식',
  '인적성',
]

const EXTRA_AREA_SET = new Set(RECRUITMENT_EXTRA_AREA_IDS)

const RESOURCE_SUPPLEMENT_IDS = new Set([
  '045', '047', '048', '050', '052', '053', '055', '056', '057', '058',
])

const ORGANIZATION_LESSON_IDS = new Set(['C117', 'C118', 'C119', 'C120', 'C121', 'C124'])
const ORGANIZATION_EXCLUDED_IDS = new Set([
  'NCS-ORG-035',
  'NCS-ORG-040',
  'NCS-ORG-058',
  'NCS-ORG-063',
])

const TECHNICAL_LESSON_IDS = new Set(['C145', 'C146', 'C147', 'C148'])
const TECHNICAL_EXCLUDED_IDS = new Set([
  'NCS-TECH-014',
  'NCS-TECH-016',
  'NCS-TECH-019',
  'NCS-TECH-024',
  'NCS-TECH-026',
  'NCS-TECH-027',
  'NCS-TECH-032',
  'NCS-TECH-040',
  'NCS-TECH-041',
])

const CUSTOMER_SERVICE_IDS = new Set([
  'NCS-C137-diagnosis',
  'NCS-C138-diagnosis',
  'NCS-INT-016',
  'NCS-INT-017',
  'NCS-INT-025',
  'NCS-INT-026',
  'NCS-INT-031',
  'NCS-INT-033',
])

function supplementNumber(q) {
  return String(q.id || '').match(/-(\d{3})$/)?.[1] ?? null
}

export function recruitResidualKind(q) {
  if (q.area === '자원관리' || q.area === '자원관리능력') {
    if (['C113', 'C114', 'C115', 'C116'].includes(q.lessonId)) return 'resource-allocation'
    if (q.lessonId?.endsWith('NEW') && RESOURCE_SUPPLEMENT_IDS.has(supplementNumber(q))) {
      return 'resource-allocation'
    }
  }

  if (q.area === '조직이해' || q.area === '조직이해능력') {
    if (ORGANIZATION_LESSON_IDS.has(q.lessonId)) return 'organization-understanding'
    if (q.lessonId === '조직이해NEW') return 'organization-understanding'
    if (/^NCS-ORG-\d{3}$/.test(q.id) && !ORGANIZATION_EXCLUDED_IDS.has(q.id)) {
      return 'organization-understanding'
    }
  }

  if (q.area === '기술능력') {
    if (TECHNICAL_LESSON_IDS.has(q.lessonId)) return 'technical-foundation'
    if (/^NCS-TECH-\d{3}$/.test(q.id) && !TECHNICAL_EXCLUDED_IDS.has(q.id)) {
      return 'technical-foundation'
    }
  }

  if ((q.area === '대인관계' || q.area === '대인관계능력') && CUSTOMER_SERVICE_IDS.has(q.id)) {
    return 'customer-service-negotiation'
  }

  return null
}

export function recruitmentTrackIds(q) {
  if (q.area === '인적성') return ['enterprise']
  if (EXTRA_AREA_SET.has(q.area)) return ['finance']

  switch (recruitResidualKind(q)) {
    case 'resource-allocation':
      return ['public', 'finance']
    case 'organization-understanding':
      return ['public']
    case 'technical-foundation':
      return ['public', 'enterprise']
    case 'customer-service-negotiation':
      return ['public', 'finance', 'enterprise']
    default:
      return []
  }
}

export function isCurrentNcsQuestion(q) {
  return !EXTRA_AREA_SET.has(q.area) && !recruitResidualKind(q)
}
