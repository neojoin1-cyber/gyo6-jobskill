import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import SchoolsScreen         from './SchoolsScreen.jsx'
import TeachersScreen        from './TeachersScreen.jsx'
import StatsScreen           from './StatsScreen.jsx'
import AdminRankingScreen    from './AdminRankingScreen.jsx'
import StudyScreen           from '../student/StudyScreen.jsx'
import InterviewStudyScreen  from '../student/InterviewStudyScreen.jsx'
import QualityMgmtScreen     from '../student/QualityMgmtScreen.jsx'

const STUDY_SUBS = [
  { id: 'subject',   label: '📚 교과 학습' },
  { id: 'interview', label: '🎤 면접 학습' },
  { id: 'quality',   label: '🏭 품질경영' },
]

export default function AdminShell() {
  const [tab, setTab]           = useState('schools')
  const [studySub, setStudySub] = useState('subject')

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

        {tab === 'content' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 교재 종류 선택 바 */}
            <div style={{
              display: 'flex', gap: 0,
              borderBottom: '2px solid var(--border)',
              background: 'var(--card)',
              flexShrink: 0,
            }}>
              {STUDY_SUBS.map(s => (
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
