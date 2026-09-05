import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { assessmentQuestions, assessmentQuestionsById, studyQuestions } from '../src/lib/assessmentPartition.js'
import {
  buildJcMockAreas,
  jcOfficialArea,
  JC_OFFICIAL_SPECS,
} from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../src/lib/ncs2026.js'
import {
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  recruitAreaId,
  recruitLessonTitle,
  recruitWrittenQuestions,
} from '../src/lib/recruitWritten.js'
import interviewQuiz from '../data/interview-quiz.json'
import {
  INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
} from '../src/lib/interviewCareerContent.js'
import {
  COVER_ASSESSMENT_AREAS,
  COVER_DIAGNOSTIC_QUESTIONS,
} from '../src/lib/coverAssessmentBank.js'
import personalityBank from '../data/personality-test-bank.json'

const GENERATED_PREFIX = 'NEW26-'
const isBaseline = question => !String(question?.id || '').startsWith(GENERATED_PREFIX)
const add = (map, key) => map.set(key, (map.get(key) || 0) + 1)
const rows = map => [...map].map(([key, count]) => ({ key, count }))

const report = {
  schemaVersion: 1,
  generatedPrefix: GENERATED_PREFIX,
  meaning: '기존 평가 문항의 내용이 아니라 영역·소단원별 수량만 기록한 300% 확대 기준선',
  subjects: {},
}

const jcMap = new Map()
for (const area of buildJcMockAreas()) {
  if (JC_OFFICIAL_SPECS[area.id]?.assessmentType === 'likert') continue
  for (const question of (area.questions || []).filter(isBaseline)) {
    add(jcMap, jcOfficialArea(question) || area.id)
  }
}
report.subjects['job-common'] = rows(jcMap)

const ncsMap = new Map()
for (const question of assessmentQuestions(ncs2026Questions).filter(isBaseline)) {
  add(ncsMap, [question.area, question.ncsAbility, question.ncsElement].map(value => value || '미분류').join(' > '))
}
report.subjects['ncs-basic'] = rows(ncsMap)

const recruitMap = new Map()
for (const question of assessmentQuestions(recruitWrittenQuestions).filter(isBaseline)) {
  add(recruitMap, [
    question.recruitmentTrack,
    recruitAreaId(question.area),
    recruitLessonTitle(question),
  ].map(value => value || '미분류').join(' > '))
}
report.subjects['recruit-written'] = rows(recruitMap)
report.subjects['recruit-written-study-units'] = RECRUIT_WRITTEN_TRACKS.flatMap(track =>
  buildRecruitWrittenAreas(track.id, studyQuestions(recruitWrittenQuestions.filter(isBaseline))).flatMap(area =>
    (area.lessons || []).map(lesson => ({ key: `${track.id} > ${area.id} > ${lesson.id}` })),
  ),
)

const interviewMap = new Map()
const interviewBaseline = [
  ...assessmentQuestionsById(interviewQuiz.questions || []),
  ...INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
].filter(isBaseline)
for (const question of interviewBaseline) {
  add(interviewMap, [question._mockArea || question.category || question.area, question.lessonId || '종합'].join(' > '))
}
report.subjects.interview = rows(interviewMap)

const coverMap = new Map()
for (const question of COVER_DIAGNOSTIC_QUESTIONS.filter(isBaseline)) add(coverMap, question.area)
report.subjects['cover-letter'] = rows(coverMap)
report.subjects['cover-letter-areas'] = Object.entries(COVER_ASSESSMENT_AREAS).map(([key, label]) => ({ key, label }))

// 확대 전 직무적응 연습지는 12하위척도 정·역문항 144개와
// 인상관리·주의확인 16개로 구성된 160문항 고정형이었다.
// 확대된 풀에서 다시 표본을 뽑아 기준선을 계산하면 실행할 때마다 목표가
// 달라지므로, 최초 규격을 불변 기준선으로 기록한다.
report.subjects['job-adaptation'] = [{ key: 'full-form', count: 160 }]

const personalityMap = new Map()
for (const item of (personalityBank.items || []).filter(isBaseline)) {
  add(personalityMap, [item.kind, item.dim || item.kind].join(' > '))
}
report.subjects.personality = rows(personalityMap)

for (const [subject, subjectRows] of Object.entries(report.subjects)) {
  if (!Array.isArray(subjectRows) || !subjectRows.every(row => Number.isFinite(row.count))) continue
  report[`${subject}Total`] = subjectRows.reduce((sum, row) => sum + row.count, 0)
}

const output = resolve('data/assessment-expansion-baseline.json')
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
console.log(`baseline written: ${output}`)
