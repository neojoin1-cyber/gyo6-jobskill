import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

const bundledVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''

export default function AppVersionLabel({ className = '', inverse = false }) {
  const [info, setInfo] = useState({ version: bundledVersion, build: '' })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapApp.getInfo()
      .then(value => setInfo({ version: value.version || bundledVersion, build: value.build || '' }))
      .catch(() => {})
  }, [])

  const label = `JOB고 v${info.version || bundledVersion || '확인 중'}`
  return (
    <span
      className={`app-version-label${inverse ? ' is-inverse' : ''}${className ? ` ${className}` : ''}`}
      data-app-version={info.version || bundledVersion}
      data-app-build={info.build}
      title={info.build ? `${label} · Play 빌드 ${info.build}` : label}
    >
      <b>{label}</b>
      {info.build && <small>빌드 {info.build}</small>}
    </span>
  )
}
