import { Suspense, useState, useEffect, useRef } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  Bell,
  ChartLineUp,
  Compass,
  House,
  UserCircle,
} from '@phosphor-icons/react'
import StudentCampusHome     from './StudentCampusHome.jsx'
import { fetchMyClassSession, startPresence, stopPresence, setFocusListener } from '../../lib/presence.js'
import { campusCourseTarget } from '../../lib/studentCampusRoutes.js'
import { rememberStudentLearningContext } from '../../lib/studentLearningJourney.js'
import { lazyChunk } from '../../lib/lazyChunk.js'
import { logoutSafely, saveBeforeExit } from '../../lib/sessionLifecycle.js'
import { isSharedDevice } from '../../lib/deviceSettings.js'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

const MissionScreen = lazyChunk(() => import('./MissionScreen.jsx'), 'MissionScreen')
const AccountDataScreen = lazyChunk(() => import('./AccountDataScreen.jsx'), 'AccountDataScreen')
const NotificationsScreen = lazyChunk(() => import('./NotificationsScreen.jsx'), 'NotificationsScreen')
const CourseListScreen = lazyChunk(() => import('./CourseListScreen.jsx'), 'CourseListScreen')
const WrongAnswerScreen = lazyChunk(() => import('./WrongAnswerScreen.jsx'), 'WrongAnswerScreen')

function ScreenLoading() {
  return <div className="screen shell-screen-loading"><div className="spinner" /><p>화면 준비 중</p></div>
}

/** ?open=study&subject=…&area=…&lesson= 를 읽는다. 없으면 null. */
function readDeepLink() {
  try {
    const p = new URLSearchParams(window.location.search)
    if (p.get('open') !== 'study' || !p.get('subject')) return null
    const link = {
      subject: p.get('subject'),
      area: p.get('area') || null,
      lesson: p.get('lesson') || null,
      mode: 'study',
    }
    window.history.replaceState({}, '', window.location.pathname)
    return link
  } catch { return null }
}

