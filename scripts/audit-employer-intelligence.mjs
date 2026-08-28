import {
  INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
  INTERVIEW_ORGANIZATIONS,
} from '../src/lib/interviewCareerContent.js'
import { buildEmployerFit } from '../src/lib/employerIntelligence.js'

const failures = []
const fail = message => failures.push(message)
const letters = ['A', 'B', 'C', 'D']
const counts = Object.fromEntries(['finance', 'public', 'enterprise'].map(sector => [sector, INTERVIEW_ORGANIZATIONS.filter(item => item.sector === sector).length]))
const studentProfiles = [
  ['business', '회계정보과', 'school-club'],
  ['software', '소프트웨어개발과', 'major-practice'],
  ['electrical', '전기제어과', 'major-practice'],
  ['mechanical', '스마트기계과', 'competition'],
  ['architecture', '건축토목과', 'major-practice'],
  ['food', '조리식품과', 'volunteer'],
  ['service', '관광서비스과', 'part-time'],
  ['design', '시각디자인과', 'school-club'],
  ['bio', '바이오화학과', 'major-practice'],
  ['general', '직업계고 공통과정', 'school-event'],
].map(([majorGroup, departmentName, sourceType], index) => ({
  majorGroup,
  departmentName,
  sourceType,
  evidenceTitle: `${departmentName} 대표 활동 ${index + 1}`,
  evidenceSkills: ['확인', '기록', '협업'],
  evidenceAction: '기준을 확인하고 역할을 나누어 수행 과정을 기록함',
  evidenceResult: '오류를 바로잡고 다음 활동에 쓸 확인표를 남김',
}))

if (INTERVIEW_ORGANIZATIONS.length < 120) fail(`지원처가 ${INTERVIEW_ORGANIZATIONS.length}곳뿐임(최소 120곳)`)
if (counts.finance < 30) fail(`금융권이 ${counts.finance}곳뿐임(최소 30곳)`)
if (counts.public < 40) fail(`공공기관이 ${counts.public}곳뿐임(최소 40곳)`)
if (counts.enterprise < 50) fail(`대기업이 ${counts.enterprise}곳뿐임(최소 50곳)`)

for (const field of ['id', 'name']) {
  const values = INTERVIEW_ORGANIZATIONS.map(item => item[field])
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length) fail(`${field} 중복: ${[...new Set(duplicates)].join(', ')}`)
}

