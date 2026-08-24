import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import PendingTeachersScreen from './PendingTeachersScreen.jsx'
import SchoolClassesScreen from './SchoolClassesScreen.jsx'
import SchoolRankingScreen from './SchoolRankingScreen.jsx'
import TeacherSubjectScreen from './TeacherSubjectScreen.jsx'
import SchoolSubjectAssignScreen from './SchoolSubjectAssignScreen.jsx'
import SchoolTextbookScreen from './SchoolTextbookScreen.jsx'
import ClassWeaknessScreen from '../teacher/ClassWeaknessScreen.jsx'
import ClassProgressScreen from '../teacher/ClassProgressScreen.jsx'
import BulkRegisterModal from '../admin/BulkRegisterModal.jsx'

export default function SchoolAdminShell() {
  const { profile } = useAuth()
  const [tab, setTab]             = useState('pending')
  const [bulkModal, setBulkModal] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [screen, setScreen]       = useState(null)   // {name, classId, className} 오버레이 화면

  async function logout() { await supabase.auth.signOut() }
  function navigate(name, params = {}) { setScreen({ name, ...params }) }
  function closeScreen() { setScreen(null) }

  // Android 뒤로가기: 오버레이 → 모달 닫기 → 첫 탭 → 종료 확인
  const backRef = useRef(null)
  backRef.current = () => {
    if (screen) { setScreen(null); return }
    if (bulkModal) { setBulkModal(false); return }
    if (tab !== 'pending') { setTab('pending'); return }
    setConfirmExit(true)
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  const tabs = [
    { id: 'pending',   icon: '⏳', label: '교사승인' },
    { id: 'subjects',  icon: '📚', label: '교사배정' },
    { id: 'assign',    icon: '📖', label: '교재' },
    { id: 'classes',   icon: '🏫', label: '학급현황' },
    { id: 'ranking',   icon: '🏆', label: '순위' },
  ]

  if (screen?.name === 'class-weakness')
    return <ClassWeaknessScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />
  if (screen?.name === 'class-progress')
    return <ClassProgressScreen classId={screen.classId} className={screen.className} onBack={closeScreen} />

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
        {tab === 'assign'   && <SchoolTextbookScreen />}
        {tab === 'classes'  && <SchoolClassesScreen onNavigate={navigate} />}
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
