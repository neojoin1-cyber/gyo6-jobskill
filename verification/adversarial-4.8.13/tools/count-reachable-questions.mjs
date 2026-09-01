// 홍보물이 말하는 "검증 문항 5,765"와 실제로 학생이 만날 수 있는 문항 수를 대조한다.
// 기준선 ee6aee89abf8
import { jcStudyQuestions, englishStudyQuestions, jobCommonMediaQuestions } from '../../../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../../../src/lib/ncs2026.js'
import { recruitWrittenQuestions } from '../../../src/lib/recruitWritten.js'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../../../src/lib/coverAssessmentBank.js'
import { INTERVIEW_CAREER_ASSESSMENT_QUESTIONS } from '../../../src/lib/interviewCareerContent.js'
import interviewQuiz from '../../../data/interview-quiz.json'
import personalityBank from '../../../data/personality-test-bank.json'
import foodServiceBank from '../../../src/lib/foodServiceBank.js'
import qualityPractice from '../../../data/quality-mgmt-practice.json'

const lanes = {
  '직업공통(자율학습·미션·모의)': [...jcStudyQuestions(), ...englishStudyQuestions, ...jobCommonMediaQuestions],
  'NCS 26v1': ncs2026Questions,
  '채용필기(트랙 복제 포함)': recruitWrittenQuestions,
  '자기소개서 진단': COVER_DIAGNOSTIC_QUESTIONS,
  '면접 기초 확인문항': interviewQuiz.questions || [],
  '면접 심화 평가문항': INTERVIEW_CAREER_ASSESSMENT_QUESTIONS || [],
  '인성검사 문항': personalityBank.items || [],
  '식음료(은퇴)': foodServiceBank,
  '품질경영(은퇴)': qualityPractice.units.flatMap(u => [...(u.questions || []), ...((u.sections || []).flatMap(s => s.questions || []))]),
}

const seen = new Set()
let total = 0, excluded = 0
const rows = []
for (const [name, list] of Object.entries(lanes)) {
  const usable = (list || []).filter(q => q && !q.excludeFromQuiz)
  excluded += (list || []).length - usable.length
  const fresh = usable.filter(q => q.id && !seen.has(q.id))
  fresh.forEach(q => seen.add(q.id))
  total += usable.length
  rows.push({ lane: name, 전체: (list || []).length, 출제가능: usable.length, 신규id: fresh.length })
}
console.log('lane'.padEnd(28), '전체'.padStart(7), '출제가능'.padStart(9), '신규id'.padStart(8))
for (const r of rows) console.log(r.lane.padEnd(28), String(r.전체).padStart(7), String(r.출제가능).padStart(9), String(r.신규id).padStart(8))
console.log('\n중복 제외 실제 도달 가능 문항(고유 id):', seen.size)
console.log('출제 제외 표시(excludeFromQuiz):', excluded)
console.log('홍보물 표기: 5,765 검증 문항 · 172 학습 단원')
