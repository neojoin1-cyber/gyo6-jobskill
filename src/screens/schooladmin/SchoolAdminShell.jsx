import { useState } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import PendingTeachersScreen from './PendingTeachersScreen.jsx'
import SchoolClassesScreen from './SchoolClassesScreen.jsx'
import SchoolRankingScreen from './SchoolRankingScreen.jsx'
import TeacherSubjectScreen from './TeacherSubjectScreen.jsx'
import BulkRegisterModal from '../admin/BulkRegisterModal.jsx'

export default function SchoolAdminShell() {
  const { profile } = useAuth()
  const [tab, setTab]             = useState('pending')
  const [bulkModal, setBulkModal] = useState(false)

  async function logout() { await supabase.auth.signOut() }

  const tabs = [
    { id: 'pending',   icon: '⏳', label: '교사승인' },
    { id: 'subjects',  icon: '📚', label: '과목배정' },
    { id: 'classes',   icon: '🏫', label: '학급현황' },
    { id: 'ranking',   icon: '🏆', label: '순위' },
  ]

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">🏫 {profile.display_name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ThemeToggle />
          <button className="appbar-back" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setBulkModal(true)}>
            📤 일괄등록
          </button>
          <button className="appbar-back" onClick={logout} style={{ fontSize: 13 }}>로그아웃</button>
        </div>
      </div>

      {bulkModal && (
        <BulkRegisterModal
          fixedSchoolId={profile.school_id}
          onClose={() => setBulkModal(false)}
          onDone={() => setBulkModal(false)}
        />
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'pending'  && <PendingTeachersScreen />}
        {tab === 'subjects' && <div className="screen-body" style={{ paddingTop: 0 }}><TeacherSubjectScreen /></div>}
        {tab === 'classes'  && <SchoolClassesScreen />}
        {tab === 'ranking'  && <div className="screen-body" style={{ paddingTop: 0 }}><SchoolRankingScreen /></div>}
      </div>

      <nav className="bottom-tab">
        {tabs.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
