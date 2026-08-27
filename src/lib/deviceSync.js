import { supabase } from './supabase.js'
import { sync as syncLearningOutbox } from './localFirst.js'
import {
  applyRemoteUserItem,
  getUserStorageMeta,
  listUserStorageEntries,
  userLocalStorage,
} from './userLocalStorage.js'

const LAST_SYNC_KEY = 'sst.device-sync.last'
const DEVICE_ID_KEY = 'sst.device-sync.id'
const LOCAL_ONLY = new Set([
  LAST_SYNC_KEY,
  DEVICE_ID_KEY,
  'kbs_bootstrap_v1',
  'kbs_outbox_v1',
  'sst.cached-profile',
  'sst.identity.last-verified',
])

let syncing = null

function syncable(key) {
  return Boolean(key) && !LOCAL_ONLY.has(key)
}

function deviceId() {
  let id = userLocalStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    userLocalStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceSyncStatus() {
  const meta = getUserStorageMeta()
  const lastSync = userLocalStorage.getItem(LAST_SYNC_KEY) || ''
  const tracked = meta.keys || {}
  const dirty = listUserStorageEntries().filter(([key]) => syncable(key) && !tracked[key]).length
    + Object.entries(tracked).filter(([key, row]) => syncable(key) && (!lastSync || row.updatedAt > lastSync)).length
  return { lastSync, dirty }
}

/** 개인 진행·초안을 한 RPC로 올리고, 다른 기기의 더 최신 항목을 내려받는다. */
export async function syncDeviceState({ force = false } = {}) {
  if (syncing) return syncing
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, offline: true }

  syncing = (async () => {
    await syncLearningOutbox()
    const meta = getUserStorageMeta()
    const entries = new Map(listUserStorageEntries())
    const lastSync = userLocalStorage.getItem(LAST_SYNC_KEY) || null
    const tracked = meta.keys || {}
    const candidates = new Map(Object.entries(tracked))
    for (const [key] of entries) {
      if (syncable(key) && !candidates.has(key)) candidates.set(key, { updatedAt: new Date().toISOString(), deleted: false })
    }
    const changes = [...candidates.entries()]
      .filter(([key, row]) => syncable(key) && (force || !lastSync || row.updatedAt > lastSync))
      .map(([key, row]) => ({
        key,
        value: row.deleted ? null : entries.get(key) ?? null,
        updated_at: row.updatedAt,
        deleted: Boolean(row.deleted),
      }))

    const { data, error } = await supabase.rpc('rpc_sync_user_device_state', {
      p_changes: changes,
      p_since: lastSync,
      p_device_id: deviceId(),
    })
    if (error) return { ok: false, error }

    for (const row of data?.items || []) {
      const local = meta.keys?.[row.key]
      if (!local?.updatedAt || row.updated_at > local.updatedAt) {
        applyRemoteUserItem(row.key, row.value, row.updated_at, row.deleted)
      }
    }
    const syncedAt = data?.synced_at || new Date().toISOString()
    userLocalStorage.setItem(LAST_SYNC_KEY, syncedAt)
    window.dispatchEvent?.(new CustomEvent('sst:device-sync', { detail: { ok: true, syncedAt } }))
    return { ok: true, syncedAt, downloaded: data?.items?.length || 0 }
  })().catch(error => ({ ok: false, error })).finally(() => { syncing = null })
  return syncing
}
