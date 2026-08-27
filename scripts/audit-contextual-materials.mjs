import studySummaries from '../data/study-summaries.json'
import abilitySummaries from '../data/ability-summaries.json'
import { buildStudySummaryCards } from '../src/screens/student/StudySummary.jsx'
import { buildLearningPoints, buildQuestionDrivenSummary } from '../src/lib/learningExperience.js'
import { buildTeacherContextMaterials } from '../src/lib/teacherContextMaterials.js'
import { getTeacherLessonGuide } from '../src/lib/teacherLessonGuides.js'
import { learningCaseProvenance } from '../src/lib/learningCaseProvenance.js'
import { courseKindForSubject } from '../src/lib/learningCaseProvenance.js'
import { buildJcOfficialAreas, jcLessonMatches, jcStudyQuestions } from '../src/lib/jobCommonAreas.js'
import { buildNcs2026Areas, ncs2026Questions } from '../src/lib/ncs2026.js'
import {
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  recruitAreaId,
  recruitLessonTitle,
  recruitWrittenQuestions,
} from '../src/lib/recruitWritten.js'
import { studyQuestions, studyQuestionsById } from '../src/lib/assessmentPartition.js'
import interviewStudy from '../data/interview-study.json'
import interviewQuizData from '../data/interview-quiz.json'
import { buildInterviewLearningQuestions } from '../src/lib/interviewLearning.js'
import { COVER_STUDY_PROGRAM } from '../src/lib/coverStudyProgram.js'
import { PERSONALITY_STUDY_PROGRAM } from '../src/lib/guidedLearningPrograms.js'

const failures = []
const metrics = new Map()

