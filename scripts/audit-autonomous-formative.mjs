import fs from 'node:fs'
import path from 'node:path'
import { buildAutonomousFormative } from '../src/lib/autonomousFormative.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'
import { COVER_STUDY_PROGRAM } from '../src/lib/coverStudyProgram.js'
import { FIRST_CLASS_LESSONS, getFirstClassFormative } from '../src/lib/firstClassLessons.js'

const root = process.cwd()
let checked = 0

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function inspectAssessment(label, assessment) {
  assert(assessment?.questions?.length === 3, `${label}: 형성평가가 3문항이 아님`)
  assert(assessment.questions[2].kind === 'transfer', `${label}: 3번이 변형 문항이 아님`)
  assert(assessment.takeaways?.length === 3, `${label}: 정리 기준이 3개가 아님`)
  assessment.questions.forEach((question, index) => {
    assert(question.stem?.trim(), `${label}: ${index + 1}번 발문 없음`)
    assert(Array.isArray(question.choices) && question.choices.length >= 2, `${label}: ${index + 1}번 선택지 없음`)
    assert(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `${label}: ${index + 1}번 정답 인덱스 오류`)
    assert(question.explanation?.trim(), `${label}: ${index + 1}번 해설 없음`)
  })
  checked += 1
}

for (const program of [PERSONALITY_STUDY_PROGRAM, COVER_STUDY_PROGRAM]) {
  for (const area of program.areas) {
    for (const lesson of area.lessons) inspectAssessment(`${program.subjectId}/${area.id}/${lesson.id}`, buildAutonomousFormative(lesson.summary))
  }
}

for (const [subject, plan] of Object.entries(FIRST_CLASS_LESSONS)) {
  inspectAssessment(`${subject}/first-class`, getFirstClassFormative(subject, plan.match))
}

const summarySource = fs.readFileSync(path.join(root, 'src/screens/student/StudySummary.jsx'), 'utf8')
const experienceSource = fs.readFileSync(path.join(root, 'src/lib/learningExperience.js'), 'utf8')
assert(summarySource.includes('formativeAssessment || buildAutonomousFormative(summary, questions)'), '모든 자율학습 형성평가 fallback이 없음')
assert(summarySource.includes("label: '제시문과 오독 비교'"), '제시문 오독 전용 표시가 없음')
assert(!summarySource.includes("'상황부터 이해하기'"), '의미를 구분하지 않는 상황 제목이 남아 있음')
assert(!experienceSource.includes('sampleQuestion?.context || sampleQuestion?.stem'), '발문을 상황으로 중복 표시하는 fallback이 남아 있음')

const campusCss = fs.readFileSync(path.join(root, 'src/styles/campus.css'), 'utf8')
assert(campusCss.includes('.spot-career .campus-spot-copy { flex: 1 1 auto; min-width: 0; }'), 'NCS 심화관 반응형 제목 영역이 없음')
assert(campusCss.includes('@container (max-width: 650px)'), 'NCS 심화관 컨테이너 반응형 보정이 없음')

console.log(`PASS autonomous formative/context audit: ${checked} lesson assessments`)
