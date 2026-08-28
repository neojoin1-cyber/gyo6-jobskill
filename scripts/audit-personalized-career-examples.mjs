import fs from 'node:fs'
import path from 'node:path'
import { COVER_LETTER_QUESTION_LIBRARY } from '../src/lib/coverQuestionLibrary.js'
import {
  PERSONALIZED_ACTIVITY_PROFILES,
  PERSONALIZED_EXAMPLE_STYLES,
  PERSONALIZED_MAJOR_PROFILES,
  buildPersonalizedCoverExample,
  buildPersonalizedInterviewExample,
  departmentSpecialtyProfile,
  personalizedExampleCoverage,
} from '../src/lib/personalizedCareerExamples.js'

const catalog = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'hifive-department-catalog.json'), 'utf8'))

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const bannedBias = /(남학생|여학생|남자로서|여자로서|부모|아버지|어머니|출신\s*학교|학교명|출생지)/
const awkwardKorean = /(연습을 익혀|식로|표을|과제을|기여이|활동을 경험했습니다|전공 실습을 통해 전공 실습)/
const missingSentenceBreak = /(습니다|합니다|됩니다|입니다)\s+[가-힣A-Z0-9]/
const validGroups = new Set(PERSONALIZED_MAJOR_PROFILES.map(item => item.id))

const guidedStudySource = fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'student', 'GuidedStudyScreen.jsx'), 'utf8')
const practicalSource = fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'student', 'InterviewCareerLab.jsx'), 'utf8')
check(guidedStudySource.includes('<PersonalizedCareerExamplePanel questionId={activeCoverQuestionId}'), '자기소개서 자율학습 문항에 맞춤 예시가 연결되지 않음')
check(practicalSource.includes('canReveal={value.trim().length >= 60}'), '면접 실전 답변 선작성 잠금이 누락됨')
check(practicalSource.includes('onUseStarter={text => append(text)}'), '면접 실전 첫 문장 가져오기가 누락됨')

check(catalog.summary.schools >= 500, `HIFIVE 학교 수 부족: ${catalog.summary.schools}`)
check(catalog.summary.repeatedDepartmentNames >= 250, `2개교 이상 공통 학과 부족: ${catalog.summary.repeatedDepartmentNames}`)
check(catalog.summary.singleSchoolDepartmentNames >= 800, `한 학교 확장 학과 부족: ${catalog.summary.singleSchoolDepartmentNames}`)
check(catalog.priorityDepartments.every(item => item.schoolCount >= 2), '우선 학과군에 한 학교 학과가 섞임')
check(catalog.expansionDepartments.every(item => item.schoolCount === 1), '확장 학과군에 2개교 이상 학과가 섞임')
check([...catalog.priorityDepartments, ...catalog.expansionDepartments].every(item => validGroups.has(item.majorGroup)), 'HIFIVE 학과군 미분류 값이 있음')
const prioritySpecialized = catalog.priorityDepartments.filter(item => departmentSpecialtyProfile(item.name)).length
const expansionSpecialized = catalog.expansionDepartments.filter(item => departmentSpecialtyProfile(item.name)).length
check(prioritySpecialized / catalog.priorityDepartments.length >= 0.98, `우선 학과 세부 전공 자료 연결 부족: ${prioritySpecialized}/${catalog.priorityDepartments.length}`)
check(expansionSpecialized / catalog.expansionDepartments.length >= 0.85, `확장 학과 세부 전공 자료 연결 부족: ${expansionSpecialized}/${catalog.expansionDepartments.length}`)
const departmentNames = [...catalog.priorityDepartments, ...catalog.expansionDepartments].map(item => item.name)
check(new Set(departmentNames).size === departmentNames.length, 'HIFIVE 앱 학과명 중복')

check(PERSONALIZED_MAJOR_PROFILES.length >= 10, `개인화 학과군 부족: ${PERSONALIZED_MAJOR_PROFILES.length}`)
check(PERSONALIZED_MAJOR_PROFILES.every(item => item.certificates.length >= 4), '학과군별 자격 경로 4개 미만')
check(PERSONALIZED_ACTIVITY_PROFILES.length >= 9, `활동 유형 부족: ${PERSONALIZED_ACTIVITY_PROFILES.length}`)
check(PERSONALIZED_EXAMPLE_STYLES.length >= 4, `표현 방식 부족: ${PERSONALIZED_EXAMPLE_STYLES.length}`)
check(COVER_LETTER_QUESTION_LIBRARY.length >= 30, `자기소개서 문항 부족: ${COVER_LETTER_QUESTION_LIBRARY.length}`)

