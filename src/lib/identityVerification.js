import { supabase } from './supabase.js'
import { userLocalStorage } from './userLocalStorage.js'

const VERIFIED_KEY = 'sst.identity.last-verified'
export const IDENTITY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
export const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000

export function lastIdentityVerification() {
  return userLocalStorage.getItem(VERIFIED_KEY) || ''
}

export function markIdentityVerified(at = new Date().toISOString()) {
  userLocalStorage.setItem(VERIFIED_KEY, at)
  return at
}

export function identityNeedsCheck(now = Date.now()) {
  const last = Date.parse(lastIdentityVerification())
  return !Number.isFinite(last) || now - last >= IDENTITY_CHECK_INTERVAL_MS
}

export function identityGraceExpired(now = Date.now()) {
  const last = Date.parse(lastIdentityVerification())
  return !Number.isFinite(last) || now - last >= OFFLINE_GRACE_MS
}

export async function verifyCurrentIdentity() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, offline: true }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return { ok: false, error }
  const verifiedAt = markIdentityVerified()
  return { ok: true, verifiedAt, user: data.user }
}
