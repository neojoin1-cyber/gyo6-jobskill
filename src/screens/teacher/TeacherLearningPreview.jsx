import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowsInSimple,
  ArrowsOutSimple,
  Bell,
  Broadcast,
  Buildings,
  CaretDown,
  CaretUp,
  ChartLineUp,
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
import TeacherLessonCoach from './TeacherLessonCoach.jsx'

const FOLLOWABLE_MODES = new Set(['study', 'diagnostic', 'mock', 'practical', 'cover-practical'])
const CLASSROOM_ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const CLASSROOM_ZOOM_STORAGE_KEY = 'gyo6_classroom_zoom'

function initialClassroomZoom(teachingMode) {
  if (!teachingMode || typeof window === 'undefined') return 1
  try {
    const stored = Number(window.localStorage.getItem(CLASSROOM_ZOOM_STORAGE_KEY))
    if (CLASSROOM_ZOOM_LEVELS.includes(stored)) return stored
    return window.localStorage.getItem('gyo6_classroom_text_size') === 'standard' ? 1 : 1.25
  } catch {
    return 1.25
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
    label: label || '학생 앱 학습 화면',
  }
}

function initialCourseLink(initialSubject, initialContext) {
  const subject = initialContext?.subject || initialSubject
  const base = campusCourseTarget(subject)
  if (!base) return null
  if (!initialContext?.subject) return base
  return {
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
  return {
    session,
    students: [
      { student_id: 'demo-p1', display_name: '이수현', shown: 'active', last_seen: now, away_count: 0 },
      { student_id: 'demo-p2', display_name: '박민준', shown: 'active', last_seen: now, away_count: 1 },
      { student_id: 'demo-p3', display_name: '최유나', shown: 'away', last_seen: now, away_count: 2 },
      { student_id: 'demo-p4', display_name: '정도윤', shown: 'lost', last_seen: new Date(Date.now() - 260_000).toISOString(), away_count: 0 },
      { student_id: 'demo-p5', display_name: '김서연', shown: 'offline', last_seen: null, away_count: 0 },
    ],
    summary: { total: 28, active: 18, away: 3, lost: 2, offline: 5 },
    at: now,
  }
}

function ClassroomConnectionPanel({ presence, open, busy, focusLabel, session, onToggle, onRefresh }) {
  const summary = presence?.summary || {}
  const students = presence?.students || []
  return (
    <section className={`classroom-connection-panel ${session ? 'is-live' : ''} ${open ? 'is-open' : ''}`} aria-label="학생 앱 연결 현황">
      <header>
        <button type="button" className="classroom-connection-toggle" onClick={onToggle} aria-expanded={open}>
          <UsersThree weight="fill" />
          <b>학생 연결</b>
          {session
            ? <><strong>{summary.active ?? 0}/{summary.total ?? 0}</strong><span>접속</span></>
            : <span>연결을 시작하면 학생 상태가 표시됩니다</span>}
          {open ? <CaretUp /> : <CaretDown />}
        </button>
        {session && (
          <div className="classroom-connection-summary" aria-label="학생 연결 요약">
            <span className="is-active">접속 <b>{summary.active ?? 0}</b></span>
            <span className="is-away">벗어남 <b>{summary.away ?? 0}</b></span>
            <span className="is-lost">확인 필요 <b>{summary.lost ?? 0}</b></span>
            <span className="is-offline">미접속 <b>{summary.offline ?? 0}</b></span>
          </div>
        )}
        <button type="button" className="classroom-connection-refresh" onClick={onRefresh} disabled={busy || !session}
          aria-label="학생 연결 현황 새로고침" title="학생 연결 현황 새로고침">
          <ArrowClockwise className={busy ? 'is-spinning' : ''} />
        </button>
      </header>
      {open && session && (
        <div className="classroom-connection-body">
          <p className="classroom-focus-delivery"><Broadcast weight="fill" /><b>학생 앱 위치 전달</b><span>{focusLabel || '학습 화면을 열면 학생의 따라가기 버튼에 위치가 표시됩니다.'}</span></p>
          <ul>
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
      )}
    </section>
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
  const initialLink = useMemo(() => initialCourseLink(initialSubject, initialContext), [initialContext, initialSubject])
  const [tab, setTab] = useState(initialLink ? 'study' : 'home')
  const [deepLink, setDeepLink] = useState(initialLink)
  const [learningContext, setLearningContext] = useState(initialContext || { subject: initialLink?.subject || initialSubject, mode: null })
  const [coachOpen, setCoachOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [classroomZoom, setClassroomZoom] = useState(() => initialClassroomZoom(teachingMode))
  const [panning, setPanning] = useState(false)
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState(initialClassId || '')
  const [session, setSession] = useState(null)
  const [presence, setPresence] = useState(null)
  const [presenceOpen, setPresenceOpen] = useState(() => true)
  const [presenceBusy, setPresenceBusy] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const contextReady = Boolean(
    learningContext.subject &&
    learningContext.mode &&
    learningContext.stage &&
    !['area-choice', 'lesson-choice'].includes(learningContext.stage),
  )

  const previewBackRef = useRef(null)
  previewBackRef.current = () => {
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
    if (!teachingMode) return undefined
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
  }, [teachingMode])

  useEffect(() => {
    if (!teachingMode || typeof window === 'undefined') return
    try { window.localStorage.setItem(CLASSROOM_ZOOM_STORAGE_KEY, String(classroomZoom)) }
    catch { }
    if (classroomZoom === 1) stageRef.current?.scrollTo({ left: 0, top: 0 })
  }, [classroomZoom, teachingMode])

  useEffect(() => {
    if (!teachingMode) return undefined
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
  }, [classroomZoom, teachingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!teachingMode || !focusMode) return undefined
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
  }, [focusMode, teachingMode])

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

  useEffect(() => {
    if (!teachingMode || !session || demoMode) return
    const focus = classFocus(learningContext)
    if (!focus) return
    const key = JSON.stringify(focus)
    if (focusRef.current === key) return
    focusRef.current = key
    supabase.rpc('rpc_set_class_focus', { p_session_id: session, p_focus: focus }).then(({ error }) => {
      if (!error) return
      focusRef.current = ''
      setSessionMessage('학생 기기에 현재 학습 위치를 보내지 못했습니다. 다시 연결해 주세요.')
    })
  }, [demoMode, learningContext, session, teachingMode])

  function openStudy(target) {
    const next = typeof target === 'string' || target == null ? campusCourseTarget(target) : target
    setDeepLink(next)
    setLearningContext({ subject: next?.subject || null, mode: next?.mode || null })
    setTab('study')
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

  return (
    <div ref={rootRef} className={`screen teacher-learning-preview ${teachingMode ? 'is-teaching' : ''} ${focusMode ? 'is-focus' : ''} ${classroomZoom > 1 ? 'is-zoomed' : ''}`}>
      <header className="teacher-preview-context">
        <button type="button" className="teacher-preview-back" onClick={leavePreview}
          aria-label="교사 캠퍼스로 돌아가기" title="교사 캠퍼스로 돌아가기">
          <ArrowLeft weight="bold" />
        </button>
        <span className="teacher-preview-mark"><Buildings weight="fill" /></span>
        <div className="teacher-preview-heading">
          <small>{teachingMode ? 'CLASSROOM · STUDENT APP' : 'STUDENT VIEW · TEACHER PASS'}</small>
          <b>{teachingMode
            ? (learningContext.lessonLabel || learningContext.areaLabel || '학생 앱 그대로 교실 수업')
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
          {teachingMode && (
            <ClassroomZoomControl zoom={classroomZoom}
              onDecrease={() => changeClassroomZoom(-1)} onReset={() => applyClassroomZoom(1)}
              onIncrease={() => changeClassroomZoom(1)} />
          )}
          {teachingMode ? (
            <button type="button" className="teacher-preview-classroom is-focus-launch" onClick={toggleClassroomFocus}
              aria-label={focusMode ? '수업 집중 화면 종료' : '수업 집중 화면'} title={focusMode ? '수업 집중 화면 종료' : '수업 집중 화면'}>
              {focusMode ? <ArrowsInSimple weight="bold" /> : <ArrowsOutSimple weight="bold" />}
              <span>{focusMode ? '수업 화면 종료' : '수업 집중 화면'}</span>
            </button>
          ) : (
            <button type="button" className="teacher-preview-classroom"
              onClick={() => onOpenClassroom?.({ ...learningContext, coachOpen })} aria-label="교실 수업으로 열기" title="교실 수업으로 열기">
              <Monitor weight="bold" />
            </button>
          )}
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
          session={session}
          focusLabel={classFocus(learningContext)?.label}
          onToggle={() => setPresenceOpen(value => !value)}
          onRefresh={() => loadPresence()}
        />
      )}

      <div ref={stageRef}
        className={`teacher-preview-stage ${coachOpen ? 'has-coach' : ''} ${classroomZoom > 1 ? 'is-pannable' : ''} ${panning ? 'is-panning' : ''}`}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
        aria-label={teachingMode && classroomZoom > 1 ? `확대된 수업 화면 ${Math.round(classroomZoom * 100)}%, 드래그 또는 방향키로 이동` : undefined}>
        <div className="teacher-preview-canvas" style={teachingMode ? {
          width: `${classroomZoom * 100}%`,
          height: `${classroomZoom * 100}%`,
          flexBasis: `${classroomZoom * 100}%`,
          '--classroom-zoom': classroomZoom,
        } : undefined}>
        <div className="teacher-preview-body" style={teachingMode ? {
          width: `${100 / classroomZoom}%`,
          height: `${100 / classroomZoom}%`,
          flex: `0 0 ${100 / classroomZoom}%`,
          transform: `scale(${classroomZoom})`,
        } : undefined}>
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
              key={deepLink ? `${deepLink.subject}:teacher-preview` : 'teacher-preview-browse'}
              deepLink={deepLink}
              onContextChange={setLearningContext}
              onBack={() => { setDeepLink(null); setTab('home') }}
            />
          )}
          {tab === 'growth' && <WrongAnswerScreen profile={profile} />}
          {tab === 'messages' && <NotificationsScreen demo />}
          {tab === 'ranking' && <RankingScreen />}
        </div>
        </div>
        {coachOpen && (
          <TeacherLessonCoach
            subject={learningContext.subject}
            mode={learningContext.mode}
            context={learningContext}
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
