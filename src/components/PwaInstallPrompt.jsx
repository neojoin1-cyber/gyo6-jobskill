import { useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowSquareOut, CheckCircle, DownloadSimple, ShareNetwork, X } from '@phosphor-icons/react'
import { Capacitor } from '@capacitor/core'
import { userLocalStorage } from '../lib/userLocalStorage.js'
import {
  getPwaInstallSnapshot,
  onOpenPwaInstall,
  requestPwaInstall,
  subscribePwaInstall,
} from '../lib/pwaInstall.js'
import '../styles/pwa-install.css'

const DISMISSED_KEY = 'sst.pwa-install-intro-dismissed'

export default function PwaInstallPrompt({ enabled = true, forceOpen = false }) {
  const install = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallSnapshot)
  const [open, setOpen] = useState(forceOpen)
  const [result, setResult] = useState('')

  useEffect(() => onOpenPwaInstall(() => {
    setResult('')
    setOpen(true)
  }), [])

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  useEffect(() => {
    if (!enabled || forceOpen || Capacitor.isNativePlatform() || install.installed) return undefined
    if (userLocalStorage.getItem(DISMISSED_KEY) === '1') return undefined
    const timer = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [enabled, forceOpen, install.installed])

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  function dismiss() {
    if (!forceOpen) userLocalStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
  }

  async function installNow() {
    const choice = await requestPwaInstall()
    if (choice.outcome === 'accepted') {
      userLocalStorage.setItem(DISMISSED_KEY, '1')
      setResult('설치를 시작했습니다. 설치가 끝나면 바탕화면이나 홈 화면의 JOB고 아이콘으로 시작하세요.')
      return
    }
    setResult('브라우저에서 설치가 시작되지 않았습니다. 아래 설치 방법을 확인해 주세요.')
  }

  if (!open || !enabled || Capacitor.isNativePlatform() || install.installed) return null

  return (
    <div className="pwa-install-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) dismiss() }}>
      <section className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
        <button className="pwa-install-close" onClick={dismiss} aria-label="설치 안내 닫기" title="닫기"><X weight="bold" /></button>
        <span className="pwa-install-icon"><DownloadSimple weight="bold" /></span>
        <div className="pwa-install-heading">
          <small>정식 사용자 빠른 시작</small>
          <h2 id="pwa-install-title">이 기기에 JOB고 설치</h2>
          <p>설치하면 주소를 다시 입력하지 않고 바탕화면이나 홈 화면 아이콘으로 바로 시작합니다. 학습 기록은 로그인한 계정으로 이어집니다.</p>
        </div>

        {install.ios ? (
          <ol className="pwa-install-steps">
            <li><ShareNetwork weight="fill" /><span>Safari 아래쪽의 <b>공유</b> 버튼을 누릅니다.</span></li>
            <li><DownloadSimple weight="bold" /><span><b>홈 화면에 추가</b>를 선택합니다.</span></li>
            <li><CheckCircle weight="fill" /><span>오른쪽 위 <b>추가</b>를 누릅니다.</span></li>
          </ol>
        ) : (
          <div className="pwa-install-guide">
            <ArrowSquareOut weight="bold" />
            <p>설치 버튼이 보이지 않으면 Chrome·Edge 주소창의 설치 아이콘 또는 브라우저 메뉴의 <b>앱 설치</b>를 선택하세요.</p>
          </div>
        )}

        {result && <p className="pwa-install-result" role="status">{result}</p>}
        <footer>
          {!install.ios && install.canPrompt && <button className="is-primary" onClick={installNow}><DownloadSimple weight="bold" /> 이 기기에 설치</button>}
          <button onClick={dismiss}>웹으로 계속</button>
        </footer>
      </section>
    </div>
  )
}

