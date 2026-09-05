import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowsInSimple,
  ArrowsOutSimple,
  Bell,
  Broadcast,
  Buildings,
  ChatCircleDots,
  ChartLineUp,
  CheckCircle,
  Clock,
  Compass,
  House,
  Monitor,
  Minus,
  PresentationChart,
  Plus,
  StopCircle,
  TextAa,
  UserCircle,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import StudentCampusHome from '../student/StudentCampusHome.jsx'
import CourseListScreen from '../student/CourseListScreen.jsx'
import WrongAnswerScreen from '../student/WrongAnswerScreen.jsx'
import NotificationsScreen from '../student/NotificationsScreen.jsx'
import RankingScreen from '../student/RankingScreen.jsx'
import { campusCourseTarget } from '../../lib/studentCampusRoutes.js'
import { popBack, pushBack, triggerBack } from '../../lib/backButton.js'
import { supabase } from '../../lib/supabase.js'
import { enterProjection, exitProjection, onFullscreenChange } from '../../lib/orientation.js'
import { isTeacherPhoneViewport } from '../../lib/teacherLayout.js'
import { fetchClassResponses } from '../../lib/classResponses.js'
import { LESSON_DURATIONS, lessonTiming } from '../../lib/teacherLessonGuides.js'
import TeacherLessonCoach from './TeacherLessonCoach.jsx'

const FOLLOWABLE_MODES = new Set(['study', 'diagnostic', 'mock', 'practical', 'cover-practical'])
const CLASSROOM_ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const CLASSROOM_ZOOM_STORAGE_KEY = 'gyo6_classroom_zoom'

