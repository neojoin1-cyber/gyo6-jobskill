import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import {
  Buildings,
  CaretDown,
  ChartBar,
  ChatCircleDots,
  ClipboardText,
  Compass,
  DeviceMobile,
  House,
  Monitor,
  SignOut,
  Student,
} from '@phosphor-icons/react'
import { startTeacherLayout, setView, viewChoice, effectiveView, onViewChange } from '../../lib/teacherLayout.js'
import TeacherRankingScreen from './TeacherRankingScreen.jsx'
import TeacherGradingScreen from './TeacherGradingScreen.jsx'
import MissionCreateScreen from './MissionCreateScreen.jsx'
import ClassResultsScreen from './ClassResultsScreen.jsx'
import ClassDiagnosticsScreen from './ClassDiagnosticsScreen.jsx'
import ClassPersonalityScreen from './ClassPersonalityScreen.jsx'
import ClassAdminSubjectScreen from './ClassAdminSubjectScreen.jsx'
import ClassWeaknessScreen from './ClassWeaknessScreen.jsx'
import ClassProgressScreen from './ClassProgressScreen.jsx'
import TeacherTextbookScreen from './TeacherTextbookScreen.jsx'
import PendingStudentsScreen from './PendingStudentsScreen.jsx'
import TeacherWorkspace from './TeacherWorkspace.jsx'

// 수업 모드와 메시지는 무겁고 대시보드에서만 열렸다. 가로 작업대의 왼쪽
// 메뉴에서도 열 수 있어야 하므로 셸이 길을 갖는다.
const ClassroomScreen      = lazy(() => import('./ClassroomScreen.jsx'))
const TeacherMessageScreen = lazy(() => import('./TeacherMessageScreen.jsx'))
const CoverLetterReviewScreen = lazy(() => import('./CoverLetterReviewScreen.jsx'))
const TeacherLearningPreview = lazy(() => import('./TeacherLearningPreview.jsx'))
const TeacherInterviewPracticeScreen = lazy(() => import('./TeacherInterviewPracticeScreen.jsx'))

