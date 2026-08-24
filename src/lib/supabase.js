import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const TAB_NAME_PREFIX = 'sugar-salt-auth-tab:'
const TAB_ID_KEY = 'sst.auth.tab-id'

function randomTabId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * The public web trial needs student and teacher accounts open side by side.
 * Supabase's browser default uses one localStorage key and one BroadcastChannel,
 * so signing out in either tab signs out every other tab. Give each browsing
 * context its own sessionStorage key while keeping native-app persistence as-is.
 */
function webAuthOptions() {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return undefined

  let tabId = ''
  try {
    tabId = window.name.startsWith(TAB_NAME_PREFIX)
      ? window.name.slice(TAB_NAME_PREFIX.length)
      : sessionStorage.getItem(TAB_ID_KEY) || ''
    if (!tabId) tabId = randomTabId()
    window.name = `${TAB_NAME_PREFIX}${tabId}`
    sessionStorage.setItem(TAB_ID_KEY, tabId)
  } catch {
    tabId = randomTabId()
  }

  return {
    auth: {
      storage: window.sessionStorage,
      storageKey: `sugar-salt-auth-${tabId}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
}

export const supabase = createClient(url, key, webAuthOptions())
