import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const EDUCATION_OFFICES = [
  '서울특별시교육청', '부산광역시교육청', '대구광역시교육청', '인천광역시교육청',
  '광주광역시교육청', '대전광역시교육청', '울산광역시교육청', '세종특별자치시교육청',
  '경기도교육청', '강원특별자치도교육청', '충청북도교육청', '충청남도교육청',
  '전북특별자치도교육청', '전라남도교육청', '경상북도교육청', '경상남도교육청',
  '제주특별자치도교육청',
]

const TABS = [
  { id: 'login',   label: '로그인' },
  { id: 'student', label: '학생 가입' },
  { id: 'teacher', label: '교사 가입' },
]

export default function LoginScreen() {
  const [tab,      setTab]     = useState('login')
  const [email,    setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')
  const [success,  setSuccess] = useState('')

  const [schools,         setSchools]         = useState([])
  const [studentOffice,   setStudentOffice]   = useState('')
  const [teacherOffice,   setTeacherOffice]   = useState('')

  // 학생 가입
  const [displayName,   setDisplayName]   = useState('')
  const [nickname,      setNickname]      = useState('')
  const [studentSchool, setStudentSchool] = useState('')
  const [allClasses,    setAllClasses]    = useState([])
  const [selectedDept,  setSelectedDept]  = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')

  // 교사 가입
  const [teacherName,    setTeacherName]    = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')

  useEffect(() => {
    supabase.from('schools').select('id, name, region, education_office').order('name').then(({ data }) => {
      setSchools(data ?? [])
      if (data?.length === 1) setSelectedSchool(data[0].id)
    })
  }, [])

  // 학교 선택 시 해당 학교 전체 학급 로드
  useEffect(() => {
    if (!studentSchool) {
      setAllClasses([]); setSelectedDept(''); setSelectedGrade(''); setSelectedClass('')
      return
    }
    supabase.from('classes')
      .select('id, department, grade, class_num')
      .eq('school_id', studentSchool)
      .order('department').order('grade').order('class_num')
      .then(({ data }) => {
        setAllClasses(data ?? [])
        setSelectedDept(''); setSelectedGrade(''); setSelectedClass('')
      })
  }, [studentSchool])

  // 파생 목록 (클라이언트 필터링)
  const depts = [...new Set(allClasses.map(c => c.department).filter(Boolean))].sort()
  const grades = [...new Set(
    allClasses.filter(c => c.department === selectedDept).map(c => c.grade).filter(Boolean)
  )].sort((a, b) => a - b)
  const classOptions = allClasses.filter(
    c => c.department === selectedDept && String(c.grade) === selectedGrade
  )

  function reset() { setError(''); setSuccess('') }

  function fmtErr(err) {
    if (!err) return ''
    const msg = typeof err === 'string' ? err : (err.message ?? JSON.stringify(err))
    if (msg.includes('Invalid login credentials'))  return '이메일 또는 비밀번호가 틀렸습니다.'
    if (msg.includes('Email not confirmed'))        return '이메일 인증이 완료되지 않았습니다.'
    if (msg.includes('User already registered'))    return '이미 가입된 이메일입니다. 로그인 탭을 이용하세요.'
    if (msg.includes('Password should be'))         return '비밀번호는 6자 이상이어야 합니다.'
    return msg
  }

  async function handleLogin(e) {
    e.preventDefault(); reset(); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(fmtErr(err))
    setLoading(false)
  }

  async function handleStudentJoin(e) {
    e.preventDefault(); reset()
    if (!studentSchool)      { setError('학교를 선택하세요.'); return }
    if (!selectedDept)       { setError('학과를 선택하세요.'); return }
    if (!selectedGrade)      { setError('학년을 선택하세요.'); return }
    if (!selectedClass)      { setError('학반을 선택하세요.'); return }
    if (!displayName.trim()) { setError('이름을 입력하세요.'); return }
    setLoading(true)

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) { setError(fmtErr(signUpErr)); setLoading(false); return }

    if (!signUpData?.session) {
      setError('⚠️ 이메일 인증이 활성화되어 있습니다.\nSupabase → Authentication → "Confirm email" OFF 후 다시 시도하세요.')
      setLoading(false); return
    }

    const { error: rpcErr } = await supabase.rpc('rpc_student_join', {
      p_display_name: displayName.trim(),
      p_nickname:     nickname.trim() || null,
      p_class_id:     selectedClass,
    })
    if (rpcErr) { setError(fmtErr(rpcErr)); setLoading(false); return }

    setSuccess('가입 완료! 선생님의 승인 후 사용할 수 있습니다.')
    setLoading(false)
  }

  async function handleTeacherJoin(e) {
    e.preventDefault(); reset()
    if (!teacherName.trim()) { setError('이름을 입력하세요.'); return }
    if (!selectedSchool)     { setError('학교를 선택하세요.'); return }
    setLoading(true)

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) { setError(fmtErr(signUpErr)); setLoading(false); return }

    if (!signUpData?.session) {
      setError('⚠️ 이메일 인증이 활성화되어 있습니다.\nSupabase → Authentication → "Confirm email" OFF 후 다시 시도하세요.')
      setLoading(false); return
    }

    const { error: rpcErr } = await supabase.rpc('rpc_create_teacher_profile', {
      p_display_name: teacherName.trim(),
      p_school_id:    selectedSchool,
    })
    if (rpcErr) { setError(fmtErr(rpcErr)); setLoading(false); return }

    setSuccess('가입 신청 완료! 학교관리자의 승인 후 사용할 수 있습니다.')
    setLoading(false)
  }

  const submitFn = tab === 'login' ? handleLogin
    : tab === 'student' ? handleStudentJoin
    : handleTeacherJoin

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '32px 24px', boxSizing: 'border-box', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 6 }}>🎓</div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>설탕과소금</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 3 }}>달콤한 취업 성공을 위한 짭짤한 실력 준비</p>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 24, background: 'var(--border)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} className="btn" onClick={() => { setTab(t.id); reset() }}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 13,
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: tab === t.id ? 'var(--shadow)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submitFn}>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input className="form-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="이메일 입력" autoComplete="email" />
        </div>
        <div className="form-group">
          <label className="form-label">비밀번호</label>
          <input className="form-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={tab === 'login' ? '비밀번호' : '6자 이상'}
            minLength={tab === 'login' ? undefined : 6}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
        </div>

        {tab === 'student' && (
          <>
            <div className="form-group">
              <label className="form-label">교육청</label>
              <select className="form-input" value={studentOffice}
                onChange={e => { setStudentOffice(e.target.value); setStudentSchool('') }}>
                <option value="">전체 교육청</option>
                {EDUCATION_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">학교 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-input" value={studentSchool}
                onChange={e => setStudentSchool(e.target.value)}>
                <option value="">학교 선택</option>
                {schools
                  .filter(s => !studentOffice || s.education_office === studentOffice)
                  .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">학과 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-input" value={selectedDept}
                disabled={!studentSchool || depts.length === 0}
                onChange={e => { setSelectedDept(e.target.value); setSelectedGrade(''); setSelectedClass('') }}>
                <option value="">
                  {!studentSchool ? '학교를 먼저 선택' : depts.length === 0 ? '학과 없음' : '학과 선택'}
                </option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">학년 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-input" value={selectedGrade}
                disabled={!selectedDept}
                onChange={e => { setSelectedGrade(e.target.value); setSelectedClass('') }}>
                <option value="">{!selectedDept ? '학과를 먼저 선택' : '학년 선택'}</option>
                {grades.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">학반 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-input" value={selectedClass}
                disabled={!selectedGrade}
                onChange={e => setSelectedClass(e.target.value)}>
                <option value="">{!selectedGrade ? '학년을 먼저 선택' : '학반 선택'}</option>
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.class_num}반</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">이름 (출석부 이름) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" value={displayName}
                onChange={e => setDisplayName(e.target.value)} placeholder="홍길동" />
            </div>

            <div className="form-group">
              <label className="form-label">닉네임
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>전국 랭킹용, 선택</span>
              </label>
              <input className="form-input" value={nickname}
                onChange={e => setNickname(e.target.value)} placeholder="랭킹에 표시될 별명" />
            </div>
          </>
        )}

        {tab === 'teacher' && (
          <>
            <div className="form-group">
              <label className="form-label">이름 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" value={teacherName}
                onChange={e => setTeacherName(e.target.value)} placeholder="선생님 성함" />
            </div>
            <div className="form-group">
              <label className="form-label">교육청</label>
              <select className="form-input" value={teacherOffice}
                onChange={e => { setTeacherOffice(e.target.value); setSelectedSchool('') }}>
                <option value="">전체 교육청</option>
                {EDUCATION_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">학교 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-input" value={selectedSchool}
                onChange={e => setSelectedSchool(e.target.value)}>
                <option value="">학교 선택</option>
                {schools
                  .filter(s => !teacherOffice || s.education_office === teacherOffice)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </div>
            <div className="card" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.6 }}>
                ℹ️ 가입 후 학교관리자의 승인을 받아야 사용할 수 있습니다.<br />
                소속 학교가 목록에 없으면 관리자에게 문의하세요.
              </p>
            </div>
          </>
        )}

        {success && (
          <div style={{ background: '#e8f5e9', border: '1px solid var(--success)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: '#1b5e20', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{success}</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#ffebee', border: '1px solid var(--danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--danger)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{error}</p>
          </div>
        )}

        <button className="btn btn-primary btn-full" type="submit"
          disabled={loading || !email || !password}>
          {loading ? '처리 중...'
            : tab === 'login' ? '로그인'
            : tab === 'student' ? '학생으로 가입'
            : '교사로 가입'}
        </button>
      </form>
    </div>
  )
}