function plain(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function metric(subject) {
  if (!metrics.has(subject)) metrics.set(subject, {
    units: 0,
    cards: 0,
    points: 0,
    studentCases: 0,
    teacherPages: 0,
    officialItems: 0,
    alignedPractice: 0,
  })
  return metrics.get(subject)
}

function hasCurrentCase(materials, point) {
  const anchors = [
    point?.situation,
    point?.sampleQuestion?.context,
    point?.sampleQuestion?.stem,
    point?.sampleQuestion?.question,
  ].map(plain).filter(text => text.length >= 10)
  return anchors.some(anchor => materials.examples.some(example => {
    const text = plain(example.text)
    return text.includes(anchor.slice(0, Math.min(28, anchor.length)))
      || anchor.includes(text.slice(0, Math.min(28, text.length)))
  }))
}

function inspectUnit(subject, scope, summary, questions = []) {
  if (!summary) {
    failures.push(`${scope}: 자율학습 요약 없음`)
    return
  }
  const stats = metric(subject)
  stats.units += 1
  const effectiveSummary = summary.courseKind ? summary : { ...summary, courseKind: courseKindForSubject(subject) }
  const points = buildLearningPoints(effectiveSummary, questions)
  const cards = buildStudySummaryCards(effectiveSummary, questions, points)
  const guide = getTeacherLessonGuide(subject, 'study')

  cards.forEach((card, index) => {
    stats.cards += 1
    const materials = buildTeacherContextMaterials({
      subject,
      courseKind: effectiveSummary.courseKind,
      lessonId: scope,
      lessonLabel: effectiveSummary.title,
      title: effectiveSummary.title,
      stage: card.type,
      position: index + 1,
      total: cards.length,
      revealed: true,
      content: { kind: 'summary', summary: effectiveSummary, card },
    }, guide)
    if (!plain(materials.heading)) failures.push(`${scope} ${card.type} ${index + 1}: 제목 없음`)
    if (plain(materials.explanations?.[0]).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 교사용 설명 없음`)
    if (plain(materials.examples?.[0]?.text).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 적용 사례 없음`)
    if (plain(`${materials.good?.[0]?.text} ${materials.good?.[0]?.detail}`).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 좋은 사례 없음`)
    if (plain(`${materials.bad?.[0]?.text} ${materials.bad?.[0]?.detail}`).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 주의·잘못된 사례 없음`)
    if (plain(materials.prompts?.[0]).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 발문 없음`)
    if (plain(materials.checklist?.[0]).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 확인 기준 없음`)
    if (plain(materials.provenance?.label).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 자료 성격 표시 없음`)
    if ((materials.prompts || []).length < 3) failures.push(`${scope} ${card.type} ${index + 1}: 교사 발문 3개 미만`)
    stats.teacherPages += 1
  })

  points.forEach((point, index) => {
    stats.points += 1
    const sample = point?.sampleQuestion || {}
    const caseText = [point?.situation, sample.context, sample.stem, sample.question]
      .map(plain)
      .sort((a, b) => b.length - a.length)[0] || ''
    const explanation = plain(sample.explanation || sample.modelAnswer || sample.feedback || point?.learn)
    if (caseText.length < 10) failures.push(`${scope} 핵심 ${index + 1}: 학생이 먼저 볼 상황·사례·문항 없음`)
    if (explanation.length < 10) failures.push(`${scope} 핵심 ${index + 1}: 사례 판단 뒤 확인할 해설 없음`)
    if (caseText.length >= 10 && explanation.length >= 10) stats.studentCases += 1

    const provenance = learningCaseProvenance(effectiveSummary.courseKind, sample)
    if (!plain(provenance.label) || !plain(provenance.detail) || !plain(provenance.caution)) {
      failures.push(`${scope} 핵심 ${index + 1}: 자료 성격·출처 경계 표시 없음`)
    }
    if (provenance.kind === 'official-item') stats.officialItems += 1
    else stats.alignedPractice += 1
    if (provenance.kind === 'rights-review') {
      failures.push(`${scope} 핵심 ${index + 1}: 공식 문항 이용권 미확인 (${(provenance.rightsReasons || []).join(', ')})`)
    }
    if (provenance.kind !== 'official-item' && /(?:기출문항|실제 기출)/.test(`${provenance.label} ${provenance.detail}`)) {
      failures.push(`${scope} 핵심 ${index + 1}: 연습 사례를 공식 기출로 오인시키는 표시`)
    }

    const materials = buildTeacherContextMaterials({
      subject,
      courseKind: effectiveSummary.courseKind,
      title: effectiveSummary.title,
      lessonId: scope,
      stage: 'point',
      position: index + 1,
      total: points.length,
      revealed: true,
      content: { kind: 'summary', summary: effectiveSummary, card: { type: 'point', point, n: index + 1 } },
    }, guide)
    if (!hasCurrentCase(materials, point)) failures.push(`${scope} 핵심 ${index + 1}: 교사 자료가 현재 학생 사례를 직접 인용하지 않음`)
  })
}

const jcQuestions = jcStudyQuestions()
for (const area of buildJcOfficialAreas()) for (const lesson of area.lessons || []) {
  if (lesson.kind === 'self-report') continue
  const questions = jcQuestions.filter(question => !question.excludeFromQuiz && jcLessonMatches(question, lesson.id))
  inspectUnit('job-common', `직업공통/${lesson.id}`, studySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'education-certification' }), questions)
}

const ncsQuestions = studyQuestions(ncs2026Questions)
for (const area of buildNcs2026Areas(ncsQuestions)) for (const lesson of area.lessons || []) {
  const questions = ncsQuestions.filter(question => !question.excludeFromQuiz && question.area === area.id && question.ncsAbility === lesson.id)
  inspectUnit('ncs-basic', `NCS/${lesson.id}`, studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'ncs' }), questions)
}

const recruitQuestions = studyQuestions(recruitWrittenQuestions)
for (const track of RECRUIT_WRITTEN_TRACKS) for (const area of buildRecruitWrittenAreas(track.id, recruitQuestions)) for (const lesson of area.lessons || []) {
  const questions = recruitQuestions.filter(question => !question.excludeFromQuiz && question.recruitmentTrack === track.id && recruitAreaId(question.area) === area.id && recruitLessonTitle(question) === lesson.id)
  inspectUnit('recruit-written', `채용심화/${track.id}/${lesson.id}`, studySummaries[lesson.id] || abilitySummaries[lesson.id] || buildQuestionDrivenSummary({ title: lesson.label, questions, courseKind: 'recruitment' }), questions)
}

const interviewQuestions = studyQuestionsById(interviewQuizData.questions || [])
for (const lesson of interviewStudy.lessons || []) {
  const summary = studySummaries[`iv:${lesson.id}`]
  inspectUnit('interview', `면접/${lesson.id}`, summary ? { ...summary, courseKind: 'interview' } : null, buildInterviewLearningQuestions(lesson, interviewQuestions))
}

for (const [subject, program] of [['cover-letter', COVER_STUDY_PROGRAM], ['personality', PERSONALITY_STUDY_PROGRAM]]) {
  for (const area of program.areas || []) for (const lesson of area.lessons || []) {
    inspectUnit(subject, `${program.title}/${area.id}/${lesson.id}`, lesson.summary, [])
  }
}

if (failures.length) {
  console.error(`[학생 사례·교사 지원] 실패 ${failures.length}건`)
  failures.slice(0, 80).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

const totals = [...metrics.values()].reduce((sum, row) => ({
  units: sum.units + row.units,
  cards: sum.cards + row.cards,
  points: sum.points + row.points,
  studentCases: sum.studentCases + row.studentCases,
  teacherPages: sum.teacherPages + row.teacherPages,
  officialItems: sum.officialItems + row.officialItems,
  alignedPractice: sum.alignedPractice + row.alignedPractice,
}), { units: 0, cards: 0, points: 0, studentCases: 0, teacherPages: 0, officialItems: 0, alignedPractice: 0 })

console.log(`[학생 사례·교사 지원] 통과 — ${totals.units}단원 · 핵심 ${totals.points}개 · 학생 사례+해설 ${totals.studentCases}개 · 교사 페이지 자료 ${totals.teacherPages}개`)
for (const [subject, row] of metrics) console.log(`  ${subject}: ${row.units}단원 · ${row.points}사례 · 교사자료 ${row.teacherPages}페이지`)
console.log(`  자료 성격: 공식 공개 문항 ${totals.officialItems}개 · 공식 기준 연계/유형 연습 ${totals.alignedPractice}개`)
