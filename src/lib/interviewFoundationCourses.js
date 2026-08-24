export const INTERVIEW_FOUNDATION_COURSES = [
  {
    id: 'interview-foundation',
    label: '면접 이해와 전형 준비',
    description: '절차와 평가 기준을 알고 준비 순서를 세움',
    categories: ['오리엔테이션', '면접절차', '평가기준'],
  },
  {
    id: 'self-introduction',
    label: '자기소개와 지원동기',
    description: '나의 근거와 지원처를 연결해 첫 답변을 완성함',
    categories: ['자기소개', '지원동기'],
  },
  {
    id: 'experience-character',
    label: '경험·인성 답변',
    description: '실제 행동과 결과로 역량과 태도를 증명함',
    categories: ['경험답변', '인성면접'],
  },
  {
    id: 'blind-situation',
    label: '블라인드와 상황 판단',
    description: '편견 정보는 빼고 원칙에 따라 상황에 답함',
    categories: ['블라인드', '상황면접', '직장태도', '블라인드 안전'],
  },
  {
    id: 'presentation-discussion',
    label: '발표·토론 면접',
    description: '주장과 근거를 구조화하고 함께 결론을 만듦',
    categories: ['PT/발표', '토론/그룹'],
  },
  {
    id: 'job-simulation',
    label: '직무·실전 완성',
    description: '직무 답변부터 모의면접과 준비 루틴까지 점검함',
    categories: ['직무면접', '모의면접', '준비 루틴'],
  },
]

const COURSE_BY_ID = Object.fromEntries(INTERVIEW_FOUNDATION_COURSES.map(course => [course.id, course]))
const COURSE_BY_CATEGORY = Object.fromEntries(
  INTERVIEW_FOUNDATION_COURSES.flatMap(course => course.categories.map(category => [category, course])),
)

export function interviewFoundationCourseById(courseId) {
  return COURSE_BY_ID[courseId] ?? null
}

export function interviewFoundationCourseForCategory(category) {
  return COURSE_BY_CATEGORY[category] ?? null
}

export function interviewFoundationArea(category) {
  return interviewFoundationCourseForCategory(category)?.label ?? category
}

export function interviewFoundationCategories(courseId) {
  return interviewFoundationCourseById(courseId)?.categories ?? []
}
