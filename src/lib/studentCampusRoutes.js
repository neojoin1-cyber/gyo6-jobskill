export const STUDENT_CAMPUS_HALLS = [
  { id: 'job-common', label: '교육부 직업공통능력관', badge: '인증평가', authority: '교육부·대한상공회의소' },
  { id: 'ncs-basic', label: 'NCS 직업기초능력관', badge: '고졸공채 필기', authority: '고용노동부·한국산업인력공단' },
  { id: 'recruit-written', label: '채용필기 심화관', badge: '고졸공채 필기', authority: '공공기관·금융권·대기업 추가 출제영역' },
  { id: 'personality', label: '인성검사훈련관', badge: '고졸공채 인성검사', authority: '정답 없는 응답 경향 검사' },
  { id: 'interview', label: '면접 스킬관', badge: '고졸 채용', authority: '특성화고 공정채용 면접' },
  { id: 'cover-letter', label: '자기소개서관', badge: '고졸 채용', authority: '자기소개서 학습·진단·작성·첨삭' },
]

export const STUDENT_SUBJECT_IDS = new Set(STUDENT_CAMPUS_HALLS.map(hall => hall.id))

/** 홈 학습관은 해당 과목의 소개·학습방식 선택 화면부터 연다. */
export function campusCourseTarget(subject) {
  if (!subject) return null
  if (!STUDENT_SUBJECT_IDS.has(subject)) throw new Error(`Unknown student campus subject: ${subject}`)
  return { subject, area: null, lesson: null, mode: null }
}
