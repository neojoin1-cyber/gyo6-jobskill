import { useMemo, useState } from 'react'
import { ArrowsClockwise, CheckCircle, Desktop, SignOut, Trash } from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { getDeviceSyncStatus, syncDeviceState } from '../../lib/deviceSync.js'
import { isSharedDevice, setSharedDevice } from '../../lib/deviceSettings.js'
import { LEARNING_DATA_GROUPS, resetLearningGroup } from '../../lib/learningDataManagement.js'
import { logoutSafely } from '../../lib/sessionLifecycle.js'
import RankingScreen from './RankingScreen.jsx'

function formatSync(value) {
  if (!value) return '이 기기에서 아직 동기화하지 않음'
  return new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AccountDataScreen() {
  const { profile } = useAuth() ?? {}
  const [view, setView] = useState('account')
  const [shared, setShared] = useState(() => isSharedDevice())
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [status, setStatus] = useState(() => getDeviceSyncStatus())
  const [confirm, setConfirm] = useState(null)
  const initials = useMemo(() => String(profile?.display_name || '나').slice(0, 1), [profile?.display_name])

  async function syncNow() {
    setSyncing(true)
    const result = await syncDeviceState({ force: true })
    setStatus(getDeviceSyncStatus())
    setSyncResult(result.ok ? 'PC와 휴대폰에서 이어갈 준비가 됐습니다.' : result.offline ? '인터넷 연결 후 자동으로 동기화합니다.' : '동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setSyncing(false)
  }

  if (view === 'ranking') return (
    <div className="account-ranking-wrap">
      <div className="account-section-tabs">
        <button onClick={() => setView('account')}>계정·기기</button>
        <button className="is-on">내 순위</button>
      </div>
      <RankingScreen />
    </div>
  )

  return (
    <div className="screen account-data-screen">
      <div className="account-section-tabs">
        <button className="is-on">계정·기기</button>
        <button onClick={() => setView('ranking')}>내 순위</button>
      </div>
      <div className="screen-body account-data-body">
        <header className="account-identity"><span>{initials}</span><div><h1>{profile?.display_name || '학생'}</h1><p>내 학습 기록과 기기 연결</p></div></header>

        <section className="account-sync-panel">
          <div><b>PC·휴대폰 이어하기</b><span>{formatSync(status.lastSync)} · {status.dirty}개 변경 대기</span></div>
          <button onClick={syncNow} disabled={syncing}><ArrowsClockwise /> {syncing ? '동기화 중' : '지금 동기화'}</button>
          {syncResult && <p><CheckCircle weight="fill" /> {syncResult}</p>}
        </section>

        <section className="account-setting-row">
          <Desktop />
          <div><b>공용 PC 모드</b><span>로그아웃 전에 동기화하고 이 계정의 기기 사본을 제거함</span></div>
          <button className={`switch-control${shared ? ' is-on' : ''}`} role="switch" aria-checked={shared} aria-label="공용 PC 모드" onClick={() => { const next = !shared; setShared(next); setSharedDevice(next) }}><span /></button>
        </section>

        <section className="account-reset-section">
          <header><h2>과목별 다시 학습</h2><p>선택한 과목의 내 진행 기록만 지우고 처음부터 시작합니다.</p></header>
          <div className="account-reset-list">
            {LEARNING_DATA_GROUPS.map(group => <div key={group.id}><span><b>{group.label}</b><small>{group.detail}</small></span><button onClick={() => setConfirm(group)} title={`${group.label} 기록 초기화`} aria-label={`${group.label} 기록 초기화`}><Trash /></button></div>)}
          </div>
        </section>

        <button className="account-logout" onClick={() => logoutSafely({ clearDevice: shared })}><SignOut /> 안전하게 로그아웃</button>
      </div>

      {confirm && <div className="account-confirm" role="dialog" aria-modal="true"><div><h2>{confirm.label} 기록을 지울까요?</h2><p>다른 과목과 계정 정보는 그대로 유지됩니다. 삭제 내용은 다음 동기화 때 다른 기기에도 반영됩니다.</p><footer><button onClick={() => setConfirm(null)}>취소</button><button className="is-danger" onClick={() => { resetLearningGroup(confirm.id); setConfirm(null); setStatus(getDeviceSyncStatus()) }}>기록 지우기</button></footer></div></div>}
    </div>
  )
}
