import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function TeacherDashboard({ profile, onLogout, onNavigate, hideAppbar }) {
  const [classes, setClasses] = useState([])
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewClass, setShowNewClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: tc } = await supabase
      .from('teacher_classes')
      .select('class_id, classes(id, name, grade, class_code, school_id)')
    const myClasses = (tc ?? []).map(r => r.classes)
    setClasses(myClasses)

    if (myClasses.length > 0) {
      const classIds = myClasses.map(c => c.id)
      const { data: ms } = await supabase
        .from('missions')
        .select('id, title, mission_type, status, due_at, class_id')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
        .limit(20)
      setMissions(ms ?? [])
    }
    setLoading(false)
  }

  async function createClass(e) {
    e.preventDefault()
    setError('')
    setCreating(true)
    const { data, error: err } = await supabase.rpc('rpc_create_class', {
      p_name: newClassName.trim(),
      p_grade: newGrade ? parseInt(newGrade) : null,
      p_academic_year: new Date().getFullYear(),
    })
    if (err) { setError(err.message); setCreating(false); return }
    setShowNewClass(false)
    setNewClassName('')
    setNewGrade('')
    setCreating(false)
    load()
  }

  async function activateMission(missionId) {
    await supabase.from('missions').update({ status: 'active', activated_at: new Date().toISOString() }).eq('id', missionId)
    load()
  }

  async function closeMission(missionId) {
    await supabase.from('missions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', missionId)
    load()
  }

  const statusBadge = s =>
    s === 'active' ? 'badge-green' :
    s === 'closed' ? 'badge-gray' : 'badge-yellow'
  const statusLabel = s =>
    s === 'active' ? '진행중' : s === 'closed' ? '마감' : '대기'

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: hideAppbar ? 0 : undefined }}>

        {/* 학급 목록 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p className="section-title" style={{ margin: 0 }}>내 학급</p>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setShowNewClass(v => !v)}>
            + 학급 추가
          </button>
        </div>

        {showNewClass && (
          <div className="card" style={{ marginBottom: 16 }}>
            <form onSubmit={createClass}>
              <div className="form-group">
                <label className="form-label">학급 이름</label>
                <input className="form-input" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="예: 2-1반" required />
              </div>
              <div className="form-group">
                <label className="form-label">학년 (선택)</label>
                <input className="form-input" type="number" min="1" max="3" value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="1~3" />
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
              <button className="btn btn-primary btn-full" type="submit" disabled={creating}>
                {creating ? '생성 중...' : '학급 생성'}
              </button>
            </form>
          </div>
        )}

        {classes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🏫</span>
            <span className="empty-state-title">학급이 없습니다</span>
            <span>+ 학급 추가 버튼으로 첫 학급을 만드세요.</span>
          </div>
        ) : (
          classes.map(cls => (
            <div key={cls.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{cls.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>학급 코드: <b style={{ color: 'var(--primary)', letterSpacing: 1 }}>{cls.class_code}</b></p>
                </div>
                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: 13 }}
                  onClick={() => onNavigate('class-results', { classId: cls.id, className: cls.name })}>
                  결과 보기
                </button>
              </div>
              <button className="btn btn-primary btn-full" style={{ fontSize: 14 }}
                onClick={() => onNavigate('create-mission', { classId: cls.id, className: cls.name })}>
                + 미션 만들기
              </button>
            </div>
          ))
        )}

        {/* 최근 미션 */}
        {missions.length > 0 && (
          <>
            <p className="section-title">최근 미션</p>
            {missions.map(m => {
              const cls = classes.find(c => c.id === m.class_id)
              return (
                <div key={m.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{m.title}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`badge ${statusBadge(m.status)}`}>{statusLabel(m.status)}</span>
                        <span className="badge badge-blue">{m.mission_type}</span>
                        {cls && <span className="badge badge-gray">{cls.name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.status === 'draft' && (
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => activateMission(m.id)}>
                          활성화
                        </button>
                      )}
                      {m.status === 'active' && (
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => closeMission(m.id)}>
                          마감
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
    </div>
  )
}
