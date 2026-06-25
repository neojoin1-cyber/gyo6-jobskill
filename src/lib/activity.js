import { supabase } from './supabase.js'

// 중복 호출 방지: 같은 세션에서 오늘 이미 기록했으면 스킵
const _recorded = new Set()

export async function recordActivity(type = 'study') {
  const key = `${type}-${new Date().toISOString().slice(0, 10)}`
  if (_recorded.has(key)) return
  _recorded.add(key)
  try {
    await supabase.rpc('rpc_record_activity', { p_type: type })
  } catch {
    _recorded.delete(key) // 실패 시 재시도 허용
  }
}
