const SESSION_KEY = 'sst.public-trial.session'
const USAGE_KEY = 'sst.public-trial.usage'
const NOTICE_KEY = 'sst.public-trial.notice'

export const TRIAL_DURATION_MS = 15 * 60 * 1000
export const TRIAL_COOLDOWN_MS = 45 * 60 * 1000

export const TRIAL_ACCOUNTS = Object.freeze({
  student: {
    role: 'student',
    label: '학생',
    email: 'demo.student@sugarsalt.kr',
  },
  teacher: {
    role: 'teacher',
    label: '교사',
    email: 'demo.teacher@sugarsalt.kr',
  },
  school_admin: {
    role: 'school_admin',
    label: '학교관리자',
    email: 'demo.admin@sugarsalt.kr',
  },
})

export const TRIAL_PASSWORD = import.meta.env.VITE_TRIAL_PASSWORD || 'sugarsalt2026'

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

export function trialRoleFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase()
  return Object.values(TRIAL_ACCOUNTS).find(account => account.email === normalized)?.role || null
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
  if (current?.role === role && Number(current.expiresAt) > now) {
    return { allowed: true, resume: true, session: current }
  }

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
    startedAt: now,
    expiresAt: now + TRIAL_DURATION_MS,
  }
  if (typeof sessionStorage !== 'undefined') writeJson(sessionStorage, SESSION_KEY, session)

  if (typeof localStorage !== 'undefined') {
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

