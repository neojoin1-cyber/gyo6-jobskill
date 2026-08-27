import { useState } from 'react'
import { CheckCircle, CloudArrowUp, SignOut, WarningCircle } from '@phosphor-icons/react'
import { getDeviceSyncStatus } from '../lib/deviceSync.js'

export default function SaveExitDialog({
  open,
  onCancel,
  onSaveExit,
  onDiscardExit,
  title = '현재 내용을 저장하고 종료할까요?',
  description = '작성 중인 내용과 학습 위치를 저장한 뒤 안전하게 종료합니다.',
  actionLabel = '저장 후 종료',
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  if (!open) return null

  const status = getDeviceSyncStatus()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

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
        <footer className={blocked ? 'has-discard' : ''}>
          <button type="button" onClick={onCancel} disabled={saving}>계속 사용</button>
          <button type="button" className="is-primary" onClick={submit} disabled={saving}>
            {saving ? <><span className="spinner" />저장 중</> : <><SignOut weight="bold" />{actionLabel}</>}
          </button>
          {blocked && onDiscardExit && <button type="button" className="is-discard" onClick={discard} disabled={saving}>기기 기록 삭제 후 로그아웃</button>}
        </footer>
      </div>
    </div>
  )
}
