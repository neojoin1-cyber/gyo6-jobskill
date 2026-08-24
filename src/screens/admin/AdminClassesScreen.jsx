/**
 * AdminClassesScreen — 관리자 학교 드릴다운 · 학급 관리
 * 학교의 학급 목록 조회 + 생성/수정/삭제 + 학급별 학생 명단.
 * (classes_admin_all / student_classes_admin_read 정책, rpc_admin_create_class 사용)
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import ClassWeaknessScreen from '../teacher/ClassWeaknessScreen.jsx'
import ClassProgressScreen from '../teacher/ClassProgressScreen.jsx'

const INIT_CLASS = { name: '', department: '', grade: '', class_num: '' }

export default function AdminClassesScreen({ school, onBack }) {
  const [classes,   setClasses]   = useState([])
  const [counts,    setCounts]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(null)   // class_id → 학생 패널
  const [weaknessClass, setWeaknessClass] = useState(null)   // {id,name} 약점 현황
  const [progressClass, setProgressClass] = useState(null)   // {id,name} 학습 진행현황
  const [students,  setStudents]  = useState({})     // class_id → [profiles]

  const [formOpen,  setFormOpen]  = useState(false)
  const [form,      setForm]      = useState(INIT_CLASS)
  const [editId,    setEditId]    = useState(null)    // 수정 중인 학급 id
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: cls } = await supabase
      .from('classes')
      .select('id, name, grade, department, class_num, class_code')
      .eq('school_id', school.id)
      .order('department').order('grade').order('class_num')
    const list = cls ?? []
    setClasses(list)

    if (list.length > 0) {
      const { data: sc } = await supabase
        .from('student_classes')
        .select('class_id')
        .in('class_id', list.map(c => c.id))
      const cnt = {}
      for (const r of sc ?? []) cnt[r.class_id] = (cnt[r.class_id] ?? 0) + 1
      setCounts(cnt)
    } else {
      setCounts({})
    }
    setLoading(false)
  }

  async function toggleStudents(classId) {
    if (expanded === classId) { setExpanded(null); return }
    setExpanded(classId)
    if (!students[classId]) {
      const { data } = await supabase
        .from('student_classes')
        .select('student_id, profiles(id, display_name, approved)')
        .eq('class_id', classId)
      setStudents(prev => ({ ...prev, [classId]: (data ?? []).map(r => r.profiles).filter(Boolean) }))
    }
  }

  function openCreate() {
    setEditId(null); setForm(INIT_CLASS); setError(''); setFormOpen(true)
  }
  function openEdit(c) {
    setEditId(c.id)
    setForm({
      name: c.name ?? '',
      department: c.department ?? '',
      grade: c.grade != null ? String(c.grade) : '',
      class_num: c.class_num != null ? String(c.class_num) : '',
    })
    setError(''); setFormOpen(true)
  }

  async function saveClass() {
    if (!form.name.trim()) { setError('학급 이름을 입력하세요.'); return }
    setSaving(true); setError('')
    const grade     = form.grade ? Number(form.grade) : null
    const class_num = form.class_num ? Number(form.class_num) : null

    let err
    if (editId) {
      ;({ error: err } = await supabase.from('classes').update({
        name: form.name.trim(),
        department: form.department.trim() || null,
        grade, class_num,
      }).eq('id', editId))
    } else {
      ;({ error: err } = await supabase.rpc('rpc_admin_create_class', {
        p_school_id:  school.id,
        p_name:       form.name.trim(),
        p_grade:      grade,
        p_department: form.department.trim() || null,
        p_class_num:  class_num,
      }))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setFormOpen(false)
    load()
  }

  async function deleteClass(c) {
    if (!window.confirm(`"${c.name}" 학급을 삭제할까요?\n(소속 학생 연결·미션이 있으면 삭제되지 않을 수 있습니다)`)) return
    const { error: err } = await supabase.from('classes').delete().eq('id', c.id)
    if (err) {
      alert(err.message.includes('violates foreign key')
        ? '이 학급에 연결된 미션/데이터가 있어 삭제할 수 없습니다. 먼저 관련 데이터를 정리하세요.'
        : '삭제 오류: ' + err.message)
      return
    }
    load()
  }

  if (weaknessClass)
    return <ClassWeaknessScreen classId={weaknessClass.id} className={weaknessClass.name} onBack={() => setWeaknessClass(null)} />
  if (progressClass)
    return <ClassProgressScreen classId={progressClass.id} className={progressClass.name} onBack={() => setProgressClass(null)} />

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">🏫 {school.name} 학급관리</span>
      </div>

      <div className="screen-body">
        {/* 학급 생성/수정 폼 */}
        {formOpen && (
          <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>{editId ? '학급 정보 수정' : '새 학급 만들기'}</p>
            <div className="form-group">
              <label className="form-label">학급 이름 *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 경영과 1학년 1반" />
            </div>
            <div className="form-group">
              <label className="form-label">학과</label>
              <input className="form-input" value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="예: 경영과" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">학년</label>
                <input className="form-input" type="number" min={1} max={3} value={form.grade}
                  onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="1" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">반</label>
                <input className="form-input" type="number" min={1} value={form.class_num}
                  onChange={e => setForm(f => ({ ...f, class_num: e.target.value }))} placeholder="1" />
              </div>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setFormOpen(false)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveClass} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 10px' }}>
          <p className="section-title" style={{ margin: 0 }}>학급 ({classes.length})</p>
          {!formOpen && (
            <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={openCreate}>
              + 학급 추가
            </button>
          )}
        </div>

        {loading && <div className="loading-screen"><div className="spinner" /></div>}

        {!loading && classes.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">🏫</span>
            <span className="empty-state-title">학급이 없습니다</span>
            <span>+ 학급 추가로 만들어 주세요.</span>
          </div>
        )}

        {classes.map(c => (
          <div key={c.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700 }}>{c.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[c.department, c.grade ? `${c.grade}학년` : null, c.class_num ? `${c.class_num}반` : null].filter(Boolean).join(' · ')}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  코드: <b style={{ letterSpacing: 2 }}>{c.class_code}</b> · 학생 {counts[c.id] ?? 0}명
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 17, padding: 4, minHeight: 44, minWidth: 44 }}>✏️</button>
                <button onClick={() => deleteClass(c)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 17, padding: 4, minHeight: 44, minWidth: 44 }}>🗑</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '6px 0' }}
                onClick={() => toggleStudents(c.id)}>
                👥 학생 명단 {expanded === c.id ? '▲' : '▼'}
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '6px 0' }}
                onClick={() => setProgressClass({ id: c.id, name: c.name })}>
                📈 진행율
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '6px 0' }}
                onClick={() => setWeaknessClass({ id: c.id, name: c.name })}>
                📉 약점
              </button>
            </div>

            {expanded === c.id && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {!students[c.id] && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중...</p>}
                {students[c.id]?.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>배정된 학생이 없습니다.</p>}
                {students[c.id]?.map(st => (
                  <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span>{st.display_name}</span>
                    {!st.approved && <span className="badge badge-yellow">미승인</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
