import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowsInSimple,
  ArrowsOutSimple,
  Bell,
  Broadcast,
  Buildings,
  ChartLineUp,
  Compass,
  House,
  Monitor,
  PresentationChart,
  StopCircle,
  UserCircle,
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
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState(initialClassId || '')
  const [session, setSession] = useState(null)
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

  useEffect(() => {
    if (!teachingMode || !classId) {
      setSession(null)
      return
    }
    if (demoMode) return
    let active = true
    supabase.rpc('rpc_class_presence', { p_class_id: classId }).then(({ data }) => {
      if (active) setSession(data?.session || null)
    })
    return () => { active = false }
  }, [classId, demoMode, teachingMode])

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

  async function startSession() {
    if (!classId || sessionBusy) return
    if (demoMode) {
      setSession('demo-session')
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
      focusRef.current = ''
    }
    setSessionBusy(false)
  }

  async function endSession() {
    if (!classId || sessionBusy) return
    if (demoMode) {
      setSession(null)
      setSessionMessage('체험 연결을 종료했습니다.')
      return
    }
    setSessionBusy(true)
    const { error } = await supabase.rpc('rpc_end_class_session', { p_class_id: classId })
    if (error) setSessionMessage(error.message)
    else {
      setSession(null)
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
    <div ref={rootRef} className={`screen teacher-learning-preview ${teachingMode ? 'is-teaching' : ''} ${focusMode ? 'is-focus' : ''}`}>
      <header className="teacher-preview-context">
        <button type="button" className="teacher-preview-back" onClick={goPrevious} aria-label="이전 화면으로 돌아가기">
          <ArrowLeft weight="bold" />
        </button>
        <span className="teacher-preview-mark"><Buildings weight="fill" /></span>
        <div>
          <small>{teachingMode ? 'CLASSROOM · STUDENT APP' : 'STUDENT VIEW · TEACHER PASS'}</small>
          <b>{teachingMode ? '학생 앱 그대로 교실 수업' : '학생과 같은 화면으로 배우기'}</b>
        </div>
        <div className="teacher-preview-actions">
          <button type="button" className={`teacher-preview-exit ${coachOpen ? 'is-on' : ''}`} disabled={!contextReady}
            title={contextReady ? '현재 단계의 교사용 추가 자료' : '학습관에서 단원을 열면 활성화됩니다'}
            onClick={() => setCoachOpen(value => !value)} aria-expanded={coachOpen} aria-haspopup="dialog">
            <PresentationChart weight={coachOpen ? 'fill' : 'regular'} /><span>{contextReady ? '교사 지원' : '단원 선택 전'}</span>
          </button>
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
      </header>

      {teachingMode && (
        <section className="teacher-class-session-strip" aria-label="학생 기기 수업 연결">
          <div>
            <Broadcast weight={session ? 'fill' : 'regular'} />
            <span><b>{session ? '학생 기기와 연결됨' : '학생 기기 연결'}</b><small>학생이 ‘따라가기’를 누르면 같은 학습 화면이 열립니다.</small></span>
          </div>
          {classes.length > 0 ? (
            <select aria-label="연결할 학급" value={classId} onChange={event => setClassId(event.target.value)} disabled={Boolean(session)}>
              {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          ) : <span className="teacher-session-no-class">등록된 학급 없음</span>}
          {session ? (
            <button type="button" className="is-stop" onClick={endSession} disabled={sessionBusy}><StopCircle weight="fill" /> 연결 종료</button>
          ) : (
            <button type="button" onClick={startSession} disabled={!classId || sessionBusy}><Broadcast weight="fill" /> 연결 시작</button>
          )}
          {sessionMessage && <p role="status">{sessionMessage}</p>}
        </section>
      )}

      {teachingMode && focusMode && (
        <header className="classroom-focus-bar">
          <div className="classroom-focus-title">
            <PresentationChart weight="fill" />
            <span><small>CLASSROOM FOCUS</small><b>수업 집중 화면</b></span>
          </div>
          <p>{learningContext.lessonLabel || learningContext.areaLabel || '학생 학습 화면'}</p>
          <div className="classroom-focus-actions">
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

      <div className={`teacher-preview-stage ${coachOpen ? 'has-coach' : ''}`}>
        <div className="teacher-preview-body">
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
          {tab === 'messages' && <NotificationsScreen />}
          {tab === 'ranking' && <RankingScreen />}
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
