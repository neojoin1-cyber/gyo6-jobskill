import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

const EDUCATION_OFFICES = [
  '서울특별시교육청', '부산광역시교육청', '대구광역시교육청', '인천광역시교육청',
  '광주광역시교육청', '대전광역시교육청', '울산광역시교육청', '세종특별자치시교육청',
  '경기도교육청', '강원특별자치도교육청', '충청북도교육청', '충청남도교육청',
  '전북특별자치도교육청', '전라남도교육청', '경상북도교육청', '경상남도교육청',
  '제주특별자치도교육청',
]

export default function SchoolsScreen() {
  const [schools,         setSchools]         = useState([])
  const [memberCounts,    setMemberCounts]     = useState({})
  const [loading,         setLoading]          = useState(true)
  const [showForm,        setShowForm]         = useState(false)
  const [form,            setForm]             = useState({
    name: '', region: '', education_office: '', national_ranking_opt_in: false,
    max_members: 500, max_teachers: 30,
  })
  const [saving,          setSaving]           = useState(false)
  const [error,           setError]            = useState('')
  const [allCourses,      setAllCourses]       = useState([])
  const [schoolCourses,   setSchoolCourses]    = useState({})
  const [courseSaving,    setCourseSaving]     = useState(null)
  const [expandedCourses, setExpandedCourses]  = useState(null)
  const [assignModal,     setAssignModal]      = useState(null)
  const [assignEmail,     setAssignEmail]      = useState('')
  const [assignName,      setAssignName]       = useState('')
  const [assigning,       setAssigning]        = useState(false)
  const [assignError,     setAssignError]      = useState('')
  const [schoolAdmins,    setSchoolAdmins]     = useState({})
  const [quotaModal,      setQuotaModal]       = useState(null)
  const [quotaForm,       setQuotaForm]        = useState({ max_members: 500, max_teachers: 30 })
  const [quotaSaving,     setQuotaSaving]      = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [
      { data: schoolData },
      { data: adminData },
      { data: subsData },
      { data: ssData },
      { data: countData },
    ] = await Promise.all([
      supabase.from('schools').select('id, name, region, education_office, national_ranking_opt_in, max_members, max_teachers, created_at').order('name'),
      supabase.from('profiles').select('id, display_name, school_id').in('role', ['school_admin']),
      supabase.from('courses').select('id, name').order('sort_order'),
      supabase.from('school_courses').select('school_id, course_id'),
      supabase.from('school_member_counts').select('*'),
    ])
    setSchools(schoolData ?? [])
    setAllCourses(subsData ?? [])

    const adminMap = {}
    for (const a of adminData ?? []) {
      if (!adminMap[a.school_id]) adminMap[a.school_id] = []
      adminMap[a.school_id].push(a)
    }
    setSchoolAdmins(adminMap)

    const ssMap = {}
    for (const ss of ssData ?? []) {
      if (!ssMap[ss.school_id]) ssMap[ss.school_id] = new Set()
      ssMap[ss.school_id].add(ss.course_id)
    }
    setSchoolCourses(ssMap)

    const cntMap = {}
    for (const c of countData ?? []) cntMap[c.school_id] = c
    setMemberCounts(cntMap)

    setLoading(false)
  }

  // ── 교과목 배정 토글 ────────────────────────────────────────────────────────
  async function toggleSchoolCourse(schoolId, courseId) {
    const key = `${schoolId}-${courseId}`
    setCourseSaving(key)
    const has = schoolCourses[schoolId]?.has(courseId)
    if (has) {
      await supabase.from('school_courses').delete().eq('school_id', schoolId).eq('course_id', courseId)
      setSchoolCourses(prev => {
        const next = { ...prev, [schoolId]: new Set(prev[schoolId]) }
        next[schoolId].delete(courseId)
        return next
      })
    } else {
      await supabase.from('school_courses').insert({ school_id: schoolId, course_id: courseId })
      setSchoolCourses(prev => ({
        ...prev, [schoolId]: new Set([...(prev[schoolId] ?? []), courseId])
      }))
    }
    setCourseSaving(null)
  }

  // ── 전국랭킹 토글 ───────────────────────────────────────────────────────────
  async function toggleRanking(school) {
    await supabase.from('schools')
      .update({ national_ranking_opt_in: !school.national_ranking_opt_in })
      .eq('id', school.id)
    setSchools(prev => prev.map(s =>
      s.id === school.id ? { ...s, national_ranking_opt_in: !s.national_ranking_opt_in } : s
    ))
  }

  // ── 학교 삭제 ───────────────────────────────────────────────────────────────
  async function deleteSchool(id, name) {
    if (!window.confirm(`"${name}"을 삭제할까요?\n소속 학급/미션/학생 데이터도 함께 삭제됩니다.`)) return
    const { error: err } = await supabase.from('schools').delete().eq('id', id)
    if (err) { alert('삭제 오류: ' + err.message); return }
    setSchools(prev => prev.filter(s => s.id !== id))
  }

  // ── 학교 추가 ───────────────────────────────────────────────────────────────
  async function saveSchool(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('학교명을 입력하세요.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('schools').insert({
      name: form.name.trim(),
      region: form.region.trim() || null,
      education_office: form.education_office || null,
      national_ranking_opt_in: form.national_ranking_opt_in,
      max_members: Number(form.max_members) || 500,
      max_teachers: Number(form.max_teachers) || 30,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ name: '', region: '', education_office: '', national_ranking_opt_in: false, max_members: 500, max_teachers: 30 })
    setShowForm(false)
    load()
  }

  // ── 쿼터 수정 ───────────────────────────────────────────────────────────────
  async function saveQuota(e) {
    e.preventDefault()
    setQuotaSaving(true)
    const { error: err } = await supabase.rpc('rpc_admin_set_quota', {
      p_school_id:    quotaModal.id,
      p_max_members:  Number(quotaForm.max_members),
      p_max_teachers: Number(quotaForm.max_teachers),
    })
    setQuotaSaving(false)
    if (err) { alert('쿼터 수정 오류: ' + err.message); return }
    setSchools(prev => prev.map(s =>
      s.id === quotaModal.id
        ? { ...s, max_members: Number(quotaForm.max_members), max_teachers: Number(quotaForm.max_teachers) }
        : s
    ))
    setQuotaModal(null)
  }

  // ── 학교관리자 지정 ─────────────────────────────────────────────────────────
  async function assignSchoolAdmin(e) {
    e.preventDefault()
    if (!assignEmail.trim() || !assignName.trim()) {
      setAssignError('이름과 이메일을 모두 입력하세요.'); return
    }
    setAssigning(true); setAssignError('')
    const { error: err } = await supabase.rpc('rpc_create_school_admin', {
      p_email:        assignEmail.trim(),
      p_display_name: assignName.trim(),
      p_school_id:    assignModal.id,
      p_uid:          null,
    })
    setAssigning(false)
    if (err) {
      const msg = err.message ?? ''
      setAssignError(
        msg.includes('찾을 수 없습니다')
          ? `"${assignEmail.trim()}" 계정이 없습니다.\n지정할 분이 먼저 [교사 가입]으로 가입해야 합니다.`
          : msg
      )
      return
    }
    setAssignModal(null); setAssignEmail(''); setAssignName('')
    alert(`✅ 학교관리자로 지정되었습니다.\n이메일: ${assignEmail.trim()}`)
    load()
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>

      {/* 쿼터 수정 모달 */}
      {quotaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 360 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>회원 쿼터 수정</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{quotaModal.name}</p>
            <div className="form-group">
              <label className="form-label">최대 학생 수</label>
              <input className="form-input" type="number" min={1} max={9999}
                value={quotaForm.max_members}
                onChange={e => setQuotaForm(f => ({ ...f, max_members: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">최대 교사 수</label>
              <input className="form-input" type="number" min={1} max={999}
                value={quotaForm.max_teachers}
                onChange={e => setQuotaForm(f => ({ ...f, max_teachers: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setQuotaModal(null)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveQuota} disabled={quotaSaving}>
                {quotaSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학교관리자 지정 모달 */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 380 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>학교관리자 지정</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{assignModal.name}</p>
            <div className="form-group">
              <label className="form-label">관리자 이름 *</label>
              <input className="form-input" value={assignName}
                onChange={e => setAssignName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="form-group">
              <label className="form-label">이메일 *</label>
              <input className="form-input" type="email" value={assignEmail}
                onChange={e => setAssignEmail(e.target.value)} placeholder="admin@school.hs.kr" />
            </div>
            <div className="card" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.6 }}>
                ① 지정할 분이 먼저 앱에서 <b>[교사 가입]</b>으로 가입<br />
                ② 여기서 이메일 입력 후 <b>[지정]</b> 클릭<br />
                → 해당 계정이 학교관리자로 자동 승격됩니다.
              </p>
            </div>
            {assignError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                {assignError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => { setAssignModal(null); setAssignEmail(''); setAssignName(''); setAssignError('') }}>
                취소
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={assignSchoolAdmin} disabled={assigning}>
                {assigning ? '처리 중...' : '지정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 8px' }}>
        <p className="section-title" style={{ margin: 0 }}>학교 목록 ({schools.length})</p>
        <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}
          onClick={() => setShowForm(v => !v)}>
          {showForm ? '취소' : '+ 학교 추가'}
        </button>
      </div>

      {/* 학교 추가 폼 */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
          <p style={{ fontWeight: 700, marginBottom: 12 }}>새 학교 등록</p>
          <div className="form-group">
            <label className="form-label">학교명 *</label>
            <input className="form-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="○○고등학교" />
          </div>
          <div className="form-group">
            <label className="form-label">교육청</label>
            <select className="form-input" value={form.education_office}
              onChange={e => setForm(f => ({ ...f, education_office: e.target.value }))}>
              <option value="">교육청 선택</option>
              {EDUCATION_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">지역 (상세)</label>
            <input className="form-input" value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="예: 경상북도 경주시" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">최대 학생 수</label>
              <input className="form-input" type="number" min={1} value={form.max_members}
                onChange={e => setForm(f => ({ ...f, max_members: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">최대 교사 수</label>
              <input className="form-input" type="number" min={1} value={form.max_teachers}
                onChange={e => setForm(f => ({ ...f, max_teachers: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input type="checkbox" id="opt-in" checked={form.national_ranking_opt_in}
              onChange={e => setForm(f => ({ ...f, national_ranking_opt_in: e.target.checked }))} />
            <label htmlFor="opt-in" style={{ fontSize: 14 }}>전국 랭킹 참여 허용</label>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button className="btn btn-primary btn-full" onClick={saveSchool} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {schools.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">🏫</span>
          <span className="empty-state-title">등록된 학교가 없습니다</span>
        </div>
      )}

      {schools.map(s => {
        const admins = schoolAdmins[s.id] ?? []
        const cnt    = memberCounts[s.id]
        const teacherPct = cnt ? Math.round((cnt.teacher_count / s.max_teachers) * 100) : 0
        const studentPct = cnt ? Math.round((cnt.student_count / s.max_members) * 100) : 0

        return (
          <div key={s.id} className="card" style={{ marginBottom: 12 }}>
            {/* 학교 기본 정보 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700 }}>{s.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s.education_office || s.region || '교육청 미설정'}
                </p>
                {admins.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                    👤 학교관리자: {admins.map(a => a.display_name).join(', ')}
                  </p>
                )}
                {cnt?.pending_count > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--warning, #f59e0b)', marginTop: 4 }}>
                    ⏳ 승인 대기: {cnt.pending_count}명
                  </p>
                )}
              </div>
              <button onClick={() => deleteSchool(s.id, s.name)}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: 4 }}>
                🗑
              </button>
            </div>

            {/* 쿼터 게이지 */}
            {cnt && (
              <div style={{ marginTop: 10 }}>
                <QuotaBar label="교사" current={cnt.teacher_count} max={s.max_teachers} pct={teacherPct} />
                <QuotaBar label="학생" current={cnt.student_count} max={s.max_members} pct={studentPct} />
              </div>
            )}

            {/* 버튼 행 */}
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '7px 8px', fontSize: 12, minWidth: 90 }}
                onClick={() => { setAssignModal(s); setAssignError('') }}>
                👤 관리자 지정
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '7px 8px', fontSize: 12, minWidth: 90 }}
                onClick={() => {
                  setQuotaModal(s)
                  setQuotaForm({ max_members: s.max_members, max_teachers: s.max_teachers })
                }}>
                📊 쿼터 수정
              </button>
              <button className="btn btn-ghost" style={{
                flex: 1, padding: '7px 8px', fontSize: 12, minWidth: 90,
                color: s.national_ranking_opt_in ? 'var(--success)' : 'var(--text-muted)',
              }}
                onClick={() => toggleRanking(s)}>
                {s.national_ranking_opt_in ? '🌐 전국랭킹 ON' : '🔒 전국랭킹 OFF'}
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '7px 8px', fontSize: 12, minWidth: 90 }}
                onClick={() => setExpandedCourses(expandedCourses === s.id ? null : s.id)}>
                📚 과목배정 {expandedCourses === s.id ? '▲' : '▼'}
              </button>
            </div>

            {/* 교과목 배정 패널 */}
            {expandedCourses === s.id && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>배정 교과목</p>
                {allCourses.map(sub => {
                  const has = schoolCourses[s.id]?.has(sub.id)
                  const isSaving = courseSaving === `${s.id}-${sub.id}`
                  return (
                    <div key={sub.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 6, marginBottom: 4,
                      background: has ? 'var(--primary-light)' : 'var(--card)',
                      border: `1px solid ${has ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: has ? 700 : 400, color: has ? 'var(--primary)' : 'var(--text)' }}>
                        {sub.name}
                      </span>
                      <button
                        disabled={isSaving}
                        onClick={() => toggleSchoolCourse(s.id, sub.id)}
                        style={{
                          padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                          background: has ? 'var(--danger)' : 'var(--primary)',
                          color: '#fff', fontSize: 11, fontWeight: 700, opacity: isSaving ? 0.6 : 1,
                        }}>
                        {isSaving ? '...' : has ? '취소' : '배정'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function QuotaBar({ label, current, max, pct }) {
  const over = pct >= 100
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: over ? 'var(--danger)' : 'inherit' }}>
          {current} / {max} ({pct}%)
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${Math.min(pct, 100)}%`,
          background: over ? 'var(--danger)' : pct > 80 ? 'var(--warning, #f59e0b)' : 'var(--success)',
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}
