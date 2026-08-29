import { useState, useEffect, useRef, createContext, useContext, Suspense } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { resetWebAuthSession, supabase } from './lib/supabase.js'
import { ThemeProvider } from './lib/theme.jsx'
import { initPushNotifications } from './lib/pushNotifications.js'
import { scheduleReviewReminder } from './lib/reminders.js'
import {
  TRIAL_ACCOUNTS,
  TRIAL_TIME_LIMIT_ENABLED,
  beginTrialSession,
  clearTrialSession,
  formatTrialRemaining,
  requestedTrialRole,
  setTrialNotice,
  shouldSwitchTrialRole,
  trialRoleFromUser,
} from './lib/trialSession.js'
import { lazyChunk } from './lib/lazyChunk.js'
import LoginScreen from './screens/LoginScreen.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import { activateUserStorage, deactivateUserStorage, userLocalStorage } from './lib/userLocalStorage.js'
import { markIdentityVerified } from './lib/identityVerification.js'
import { logoutSafely } from './lib/sessionLifecycle.js'
import { getDeviceSyncStatus, syncDeviceState } from './lib/deviceSync.js'
const AdminShell = lazyChunk(() => import('./screens/admin/AdminShell.jsx'), 'AdminShell')
const SchoolAdminShell = lazyChunk(() => import('./screens/schooladmin/SchoolAdminShell.jsx'), 'SchoolAdminShell')
const TeacherShell = lazyChunk(() => import('./screens/teacher/TeacherShell.jsx'), 'TeacherShell')
const StudentShell = lazyChunk(() => import('./screens/student/StudentShell.jsx'), 'StudentShell')
const DesignPreview = lazyChunk(() => import('./screens/DesignPreview.jsx'), 'DesignPreview')

export const AuthCtx = createContext(null)
export function useAuth() { return useContext(AuthCtx) }

// ── 강제 업데이트 전화면 ──────────────────────────────────────────────────────
function ForceUpdateScreen({ version, onUpdate }) {
  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 32, gap: 0 }}>
      <div className="empty-state">
        <span className="empty-state-icon">🔄</span>
        <span className="empty-state-title">업데이트가 필요합니다</span>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
          현재 버전은 더 이상 지원되지 않습니다.<br />
          최신 버전({version})으로 업데이트해 주세요.
        </p>
        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: 24 }}
          onClick={onUpdate}
        >
          지금 업데이트
        </button>
      </div>
    </div>
  )
}

// ── 업데이트 권고 배너 ────────────────────────────────────────────────────────
// 새 버전 안내 — 화면 가운데 큰 모달(놓치지 않게)
function UpdateBanner({ version, onUpdate, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.62)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 340, textAlign: 'center', padding: '30px 22px' }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🚀</div>
        <p style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>새 버전이 나왔어요!</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 24 }}>
          최신 버전{version ? ` (${version})` : ''}으로 업데이트하면<br />
          새 학습과 기능을 사용할 수 있어요.
        </p>
        <button className="btn btn-primary btn-full" style={{ fontSize: 16, padding: '14px' }} onClick={onUpdate}>
          지금 업데이트
        </button>
        <button onClick={onDismiss}
          style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
          나중에 하기
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')
  return (
    <ThemeProvider>
      <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
        {preview ? <DesignPreview /> : <AppInner />}
      </Suspense>
    </ThemeProvider>
  )
}

function TrialSessionBar({ role, remaining, limited, onExit }) {
  const account = TRIAL_ACCOUNTS[role]
  const ending = limited && remaining <= 2 * 60 * 1000
  return (
    <div className={`trial-session-bar${ending ? ' is-ending' : ''}`} role="status" aria-live={ending ? 'polite' : 'off'}>
      <div className="trial-session-copy">
        <b>{account?.label || '공개'} 체험</b>
        <span>{limited ? '화면 작동만 저장됨 · 서버 기록 없음' : '제작·검수 중 · 시간 제한 없음 · 서버 기록 없음'}</span>
      </div>
      {limited
        ? <time aria-label={`체험 남은 시간 ${formatTrialRemaining(remaining)}`}>{formatTrialRemaining(remaining)}</time>
        : <span className="trial-session-unlimited">무제한</span>}
      <button type="button" onClick={onExit} aria-label="체험 종료" title="체험 종료">×</button>
    </div>
  )
}

