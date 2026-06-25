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

let _initialized = false

export async function initPushNotifications(userId) {
  if (_initialized) return
  _initialized = true

  if (Capacitor.isNativePlatform()) {
    await initNativePush(userId)
  } else {
    await initWebPush(userId)
  }
}

// ── Android (Capacitor FCM) ──────────────────────────────────────────────────
async function initNativePush(userId) {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // 권한 요청
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') return

    await PushNotifications.register()

    // FCM 토큰 수신 → Supabase profiles에 저장
    PushNotifications.addListener('registration', async ({ value: token }) => {
      await savePushToken(userId, token, 'fcm')
    })

    // 포그라운드 알림 수신
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('[Push] received:', notification)
    })

    // 알림 탭 시 처리
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      console.log('[Push] action:', action)
    })
  } catch (e) {
    console.warn('[Push] Native init failed:', e)
  }
}

// ── Web Push (VAPID) ─────────────────────────────────────────────────────────
async function initWebPush(userId) {
  const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!VAPID_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      })
    }
    await savePushToken(userId, JSON.stringify(sub), 'web-push')
  } catch (e) {
    console.warn('[Push] Web push init failed:', e)
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
