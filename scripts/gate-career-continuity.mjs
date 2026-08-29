import fs from 'node:fs'
import {
  CAREER_PROFILE_REFERENCES,
  SCHOOL_GRADE_OPTIONS,
  careerContextForEngine,
  careerEvidenceQuality,
  careerEvidenceSeeds,
  careerGradeRoadmap,
  careerProfileReadiness,
  careerProfileSnapshot,
  normalizeCareerContext,
} from '../src/lib/careerProfile.js'

const fail = message => { throw new Error(`[career-continuity] ${message}`) }
const expect = (condition, message) => { if (!condition) fail(message) }
const read = file => fs.readFileSync(file, 'utf8')

const legacy = normalizeCareerContext({
  departmentName: '스마트기계과',
  majorGroup: 'mechanical',
  qualifications: [{ name: '자동차정비기능사', issuer: '한국산업인력공단' }],
  extracurricularActivities: [{ category: 'club', name: '자동차 동아리' }],
})
expect(legacy.currentGrade === 1 && legacy.qualifications[0].grade === 1, '기존 회원정보의 1학년 기본 마이그레이션 실패')

const profile = normalizeCareerContext({
  currentGrade: 2,
  departmentName: '스마트기계과',
  majorGroup: 'mechanical',
  targetIndustry: '자동차 부품',
  targetRole: '생산설비',
  semesterGoal: '설비보전기능사 취득과 실습 근거 2장 완성',
  lastReviewedAt: '2026-08-29T00:00:00.000Z',
  qualifications: [
    { id: 'q-weak', name: '워드프로세서', status: 'planned', grade: 1 },
    { id: 'q-strong', name: '설비보전기능사', issuer: '한국산업인력공단', status: 'acquired', grade: 2, achievedAt: '2026-06-01', proof: '합격 확인서', profileId: 'machine-maintenance' },
  ],
  extracurricularActivities: [
    { id: 'a-weak', category: 'other', name: '개인 학습', grade: 1 },
    { id: 'a-strong', category: 'competition', name: '기능경기대회', organizer: '학교', grade: 2, period: '2026.03~07', role: '측정 담당', outcome: '공차 오류 2건 수정', proof: '작업일지', skills: ['측정', '검산'] },
  ],
})

const engine = careerContextForEngine(profile)
expect(engine.qualificationName === '설비보전기능사', '배열 첫 항목이 아닌 가장 강한 자격 선별 실패')
expect(engine.activityName === '기능경기대회' && engine.activityOutcome.includes('오류'), '가장 구체적인 활동 선별 실패')
expect(engine.qualificationSummary.length === 2 && engine.activitySummary.length === 2, '복수 자격·활동 엔진 전달 실패')

const emptyScore = careerProfileReadiness({}, { evidenceCount: 0 }).score
const ready = careerProfileReadiness(profile, { evidenceCount: 3 })
expect(ready.score > emptyScore && ready.score >= 75, '준비도 점수가 기록 충실도에 따라 상승하지 않음')
expect(ready.checks.length === 5 && ready.counts.evidence === 3, '준비도 세부 지표 누락')

expect(SCHOOL_GRADE_OPTIONS.length === 3, '고등학교 3개 학년 로드맵 계약 누락')
const stages = SCHOOL_GRADE_OPTIONS.map(item => careerGradeRoadmap({ ...profile, currentGrade: item.id }, { evidenceCount: 1 }).stage)
expect(new Set(stages).size === 3, '학년별 추천 단계가 구분되지 않음')

const seeds = careerEvidenceSeeds(profile)
expect(seeds[0].careerSourceId === 'a-strong' && seeds[0].action === '', '활동→근거 전환에서 학생 행동을 임의 생성함')
expect(seeds[0].task.includes('측정 담당') && seeds[0].result.includes('오류 2건'), '활동의 역할·결과 연결 실패')
const quality = careerEvidenceQuality({ ...seeds[0], action: '도면과 측정값을 대조하고 오류 위치를 표시해 팀원과 다시 측정했습니다.' })
expect(quality.score === 100, '완성 근거 품질 판정 실패')

const snapshot = careerProfileSnapshot(profile, { evidenceCount: 3 })
expect(snapshot.readiness.score === ready.score && snapshot.qualifications.length === 2, '교사 제출용 스냅샷 누락')
expect(CAREER_PROFILE_REFERENCES.length >= 4 && CAREER_PROFILE_REFERENCES.every(item => item.url.startsWith('https://')), '공식 근거 출처 등록 누락')

const account = read('src/screens/student/AccountDataScreen.jsx')
const careerLab = read('src/screens/student/InterviewCareerLab.jsx')
const teacher = read('src/screens/teacher/CareerPortfolioScreen.jsx')
const review = read('src/screens/teacher/CoverLetterReviewScreen.jsx')
const migration = read('supabase/migrations/20260829160000_student_career_profiles.sql')
for (const token of ['careerProfileReadiness', 'careerGradeRoadmap', '근거 카드로 발전', '담당 선생님 지도']) expect(account.includes(token), `학생 장기 프로필 UI 연결 누락: ${token}`)
for (const token of ['careerEvidenceSeeds', 'careerEvidenceQuality', 'careerProfileSnapshot', 'career_source_id']) expect(careerLab.includes(token), `근거은행·제출 연결 누락: ${token}`)
for (const token of ['rpc_class_career_profiles', 'rpc_review_student_career_profile', '취업 준비 자산']) expect(teacher.includes(token), `교사 성장 지도 연결 누락: ${token}`)
expect(review.includes('careerProfileSnapshot') && review.includes('제출 시점 취업 준비정보'), '교사 첨삭 스냅샷 연결 누락')
for (const token of ['student_career_profiles', 'student_career_feedback', 'SECURITY DEFINER', 'teacher_classes', 'auth.uid()']) expect(migration.includes(token), `담당 학급 권한 계약 누락: ${token}`)

console.log(`[career-continuity] PASS - 3개 학년 로드맵 · 복수 기록 선별 · 근거 품질 · 학생/교사/첨삭/동기화 연결`)
