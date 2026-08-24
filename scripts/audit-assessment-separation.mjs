import interviewQuizData from '../data/interview-quiz.json'
import { questionContentKey, studyQuestions, studyQuestionsById } from '../src/lib/assessmentPartition.js'
import {
  buildJcAreaPaper,
  buildJcOfficialAreas,
  jcLessonMatches,
  jcStudyQuestions,
  JC_AREAS_ORDER,
  JC_OFFICIAL_SPECS,
} from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../src/lib/ncs2026.js'
import { buildRecruitWrittenAreas, recruitWrittenQuestions, RECRUIT_WRITTEN_TRACKS } from '../src/lib/recruitWritten.js'
import { buildDiagnosticPaper, buildSubjectMockPaper, getMockScopes } from '../src/lib/mockData.js'

const failures = []
const report = []

function uniqueQuestions(questions) {
  const seen = new Set()
  return (questions || []).filter(question => {
    const key = `${question?._baseId || question?.id || ''}|${questionContentKey(question)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function generatedAssessments(subjectId) {
  const questions = []
  for (const scope of getMockScopes(subjectId)) {
    for (let paper = 1; paper <= scope.papers; paper += 1) {
      questions.push(...buildSubjectMockPaper(subjectId, scope.key, paper))
    }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    questions.push(...buildDiagnosticPaper(subjectId, attempt))
  }
  return uniqueQuestions(questions)
}

function checkSeparation(label, study, assessment) {
  const studyIds = new Set(study.map(question => question?._baseId || question?.id).filter(Boolean))
  const studyContent = new Set(study.map(questionContentKey))
  const idOverlap = assessment.filter(question => studyIds.has(question?._baseId || question?.id))
  const contentOverlap = assessment.filter(question => studyContent.has(questionContentKey(question)))
  if (idOverlap.length || contentOverlap.length) {
    failures.push(`${label}: 자율학습-평가 중복 id ${idOverlap.length}건 · 원문 ${contentOverlap.length}건`)
  }
  report.push(`${label} 학습 ${study.length} · 평가 ${assessment.length} · 중복 0`)
}

const jcStudy = jcStudyQuestions()
const jcAssessment = uniqueQuestions(JC_AREAS_ORDER
  .filter(area => JC_OFFICIAL_SPECS[area]?.assessmentType !== 'likert')
  .flatMap(area => [1, 2, 3, 4, 5].flatMap(paper => buildJcAreaPaper(area, paper))))
checkSeparation('교육부 직업공통능력', jcStudy, jcAssessment)

for (const area of buildJcOfficialAreas()) {
  for (const lesson of area.lessons || []) {
    if (lesson.kind === 'self-report') continue
    const count = jcStudy.filter(question => jcLessonMatches(question, lesson.id)).length
    if (count === 0) failures.push(`교육부 자율학습 빈 단원: ${area.label} / ${lesson.label}`)
  }
}

checkSeparation('NCS 직업기초능력', studyQuestions(ncs2026Questions), generatedAssessments('ncs-basic'))
checkSeparation('채용필기 심화', studyQuestions(recruitWrittenQuestions), generatedAssessments('recruit-written'))
for (const track of RECRUIT_WRITTEN_TRACKS) {
  const areas = buildRecruitWrittenAreas(track.id, studyQuestions(recruitWrittenQuestions))
  if (areas.length !== track.sourceAreas.length) {
    failures.push(`채용필기 자율학습 영역 누락: ${track.label} ${areas.length}/${track.sourceAreas.length}`)
  }
}
checkSeparation('고졸면접', studyQuestionsById(interviewQuizData.questions || []), generatedAssessments('interview'))

if (failures.length) {
  console.error(`[학습-평가 분리] 실패 — ${failures.length}건`)
  failures.forEach(failure => console.error(`  ✗ ${failure}`))
  process.exit(1)
}

console.log(`[학습-평가 분리] 통과 — ${report.join(' / ')}`)
