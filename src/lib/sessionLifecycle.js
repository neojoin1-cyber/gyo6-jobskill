import { supabase } from './supabase.js'
import { syncDeviceState } from './deviceSync.js'
import { clearUserStorage, deactivateUserStorage } from './userLocalStorage.js'

export async function logoutSafely({ clearDevice = false } = {}) {
  let syncResult = { ok: false, offline: true }
  if (typeof navigator === 'undefined' || navigator.onLine) {
    syncResult = await Promise.race([
      syncDeviceState(),
      new Promise(resolve => setTimeout(() => resolve({ ok: false, timeout: true }), 8000)),
    ])
  }
  // 서버에 안전하게 도착한 경우에만 공용 PC 사본을 지운다. 오프라인이면
  // 계정별 공간에 남겨 두어 다음 로그인 때 재전송할 수 있게 한다.
  if (clearDevice && syncResult?.ok) clearUserStorage()
  const result = await supabase.auth.signOut({ scope: 'local' })
  deactivateUserStorage()
  return { ...result, localCleared: Boolean(clearDevice && syncResult?.ok), syncResult }
}
