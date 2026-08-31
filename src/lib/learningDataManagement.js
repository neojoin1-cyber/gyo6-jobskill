import { clearUserStorageMatching, userLocalStorage } from './userLocalStorage.js'

export const LEARNING_DATA_GROUPS = [
  { id: 'job-common', label: '교육부 직업공통능력 인증', detail: '학습·진단·인증 모의 기록' },
  { id: 'ncs-basic', label: 'NCS 직업기초능력', detail: '문항·단원 진행' },
  { id: 'recruit-written', label: '채용필기 심화·확장', detail: '지원처별 추가 필기 진행' },
  { id: 'personality', label: '인성검사', detail: '진단·연습 기록' },
  { id: 'interview', label: '면접', detail: '학습 진행·답변 초안' },
  { id: 'cover-letter', label: '자기소개서', detail: '지원서·근거 보관함' },
]

function removeSubjectFromQuestionProgress(subjectId) {
  try {
    const data = JSON.parse(userLocalStorage.getItem('nova_qprog_v1') || '{}')
    if (!(subjectId in data)) return
    delete data[subjectId]
    userLocalStorage.setItem('nova_qprog_v1', JSON.stringify(data))
  } catch { /* 손상된 데이터는 다른 과목 보호를 위해 그대로 둔다 */ }
}

export function resetLearningGroup(subjectId) {
  removeSubjectFromQuestionProgress(subjectId)
  const escaped = String(subjectId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const common = [
    new RegExp(`^nova_unit_${escaped}_v1$`),
    new RegExp(`^diag_history.*${escaped}`),
    new RegExp(`^sst\\.learning.*${escaped}`),
  ]
  if (subjectId === 'interview') common.push(/^iv_(?!cover_)/, /^sst\.interview/)
  if (subjectId === 'cover-letter') common.push(/^iv_cover_/, /^iv_saved_orgs$/, /^iv_org_/)
  if (subjectId === 'personality') common.push(/^sst\.personality/, /^job_adaptation/)
  if (subjectId === 'quality') common.push(/^qm_quest_v1$/)
  clearUserStorageMatching(common)
}
