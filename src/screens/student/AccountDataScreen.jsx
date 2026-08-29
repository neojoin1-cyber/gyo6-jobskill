import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, Bell, CheckCircle, Desktop, SignOut, Trash } from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { getDeviceSyncStatus, syncDeviceState } from '../../lib/deviceSync.js'
import { isSharedDevice, setSharedDevice } from '../../lib/deviceSettings.js'
import { LEARNING_DATA_GROUPS, resetLearningGroup } from '../../lib/learningDataManagement.js'
import { deleteOwnAccount, logoutSafely } from '../../lib/sessionLifecycle.js'
import { getPushPermissionStatus, requestPushNotifications } from '../../lib/pushNotifications.js'
import RankingScreen from './RankingScreen.jsx'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

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
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pushState, setPushState] = useState({ loading: true, supported: true, enabled: false, message: '' })
  const initials = useMemo(() => String(profile?.display_name || '나').slice(0, 1), [profile?.display_name])

  useEffect(() => {
    let active = true
    getPushPermissionStatus().then(result => {
      if (active) setPushState({ loading: false, ...result, message: '' })
    })
    return () => { active = false }
  }, [])

  async function enablePush() {
    setPushState(previous => ({ ...previous, loading: true, message: '' }))
    const result = await requestPushNotifications(profile?.id)
    const current = await getPushPermissionStatus()
    setPushState({
      loading: false,
      ...current,
      message: result?.ok ? '선생님 메시지와 학습 알림을 받을 수 있습니다.' : '기기 설정에서 JOB고 알림을 허용해 주세요.',
    })
  }

  async function syncNow() {
    setSyncing(true)
    const result = await syncDeviceState()
    setStatus(getDeviceSyncStatus())
    setSyncResult(result.ok
      ? 'PC와 휴대폰에서 이어갈 준비가 됐습니다.'
      : result.offline
        ? '인터넷 연결 후 자동으로 동기화합니다.'
        : result.tooLarge
          ? '저장 자료가 커서 동기화를 멈췄습니다. 오래된 작성본을 정리한 뒤 다시 시도해 주세요.'
          : '동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setSyncing(false)
  }

  async function removeAccount() {
    if (deletePhrase.trim() !== '계정 삭제') return
    setDeleting(true)
    setDeleteError('')
    const result = await deleteOwnAccount()
    if (!result.ok) {
      setDeleteError(result.error?.message || '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
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

        <section className="account-setting-row">
          <Bell />
          <div><b>기기 알림</b><span>{pushState.enabled ? '선생님 메시지와 복습 소식을 받을 수 있음' : pushState.message || '필요할 때 직접 켜며 로그인 중에는 권한 창을 띄우지 않음'}</span></div>
          <button className="account-setting-action" disabled={pushState.loading || pushState.enabled || !pushState.supported} onClick={enablePush}>
            {pushState.loading ? '확인 중' : pushState.enabled ? '켜짐' : pushState.supported ? '켜기' : '미지원'}
          </button>
        </section>

        <section className="account-reset-section">
          <header><h2>과목별 다시 학습</h2><p>선택한 과목의 내 진행 기록만 지우고 처음부터 시작합니다.</p></header>
          <div className="account-reset-list">
            {LEARNING_DATA_GROUPS.map(group => <div key={group.id}><span><b>{group.label}</b><small>{group.detail}</small></span><button onClick={() => setConfirm(group)} title={`${group.label} 기록 초기화`} aria-label={`${group.label} 기록 초기화`}><Trash /></button></div>)}
          </div>
        </section>

        <button className="account-logout" onClick={() => setConfirmLogout(true)}><SignOut /> 저장하고 로그아웃</button>
        <button className="account-delete" onClick={() => { setDeletePhrase(''); setDeleteError(''); setDeleteOpen(true) }}><Trash /> 계정 및 데이터 삭제</button>
        <div className="account-legal-links"><a href="https://gyo6.kr/privacy.html" target="_blank" rel="noreferrer">개인정보처리방침</a><a href="https://gyo6.kr/account-deletion.html" target="_blank" rel="noreferrer">계정 삭제 안내</a></div>
      </div>

      {confirm && <div className="account-confirm" role="dialog" aria-modal="true"><div><h2>{confirm.label} 기록을 지울까요?</h2><p>다른 과목과 계정 정보는 그대로 유지됩니다. 삭제 내용은 다음 동기화 때 다른 기기에도 반영됩니다.</p><footer><button onClick={() => setConfirm(null)}>취소</button><button className="is-danger" onClick={() => { resetLearningGroup(confirm.id); setConfirm(null); setStatus(getDeviceSyncStatus()) }}>기록 지우기</button></footer></div></div>}
      {deleteOpen && <div className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="student-account-delete-title"><div><h2 id="student-account-delete-title">계정과 모든 데이터를 삭제할까요?</h2><p>학습 기록, 작성본, 오답, 첨삭 기록과 계정 정보가 영구 삭제되며 되돌릴 수 없습니다. 계속하려면 아래에 <b>계정 삭제</b>를 입력하세요.</p><label className="account-delete-label">확인 문구<input autoFocus value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} placeholder="계정 삭제" disabled={deleting} /></label>{deleteError && <p className="account-delete-error" role="alert">{deleteError}</p>}<footer><button onClick={() => setDeleteOpen(false)} disabled={deleting}>취소</button><button className="is-danger" onClick={removeAccount} disabled={deleting || deletePhrase.trim() !== '계정 삭제'}>{deleting ? '삭제 중' : '영구 삭제'}</button></footer></div></div>}
      <SaveExitDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onSaveExit={() => logoutSafely({ clearDevice: shared })}
        onDiscardExit={shared ? () => logoutSafely({ clearDevice: true, discardLocal: true }) : undefined}
        title="학습 기록을 저장하고 로그아웃할까요?"
        description={shared ? '서버 동기화가 끝나면 이 공용 PC에서 현재 계정의 학습 사본을 제거합니다.' : '현재 학습 위치와 작성 내용을 동기화한 뒤 로그아웃합니다.'}
        actionLabel="저장 후 로그아웃"
      />
    </div>
  )
}
