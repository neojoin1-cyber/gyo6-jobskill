import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase.js'
import { ThemeProvider } from './lib/theme.jsx'
import { initPushNotifications } from './lib/pushNotifications.js'
import LoginScreen from './screens/LoginScreen.jsx'
import AdminShell from './screens/admin/AdminShell.jsx'
import SchoolAdminShell from './screens/schooladmin/SchoolAdminShell.jsx'
import TeacherShell from './screens/teacher/TeacherShell.jsx'
import StudentShell from './screens/student/StudentShell.jsx'

export const AuthCtx = createContext(null)
export function useAuth() { return useContext(AuthCtx) }

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AppInner() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) { setProfile(null); setProfileLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setProfileLoading(true)
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setProfileLoading(false)
        if (data?.role === 'student') {
          initPushNotifications(data.id)
        }
      })
  }, [session?.user?.id])

  if (session === undefined) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  if (!session) return <LoginScreen />

  if (profileLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>
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
            onClick={() => supabase.auth.signOut()}>
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
            onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  return (
    <AuthCtx.Provider value={{ session, profile }}>
      {profile.role === 'admin'
        ? <AdminShell />
        : profile.role === 'school_admin'
          ? <SchoolAdminShell />
          : (profile.role === 'teacher' || profile.role === 'class_admin')
            ? <TeacherShell />
            : <StudentShell />
      }
    </AuthCtx.Provider>
  )
}
