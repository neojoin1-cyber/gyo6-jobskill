import interviewQuizData from '../data/interview-quiz.json'
import interviewStudy from '../data/interview-study.json'
import assessmentBaseline from '../data/assessment-expansion-baseline.json'
import {
  buildJcOfficialAreas,
  buildJcMockAreas,
  jcLessonMatches,
  jcStudyQuestions,
} from '../src/lib/jobCommonAreas.js'
import { buildNcs2026Areas, ncs2026Questions } from '../src/lib/ncs2026.js'
import {
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  recruitAreaId,
  recruitLessonTitle,
  recruitWrittenQuestions,
} from '../src/lib/recruitWritten.js'
import {
  assessmentQuestions,
  assessmentQuestionsById,
  studyQuestions,
  studyQuestionsById,
} from '../src/lib/assessmentPartition.js'
import { buildInterviewLearningQuestions } from '../src/lib/interviewLearning.js'
import { buildSubjectMockPaper, getDiagnosticScopes } from '../src/lib/mockData.js'

const failures = []
const rows = []

function record(course, unit, study, assessment, { minStudy, minAssessment = 0 }) {
  rows.push({ course, unit, study, assessment })
  if (study < minStudy) failures.push(`${course}/${unit}: 자율학습 ${study}문항 (최소 ${minStudy})`)
  if (assessment != null && assessment < minAssessment) failures.push(`${course}/${unit}: 평가 ${assessment}문항 (최소 ${minAssessment})`)
}

const jcStudy = jcStudyQuestions()
const jcAssessmentAreas = Object.fromEntries(buildJcMockAreas().map(area => [area.id, area]))
for (const area of buildJcOfficialAreas()) {
  for (const lesson of area.lessons || []) {
    if (lesson.kind === 'self-report') continue
    record('교육부 직업공통능력', lesson.label,
      jcStudy.filter(question => jcLessonMatches(question, lesson.id)).length,
      jcAssessmentAreas[area.id]?.poolCount ?? 0,
      { minStudy: 3, minAssessment: jcAssessmentAreas[area.id]?.count ?? 0 })
  }
}

const ncsStudy = studyQuestions(ncs2026Questions)
const ncsAssessment = assessmentQuestions(ncs2026Questions)
for (const area of buildNcs2026Areas(ncs2026Questions)) {
  for (const lesson of area.lessons || []) {
    const matches = question => question.area === area.id && question.ncsAbility === lesson.id
    record('NCS 직업기초능력', lesson.label,
      ncsStudy.filter(matches).length,
      ncsAssessment.filter(matches).length,
      { minStudy: 3, minAssessment: 3 })
  }
}

const recruitStudy = studyQuestions(recruitWrittenQuestions)
const recruitAssessment = assessmentQuestions(recruitWrittenQuestions)
for (const track of RECRUIT_WRITTEN_TRACKS) {
  for (const area of buildRecruitWrittenAreas(track.id, recruitWrittenQuestions)) {
    for (const lesson of area.lessons || []) {
      const matches = question =>
        question.recruitmentTrack === track.id &&
        recruitAreaId(question.area) === area.id &&
        recruitLessonTitle(question) === lesson.id
      record('채용필기 심화', `${track.label} · ${lesson.label}`,
        recruitStudy.filter(matches).length,
        null,
        { minStudy: 2 })
    }
  }
  const trackAssessment = recruitAssessment.filter(question => question.recruitmentTrack === track.id).length
  if (trackAssessment < 30) failures.push(`채용필기 심화/${track.label}: 평가 풀 ${trackAssessment}문항 (최소 30)`)
}

const interviewStudyQuiz = studyQuestionsById(interviewQuizData.questions || [])
const interviewAssessmentQuiz = assessmentQuestionsById(interviewQuizData.questions || [])
for (const lesson of interviewStudy.lessons || []) {
  const guided = buildInterviewLearningQuestions(lesson, interviewStudyQuiz)
  const assessment = interviewAssessmentQuiz.filter(question => question.lessonId === lesson.id)
  record('고졸면접', lesson.title, guided.length, assessment.length, { minStudy: 3, minAssessment: 1 })
}

for (const subjectId of ['ncs-basic', 'recruit-written', 'interview']) {
  const paper = buildSubjectMockPaper(subjectId, '__all__', 1)
  if (paper.length !== 30) failures.push(`${subjectId}: 전체 모의고사 ${paper.length}/30문항`)
}

for (const course of [...new Set(rows.map(row => row.course))]) {
  const courseRows = rows.filter(row => row.course === course)
  const studyCounts = courseRows.map(row => row.study)
  const assessmentCounts = courseRows.map(row => row.assessment).filter(Number.isFinite)
  const assessmentSummary = assessmentCounts.length
    ? ` · 평가 최소 ${Math.min(...assessmentCounts)}/평균 ${(assessmentCounts.reduce((a, b) => a + b, 0) / assessmentCounts.length).toFixed(1)}`
    : ''
  console.log(`${course}: ${courseRows.length}단원 · 학습 최소 ${Math.min(...studyCounts)}/평균 ${(studyCounts.reduce((a, b) => a + b, 0) / studyCounts.length).toFixed(1)}${assessmentSummary}`)
}

const interviewAssessmentTotal = getDiagnosticScopes('interview').find(scope => scope.key === '__all__')?.count || 0
console.log(`고졸면접 평가 풀: 기존 ${assessmentBaseline.interviewTotal} + 독립 신규 ${interviewAssessmentTotal - assessmentBaseline.interviewTotal} = ${interviewAssessmentTotal}문항`)

if (failures.length) {
  console.error(`[학습용량] 실패 ${failures.length}건`)
  failures.slice(0, 80).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

console.log(`[학습용량] 통과 — ${rows.length}개 단원의 자율학습·평가 최소 용량과 30문항 모의고사 확인`)
