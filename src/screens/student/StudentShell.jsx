import { useState } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import StudentHome           from './StudentHome.jsx'
import MissionScreen         from './MissionScreen.jsx'
import RankingScreen         from './RankingScreen.jsx'
import NotificationsScreen   from './NotificationsScreen.jsx'
import CourseListScreen      from './CourseListScreen.jsx'
import WrongAnswerScreen     from './WrongAnswerScreen.jsx'

export default function StudentShell() {
  const { profile } = useAuth()
  const [tab,     setTab]     = useState('home')
  const [overlay, setOverlay] = useState(null)   // { screen, ...params }

  function openMission(mission) { setOverlay({ screen: 'mission', mission }) }
  function closeOverlay()       { setOverlay(null) }
  async function logout()       { await supabase.auth.signOut() }

  if (overlay?.screen === 'mission') {
    return (
      <MissionScreen
        mission={overlay.mission}
        onBack={closeOverlay}
        onViewWrongAnswers={() => { closeOverlay(); setTab('wrong') }}
      />
    )
  }

  const tabs = [
    { id: 'home',    icon: '🏠', label: '홈'     },
    { id: 'study',   icon: '📚', label: '학습'   },
    { id: 'wrong',   icon: '📋', label: '오답노트' },
    { id: 'ranking', icon: '🏆', label: '랭킹'   },
    { id: 'notifications', icon: '🔔', label: '알림' },
  ]

  return (
    <div className="screen">
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {tab === 'home' && (
          <StudentHome profile={profile} onOpenMission={openMission} onLogout={logout} />
        )}

        {tab === 'study' && <CourseListScreen />}

        {tab === 'wrong'         && <WrongAnswerScreen profile={profile} />}
        {tab === 'ranking'       && <RankingScreen />}
        {tab === 'notifications' && <NotificationsScreen />}
      </div>

      <nav className="bottom-tab">
        {tabs.map(t => (
          <button key={t.id}
            className={`tab-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
