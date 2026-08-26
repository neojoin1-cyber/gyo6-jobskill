import { demoClassLessonJourney, summarizeClassLessonJourney } from '../src/lib/classLessonJourney.js'
import { buildStudentLearningRoutes, rememberStudentLearningContext } from '../src/lib/studentLearningJourney.js'

const store = new Map()
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const empty = summarizeClassLessonJourney([])
assert(empty.subjects.length === 6, '빈 학급에도 6개 학습관 안내가 필요함')
assert(empty.subjects.every(subject => subject.status === '수업 전'), '빈 학급 상태가 수업 전이 아님')

const firstClass = demoClassLessonJourney('c1')
const secondClass = demoClassLessonJourney('c2')
const newClass = demoClassLessonJourney('c3')
assert(firstClass.touchedSubjects === 2 && firstClass.next.id === 'interview', '3학년 2반 최근 수업 요약 오류')
assert(secondClass.touchedSubjects === 1 && secondClass.next.id === 'ncs-basic', '2학년 취업반 최근 수업 요약 오류')
assert(newClass.touchedSubjects === 0 && newClass.subjects.every(subject => subject.status === '수업 전'), '신규 학급 첫 수업 요약 오류')
const detailed = summarizeClassLessonJourney([], [
  { subject_id: 'ncs-basic', area_id: '의사소통능력', lesson_id: '문서소통능력', last_focus: { subject: 'ncs-basic', mode: 'study', area: '의사소통능력', lesson: '문서소통능력', label: '문서소통능력' }, updated_at: '2026-08-26T01:00:00Z', completed_at: null },
  { subject_id: 'ncs-basic', area_id: '의사소통능력', lesson_id: '경청능력', last_focus: { subject: 'ncs-basic', mode: 'study', area: '의사소통능력', lesson: '경청능력', label: '경청능력' }, updated_at: '2026-08-25T01:00:00Z', completed_at: '2026-08-25T02:00:00Z' },
])
const detailedNcs = detailed.subjects.find(subject => subject.id === 'ncs-basic')
assert(detailedNcs.completedCount === 1 && detailedNcs.inProgressCount === 1, '학급 단원별 완료·진행 집계 오류')
assert(detailedNcs.nextLabel === '문서소통능력' && detailed.next.id === 'ncs-basic', '학급 다음 차시 복원 오류')

let student = buildStudentLearningRoutes([])
assert(student.length === 6 && student.every(route => route.goal && route.nextLabel), '학생 6과목 목표·다음 학습 누락')
assert(student.find(route => route.id === 'ncs-basic').target.lesson === '문서소통능력', 'NCS 첫 단원 딥링크 오류')
const recruit = student.find(route => route.id === 'recruit-written')
assert(recruit.target.track === 'public' && recruit.target.lesson === '자원의 종류와 특성 이해', '채용필기 첫 트랙·단원 딥링크 오류')

rememberStudentLearningContext({ subject: 'ncs-basic', stage: 'area-choice', areaId: null })
student = buildStudentLearningRoutes([])
assert(student.find(route => route.id === 'ncs-basic').hasResume === false, '영역 선택 화면을 학습 위치로 잘못 저장함')
rememberStudentLearningContext({ subject: 'ncs-basic', mode: 'study', stage: 'concept', areaId: '의사소통능력', lessonId: '문서소통능력', lessonLabel: '문서소통능력' })
student = buildStudentLearningRoutes([{ subject_id: 'ncs-basic', pct: 24, sections_done: 2, sections_total: 7 }])
const resumed = student.find(route => route.id === 'ncs-basic')
assert(resumed.hasResume && resumed.target.lesson === '문서소통능력' && resumed.pct === 24, '학생 마지막 단원 이어하기 오류')

console.log('PASS guidance routes: 3개 학급 전환 · 단원별 완료/진행/다음 차시 · 학생 6과목 목표/이어하기')
