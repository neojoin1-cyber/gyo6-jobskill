/**
 * SchoolSubjectAssignScreen — 학교관리자: 학급/학생 단위로 교재(과목) 배정·해제.
 * class_subjects(학급) / student_subjects(학생) 직접 관리(RLS: 학교 범위).
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import SubjectAssignList from '../shared/SubjectAssignList.jsx'

export default function SchoolSubjectAssignScreen() {
  const { profile } = useAuth()
  const [view, setView] = useState('class')   // 'class' | 'student'
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [classAssign, setClassAssign] = useState({})     // classId → Set
  const [studentAssign, setStudentAssign] = useState({}) // studentId → Set
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: cData }, { data: sData }, { data: csData }, { data: ssData }] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
      supabase.from('profiles').select('id, display_name, class_id').eq('school_id', profile.school_id).eq('role', 'student').order('display_name'),
      supabase.from('class_subjects').select('class_id, subject_id').eq('school_id', profile.school_id),
      supabase.from('student_subjects').select('student_id, subject_id'),
    ])
    setClasses(cData ?? [])
    setStudents(sData ?? [])
    setClassAssign(toMap(csData, 'class_id'))
    setStudentAssign(toMap(ssData, 'student_id'))
    setLoading(false)
  }

  function toMap(rows, key) {
    const m = {}
    for (const r of rows ?? []) { (m[r[key]] ||= new Set()).add(r.subject_id) }
    return m
  }

  async function toggleClass(t, s, on) {
    setSaving(`${t.id}|${s.id}`)
    const { error } = on
      ? await supabase.from('class_subjects').delete().eq('class_id', t.id).eq('subject_id', s.id)
      : await supabase.from('class_subjects').insert({ class_id: t.id, subject_id: s.id, school_id: profile.school_id })
    if (error) { setSaving(null); alert('저장 실패: ' + error.message); return }
    setClassAssign(prev => {
      const next = { ...prev, [t.id]: new Set(prev[t.id] || []) }
      on ? next[t.id].delete(s.id) : next[t.id].add(s.id)
      return next
    })
    setSaving(null)
  }

  async function toggleStudent(t, s, on) {
    setSaving(`${t.id}|${s.id}`)
    const { error } = on
      ? await supabase.from('student_subjects').delete().eq('student_id', t.id).eq('subject_id', s.id)
      : await supabase.from('student_subjects').insert({ student_id: t.id, subject_id: s.id })
    if (error) { setSaving(null); alert('저장 실패: ' + error.message); return }
    setStudentAssign(prev => {
      const next = { ...prev, [t.id]: new Set(prev[t.id] || []) }
      on ? next[t.id].delete(s.id) : next[t.id].add(s.id)
      return next
    })
    setSaving(null)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const classNameById = Object.fromEntries(classes.map(c => [c.id, c.name]))

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', lineHeight: 1.6 }}>
        학급 또는 학생에게 교재를 배정합니다. 학생은 <b>배정된 교재만</b> 볼 수 있습니다.<br />
        (배정이 하나도 없으면 전체 교재가 보입니다.)
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['class', '🏫 학급별'], ['student', '🧑‍🎓 학생별']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              background: view === v ? 'var(--primary)' : 'var(--card)', color: view === v ? '#fff' : 'var(--text)',
              border: `1.5px solid ${view === v ? 'var(--primary)' : 'var(--border)'}` }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'class'
        ? <SubjectAssignList targets={classes.map(c => ({ id: c.id, name: c.name }))}
            assigned={classAssign} saving={saving} onToggle={toggleClass} emptyText="학급이 없습니다" />
        : <SubjectAssignList targets={students.map(s => ({ id: s.id, name: s.display_name, sub: classNameById[s.class_id] }))}
            assigned={studentAssign} saving={saving} onToggle={toggleStudent} emptyText="학생이 없습니다" />}
    </div>
  )
}
