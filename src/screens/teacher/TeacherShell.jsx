import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import TeacherDashboard from './TeacherDashboard.jsx'
import TeacherRankingScreen from './TeacherRankingScreen.jsx'
import TeacherGradingScreen from './TeacherGradingScreen.jsx'
import MissionCreateScreen from './MissionCreateScreen.jsx'
import ClassResultsScreen from './ClassResultsScreen.jsx'
import PendingStudentsScreen from './PendingStudentsScreen.jsx'

export default function TeacherShell() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [screen, setScreen] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  // 채점 대기 건수 조회 (탭 배지용)
  useEffect(() => {
    async function loadPending() {
      const { data: tc } = await supabase.from('teacher_classes').select('class_id')
      const classIds = (tc ?? []).map(r => r.class_id)
      if (classIds.length === 0) return
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('grading_status', 'pending')
        .in('mission_id',
          supabase.from('missions').select('id').in('class_id', classIds)
        )
      setPendingCount(count ?? 0)
    }
    loadPending()
  }, [tab])

  function navigate(name, params = {}) {
    setScreen({ name, ...params })
  }

  function closeScreen() { setScreen(null) }

  async function logout() { await supabase.auth.signOut() }

  if (screen) {
    if (screen.name === 'pending-students')
      return <PendingStudentsScreen onBack={closeScreen} />
    if (screen.name === 'create-mission')
      return <MissionCreateScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
    if (screen.name === 'class-results')
      return <ClassResultsScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
  }

  const tabs = [
    { id: 'dashboard', icon: '🏫', label: '대시보드' },
    { id: 'grading',   icon: '📝', label: '채점', badge: pendingCount },
    { id: 'ranking',   icon: '🏆', label: '순위' },
  ]

  return (
    <div className="screen">
      <div className="appbar" style={{ justifyContent: 'space-between' }}>
        <span className="appbar-title">🏫 {profile.display_name} 선생님</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ThemeToggle />
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => navigate('pending-students')}>
            학생승인
          </button>
          <button className="appbar-back" onClick={logout} style={{ fontSize: 13 }}>로그아웃</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'dashboard' && (
          <TeacherDashboard
            profile={profile}
            onLogout={logout}
            onNavigate={navigate}
            hideAppbar
          />
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

      <nav className="bottom-tab">
        {tabs.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ position: 'relative' }}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
            {t.badge > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: 'var(--danger)', color: '#fff',
                borderRadius: 10, padding: '1px 5px', fontSize: 10, fontWeight: 700, lineHeight: 1.4,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
