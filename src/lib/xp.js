import { supabase } from './supabase.js'

// 일일 1회 제한 이벤트 (같은 reason+날짜 중복 방지)
const _addedToday = new Set()

export async function addXp(amount = 10, reason = 'study') {
  if (!amount || amount <= 0) return null

  const DAILY_ONCE = ['daily_challenge', 'streak_bonus', 'study_session']
  const today = new Date().toISOString().slice(0, 10)
  const key = `${reason}-${today}`

  if (DAILY_ONCE.includes(reason) && _addedToday.has(key)) return null
  if (DAILY_ONCE.includes(reason)) _addedToday.add(key)

  try {
    const { data, error } = await supabase.rpc('rpc_add_xp', {
      p_amount: amount,
      p_reason: reason,
    })
    if (error) { _addedToday.delete(key); return null }
    return data
  } catch {
    _addedToday.delete(key)
    return null
  }
}

export const XP_LEVELS = [
  { level: 1, name: '신입',    icon: '🌱', minXp: 0,    maxXp: 499,  color: '#6B7280', bg: '#F3F4F6' },
  { level: 2, name: '견습생',  icon: '📘', minXp: 500,  maxXp: 1999, color: '#3B82F6', bg: '#DBEAFE' },
  { level: 3, name: '전문가',  icon: '⚡', minXp: 2000, maxXp: 4999, color: '#8B5CF6', bg: '#EDE9FE' },
  { level: 4, name: '마이스터',icon: '🏆', minXp: 5000, maxXp: null, color: '#F59E0B', bg: '#FEF3C7' },
]

export function getLevelInfo(totalXp) {
  const xp = totalXp ?? 0
  const idx = xp < 500 ? 0 : xp < 2000 ? 1 : xp < 5000 ? 2 : 3
  const cur  = XP_LEVELS[idx]
  const next = XP_LEVELS[idx + 1] ?? null
  const progress = next
    ? Math.min(100, Math.max(0, ((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100))
    : 100
  return { ...cur, progress, xp, next }
}