function initialClassroomZoom(desktopPresentation) {
  if (!desktopPresentation || typeof window === 'undefined') return 1
  try {
    const stored = Number(window.localStorage.getItem(CLASSROOM_ZOOM_STORAGE_KEY))
    if (CLASSROOM_ZOOM_LEVELS.includes(stored)) return stored
    return 1
  } catch {
    return 1
  }
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function ClassroomZoomControl({ zoom, onDecrease, onReset, onIncrease }) {
  const percent = Math.round(zoom * 100)
  return (
    <div className="classroom-zoom-control" role="group" aria-label={`수업 화면 확대 ${percent}%`}>
      <button type="button" onClick={onDecrease} disabled={zoom <= CLASSROOM_ZOOM_LEVELS[0]}
        aria-label="수업 화면 축소" title="수업 화면 축소">
        <Minus weight="bold" />
      </button>
      <button type="button" className={zoom > 1 ? 'is-on' : ''} onClick={onReset}
        aria-label={`현재 확대율 ${percent}%, 100%로 초기화`}
        title="현재 배율 · 누르면 100% · 확대 중에는 드래그/휠/방향키로 이동">
        <TextAa weight="bold" /><span>{percent}%</span>
      </button>
      <button type="button" onClick={onIncrease} disabled={zoom >= CLASSROOM_ZOOM_LEVELS.at(-1)}
        aria-label="수업 화면 확대" title="수업 화면 확대">
        <Plus weight="bold" />
      </button>
    </div>
  )
}

function classFocus(context) {
  if (!context?.subject) return null
  const mode = FOLLOWABLE_MODES.has(context.mode) ? context.mode : null
  const label = [
    context.subjectLabel,
    context.modeLabel,
    context.areaLabel,
    context.lessonLabel,
    context.questionLabel,
  ].filter(Boolean).join(' · ')

  return {
    kind: 'learning',
    subject: context.subject,
    mode,
    track: context.track || context.trackId || null,
    stage: context.stage || null,
    area: context.area || context.areaId || null,
    lesson: context.lesson || context.lessonId || null,
    questionId: context.questionId || context.question?.id || null,
    index: Number.isInteger(context.index) ? context.index : null,
    step: Number.isInteger(context.step) ? context.step : null,
    position: Number.isInteger(context.position) ? context.position : null,
    label: label || '학생 앱 학습 화면',
  }
}

function initialCourseLink(initialSubject, initialContext, preferLearning = false) {
  const subject = initialContext?.subject || initialSubject
  const base = campusCourseTarget(subject)
  if (!base) return null
  if (!initialContext?.subject) return base
  const link = {
    ...base,
    mode: initialContext.mode ?? base.mode,
    track: initialContext.track || initialContext.trackId || null,
    area: initialContext.area || initialContext.areaId || null,
    lesson: initialContext.lesson || initialContext.lessonId || null,
    questionId: initialContext.questionId || initialContext.question?.id || null,
    index: Number.isInteger(initialContext.index) ? initialContext.index : null,
    step: Number.isInteger(initialContext.step)
      ? initialContext.step
      : initialContext.content?.kind === 'summary' && Number.isInteger(initialContext.position)
        ? Math.max(0, initialContext.position - 1)
        : 0,
    interaction: initialContext.content?.interaction || null,
  }
  if (!preferLearning || link.mode !== 'study' || !link.lesson) return link
  return {
    ...link,
    questionId: null,
    index: null,
    step: initialContext.content?.kind === 'summary' ? link.step : 0,
    interaction: initialContext.content?.kind === 'summary' ? link.interaction : null,
  }
}

const PRESENCE_COPY = {
  active: ['연결됨', 'is-active'],
  away: ['화면 벗어남', 'is-away'],
  lost: ['연결 확인', 'is-lost'],
  offline: ['미접속', 'is-offline'],
}

function presenceTime(value) {
  if (!value) return '접속 기록 없음'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return '방금 확인'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
  return `${Math.floor(seconds / 3600)}시간 전`
}

function demoClassPresence(session) {
  if (!session) return { session: null, students: [], summary: { total: 28, active: 0, away: 0, lost: 0, offline: 28 } }
  const now = new Date().toISOString()
  const names = [
    '이수현', '박민준', '최유나', '정도윤', '김서연', '윤지호', '한예린', '오승현', '임다은', '강민서',
    '신도현', '배서윤', '조현우', '김하은', '이준서', '박지민', '최민재', '정예원', '김태윤', '윤수아',
    '한지후', '오민지', '임서준', '강유진', '신현서', '배지안', '조민성', '김예린',
  ]
  const states = [
    ...Array(18).fill('active'),
    ...Array(3).fill('away'),
    ...Array(2).fill('lost'),
    ...Array(5).fill('offline'),
  ]
  return {
    session,
    students: names.map((display_name, index) => ({
      student_id: `demo-p${index + 1}`,
      display_name,
      shown: states[index],
      last_seen: states[index] === 'offline'
        ? null
        : new Date(Date.now() - (states[index] === 'lost' ? 260_000 : index * 3_000)).toISOString(),
      away_count: states[index] === 'away' ? (index % 3) + 1 : 0,
    })),
    summary: { total: 28, active: 18, away: 3, lost: 2, offline: 5 },
    at: now,
  }
}

function ClassroomConnectionPanel({
  presence,
  open,
  busy,
  focusBusy,
  focusLabel,
  focusSentAt,
  session,
  onToggle,
  onRefresh,
  onSendFocus,
  showSummary = true,
}) {
  const summary = presence?.summary || {}
  const rank = { active: 0, away: 1, lost: 2, offline: 3 }
  const students = [...(presence?.students || [])].sort((left, right) =>
    (rank[left.shown] ?? 4) - (rank[right.shown] ?? 4)
      || String(left.display_name || '').localeCompare(String(right.display_name || ''), 'ko'))
  return (
    <section className={`classroom-connection-panel ${session ? 'is-live' : ''} ${showSummary ? '' : 'is-dialog-only'}`} aria-label="학생 앱 연결 현황">
      {showSummary && <header>
        <div className="classroom-connection-title">
          <UsersThree weight="fill" />
          <b>학생 연결</b>
          {!session && <span>연결을 시작하면 학생 상태가 표시됩니다</span>}
        </div>
        {session && (
          <div className="classroom-connection-summary" data-presence-summary aria-label="학생 연결 요약">
            <span className="is-active">연결됨 <b>{summary.active ?? 0}</b></span>
            <span className="is-away">화면 벗어남 <b>{summary.away ?? 0}</b></span>
            <span className="is-lost">연결 확인 <b>{summary.lost ?? 0}</b></span>
            <span className="is-offline">미접속 <b>{summary.offline ?? 0}</b></span>
          </div>
        )}
        <button type="button" className="classroom-connection-detail" onClick={onToggle}
          disabled={!session} aria-expanded={open} aria-haspopup="dialog"
          aria-label="학생 연결 상세보기" title="학생 연결 상세보기">
          <UsersThree weight="bold" /><span>상세보기</span>
        </button>
        <button type="button" className="classroom-connection-refresh" onClick={onRefresh} disabled={busy || !session}
          aria-label="학생 연결 현황 새로고침" title="학생 연결 현황 새로고침">
          <ArrowClockwise className={busy ? 'is-spinning' : ''} />
        </button>
      </header>}
      {open && session && (
        <div className="classroom-connection-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) onToggle()
        }}>
          <div className="classroom-connection-dialog" role="dialog" aria-modal="true" aria-labelledby="classroom-connection-dialog-title">
            <header>
              <div>
                <small>LIVE CLASS</small>
                <h2 id="classroom-connection-dialog-title">학생 연결 상세</h2>
                <p>총 {summary.total ?? students.length}명 · 20초마다 상태 갱신</p>
              </div>
              <button type="button" onClick={onToggle} aria-label="학생 연결 상세 닫기" title="닫기"><X weight="bold" /></button>
            </header>
            <div className="classroom-focus-delivery">
              <Broadcast weight="fill" />
              <span><b>학생 앱 위치 전달</b><small>{focusLabel || '학습 단원을 열면 현재 위치를 보낼 수 있습니다.'}</small></span>
              <button type="button" onClick={onSendFocus} disabled={focusBusy || !focusLabel}>
                <Broadcast weight="bold" />
                {focusBusy ? '전달 중' : '현재 위치 다시 보내기'}
              </button>
              <em>{focusSentAt ? `최종 전달 ${presenceTime(focusSentAt)}` : '학습 위치 전달 대기'}</em>
            </div>
            <ul aria-label="학생별 연결 상태">
              {students.map(student => {
                const [label, className] = PRESENCE_COPY[student.shown] || PRESENCE_COPY.offline
                return (
                  <li key={student.student_id} className={className}>
                    <i /><b>{student.display_name}</b><span>{label}</span>
                    <small>{presenceTime(student.last_seen)}{student.away_count ? ` · 이탈 ${student.away_count}회` : ''}</small>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function ClassroomLivePulse({
  open,
  presence,
  session,
  focusBusy,
  focusLabel,
  focusSentAt,
  responseCount,
  onToggle,
  onOpenPresence,
  onOpenResponses,
  onRefresh,
  onSendFocus,
}) {
  const summary = presence?.summary || {}
  const total = summary.total ?? 0
  const active = summary.active ?? 0
  const attention = (summary.away ?? 0) + (summary.lost ?? 0)
  return (
    <>
      <button type="button" className={`classroom-live-pulse-toggle ${open ? 'is-open' : ''}`}
        onClick={onToggle} aria-expanded={open} aria-controls="classroom-live-pulse-panel"
        aria-label={open ? '라이브 펄스 닫기' : '라이브 펄스 열기'} title="라이브 펄스">
        <Broadcast weight="fill" />
        <span>LIVE</span>
        <b>{session ? `${active}/${total}` : '대기'}</b>
      </button>
      {open && (
        <aside id="classroom-live-pulse-panel" className="classroom-live-pulse-panel"
          role="dialog" aria-modal="false" aria-labelledby="classroom-live-pulse-title">
          <header>
            <div>
              <small>LIVE CLASS</small>
              <h2 id="classroom-live-pulse-title">라이브 펄스</h2>
              <p>{session ? '현재 수업의 참여 상태를 한눈에 확인합니다.' : '학생 연결을 시작하면 현황이 표시됩니다.'}</p>
            </div>
            <button type="button" onClick={onToggle} aria-label="라이브 펄스 닫기"><X weight="bold" /></button>
          </header>

          <section className="classroom-live-pulse-connection" aria-label="연결 상태 요약">
            <div><span>연결됨</span><b>{active}</b></div>
            <div><span>화면 벗어남</span><b>{summary.away ?? 0}</b></div>
            <div><span>연결 확인</span><b>{summary.lost ?? 0}</b></div>
            <div><span>미접속</span><b>{summary.offline ?? 0}</b></div>
          </section>

          <section className="classroom-live-pulse-band">
            <span><UsersThree weight="fill" /></span>
            <div><small>연결 상태</small><b>{session ? `${active}/${total}명 연결` : '연결 대기'}</b><p>{attention ? `${attention}명 확인 필요` : '수업 흐름이 안정적입니다.'}</p></div>
            <button type="button" onClick={onOpenPresence} disabled={!session}>상세</button>
          </section>

          <section className="classroom-live-pulse-band">
            <span><ChatCircleDots weight="fill" /></span>
            <div><small>현재 장면 응답</small><b>{session ? `${responseCount}/${total}명 제출` : '응답 대기'}</b><p>분포와 학생별 답변 확인</p></div>
            <button type="button" onClick={onOpenResponses} disabled={!session || !focusLabel}>열기</button>
          </section>

          <section className="classroom-live-pulse-focus">
            <Broadcast weight="fill" />
            <div><small>학생 앱 위치 전달</small><b>{focusLabel || '학습 단원을 열어 주세요.'}</b><p>{focusSentAt ? `최종 전달 ${presenceTime(focusSentAt)}` : '현재 장면으로 학생 앱을 이동합니다.'}</p></div>
            <button type="button" onClick={onSendFocus} disabled={focusBusy || !session || !focusLabel}>
              {focusBusy ? '전달 중' : '위치 전달'}
            </button>
          </section>

          <button type="button" className="classroom-live-pulse-refresh" onClick={onRefresh} disabled={!session}>
            <ArrowClockwise /> 현황 새로고침
          </button>
        </aside>
      )}
    </>
  )
}

function responseText(response = {}) {
  if (response.kind === 'choice') return response.label || String(response.value ?? '선택 완료')
  if (response.kind === 'reflection') return response.value || '성찰 응답 완료'
  if (response.kind === 'exit') return [response.criterion, response.action].filter(Boolean).join(' · ')
  if (response.kind === 'formative') {
    return (response.answers || []).map(answer => `${answer.index + 1}번 ${answer.value + 1}번 선택`).join(' · ')
  }
  return '응답 완료'
}

function responseGroups(responses = []) {
  const groups = new Map()
  responses.forEach(row => {
    const label = responseText(row.response)
    groups.set(label, (groups.get(label) || 0) + 1)
  })
  return [...groups.entries()].sort((left, right) => right[1] - left[1])
}

function demoClassResponses(context, total = 28) {
  const labels = context?.content?.card?.point?.sampleQuestion?.choices?.map(choice => choice.text)
    || ['근거를 먼저 확인함', '상대방의 영향을 먼저 확인함', '정보가 더 필요함']
  const names = ['이수현', '박민준', '최유나', '정도윤', '김서연', '윤지호', '한예린', '오승현', '임다은', '강민서', '신도현', '배서윤']
  const responses = names.map((display_name, index) => ({
    student_id: `demo-response-${index + 1}`,
    display_name,
    response: { kind: 'choice', value: index % labels.length, label: labels[index % labels.length] },
    submitted_at: new Date(Date.now() - index * 12_000).toISOString(),
  }))
  return { count: responses.length, total, responses, at: new Date().toISOString() }
}

function ClassroomResponseDialog({ open, busy, data, total, focusLabel, onClose, onRefresh }) {
  if (!open) return null
  const responses = data?.responses || []
  const groups = responseGroups(responses)
  const answered = data?.count ?? responses.length
  return (
    <div className="classroom-response-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="classroom-response-dialog" role="dialog" aria-modal="true" aria-labelledby="classroom-response-title">
        <header>
          <div>
            <small>LIVE RESPONSE</small>
            <h2 id="classroom-response-title">학생 응답</h2>
            <p>{focusLabel || '현재 수업 장면'} · 응답 {answered}/{total || answered}명</p>
          </div>
          <button type="button" onClick={onClose} aria-label="학생 응답 닫기"><X weight="bold" /></button>
        </header>
        <div className="classroom-response-summary">
          <div><span>응답</span><b>{answered}</b></div>
          <div><span>대기</span><b>{Math.max(0, (total || answered) - answered)}</b></div>
          <button type="button" onClick={onRefresh} disabled={busy}>
            <ArrowClockwise className={busy ? 'is-spinning' : ''} />{busy ? '확인 중' : '새로고침'}
          </button>
        </div>
        {groups.length > 0 && (
          <div className="classroom-response-distribution" aria-label="응답 분포">
            {groups.map(([label, count]) => (
              <div key={label}>
                <span><b>{label}</b><em>{count}명</em></span>
                <i style={{ '--response-rate': `${answered ? count / answered * 100 : 0}%` }} />
              </div>
            ))}
          </div>
        )}
        <div className="classroom-response-list">
          {busy && responses.length === 0 ? <p>현재 장면의 응답을 모으고 있습니다.</p> : null}
          {!busy && responses.length === 0 ? <p>아직 제출된 응답이 없습니다. 학생이 선택하거나 형성평가를 확인하면 여기에 표시됩니다.</p> : null}
          {responses.map(row => (
            <article key={row.student_id}>
              <span><CheckCircle weight="fill" /></span>
              <div><b>{row.display_name}</b><p>{responseText(row.response)}</p></div>
              <time>{presenceTime(row.submitted_at)}</time>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function ClassroomScenarioNav({ context, minutes, onMinutesChange, onJump, onBrowse, session, responseCount, onOpenResponses }) {
  const timing = lessonTiming(minutes)
  const total = Math.max(1, Number(context.total) || 1)
  const position = Math.max(1, Number(context.position) || 1)
  const activeIndex = total <= 1
    ? 0
    : Math.min(timing.length - 1, Math.round(((position - 1) / (total - 1)) * (timing.length - 1)))
  return (
    <aside className="classroom-scenario-nav" aria-label="수업 시나리오">
      <header>
        <small>LESSON STORYBOARD</small>
        <h2>수업 시나리오</h2>
        <p>{context.lessonLabel || context.areaLabel}</p>
      </header>
      <div className="classroom-scenario-duration" aria-label="수업 시간 선택">
        {LESSON_DURATIONS.map(value => (
          <button type="button" key={value} className={minutes === value ? 'is-on' : ''}
            onClick={() => onMinutesChange(value)} aria-pressed={minutes === value}>
            <Clock weight={minutes === value ? 'fill' : 'regular'} />{value}분
          </button>
        ))}
      </div>
      <ol>
        {timing.map(([phase, studentAction, phaseMinutes], index) => (
          <li key={`${phase}:${phaseMinutes}`} className={`${index === activeIndex ? 'is-on' : ''} ${index < activeIndex ? 'is-done' : ''}`}>
            <button type="button" onClick={() => onJump(index, timing.length)} aria-current={index === activeIndex ? 'step' : undefined}>
              <span>{index < activeIndex ? <CheckCircle weight="fill" /> : index + 1}</span>
              <div><b>{phase}</b><p>{studentAction}</p></div>
              <time>{phaseMinutes}분</time>
            </button>
          </li>
        ))}
      </ol>
      <div className="classroom-scenario-actions">
        <button type="button" className="is-response" onClick={onOpenResponses} disabled={!session}>
          <ChatCircleDots weight="fill" />
          <span><b>학생 응답 열기</b><small>{session ? (responseCount ? `${responseCount}명 응답 확인` : '현재 장면 응답 확인') : '수업 연결 후 사용'}</small></span>
        </button>
        <button type="button" className="is-browse" onClick={onBrowse}>단원 바꾸기</button>
      </div>
    </aside>
  )
}

function ClassroomProjectionHeader({ context }) {
  const summary = context.content?.summary
  const goal = summary?.mustRemember?.[0] || summary?.learningPoints?.[0] || ''
  return (
    <header className="classroom-projection-header">
      <div>
        <small>교실 수업 장면 {context.position || 1}/{context.total || 1}</small>
        <h1>{context.title || context.lessonLabel || context.areaLabel || '오늘의 학습 장면'}</h1>
        <p>{context.lessonLabel || context.areaLabel}</p>
      </div>
      {goal && (
        <aside aria-label="학습 목표">
          <CheckCircle weight="fill" />
          <span><small>학습 목표</small><b>{goal}</b></span>
        </aside>
      )}
    </header>
  )
}

export default function TeacherLearningPreview({
  profile,
  demoMode = false,
  initialSubject = null,
  initialContext = null,
  initialClassId = null,
  initialClassName = null,
  initialCoachOpen = false,
  teachingMode = false,
  onBack,
  onOpenClassroom,
  onOpenMessages,
}) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const panRef = useRef(null)
  const focusRef = useRef('')
  const restoreCoachRef = useRef(Boolean(initialCoachOpen))
  const autoStartRef = useRef(Boolean(initialClassId))
  const initialLink = useMemo(
    () => initialCourseLink(initialSubject, initialContext, teachingMode),
    [initialContext, initialSubject, teachingMode],
  )
  const [tab, setTab] = useState(initialLink ? 'study' : 'home')
  const [deepLink, setDeepLink] = useState(initialLink)
  const [learningContext, setLearningContext] = useState(initialContext || { subject: initialLink?.subject || initialSubject, mode: null })
  const [coachOpen, setCoachOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [phoneViewport, setPhoneViewport] = useState(() => isTeacherPhoneViewport())
  const desktopPresentation = teachingMode && !phoneViewport
  const [classroomZoom, setClassroomZoom] = useState(() => initialClassroomZoom(teachingMode && !isTeacherPhoneViewport()))
  const [panning, setPanning] = useState(false)
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState(initialClassId || '')
  const [session, setSession] = useState(null)
  const [presence, setPresence] = useState(null)
  const [presenceOpen, setPresenceOpen] = useState(false)
  const [presenceBusy, setPresenceBusy] = useState(false)
  const [livePulseOpen, setLivePulseOpen] = useState(false)
  const [focusBusy, setFocusBusy] = useState(false)
  const [focusSentAt, setFocusSentAt] = useState(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const [lessonMinutes, setLessonMinutes] = useState(45)
  const [studyRevision, setStudyRevision] = useState(0)
  const [scenarioContext, setScenarioContext] = useState(
    initialContext?.content?.kind === 'summary' ? initialContext : null,
  )
  const [responsesOpen, setResponsesOpen] = useState(false)
  const [responsesBusy, setResponsesBusy] = useState(false)
  const [responseData, setResponseData] = useState(null)
  const contextReady = Boolean(
    learningContext.subject &&
    learningContext.mode &&
    learningContext.stage &&
    !['area-choice', 'lesson-choice'].includes(learningContext.stage),
  )

  useEffect(() => {
    const updateViewport = () => setPhoneViewport(isTeacherPhoneViewport())
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  useEffect(() => {
    if (learningContext.content?.kind === 'summary') setScenarioContext(learningContext)
  }, [learningContext])

  useEffect(() => {
    if (desktopPresentation) return
    setClassroomZoom(1)
    setFocusMode(false)
    exitProjection()
  }, [desktopPresentation])

  const previewBackRef = useRef(null)
  previewBackRef.current = () => {
    if (responsesOpen) { setResponsesOpen(false); return }
    if (presenceOpen) { setPresenceOpen(false); return }
    if (livePulseOpen) { setLivePulseOpen(false); return }
    if (coachOpen) { setCoachOpen(false); return }
    if (tab !== 'home') { setDeepLink(null); setTab('home'); return }
    leavePreview()
  }
  useEffect(() => {
    const id = pushBack(() => previewBackRef.current())
    return () => popBack(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 집중 화면과 교사 지원은 사용자가 방금 연 별도 단계다. PC/Android 뒤로
  // 가기는 학습 내용을 건드리기 전에 이 층부터 닫는다.
  useEffect(() => {
    if (!focusMode) return undefined
    const id = pushBack(() => {
      setFocusMode(false)
      exitProjection()
    })
    return () => popBack(id)
  }, [focusMode])
  useEffect(() => {
    if (!coachOpen) return undefined
    const id = pushBack(() => setCoachOpen(false))
    return () => popBack(id)
  }, [coachOpen])

  useEffect(() => {
    if (!restoreCoachRef.current || !contextReady) return
    restoreCoachRef.current = false
    setCoachOpen(true)
  }, [contextReady])

  useEffect(() => {
    if (!sessionMessage) return undefined
    const timer = window.setTimeout(() => setSessionMessage(''), 4_500)
    return () => window.clearTimeout(timer)
  }, [sessionMessage])

  useEffect(() => {
    setResponseData(null)
  }, [learningContext.areaId, learningContext.lessonId, learningContext.position, learningContext.questionId, learningContext.stage, learningContext.subject])

  useEffect(() => {
    if (!desktopPresentation) return undefined
    document.documentElement.classList.add('shared-classroom-mode')
    const stopFullscreen = onFullscreenChange(value => {
      setFullscreen(value)
      if (!value) setFocusMode(false)
    })
    return () => {
      document.documentElement.classList.remove('shared-classroom-mode')
      document.documentElement.classList.remove('classroom-focus-mode')
      stopFullscreen()
      exitProjection()
    }
  }, [desktopPresentation])

  useEffect(() => {
    if (!desktopPresentation || typeof window === 'undefined') return
    try { window.localStorage.setItem(CLASSROOM_ZOOM_STORAGE_KEY, String(classroomZoom)) }
    catch { }
    if (classroomZoom === 1) stageRef.current?.scrollTo({ left: 0, top: 0 })
  }, [classroomZoom, desktopPresentation])

  useEffect(() => {
    if (!desktopPresentation) return undefined
    const onKeyDown = event => {
      if (isTypingTarget(event.target)) return
      const stage = stageRef.current
      if (!stage) return
      const distance = event.shiftKey ? 180 : 88
      const movement = {
        ArrowLeft: [-distance, 0],
        ArrowRight: [distance, 0],
        ArrowUp: [0, -distance],
        ArrowDown: [0, distance],
      }[event.key]
      if (movement && classroomZoom > 1) {
        event.preventDefault()
        stage.scrollBy({ left: movement[0], top: movement[1], behavior: 'smooth' })
        return
      }
      if (event.key === '0' && classroomZoom !== 1) {
        event.preventDefault()
        applyClassroomZoom(1)
        return
      }
      if (['+', '='].includes(event.key)) {
        event.preventDefault()
        changeClassroomZoom(1)
        return
      }
      if (event.key === '-') {
        event.preventDefault()
        changeClassroomZoom(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [classroomZoom, desktopPresentation]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!desktopPresentation || !focusMode) return undefined
    document.documentElement.classList.add('classroom-focus-mode')
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      setFocusMode(false)
      exitProjection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.documentElement.classList.remove('classroom-focus-mode')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [focusMode, desktopPresentation])

  useEffect(() => {
    if (!teachingMode) return
    if (demoMode) {
      const demoClass = { id: initialClassId || 'demo-class', name: initialClassName || '체험 1반' }
      setClasses([demoClass])
      setClassId(demoClass.id)
      return
    }
    if (!profile?.id) return
    let active = true
    supabase
      .from('teacher_classes')
      .select('class_id, classes(id, name, grade)')
      .eq('teacher_id', profile.id)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setSessionMessage('학급 연결을 불러오지 못했습니다. 화면 수업은 그대로 진행할 수 있습니다.')
          return
        }
        const next = (data ?? []).map(row => row.classes).filter(Boolean)
        setClasses(next)
        setClassId(current => next.some(item => item.id === current) ? current : initialClassId || next[0]?.id || '')
      })
    return () => { active = false }
  }, [demoMode, initialClassId, initialClassName, profile?.id, teachingMode])

  const loadPresence = useCallback(async ({ quiet = false } = {}) => {
    if (!teachingMode || !classId) {
      setSession(null)
      setPresence(null)
      return
    }
    if (!quiet) setPresenceBusy(true)
    if (demoMode) {
      setPresence(demoClassPresence(session))
      setPresenceBusy(false)
      return
    }
    const { data, error } = await supabase.rpc('rpc_class_presence', { p_class_id: classId })
    if (!error && !data?.error) {
      setSession(data?.session || null)
      setPresence(data)
    } else if (!quiet) {
      setSessionMessage('학생 연결 현황을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.')
    }
    setPresenceBusy(false)
  }, [classId, demoMode, session, teachingMode])

  useEffect(() => {
    loadPresence()
    if (!teachingMode || !classId) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadPresence({ quiet: true })
    }, 20_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadPresence({ quiet: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [classId, loadPresence, teachingMode])

  const publishClassFocus = useCallback(async ({ announce = false } = {}) => {
    if (!teachingMode || !session) return false
    const focus = classFocus(learningContext)
    if (!focus) {
      if (announce) setSessionMessage('학생에게 보낼 학습 단원을 먼저 열어 주세요.')
      return false
    }
    const key = JSON.stringify(focus)
    if (!announce && focusRef.current === key) return true
    if (announce) setFocusBusy(true)
    if (demoMode) {
      focusRef.current = key
      setFocusSentAt(new Date())
      if (announce) setSessionMessage('체험 학생 앱에 현재 학습 위치를 전달했습니다.')
      setFocusBusy(false)
      return true
    }
    focusRef.current = key
    const { data, error } = await supabase.rpc('rpc_set_class_focus', { p_session_id: session, p_focus: focus })
    if (error || data?.error) {
      focusRef.current = ''
      setSessionMessage('학생 기기에 현재 학습 위치를 보내지 못했습니다. 다시 연결해 주세요.')
      setFocusBusy(false)
      return false
    }
    setFocusSentAt(new Date())
    if (announce) setSessionMessage(`연결된 학생 앱에 '${focus.label}' 위치를 전달했습니다.`)
    setFocusBusy(false)
    return true
  }, [demoMode, learningContext, session, teachingMode])

  useEffect(() => {
    publishClassFocus()
  }, [publishClassFocus])

  function openStudy(target) {
    const next = typeof target === 'string' || target == null ? campusCourseTarget(target) : target
    setDeepLink(next)
    setLearningContext({ subject: next?.subject || null, mode: next?.mode || null })
    setTab('study')
  }

  function jumpToScenarioPhase(index, phaseCount) {
    if (!learningContext.subject || !learningContext.lessonId) return
    const sameLessonContext = scenarioContext?.subject === learningContext.subject
      && (scenarioContext.lessonId || scenarioContext.lesson) === (learningContext.lessonId || learningContext.lesson)
      ? scenarioContext
      : null
    const total = Math.max(1, Number(sameLessonContext?.total) || phaseCount)
    const targetPosition = phaseCount <= 1
      ? 1
      : Math.round(index * (total - 1) / (phaseCount - 1)) + 1
    const next = {
      subject: learningContext.subject,
      mode: 'study',
      track: learningContext.track || learningContext.trackId || null,
      area: learningContext.area || learningContext.areaId || null,
      lesson: learningContext.lesson || learningContext.lessonId || null,
      questionId: null,
      index: null,
      step: targetPosition - 1,
      interaction: null,
    }
    setDeepLink(next)
    setStudyRevision(value => value + 1)
  }

  async function loadResponses() {
    if (!session || !classFocus(learningContext)) return
    setResponsesBusy(true)
    if (demoMode) {
      setResponseData(demoClassResponses(learningContext, presence?.summary?.total || 28))
      setResponsesBusy(false)
      return
    }
    const { data, error } = await fetchClassResponses(session, learningContext)
    if (error || data?.error) setSessionMessage('현재 장면의 학생 응답을 불러오지 못했습니다.')
    else setResponseData(data)
    setResponsesBusy(false)
  }

  async function openResponses() {
    setLivePulseOpen(false)
    setResponsesOpen(true)
    await loadResponses()
  }

  async function toggleLivePulse() {
    const next = !livePulseOpen
    setLivePulseOpen(next)
    if (!next || !session) return
    await Promise.all([loadPresence({ quiet: true }), loadResponses()])
  }

  async function toggleClassroomFocus() {
    if (focusMode || fullscreen) {
      setFocusMode(false)
      await exitProjection()
      return
    }
    setFocusMode(true)
    await enterProjection(rootRef.current)
  }

  function applyClassroomZoom(nextZoom) {
    const next = CLASSROOM_ZOOM_LEVELS.includes(nextZoom) ? nextZoom : 1
    if (next === classroomZoom) return
    const stage = stageRef.current
    const anchor = stage ? {
      x: (stage.scrollLeft + stage.clientWidth / 2) / classroomZoom,
      y: (stage.scrollTop + stage.clientHeight / 2) / classroomZoom,
    } : null
    setClassroomZoom(next)
    if (!stage || !anchor) return
    window.requestAnimationFrame(() => {
      stage.scrollTo({
        left: Math.max(0, anchor.x * next - stage.clientWidth / 2),
        top: Math.max(0, anchor.y * next - stage.clientHeight / 2),
      })
    })
  }

  function changeClassroomZoom(direction) {
    const current = CLASSROOM_ZOOM_LEVELS.indexOf(classroomZoom)
    const next = Math.min(CLASSROOM_ZOOM_LEVELS.length - 1, Math.max(0, current + direction))
    applyClassroomZoom(CLASSROOM_ZOOM_LEVELS[next])
  }

  function startPan(event) {
    if (!teachingMode || classroomZoom <= 1 || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, label, [contenteditable="true"]')) return
    const stage = stageRef.current
    if (!stage) return
    panRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    }
    stage.setPointerCapture?.(event.pointerId)
    setPanning(true)
  }

  function movePan(event) {
    const pan = panRef.current
    const stage = stageRef.current
    if (!pan || !stage || pan.id !== event.pointerId) return
    event.preventDefault()
    stage.scrollLeft = pan.left - (event.clientX - pan.x)
    stage.scrollTop = pan.top - (event.clientY - pan.y)
  }

  function stopPan(event) {
    const pan = panRef.current
    if (!pan || pan.id !== event.pointerId) return
    stageRef.current?.releasePointerCapture?.(event.pointerId)
    panRef.current = null
    setPanning(false)
  }

  async function startSession() {
    if (!classId || sessionBusy) return
    setPresenceOpen(false)
    setFocusSentAt(null)
    if (demoMode) {
      setSession('demo-session')
      setPresence(demoClassPresence('demo-session'))
      setSessionMessage('체험 연결이 시작되었습니다. 실제 계정에서는 학생 앱의 ‘따라가기’와 연결됩니다.')
      return
    }
    setSessionBusy(true)
    setSessionMessage('')
    const focus = classFocus(learningContext)
    const { data, error } = await supabase.rpc('rpc_start_class_session', {
      p_class_id: classId,
      p_title: focus?.label || '학생 앱 함께 배우기',
    })
    if (error || !data?.session_id) {
      setSessionMessage(error?.message || '학급 수업 연결을 시작하지 못했습니다.')
    } else {
      setSession(data.session_id)
      await loadPresence({ quiet: true })
      focusRef.current = ''
    }
    setSessionBusy(false)
  }

  async function endSession() {
    if (!classId || sessionBusy) return
    setPresenceOpen(false)
    setFocusSentAt(null)
    if (demoMode) {
      setSession(null)
      setPresence(demoClassPresence(null))
      setSessionMessage('체험 연결을 종료했습니다.')
      return
    }
    setSessionBusy(true)
    const { error } = await supabase.rpc('rpc_end_class_session', { p_class_id: classId })
    if (error) setSessionMessage(error.message)
    else {
      setSession(null)
      setPresence(null)
      setSessionMessage('학생 기기 연결을 종료했습니다.')
      focusRef.current = ''
    }
    setSessionBusy(false)
  }

  async function leavePreview() {
    if (teachingMode && session) await endSession()
    onBack?.()
  }

  function goPrevious() {
    if (coachOpen) { setCoachOpen(false); return }
    if (tab !== 'home' && triggerBack()) return
    leavePreview()
  }

  useEffect(() => {
    if (!teachingMode || !classId || session || sessionBusy || !autoStartRef.current) return
    autoStartRef.current = false
    startSession()
  }, [classId, session, sessionBusy, teachingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    { id: 'home', label: '홈', icon: House, onClick: () => setTab('home') },
    { id: 'study', label: '탐험', icon: Compass, onClick: () => { setDeepLink(null); setTab('study') } },
    { id: 'growth', label: '성장', icon: ChartLineUp, onClick: () => setTab('growth') },
    { id: 'messages', label: '소식', icon: Bell, onClick: () => setTab('messages') },
    { id: 'ranking', label: '나', icon: UserCircle, onClick: () => setTab('ranking') },
  ]
  const showScenario = desktopPresentation && tab === 'study' && contextReady && learningContext.mode === 'study'
  const scenarioNavContext = scenarioContext?.subject === learningContext.subject
    && (scenarioContext.lessonId || scenarioContext.lesson) === (learningContext.lessonId || learningContext.lesson)
    ? scenarioContext
    : learningContext

  return (
    <div ref={rootRef} className={`screen teacher-learning-preview ${teachingMode ? 'is-teaching' : ''} ${phoneViewport ? 'is-phone-learning' : ''} ${focusMode ? 'is-focus' : ''} ${classroomZoom > 1 ? 'is-zoomed' : ''}`}>
      <header className="teacher-preview-context">
        <button type="button" className="teacher-preview-back" onClick={leavePreview}
          aria-label="교사 캠퍼스로 돌아가기" title="교사 캠퍼스로 돌아가기">
          <ArrowLeft weight="bold" />
        </button>
        <span className="teacher-preview-mark"><Buildings weight="fill" /></span>
        <div className="teacher-preview-heading">
          <small>{teachingMode ? 'CLASSROOM · LESSON CONDUCTOR' : 'STUDENT VIEW · TEACHER PASS'}</small>
          <b>{teachingMode
            ? (learningContext.lessonLabel || learningContext.areaLabel || '교실 수업 준비')
            : '학생과 같은 화면으로 배우기'}</b>
        </div>
        <div className="teacher-preview-actions">
          {teachingMode && (
            <div className={`teacher-preview-session ${session ? 'is-live' : ''}`} aria-label="학생 기기 수업 연결">
              {classes.length > 0 ? (
                <select aria-label="연결할 학급" value={classId} onChange={event => setClassId(event.target.value)} disabled={Boolean(session)}>
                  {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              ) : <span className="teacher-session-no-class">학급 없음</span>}
              <button type="button" className={session ? 'is-stop' : ''}
                title={session ? '학생 기기 연결 종료' : '학생 기기 연결 시작'}
                onClick={session ? endSession : startSession} disabled={!session && (!classId || sessionBusy)}>
                {session ? <StopCircle weight="fill" /> : <Broadcast weight="fill" />}
                <span>{session ? '연결 종료' : '연결 시작'}</span>
              </button>
            </div>
          )}
          <button type="button" className={`teacher-preview-exit ${coachOpen ? 'is-on' : ''}`} disabled={!contextReady}
            title={contextReady ? '현재 단계의 교사용 추가 자료' : '학습관에서 단원을 열면 활성화됩니다'}
            onClick={() => setCoachOpen(value => !value)} aria-expanded={coachOpen} aria-haspopup="dialog">
            <PresentationChart weight={coachOpen ? 'fill' : 'regular'} /><span>{contextReady ? '교사 지원' : '단원 선택 전'}</span>
          </button>
          {desktopPresentation && (
            <ClassroomZoomControl zoom={classroomZoom}
              onDecrease={() => changeClassroomZoom(-1)} onReset={() => applyClassroomZoom(1)}
              onIncrease={() => changeClassroomZoom(1)} />
          )}
          {desktopPresentation ? (
            <button type="button" className="teacher-preview-classroom is-focus-launch" onClick={toggleClassroomFocus}
              aria-label={focusMode ? '수업 집중 화면 종료' : '수업 집중 화면'} title={focusMode ? '수업 집중 화면 종료' : '수업 집중 화면'}>
              {focusMode ? <ArrowsInSimple weight="bold" /> : <ArrowsOutSimple weight="bold" />}
              <span>{focusMode ? '수업 화면 종료' : '수업 집중 화면'}</span>
            </button>
          ) : !teachingMode ? (
            <button type="button" className="teacher-preview-classroom"
              onClick={() => onOpenClassroom?.({ ...learningContext, coachOpen })} aria-label="교실 수업으로 열기" title="교실 수업으로 열기">
              <Monitor weight="bold" />
            </button>
          ) : null}
        </div>
        {sessionMessage && <p className="teacher-preview-session-message" role="status">{sessionMessage}</p>}
      </header>

      {teachingMode && focusMode && (
        <header className="classroom-focus-bar">
          <div className="classroom-focus-title">
            <PresentationChart weight="fill" />
            <span><small>수업 집중</small><b>{learningContext.lessonLabel || learningContext.areaLabel || '학생 학습 화면'}</b></span>
          </div>
          <div className="classroom-focus-actions">
            <ClassroomZoomControl zoom={classroomZoom}
              onDecrease={() => changeClassroomZoom(-1)} onReset={() => applyClassroomZoom(1)}
              onIncrease={() => changeClassroomZoom(1)} />
            <button type="button" className={coachOpen ? 'is-on' : ''} disabled={!contextReady}
              onClick={() => setCoachOpen(value => !value)} aria-expanded={coachOpen} aria-haspopup="dialog">
              <PresentationChart weight={coachOpen ? 'fill' : 'regular'} /><span>교사 지원</span>
            </button>
            <button type="button" onClick={toggleClassroomFocus} aria-label="수업 집중 화면 종료">
              <ArrowsInSimple weight="bold" /><span>수업 화면 종료</span>
            </button>
          </div>
        </header>
      )}

      {teachingMode && (
        <ClassroomConnectionPanel
          presence={presence}
          open={presenceOpen}
          busy={presenceBusy}
          focusBusy={focusBusy}
          session={session}
          focusLabel={classFocus(learningContext)?.label}
          focusSentAt={focusSentAt}
          onToggle={() => setPresenceOpen(value => !value)}
          onRefresh={() => loadPresence()}
          onSendFocus={() => publishClassFocus({ announce: true })}
          showSummary={!desktopPresentation}
        />
      )}

      <ClassroomResponseDialog
        open={responsesOpen}
        busy={responsesBusy}
        data={responseData}
        total={presence?.summary?.total || 0}
        focusLabel={classFocus(learningContext)?.label}
        onClose={() => setResponsesOpen(false)}
        onRefresh={loadResponses}
      />

      <div ref={stageRef}
        className={`teacher-preview-stage ${coachOpen ? 'has-coach' : ''} ${classroomZoom > 1 ? 'is-pannable' : ''} ${panning ? 'is-panning' : ''}`}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
        aria-label={desktopPresentation && classroomZoom > 1 ? `확대된 수업 화면 ${Math.round(classroomZoom * 100)}%, 드래그 또는 방향키로 이동` : undefined}>
        <div className="teacher-preview-canvas" style={desktopPresentation ? {
          width: `${classroomZoom * 100}%`,
          height: `${classroomZoom * 100}%`,
          flexBasis: `${classroomZoom * 100}%`,
          '--classroom-zoom': classroomZoom,
        } : undefined}>
        <div className="teacher-preview-body" style={desktopPresentation ? {
          width: `${100 / classroomZoom}%`,
          height: `${100 / classroomZoom}%`,
          flex: `0 0 ${100 / classroomZoom}%`,
          transform: `scale(${classroomZoom})`,
        } : undefined}>
          <div className={`teacher-classroom-layout ${showScenario ? 'has-scenario' : ''}`}>
          {showScenario && (
            <ClassroomScenarioNav
              context={scenarioNavContext}
              minutes={lessonMinutes}
              onMinutesChange={setLessonMinutes}
              onJump={jumpToScenarioPhase}
              onBrowse={() => { setDeepLink(null); setLearningContext({ subject: learningContext.subject, mode: 'study' }); setStudyRevision(value => value + 1) }}
              session={session}
              responseCount={responseData?.count || 0}
              onOpenResponses={openResponses}
            />
          )}
          <main className="teacher-classroom-content">
          {showScenario && <ClassroomProjectionHeader context={learningContext} />}
          {tab === 'home' && (
            <StudentCampusHome
              profile={profile}
              demo
              teacherPreview
              onOpenMission={() => openStudy(null)}
              onGoStudy={openStudy}
              onGoWrong={() => setTab('growth')}
              onGoMessages={() => setTab('messages')}
            />
          )}
          {tab === 'study' && (
            <CourseListScreen
              key={deepLink ? `${[deepLink.subject, deepLink.mode, deepLink.area, deepLink.lesson, deepLink.questionId, deepLink.index, deepLink.step, studyRevision].join(':')}:teacher-preview` : `teacher-preview-browse:${studyRevision}`}
              deepLink={deepLink}
              onContextChange={setLearningContext}
              onBack={() => { setDeepLink(null); setTab('home') }}
            />
          )}
          {tab === 'growth' && <WrongAnswerScreen profile={profile} />}
          {tab === 'messages' && <NotificationsScreen demo />}
          {tab === 'ranking' && <RankingScreen />}
          </main>
          </div>
        </div>
        </div>
        {desktopPresentation && (
          <ClassroomLivePulse
            open={livePulseOpen}
            presence={presence}
            session={session}
            focusBusy={focusBusy}
            focusLabel={classFocus(learningContext)?.label}
            focusSentAt={focusSentAt}
            responseCount={responseData?.count || 0}
            onToggle={toggleLivePulse}
            onOpenPresence={() => { setLivePulseOpen(false); setPresenceOpen(true) }}
            onOpenResponses={openResponses}
            onRefresh={() => loadPresence()}
            onSendFocus={() => publishClassFocus({ announce: true })}
          />
        )}
        {coachOpen && (
          <TeacherLessonCoach
            subject={learningContext.subject}
            mode={learningContext.mode}
            context={learningContext}
            lessonMinutes={lessonMinutes}
            onLessonMinutesChange={setLessonMinutes}
            projectionSafe={focusMode}
            onMessage={onOpenMessages}
            onClose={() => setCoachOpen(false)}
          />
        )}
      </div>

      {!teachingMode && (
        <nav className="bottom-tab teacher-preview-tabs" aria-label="학생 화면 미리보기 메뉴">
          {tabs.map(item => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button key={item.id} className={`tab-item ${active ? 'active' : ''}`} onClick={item.onClick}>
                <span className="tab-icon"><Icon weight={active ? 'fill' : 'regular'} /></span>
                {item.label}
              </button>
            )
          })}
        </nav>
      )}

      {!teachingMode && tab === 'messages' && (
        <button className="teacher-preview-message-link" onClick={() => onOpenMessages?.({})}>
          교사 메시지함 열기
        </button>
      )}
    </div>
  )
}
