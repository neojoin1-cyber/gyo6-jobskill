import fs from 'node:fs'

const failures = []
const read = file => fs.readFileSync(file, 'utf8')
const requireAll = (name, source, needles) => {
  const missing = needles.filter(needle => !source.includes(needle))
  if (missing.length) failures.push(`${name}: ${missing.join(', ')}`)
  else console.log(`PASS ${name}`)
}

const back = read('src/lib/backButton.js')
requireAll('PC·Android 공통 뒤로가기', back, [
  "window.addEventListener('popstate'",
  'window.history.pushState',
  'export function triggerBack()',
  'queueMicrotask',
])

const preview = read('src/screens/teacher/TeacherLearningPreview.jsx')
requireAll('교사 수업 직전 화면 복귀', preview, [
  'triggerBack',
  'goPrevious',
  '교사 캠퍼스로 돌아가기',
  'if (!focusMode) return undefined',
  'if (!coachOpen) return undefined',
])

const study = read('src/screens/student/StudyScreen.jsx')
const summaryStart = study.indexOf('if (isLearn && lessonSummary)')
const questionStart = study.indexOf("<div className=\"screen\" style={{ position: 'relative' }}>", summaryStart)
const summaryFlow = study.slice(summaryStart, questionStart)
requireAll('단원 학습 후 도전', summaryFlow, [
  'study-scene-position',
  'onStartQuiz={() => switchMode(\'game\')}',
  '단원 도전 시작',
])
if (summaryFlow.includes('<StudyModeToggle')) failures.push('단원 학습 도중 상단에 도전 전환이 남아 있음')
requireAll('학습 화면 화살표 공통 동작', study, [
  'triggerBack',
  'onClick={triggerBack}',
  'aria-label="이전 화면"',
])
if (study.includes('onClick={handleBack}')) failures.push('학습 본문 화살표가 공통 뒤로가기를 우회함')

const guided = read('src/screens/student/GuidedStudyScreen.jsx')
requireAll('자기소개서·인성 직선 학습 흐름', guided, [
  'orderedLessons',
  'continueAfterLesson',
  '다음 단원 학습',
  '모든 단원 학습 후 종합 진단',
  'disabled={!allDone}',
  'onClick={triggerBack}',
])
if (guided.includes('<StudyModeToggle')) failures.push('과목 종합 진단이 장면 상단 전환으로 다시 노출됨')

const practical = read('src/screens/student/InterviewPracticalScreen.jsx')
requireAll('실전면접 단계별 직전 화면 복귀', practical, [
  'if (scenarioIndex > 0)',
  'if (runStep > 0)',
  'pushBack(() => backRef.current())',
  'onClick={triggerBack}',
])

const mission = read('src/screens/student/MissionScreen.jsx')
requireAll('시험 문항별 직전 화면 복귀', mission, [
  "if (phase === 'quiz' && idx > 0)",
  'tryGoTo(idx - 1)',
  'pushBack(() => backRef.current())',
  'aria-label="이전 화면"',
  'onClick={triggerBack}',
])

const jobDiagnostic = read('src/screens/student/JobCommonDiagnosticHub.jsx')
requireAll('직업공통 진단 경로 복귀', jobDiagnostic, [
  'if (officialMission)',
  'if (officialBreak)',
  'if (section)',
  'pushBack(() => backRef.current())',
])

const careerCss = read('src/styles/interview-career.css')
requireAll('교실 진단 넓은 화면', careerCss, [
  '.teacher-learning-preview.is-teaching .interview-career-body',
  '.teacher-learning-preview.is-teaching .cover-assessment-setup',
  '.teacher-learning-preview.is-teaching .cover-assessment-run',
  'max-width: 1600px',
])

if (failures.length) {
  console.error('\nNAVIGATION FLOW GATE FAILED')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('PASS 학습 내비게이션·평가 위치·교실 폭 계약')
