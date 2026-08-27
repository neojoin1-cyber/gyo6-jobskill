import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle, CloudArrowUp, SignOut, Trash, WarningCircle } from '@phosphor-icons/react'
import { getDeviceSyncStatus } from '../lib/deviceSync.js'

export default function SaveExitDialog({
  open,
  onCancel,
  onSaveExit,
  onDiscardExit,
  title = '현재 내용을 저장하고 종료할까요?',
  description = '작성 중인 내용과 학습 위치를 저장한 뒤 안전하게 종료합니다.',
  actionLabel = '저장 후 종료',
  discardLabel,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (open) return
    setSaving(false)
    setError('')
    setBlocked(false)
    setConfirmDiscard(false)
  }, [open])

  if (!open) return null

  const status = getDeviceSyncStatus()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const isLogout = actionLabel.includes('로그아웃')
  const resolvedDiscardLabel = discardLabel || (isLogout ? '저장하지 않고 로그아웃' : '저장하지 않고 종료')

  async function submit() {
    if (saving) return
    setSaving(true)
    setError('')
    setBlocked(false)
    try {
      const result = await onSaveExit?.()
      if (result?.blocked) {
        setError('공용 PC의 기기 사본을 지우려면 인터넷 연결 후 저장해야 합니다. 저장하지 않을 경우 아래에서 기기 기록을 삭제할 수 있습니다.')
        setBlocked(true)
        setSaving(false)
        return
      }
      if (result?.error && !result?.syncResult?.offline) {
        setError('저장 연결을 확인하지 못했습니다. 내용은 이 계정의 기기 공간에 보관되어 있습니다.')
        setSaving(false)
      }
    } catch {
      setError('저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
      setSaving(false)
    }
  }

  async function discard() {
    if (saving || !onDiscardExit) return
    setSaving(true)
    setError('')
    try {
      await onDiscardExit()
    } catch {
      setError('기기 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setSaving(false)
    }
  }

  if (confirmDiscard) return (
    <div className="save-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="save-discard-title" aria-describedby="save-discard-description">
      <div className="save-exit-card is-discard-confirm">
        <span className="save-exit-icon is-warning"><WarningCircle weight="duotone" /></span>
        <h2 id="save-discard-title">{resolvedDiscardLabel}할까요?</h2>
        <p id="save-discard-description">
          이 기기에서 아직 동기화되지 않은 학습·작성·첨삭·지도 변경은 복구할 수 없습니다.
        </p>
        <div className="save-exit-loss">
          <WarningCircle weight="fill" />
          <span>
            <b>{status.dirty > 0 ? `동기화 전 변경 ${status.dirty}개가 삭제됩니다.` : '이 기기의 현재 계정 사본을 삭제합니다.'}</b>
            <small>서버에 이미 저장된 기록과 다른 사용자의 기록은 삭제되지 않습니다.</small>
          </span>
        </div>
        {error && <p className="save-exit-error" role="alert"><WarningCircle weight="fill" />{error}</p>}
        <footer>
          <button type="button" onClick={() => { setConfirmDiscard(false); setError('') }} disabled={saving}>
            <ArrowLeft weight="bold" /> 저장 화면으로
          </button>
          <button type="button" className="is-danger" onClick={discard} disabled={saving}>
            {saving ? <><span className="spinner" />정리 중</> : <><Trash weight="bold" />기기 기록 삭제 후 로그아웃</>}
          </button>
        </footer>
      </div>
    </div>
  )

  return (
    <div className="save-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="save-exit-title">
      <div className="save-exit-card">
        <span className="save-exit-icon"><CloudArrowUp weight="duotone" /></span>
        <h2 id="save-exit-title">{title}</h2>
        <p>{description}</p>
        <div className="save-exit-status">
          <CheckCircle weight="fill" />
          <span><b>{offline ? '기기 계정 공간에 저장됨' : '기기 자동 저장 완료'}</b><small>{offline ? '인터넷 연결 후 같은 계정으로 로그인하면 동기화합니다.' : status.dirty > 0 ? `${status.dirty}개 변경을 계정에 동기화합니다.` : '새로 동기화할 변경이 없습니다.'}</small></span>
        </div>
        {error && <p className="save-exit-error" role="alert"><WarningCircle weight="fill" />{error}</p>}
        <footer>
          <button type="button" onClick={onCancel} disabled={saving}>계속 사용</button>
          <button type="button" className="is-primary" onClick={submit} disabled={saving}>
            {saving ? <><span className="spinner" />저장 중</> : <><SignOut weight="bold" />{actionLabel}</>}
          </button>
          {onDiscardExit && (
            <button type="button" className="is-discard" onClick={() => { setConfirmDiscard(true); setError('') }} disabled={saving}>
              {resolvedDiscardLabel}
              <small>{blocked ? '저장 연결이 안 될 때만 선택하세요.' : '공용 PC에서 미동기화 변경을 버리고 계정 사본을 지웁니다.'}</small>
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
