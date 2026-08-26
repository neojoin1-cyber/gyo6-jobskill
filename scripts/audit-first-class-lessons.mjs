import interviewStudy from '../data/interview-study.json'
import { FIRST_CLASS_LESSONS } from '../src/lib/firstClassLessons.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'
import { INTERVIEW_FOUNDATION_COURSES } from '../src/lib/interviewFoundationCourses.js'
import { buildJcOfficialAreas } from '../src/lib/jobCommonAreas.js'
import { buildNcs2026Areas } from '../src/lib/ncs2026.js'
import { buildRecruitWrittenAreas } from '../src/lib/recruitWritten.js'

const jcArea = buildJcOfficialAreas()[0]
const ncsArea = buildNcs2026Areas()[0]
const recruitArea = buildRecruitWrittenAreas('public')[0]
const interviewCourse = INTERVIEW_FOUNDATION_COURSES[0]
const interviewLesson = interviewStudy.lessons.find(lesson => interviewCourse.categories.includes(lesson.category))
const personalityArea = PERSONALITY_STUDY_PROGRAM.areas[0]

const expected = {
  'job-common': { areaId: jcArea.id, lessonId: jcArea.lessons[0].id },
  'ncs-basic': { areaId: ncsArea.id, lessonId: ncsArea.lessons[0].id },
  'recruit-written': { trackId: 'public', areaId: recruitArea.id, lessonId: recruitArea.lessons[0].id },
  interview: { areaId: interviewCourse.id, lessonId: interviewLesson.id },
  personality: { areaId: personalityArea.id, lessonId: personalityArea.lessons[0].id },
}

const failures = []

for (const [subject, first] of Object.entries(expected)) {
  const plan = FIRST_CLASS_LESSONS[subject]
  if (!plan) {
    failures.push(`${subject}: 첫 수업 지도안 없음`)
    continue
  }

  for (const [key, value] of Object.entries(first)) {
    if (plan.match[key] !== value) failures.push(`${subject}: 실제 첫 ${key}=${value}, 지도안=${plan.match[key]}`)
  }

  if (plan.flow.length !== 6) failures.push(`${subject}: 수업 흐름 ${plan.flow.length}단계 (필수 6단계)`)
  let previousEnd = 0
  for (const [index, item] of plan.flow.entries()) {
    const match = item.minutes.match(/^(\d+)~(\d+)분$/)
    if (!match) {
      failures.push(`${subject}: ${index + 1}단계 시간 형식 오류`)
      continue
    }
    const start = Number(match[1])
    const end = Number(match[2])
    if (start !== previousEnd || end <= start) failures.push(`${subject}: ${item.minutes} 시간 흐름 불연속`)
    previousEnd = end
    for (const key of ['phase', 'menu', 'button', 'teacherTalk', 'material', 'studentAction']) {
      if (!item[key]?.trim()) failures.push(`${subject}: ${index + 1}단계 ${key} 누락`)
    }
  }
  if (previousEnd !== 45) failures.push(`${subject}: 수업 종료 ${previousEnd}분 (필수 45분)`)

  if (plan.takeaways.length !== 3) failures.push(`${subject}: 정리 기준 ${plan.takeaways.length}개 (필수 3개)`)
  if (plan.formative.length !== 3) failures.push(`${subject}: 형성평가 ${plan.formative.length}문항 (필수 3문항)`)
  if (plan.formative.filter(question => question.kind === 'transfer').length !== 1) failures.push(`${subject}: 변형 문항은 정확히 1개여야 함`)

  plan.formative.forEach((question, index) => {
    if (question.choices.length !== 4) failures.push(`${subject}: ${index + 1}번 보기는 4개여야 함`)
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) failures.push(`${subject}: ${index + 1}번 정답 범위 오류`)
    if (!question.explanation || question.explanation.length < 30) failures.push(`${subject}: ${index + 1}번 해설 부족`)
  })
}

if (failures.length) {
  console.error(`[첫 수업 지도안] 실패 ${failures.length}건`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('[첫 수업 지도안] 통과 - 5과목 · 각 45분/6단계 · 형성평가 3문항(변형 1문항) · 실제 첫 단원 경로 일치')
