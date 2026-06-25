import { useState, useEffect } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'

export default function SchoolClassesScreen() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('classes')
      .select('id, name, grade, class_code, created_at')
      .eq('school_id', profile.school_id)
      .order('grade')
    setClasses(data ?? [])
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <p className="section-title" style={{ paddingTop: 12 }}>
        학급 현황 ({classes.length})
      </p>

      {classes.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">🏫</span>
          <span className="empty-state-title">등록된 학급이 없습니다</span>
          <span>교사가 학급을 만들면 여기에 표시됩니다.</span>
        </div>
      )}

      {classes.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700 }}>{c.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {c.grade ? `${c.grade}학년` : ''} · 코드: <b style={{ letterSpacing: 2 }}>{c.class_code}</b>
              </p>
            </div>
            <span className="badge badge-blue">학급</span>
          </div>
        </div>
      ))}
    </div>
  )
}
