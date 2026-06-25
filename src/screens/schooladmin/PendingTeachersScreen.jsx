import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'

export default function PendingTeachersScreen() {
  const { profile } = useAuth()
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, approved, created_at')
      .eq('role', 'teacher')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    const all = data ?? []
    setPending(all.filter(t => !t.approved))
    setApproved(all.filter(t => t.approved))
    setLoading(false)
  }

  async function approveTeacher(id) {
    await supabase.from('profiles').update({ approved: true }).eq('id', id)
    load()
  }

  async function rejectTeacher(id, name) {
    if (!window.confirm(`${name} 교사 신청을 거절할까요? 계정이 삭제됩니다.`)) return
    await supabase.from('profiles').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <p className="section-title" style={{ paddingTop: 12 }}>
        승인 대기 교사 ({pending.length})
      </p>

      {pending.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
          대기 중인 교사 신청이 없습니다.
        </div>
      )}

      {pending.map(t => (
        <div key={t.id} className="card" style={{ marginBottom: 10, borderLeft: '4px solid var(--warning, #f59e0b)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700 }}>{t.display_name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                신청: {new Date(t.created_at).toLocaleDateString('ko')}
              </p>
            </div>
            <span className="badge badge-yellow">대기중</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--danger)', fontSize: 13 }}
              onClick={() => rejectTeacher(t.id, t.display_name)}>
              거절
            </button>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
              onClick={() => approveTeacher(t.id)}>
              ✓ 승인
            </button>
          </div>
        </div>
      ))}

      {approved.length > 0 && (
        <>
          <p className="section-title">승인된 교사 ({approved.length})</p>
          {approved.map(t => (
            <div key={t.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontWeight: 600 }}>{t.display_name}</p>
                <span className="badge badge-green">승인됨</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
