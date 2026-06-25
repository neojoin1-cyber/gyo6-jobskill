import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import BulkRegisterModal from './BulkRegisterModal.jsx'

const ROLE_LABELS = {
  teacher:      '교사',
  class_admin:  '학급관리자',
  school_admin: '학교관리자',
  admin:        '총괄관리자',
  student:      '학생',
}

const ROLE_BADGE = {
  teacher:      'badge-blue',
  class_admin:  'badge-blue',
  school_admin: 'badge-green',
  admin:        'badge-red',
  student:      'badge-gray',
}

const ASSIGNABLE_ROLES = [
  { value: 'student',      label: '학생' },
  { value: 'teacher',      label: '교사' },
  { value: 'class_admin',  label: '학급관리자' },
  { value: 'school_admin', label: '학교관리자' },
]

const INIT_FORM = {
  email: '', password: '', display_name: '', nickname: '',
  role: 'teacher', school_id: '', class_id: '',
}

export default function TeachersScreen() {
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState('all')

  // 일괄 등록 모달
  const [bulkModal,   setBulkModal]   = useState(false)

  // 역할 변경 모달
  const [roleModal,   setRoleModal]   = useState(null)
  const [roleTarget,  setRoleTarget]  = useState('')
  const [roleSaving,  setRoleSaving]  = useState(false)

  // 회원 생성 모달
  const [addModal,         setAddModal]         = useState(false)
  const [addForm,          setAddForm]          = useState(INIT_FORM)
  const [schools,          setSchools]          = useState([])
  const [addAllClasses,    setAddAllClasses]    = useState([])
  const [addSelectedDept,  setAddSelectedDept]  = useState('')
  const [addSelectedGrade, setAddSelectedGrade] = useState('')
  const [adding,           setAdding]           = useState(false)
  const [addError,         setAddError]         = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: memberData }, { data: schoolData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, role, approved, school_id, created_at, schools(name, region)')
        .not('role', 'eq', 'admin')
        .order('created_at', { ascending: false }),
      supabase.from('schools').select('id, name').order('name'),
    ])
    setMembers(memberData ?? [])
    setSchools(schoolData ?? [])
    setLoading(false)
  }

  // 학교 or 역할 변경 시 학급 목록 로드 (학생만)
  useEffect(() => {
    if (!addForm.school_id || addForm.role !== 'student') {
      setAddAllClasses([]); setAddSelectedDept(''); setAddSelectedGrade('')
      setAddForm(f => ({ ...f, class_id: '' }))
      return
    }
    supabase.from('classes').select('id, department, grade, class_num')
      .eq('school_id', addForm.school_id)
      .order('department').order('grade').order('class_num')
      .then(({ data }) => {
        setAddAllClasses(data ?? [])
        setAddSelectedDept(''); setAddSelectedGrade('')
        setAddForm(f => ({ ...f, class_id: '' }))
      })
  }, [addForm.school_id, addForm.role])

  const addDepts = [...new Set(addAllClasses.map(c => c.department).filter(Boolean))].sort()
  const addGrades = [...new Set(
    addAllClasses.filter(c => c.department === addSelectedDept).map(c => c.grade).filter(Boolean)
  )].sort((a, b) => a - b)
  const addClassOptions = addAllClasses.filter(
    c => c.department === addSelectedDept && String(c.grade) === addSelectedGrade
  )

  // ── 역할 변경 ───────────────────────────────────────────────────────────────
  async function changeRole(e) {
    e.preventDefault()
    if (!roleTarget) return
    setRoleSaving(true)
    const { error: err } = await supabase.rpc('rpc_admin_set_role', {
      p_user_id: roleModal.member.id,
      p_role:    roleTarget,
      p_approve: true,
    })
    setRoleSaving(false)
    if (err) { alert('역할 변경 오류: ' + err.message); return }
    setRoleModal(null)
    load()
  }

  // ── 승인/취소 ────────────────────────────────────────────────────────────────
  async function toggleApprove(member) {
    const { error: err } = await supabase.rpc('rpc_approve_member', {
      p_user_id: member.id,
      p_approve: !member.approved,
    })
    if (err) { alert('승인 처리 오류: ' + err.message); return }
    setMembers(prev => prev.map(m =>
      m.id === member.id ? { ...m, approved: !m.approved } : m
    ))
  }

  // ── 회원 삭제 ────────────────────────────────────────────────────────────────
  async function deleteMember(id, name) {
    if (!window.confirm(`${name}의 계정을 삭제할까요?`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) { alert('삭제 오류: ' + error.message); return }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  // ── 회원 직접 생성 ────────────────────────────────────────────────────────────
  async function createMember(e) {
    e.preventDefault(); setAddError('')
    if (!addForm.email.trim())        { setAddError('이메일을 입력하세요.'); return }
    if (addForm.password.length < 6)  { setAddError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (!addForm.display_name.trim()) { setAddError('이름을 입력하세요.'); return }
    if (!addForm.school_id)           { setAddError('학교를 선택하세요.'); return }
    if (addForm.role === 'student' && !addForm.class_id) { setAddError('학반을 선택하세요.'); return }

    setAdding(true)
    const { error: err } = await supabase.rpc('rpc_admin_create_user', {
      p_email:        addForm.email.trim(),
      p_password:     addForm.password,
      p_display_name: addForm.display_name.trim(),
      p_role:         addForm.role,
      p_school_id:    addForm.school_id || null,
      p_class_id:     addForm.role === 'student' ? (addForm.class_id || null) : null,
      p_nickname:     addForm.nickname.trim() || null,
    })
    setAdding(false)
    if (err) {
      setAddError(
        err.message.includes('duplicate key') || err.message.includes('already exists')
          ? '이미 사용 중인 이메일입니다.'
          : err.message
      )
      return
    }
    setAddModal(false)
    setAddForm(INIT_FORM)
    setAddSelectedDept(''); setAddSelectedGrade('')
    load()
  }

  function openAddModal() {
    setAddModal(true); setAddError('')
    setAddForm(INIT_FORM); setAddSelectedDept(''); setAddSelectedGrade('')
  }

  // ── 필터 ────────────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    if (filterRole !== 'all' && m.role !== filterRole) return false
    const name   = (m.display_name ?? '').toLowerCase()
    const school = (m.schools?.name ?? '').toLowerCase()
    const q = search.toLowerCase()
    return !q || name.includes(q) || school.includes(q)
  })

  const pendingCount = members.filter(m => !m.approved).length

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>

      {/* 일괄 등록 모달 */}
      {bulkModal && (
        <BulkRegisterModal
          schools={schools}
          onClose={() => setBulkModal(false)}
          onDone={() => { setBulkModal(false); load() }}
        />
      )}

      {/* 역할 변경 모달 */}
      {roleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 360 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>역할 변경</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {roleModal.member.display_name} ({ROLE_LABELS[roleModal.member.role]})
            </p>
            <div className="form-group">
              <label className="form-label">새 역할</label>
              <select className="form-input" value={roleTarget} onChange={e => setRoleTarget(e.target.value)}>
                <option value="">선택하세요</option>
                {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRoleModal(null)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={changeRole} disabled={!roleTarget || roleSaving}>
                {roleSaving ? '처리 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 생성 모달 */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>회원 직접 생성</p>

            <div className="form-group">
              <label className="form-label">이메일 *</label>
              <input className="form-input" type="email" value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="user@school.hs.kr" />
            </div>
            <div className="form-group">
              <label className="form-label">임시 비밀번호 * <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(6자 이상)</span></label>
              <input className="form-input" type="text" value={addForm.password}
                onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="초기 비밀번호" />
            </div>
            <div className="form-group">
              <label className="form-label">이름 *</label>
              <input className="form-input" value={addForm.display_name}
                onChange={e => setAddForm(f => ({ ...f, display_name: e.target.value }))} placeholder="홍길동" />
            </div>
            <div className="form-group">
              <label className="form-label">역할 *</label>
              <select className="form-input" value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value, class_id: '' }))}>
                {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">학교 *</label>
              <select className="form-input" value={addForm.school_id}
                onChange={e => setAddForm(f => ({ ...f, school_id: e.target.value, class_id: '' }))}>
                <option value="">학교 선택</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* 학생인 경우 학과→학년→학반 */}
            {addForm.role === 'student' && addForm.school_id && (
              <>
                <div className="form-group">
                  <label className="form-label">학과 *</label>
                  <select className="form-input" value={addSelectedDept} disabled={addDepts.length === 0}
                    onChange={e => { setAddSelectedDept(e.target.value); setAddSelectedGrade(''); setAddForm(f => ({ ...f, class_id: '' })) }}>
                    <option value="">{addDepts.length === 0 ? '학과 없음' : '학과 선택'}</option>
                    {addDepts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">학년 *</label>
                  <select className="form-input" value={addSelectedGrade} disabled={!addSelectedDept}
                    onChange={e => { setAddSelectedGrade(e.target.value); setAddForm(f => ({ ...f, class_id: '' })) }}>
                    <option value="">{!addSelectedDept ? '학과를 먼저 선택' : '학년 선택'}</option>
                    {addGrades.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">학반 *</label>
                  <select className="form-input" value={addForm.class_id} disabled={!addSelectedGrade}
                    onChange={e => setAddForm(f => ({ ...f, class_id: e.target.value }))}>
                    <option value="">{!addSelectedGrade ? '학년을 먼저 선택' : '학반 선택'}</option>
                    {addClassOptions.map(c => <option key={c.id} value={c.id}>{c.class_num}반</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">닉네임 <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>전국 랭킹용, 선택</span></label>
                  <input className="form-input" value={addForm.nickname}
                    onChange={e => setAddForm(f => ({ ...f, nickname: e.target.value }))} placeholder="랭킹에 표시될 별명" />
                </div>
              </>
            )}

            {addError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => { setAddModal(false); setAddError('') }}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={createMember} disabled={adding}>
                {adding ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 8px' }}>
        <div>
          <p className="section-title" style={{ margin: 0 }}>전체 회원 ({members.length})</p>
          {pendingCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--warning, #f59e0b)', marginTop: 2 }}>⏳ 승인 대기 {pendingCount}명</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => setBulkModal(true)}>
            📤 일괄 등록
          </button>
          <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={openAddModal}>
            + 회원 생성
          </button>
        </div>
      </div>

      {/* 검색 + 역할 필터 */}
      <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="이름 또는 학교로 검색..." style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { v: 'all', label: '전체' },
          { v: 'school_admin', label: '학교관리자' },
          { v: 'teacher', label: '교사' },
          { v: 'class_admin', label: '학급관리자' },
          { v: 'student', label: '학생' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilterRole(f.v)}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, border: 'none', cursor: 'pointer',
              background: filterRole === f.v ? 'var(--primary)' : 'var(--border)',
              color: filterRole === f.v ? '#fff' : 'var(--text-muted)',
              fontWeight: filterRole === f.v ? 700 : 400,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">👥</span>
          <span className="empty-state-title">{search ? '검색 결과 없음' : '등록된 회원이 없습니다'}</span>
        </div>
      )}

      {filtered.map(m => (
        <div key={m.id} className="card" style={{
          marginBottom: 10,
          borderLeft: !m.approved ? '4px solid var(--warning, #f59e0b)' : undefined,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <p style={{ fontWeight: 700 }}>{m.display_name}</p>
                <span className={`badge ${ROLE_BADGE[m.role] ?? 'badge-gray'}`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
                {!m.approved && <span className="badge badge-yellow">미승인</span>}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {m.schools ? `${m.schools.name}` : '학교 미배정'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                가입: {new Date(m.created_at).toLocaleDateString('ko')}
              </p>
            </div>
            <button onClick={() => deleteMember(m.id, m.display_name)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: 4 }}>
              🗑
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '6px 0' }}
              onClick={() => { setRoleModal({ member: m }); setRoleTarget(m.role) }}>
              🔄 역할 변경
            </button>
            <button
              className={`btn ${m.approved ? 'btn-ghost' : 'btn-primary'}`}
              style={{ flex: 1, fontSize: 12, padding: '6px 0', color: m.approved ? 'var(--danger)' : undefined }}
              onClick={() => toggleApprove(m)}>
              {m.approved ? '✗ 승인취소' : '✓ 승인'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
