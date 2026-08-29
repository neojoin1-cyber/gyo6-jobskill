/**
 * 복습 로컬 알림 — SRS(간격 반복) 복습 시점을 놓치지 않도록 매일 리마인드.
 * 서버 없이 기기 로컬 알림으로 동작(@capacitor/local-notifications).
 * - 네이티브(Android)에서만 동작, 웹은 no-op.
 * - 매일 17:00 반복 알림. 앱을 열 때마다 현재 due 개수를 반영해 문구 갱신.
 * - 사용자가 끌 수 있음(localStorage 플래그). 기본 ON.
 */
import { Capacitor } from '@capacitor/core'
import { getDueCount } from './srs.js'
import { userLocalStorage as localStorage } from './userLocalStorage.js'

const REMINDER_ID = 1001
const FLAG_KEY = 'kbs.reviewReminder.enabled'
const REMIND_HOUR = 17   // 오후 5시

export function isReviewReminderEnabled() {
  const v = localStorage.getItem(FLAG_KEY)
  return v === '1'   // 시스템 권한은 사용자가 직접 켠 경우에만 요청한다.
}

function setFlag(on) { localStorage.setItem(FLAG_KEY, on ? '1' : '0') }

async function loadPlugin() {
  try { return (await import('@capacitor/local-notifications')).LocalNotifications }
  catch { return null }
}

async function buildBody() {
  let n = 0
  try { n = await getDueCount() } catch { n = 0 }
  return n > 0
    ? `🔁 오늘 복습할 문항 ${n}개가 기다려요. 잊기 전에 복습하면 오래 기억돼요!`
    : `🔁 오늘의 학습으로 실력을 키워요. 잠깐이면 충분해요!`
}

/**
 * 권한이 이미 있으면 복습 알림을 (재)예약한다. 새 권한 요청은 사용자가
 * 화면의 토글을 직접 켠 경우에만 허용한다.
 */
export async function scheduleReviewReminder({ requestPermission = false } = {}) {
  if (!Capacitor.isNativePlatform()) return
  if (!isReviewReminderEnabled()) return
  const LN = await loadPlugin()
  if (!LN) return
  try {
    const perm = await LN.checkPermissions()
    let display = perm.display
    if (display !== 'granted' && requestPermission) {
      const req = await LN.requestPermissions()
      display = req.display
    }
    if (display !== 'granted') return

    const body = await buildBody()
    await LN.cancel({ notifications: [{ id: REMINDER_ID }] })
    await LN.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: '설탕과소금 복습 시간',
        body,
        // allowWhileIdle 미사용 → 부정확 알람(daily nudge엔 충분). SCHEDULE_EXACT_ALARM 권한 회피(Play 정책).
        schedule: { on: { hour: REMIND_HOUR, minute: 0 } },
      }],
    })
  } catch (e) {
    console.warn('[reminders] 예약 실패:', e?.message || e)
  }
}

/**
 * 사용자 토글 — 켜면 권한 요청 후 예약, 끄면 취소. 성공 여부 반환.
 */
export async function setReviewReminderEnabled(on) {
  setFlag(on)
  if (!Capacitor.isNativePlatform()) return on
  const LN = await loadPlugin()
  if (!LN) return on
  try {
    if (on) {
      await scheduleReviewReminder({ requestPermission: true })
      const perm = await LN.checkPermissions()
      const granted = perm.display === 'granted'
      if (!granted) setFlag(false)
      return granted
    } else {
      await LN.cancel({ notifications: [{ id: REMINDER_ID }] })
      return false
    }
  } catch { return on }
}