for (const organization of INTERVIEW_ORGANIZATIONS) {
  const label = `${organization.name}(${organization.id})`
  if (!/^https:\/\//.test(organization.officialUrl || '')) fail(`${label}: HTTPS 공식 주소 없음`)
  if ((organization.roles || []).length < 3) fail(`${label}: 직무 3개 미만`)
  if ((organization.values || []).length < 3) fail(`${label}: 가치 기준 3개 미만`)
  if (!organization.identity || organization.identity.length < 20) fail(`${label}: 핵심 정체성이 지나치게 짧음`)
  if (!/^2026-\d{2}$/.test(organization.verifiedAt || '')) fail(`${label}: 검증 기준월 형식 오류`)
  if ((organization.intelligence?.themes || []).length !== 3) fail(`${label}: 분석 주제 3개가 아님`)
  if ((organization.intelligence?.timeline || []).length !== 3) fail(`${label}: 연도 확인 흐름 3단계가 아님`)
  if ((organization.intelligence?.provenance || []).length < 2) fail(`${label}: 공식·교차 출처가 부족함`)
  if (organization.intelligence?.provenance?.some(item => !/^https:\/\//.test(item.url || ''))) fail(`${label}: 출처 URL이 HTTPS가 아님`)
  if ((organization.questions || []).length !== 3) fail(`${label}: 면접 핵심 질문이 3개가 아님`)
  if ((organization.officialChecks || []).length !== 4) fail(`${label}: 공식 자료 확인 절차가 4개가 아님`)
  if ((organization.interviewCourse || []).length !== 5) fail(`${label}: 순차 학습 과정이 5단계가 아님`)
  if ((organization.sampleCoverLetter || []).length !== 4) fail(`${label}: 자기소개서 완성 예시가 4개 항목이 아님`)
  if (!organization.fieldExamples || Object.values(organization.fieldExamples).some(value => !String(value || '').trim())) fail(`${label}: 자기소개서 작성 근거 예시 누락`)
  if (organization.interviewCourse?.some((step, index) => !step.id || !step.title || !step.goal || !step.output || (step.tasks || []).length !== 3 || index > 0 && step.id === organization.interviewCourse[index - 1].id)) fail(`${label}: 순차 학습 단계 내용 누락·중복`)
  if (organization.questions?.some(item => !item.question || !item.answerGuide || !item.model || /undefined|null/.test(JSON.stringify(item)))) fail(`${label}: 면접 질문·답변 골격 누락`)
  if (organization.sampleCoverLetter?.some(item => !item.title || String(item.body || '').length < 80 || /undefined|null/.test(JSON.stringify(item)))) fail(`${label}: 자기소개서 예시가 짧거나 손상됨`)
  for (const context of studentProfiles) {
    const fit = buildEmployerFit(organization, context)
    if (!Number.isFinite(fit.score) || fit.score < 0 || fit.score > 100) fail(`${label}/${context.majorGroup}: 맞춤 점수 범위 오류`)
    if (!organization.roles.includes(fit.role)) fail(`${label}/${context.majorGroup}: 추천 직무가 지원처 직무 목록에 없음`)
    if (!fit.level || !fit.studentLabel || fit.matches.length < 2 || fit.gaps.length !== 3) fail(`${label}/${context.majorGroup}: 맞춤 연결·보완 정보 부족`)
    if (!fit.draftBridge.includes(organization.name) || /undefined|null|\[object Object\]/.test(fit.draftBridge)) fail(`${label}/${context.majorGroup}: 맞춤 지원 문장 손상`)
  }
  const corpus = JSON.stringify(organization)
  if (/남학생|여학생|남성에게|여성에게|성별에 따라/.test(corpus)) fail(`${label}: 성별 고정관념 문구 발견`)
  if (/undefined|null|\[object Object\]/.test(corpus)) fail(`${label}: 화면에 노출될 수 있는 손상 문자열 발견`)
}

const identities = INTERVIEW_ORGANIZATIONS.map(item => item.identity)
const duplicateIdentities = identities.filter((value, index) => identities.indexOf(value) !== index)
if (duplicateIdentities.length) fail(`핵심 정체성 완전 중복: ${[...new Set(duplicateIdentities)].join(' / ')}`)

const organizationQuestions = INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.filter(item => item.id.startsWith('IVO-'))
if (organizationQuestions.length !== INTERVIEW_ORGANIZATIONS.length * 5) fail(`지원처 평가문항 수 오류: ${organizationQuestions.length}`)
for (const organization of INTERVIEW_ORGANIZATIONS) {
  const questions = organizationQuestions.filter(item => item.lessonId === `ORG-${organization.id}`)
  if (questions.length !== 5) fail(`${organization.name}: 평가문항이 ${questions.length}개임`)
  if (new Set(questions.map(item => item.stem)).size !== questions.length) fail(`${organization.name}: 평가문항 질문 중복`)
  for (const question of questions) {
    const answerIndex = letters.indexOf(question.answer)
    if (answerIndex < 0 || answerIndex >= question.choices.length) fail(`${organization.name}/${question.id}: 정답 위치 오류`)
    if (!question.explanation || !question.stem.includes(organization.name)) fail(`${organization.name}/${question.id}: 지원처 전용 문장·해설 누락`)
  }
}

const answerCounts = Object.fromEntries(letters.map(letter => [letter, organizationQuestions.filter(item => item.answer === letter).length]))
const answerSpread = Math.max(...Object.values(answerCounts)) - Math.min(...Object.values(answerCounts))
if (answerSpread > Math.ceil(organizationQuestions.length * 0.08)) fail(`지원처 평가 정답 위치 편중: ${JSON.stringify(answerCounts)}`)

if (failures.length) {
  console.error(`\n[employer-intelligence] ${failures.length}개 실패`)
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`[employer-intelligence] 통과: ${INTERVIEW_ORGANIZATIONS.length}곳 (금융 ${counts.finance} · 공공 ${counts.public} · 대기업 ${counts.enterprise})`)
console.log(`[employer-intelligence] 상세자료·5단계 학습·자기소개서·600개 평가문항·맞춤 조합 ${INTERVIEW_ORGANIZATIONS.length * studentProfiles.length}건 검증 완료`)
console.log(`[employer-intelligence] 정답 위치 분포 ${Object.entries(answerCounts).map(([key, value]) => `${key} ${value}`).join(' · ')}`)
