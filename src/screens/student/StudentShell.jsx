import { useState } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import StudentHome           from './StudentHome.jsx'
import MissionScreen         from './MissionScreen.jsx'
import RankingScreen         from './RankingScreen.jsx'
import NotificationsScreen   from './NotificationsScreen.jsx'
import StudyScreen           from './StudyScreen.jsx'
import WrongAnswerScreen     from './WrongAnswerScreen.jsx'
import InterviewStudyScreen  from './InterviewStudyScreen.jsx'
import QualityMgmtScreen     from './QualityMgmtScreen.jsx'

export default function StudentShell() {
  const { profile } = useAuth()
  const [tab,     setTab]     = useState('home')
  const [overlay, setOverlay] = useState(null)   // { screen, ...params }

  function openMission(mission) { setOverlay({ screen: 'mission', mission }) }
  function closeOverlay()       { setOverlay(null) }
  async function logout()       { await supabase.auth.signOut() }

  // 학습 탭 내 서브 화면
  const [studySub, setStudySub] = useState('subject') // 'subject' | 'interview' | 'quality'

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

        {tab === 'study' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 학습 종류 선택 바 */}
            <div style={{
              display: 'flex', gap: 0,
              borderBottom: '2px solid var(--border)',
              flexShrink: 0,
            }}>
              {[
                { id: 'subject',   label: '📚 교과 학습' },
                { id: 'interview', label: '🎤 면접 학습' },
                { id: 'quality',   label: '🏭 품질경영' },
              ].map(s => (
                <button key={s.id} onClick={() => setStudySub(s.id)}
                  style={{
                    flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer',
                    background: studySub === s.id ? 'var(--primary-light)' : 'transparent',
                    color: studySub === s.id ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: studySub === s.id ? 700 : 400,
                    fontSize: 13,
                    borderBottom: studySub === s.id ? '2px solid var(--primary)' : 'none',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {studySub === 'subject'   && <StudyScreen />}
              {studySub === 'interview' && <InterviewStudyScreen />}
              {studySub === 'quality'   && <QualityMgmtScreen />}
            </div>
          </div>
        )}

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
