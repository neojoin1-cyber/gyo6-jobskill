import fs from 'node:fs'
import path from 'node:path'
import { buildInterviewConceptChecks, buildInterviewLearningQuestions } from '../src/lib/interviewLearning.js'
import { studyQuestionsById } from '../src/lib/assessmentPartition.js'
import {
  COVER_LETTER_FIELDS,
  COVER_LETTER_QUESTION_LIBRARY,
  COVER_LETTER_STEPS,
  INTERVIEW_CAREER_ASSESSMENT_QUESTIONS,
  INTERVIEW_CAREER_SCOPES,
  INTERVIEW_ORGANIZATIONS,
  INTERVIEW_TRACKS,
} from '../src/lib/interviewCareerContent.js'
import { INTERVIEW_FOUNDATION_COURSES } from '../src/lib/interviewFoundationCourses.js'

const ROOT = process.cwd()
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))

const study = readJson('data/interview-study.json')
const quiz = readJson('data/interview-quiz.json').questions
const mockData = readJson('data/mock-interview-pool.json')
const mock = mockData.pool
const studyText = JSON.stringify(study)
const quizText = JSON.stringify(quiz)
const screen = fs.readFileSync(path.join(ROOT, 'src/screens/student/InterviewStudyScreen.jsx'), 'utf8')
const careerScreen = fs.readFileSync(path.join(ROOT, 'src/screens/student/InterviewCareerLab.jsx'), 'utf8')
const teacherReviewScreen = fs.readFileSync(path.join(ROOT, 'src/screens/teacher/CoverLetterReviewScreen.jsx'), 'utf8')
const coverMigration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260825003000_cover_letter_coaching.sql'), 'utf8')

const requiredScopes = [
  '오리엔테이션', '면접절차', '평가기준', '자기소개', '지원동기', '경험답변',
  '인성면접', '블라인드', '상황면접', 'PT/발표', '토론/그룹', '직무면접',
  '직장태도', '모의면접', '준비 루틴', '블라인드 안전',
]

check(study.lessons.length >= 48, `면접 자율학습 48단원 미만: ${study.lessons.length}`)
check(INTERVIEW_FOUNDATION_COURSES.length === 6, `면접 기초 과정 수 오류: ${INTERVIEW_FOUNDATION_COURSES.length}`)
const groupedCategories = INTERVIEW_FOUNDATION_COURSES.flatMap(course => course.categories)
check(new Set(groupedCategories).size === requiredScopes.length, '면접 기초 과정에 중복되거나 누락된 범주가 있음')
check(requiredScopes.every(scope => groupedCategories.includes(scope)), '면접 기초 16개 원시 범주가 6개 과정에 모두 연결되지 않음')
check(quiz.length >= 168, `면접 진단·확인문항 168개 미만: ${quiz.length}`)
check(mock.length === quiz.length, `면접 모의풀과 확인문항 수 불일치: ${mock.length}/${quiz.length}`)
check(new Set(quiz.map(question => question.id)).size === quiz.length, '면접 문항 ID 중복')

for (const scope of requiredScopes) {
  check(mockData.scopes?.some(item => item.key === scope), `면접 필수 범주 누락: ${scope}`)
}
for (const lesson of study.lessons) {
  check(quiz.some(question => question.lessonId === lesson.id), `면접 단원 확인문항 누락: ${lesson.id}`)
}

const studyLane = studyQuestionsById(quiz)
for (const lesson of study.lessons) {
  const practices = buildInterviewLearningQuestions(lesson, studyLane).filter(question => question.isInterview)
  check(practices.length >= 5, `면접 단원 답변연습 5개 미만: ${lesson.id}/${practices.length}`)
  const conceptChecks = buildInterviewConceptChecks(lesson, studyLane)
  check(conceptChecks.length >= 5, `면접 단원 개념확인 5개 미만: ${lesson.id}/${conceptChecks.length}`)
}

