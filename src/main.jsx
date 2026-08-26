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

// The static guard exists before any module is downloaded, so a failed entry
// script never leaves a white page. Remove it only after React has painted.
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    window.__SUGAR_SALT_NATIVE_READY__ = true
    window.__SUGAR_SALT_BOOT_READY__?.()
  })
})
