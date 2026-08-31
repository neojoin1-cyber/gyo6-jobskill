import { STUDENT_CAMPUS_HALLS, campusCourseTarget } from '../src/lib/studentCampusRoutes.js'

const expected = new Map([
  ['교육부 직업공통능력관', 'job-common'],
  ['NCS 직업기초능력관', 'ncs-basic'],
  ['채용필기 심화관', 'recruit-written'],
  ['인성검사훈련관', 'personality'],
  ['면접 스킬관', 'interview'],
  ['자기소개서관', 'cover-letter'],
])

const failures = []
if (STUDENT_CAMPUS_HALLS.length !== expected.size) {
  failures.push(`학습관 수 불일치: ${STUDENT_CAMPUS_HALLS.length}/${expected.size}`)
}

for (const hall of STUDENT_CAMPUS_HALLS) {
  const wanted = expected.get(hall.label)
  const target = campusCourseTarget(hall.id)
  if (!wanted) failures.push(`알 수 없는 학습관: ${hall.label}`)
  if (hall.id !== wanted) failures.push(`${hall.label} 목적지 오류: ${hall.id} != ${wanted}`)
  if (target?.subject !== wanted || target?.mode !== null) {
    failures.push(`${hall.label} 화면 진입 규약 오류: ${JSON.stringify(target)}`)
  }
}

const destinations = new Set(STUDENT_CAMPUS_HALLS.map(hall => hall.id))
if (destinations.size !== expected.size) failures.push('둘 이상의 학습관이 같은 과목으로 연결됨')
if (campusCourseTarget(null) !== null) failures.push('전체 과목 진입은 특정 과목으로 고정되면 안 됨')

if (failures.length) {
  console.error(`[학생내비게이션] 실패 ${failures.length}건`)
  failures.forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

console.log(`[학생내비게이션] 통과 — ${STUDENT_CAMPUS_HALLS.length}개 학습관 목적지 독립`)
