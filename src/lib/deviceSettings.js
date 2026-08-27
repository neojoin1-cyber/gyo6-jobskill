import { Capacitor } from '@capacitor/core'

const SHARED_DEVICE_KEY = 'sst.device.shared-mode'

export function isSharedDevice() {
  try {
    const saved = localStorage.getItem(SHARED_DEVICE_KEY)
    if (saved != null) return saved === '1'
  } catch { /* 저장 불가 환경 */ }
  return !Capacitor.isNativePlatform()
}

export function setSharedDevice(value) {
  try { localStorage.setItem(SHARED_DEVICE_KEY, value ? '1' : '0') } catch { /* 저장 불가 환경 */ }
}
