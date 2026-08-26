import fs from 'node:fs'
import { getTeacherLessonGuide } from '../src/lib/teacherLessonGuides.js'

const checks = [
  ['자기소개서 30개 항목 순차 학습', 'src/screens/student/InterviewCareerLab.jsx', ['개념·질문 유형 30개', '학습 범위 선택', '단원 완료', '좋은 예시', '감점 예시', "stage: 'concept'", "kind: 'question'"]],
  ['근거은행 선택·작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['1. 전공·분야', '첫 문장 고르기', '근거은행에서 가져오기']],
  ['빈칸 작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['막막하면 한 칸씩 시작', '맞춤 구조 예시']],
  ['자기소개서 글자 수 지원', 'src/screens/student/InterviewCareerLab.jsx', ['권장 최소', '최대 글자 수', '공고 글자 수', 'cover-document-answer-box']],
  ['자기소개서관 독립 학습 흐름', 'src/screens/student/CourseListScreen.jsx', ["id: 'cover-letter'", 'CoverGuidedStudyScreen', '진단평가', '모의고사', 'initialWorkspace="diagnostic"', 'initialWorkspace="mock"']],
  ['과목 공통 자율학습 구조', 'src/screens/student/GuidedStudyScreen.jsx', ['StudyModeToggle', 'StudyModeStrip', 'StudySummary', '학습 범위', '단원 선택', 'program.challengeLabel', "kind: 'summary'"]],
  ['인성검사 공통 자율학습 연결', 'src/screens/student/PersonalityGuidedStudyScreen.jsx', ['GuidedStudyScreen', 'PERSONALITY_STUDY_PROGRAM']],
  ['자기소개서 공통 자율학습 연결', 'src/screens/student/CoverGuidedStudyScreen.jsx', ['GuidedStudyScreen', 'COVER_STUDY_PROGRAM']],
  ['실전자기소개서 독립 모드', 'src/screens/student/CourseListScreen.jsx', ['실전자기소개서', "setMode('cover-practical')", 'initialWorkspace="practical"']],
  ['실전자기소개서 다중 지원 동선', 'src/screens/student/InterviewCareerLab.jsx', ['작성실', '나의 근거', '진행 현황', '지원서 보관함', '새 지원서', '채용공고·회차 이름', '근거로 새 지원서']],
  ['자기소개서 진단·실전 작성 모의', 'src/screens/student/CoverLetterAssessment.jsx', ['COVER_DIAGNOSTIC_QUESTIONS', '자기소개서 모의고사', '실제 지원 문항 1개', '글자 수', '제한 시간', '부족한 기준 학습']],
  ['자기소개서 실전 보기 균형', 'src/lib/coverAssessmentBank.js', ['practicalQuestion', 'isPractical: true', 'choices.splice(answer, 0, correct)', '공통 기준표를 제안했습니다']],
  ['자기소개서 실전 고쳐쓰기', 'src/lib/coverStudyProgram.js', ["type: 'writing-practice'", '실전 고쳐쓰기', '감점 초안의 문제', '근거 재확인']],
  ['면접 실전 상황 판단', 'src/lib/interviewLearning.js', ['CATEGORY_SITUATIONS', 'SHARED_SITUATIONS', 'isPractical: true', '현재 공식 채용공고']],
  ['실전 과목 전용 학습 언어', 'src/screens/student/StudySummary.jsx', ['자기소개서 작성 실전', '면접 답변 실전', '용어 암기 없음', 'data-learning-question="writing-practice"']],
  ['자기소개서·면접 답변 연결', 'src/screens/student/InterviewCareerLab.jsx', ['coverLinkSignature', '최신 내용 다시 연결', "documentType: 'interview-script'", '연결된 자기소개서 원문', 'coverItems: linkedCoverItems']],
  ['면접 세 답변 연결', 'src/screens/student/InterviewCareerLab.jsx', ["closing: { label: '마지막 한마디'", '세 답변 근거 일치', '세 답변 교사 첨삭 요청']],
  ['면접 다중 답변 세트', 'src/screens/student/InterviewCareerLab.jsx', ['INTERVIEW_SCRIPT_PORTFOLIO_KEY', '면접 답변 세트', '새 답변 세트', 'sourceCoverApplicationId', '이 답변의 기준 자기소개서']],
  ['면접 답변 구조 지원', 'src/screens/student/InterviewStudyScreen.jsx', ['답변 구조 힌트', '위 구조 힌트를 참고해']],
  ['학생 실전면접 리허설', 'src/screens/student/InterviewPracticalScreen.jsx', ['면접 동선 9단계', '전 과정 리허설 시작', '고정 예절 암기 금지']],
  ['교사 실전면접 코칭', 'src/screens/teacher/TeacherInterviewPracticeScreen.jsx', ['학생 관찰표', '지도 방법', '학생에게 피드백']],
  ['학생 학습 순서 전달', 'src/screens/student/StudyScreen.jsx', ['onLearningContext', "stage: !areaId ? 'area-choice'", 'position:', 'revealed: contextRevealed']],
  ['학생앱 수업 맥락 지도', 'src/screens/teacher/TeacherLearningPreview.jsx', ['TeacherLessonCoach', 'onContextChange={setLearningContext}', '현재 단계 지도', 'context={learningContext}']],
  ['교실 화면 순서별 지도', 'src/screens/teacher/ClassroomScreen.jsx', ['ClassroomContextGuide', '현재 순서 지도', 'revealed={reveal}', 'position={idx + 1}']],
  ['학생 답장 빠른 선택', 'src/screens/student/NotificationsScreen.jsx', ['QUICK_REPLIES', 'setReplyBody(text)']],
  ['교사 메시지 빠른 시작', 'src/screens/teacher/TeacherMessageScreen.jsx', ['TEMPLATES', 'applyTemplate(template)']],
  ['교사 첨삭 빠른 평가', 'src/screens/teacher/CoverLetterReviewScreen.jsx', ['빠른 평가', '첨삭 유형 고르기', '전체 조언']],
  ['공통 학습 차시별 교사 지도', 'src/screens/teacher/TeacherLearningPreview.jsx', ["!['area-choice', 'lesson-choice'].includes", '현재 단계 지도']],
  ['웹 체험 준비 완료 신호', 'src/App.jsx', ['SUGAR_SALT_APP_READY', 'requestAnimationFrame', 'trialRole']],
  ['오래된 청크 복구 화면', 'src/lib/lazyChunk.js', ['chunk-recovery-screen', '최신 학습 화면', 'app_retry']],
  ['첫 화면 공용 UI 경량 분리', 'vite.config.js', ["name: 'compact-ui'", 'codeSplitting', 'includeDependenciesRecursively: false']],
]

const failures = []
for (const [name, file, needles] of checks) {
  const source = fs.readFileSync(file, 'utf8')
  const missing = needles.filter(needle => !source.includes(needle))
  if (missing.length) failures.push(`${name}: ${missing.join(', ')}`)
  else console.log(`PASS ${name}`)
}

const careerSource = fs.readFileSync('src/screens/student/InterviewCareerLab.jsx', 'utf8')
const courseSource = fs.readFileSync('src/screens/student/CourseListScreen.jsx', 'utf8')
const coverStudySource = fs.readFileSync('src/lib/coverStudyProgram.js', 'utf8')
const interviewLearningSource = fs.readFileSync('src/lib/interviewLearning.js', 'utf8')
const duplicatedInnerRoutes = [
  "setWorkspace('diagnostic')",
  "setWorkspace('mock')",
]
if (courseSource.includes('TextbookReader') || courseSource.includes("setMode('textbook')")) {
  failures.push('인성검사 자율학습: 공통 학습 구조를 벗어나는 구형 전체화면 교재가 남음')
}
if (duplicatedInnerRoutes.some(needle => careerSource.includes(needle))) {
  failures.push('자기소개서 메뉴 위계: 배우기 내부에 진단·평가 전환이 다시 들어감')
}
if (!careerSource.includes('{practicalFlow && <nav className="cover-workspace-tabs"') ||
    !careerSource.includes('진행 현황') ||
    !careerSource.includes('나의 근거') ||
    !careerSource.includes('작성실')) {
  failures.push('실전자기소개서 메뉴 위계: 근거·작성 도구가 실전 흐름에만 묶이지 않음')
}
const practicalTabs = careerSource.slice(careerSource.indexOf('aria-label="실전자기소개서 메뉴"'), careerSource.indexOf('aria-label="실전자기소개서 메뉴"') + 900)
if (!(practicalTabs.indexOf('작성실') < practicalTabs.indexOf('나의 근거') && practicalTabs.indexOf('나의 근거') < practicalTabs.indexOf('진행 현황'))) {
  failures.push('실전자기소개서 메뉴 순서: 작성실 → 나의 근거 → 진행 현황 순서가 아님')
}
if (!careerSource.includes("useState(initialWorkspace === 'practical' ? 'write' : initialWorkspace)")) {
  failures.push('실전자기소개서 첫 화면: 작성실이 기본 화면으로 열리지 않음')
}
if (!careerSource.includes("const assessmentFlow = workspace === 'diagnostic' || workspace === 'mock'") ||
    !careerSource.includes('{!assessmentFlow && <section className="cover-brand-panel">')) {
  failures.push('자기소개서 평가 화면: 중복 제목 방지 조건이 없음')
}
if (!courseSource.includes("setMode('cover-practical')") ||
    !courseSource.includes('initialWorkspace="practical"')) {
  failures.push('자기소개서 메뉴 위계: 실전자기소개서 상위 진입점이 없음')
}
if (coverStudySource.includes("term: '평가 의도'") || coverStudySource.includes("type: 'choice'")) {
  failures.push('자기소개서 자율학습: 용어 맞히기 또는 선다형 출제 구조가 다시 들어감')
}
if (interviewLearningSource.includes('const questions = quizQuestions.filter')) {
  failures.push('면접 자율학습: 기존 개념 퀴즈 원본을 실전 상황 판단에 다시 사용함')
}
if (!failures.length) console.log('PASS 자기소개서 상·하위 메뉴 중복 방지')

for (const subject of ['job-common', 'ncs-basic', 'recruit-written', 'interview', 'cover-letter', 'personality']) {
  const guide = getTeacherLessonGuide(subject, subject === 'cover-letter' ? 'cover-practical' : 'study')
  if (guide.prompts.length < 4 || guide.good.length < 3 || guide.improve.length < 3 || !guide.activity || !guide.exit) {
    failures.push(`교사 맥락 지도 ${subject}: 발문·사례·활동 부족`)
  }
}

if (!failures.length) console.log('PASS 교사 맥락 지도 6과목 · 학생앱·교실 화면 연결')

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(`Writing support gate: ${checks.length}/${checks.length} passed`)
