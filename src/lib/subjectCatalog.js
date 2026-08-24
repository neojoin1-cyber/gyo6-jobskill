import { COMMON_ABILITY_COURSES } from './officialStandards.js'

// 교재(과목) 카탈로그 — 배정 UI 공용. 학생 CourseListScreen의 CATALOG와 id 일치.
export const SUBJECT_CATALOG = [
  { id: 'job-common',   name: COMMON_ABILITY_COURSES['job-common'].title, icon: '🏅' },
  { id: 'ncs-basic',    name: COMMON_ABILITY_COURSES['ncs-basic'].title,  icon: '📖' },
  { id: 'recruit-written', name: '채용필기 심화·확장', icon: '📝' },
  { id: 'interview',    name: '고졸 공정채용 면접', icon: '🎤' },
  { id: 'personality',  name: '인성검사',          icon: '🧭' },
]

/**
 * 앱에서 제외한 과목.
 *
 * 2026-08-20 식음료서비스·품질경영을 범위에서 뺐다. DB(subjects) 행과
 * 기존 배정(school_subjects·student_subjects)은 학습 기록 보존을 위해
 * 지우지 않고, 화면에서만 걸러낸다. 되살리려면 이 집합을 비우면 된다.
 */
export const RETIRED_SUBJECT_IDS = new Set(['food-service', 'quality'])

export const isActiveSubject = (s) =>
  !RETIRED_SUBJECT_IDS.has(typeof s === 'string' ? s : s?.id ?? s?.subject_id)

export const filterActiveSubjects = (list) => (list ?? []).filter(isActiveSubject)

/** 오답노트 과목 필터 칩. 손으로 적어 두면 은퇴한 과목이 남는다 —
 *  실제로 식음료서비스를 뺀 뒤에도 칩은 그대로 떠 있었다. 여기서 한 번에 거른다. */
export const WRONG_NOTE_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'job-common', label: '직업공통' },
  { id: 'ncs-basic', label: 'NCS' },
  { id: 'recruit-written', label: '채용필기' },
  { id: 'interview', label: '면접' },
  { id: 'food-service', label: '식음료' },
  { id: 'quality', label: '품질경영' },
].filter(f => f.id === 'all' || isActiveSubject(f.id))
