import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import SchoolsScreen      from './SchoolsScreen.jsx'
import TeachersScreen     from './TeachersScreen.jsx'
import StatsScreen        from './StatsScreen.jsx'
import AdminRankingScreen from './AdminRankingScreen.jsx'
import CourseListScreen   from '../student/CourseListScreen.jsx'

export default function AdminShell({ profile }) {
  const [tab,         setTab]         = useState('schools')
  const [confirmExit, setConfirmExit] = useState(false)

  async function logout() { await supabase.auth.signOut({ scope: 'local' }) }

  // 뒤로가기: 최신 tab을 ref로 읽어 처리(핸들러 1회 등록 → id 기반 해제, 스택 오염 방지)
  const backRef = useRef(null)
  backRef.current = () => {
    if (tab !== 'schools') { setTab('schools'); return }
    setConfirmExit(true)
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  const tabs = [
    { id: 'schools',  icon: '🏫', label: '학교'   },
    { id: 'teachers', icon: '👥', label: '회원'   },
    { id: 'content',  icon: '📚', label: '교재'   },
    { id: 'ranking',  icon: '🏆', label: '순위'   },
    { id: 'stats',    icon: '📊', label: '통계'   },
  ]

  return (
    <div className="screen">
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
      <div className="appbar">
        <span className="appbar-title">⚙️ 관리자</span>
        <ThemeToggle />
        <button className="appbar-back" onClick={logout} style={{ fontSize: 13 }}>로그아웃</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'schools'  && <SchoolsScreen />}
        {tab === 'teachers' && <TeachersScreen currentRole={profile?.role} />}
        {tab === 'ranking'  && <div className="screen-body" style={{ paddingTop: 0 }}><AdminRankingScreen /></div>}
        {tab === 'stats'    && <StatsScreen />}
        {tab === 'content'  && <CourseListScreen />}
      </div>

      <nav className="bottom-tab">
        {tabs.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
