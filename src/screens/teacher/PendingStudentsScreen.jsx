import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function PendingStudentsScreen({ onBack }) {
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // 내 학급의 학생들 조회
    const { data: myClasses } = await supabase
      .from('teacher_classes')
      .select('class_id, classes(name)')
    const classIds = (myClasses ?? []).map(r => r.class_id)

    if (classIds.length === 0) { setLoading(false); return }

    const { data: sc } = await supabase
      .from('student_classes')
      .select('student_id, class_id, classes(name), profiles!student_id(id, display_name, approved, created_at)')
      .in('class_id', classIds)

    const all = (sc ?? []).map(r => ({
      id: r.profiles.id,
      display_name: r.profiles.display_name,
      approved: r.profiles.approved,
      created_at: r.profiles.created_at,
      class_name: r.classes.name,
      class_id: r.class_id,
    }))

    setPending(all.filter(s => !s.approved))
    setApproved(all.filter(s => s.approved))
    setLoading(false)
  }

  async function approveStudent(id) {
    await supabase.from('profiles').update({ approved: true }).eq('id', id)
    load()
  }

  async function rejectStudent(id, name) {
    if (!window.confirm(`${name} 학생 신청을 거절할까요?`)) return
    // student_classes에서 제거 (계정은 유지)
    await supabase.from('student_classes').delete()
      .eq('student_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">학생 승인</span>
      </div>
      <div className="screen-body">
        <p className="section-title">승인 대기 ({pending.length})</p>

        {pending.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
            대기 중인 학생이 없습니다.
          </div>
        )}

        {pending.map(s => (
          <div key={s.id} className="card" style={{ marginBottom: 10, borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700 }}>{s.display_name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.class_name} · {new Date(s.created_at).toLocaleDateString('ko')} 신청
                </p>
              </div>
              <span className="badge badge-yellow">대기</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--danger)', fontSize: 13 }}
                onClick={() => rejectStudent(s.id, s.display_name)}>거절</button>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
                onClick={() => approveStudent(s.id)}>✓ 승인</button>
            </div>
          </div>
        ))}

        {approved.length > 0 && (
          <>
            <p className="section-title">승인된 학생 ({approved.length})</p>
            {approved.map(s => (
              <div key={s.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{s.display_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.class_name}</p>
                  </div>
                  <span className="badge badge-green">승인됨</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
