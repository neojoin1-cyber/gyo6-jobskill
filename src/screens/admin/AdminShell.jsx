import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { isSharedDevice } from '../../lib/deviceSettings.js'
import { logoutSafely, saveBeforeExit } from '../../lib/sessionLifecycle.js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { ThemeToggle } from '../../lib/theme.jsx'
import SchoolsScreen      from './SchoolsScreen.jsx'
import TeachersScreen     from './TeachersScreen.jsx'
import StatsScreen        from './StatsScreen.jsx'
import AdminRankingScreen from './AdminRankingScreen.jsx'
import CourseListScreen   from '../student/CourseListScreen.jsx'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

export default function AdminShell({ profile }) {
  const [tab,         setTab]         = useState('schools')
  const [confirmExit, setConfirmExit] = useState(false)

  function logout() { setConfirmExit('logout') }

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
        title={confirmExit === 'logout' ? '운영 기록을 저장하고 로그아웃할까요?' : '현재 내용을 저장하고 종료할까요?'}
        description={confirmExit === 'logout' && isSharedDevice() ? '동기화가 끝나면 이 공용 PC에서 현재 계정의 기기 사본을 제거합니다.' : '현재 운영 위치와 변경 내용을 저장한 뒤 안전하게 종료합니다.'}
        actionLabel={confirmExit === 'logout' ? '저장 후 로그아웃' : '저장 후 종료'}
      />
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
