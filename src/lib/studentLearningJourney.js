import { STUDENT_CAMPUS_HALLS } from './studentCampusRoutes.js'
import { getFirstClassLesson } from './firstClassLessons.js'
import { userLocalStorage as localStorage } from './userLocalStorage.js'

const KEY = 'sst.student.learning.routes.v1'

const GOALS = {
  'job-common': '직업 상황을 듣고 읽어 정확히 판단하고 표현하기',
  'ncs-basic': 'NCS 자료에서 요구·근거·계산 절차를 찾아 해결하기',
  'recruit-written': '지원처별 추가 필기 영역을 실전 수준으로 익히기',
  personality: '좋아 보이는 답이 아닌 평소 행동 기준으로 일관되게 응답하기',
  interview: '질문 의도에 맞춰 내 행동과 결과로 답하기',
  'cover-letter': '지원 직무와 내 경험을 근거 문장으로 연결해 완성하기',
}

function readResumeMap() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') }
  catch { return {} }
}

export function rememberStudentLearningContext(context) {
  if (!context?.subject || !context?.lesson && !context?.lessonId) return
  try {
    const map = readResumeMap()
    map[context.subject] = {
      subject: context.subject,
      mode: context.mode || 'study',
      track: context.track || context.trackId || null,
      area: context.area || context.areaId || null,
      lesson: context.lesson || context.lessonId || null,
      step: Number.isInteger(context.step) ? context.step : 0,
      stage: context.stage || null,
      label: context.lessonLabel || context.areaLabel || context.title || null,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch { /* 시크릿 모드에서는 이번 화면만 진행 */ }
}

export function buildStudentLearningRoutes(progressRows = []) {
  const progressBySubject = Object.fromEntries(progressRows.map(row => [row.subject_id, row]))
  const resume = readResumeMap()
  return STUDENT_CAMPUS_HALLS.map(hall => {
    const progress = progressBySubject[hall.id] || null
    const first = getFirstClassLesson(hall.id)
    const candidate = resume[hall.id] || null
    const saved = candidate?.lesson ? candidate : null
    const pct = Number(progress?.pct || 0)
    const done = Number(progress?.sections_done || 0)
    const total = Number(progress?.sections_total || 0)
    return {
      ...hall,
      goal: GOALS[hall.id],
      pct,
      hasResume: Boolean(saved),
      status: total > 0 ? `${done}/${total}개 범위 완료` : saved ? '학습 이어가기' : hall.id === 'personality' ? '응답 원칙부터 시작' : hall.id === 'cover-letter' ? '단계별 작성 시작' : '첫 학습 준비',
      nextLabel: saved?.label || first?.lessonTitle || (hall.id === 'cover-letter' ? '지원동기 근거 찾기' : '첫 학습 시작'),
      target: saved || (first ? {
        subject: hall.id,
        mode: 'study',
        track: first.match?.trackId || null,
        area: first.match?.areaId || null,
        lesson: first.match?.lessonId || null,
        step: 0,
      } : hall.id),
    }
  })
}
