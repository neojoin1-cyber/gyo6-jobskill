import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, Bell, Briefcase, CheckCircle, Desktop, SignOut, Trash } from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { getDeviceSyncStatus, syncDeviceState } from '../../lib/deviceSync.js'
import { isSharedDevice, setSharedDevice } from '../../lib/deviceSettings.js'
import { LEARNING_DATA_GROUPS, resetLearningGroup } from '../../lib/learningDataManagement.js'
import { deleteOwnAccount, logoutSafely } from '../../lib/sessionLifecycle.js'
import { userLocalStorage } from '../../lib/userLocalStorage.js'
import {
  PERSONALIZED_ACTIVITY_PROFILES,
  PERSONALIZED_MAJOR_PROFILES,
  certificateOptions,
} from '../../lib/personalizedCareerExamples.js'
import { hifiveDepartment, hifiveDepartmentOptions } from '../../lib/hifiveDepartmentCatalog.js'
import RankingScreen from './RankingScreen.jsx'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

const CAREER_CONTEXT_KEY = 'iv_personalized_example_context'

function readCareerContext() {
  try {
    const value = JSON.parse(userLocalStorage.getItem(CAREER_CONTEXT_KEY) || '{}')
    const source = PERSONALIZED_ACTIVITY_PROFILES.find(item => item.id === value.sourceType || item.label === value.sourceType)
    return {
      majorGroup: value.majorGroup || 'general',
      departmentName: value.departmentName || '',
      certificateId: value.certificateId || '',
      sourceType: source?.id || 'major-practice',
      styleId: value.styleId || 'clear',
    }
  } catch {
    return { majorGroup: 'general', departmentName: '', certificateId: '', sourceType: 'major-practice', styleId: 'clear' }
  }
}

function formatSync(value) {
  if (!value) return '이 기기에서 아직 동기화하지 않음'
  return new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AccountDataScreen({ onOpenCareer }) {
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
  const [career, setCareer] = useState(readCareerContext)
  const [careerSaved, setCareerSaved] = useState('')
  const [evidenceStatus, setEvidenceStatus] = useState({ loading: true, count: 0, error: false })
  const initials = useMemo(() => String(profile?.display_name || '나').slice(0, 1), [profile?.display_name])
  const departments = useMemo(() => hifiveDepartmentOptions({ includeExpansion: true }), [])
  const certificates = useMemo(() => certificateOptions(career.majorGroup), [career.majorGroup])

  useEffect(() => {
    let active = true
    if (!profile?.id) {
      setEvidenceStatus({ loading: false, count: 0, error: false })
      return () => { active = false }
    }
    supabase.from('cover_letter_evidence').select('id').eq('student_id', profile.id).then(({ data, error }) => {
      if (active) setEvidenceStatus({ loading: false, count: Array.isArray(data) ? data.length : 0, error: Boolean(error) })
    }).catch(() => {
      if (active) setEvidenceStatus({ loading: false, count: 0, error: true })
    })
    return () => { active = false }
  }, [profile?.id])

  function changeCareer(key, value) {
    setCareerSaved('')
    setCareer(current => {
      if (key === 'majorGroup') return { ...current, majorGroup: value, departmentName: '', certificateId: '' }
      if (key === 'departmentName') {
        const matched = hifiveDepartment(value)
        return { ...current, departmentName: value, majorGroup: matched?.majorGroup || current.majorGroup, certificateId: matched && matched.majorGroup !== current.majorGroup ? '' : current.certificateId }
      }
      return { ...current, [key]: value }
    })
  }

  function saveCareerContext() {
    userLocalStorage.setItem(CAREER_CONTEXT_KEY, JSON.stringify(career))
    setStatus(getDeviceSyncStatus())
    setCareerSaved('저장됨 · 다음 동기화 때 PC와 휴대폰에 함께 반영됨')
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

        <section className="account-career-panel">
          <header><Briefcase weight="duotone" /><div><h2>취업 준비 기본정보</h2><p>자기소개서와 면접에서 공통으로 사용할 학과·자격·활동 기준</p></div></header>
          <div className="account-career-fields">
            <label className="is-wide"><span>학과</span><input list="account-hifive-departments" value={career.departmentName} onChange={event => changeCareer('departmentName', event.target.value)} placeholder="학과명을 입력하거나 선택" /><datalist id="account-hifive-departments">{departments.map(item => <option key={item.name} value={item.name}>{item.schoolCount}개교</option>)}</datalist></label>
            <label><span>학과군</span><select value={career.majorGroup} onChange={event => changeCareer('majorGroup', event.target.value)}>{PERSONALIZED_MAJOR_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label><span>대표 활동</span><select value={career.sourceType} onChange={event => changeCareer('sourceType', event.target.value)}>{PERSONALIZED_ACTIVITY_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="is-wide"><span>취득·준비 중인 자격</span><select value={career.certificateId} onChange={event => changeCareer('certificateId', event.target.value)}><option value="">아직 선택하지 않음</option>{certificates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className="account-career-actions"><button onClick={saveCareerContext}>기본정보 저장</button><button onClick={() => onOpenCareer?.()}>작성근거 관리</button></div>
          <p className={evidenceStatus.error ? 'is-error' : ''}>{evidenceStatus.loading ? '저장한 작성근거 확인 중' : evidenceStatus.error ? '작성근거를 불러오지 못함 · 자기소개서관에서 다시 확인' : `저장한 작성근거 ${evidenceStatus.count}장`}{careerSaved ? ` · ${careerSaved}` : ''}</p>
        </section>

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
          <div><b>기기 알림</b><span>현재 앱에서는 선생님 메시지를 소식 메뉴에서 확인함. 기기 알림은 안정화 뒤 다시 제공함.</span></div>
          <button className="account-setting-action" disabled>준비 중</button>
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
