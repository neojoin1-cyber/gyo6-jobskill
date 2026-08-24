import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { formatDate } from '../../lib/dateUtils.js'

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

  // 직접 update/delete는 RLS로 0행 처리(무반응 실사고) — 서버 검증 RPC 사용 + 실패를 화면에 표시
  async function approveStudent(id) {
    const { error } = await supabase.rpc('rpc_approve_student', { p_student: id })
    if (error) { alert('승인 실패: ' + error.message); return }
    load()
  }

  async function rejectStudent(id, name) {
    if (!window.confirm(`${name} 학생 신청을 거절할까요?`)) return
    const { error } = await supabase.rpc('rpc_reject_student', { p_student: id })
    if (error) { alert('거절 실패: ' + error.message); return }
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
                  {s.class_name} · {formatDate(s.created_at)} 신청
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
