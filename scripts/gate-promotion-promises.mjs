import { STUDENT_CAMPUS_HALLS } from '../src/lib/studentCampusRoutes.js'
import { LESSON_DURATIONS, lessonTiming } from '../src/lib/teacherLessonGuides.js'
import { INTERVIEW_FOUNDATION_COURSES } from '../src/lib/interviewFoundationCourses.js'
import { INTERVIEW_PRACTICAL_STAGES } from '../src/lib/interviewPracticalContent.js'
import { COVER_LETTER_STEPS, INTERVIEW_ORGANIZATIONS } from '../src/lib/interviewCareerContent.js'
import { LEARNING_DATA_GROUPS } from '../src/lib/learningDataManagement.js'
import {
  EXTRACURRICULAR_CATEGORIES,
  QUALIFICATION_STATUSES,
  QUALIFICATION_VALIDITY_TYPES,
  SCHOOL_GRADE_OPTIONS,
} from '../src/lib/careerProfile.js'
import { readFile } from 'node:fs/promises'

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const hallLabels = Object.fromEntries(STUDENT_CAMPUS_HALLS.map(item => [item.id, item.label]))
check(STUDENT_CAMPUS_HALLS.length === 6, '학생 학습관이 홍보 약속 6개와 다름')
check(hallLabels['ncs-basic'] === 'NCS 직업기초능력관', 'NCS 정식 영역명 불일치')
check(hallLabels['recruit-written'] === '채용필기 심화관', '지원처별 채용필기 심화관 명칭 불일치')
check(LEARNING_DATA_GROUPS.length === 6, `학생 학습기록 초기화 항목 ${LEARNING_DATA_GROUPS.length}개 (현행 학습관 6개)`)
check(!LEARNING_DATA_GROUPS.some(item => ['quality', 'food-service'].includes(item.id)), '폐지 과목이 학생 학습기록 화면에 남아 있음')

check(INTERVIEW_ORGANIZATIONS.length === 120, `지원기관 데이터 ${INTERVIEW_ORGANIZATIONS.length}곳 (약속 120곳)`)
check(INTERVIEW_FOUNDATION_COURSES.length === 6, `면접 기초 과정 ${INTERVIEW_FOUNDATION_COURSES.length}개 (약속 6개)`)
check(INTERVIEW_PRACTICAL_STAGES.length === 9, `면접 리허설 ${INTERVIEW_PRACTICAL_STAGES.length}단계 (약속 9단계)`)
check(COVER_LETTER_STEPS.length === 6, `자기소개서 실전 작성 ${COVER_LETTER_STEPS.length}단계 (약속 6단계)`)
check(COVER_LETTER_STEPS[1]?.id === 'questions', '자기소개서가 문항 요구를 근거 선택보다 먼저 확인하지 않음')
check(COVER_LETTER_STEPS.at(-1)?.id === 'audit', '자기소개서 마지막 단계가 완성·첨삭이 아님')

check(JSON.stringify(LESSON_DURATIONS) === JSON.stringify([10, 25, 45]), '교사 수업 시간 선택이 10·25·45분과 다름')
check(LESSON_DURATIONS.every(minutes => lessonTiming(minutes).reduce((sum, item) => sum + Number(item[2] || 0), 0) === minutes), '교사 수업 흐름의 단계 시간 합계가 선택 시간과 다름')
check(JSON.stringify(SCHOOL_GRADE_OPTIONS.map(item => item.id)) === JSON.stringify([1, 2, 3]), '1~3학년 성장 연속성 옵션 누락')

const activityIds = new Set(EXTRACURRICULAR_CATEGORIES.map(item => item.id))
for (const id of ['club', 'volunteer', 'competition', 'award', 'other']) check(activityIds.has(id), `교과외활동 ${id} 입력 누락`)
const statusIds = new Set(QUALIFICATION_STATUSES.map(item => item.id))
for (const id of ['preparing', 'writtenPassed', 'practicalPassed', 'acquired', 'custom']) check(statusIds.has(id), `자격 상태 ${id} 입력 누락`)
const validityIds = new Set(QUALIFICATION_VALIDITY_TYPES.map(item => item.id))
for (const id of ['none', 'expires', 'check']) check(validityIds.has(id), `자격 유효기간 ${id} 입력 누락`)

