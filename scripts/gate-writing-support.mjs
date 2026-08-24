import fs from 'node:fs'

const checks = [
  ['나를쓰다 30개 문항 학습', 'src/screens/student/InterviewCareerLab.jsx', ['30개 자주 묻는 항목', '좋은 예시', '감점 예시']],
  ['근거은행 선택·작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['1. 전공·분야', '첫 문장 고르기', '근거은행에서 가져오기']],
  ['빈칸 작성 지원', 'src/screens/student/InterviewCareerLab.jsx', ['막막하면 한 칸씩 시작', '이 분야의 구체적 예시 보기']],
  ['면접 답변 구조 지원', 'src/screens/student/InterviewStudyScreen.jsx', ['답변 구조 힌트', '위 구조 힌트를 참고해']],
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

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(`Writing support gate: ${checks.length}/${checks.length} passed`)
