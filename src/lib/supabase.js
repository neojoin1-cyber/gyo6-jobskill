import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { hasTrialSession } from './trialSession.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const TAB_NAME_PREFIX = 'sugar-salt-auth-tab:'
const TAB_ID_KEY = 'sst.auth.tab-id'

const TRIAL_READ_RPCS = new Set([
  'rpc_admin_member_history',
  'rpc_admin_members',
  'rpc_bootstrap',
  'rpc_class_diagnostics',
  'rpc_class_leaderboard',
  'rpc_class_live',
  'rpc_class_personality',
  'rpc_class_position',
  'rpc_class_presence',
  'rpc_class_progress',
  'rpc_class_weakness',
  'rpc_interview_practice_review',
  'rpc_my_class_session',
  'rpc_my_class_students',
  'rpc_my_cover_letters',
  'rpc_my_rank',
  'rpc_my_subjects',
  'rpc_my_viewable_subjects',
  'rpc_national_rankings',
  'rpc_school_class_rankings',
  'rpc_school_position',
  'rpc_teacher_cover_letters',
  'rpc_teacher_inbox',
])

function trialSafeFetch(input, init = {}) {
  const request = input instanceof Request ? input : null
  const url = String(request?.url || input || '')
  const method = String(init.method || request?.method || 'GET').toUpperCase()

  if (!hasTrialSession() || !url.includes('/rest/v1/') || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return globalThis.fetch(input, init)
  }

  const rpc = url.match(/\/rest\/v1\/rpc\/([^?]+)/)?.[1]
  if (rpc && TRIAL_READ_RPCS.has(decodeURIComponent(rpc))) {
    return globalThis.fetch(input, init)
  }

  // 공개 체험은 화면 안에서 정상적으로 진행하되 서버 기록은 남기지 않는다.
  // 서버에도 동일 계정 쓰기 차단 트리거가 있어 개발자 도구 우회도 막는다.
  const body = rpc ? 'null' : '[]'
  return Promise.resolve(new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': '0-0/0',
      'X-Sugar-Salt-Trial': 'read-only',
    },
  }))
}

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
    global: { fetch: trialSafeFetch },
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