function AppInner() {
  const [session,        setSession]        = useState(undefined)
  const [profile,        setProfile]        = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError]     = useState(false)  // 조회 실패(네트워크) — '프로필 없음'과 구분
  const [profileRetry, setProfileRetry]     = useState(0)
  const [trialExpiresAt, setTrialExpiresAt] = useState(0)
  const [trialNow, setTrialNow]             = useState(Date.now())

  // 업데이트 상태: null(미확인) | 'ok' | 'soft' | 'force'
  const [updateState,    setUpdateState]    = useState(null)
  const [updateInfo,     setUpdateInfo]     = useState({ version: '', storeUrl: '' })
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [updateLaunching, setUpdateLaunching] = useState(false)

  // ── 앱 업데이트 체크 (네이티브 앱일 때만) ──────────────────────────────────
  // 1순위: app_config(Supabase) — 출시 시 latest_build를 올리면 재접속 즉시 감지(신뢰 소스)
  // 2순위: Play Core 인앱 업데이트 가용성 — app_config 미갱신이어도 Play가 알려주면 감지
  // 감지되면 명확한 '업데이트' 버튼 → market:// 으로 Play 스토어 직접 연결
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) { setUpdateState('ok'); return }

    let cancelled = false
    const PLAY_MARKET = 'market://details?id=com.gyo6.jobskill'

    async function checkUpdate() {
      let state = 'ok'
      let info  = { version: '', storeUrl: PLAY_MARKET }
      try {
        const { build } = await CapApp.getInfo()
        const currentBuild = parseInt(build || '0', 10)
        // 1) app_config
        const { data } = await supabase
          .from('app_config')
          .select('min_build, latest_build, latest_version, store_url')
          .eq('key', 'android')
          .maybeSingle()
        if (data) {
          info = { version: data.latest_version || '', storeUrl: data.store_url || PLAY_MARKET }
          if (currentBuild && data.min_build && currentBuild < data.min_build) state = 'force'
          else if (currentBuild && data.latest_build && currentBuild < data.latest_build) state = 'soft'
        }
        // 2) Play Core 네이티브 탐지 (app_config가 ok일 때만 보조 확인)
        if (state === 'ok') {
          const plugin = window.Capacitor?.Plugins?.Gyo6InAppUpdate
          if (plugin?.checkAvailability) {
            const native = await plugin.checkAvailability()
            if (native?.available === true) state = 'soft'
          }
        }
      } catch { /* 네트워크 실패 등 → 업데이트 막지 않음 */ }

      if (cancelled) return
      setUpdateInfo(info)
      setUpdateState(state)
    }

    checkUpdate()
    // 앱 재진입(resume) 시 재확인 — 백그라운드 동안 새 버전이 올라왔을 수 있음
    const listenerP = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        setUpdateLaunching(false)
        checkUpdate()
      }
    })
    return () => {
      cancelled = true
      listenerP.then(l => l.remove()).catch(() => {})
    }
  }, [])

  // 프로필을 이미 로드한 사용자 id — 앱 복귀 시 토큰 리프레시(같은 사용자) 이벤트로
  // 무한 로딩되던 버그 방지용. 사용자가 실제로 바뀔 때만 로딩을 켠다.
  const loadedUidRef = useRef(undefined)

  // ── 인증 상태 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      activateUserStorage(data.session?.user?.id)
      setSession(prev => prev === undefined ? (data.session ?? null) : prev)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      const id = s?.user?.id ?? null
      if (id) activateUserStorage(id)
      // 새/다른 사용자일 때만 로딩 표시(같은 사용자 토큰 리프레시는 로딩 불필요 → 무한로딩 방지)
      if (s && id !== loadedUidRef.current) setProfileLoading(true)
      setSession(s)
      if (!s) {
        clearTrialSession()
        deactivateUserStorage()
        setTrialExpiresAt(0)
        setProfile(null)
        setProfileLoading(false)
        loadedUidRef.current = null
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    loadedUidRef.current = session.user.id   // 이 사용자에 대한 로딩 시작을 기록
    setProfileLoading(true)
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (!error) {
          if (data) {
            userLocalStorage.setItem('sst.cached-profile', JSON.stringify(data))
            markIdentityVerified()
            if (!trialRoleFromUser(session.user)) {
              await Promise.race([
                syncDeviceState(),
                new Promise(resolve => window.setTimeout(resolve, 5000)),
              ])
              if (cancelled) return
            }
          }
          setProfile(data)
          setProfileError(false)
          if (data?.role === 'student') {
            initPushNotifications(data.id, { requestPermission: false })
            scheduleReviewReminder({ requestPermission: false })
          }
        } else {
          let cached = null
          try { cached = JSON.parse(userLocalStorage.getItem('sst.cached-profile') || 'null') } catch { /* 캐시 손상 */ }
          if (cached?.id === session.user.id) {
            setProfile(cached)
            setProfileError(false)
          } else {
            setProfileError(true)   // 캐시도 없을 때만 재연결 화면을 보인다
          }
        }
        setProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [session?.user?.id, profileRetry])

  const trialRole = trialRoleFromUser(session?.user)
  const requestedTrial = Capacitor.isNativePlatform() ? null : requestedTrialRole()
  const switchingTrialRole = Boolean(session && shouldSwitchTrialRole(session.user, requestedTrial))

  // The portal reuses one iframe while switching between student and teacher.
  // Drop the previous local auth session so LoginScreen can honor the new role.
  useEffect(() => {
    if (!switchingTrialRole) return
    clearTrialSession()
    setTrialExpiresAt(0)
    if (resetWebAuthSession()) return
    supabase.auth.signOut({ scope: 'local' })
  }, [switchingTrialRole])

  // 포털 iframe의 load 이벤트는 HTML 문서 수신만 뜻한다. React가 실제
  // 로그인 또는 역할 화면을 그린 뒤 부모 창에 준비 완료를 알린다.
  const appReady = !switchingTrialRole && updateState !== null && session !== undefined &&
    (!session || (!profileLoading && Boolean(profile || profileError)))
  useEffect(() => {
    if (!appReady || Capacitor.isNativePlatform() || window.parent === window) return undefined
    let cancelled = false
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled) return
        window.parent.postMessage({
          type: 'SUGAR_SALT_APP_READY',
          role: profile?.role || 'guest',
          trialRole: trialRole || null,
          path: window.location.pathname,
          at: Date.now(),
        }, '*')
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [appReady, profile?.role, trialRole])

  useEffect(() => {
    if (!session || !trialRole || Capacitor.isNativePlatform()) {
      setTrialExpiresAt(0)
      return undefined
    }

    const started = beginTrialSession(trialRole)
    if (!started.allowed || !started.session) {
      setTrialNotice(started.reason || '체험 이용 시간이 끝났습니다.')
      supabase.auth.signOut({ scope: 'local' })
      return undefined
    }

    const expiresAt = Number(started.session.expiresAt || 0)
    setTrialExpiresAt(expiresAt)
    setTrialNow(Date.now())
    if (!TRIAL_TIME_LIMIT_ENABLED) return undefined

    let expired = false
    const tick = () => {
      const now = Date.now()
      setTrialNow(now)
      if (!expired && now >= expiresAt) {
        expired = true
        setTrialNotice('15분 체험이 끝났습니다. 정식 계정에서는 학습 기록이 안전하게 저장됩니다.')
        clearTrialSession()
        supabase.auth.signOut({ scope: 'local' })
      }
    }
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [session?.user?.id, trialRole])

  async function exitTrial() {
    setTrialNotice('체험을 종료했습니다. 정식 계정으로 로그인하면 모든 기록이 저장됩니다.')
    clearTrialSession()
    await logoutSafely({ clearDevice: true })
  }

  // ── 업데이트 버튼 → 인앱 IMMEDIATE 업데이트(진행 UI+재시작), 불가 시 스토어 폴백 ──
  async function triggerUpdate() {
    const storeUrl = updateInfo.storeUrl || 'market://details?id=com.gyo6.jobskill'
    const plugin = window.Capacitor?.Plugins?.Gyo6InAppUpdate
    setUpdateLaunching(true)
    // 1) Play 인앱 업데이트(앱 안에서 진행 후 자동 재시작)
    try {
      if (Capacitor.isNativePlatform() && plugin?.startImmediateUpdate) {
        const r = await plugin.startImmediateUpdate()
        if (r?.started) return
      }
    } catch { /* 폴백으로 진행 */ }
    // 2) 인앱 업데이트 불가(내부테스트·롤아웃 지연 등) → 네이티브 인텐트로 Play 스토어 확실히 열기
    try {
      if (Capacitor.isNativePlatform() && plugin?.openStore) {
        const r = await plugin.openStore()
        if (r?.opened) return
      }
    } catch { /* 최후 폴백으로 진행 */ }
    // 3) 최후: 웹 방식
    try { window.open(storeUrl, '_system') } catch { /* noop */ }
    finally { setUpdateLaunching(false) }
  }

  // ── 앱 업데이트(빌드 변경) 기록 ────────────────────────────────────────────
  // Android 번들은 정적 자원을 APK/AAB 안에서 직접 읽는다. 업데이트 직후
  // Cache Storage와 서비스워커를 지우며 reload하면 새 Activity가 자리 잡는
  // 순간과 충돌해 빈 WebView가 남을 수 있으므로, 네이티브에서는 빌드 번호만
  // 기록한다. 웹 PWA의 캐시 교체는 Workbox가 담당한다.
  useEffect(() => {
    ;(async () => {
      try {
        const KEY = 'gyo6.app.build'
        if (Capacitor.isNativePlatform()) {
          const info = await CapApp.getInfo()
          localStorage.setItem(KEY, String(info.build || '0'))
        }
      } catch { /* 빌드 기록 실패는 앱 동작을 막지 않음 */ }
    })()
  }, [])

  // 번들에 최신 학습 요약이 들어 있으므로 첫 화면을 막으면서 서버 자료를
  // 받을 필요가 없다. 학생만 유휴 시간에 변경분을 받아 동시 접속 급증도 줄인다.
  useEffect(() => {
    if (!session || profile?.role !== 'student') return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      import('./lib/studySummaries.js')
        .then(({ refreshStudySummaries }) => {
          if (!cancelled) refreshStudySummaries()
        })
        .catch(() => {})
    }, 10_000 + Math.floor(Math.random() * 30_000))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [session?.user?.id, profile?.role])

  // 입력은 즉시 계정별 기기 공간에 저장한다. 웹 브라우저가 숨겨질 때는
  // 서버 동기화를 한 번 시도하고, 아직 변경이 남은 경우에만 닫기 경고를 건다.
  // 브라우저 정책상 탭 닫기 경고 문구와 버튼은 웹앱이 바꿀 수 없다.
  useEffect(() => {
    if (!session || trialRole || Capacitor.isNativePlatform()) return undefined
    const syncWhenHidden = () => {
      if (document.visibilityState === 'hidden' && getDeviceSyncStatus().dirty > 0) syncDeviceState()
    }
    const warnBeforeClose = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    let warningAttached = false
    const updateWarning = () => {
      const shouldWarn = getDeviceSyncStatus().dirty > 0
      if (shouldWarn && !warningAttached) {
        window.addEventListener('beforeunload', warnBeforeClose)
        warningAttached = true
      } else if (!shouldWarn && warningAttached) {
        window.removeEventListener('beforeunload', warnBeforeClose)
        warningAttached = false
      }
    }
    document.addEventListener('visibilitychange', syncWhenHidden)
    window.addEventListener('sst:user-storage-change', updateWarning)
    window.addEventListener('sst:device-sync', updateWarning)
    updateWarning()
    return () => {
      document.removeEventListener('visibilitychange', syncWhenHidden)
      window.removeEventListener('sst:user-storage-change', updateWarning)
      window.removeEventListener('sst:device-sync', updateWarning)
      if (warningAttached) window.removeEventListener('beforeunload', warnBeforeClose)
    }
  }, [session?.user?.id, trialRole])

  const showSoftBanner = updateState === 'soft' && !bannerDismissed

  if (updateLaunching) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div className="empty-state" role="status" aria-live="polite">
          <div className="spinner" />
          <span className="empty-state-title">업데이트를 시작하고 있어요</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
            설치가 끝나면 앱이 새 버전으로 다시 열립니다.
          </p>
        </div>
      </div>
    )
  }

  // ── 강제 업데이트: 앱 전체를 막음 ────────────────────────────────────────
  if (updateState === 'force') {
    return <ForceUpdateScreen version={updateInfo.version} onUpdate={triggerUpdate} />
  }

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (session === undefined || updateState === null || switchingTrialRole) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  if (!session) return (
    <>
      {updateState === 'soft' && !bannerDismissed && (
        <UpdateBanner version={updateInfo.version} onUpdate={triggerUpdate}
          onDismiss={() => setBannerDismissed(true)} />
      )}
      <div style={{ height: '100%' }}>
        <LoginScreen />
      </div>
    </>
  )

  if (profileLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  if (!profile && profileError) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div className="empty-state">
          <span className="empty-state-icon">📶</span>
          <span className="empty-state-title">연결에 문제가 있습니다</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            네트워크 상태를 확인한 뒤 다시 시도해 주세요.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20 }}
            onClick={() => setProfileRetry(n => n + 1)}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div className="empty-state">
          <span className="empty-state-icon">⚠️</span>
          <span className="empty-state-title">프로필이 없습니다</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            가입 절차가 완료되지 않았습니다.<br />
            학생: 로그아웃 후 학교·학과·학반 선택하여 재가입<br />
            교사: 학교 관리자에게 문의하세요
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20 }}
            onClick={() => logoutSafely()}>
            로그아웃 후 다시 가입
          </button>
        </div>
      </div>
    )
  }

  const autoApproved = profile.role === 'admin' || profile.role === 'school_admin'
  if (!profile.approved && !autoApproved) {
    const msgs = {
      teacher:     '학교관리자의 승인을 기다리고 있습니다.\n승인 후 앱을 사용할 수 있습니다.',
      class_admin: '학교관리자의 승인을 기다리고 있습니다.\n승인 후 앱을 사용할 수 있습니다.',
      student:     '담임선생님의 승인을 기다리고 있습니다.\n승인 후 미션에 참여할 수 있습니다.',
    }
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div className="empty-state">
          <span className="empty-state-icon">⏳</span>
          <span className="empty-state-title">승인 대기 중</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {msgs[profile.role] ?? '관리자의 승인을 기다리고 있습니다.'}
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 20, fontSize: 13 }}
            onClick={() => logoutSafely()}>
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  const isTrial = Boolean(trialRole)
  const shell = profile.role === 'admin'
    ? <AdminShell profile={profile} />
    : profile.role === 'school_admin'
      ? <SchoolAdminShell />
      : (profile.role === 'teacher' || profile.role === 'class_admin')
        ? <TeacherShell />
        : <StudentShell />

  return (
    <AuthCtx.Provider value={{ session, profile, isTrial, trialExpiresAt, exitTrial }}>
      {showSoftBanner && (
        <UpdateBanner version={updateInfo.version} onUpdate={triggerUpdate}
          onDismiss={() => setBannerDismissed(true)} />
      )}
      <div className={isTrial ? 'trial-app-frame' : ''} style={{ height: '100%' }}>
        {isTrial && (
          <TrialSessionBar
            role={trialRole}
            remaining={Math.max(0, trialExpiresAt - trialNow)}
            limited={TRIAL_TIME_LIMIT_ENABLED}
            onExit={exitTrial}
          />
        )}
        <div className={isTrial ? 'trial-app-content' : ''} style={{ height: '100%' }}>
          <ConnectionStatus hidden={isTrial} />
          {shell}
        </div>
      </div>
    </AuthCtx.Provider>
  )
}
