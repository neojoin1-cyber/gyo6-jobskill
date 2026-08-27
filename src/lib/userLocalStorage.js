/**
 * 로그인 사용자별 로컬 저장소.
 *
 * 공용 PC에서 같은 localStorage 키를 함께 쓰면 다음 로그인 사용자가 이전
 * 학생의 초안과 진행 기록을 읽게 된다. 이 어댑터는 기존 동기 API를 유지한
 * 채 모든 개인 키를 사용자 UUID 아래에 격리한다.
 */
const PREFIX = 'sst.user.'
const ACTIVE_SESSION_KEY = 'sst.local-user-id'
const LEGACY_OWNER_KEY = 'sst.legacy-owner'
const META_KEY = '__device_meta__'

let activeUserId = ''

function rawStorage() {
  return typeof window === 'undefined' ? globalThis.localStorage : window.localStorage
}

function safeUserId(value) {
  const id = String(value || '')
  return /^[a-zA-Z0-9-]{8,80}$/.test(id) ? id : ''
}

function prefix(userId = activeUserId) {
  const id = safeUserId(userId)
  return id ? `${PREFIX}${id}.` : ''
}

function scopedKey(key, userId = activeUserId) {
  const base = prefix(userId)
  if (base) return `${base}${String(key)}`
  // Node 기반 콘텐츠 감사 스크립트는 브라우저 인증 셸 없이 메모리 저장소를
  // 주입한다. 그 환경만 기존 키를 허용하고 실제 브라우저는 무사용자 쓰기를 막는다.
  return typeof window === 'undefined' ? String(key) : ''
}

function readMeta() {
  try { return JSON.parse(rawStorage().getItem(scopedKey(META_KEY)) || '{}') || {} }
  catch { return {} }
}

function writeMeta(meta) {
  try { rawStorage().setItem(scopedKey(META_KEY), JSON.stringify(meta)) } catch { /* 저장 불가 환경 */ }
}

function touch(key, deleted = false) {
  if (!activeUserId || key === META_KEY) return
  const meta = readMeta()
  meta.keys = meta.keys || {}
  meta.keys[String(key)] = { updatedAt: new Date().toISOString(), deleted: Boolean(deleted) }
  writeMeta(meta)
  if (typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent?.(new CustomEvent('sst:user-storage-change', { detail: { key: String(key), deleted } }))
  }
}

export function activateUserStorage(userId, { migrateLegacy = true } = {}) {
  const id = safeUserId(userId)
  activeUserId = id
  try {
    if (id) sessionStorage.setItem(ACTIVE_SESSION_KEY, id)
    else sessionStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch { /* 사생활 모드 */ }
  if (id && migrateLegacy) migrateLegacyStorage(id)
  return id
}

export function deactivateUserStorage() {
  activeUserId = ''
  try { sessionStorage.removeItem(ACTIVE_SESSION_KEY) } catch { /* 사생활 모드 */ }
}

export function activeLocalUserId() {
  if (activeUserId) return activeUserId
  try { activeUserId = safeUserId(sessionStorage.getItem(ACTIVE_SESSION_KEY)) } catch { /* 사생활 모드 */ }
  return activeUserId
}

export const userLocalStorage = {
  getItem(key) {
    activeLocalUserId()
    const target = scopedKey(key)
    if (!target) return null
    try { return rawStorage().getItem(target) } catch { return null }
  },
  setItem(key, value) {
    activeLocalUserId()
    const target = scopedKey(key)
    if (!target) return
    rawStorage().setItem(target, String(value))
    touch(key, false)
  },
  removeItem(key) {
    activeLocalUserId()
    const target = scopedKey(key)
    if (!target) return
    rawStorage().removeItem(target)
    touch(key, true)
  },
}

export function getUserStorageMeta() {
  return readMeta()
}

export function applyRemoteUserItem(key, value, updatedAt, deleted = false) {
  const target = scopedKey(key)
  if (!target) return
  try {
    if (deleted) rawStorage().removeItem(target)
    else rawStorage().setItem(target, String(value ?? ''))
    const meta = readMeta()
    meta.keys = meta.keys || {}
    meta.keys[String(key)] = { updatedAt, deleted: Boolean(deleted) }
    writeMeta(meta)
  } catch { /* 저장 불가 환경 */ }
}

export function listUserStorageEntries(userId = activeLocalUserId()) {
  const base = prefix(userId)
  if (!base) return []
  const storage = rawStorage()
  const rows = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const physical = storage.key(i)
      if (!physical?.startsWith(base)) continue
      const logical = physical.slice(base.length)
      if (logical === META_KEY) continue
      rows.push([logical, storage.getItem(physical)])
    }
  } catch { /* 저장 불가 환경 */ }
  return rows
}

export function clearUserStorage({ userId = activeLocalUserId(), keep = [] } = {}) {
  const base = prefix(userId)
  if (!base) return
  const storage = rawStorage()
  const keepSet = new Set(keep.map(String))
  const removals = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const physical = storage.key(i)
      if (!physical?.startsWith(base)) continue
      const logical = physical.slice(base.length)
      if (!keepSet.has(logical)) removals.push(physical)
    }
    removals.forEach(key => storage.removeItem(key))
  } catch { /* 저장 불가 환경 */ }
}

export function clearUserStorageMatching(patterns) {
  const tests = (patterns || []).map(pattern => pattern instanceof RegExp ? pattern : new RegExp(String(pattern)))
  for (const [key] of listUserStorageEntries()) {
    if (tests.some(test => test.test(key))) userLocalStorage.removeItem(key)
  }
}

// 기존 단일 사용자 설치에서 만든 자료는 최초 로그인 계정에 한 번만 귀속한다.
// 이미 다른 사용자가 귀속한 공용 PC에서는 절대 가져오지 않는다.
const LEGACY_PATTERNS = [
  /^(?:kbs_|nova_|iv_|ss_progress|gyo6\.journey|gyo6\.assess|sst\.(?:jc|learning)|diag_history|daily_|morning_|quest_)/,
]

function migrateLegacyStorage(userId) {
  const storage = rawStorage()
  try {
    const owner = storage.getItem(LEGACY_OWNER_KEY)
    if (owner && owner !== userId) return
    if (!owner) storage.setItem(LEGACY_OWNER_KEY, userId)
    const moves = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || key.startsWith(PREFIX) || !LEGACY_PATTERNS.some(pattern => pattern.test(key))) continue
      moves.push([key, storage.getItem(key)])
    }
    for (const [key, value] of moves) {
      const target = scopedKey(key, userId)
      if (storage.getItem(target) == null && value != null) storage.setItem(target, value)
      storage.removeItem(key)
    }
  } catch { /* 마이그레이션 실패 시 새 사용자 공간으로 시작 */ }
}

export function userStoragePhysicalPrefix(userId = activeLocalUserId()) {
  return prefix(userId)
}
