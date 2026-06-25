import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'

const TYPE_ICON  = { mission: '📋', result: '🏆', info: '📢', streak: '🔥' }
const TYPE_COLOR = { mission: 'var(--primary)', result: '#F59E0B', info: 'var(--text-muted)', streak: '#EF4444' }

export default function NotificationsScreen() {
  const { profile } = useAuth()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // 실시간 구독: 새 알림 push
    const ch = supabase.channel('notifications-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => {
        setItems(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data ?? [])
    setLoading(false)
  }

  async function markAll() {
    await supabase.rpc('rpc_mark_all_notifications_read')
    setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markOne(id) {
    await supabase.rpc('rpc_mark_notification_read', { p_notification_id: id })
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const unreadCount = items.filter(n => !n.read).length

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">
          🔔 알림 {unreadCount > 0 && (
            <span style={{
              background: '#EF4444', color: '#fff', borderRadius: 999,
              fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 6,
            }}>{unreadCount}</span>
          )}
        </span>
        {unreadCount > 0 && (
          <button onClick={markAll}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              fontSize: 12, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
            전체 읽음
          </button>
        )}
      </div>

      <div className="screen-body">
        {items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🔔</span>
            <span className="empty-state-title">알림이 없습니다</span>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              새 미션이 생기거나 결과가 나오면 알려드립니다
            </p>
          </div>
        ) : (
          items.map(n => (
            <div key={n.id}
              onClick={() => { if (!n.read) markOne(n.id) }}
              className="list-item"
              style={{
                cursor: n.read ? 'default' : 'pointer',
                opacity: n.read ? 0.65 : 1,
                borderLeft: n.read ? '3px solid transparent' : `3px solid ${TYPE_COLOR[n.type] ?? 'var(--primary)'}`,
                background: n.read ? 'var(--card)' : 'var(--card)',
              }}>
              <div className="list-item-icon" style={{
                fontSize: 20,
                background: n.read ? 'var(--bg)' : 'var(--primary-light)',
              }}>
                {TYPE_ICON[n.type] ?? '📢'}
              </div>
              <div className="list-item-body">
                <p className="list-item-title" style={{ fontWeight: n.read ? 500 : 700 }}>
                  {n.title}
                </p>
                {n.body && <p className="list-item-sub" style={{ marginTop: 3 }}>{n.body}</p>}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString('ko-KR', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {!n.read && <span style={{ color: TYPE_COLOR[n.type] ?? 'var(--primary)', marginLeft: 8, fontWeight: 700 }}>● 새 알림</span>}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