const notificationSource = await readFile(new URL('../src/screens/student/NotificationsScreen.jsx', import.meta.url), 'utf8')
check(notificationSource.includes('rpc_mark_all_notifications_read') && notificationSource.includes('previous.map(item => ({ ...item, is_read: true }))'), '모두 읽음이 기록을 보존하는 계약 누락')
check(notificationSource.includes("window.confirm('이 소식을 삭제할까요?"), '사용자 명시 삭제 확인 계약 누락')
check(notificationSource.includes(".delete().eq('id', id).eq('user_id', profile.id)"), '학생 본인 소식만 삭제하는 경계 누락')

const studentShellSource = await readFile(new URL('../src/screens/student/StudentShell.jsx', import.meta.url), 'utf8')
const wrongScreenSource = await readFile(new URL('../src/screens/student/WrongAnswerScreen.jsx', import.meta.url), 'utf8')
const missionCreateSource = await readFile(new URL('../src/screens/teacher/MissionCreateScreen.jsx', import.meta.url), 'utf8')
const missionStudentSource = await readFile(new URL('../src/screens/student/MissionScreen.jsx', import.meta.url), 'utf8')
const lessonCoachSource = await readFile(new URL('../src/screens/teacher/TeacherLessonCoach.jsx', import.meta.url), 'utf8')
const teacherLearningSource = await readFile(new URL('../src/screens/teacher/TeacherLearningPreview.jsx', import.meta.url), 'utf8')
const teacherWorkspaceSource = await readFile(new URL('../src/screens/teacher/TeacherWorkspace.jsx', import.meta.url), 'utf8')
const learningPresenceSource = await readFile(new URL('../src/lib/learningPresence.js', import.meta.url), 'utf8')
const learningPresenceContextSource = await readFile(new URL('../src/lib/learningPresenceContext.js', import.meta.url), 'utf8')
check(studentShellSource.includes('<WrongAnswerScreen profile={profile} demo={Boolean(isTrial)} />'), '학생 체험 성장 화면에 체험 상태 전달 누락')
check(wrongScreenSource.includes('demo ? DEMO_WRONG_ROWS : []') && wrongScreenSource.includes('if (!profile?.id)'), '체험 오답 예시 또는 프로필 없는 상태 보호 누락')
check(missionCreateSource.includes("id: 'cover-letter'") && missionCreateSource.includes('COVER_DIAGNOSTIC_QUESTIONS'), '교사 자기소개서 미션 출제 누락')
check(missionStudentSource.includes("'cover-letter':    COVER_DIAGNOSTIC_QUESTIONS"), '학생 자기소개서 미션 응시 풀 누락')
check(lessonCoachSource.includes('LESSON_DURATIONS.map') && lessonCoachSource.includes('lessonTiming(lessonMinutes)'), '교사 화면의 10·25·45분 수업 선택 UI 누락')
check(teacherLearningSource.includes('rpc_class_presence') && teacherLearningSource.includes('학생 앱 위치 전달'), '홍보 약속인 수업 중 학생 연결·학습 화면 위치 확인 누락')
for (const label of ['접속', '벗어남', '확인 필요', '미접속']) check(teacherLearningSource.includes(label), `수업 연결 상태 ${label} 표시 누락`)
check(teacherWorkspaceSource.includes('rpc_class_live') && teacherWorkspaceSource.includes('30_000'), '자율학습 현재 상태 30초 자동 갱신 누락')
for (const label of ['지금 학습 중', '잠시 벗어남', '오늘 학습함', '시작 전']) check(teacherWorkspaceSource.includes(label), `자율학습 상태 ${label} 표시 누락`)
check(studentShellSource.includes('자율학습 연결') && studentShellSource.includes('현재 학습 영역과 접속 상태'), '학생에게 자율학습 연결 범위를 알리는 고지 누락')
const learningPresenceContract = `${learningPresenceSource}\n${learningPresenceContextSource}`
check(['subject:', 'mode:', 'area:', 'lesson:', 'label:'].every(key => learningPresenceContract.includes(key)) && !learningPresenceContract.includes('answer:') && !learningPresenceContract.includes('keyInput'), '자율학습 연결이 공개 학습 맥락 외 답안·키 입력까지 전송할 위험')

if (failures.length) {
  console.error(`[홍보 약속 계약] 실패 ${failures.length}건`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('[홍보 약속 계약] 통과 - 6개 학습관 정식 명칭 · 120개 지원기관 · 자기소개서 6단계 · 면접 6과정/9단계 · 10/25/45분 수업 · 3개 학년 포트폴리오 · 수업 연결/학습 위치 · 자율학습 현재 상태 · 메시지 보존')
