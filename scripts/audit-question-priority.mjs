import fs from 'node:fs'
import path from 'node:path'
import { QUESTION_PRIORITY, questionPriority, questionPrioritySources } from '../src/lib/questionPriority.js'
import { jcStudyQuestions, buildJcAreaPaper, JC_AREAS_ORDER } from '../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../src/lib/ncs2026.js'
import { recruitWrittenQuestions } from '../src/lib/recruitWritten.js'
import interviewQuizData from '../data/interview-quiz.json' with { type: 'json' }

const failures = []
const counts = { latest: 0, frequent: 0, past: 0, important: 0 }

function inspect(subjectId, questions) {
  let tagged = 0
  for (const question of questions) {
    const priority = questionPriority(question, subjectId)
    if (!priority) continue
    tagged += 1
    counts[priority.key] = (counts[priority.key] || 0) + 1
    if (!priority.reason) failures.push(`${subjectId}/${question.id || question.stem}: 판정 이유 없음`)
    if (!priority.sources?.length) failures.push(`${subjectId}/${question.id || question.stem}: 공식 근거 없음`)
    for (const source of priority.sources || []) {
      if (!/^https:\/\/(?:www\.)?(?:teenup\.or\.kr|ncs\.go\.kr|job\.alio\.go\.kr|alio\.go\.kr)\//.test(source.url || '')) {
        failures.push(`${subjectId}/${question.id || question.stem}: 허용되지 않은 근거 URL ${source.url || '(없음)'}`)
      }
    }
  }
  if (!tagged) failures.push(`${subjectId}: 중요도 배지가 적용되는 문항 없음`)
  return tagged
}

const jobAssessment = JC_AREAS_ORDER
  .filter(area => area !== '직무적응')
  .flatMap(area => buildJcAreaPaper(area, 1))

const subjectCounts = {
  'job-common': inspect('job-common', [...jcStudyQuestions(), ...jobAssessment]),
  'ncs-basic': inspect('ncs-basic', ncs2026Questions),
  'recruit-written': inspect('recruit-written', recruitWrittenQuestions),
  interview: inspect('interview', interviewQuizData.questions || []),
}

for (const key of Object.keys(counts)) {
  if (!counts[key]) failures.push(`${key}: 해당 단계의 검증 문항 없음`)
}

for (const [key, source] of Object.entries(questionPrioritySources())) {
  if (!source.label || !source.year || !source.url) failures.push(`근거 원장 ${key}: 필수 정보 누락`)
}

const repoRoot = process.cwd()
const study = fs.readFileSync(path.join(repoRoot, 'src/screens/student/StudyScreen.jsx'), 'utf8')
const summary = fs.readFileSync(path.join(repoRoot, 'src/screens/student/StudySummary.jsx'), 'utf8')
const diagnostic = fs.readFileSync(path.join(repoRoot, 'src/screens/student/DiagnosticScreen.jsx'), 'utf8')
const mission = fs.readFileSync(path.join(repoRoot, 'src/screens/student/MissionScreen.jsx'), 'utf8')
const mockData = fs.readFileSync(path.join(repoRoot, 'src/lib/mockData.js'), 'utf8')

if (!study.includes('QuestionPriorityBadge')) failures.push('자율학습 문항 화면에 중요도 배지 없음')
if (!summary.includes('QuestionPriorityBadge')) failures.push('자율학습 핵심 카드에 중요도 배지 없음')
if (!diagnostic.includes('QuestionPriorityBadge')) failures.push('진단평가 화면에 중요도 배지 없음')
if (!mission.includes('QuestionPriorityBadge')) failures.push('모의고사 공통 응시 화면에 중요도 배지 없음')
if (!mockData.includes('questionPriorityWeight')) failures.push('진단·모의 출제 가중치가 공통 중요도 원장을 사용하지 않음')
if (/isAGrade\s*&&[^\n]*빈출/.test(study)) failures.push('난도·A등급을 빈출 근거로 오표시함')
const badge = fs.readFileSync(path.join(repoRoot, 'src/screens/student/QuestionPriorityBadge.jsx'), 'utf8')
if (!badge.includes('role="dialog"') || !badge.includes('priority.sources.map')) failures.push('배지를 눌러 판정 이유와 공식 근거를 확인할 수 없음')
if (QUESTION_PRIORITY?.past?.label === '기출') failures.push('원문 출처가 없는 평가영역 연계 문항을 기출로 표시함')

if (failures.length) {
  console.error(`[학습 중요도 배지] 실패 ${failures.length}건`)
  failures.slice(0, 80).forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

console.log(`[학습 중요도 배지] 통과 - 최신 ${counts.latest} · 빈출 ${counts.frequent} · 평가연계 ${counts.past} · 중요 ${counts.important}`)
console.log(`  화면 적용 - 자율학습 ${subjectCounts['job-common'] + subjectCounts['ncs-basic'] + subjectCounts['recruit-written']} · 진단 공통 · 모의고사 공통 · 면접 ${subjectCounts.interview}`)
