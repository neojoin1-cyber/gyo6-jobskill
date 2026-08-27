import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, CloudCheck, CloudSlash, LockKeyOpen } from '@phosphor-icons/react'
import { getDeviceSyncStatus, syncDeviceState } from '../lib/deviceSync.js'
import {
  identityGraceExpired,
  identityNeedsCheck,
  lastIdentityVerification,
  verifyCurrentIdentity,
} from '../lib/identityVerification.js'

function formatLastSync(value) {
  if (!value) return '아직 동기화 안 됨'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '아직 동기화 안 됨' : date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ConnectionStatus({ hidden = false }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [status, setStatus] = useState(() => getDeviceSyncStatus())
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [locked, setLocked] = useState(() => !navigator.onLine && identityGraceExpired())

  const refresh = useCallback(() => {
    setStatus(getDeviceSyncStatus())
    setLocked(!navigator.onLine && identityGraceExpired())
  }, [])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    if (identityNeedsCheck()) await verifyCurrentIdentity()
    await syncDeviceState()
    busyRef.current = false
    setBusy(false)
    refresh()
  }, [refresh])

  useEffect(() => {
    const onOnline = () => { setOnline(true); syncNow() }
    const onOffline = () => { setOnline(false); refresh() }
    const onStorage = () => refresh()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('sst:user-storage-change', onStorage)
    window.addEventListener('sst:device-sync', onStorage)
    const first = window.setTimeout(syncNow, 8_000 + Math.floor(Math.random() * 20_000))
    const timer = window.setInterval(syncNow, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('sst:user-storage-change', onStorage)
      window.removeEventListener('sst:device-sync', onStorage)
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [refresh, syncNow])

  if (locked) {
    return (
      <div className="identity-lock" role="dialog" aria-modal="true" aria-labelledby="identity-lock-title">
        <div className="identity-lock-panel">
          <LockKeyOpen weight="duotone" />
          <h2 id="identity-lock-title">사용자 확인이 필요합니다</h2>
          <p>오프라인 사용 유예기간이 지났습니다. 작성 중인 내용은 이 기기에 보관되어 있으며, 인터넷 연결 후 본인 확인을 마치면 그대로 이어집니다.</p>
          <button type="button" onClick={syncNow} disabled={!online || busy}>
            <ArrowsClockwise /> {online ? (busy ? '확인 중' : '연결하고 계속') : '인터넷 연결 대기 중'}
          </button>
          <small>마지막 확인: {formatLastSync(lastIdentityVerification())}</small>
        </div>
      </div>
    )
  }

  if (hidden || (online && !status.dirty && !busy)) return null
  return (
    <div className={`connection-status${online ? '' : ' is-offline'}`} role="status" aria-live="polite">
      {online ? <CloudCheck weight="fill" /> : <CloudSlash weight="fill" />}
      <span>{online ? `${status.dirty}개 변경 저장 대기` : '오프라인 · 이 기기에 안전하게 저장 중'}</span>
      {online && <button type="button" onClick={syncNow} disabled={busy}><ArrowsClockwise /> {busy ? '동기화 중' : '지금 동기화'}</button>}
    </div>
  )
}
