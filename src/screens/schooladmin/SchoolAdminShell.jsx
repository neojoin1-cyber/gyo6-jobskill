import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { isSharedDevice } from '../../lib/deviceSettings.js'
import { logoutSafely, saveBeforeExit } from '../../lib/sessionLifecycle.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import TeachersScreen from '../admin/TeachersScreen.jsx'
import SchoolClassesScreen from './SchoolClassesScreen.jsx'
import SchoolRankingScreen from './SchoolRankingScreen.jsx'
import TeacherSubjectScreen from './TeacherSubjectScreen.jsx'
import SchoolSubjectAssignScreen from './SchoolSubjectAssignScreen.jsx'
import SchoolTextbookScreen from './SchoolTextbookScreen.jsx'
import ClassWeaknessScreen from '../teacher/ClassWeaknessScreen.jsx'
import ClassProgressScreen from '../teacher/ClassProgressScreen.jsx'
import BulkRegisterModal from '../admin/BulkRegisterModal.jsx'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

export default function SchoolAdminShell() {
  const { profile } = useAuth()
  const [tab, setTab]             = useState('pending')
  const [bulkModal, setBulkModal] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [screen, setScreen]       = useState(null)   // {name, classId, className} 오버레이 화면

  function logout() { setConfirmExit('logout') }
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
    { id: 'pending',   icon: '👥', label: '회원·학급' },
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
      <SaveExitDialog
        open={Boolean(confirmExit)}
        onCancel={() => setConfirmExit(false)}
        onSaveExit={async () => {
          if (confirmExit === 'logout') return logoutSafely({ clearDevice: isSharedDevice() })
          const result = await saveBeforeExit()
          setConfirmExit(false)
          if (Capacitor.isNativePlatform()) App.exitApp()
          return result
        }}
        onDiscardExit={confirmExit === 'logout' && isSharedDevice()
          ? () => logoutSafely({ clearDevice: true, discardLocal: true })
          : undefined}
        title={confirmExit === 'logout' ? '관리 기록을 저장하고 로그아웃할까요?' : '현재 내용을 저장하고 종료할까요?'}
        description={confirmExit === 'logout' && isSharedDevice() ? '동기화가 끝나면 이 공용 PC에서 현재 계정의 기기 사본을 제거합니다.' : '현재 관리 위치와 변경 내용을 저장한 뒤 안전하게 종료합니다.'}
        actionLabel={confirmExit === 'logout' ? '저장 후 로그아웃' : '저장 후 종료'}
      />
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
        {tab === 'pending'  && <TeachersScreen currentRole={profile?.role} />}
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
