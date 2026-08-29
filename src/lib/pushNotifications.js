/**
 * Push 알림 초기화 — Capacitor (Android) + Web Push
 *
 * 사용 전 필요한 설정:
 * 1. Firebase 프로젝트 생성 → google-services.json을 android/app/ 에 배치
 * 2. Android build.gradle에 Firebase BOM 추가 (아래 주석 참조)
 * 3. VITE_VAPID_PUBLIC_KEY 환경변수 설정 (Web Push용)
 */

import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase.js'

let _registeredUserId = ''
let _activeUserId = ''
let _listenersInstalled = false
let _initializing = null

export async function getPushPermissionStatus() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const { receive } = await PushNotifications.checkPermissions()
      return { supported: true, permission: receive, enabled: receive === 'granted' }
    } catch {
      return { supported: false, permission: 'unavailable', enabled: false }
    }
  }
  if (!('Notification' in globalThis)) return { supported: false, permission: 'unavailable', enabled: false }
  return { supported: true, permission: Notification.permission, enabled: Notification.permission === 'granted' }
}

/** 로그인 직후에는 기존 권한만 연결한다. 새 권한 창은 사용자가 직접 켤 때만 연다. */
export async function initPushNotifications(userId, { requestPermission = false } = {}) {
  if (!userId) return { ok: false, permission: 'unavailable' }
  _activeUserId = userId
  if (_registeredUserId === userId) return { ok: true, permission: 'granted' }
  if (_initializing) return _initializing

  _initializing = (Capacitor.isNativePlatform()
    ? initNativePush(requestPermission)
    : initWebPush(requestPermission)
  ).finally(() => { _initializing = null })
  return _initializing
}

export function requestPushNotifications(userId) {
  return initPushNotifications(userId, { requestPermission: true })
}

// ── Android (Capacitor FCM) ──────────────────────────────────────────────────
async function initNativePush(requestPermission) {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let { receive } = await PushNotifications.checkPermissions()
    if (receive !== 'granted' && requestPermission) {
      ;({ receive } = await PushNotifications.requestPermissions())
    }
    if (receive !== 'granted') return { ok: false, permission: receive }

    if (!_listenersInstalled) {
      // FCM 토큰 수신 → 현재 로그인 계정에 저장
      await PushNotifications.addListener('registration', async ({ value: token }) => {
        if (_activeUserId) await savePushToken(_activeUserId, token, 'fcm')
      })
      await PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[Push] received:', notification)
      })
      await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.log('[Push] action:', action)
      })
      _listenersInstalled = true
    }

    // 리스너가 준비된 다음 등록해야 빠른 토큰 응답도 놓치지 않는다.
    await PushNotifications.register()
    _registeredUserId = _activeUserId
    return { ok: true, permission: 'granted' }
  } catch (e) {
    console.warn('[Push] Native init failed:', e)
    return { ok: false, permission: 'unavailable', error: e }
  }
}

// ── Web Push (VAPID) ─────────────────────────────────────────────────────────
async function initWebPush(requestPermission) {
  const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!VAPID_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, permission: 'unavailable' }
  }

  try {
    let perm = Notification.permission
    if (perm !== 'granted' && requestPermission) perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, permission: perm }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      })
    }
    await savePushToken(_activeUserId, JSON.stringify(sub), 'web-push')
    _registeredUserId = _activeUserId
    return { ok: true, permission: 'granted' }
  } catch (e) {
    console.warn('[Push] Web push init failed:', e)
    return { ok: false, permission: 'unavailable', error: e }
  }
}

async function savePushToken(userId, token, platform) {
  // profiles 테이블에 push_token 컬럼이 필요합니다 (migration 007 참조)
  await supabase.from('profiles').update({
    push_token: token,
    push_platform: platform,
  }).eq('id', userId)
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
