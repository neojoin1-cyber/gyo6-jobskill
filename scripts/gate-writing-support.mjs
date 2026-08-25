import fs from 'node:fs'
import { getTeacherLessonGuide, lessonTiming, LESSON_DURATIONS } from '../src/lib/teacherLessonGuides.js'

const checks = [
  ['나를쓰다 30개 문항 학습', 'src/screens/student/InterviewCareerLab.jsx', ['30개 자주 묻는 항목', '좋은 예시', '감점 예시']],
  ['근거은행 선택·작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['1. 전공·분야', '첫 문장 고르기', '근거은행에서 가져오기']],
  ['빈칸 작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['막막하면 한 칸씩 시작', '맞춤 구조 예시']],
  ['자기소개서 글자 수 지원', 'src/screens/student/InterviewCareerLab.jsx', ['권장 최소', '최대 글자 수', '공고 글자 수', 'cover-document-answer-box']],
  ['나를쓰다 독립 학습관', 'src/screens/student/CourseListScreen.jsx', ["id: 'cover-letter'", 'initialWorkspace="diagnostic"', 'initialWorkspace="mock"']],
  ['실전자기소개서 독립 모드', 'src/screens/student/CourseListScreen.jsx', ['실전자기소개서', "setMode('cover-practical')", 'initialWorkspace="practical"']],
  ['실전자기소개서 완성 동선', 'src/screens/student/InterviewCareerLab.jsx', ['REAL APPLICATION WRITING', '내 근거 준비', '실제 문항 구성', '완성·첨삭']],
  ['자기소개서 진단·모의평가', 'src/screens/student/CoverLetterAssessment.jsx', ['COVER_DIAGNOSTIC_QUESTIONS', 'COVER_MOCK_QUESTIONS', '부족한 기준 학습']],
  ['자기소개서·면접 답변 연결', 'src/screens/student/InterviewCareerLab.jsx', ['coverLinkSignature', '최신 내용 다시 연결', "documentType: 'interview-script'", '연결된 자기소개서 원문', 'coverItems: linkedCoverItems']],
  ['면접 세 답변 연결', 'src/screens/student/InterviewCareerLab.jsx', ["closing: { label: '마지막 한마디'", '세 답변 근거 일치', '세 답변 교사 첨삭 요청']],
  ['면접 답변 구조 지원', 'src/screens/student/InterviewStudyScreen.jsx', ['답변 구조 힌트', '위 구조 힌트를 참고해']],
  ['학생 실전면접 리허설', 'src/screens/student/InterviewPracticalScreen.jsx', ['면접 동선 9단계', '전 과정 리허설 시작', '고정 예절 암기 금지']],
  ['교사 실전면접 코칭', 'src/screens/teacher/TeacherInterviewPracticeScreen.jsx', ['학생 관찰표', '지도 방법', '학생에게 피드백']],
  ['학생 화면 결합 수업 코치', 'src/screens/teacher/TeacherLearningPreview.jsx', ['TeacherLessonCoach', 'onContextChange={setLearningContext}', '수업 코치']],
  ['학생 답장 빠른 선택', 'src/screens/student/NotificationsScreen.jsx', ['QUICK_REPLIES', 'setReplyBody(text)']],
  ['교사 메시지 빠른 시작', 'src/screens/teacher/TeacherMessageScreen.jsx', ['TEMPLATES', 'applyTemplate(template)']],
  ['교사 첨삭 빠른 평가', 'src/screens/teacher/CoverLetterReviewScreen.jsx', ['빠른 평가', '첨삭 유형 고르기', '전체 조언']],
]

const failures = []
for (const [name, file, needles] of checks) {
  const source = fs.readFileSync(file, 'utf8')
  const missing = needles.filter(needle => !source.includes(needle))
  if (missing.length) failures.push(`${name}: ${missing.join(', ')}`)
  else console.log(`PASS ${name}`)
}

for (const subject of ['job-common', 'ncs-basic', 'recruit-written', 'interview', 'cover-letter', 'personality']) {
  const guide = getTeacherLessonGuide(subject, subject === 'cover-letter' ? 'cover-practical' : 'study')
  if (guide.prompts.length < 4 || guide.good.length < 3 || guide.improve.length < 3 || !guide.activity || !guide.exit) {
    failures.push(`교사 수업 코치 ${subject}: 발문·사례·활동 부족`)
  }
}

for (const minutes of LESSON_DURATIONS) {
  const total = lessonTiming(minutes).reduce((sum, item) => sum + item[2], 0)
  if (total !== minutes) failures.push(`교사 수업 코치 ${minutes}분: 실제 합계 ${total}분`)
}

if (!failures.length) console.log('PASS 교사 수업 코치 6과목 · 10/25/45분 구성')

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(`Writing support gate: ${checks.length}/${checks.length} passed`)
