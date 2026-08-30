const OPEN_EVENT = 'sst:open-pwa-install'

let deferredPrompt = null
const listeners = new Set()

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIosLike() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

let snapshot = {
  web: typeof window !== 'undefined',
  installed: isStandalone(),
  canPrompt: false,
  ios: isIosLike(),
}

function publish(next = {}) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach(listener => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event
    publish({ canPrompt: true, installed: false })
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    publish({ canPrompt: false, installed: true })
  })

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', event => {
    publish({ installed: event.matches })
  })
}

export function subscribePwaInstall(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPwaInstallSnapshot() {
  return snapshot
}

export function canOfferPwaInstall() {
  return snapshot.web && !snapshot.installed
}

export function openPwaInstall() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onOpenPwaInstall(listener) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}

export async function requestPwaInstall() {
  if (!deferredPrompt) return { available: false, outcome: 'unavailable' }
  const prompt = deferredPrompt
  deferredPrompt = null
  publish({ canPrompt: false })
  await prompt.prompt()
  const choice = await prompt.userChoice
  return { available: true, outcome: choice?.outcome || 'dismissed' }
}