const coverage = personalizedExampleCoverage()
check(coverage.coverExamples >= 100000, `자기소개서 조합 10만 미만: ${coverage.coverExamples}`)
check(coverage.interviewExamples >= 10000, `면접 답변 조합 1만 미만: ${coverage.interviewExamples}`)

const coverIds = new Set()
const coverBodies = new Set()
const interviewIds = new Set()
const interviewBodies = new Set()
let coverCount = 0
let interviewCount = 0

for (const major of PERSONALIZED_MAJOR_PROFILES) {
  for (const certificate of major.certificates) {
    for (const activity of PERSONALIZED_ACTIVITY_PROFILES) {
      for (const style of PERSONALIZED_EXAMPLE_STYLES) {
        for (let variant = 0; variant < coverage.variants; variant += 1) {
          for (const question of COVER_LETTER_QUESTION_LIBRARY) {
            const example = buildPersonalizedCoverExample({
              questionId: question.id,
              majorGroup: major.id,
              sourceType: activity.id,
              certificateId: certificate.id,
              styleId: style.id,
              variant,
              targetName: '지원처',
              role: major.role,
            })
            coverCount += 1
            check(example.body.length >= 180, `자기소개서 예시가 짧음: ${example.id}/${example.body.length}`)
            check(example.body.includes(certificate.label), `선택 자격이 예시에 반영되지 않음: ${example.id}`)
            check(!bannedBias.test(example.body), `편견·블라인드 정보 포함: ${example.id}`)
            check(!awkwardKorean.test(example.body), `어색한 한국어 패턴 포함: ${example.id}`)
            check(!missingSentenceBreak.test(example.body), `문장 마침표 누락: ${example.id}`)
            check(!coverIds.has(example.id), `자기소개서 예시 ID 중복: ${example.id}`)
            coverIds.add(example.id)
            coverBodies.add(example.body.replace(/\s+/g, ' ').trim())
          }

          for (const type of ['introduction', 'motivation', 'closing']) {
            const example = buildPersonalizedInterviewExample({
              type,
              majorGroup: major.id,
              sourceType: activity.id,
              certificateId: certificate.id,
              styleId: style.id,
              variant,
              targetName: '지원처',
              role: major.role,
            })
            interviewCount += 1
            check(example.body.length >= (type === 'closing' ? 90 : 170), `면접 예시가 짧음: ${example.id}/${example.body.length}`)
            check(example.body.includes(certificate.label), `선택 자격이 면접 예시에 반영되지 않음: ${example.id}`)
            check(!bannedBias.test(example.body), `면접 예시에 편견·블라인드 정보 포함: ${example.id}`)
            check(!awkwardKorean.test(example.body), `면접 예시에 어색한 한국어 패턴 포함: ${example.id}`)
            check(!missingSentenceBreak.test(example.body), `면접 예시 문장 마침표 누락: ${example.id}`)
            check(!interviewIds.has(example.id), `면접 예시 ID 중복: ${example.id}`)
            interviewIds.add(example.id)
            interviewBodies.add(example.body.replace(/\s+/g, ' ').trim())
          }
        }
      }
    }

    const withoutCertificate = buildPersonalizedCoverExample({ questionId: 'experience', majorGroup: major.id, sourceType: 'team-project' })
    const certificateLeak = PERSONALIZED_MAJOR_PROFILES.flatMap(item => item.certificates).find(item => withoutCertificate.body.includes(item.label))
    check(!certificateLeak, `선택하지 않은 자격이 자동 삽입됨: ${major.id}/${certificateLeak?.label}`)
  }
}

check(coverCount === coverage.coverExamples, `자기소개서 조합 계산 불일치: ${coverCount}/${coverage.coverExamples}`)
check(interviewCount === coverage.interviewExamples, `면접 조합 계산 불일치: ${interviewCount}/${coverage.interviewExamples}`)
check(coverBodies.size >= coverCount * 0.97, `자기소개서 실질 중복 과다: ${coverBodies.size}/${coverCount}`)
check(interviewBodies.size >= interviewCount * 0.9, `면접 답변 실질 중복 과다: ${interviewBodies.size}/${interviewCount}`)

if (failures.length) {
  console.error(`Personalized career example audit FAILED (${failures.length})`)
  failures.slice(0, 80).forEach(item => console.error(`- ${item}`))
  if (failures.length > 80) console.error(`- ... ${failures.length - 80} more`)
  process.exit(1)
}

console.log(`Personalized career example audit PASS: HIFIVE ${catalog.summary.schools}개교 · 우선 학과 ${catalog.summary.repeatedDepartmentNames}개(세부 전공 ${prioritySpecialized}개) · 자기소개서 ${coverCount.toLocaleString()}개 · 면접 ${interviewCount.toLocaleString()}개`)