export default function TeacherShell() {
  const { profile } = useAuth() ?? {}
  const teacherName = String(profile?.display_name || '선생님').replace(/\s*(?:선생님|선생)$/, '') || '선생'
  const [tab,         setTab]         = useState('dashboard')
  const [screen,      setScreen]      = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const backRef = useRef(null)
  backRef.current = () => {
    if (screen) { closeScreen(); return }
    if (tab !== 'dashboard') { setTab('dashboard'); return }
    setConfirmExit(true)
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  /**
   * 교사 화면은 폰 프레임을 벗고, 세로·가로를 교사가 고른다.
   *
   * 학생 앱은 큰 화면에서도 폰 폭(480px)으로 보여 주는 것이 맞다. 학생은
   * 폰으로 쓴다. **교사는 다르다** — 태블릿을 프로젝터에 물리거나 PC 에
   * 연결해 수업 도구로 쓴다. 1920px 한가운데 480px 기둥으로는 안 된다.
   */
  const [layout, setLayout] = useState(() => ({ choice: viewChoice(), effective: effectiveView() }))
  useEffect(() => {
    const stop = startTeacherLayout()
    const off = onViewChange((effective, choice) => setLayout({ choice, effective }))
    return () => { off(); stop() }
  }, [])

  /**
   * 가로를 고르면 큰 화면에 맞춰 준비까지 한다 — 전체 화면 + 방향 잠금.
   * 배치만 바꾸고 교사가 따로 전체 화면을 눌러야 한다면 고르는 의미가 없다.
   * 잠금이 막히는 기기(데스크톱·iOS)에서도 배치는 바뀐다.
   */
  function chooseView(v) {
    setView(v)
  }

  /**
   * 가로 작업대가 쓸 학급·미션.
   *
   * 대시보드도 같은 것을 읽지만, 작업대는 대시보드를 거치지 않고 바로
   * 그린다. 한 번 더 읽는 대신 화면 구조가 단순해진다 — 5분 캐시가 있어
   * 실제 요청은 늘지 않는다.
   */
  const [wsClasses,  setWsClasses]  = useState([])
  const [wsMissions, setWsMissions] = useState([])
  const [workspaceState, setWorkspaceState] = useState('loading')
  async function loadWorkspace() {
    if (!profile?.id) return
    setWorkspaceState('loading')
    try {
      const { data: tc, error: classError } = await supabase
        .from('teacher_classes').select('class_id, classes(id, name, grade, class_code)')
        .eq('teacher_id', profile.id)
      if (classError) throw classError
      const list = (tc ?? []).map(r => r.classes).filter(Boolean)
      setWsClasses(list)
      if (!list.length) {
        setWsMissions([])
        setWorkspaceState('ready')
        return
      }
      const { data: ms, error: missionError } = await supabase.from('missions')
        .select('id, title, mission_type, status, class_id')
        .in('class_id', list.map(c => c.id)).order('created_at', { ascending: false }).limit(30)
      if (missionError) throw missionError
      setWsMissions(ms ?? [])
      setWorkspaceState('ready')
    } catch {
      setWorkspaceState('error')
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [profile?.id])

  // 채점 대기 건수 조회 (탭 배지용)
  useEffect(() => {
    let cancelled = false
    async function loadPending() {
      const { data: tc } = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', profile.id)
      const classIds = (tc ?? []).map(r => r.class_id)
      if (classIds.length === 0) return
      // .in()은 배열만 허용 — 쿼리 빌더를 넘기면 TypeError로 배지 집계 전체가 죽는다(실사고)
      const { data: ms } = await supabase.from('missions').select('id').in('class_id', classIds)
      const missionIds = (ms ?? []).map(r => r.id)
      const [{ count: subCount }, { count: mockCount }] = await Promise.all([
        missionIds.length
          ? supabase
              .from('submissions')
              .select('id', { count: 'exact', head: true })
              .eq('grading_status', 'pending')
              .in('mission_id', missionIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('mock_assessments')
          .select('id', { count: 'exact', head: true })
          .eq('grading_status', 'pending')
          .in('class_id', classIds),
      ])
      if (cancelled) return
      setPendingCount((subCount ?? 0) + (mockCount ?? 0))
    }
    loadPending()
    return () => { cancelled = true }
  }, [tab, profile?.id])

  function navigate(name, params = {}) {
    setScreen({ name, ...params })
  }

  function closeScreen() { setScreen(null) }

  async function logout() { await supabase.auth.signOut({ scope: 'local' }) }

  if (screen) {
    if (screen.name === 'classroom')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <ClassroomScreen onBack={closeScreen} />
        </Suspense>
      )
    if (screen.name === 'messages')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <TeacherMessageScreen
            onBack={closeScreen}
            initialScope={screen.scope}
            initialTarget={screen.target}
            initialStudentName={screen.studentName}
            initialTitle={screen.title}
            initialBody={screen.body}
          />
        </Suspense>
      )
    if (screen.name === 'cover-reviews')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <CoverLetterReviewScreen onBack={closeScreen} initialClassId={screen.classId} />
        </Suspense>
      )
    if (screen.name === 'interview-coaching')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <TeacherInterviewPracticeScreen
            onBack={closeScreen}
            initialClassId={screen.classId}
            onMessage={params => navigate('messages', params)}
          />
        </Suspense>
      )
    if (screen.name === 'pending-students')
      return <PendingStudentsScreen onBack={closeScreen} />
    if (screen.name === 'create-mission')
      return <MissionCreateScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-results')
      return <ClassResultsScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-diagnostics')
      return <ClassDiagnosticsScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-personality')
      return <ClassPersonalityScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-subjects')
      return <ClassAdminSubjectScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-weakness')
      return <ClassWeaknessScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-progress')
      return <ClassProgressScreen classId={screen.classId} className={screen.className} onBack={closeScreen}
        onMessage={student => navigate('messages', { scope: 'personal', target: student.student_id, studentName: student.display_name })} />
    if (screen.name === 'textbook-browse')
      return <TeacherTextbookScreen onBack={closeScreen} />
    if (screen.name === 'student-campus')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <TeacherLearningPreview
            profile={profile}
            initialSubject={screen.subject}
            teachingMode={screen.teachingMode}
            onBack={closeScreen}
            onOpenClassroom={() => navigate('classroom')}
            onOpenMessages={(params = {}) => navigate('messages', params)}
          />
        </Suspense>
      )
  }

  return (
    <div className="screen teacher-shell-screen">
      {confirmExit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>앱을 종료하시겠습니까?</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>확인을 누르면 앱이 종료됩니다.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmExit(false)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { setConfirmExit(false); if (Capacitor.isNativePlatform()) App.exitApp() }}>종료</button>
            </div>
          </div>
        </div>
      )}
      <header className="teacher-shellbar">
        <button className="teacher-shell-brand" onClick={() => { setTab('dashboard'); setScreen(null) }}>
          <span><Buildings weight="fill" /></span>
          <div><b>스킬캠퍼스</b><small>TEACHER</small></div>
        </button>
        <div className="teacher-shell-actions">
          <button className="teacher-shell-icon" onClick={() => navigate('student-campus')} title="학생 화면 그대로 보기" aria-label="학생 화면 그대로 보기">
            <Compass weight="bold" />
          </button>
          <ThemeToggle />
          <div className="teacher-account-menu">
            <button className="teacher-account-trigger" onClick={() => setAccountOpen(value => !value)} aria-expanded={accountOpen}>
              <span>{teacherName.slice(0, 1)}</span>
              <b>{teacherName}</b>
              <CaretDown />
            </button>
            {accountOpen && (
              <div className="teacher-account-popover">
                <header><span>{teacherName.slice(0, 1)}</span><div><b>{teacherName} 선생님</b><small>교사 캠퍼스</small></div></header>
                <button onClick={() => { setAccountOpen(false); navigate('student-campus') }}><Compass /> 학생 화면 그대로 보기</button>
                <button onClick={() => { setAccountOpen(false); navigate('pending-students') }}><Student /> 학생 승인</button>
                <button onClick={() => { chooseView(layout.choice === 'wide' ? 'auto' : 'wide'); setAccountOpen(false) }}>
                  {layout.choice === 'wide' ? <DeviceMobile /> : <Monitor />} {layout.choice === 'wide' ? '자동 맞춤 화면으로' : '넓게 보기 · 교사 작업대'}
                </button>
                <button className="is-logout" onClick={logout}><SignOut /> 로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 가로에서는 왼쪽 메뉴가 늘 보이는 작업대로 그린다. 카드 목록을
          세 칸으로 쪼개는 것과 달리 지금 어디에 있는지가 사라지지 않는다. */}
      {tab === 'dashboard' ? (
        <TeacherWorkspace
          profile={profile} classes={wsClasses} missions={wsMissions}
          workspaceState={workspaceState} onRefresh={loadWorkspace}
          pendingCount={pendingCount} tab={tab} onTab={setTab}
          onNavigate={navigate}
          onOpenClassroom={() => navigate('classroom')}
          onOpenMessages={(params = {}) => navigate('messages', params)}
          onOpenCoverReviews={classId => navigate('cover-reviews', { classId })}
          onOpenInterviewCoach={classId => navigate('interview-coaching', { classId })}
          onOpenStudentCampus={(subject, options = {}) => navigate('student-campus', { subject, ...options })}
        />
      ) : (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {layout.effective === 'wide' && (
          <nav className="teacher-wide-context-nav" aria-label="교사 작업대 바로가기" style={{
            display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px',
            borderBottom: '1px solid var(--border)', background: 'var(--card)', flexWrap: 'wrap',
          }}>
            <button className="btn btn-ghost" onClick={() => setTab('dashboard')}><Buildings /> 학급 캠퍼스</button>
            <button className={`btn ${tab === 'grading' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('grading')}><ClipboardText /> 채점함</button>
            <button className={`btn ${tab === 'ranking' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('ranking')}><ChartBar /> 성장 순위</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => navigate('classroom')}>수업 시작</button>
            <button className="btn btn-ghost" onClick={() => navigate('messages')}>메시지</button>
            <button className="btn btn-ghost" onClick={() => navigate('cover-reviews')}>자소서 첨삭</button>
            <button className="btn btn-ghost" onClick={() => navigate('create-mission')}>미션 만들기</button>
          </nav>
        )}
        {tab === 'grading' && (
          <TeacherGradingScreen onBack={() => setTab('dashboard')} />
        )}
        {tab === 'ranking' && (
          <div className="screen-body" style={{ paddingTop: 0 }}>
            <TeacherRankingScreen />
          </div>
        )}
      </div>
      )}

      {/* 가로에서는 왼쪽 메뉴가 그 일을 하므로 하단 탭을 숨긴다. */}
      {layout.effective !== 'wide' && (
        <nav className="bottom-tab teacher-main-tabs" aria-label="교사 주요 메뉴">
          <button aria-label="홈" className={`tab-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}><span className="tab-icon"><House weight={tab === 'dashboard' ? 'fill' : 'regular'} /></span>홈</button>
          <button aria-label="학습" className="tab-item" onClick={() => navigate('student-campus')}><span className="tab-icon"><Compass /></span>학습</button>
          <button aria-label="수업" className="tab-item teacher-class-tab" onClick={() => navigate('classroom')}><span className="tab-icon"><Buildings weight="fill" /></span>수업</button>
          <button aria-label="학생" className="tab-item" onClick={() => wsClasses[0]
            ? navigate('class-progress', { classId: wsClasses[0].id, className: wsClasses[0].name })
            : navigate('pending-students')}><span className="tab-icon"><Student /></span>학생</button>
          <button aria-label="소통" className="tab-item" onClick={() => navigate('messages')}><span className="tab-icon"><ChatCircleDots /></span>소통</button>
        </nav>
      )}
    </div>
  )
}
