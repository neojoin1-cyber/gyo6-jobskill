import { supabase } from './supabase.js'
import { sync as syncLearningOutbox } from './localFirst.js'
import {
  applyRemoteUserItem,
  getUserStorageMeta,
  listUserStorageEntries,
  markUserStorageSynced,
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
const LOCAL_ONLY_PATTERNS = [
  /^sst\.teacher\.active-class\./,
  /^iv_cover_evidence_cache_v\d+$/,
  /^iv_cover_seed$/,
]
const MAX_ITEM_BYTES = 400_000
const MAX_PAYLOAD_BYTES = 1_200_000

let syncing = null

function syncable(key) {
  return Boolean(key) && !LOCAL_ONLY.has(key) && !LOCAL_ONLY_PATTERNS.some(pattern => pattern.test(key))
}

function byteLength(value) {
  const text = String(value ?? '')
  return typeof TextEncoder === 'undefined' ? text.length * 2 : new TextEncoder().encode(text).length
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
  const entries = new Map(listUserStorageEntries())
  const pending = new Map()
  for (const [key, value] of entries) {
    if (syncable(key) && !tracked[key]) pending.set(key, byteLength(value))
  }
  for (const [key, row] of Object.entries(tracked)) {
    if (syncable(key) && (!row.syncedAt || row.updatedAt > row.syncedAt)) {
      pending.set(key, row.deleted ? 0 : byteLength(entries.get(key)))
    }
  }
  return { lastSync, dirty: pending.size, pendingBytes: [...pending.values()].reduce((sum, size) => sum + size, 0) }
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
      .filter(([key, row]) => syncable(key) && (force || !row.syncedAt || row.updatedAt > row.syncedAt))
      .map(([key, row]) => ({
        key,
        value: row.deleted ? null : entries.get(key) ?? null,
        updated_at: row.updatedAt,
        deleted: Boolean(row.deleted),
      }))

    const oversized = changes.find(change => byteLength(change.value) > MAX_ITEM_BYTES)
    const payloadBytes = byteLength(JSON.stringify(changes))
    if (oversized || payloadBytes > MAX_PAYLOAD_BYTES) {
      return { ok: false, tooLarge: true, key: oversized?.key || null, payloadBytes }
    }

    const { data, error } = await supabase.rpc('rpc_sync_user_device_state', {
      p_changes: changes,
      p_since: lastSync,
      p_device_id: deviceId(),
    })
    if (error) return { ok: false, error }

    for (const change of changes) {
      markUserStorageSynced(change.key, change.updated_at, change.deleted)
    }
    for (const row of data?.items || []) {
      const local = getUserStorageMeta().keys?.[row.key]
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