check(INTERVIEW_TRACKS.length === 3, `지원처 심화 트랙 수 오류: ${INTERVIEW_TRACKS.length}`)
for (const track of INTERVIEW_TRACKS) {
  check(track.modules.length >= 4, `지원처 심화 모듈 부족: ${track.id}`)
  check(track.modules.every(module => module.lessons?.length >= 3), `지원처 심화 실제 학습 단원 부족: ${track.id}`)
  check(track.modules.every(module => module.lessons.every(lesson => lesson.concept?.length >= 25 && lesson.example?.length >= 25 && lesson.trap?.length >= 15 && lesson.practice?.length >= 18)), `지원처 심화 단원 구성 부족: ${track.id}`)
}
check(INTERVIEW_ORGANIZATIONS.length >= 45, `기업·기관 연구 대상 45곳 미만: ${INTERVIEW_ORGANIZATIONS.length}`)
for (const sector of ['finance', 'public', 'enterprise']) {
  check(INTERVIEW_ORGANIZATIONS.filter(item => item.sector === sector).length >= 15, `${sector} 기관 연구 15곳 미만`)
}
for (const id of ['kdb', 'ibk', 'kexim', 'kb', 'shinhan', 'hana', 'woori', 'nh']) {
  check(INTERVIEW_ORGANIZATIONS.some(item => item.id === id), `필수 금융기관 누락: ${id}`)
}
for (const item of INTERVIEW_ORGANIZATIONS) {
  check(/^https:\/\//.test(item.officialUrl), `기관 공식 URL 오류: ${item.id}`)
  check(item.roles.length >= 3 && item.values.length >= 3, `기관 직무·가치 정보 부족: ${item.id}`)
  check(item.evidenceExamples?.length >= 3 && item.evidenceExamples.every(value => value.examples?.length >= 3), `기관 증명 사례 부족: ${item.id}`)
  check(item.questions?.length >= 3 && item.questions.every(question => question.model?.length >= 80), `기관 모범답안 부족: ${item.id}`)
  check(item.officialChecks?.length >= 4 && item.officialChecks.every(checkItem => checkItem.method?.length >= 35), `기관 공식자료 점검법 부족: ${item.id}`)
  check(item.interviewCourse?.length >= 5 && item.interviewCourse.every(stage => stage.tasks?.length >= 3 && stage.output?.length >= 25), `기관 면접 완성과정 부족: ${item.id}`)
  check(item.sampleCoverLetter?.length >= 4 && item.sampleCoverLetter.every(section => section.body?.length >= 150), `기관별 자기소개서 완성 예시 부족: ${item.id}`)
  check(item.recommendedQuestionIds?.length >= 5, `기관별 추천 자기소개서 문항 부족: ${item.id}`)
  check(item.coverLetterBridge?.length >= 40, `기관 자기소개서 연결 안내 부족: ${item.id}`)
}
check(COVER_LETTER_STEPS.length === 7, `자기소개서 단계 오류: ${COVER_LETTER_STEPS.length}`)
check(COVER_LETTER_FIELDS.length >= 11, `자기소개서 개인화 입력 부족: ${COVER_LETTER_FIELDS.length}`)
check(COVER_LETTER_QUESTION_LIBRARY.length >= 16, `자기소개서 문항 라이브러리 부족: ${COVER_LETTER_QUESTION_LIBRARY.length}`)
check(COVER_LETTER_QUESTION_LIBRARY.every(item => item.question?.length >= 25 && item.required?.length >= 2 && item.limit >= 200), '자기소개서 문항 메타데이터 부족')
for (const field of COVER_LETTER_FIELDS) {
  check(field.key && field.step && field.label, `자기소개서 필드 메타데이터 오류: ${JSON.stringify(field)}`)
  check(field.required?.length >= 2 && field.caution?.length >= 12, `자기소개서 필수·주의 안내 부족: ${field.key}`)
  check(['finance', 'public', 'enterprise'].every(sector => field.examples?.[sector]?.length >= 4), `자기소개서 분야별 예시 누락: ${field.key}`)
}
check(INTERVIEW_CAREER_SCOPES.length === 4, `면접 심화 평가 범위 오류: ${INTERVIEW_CAREER_SCOPES.length}`)
check(INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.length >= 330, `면접 심화 평가문항 부족: ${INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.length}`)
check(new Set(INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.map(question => question.id)).size === INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.length, '면접 심화 평가문항 ID 중복')
for (const question of INTERVIEW_CAREER_ASSESSMENT_QUESTIONS) {
  check(question.choices?.length === 4, `면접 심화 4지선다 오류: ${question.id}`)
  check(/^[A-D]$/.test(question.answer), `면접 심화 정답 오류: ${question.id}`)
  check(question.explanation?.length >= 20, `면접 심화 해설 부족: ${question.id}`)
}

for (const question of quiz) {
  check(typeof question.stem === 'string' && question.stem.length >= 10, `면접 지문 부족: ${question.id}`)
  check(question.type === 'ox' || (Array.isArray(question.choices) && question.choices.length >= 2), `면접 선택지 누락: ${question.id}`)
  const choices = Array.isArray(question.choices) && question.choices.length >= 2
    ? question.choices
    : question.type === 'ox'
      ? ['O', 'X']
      : []
  const answerIndex = question.type === 'ox'
    ? ({ O: 0, X: 1 }[question.answer] ?? -1)
    : String(question.answer || '').charCodeAt(0) - 65
  check(answerIndex >= 0 && answerIndex < choices.length, `면접 정답 인덱스 오류: ${question.id}`)
  check(typeof question.explanation === 'string' && question.explanation.length >= 25, `면접 해설 부족: ${question.id}`)
}

const fixedWeightQuestions = quiz.filter(question => /%|비중|가중치|합격권|몇 점/.test(question.stem))
check(fixedWeightQuestions.length === 0, `기관 근거 없는 고정 배점 암기문항: ${fixedWeightQuestions.map(q => q.id).join(', ')}`)
check(!/없으면 만들어서라도|7-38-55|황금비율|기본 합격권/.test(studyText), '면접 학습자료에 허위 수치·고정비율·합격선 표현 잔존')
check(studyText.includes('전국 공통 고정 배점 시험이 아님'), '면접 기관별 평가기준 안내 누락')
check(studyText.includes('채용공고와 직무기술서'), '면접 직무기술서 기반 안내 누락')
check(quizText.includes('메라비언의 제한된 연구 수치를 면접 평가비중으로 일반화하면 안 됩니다'), '7-38-55 오용 교정 문항 누락')

check(screen.includes('모범답안 펼치기'), '면접 모범답안 펼치기 조작 누락')
check(screen.includes('INTERVIEW_FOUNDATION_COURSES'), '면접 학습 화면의 6개 과정 분류 누락')
check(screen.includes('먼저 답을 떠올린 뒤'), '면접 인출연습 안내 누락')
check(/const\s*\[showModel\s*,\s*setShowModel\]\s*=\s*useState\(false\)/.test(screen), '면접 모범답안 초기 접힘 상태 관리 누락')
check(screen.includes("setCareerSection('institutions')"), '기업·기관 연구소 진입 누락')
check(screen.includes("setCareerSection('cover')"), '자기소개서 완성실 진입 누락')
check(careerScreen.includes("localStorage.setItem('iv_cover_draft'"), '자기소개서 로컬 저장 누락')
check(careerScreen.includes('공식 사이트에서 최신 정보 확인'), '기관 공식자료 확인 링크 누락')
check(careerScreen.includes("import('html2canvas')") && careerScreen.includes("import('jspdf')"), '자기소개서 PDF 생성 누락')
check(careerScreen.includes("rpc('rpc_submit_cover_letter'"), '자기소개서 교사 첨삭 요청 누락')
check(careerScreen.includes('QuestionComposer') && careerScreen.includes('직접 추가'), '자기소개서 문항 선택·직접 추가 누락')
check(careerScreen.includes('완성 예시 자기소개서') || careerScreen.includes('완성 예시 보기'), '기관별 자기소개서 완성 예시 화면 누락')
check(teacherReviewScreen.includes("rpc('rpc_teacher_cover_letters'"), '교사 자기소개서 목록 조회 누락')
check(teacherReviewScreen.includes("rpc('rpc_review_cover_letter'"), '교사 자기소개서 첨삭 저장 누락')
check(teacherReviewScreen.includes('captureSelection') && teacherReviewScreen.includes('부분 메모 추가'), '교사 문장 형광펜·부분 메모 누락')
check(coverMigration.includes('SECURITY DEFINER') && coverMigration.includes('teacher_classes'), '자기소개서 담당 학급 권한 검증 누락')
check(coverMigration.includes('FROM PUBLIC, anon'), '자기소개서 RPC 익명 실행 차단 누락')

for (const file of ['data/interview-study.json', 'data/interview-quiz.json', 'data/mock-interview-pool.json']) {
  check(!fs.readFileSync(path.join(ROOT, file), 'utf8').includes('\uFFFD'), `깨진 문자 U+FFFD: ${file}`)
}

if (failures.length) {
  console.error(`Interview release audit FAILED (${failures.length})`)
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Interview release audit PASS: 기초 ${study.lessons.length}단원 · 기본 ${quiz.length}문항 · 심화 ${INTERVIEW_CAREER_ASSESSMENT_QUESTIONS.length}문항 · 기관 ${INTERVIEW_ORGANIZATIONS.length}곳 · 자기소개서 ${COVER_LETTER_STEPS.length}단계`)
