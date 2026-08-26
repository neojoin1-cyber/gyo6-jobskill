import fs from 'node:fs'
import { SUBJECT_CATALOG, WRONG_NOTE_FILTERS, filterActiveSubjects } from '../src/lib/subjectCatalog.js'

const read = path => fs.readFileSync(path, 'utf8')
const json = path => JSON.parse(read(path))
const failures = []
const retired = new Set(['food-service', 'quality'])
const check = (condition, message) => { if (!condition) failures.push(message) }

const visibleIds = SUBJECT_CATALOG.map(subject => subject.id)
check(visibleIds.every(id => !retired.has(id)), '폐지 과목이 공용 과목 카탈로그에 노출됩니다.')
check(WRONG_NOTE_FILTERS.every(filter => !retired.has(filter.id)), '폐지 과목이 오답노트 필터에 노출됩니다.')

const filtered = filterActiveSubjects([
  { id: 'job-common' },
  { id: 'food-service' },
  { subject_id: 'quality' },
])
check(filtered.length === 1 && filtered[0].id === 'job-common', 'DB에서 들어온 폐지 과목을 공용 필터가 제거하지 못합니다.')

const courseList = read('src/screens/student/CourseListScreen.jsx')
const studentShell = read('src/screens/student/StudentShell.jsx')
const teacherWorkspace = read('src/screens/teacher/TeacherWorkspace.jsx')
const classroom = read('src/screens/teacher/ClassroomScreen.jsx')
const campusHome = read('src/screens/student/StudentCampusHome.jsx')
const deckIndex = json('data/decks/index.json')

for (const [name, source] of [
  ['학생 과목 목록', courseList],
  ['학생 앱 라우터', studentShell],
  ['교사 캠퍼스', teacherWorkspace],
  ['교실 화면', classroom],
]) {
  check(!/['"](?:food-service|quality)['"]\s*:/.test(source), `${name}에 폐지 과목 라우트나 콘텐츠 맵이 남아 있습니다.`)
}

check(!courseList.includes('식음료서비스') && !courseList.includes('품질경영'), '학생 과목 화면에 폐지 과목명이 남아 있습니다.')
check(deckIndex.every(subject => !retired.has(subject.id)), '교사용 수업 덱에 폐지 과목이 남아 있습니다.')
check(!studentShell.includes('QualityMgmtScreen') && !studentShell.includes('QuestMapScreen'), '학생 앱이 폐지 과목 전용 화면을 불러옵니다.')
check(campusHome.includes('!RETIRED_SUBJECT_IDS.has(item.subject_id)'), '학생 홈이 서버의 과거 폐지 과목 미션을 다시 노출할 수 있습니다.')

if (failures.length) {
  console.error(`폐지 과목 유령 방지 게이트 실패 (${failures.length}건)`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`폐지 과목 유령 방지 게이트 통과: 학생·교사 카탈로그 ${visibleIds.length}개, 수업 덱 ${deckIndex.length}개, 오답 필터 ${WRONG_NOTE_FILTERS.length}개`)
