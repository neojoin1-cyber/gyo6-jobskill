/**
 * ClassAdminSubjectScreen — 학급관리자: 담당 학급 학생에게 교재 배정·해제.
 * rpc_my_class_students() → 담당 학급 학생. student_subjects 직접 관리(RLS: 담당 학급 학생만).
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import SubjectAssignList from '../shared/SubjectAssignList.jsx'

export default function ClassAdminSubjectScreen({ classId, className, onBack }) {
  const [students, setStudents] = useState([])
  const [assign, setAssign] = useState({})   // studentId → Set
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { const id = pushBack(() => onBack?.()); return () => popBack(id) }, [])
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: stu, error: e1 }, { data: ss }] = await Promise.all([
      supabase.rpc('rpc_my_class_students'),
      supabase.from('student_subjects').select('student_id, subject_id'),
    ])
    if (e1) { setErr(e1.message); setLoading(false); return }
    let list = Array.isArray(stu) ? stu : []
    if (classId) list = list.filter(s => s.class_id === classId)
    setStudents(list)
    const m = {}
    for (const r of ss ?? []) { (m[r.student_id] ||= new Set()).add(r.subject_id) }
    setAssign(m)
    setLoading(false)
  }

  async function toggle(t, s, on) {
    setSaving(`${t.id}|${s.id}`)
    const { error } = on
      ? await supabase.from('student_subjects').delete().eq('student_id', t.id).eq('subject_id', s.id)
      : await supabase.from('student_subjects').insert({ student_id: t.id, subject_id: s.id })
    if (!error) setAssign(prev => {
      const next = { ...prev, [t.id]: new Set(prev[t.id] || []) }
      on ? next[t.id].delete(s.id) : next[t.id].add(s.id)
      return next
    })
    setSaving(null)
  }

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">🗂️ {className || '학급'} 교재배정</span>
      </div>
      <div className="screen-body">
        {err && <div className="card" style={{ color: '#b91c1c' }}>{err}</div>}
        {loading ? <div className="loading-screen"><div className="spinner" /></div> : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0 10px', lineHeight: 1.6 }}>
              학생에게 교재를 배정합니다. 학생은 <b>배정된 교재만</b> 볼 수 있습니다.
              (배정이 하나도 없으면 전체 교재가 보입니다.)
            </p>
            <SubjectAssignList
              targets={students.map(s => ({ id: s.student_id, name: s.display_name, sub: s.class_name }))}
              assigned={assign} saving={saving} onToggle={toggle} emptyText="담당 학급 학생이 없습니다" />
          </>
        )}
      </div>
    </div>
  )
}
