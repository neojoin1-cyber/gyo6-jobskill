import { clearUserStorage } from './userLocalStorage.js'

const SESSION_KEY = 'sst.public-trial.session'
const USAGE_KEY = 'sst.public-trial.usage'
const NOTICE_KEY = 'sst.public-trial.notice'

export const TRIAL_DURATION_MS = 15 * 60 * 1000
export const TRIAL_COOLDOWN_MS = 45 * 60 * 1000
// 제작·검수 기간에는 기본적으로 시간 제한을 두지 않는다. 정식 출시에서만
// VITE_TRIAL_TIME_LIMIT_ENABLED=true를 주입해 15분 제한과 재진입 대기를 켠다.
export const TRIAL_TIME_LIMIT_ENABLED = import.meta.env?.VITE_TRIAL_TIME_LIMIT_ENABLED === 'true'

export const TRIAL_ACCOUNTS = Object.freeze({
  student: {
    role: 'student',
    label: '학생',
  },
  teacher: {
    role: 'teacher',
    label: '교사',
  },
  school_admin: {
    role: 'school_admin',
    label: '학교관리자',
  },
})

const DEVICE_COOKIE = 'sst_trial_device'
const DEVICE_STORAGE_KEY = 'sst.public-trial.device'

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key) || '') || fallback
  } catch {
    return fallback
  }
}

function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)) } catch { /* private browsing */ }
}

export function trialRoleFromUser(user) {
  const metadata = user?.user_metadata || {}
  const role = metadata.is_public_trial === true ? metadata.trial_role : null
  return TRIAL_ACCOUNTS[role]?.role || null
}

export function shouldSwitchTrialRole(user, requestedRole) {
  const activeTrialRole = trialRoleFromUser(user)
  return Boolean(activeTrialRole && TRIAL_ACCOUNTS[requestedRole] && requestedRole !== activeTrialRole)
}

export function getTrialDeviceId() {
  if (typeof document === 'undefined') return ''
  const existing = document.cookie
    .split('; ')
    .find(part => part.startsWith(`${DEVICE_COOKIE}=`))
    ?.slice(DEVICE_COOKIE.length + 1)
  if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) return existing

  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (stored && /^[a-zA-Z0-9-]{16,80}$/.test(stored)) return stored
  } catch { /* 저장 불가 환경에서는 현재 요청용 ID만 사용 */ }

  const next = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  document.cookie = `${DEVICE_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Strict; Secure`
  try { localStorage.setItem(DEVICE_STORAGE_KEY, next) } catch { /* noop */ }
  return next
}

export async function requestTrialToken(role) {
  if (!TRIAL_ACCOUNTS[role]) throw new Error('지원하지 않는 체험 역할입니다.')
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-trial-session`
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ role, deviceId: getTrialDeviceId() }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.tokenHash) {
        throw new Error(payload?.message || '체험 연결 응답을 확인하지 못했습니다.')
      }
      return payload
    } catch (error) {
      lastError = error
      if (attempt === 0) await new Promise(resolve => globalThis.setTimeout(resolve, 700))
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }
  throw new Error(lastError?.name === 'AbortError'
    ? '체험 연결이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 눌러 주세요.'
    : lastError?.message || '체험을 시작하지 못했습니다. 다시 시도해 주세요.')
}

export function requestedTrialRole(search = globalThis.location?.search || '') {
  try {
    const role = new URLSearchParams(search).get('trial')
    return TRIAL_ACCOUNTS[role]?.role || null
  } catch {
    return null
  }
}

export function getTrialSession() {
  if (typeof sessionStorage === 'undefined') return null
  return readJson(sessionStorage, SESSION_KEY, null)
}

export function hasTrialSession() {
  return Boolean(getTrialSession()?.role)
}

export function trialStartAvailability(role, now = Date.now()) {
  if (!TRIAL_ACCOUNTS[role]) return { allowed: false, reason: '지원하지 않는 체험 역할입니다.' }

  const current = getTrialSession()
  if (current?.role === role && (!TRIAL_TIME_LIMIT_ENABLED || Number(current.expiresAt) > now)) {
    return { allowed: true, resume: true, session: current }
  }

  if (!TRIAL_TIME_LIMIT_ENABLED) return { allowed: true, resume: false }

  const usage = typeof localStorage === 'undefined' ? {} : readJson(localStorage, USAGE_KEY, {})
  const nextAllowedAt = Number(usage?.[role]?.nextAllowedAt || 0)
  if (nextAllowedAt > now) {
    return {
      allowed: false,
      nextAllowedAt,
      reason: `${TRIAL_ACCOUNTS[role].label} 체험은 잠시 후 다시 이용할 수 있습니다.`,
    }
  }
  return { allowed: true, resume: false }
}

export function beginTrialSession(role, now = Date.now()) {
  const availability = trialStartAvailability(role, now)
  if (!availability.allowed) return availability
  if (availability.resume) return availability

  const session = {
    role,
    sessionId: globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`,
    startedAt: now,
    expiresAt: TRIAL_TIME_LIMIT_ENABLED ? now + TRIAL_DURATION_MS : 0,
  }
  if (typeof sessionStorage !== 'undefined') writeJson(sessionStorage, SESSION_KEY, session)

  if (TRIAL_TIME_LIMIT_ENABLED && typeof localStorage !== 'undefined') {
    const usage = readJson(localStorage, USAGE_KEY, {})
    usage[role] = {
      startedAt: now,
      nextAllowedAt: now + TRIAL_DURATION_MS + TRIAL_COOLDOWN_MS,
    }
    writeJson(localStorage, USAGE_KEY, usage)
  }
  return { allowed: true, resume: false, session }
}

export function clearTrialSession() {
  const wasTrial = Boolean(getTrialSession()?.role)
  if (wasTrial) clearUserStorage()
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
}

export function setTrialNotice(message) {
  try { sessionStorage.setItem(NOTICE_KEY, String(message || '')) } catch { /* noop */ }
}

export function consumeTrialNotice() {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY) || ''
    sessionStorage.removeItem(NOTICE_KEY)
    return message
  } catch {
    return ''
  }
}

export function formatTrialRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
