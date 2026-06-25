import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import SchoolsScreen      from './SchoolsScreen.jsx'
import TeachersScreen     from './TeachersScreen.jsx'
import StatsScreen        from './StatsScreen.jsx'
import AdminRankingScreen from './AdminRankingScreen.jsx'
import CourseListScreen   from '../student/CourseListScreen.jsx'

export default function AdminShell() {
  const [tab, setTab] = useState('schools')

  async function logout() { await supabase.auth.signOut() }

  const tabs = [
    { id: 'schools',  icon: '🏫', label: '학교'   },
    { id: 'teachers', icon: '👩‍🏫', label: '교사'   },
    { id: 'content',  icon: '📚', label: '교재'   },
    { id: 'ranking',  icon: '🏆', label: '순위'   },
    { id: 'stats',    icon: '📊', label: '통계'   },
  ]

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">⚙️ 관리자</span>
        <ThemeToggle />
        <button className="appbar-back" onClick={logout} style={{ fontSize: 13 }}>로그아웃</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'schools'  && <SchoolsScreen />}
        {tab === 'teachers' && <TeachersScreen />}
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
