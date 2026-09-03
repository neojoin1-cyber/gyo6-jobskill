import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import BulkRegisterModal from './BulkRegisterModal.jsx'
import { formatDate } from '../../lib/dateUtils.js'

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
// 총괄관리자(admin) 지정은 본인이 총괄관리자로 로그인했을 때만 가능
const SUPER_ADMIN_ROLE = { value: 'admin', label: '총괄관리자' }

const INIT_FORM = {
  email: '', password: '', display_name: '', nickname: '',
  role: 'teacher', school_id: '', class_id: '', class_ids: [],
}

const INIT_EDIT = {
  display_name: '', nickname: '', email: '',
  role: 'student', school_id: '', class_id: '', class_ids: [],
}

const MULTI_CLASS_ROLES = new Set(['teacher', 'class_admin'])

// 학급 라벨 (학과 학년반)
function classLabel(m) {
  if (Array.isArray(m.teacher_class_names) && m.teacher_class_names.length) {
    return m.teacher_class_names.join(', ')
  }
  if (!m.class_id) return null
  if (m.class_department || m.class_grade || m.class_num) {
    return `${m.class_department ?? ''} ${m.class_grade ?? ''}학년 ${m.class_num ?? ''}반`.trim()
  }
  return m.class_name ?? null
}

export default function TeachersScreen({ currentRole }) {
  // 현재 로그인 사용자가 총괄관리자일 때만 '총괄관리자' 역할을 지정 가능
  const roleOptions = currentRole === 'admin'
    ? [...ASSIGNABLE_ROLES, SUPER_ADMIN_ROLE]
    : ASSIGNABLE_ROLES
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState('all')

  const [schools,     setSchools]     = useState([])

  // 일괄 등록 모달
  const [bulkModal,   setBulkModal]   = useState(false)

  // 회원 전체 편집 모달
  const [editModal,    setEditModal]    = useState(null)   // 대상 member
  const [editForm,     setEditForm]     = useState(INIT_EDIT)
  const [editSaving,   setEditSaving]   = useState(false)
  const [editError,    setEditError]    = useState('')
  const [editClasses,  setEditClasses]  = useState([])
  const [editDept,     setEditDept]     = useState('')
  const [editGrade,    setEditGrade]    = useState('')

  // 비밀번호 재설정
  const [pwValue,  setPwValue]  = useState('')
  const [pwSaving, setPwSaving]  = useState(false)
  const [pwMsg,    setPwMsg]    = useState('')

  // 학습이력 모달
  const [historyModal,   setHistoryModal]   = useState(null)
  const [historyData,    setHistoryData]    = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // 회원 생성 모달
  const [addModal,         setAddModal]         = useState(false)
  const [addForm,          setAddForm]          = useState(INIT_FORM)
  const [addAllClasses,    setAddAllClasses]    = useState([])
  const [addSelectedDept,  setAddSelectedDept]  = useState('')
  const [addSelectedGrade, setAddSelectedGrade] = useState('')
  const [adding,           setAdding]           = useState(false)
  const [addError,         setAddError]         = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: memberData }, { data: schoolData }] = await Promise.all([
      supabase.rpc('rpc_admin_members'),
      supabase.from('schools').select('id, name').order('name'),
    ])
    setMembers(memberData ?? [])
    setSchools(schoolData ?? [])
    setLoading(false)
  }

  // 학생은 한 학급, 교사·학급관리자는 여러 담당 학급을 선택한다.
  useEffect(() => {
    if (!addForm.school_id || (addForm.role !== 'student' && !MULTI_CLASS_ROLES.has(addForm.role))) {
      setAddAllClasses([]); setAddSelectedDept(''); setAddSelectedGrade('')
      setAddForm(f => ({ ...f, class_id: '', class_ids: [] }))
      return
    }
    supabase.from('classes').select('id, name, department, grade, class_num')
      .eq('school_id', addForm.school_id)
      .order('department').order('grade').order('class_num')
      .then(({ data }) => {
        setAddAllClasses(data ?? [])
        setAddSelectedDept(''); setAddSelectedGrade('')
        setAddForm(f => ({ ...f, class_id: '', class_ids: [] }))
      })
  }, [addForm.school_id, addForm.role])

  const addDepts = [...new Set(addAllClasses.map(c => c.department).filter(Boolean))].sort()
  const addGrades = [...new Set(
    addAllClasses.filter(c => c.department === addSelectedDept).map(c => c.grade).filter(Boolean)
  )].sort((a, b) => a - b)
  const addClassOptions = addAllClasses.filter(
    c => c.department === addSelectedDept && String(c.grade) === addSelectedGrade
  )

  // 편집 시에도 역할에 맞는 학급 목록을 모두 불러온다.
  useEffect(() => {
    if (!editModal) return
    if (!editForm.school_id || (editForm.role !== 'student' && !MULTI_CLASS_ROLES.has(editForm.role))) {
      setEditClasses([]); setEditDept(''); setEditGrade('')
      return
    }
    supabase.from('classes').select('id, name, department, grade, class_num')
      .eq('school_id', editForm.school_id)
      .order('department').order('grade').order('class_num')
      .then(({ data }) => setEditClasses(data ?? []))
  }, [editForm.school_id, editForm.role, editModal])

  const editDepts = [...new Set(editClasses.map(c => c.department).filter(Boolean))].sort()
  const editGrades = [...new Set(
    editClasses.filter(c => c.department === editDept).map(c => c.grade).filter(Boolean)
  )].sort((a, b) => a - b)
  const editClassOptions = editClasses.filter(
    c => c.department === editDept && String(c.grade) === editGrade
  )

  function openEdit(m) {
    setEditModal(m)
    setEditError('')
    setPwValue(''); setPwMsg('')
    setEditForm({
      display_name: m.display_name ?? '',
      nickname:     m.nickname ?? '',
      email:        m.email ?? '',
      role:         m.role ?? 'student',
      school_id:    m.school_id ?? '',
      class_id:     m.class_id ?? '',
      class_ids:    Array.isArray(m.teacher_class_ids) ? m.teacher_class_ids : [],
    })
    setEditDept(m.class_department ?? '')
    setEditGrade(m.class_grade != null ? String(m.class_grade) : '')
  }

  // ── 회원 전체 정보 저장 ────────────────────────────────────────────────────────
  async function saveMemberEdit(e) {
    e.preventDefault(); setEditError('')
    if (!editForm.display_name.trim()) { setEditError('이름을 입력하세요.'); return }
    if (editForm.role === 'student' && editForm.school_id && !editForm.class_id) {
      setEditError('학생은 학반을 선택하세요.'); return
    }
    setEditSaving(true)
    const selectedClassIds = editForm.role === 'student'
      ? [editForm.class_id]
      : MULTI_CLASS_ROLES.has(editForm.role) ? editForm.class_ids : []
    const { data: updateResult, error: err } = await supabase.rpc('rpc_admin_update_user_v2', {
      p_user_id:      editModal.id,
      p_display_name: editForm.display_name.trim(),
      p_nickname:     editForm.nickname.trim(),
      p_email:        editForm.email.trim() || null,
      p_role:         editForm.role,
      p_school_id:    editForm.school_id || null,
      p_class_ids:    selectedClassIds,
      p_approved:     null,
    })
    setEditSaving(false)
    if (err) {
      setEditError(
        err.message.includes('이미 사용 중인 이메일') ? '이미 사용 중인 이메일입니다.' : err.message
      )
      return
    }
    if (Number(updateResult?.assigned_class_count ?? 0) !== selectedClassIds.length) {
      setEditError('학급 배정 결과를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.')
      return
    }
    setEditModal(null)
    load()
  }

  // ── 비밀번호 재설정 ───────────────────────────────────────────────────────────
  async function resetPassword() {
    if (pwValue.length < 6) { setPwMsg('⚠️ 6자 이상 입력하세요.'); return }
    setPwSaving(true); setPwMsg('')
    const { error: err } = await supabase.rpc('rpc_admin_reset_password', {
      p_user_id: editModal.id, p_new_password: pwValue,
    })
    setPwSaving(false)
    if (err) { setPwMsg('오류: ' + err.message); return }
    setPwMsg(`✅ 임시 비밀번호로 재설정되었습니다: ${pwValue}`)
    setPwValue('')
  }

  // ── 학습이력 조회 ─────────────────────────────────────────────────────────────
  async function openHistory(m) {
    setHistoryModal(m); setHistoryData(null); setHistoryLoading(true)
    const { data, error } = await supabase.rpc('rpc_admin_member_history', { p_user_id: m.id })
    setHistoryLoading(false)
    if (error) { alert('이력 조회 오류: ' + error.message); setHistoryModal(null); return }
    setHistoryData(data)
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
    if (!window.confirm(`${name}의 계정을 삭제할까요?
(로그인 계정까지 완전히 삭제되며 되돌릴 수 없습니다)`)) return
    // profiles 직접 delete는 RLS로 0행 + auth 계정 잔존(유령·재가입 불가) — 서버 RPC로 완전 삭제
    const { error } = await supabase.rpc('rpc_admin_delete_member', { p_uid: id })
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
    const { data: created, error: err } = await supabase.rpc('rpc_admin_create_user', {
      p_email:        addForm.email.trim(),
      p_password:     addForm.password,
      p_display_name: addForm.display_name.trim(),
      p_role:         addForm.role,
      p_school_id:    addForm.school_id || null,
      p_class_id:     addForm.role === 'student' ? (addForm.class_id || null) : null,
      p_nickname:     addForm.nickname.trim() || null,
    })
    if (err) {
      setAdding(false)
      setAddError(
        err.message.includes('duplicate key') || err.message.includes('already exists')
          ? '이미 사용 중인 이메일입니다.'
          : err.message
      )
      return
    }
    if (MULTI_CLASS_ROLES.has(addForm.role) && addForm.class_ids.length > 0) {
      const userId = created?.user_id
      if (!userId) {
        setAdding(false)
        setAddError('계정은 생성됐지만 담당 학급 배정에 필요한 사용자 정보를 받지 못했습니다. 회원 목록에서 다시 배정해 주세요.')
        await load()
        return
      }
      const { data: assigned, error: assignError } = await supabase.rpc('rpc_admin_update_user_v2', {
        p_user_id: userId,
        p_display_name: addForm.display_name.trim(),
        p_nickname: addForm.nickname.trim() || null,
        p_email: addForm.email.trim(),
        p_role: addForm.role,
        p_school_id: addForm.school_id,
        p_class_ids: addForm.class_ids,
        p_approved: true,
      })
      if (assignError || Number(assigned?.assigned_class_count ?? 0) !== addForm.class_ids.length) {
        setAdding(false)
        setAddError('계정은 생성됐지만 담당 학급 배정을 완료하지 못했습니다. 회원 목록에서 다시 배정해 주세요.')
        await load()
        return
      }
    }
    setAdding(false)
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
    const q = search.toLowerCase()
    if (!q) return true
    return (m.display_name ?? '').toLowerCase().includes(q)
      || (m.school_name ?? '').toLowerCase().includes(q)
      || (m.email ?? '').toLowerCase().includes(q)
      || (m.nickname ?? '').toLowerCase().includes(q)
  })

  const pendingCount = members.filter(m => !m.approved).length

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>

      {/* 회원 전체 편집 모달 */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setEditModal(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', maxHeight: '92vh', overflowY: 'auto' }}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>회원 정보 수정</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {ROLE_LABELS[editModal.role] ?? editModal.role} · 가입 {formatDate(editModal.created_at)}
            </p>

            <div className="form-group">
              <label className="form-label">이름 *</label>
              <input className="form-input" value={editForm.display_name}
                onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} placeholder="홍길동" />
            </div>
            <div className="form-group">
              <label className="form-label">이메일 (로그인 ID)</label>
              <input className="form-input" type="email" value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="user@school.hs.kr" />
            </div>
            <div className="form-group">
              <label className="form-label">닉네임 <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>전국 랭킹용</span></label>
              <input className="form-input" value={editForm.nickname}
                onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))} placeholder="랭킹에 표시될 별명" />
            </div>
            <div className="form-group">
              <label className="form-label">역할 *</label>
              <select className="form-input" value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value, class_id: '', class_ids: [] }))}>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">소속 학교</label>
              <select className="form-input" value={editForm.school_id}
                onChange={e => setEditForm(f => ({ ...f, school_id: e.target.value, class_id: '', class_ids: [] }))}>
                <option value="">미배정</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* 학생: 학과→학년→학반 */}
            {editForm.role === 'student' && editForm.school_id && (
              <>
                <div className="form-group">
                  <label className="form-label">학과 *</label>
                  <select className="form-input" value={editDept} disabled={editDepts.length === 0}
                    onChange={e => { setEditDept(e.target.value); setEditGrade(''); setEditForm(f => ({ ...f, class_id: '' })) }}>
                    <option value="">{editDepts.length === 0 ? '학과 없음' : '학과 선택'}</option>
                    {editDepts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">학년 *</label>
                  <select className="form-input" value={editGrade} disabled={!editDept}
                    onChange={e => { setEditGrade(e.target.value); setEditForm(f => ({ ...f, class_id: '' })) }}>
                    <option value="">{!editDept ? '학과를 먼저 선택' : '학년 선택'}</option>
                    {editGrades.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">학반 *</label>
                  <select className="form-input" value={editForm.class_id} disabled={!editGrade}
                    onChange={e => setEditForm(f => ({ ...f, class_id: e.target.value }))}>
                    <option value="">{!editGrade ? '학년을 먼저 선택' : '학반 선택'}</option>
                    {editClassOptions.map(c => <option key={c.id} value={c.id}>{c.class_num}반</option>)}
                  </select>
                </div>
              </>
            )}

            {MULTI_CLASS_ROLES.has(editForm.role) && editForm.school_id && (
              <fieldset className="form-group" style={{ border: 0, padding: 0 }}>
                <legend className="form-label">담당 학급</legend>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>미션·수업·첨삭·상담에 사용할 학급을 모두 선택하세요.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {editClasses.map(c => {
                    const checked = editForm.class_ids.includes(c.id)
                    return (
                      <label key={c.id} className="class-assignment-option">
                        <input type="checkbox" checked={checked} onChange={() => setEditForm(f => ({
                          ...f,
                          class_ids: checked ? f.class_ids.filter(id => id !== c.id) : [...f.class_ids, c.id],
                        }))} />
                        <span>{c.department ? `${c.department} ` : ''}{c.grade ? `${c.grade}학년 ` : ''}{c.class_num ? `${c.class_num}반` : c.name}</span>
                      </label>
                    )
                  })}
                  {editClasses.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>등록된 학급이 없습니다.</span>}
                </div>
              </fieldset>
            )}

            {editError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{editError}</p>}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditModal(null)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMemberEdit} disabled={editSaving}>
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 추가 작업: 비밀번호 재설정 · 학습이력 */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>🔑 비밀번호 재설정</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="text" value={pwValue} style={{ flex: 1 }}
                  onChange={e => { setPwValue(e.target.value); setPwMsg('') }} placeholder="새 임시 비밀번호 (6자 이상)" />
                <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap', color: 'var(--danger)' }}
                  onClick={resetPassword} disabled={pwSaving}>
                  {pwSaving ? '...' : '재설정'}
                </button>
              </div>
              {pwMsg && <p style={{ fontSize: 12, marginTop: 6, color: pwMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', wordBreak: 'break-all' }}>{pwMsg}</p>}

              {editModal.role === 'student' && (
                <button className="btn btn-ghost btn-full" style={{ marginTop: 12, fontSize: 13 }}
                  onClick={() => openHistory(editModal)}>
                  📊 학습 이력 보기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 학습 이력 모달 */}
      {historyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryModal(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>📊 {historyModal.display_name} 학습 이력</p>
              <button onClick={() => setHistoryModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {historyLoading && <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>}

            {historyData && (
              <>
                <p className="section-title" style={{ marginTop: 4 }}>📝 미션 제출 ({historyData.submissions.length})</p>
                {historyData.submissions.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0 12px' }}>제출 내역이 없습니다.</p>
                )}
                {historyData.submissions.map(s => (
                  <div key={s.id} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>{s.title}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {s.score}/{s.total_questions}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {s.mission_type} · {s.grading_status === 'pending' ? '채점대기' : s.grading_status === 'graded' ? '채점완료' : '자동채점'} · {formatDate(s.completed_at)}
                    </p>
                  </div>
                ))}

                <p className="section-title" style={{ marginTop: 12 }}>🧪 모의평가 ({historyData.mocks.length})</p>
                {historyData.mocks.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0 12px' }}>응시 내역이 없습니다.</p>
                )}
                {historyData.mocks.map(mk => (
                  <div key={mk.id} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>{mk.title}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {mk.auto_score}/{mk.auto_total}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {mk.kind === 'exam' ? '과목별 모의고사' : '영역별 모의평가'} · {mk.grading_status === 'pending' ? '채점대기' : mk.grading_status === 'graded' ? '채점완료' : '자동채점'} · {formatDate(mk.created_at)}
                    </p>
                  </div>
                ))}
                <div style={{ height: 8 }} />
              </>
            )}
          </div>
        </div>
      )}

      {/* 일괄 등록 모달 */}
      {bulkModal && (
        <BulkRegisterModal
          schools={schools}
          onClose={() => setBulkModal(false)}
          onDone={() => { setBulkModal(false); load() }}
        />
      )}

      {/* 회원 생성 모달 */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}>
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
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value, class_id: '', class_ids: [] }))}>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">학교 *</label>
              <select className="form-input" value={addForm.school_id}
                onChange={e => setAddForm(f => ({ ...f, school_id: e.target.value, class_id: '', class_ids: [] }))}>
                <option value="">학교 선택</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

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

            {MULTI_CLASS_ROLES.has(addForm.role) && addForm.school_id && (
              <fieldset className="form-group" style={{ border: 0, padding: 0 }}>
                <legend className="form-label">담당 학급</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {addAllClasses.map(c => {
                    const checked = addForm.class_ids.includes(c.id)
                    return (
                      <label key={c.id} className="class-assignment-option">
                        <input type="checkbox" checked={checked} onChange={() => setAddForm(f => ({
                          ...f,
                          class_ids: checked ? f.class_ids.filter(id => id !== c.id) : [...f.class_ids, c.id],
                        }))} />
                        <span>{c.department ? `${c.department} ` : ''}{c.grade ? `${c.grade}학년 ` : ''}{c.class_num ? `${c.class_num}반` : c.name}</span>
                      </label>
                    )
                  })}
                  {addAllClasses.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>등록된 학급이 없습니다.</span>}
                </div>
              </fieldset>
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
          <p className="section-title" style={{ margin: 0 }}>회원 관리 ({members.length}명)</p>
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
        placeholder="이름·이메일·닉네임·학교로 검색..." style={{ marginBottom: 8 }} />
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

      {filtered.map(m => {
        const cls = classLabel(m)
        return (
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
                {m.email && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>✉️ {m.email}</p>
                )}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  🏫 {m.school_name ?? '학교 미배정'}{cls ? ` · ${cls}` : ''}
                </p>
                {m.nickname && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>🏷 {m.nickname}</p>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  가입: {formatDate(m.created_at)}
                </p>
              </div>
              <button onClick={() => deleteMember(m.id, m.display_name)}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: 4, minHeight: 44, minWidth: 44 }}>
                🗑
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 2, fontSize: 12, padding: '6px 0' }}
                onClick={() => openEdit(m)}>
                ✏️ 정보 수정
              </button>
              <button
                className={`btn ${m.approved ? 'btn-ghost' : 'btn-primary'}`}
                style={{ flex: 1, fontSize: 12, padding: '6px 0', color: m.approved ? 'var(--danger)' : undefined }}
                onClick={() => toggleApprove(m)}>
                {m.approved ? '✗ 승인취소' : '✓ 승인'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
