import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './lib/ErrorBoundary.jsx'
import './index.css'

let reloadingForNewWorker = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForNewWorker) return
    reloadingForNewWorker = true
    window.location.reload()
  })

  if (import.meta.env.DEV) {
    window.addEventListener('load', async () => {
      const key = 'sst.dev-sw-cleaned'
      if (sessionStorage.getItem(key) === '1') return
      const registrations = await navigator.serviceWorker.getRegistrations()
      if (!registrations.length) return
      sessionStorage.setItem(key, '1')
      await Promise.all(registrations.map(registration => registration.unregister()))
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.filter(name => name.startsWith('gyo6-') || name.startsWith('workbox-')).map(name => caches.delete(name)))
      window.location.reload()
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary label="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// A hidden/headless Android WebView can pause requestAnimationFrame entirely.
// Keep the double-frame paint path, with a timer fallback after React rendered.
let nativeReadySignalled = false
const signalNativeReady = () => {
  if (nativeReadySignalled) return
  nativeReadySignalled = true
  window.__SUGAR_SALT_NATIVE_READY__ = true
  window.__SUGAR_SALT_BOOT_READY__?.()
}
window.setTimeout(signalNativeReady, 1000)
window.requestAnimationFrame(() => window.requestAnimationFrame(signalNativeReady))
