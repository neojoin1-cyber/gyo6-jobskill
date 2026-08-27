import { supabase } from './supabase.js'
import { syncDeviceState } from './deviceSync.js'
import { clearUserStorage, deactivateUserStorage } from './userLocalStorage.js'

export async function saveBeforeExit({ clearDevice = false } = {}) {
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
  return { localCleared: Boolean(clearDevice && syncResult?.ok), syncResult }
}

export async function logoutSafely({ clearDevice = false, discardLocal = false } = {}) {
  if (discardLocal) {
    clearUserStorage()
    const result = await supabase.auth.signOut({ scope: 'local' })
    deactivateUserStorage()
    return { ...result, localCleared: true, discarded: true, syncResult: { ok: false } }
  }
  const saved = await saveBeforeExit({ clearDevice })
  // 공용 PC에서는 서버에 도착하지 않은 개인 작성본을 남긴 채 계정만 빠지지 않는다.
  if (clearDevice && !saved.localCleared) return { ...saved, blocked: true }
  const result = await supabase.auth.signOut({ scope: 'local' })
  deactivateUserStorage()
  return { ...result, ...saved }
}

export async function deleteOwnAccount() {
  const { data, error } = await supabase.rpc('rpc_delete_my_account')
  if (error) return { ok: false, error }

  clearUserStorage()
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  deactivateUserStorage()
  return { ok: Boolean(data?.ok ?? true), error: null }
}