export default function StudentShell() {
  const { profile, isTrial, exitTrial } = useAuth() ?? {}

  /**
   * 수업 중인지 확인하고, 맞으면 참여 신호를 보낸다.
   *
   * 앱을 열 때 한 번 묻고, 이후에는 자기 학급 세션의 변경을 실시간으로 받는다.
   * 네트워크가 잠시 끊긴 경우를 위해 화면 복귀와 분산 폴백에서도 다시 묻는다.
   *
   * 띠를 띄우는 이유 — 이건 미성년자를 보는 기능이다. 모르게 보지 않는다.
   */
  const [classSession, setClassSession] = useState(null)
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    const check = async () => {
      const s = await fetchMyClassSession()
      if (!alive) return
      setClassSession(s)
      if (s?.session_id) startPresence(s.session_id)
      else stopPresence()
    }
    check()
    // 참여 신호 응답에 선생님 위치가 실려 온다. 따로 물어보지 않는다.
    setFocusListener(focus => {
      if (!alive) return
      setClassSession(prev => (prev ? { ...prev, focus } : prev))
    })
    let channel = null
    ;(async () => {
      const { data: membership } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', profile.id)
        .limit(1)
        .maybeSingle()
      if (!alive || !membership?.class_id) return
      channel = supabase
        .channel(`student-class-session:${membership.class_id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'class_sessions',
          filter: `class_id=eq.${membership.class_id}`,
        }, check)
        .subscribe()
    })()
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    let fallbackTimer = null
    const scheduleFallback = () => {
      const delay = 4 * 60 * 1000 + Math.floor(Math.random() * 2 * 60 * 1000)
      fallbackTimer = window.setTimeout(async () => {
        await check()
        if (alive) scheduleFallback()
      }, delay)
    }
    scheduleFallback()
    return () => {
      alive = false
      setFocusListener(null)
      window.clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) supabase.removeChannel(channel)
      stopPresence()
    }
  }, [profile?.id])
  // 수업 덱의 링크·QR로 들어오는 경로. 앱에는 주소 라우팅이 아예 없어서
  // 교사가 특정 차시를 가리킬 방법이 없었다. 읽고 나면 주소는 지운다 —
  // 남겨 두면 학생이 홈으로 갔다가 새로고침할 때마다 같은 차시로 끌려온다.
  const urlLink = useRef(readDeepLink()).current
  // 수업 「따라가기」로 옮겨 갈 때도 같은 길을 쓴다. URL 로 들어온 것과
  // 선생님 위치로 들어온 것을 구분할 이유가 없다.
  const [followLink, setFollowLink] = useState(null)
  const [studyResetKey, setStudyResetKey] = useState(0)
  const [following, setFollowing] = useState(false)
  const deepLink = followLink ?? urlLink
  const [tab,         setTab]         = useState(deepLink ? 'study' : 'home')
  // 홈 위에 전체 화면(출석·스피드퀴즈·복습)이 떠 있는 동안엔 탭바를 감춘다.
  const [immersive,   setImmersive]   = useState(false)
  const [overlay,     setOverlay]     = useState(null)   // { screen, ...params }
  const [confirmExit, setConfirmExit] = useState(false)

  function openMission(mission) { setOverlay({ screen: 'mission', mission }) }
  function closeOverlay()       { setOverlay(null) }

  // Android 뒤로가기: 오버레이 닫기 → 홈 탭 → 종료 확인
  const backRef = useRef(null)
  backRef.current = () => {
    if (overlay) { closeOverlay(); return }
    if (tab !== 'home') { setTab('home'); return }
    setConfirmExit(true)
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  if (overlay?.screen === 'mission') {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <MissionScreen
          mission={overlay.mission}
          onBack={closeOverlay}
          onViewWrongAnswers={() => { closeOverlay(); setTab('wrong') }}
        />
      </Suspense>
    )
  }

  const tabs = [
    { id: 'home', icon: House, label: '홈' },
    { id: 'study', icon: Compass, label: '탐험' },
    { id: 'wrong', icon: ChartLineUp, label: '성장' },
    { id: 'notifications', icon: Bell, label: '소식' },
    { id: 'ranking', icon: UserCircle, label: '나' },
  ]

  return (
    <div className="screen">
      <SaveExitDialog
        open={confirmExit}
        onCancel={() => setConfirmExit(false)}
        onSaveExit={async () => {
          const native = Capacitor.isNativePlatform()
          const result = isTrial
            ? (native ? { syncResult: { ok: true } } : await exitTrial?.() || { syncResult: { ok: true } })
            : native
              ? await saveBeforeExit()
              : await logoutSafely({ clearDevice: isSharedDevice() })
          if (!result?.blocked) setConfirmExit(false)
          if (native) App.exitApp()
          return result
        }}
        onDiscardExit={!Capacitor.isNativePlatform() && !isTrial && isSharedDevice()
          ? () => logoutSafely({ clearDevice: true, discardLocal: true })
          : undefined}
        title={isTrial ? '학생 체험을 종료할까요?' : Capacitor.isNativePlatform() ? '현재 내용을 저장하고 종료할까요?' : '학습 기록을 저장하고 로그아웃할까요?'}
        description={isTrial ? '체험 기록은 서버에 저장되지 않습니다.' : Capacitor.isNativePlatform() ? '작성 중인 내용과 학습 위치를 저장한 뒤 안전하게 종료합니다.' : '현재 학습 위치와 작성 내용을 동기화한 뒤 이 공용 PC의 계정 사본을 제거합니다.'}
        actionLabel={isTrial ? '체험 종료' : Capacitor.isNativePlatform() ? '저장 후 종료' : '저장 후 로그아웃'}
      />

      {classSession && (
        <div className="class-session-bar">
          <span className="dot" />
          <span className="cs-txt">
            수업 중{classSession.title ? ` · ${classSession.title}` : ''}
            {classSession.focus?.label
              ? <> — 선생님: <b>{classSession.focus.label}</b></>
              : ' — 선생님이 참여 상태를 봅니다'}
          </span>
          {/* 뒷자리에서 칠판 글씨가 안 보여도 자기 기기에서 같은 곳을 연다.
              선생님이 밀어 넣는 것이 아니라 학생이 눌러서 간다. */}
          {classSession.focus?.subject && (
            <button className="cs-follow" disabled={following} onClick={async () => {
              setFollowing(true)
              const latest = await fetchMyClassSession()
              const focus = latest?.focus || classSession.focus
              if (latest) setClassSession(latest)
              setFollowLink({
                subject: focus.subject || 'job-common',
                track: focus.track || null,
                area: focus.area || null,
                lesson: focus.lesson || null,
                questionId: focus.questionId || null,
                index: Number.isInteger(focus.index) ? focus.index : null,
                mode: focus.mode || 'study',
              })
              setTab('study')
              setFollowing(false)
            }}>{following ? '연결 중' : '따라가기'}</button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {tab === 'home' && (
          <StudentCampusHome
            profile={profile}
            onOpenMission={openMission}
            onGoStudy={target => {
              setFollowLink(typeof target === 'string' || target == null ? campusCourseTarget(target) : target)
              setTab('study')
            }}
            onGoWrong={() => setTab('wrong')}
            onGoMessages={() => setTab('notifications')}
          />
        )}

        <Suspense fallback={<ScreenLoading />}>
          {tab === 'study' && <CourseListScreen
            key={`${deepLink ? [deepLink.subject, deepLink.mode ?? 'choose', deepLink.area, deepLink.lesson, deepLink.questionId, deepLink.index].join(':') : 'browse'}:${studyResetKey}`}
            deepLink={deepLink}
            onContextChange={rememberStudentLearningContext}
            onBack={() => { setFollowLink(null); setTab('home') }} />}

          {tab === 'wrong'         && <WrongAnswerScreen profile={profile} />}
          {tab === 'ranking'       && <AccountDataScreen onOpenCareer={() => {
            setFollowLink({ subject: 'cover-letter', area: null, lesson: null, mode: 'cover-practical' })
            setTab('study')
          }} />}
          {tab === 'notifications' && <NotificationsScreen />}
        </Suspense>
      </div>

      {!immersive && (
      <nav className="bottom-tab">
        {tabs.map(t => (
          <button key={t.id}
            className={`tab-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              if (t.id === 'study') {
                setFollowLink(null)
                setStudyResetKey(value => value + 1)
              }
              setTab(t.id)
            }}>
            <span className="tab-icon"><t.icon weight={tab === t.id ? 'fill' : 'regular'} /></span>
            {t.label}
          </button>
        ))}
      </nav>
      )}
    </div>
  )
}
