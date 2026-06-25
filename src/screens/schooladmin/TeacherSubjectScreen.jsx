import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'

export default function TeacherSubjectScreen() {
  const { profile } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [schoolSubjects, setSchoolSubjects] = useState([])
  const [teacherSubjects, setTeacherSubjects] = useState({}) // teacherId → Set<subjectId>
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: tData }, { data: ssData }, { data: tsData }] = await Promise.all([
      supabase.from('profiles')
        .select('id, display_name')
        .eq('role', 'teacher')
        .eq('school_id', profile.school_id)
        .eq('approved', true),
      supabase.from('school_subjects')
        .select('subject_id, subjects(id, name)')
        .eq('school_id', profile.school_id),
      supabase.from('teacher_subjects')
        .select('teacher_id, subject_id')
        .eq('school_id', profile.school_id),
    ])

    setTeachers(tData ?? [])
    setSchoolSubjects(ssData?.map(r => r.subjects) ?? [])

    const map = {}
    for (const ts of tsData ?? []) {
      if (!map[ts.teacher_id]) map[ts.teacher_id] = new Set()
      map[ts.teacher_id].add(ts.subject_id)
    }
    setTeacherSubjects(map)
    setLoading(false)
  }

  async function toggleSubject(teacherId, subjectId) {
    const key = `${teacherId}-${subjectId}`
    setSaving(key)
    const hasIt = teacherSubjects[teacherId]?.has(subjectId)

    if (hasIt) {
      await supabase.from('teacher_subjects')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('subject_id', subjectId)
      setTeacherSubjects(prev => {
        const next = { ...prev, [teacherId]: new Set(prev[teacherId]) }
        next[teacherId].delete(subjectId)
        return next
      })
    } else {
      await supabase.from('teacher_subjects')
        .insert({ teacher_id: teacherId, subject_id: subjectId, school_id: profile.school_id })
      setTeacherSubjects(prev => {
        const next = { ...prev, [teacherId]: new Set(prev[teacherId] ?? []) }
        next[teacherId].add(subjectId)
        return next
      })
    }
    setSaving(null)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (schoolSubjects.length === 0) {
    return (
      <div className="screen-body">
        <div className="empty-state">
          <span className="empty-state-icon">📚</span>
          <span className="empty-state-title">배정된 과목이 없습니다</span>
          <span>총괄관리자에게 학교 과목 배정을 요청하세요.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', lineHeight: 1.6 }}>
        학교에 배정된 과목을 교사에게 배정하거나 취소합니다.<br />
        교사는 배정된 과목으로만 미션을 생성할 수 있습니다.
      </p>

      {teachers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">👩‍🏫</span>
          <span className="empty-state-title">승인된 교사가 없습니다</span>
        </div>
      ) : (
        teachers.map(teacher => {
          const assigned = teacherSubjects[teacher.id] ?? new Set()
          return (
            <div key={teacher.id} className="card" style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>👩‍🏫 {teacher.display_name}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {schoolSubjects.map(sub => {
                  const has = assigned.has(sub.id)
                  const isLoading = saving === `${teacher.id}-${sub.id}`
                  return (
                    <div key={sub.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 8,
                      background: has ? 'var(--primary-light)' : 'var(--bg)',
                      border: `1.5px solid ${has ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: has ? 700 : 400, color: has ? 'var(--primary)' : 'var(--text)' }}>
                        {sub.name}
                      </span>
                      <button
                        style={{
                          padding: '5px 14px', borderRadius: 6, border: 'none',
                          background: has ? 'var(--danger)' : 'var(--primary)',
                          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          opacity: isLoading ? 0.6 : 1,
                        }}
                        disabled={isLoading}
                        onClick={() => toggleSubject(teacher.id, sub.id)}>
                        {isLoading ? '...' : has ? '취소' : '배정'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
