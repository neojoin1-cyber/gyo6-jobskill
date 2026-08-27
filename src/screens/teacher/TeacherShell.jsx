import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import { lazyChunk } from '../../lib/lazyChunk.js'
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
  Trash,
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
import { isSharedDevice } from '../../lib/deviceSettings.js'
import { deleteOwnAccount, logoutSafely } from '../../lib/sessionLifecycle.js'
import { syncDeviceState } from '../../lib/deviceSync.js'
import { saveBeforeExit } from '../../lib/sessionLifecycle.js'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

// 수업 모드와 메시지는 무겁고 대시보드에서만 열렸다. 가로 작업대의 왼쪽
// 메뉴에서도 열 수 있어야 하므로 셸이 길을 갖는다.
const ClassroomScreen = lazyChunk(() => import('./ClassroomScreen.jsx'), 'ClassroomScreen')
const TeacherMessageScreen = lazyChunk(() => import('./TeacherMessageScreen.jsx'), 'TeacherMessageScreen')
const CoverLetterReviewScreen = lazyChunk(() => import('./CoverLetterReviewScreen.jsx'), 'CoverLetterReviewScreen')
const TeacherLearningPreview = lazyChunk(() => import('./TeacherLearningPreview.jsx'), 'TeacherLearningPreview')
const TeacherInterviewPracticeScreen = lazyChunk(() => import('./TeacherInterviewPracticeScreen.jsx'), 'TeacherInterviewPracticeScreen')

export default function TeacherShell() {
  const { profile, isTrial, exitTrial } = useAuth() ?? {}
  const teacherName = String(profile?.display_name || '선생님').replace(/\s*(?:선생님|선생)$/, '') || '선생'
  const [tab,         setTab]         = useState('dashboard')
  const [screen,      setScreen]      = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  // 작업대에서 이미 받은 학급·미션을 재사용한다. 탭을 오갈 때마다 같은
  // teacher_classes/missions 쿼리를 반복하지 않고 대기 건수만 집계한다.
  useEffect(() => {
    let cancelled = false
    async function loadPending() {
      if (!profile?.id) return
      if (workspaceState !== 'ready') return
      const classIds = wsClasses.map(item => item.id)
      if (classIds.length === 0) { setPendingCount(0); return }
      const missionIds = wsMissions.map(item => item.id)
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
  }, [profile?.id, workspaceState, wsClasses, wsMissions])

  function navigate(name, params = {}) {
    setScreen({ name, ...params })
  }

  function closeScreen() { setScreen(null) }

  async function logout() {
    setAccountOpen(false)
    setConfirmExit('logout')
  }

  async function removeAccount() {
    if (deletePhrase.trim() !== '계정 삭제') return
    setDeleting(true)
    setDeleteError('')
    const result = await deleteOwnAccount()
    if (!result.ok) {
      setDeleteError(result.error?.message || '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  if (screen) {
    if (screen.name === 'classroom')
      return (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <ClassroomScreen
            initialSubject={screen.subject}
            initialContext={screen.initialContext}
            initialClassId={screen.classId}
            initialClassName={screen.className}
            initialCoachOpen={screen.openCoach}
            onBack={closeScreen}
            onOpenMessages={(params = {}) => navigate('messages', params)}
          />
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
            onOpenClassroom={context => {
              const next = typeof context === 'string' ? { subject: context } : context || {}
              navigate('classroom', {
                subject: next.subject,
                initialContext: next,
                openCoach: Boolean(next.coachOpen),
              })
            }}
            onOpenMessages={(params = {}) => navigate('messages', params)}
          />
        </Suspense>
      )
  }

  return (
    <div className="screen teacher-shell-screen">
      <SaveExitDialog
        open={Boolean(confirmExit)}
        onCancel={() => setConfirmExit(false)}
        onSaveExit={async () => {
          if (confirmExit === 'logout') return isTrial ? exitTrial?.() : logoutSafely({ clearDevice: isSharedDevice() })
          const result = isTrial ? { syncResult: { ok: true } } : await saveBeforeExit()
          setConfirmExit(false)
          if (Capacitor.isNativePlatform()) App.exitApp()
          return result
        }}
        onDiscardExit={confirmExit === 'logout' && isSharedDevice()
          ? () => logoutSafely({ clearDevice: true, discardLocal: true })
          : undefined}
        title={confirmExit === 'logout' ? (isTrial ? '교사 체험을 종료할까요?' : '수업·지도 기록을 저장하고 로그아웃할까요?') : '현재 내용을 저장하고 종료할까요?'}
        description={confirmExit === 'logout' && isTrial ? '체험 기록은 서버에 저장되지 않습니다.' : confirmExit === 'logout' && isSharedDevice() ? '동기화가 끝나면 이 공용 PC에서 현재 계정의 기기 사본을 제거합니다.' : '현재 수업 위치와 지도 기록을 저장한 뒤 안전하게 종료합니다.'}
        actionLabel={confirmExit === 'logout' ? (isTrial ? '체험 종료' : '저장 후 로그아웃') : '저장 후 종료'}
      />
      {deleteOpen && <div className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="teacher-account-delete-title"><div><h2 id="teacher-account-delete-title">교사 계정과 모든 데이터를 삭제할까요?</h2><p>수업·지도 기록과 계정 정보가 영구 삭제되며 되돌릴 수 없습니다. 계속하려면 아래에 <b>계정 삭제</b>를 입력하세요.</p><label className="account-delete-label">확인 문구<input autoFocus value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} placeholder="계정 삭제" disabled={deleting} /></label>{deleteError && <p className="account-delete-error" role="alert">{deleteError}</p>}<footer><button onClick={() => setDeleteOpen(false)} disabled={deleting}>취소</button><button className="is-danger" onClick={removeAccount} disabled={deleting || deletePhrase.trim() !== '계정 삭제'}>{deleting ? '삭제 중' : '영구 삭제'}</button></footer></div></div>}
      <header className="teacher-shellbar">
        <button className="teacher-shell-brand" onClick={() => { setTab('dashboard'); setScreen(null) }}>
          <span><Buildings weight="fill" /></span>
          <div><b>설탕과소금 스킬캠퍼스</b><small>TEACHER</small></div>
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
                <button onClick={async () => { await syncDeviceState(); setAccountOpen(false) }}><DeviceMobile /> PC·휴대폰 동기화</button>
                <a className="teacher-policy-link" href="https://gyo6.kr/privacy.html" target="_blank" rel="noreferrer">개인정보처리방침</a>
                {!isTrial && <button className="is-delete" onClick={() => { setAccountOpen(false); setDeletePhrase(''); setDeleteError(''); setDeleteOpen(true) }}><Trash /> 계정 및 데이터 삭제</button>}
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
          demo={Boolean(isTrial)}
          workspaceState={workspaceState} onRefresh={loadWorkspace}
          pendingCount={pendingCount} tab={tab} onTab={setTab}
          onNavigate={navigate}
          onOpenClassroom={(context = {}) => navigate('classroom', context)}
          onOpenMessages={(params = {}) => navigate('messages', params)}
          onOpenCoverReviews={classId => navigate('cover-reviews', { classId })}
          onOpenInterviewCoach={classId => navigate('interview-coaching', { classId })}
          onOpenStudentCampus={(subject, options = {}) => navigate('student-campus', { subject, ...options })}
          onSync={() => syncDeviceState()}
          onLogout={logout}
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
