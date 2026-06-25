import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase.js'

const EDUCATION_OFFICES = [
  '서울특별시교육청', '부산광역시교육청', '대구광역시교육청', '인천광역시교육청',
  '광주광역시교육청', '대전광역시교육청', '울산광역시교육청', '세종특별자치시교육청',
  '경기도교육청', '강원특별자치도교육청', '충청북도교육청', '충청남도교육청',
  '전북특별자치도교육청', '전라남도교육청', '경상북도교육청', '경상남도교육청',
  '제주특별자치도교육청',
]

const TABS = [
  { id: 'student', label: '학생 가입' },
  { id: 'teacher', label: '교사 가입' },
]

const COURSES = [
  { icon: '🏅', name: '직업공통능력', desc: '교육부 인증평가 대비' },
  { icon: '📖', name: '직업기초능력', desc: '공채 필기시험 대비 · 9개 영역 311문항' },
  { icon: '🍽️', name: '도제학교 외부평가 — 식음료서비스', desc: 'NCS 기반 이론 560문항' },
  { icon: '⚙️', name: '도제학교 외부평가 — 품질경영', desc: 'ISO · KS 품질관리 이론' },
  { icon: '🎤', name: '고졸취업 면접스킬', desc: '자소서 작성 · 면접 핵심 전략' },
]

const FEATURES = [
  { icon: '🎯', text: '교사 미션 · 학급 관리' },
  { icon: '🏆', text: '학급 · 전국 랭킹' },
  { icon: '📝', text: '오답노트' },
  { icon: '🔥', text: '학습 스트릭' },
  { icon: '🌙', text: '다크모드' },
  { icon: '📡', text: '오프라인 지원' },
]

export default function LoginScreen() {
  const [view,     setView]    = useState('landing') // 'landing' | 'login' | 'signup'
  const [tab,      setTab]     = useState('student')
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

  const submitFn = view === 'login' ? handleLogin
    : tab === 'student' ? handleStudentJoin
    : handleTeacherJoin

  // ── 랜딩 화면 ──
  const isNative = Capacitor.isNativePlatform()

  if (view === 'landing') return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #4C1D95 0%, #6D28D9 45%, #92400E 100%)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', padding: '52px 24px 24px' }}>
        <img src="/icons/icon-192.png" alt="설탕과소금"
          style={{ width: 80, height: 80, borderRadius: 22, marginBottom: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }} />
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.5 }}>설탕과소금</h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          달콤한 취업 성공을 위한 짭짤한 실력 준비
        </p>
      </div>

      {/* 글래스 카드 */}
      <div style={{ margin: '0 16px', borderRadius: 22, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden' }}>
        {/* 과목 */}
        <div style={{ padding: '18px 20px 12px' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 14px', textTransform: 'uppercase' }}>학습 과목</p>
          {COURSES.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < COURSES.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* 앱 기능 */}
        <div style={{ padding: '14px 20px 18px' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px', textTransform: 'uppercase' }}>앱 기능</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 8px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isNative ? (
          <>
            <button onClick={() => { setView('login'); reset() }}
              style={{ width: '100%', padding: '15px', background: '#fff', color: '#5B21B6', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
              로그인
            </button>
            <button onClick={() => { setView('signup'); setTab('student'); reset() }}
              style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.13)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              회원가입
            </button>
          </>
        ) : (
          <a href="https://play.google.com/apps/internaltest/4701531516564569722"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '15px', background: '#fff', color: '#5B21B6', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', boxSizing: 'border-box' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3.18 23.76a2 2 0 0 0 2.2-.23l12.3-7.1-3.35-3.35L3.18 23.76z" fill="#EA4335"/>
              <path d="M22.38 10.27C21.88 9.9 18 7.6 5.38.23A2 2 0 0 0 3.18.47L14.33 11.6l8.05-1.33z" fill="#4285F4"/>
              <path d="M3.18.47A2 2 0 0 0 2 2.24v19.52a2 2 0 0 0 1.18 1.77l11.15-11.15L3.18.47z" fill="#34A853"/>
              <path d="M14.33 12l3.35 3.35 4.7-2.72a2 2 0 0 0 0-3.46l-4.7-2.7L14.33 12z" fill="#FBBC04"/>
            </svg>
            Google Play에서 설치
          </a>
        )}
      </div>

      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '24px 0 32px', lineHeight: 1.9 }}>
        설탕과소금 AI Digital Content Lab<br />특성화고 · 마이스터고 취업 학습 플랫폼
      </p>
    </div>
  )

  // ── 공통 헤더 (로그인/가입 뷰) ──
  const backBtn = (
    <button onClick={() => { setView('landing'); reset() }}
      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer', padding: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
      ← 처음으로
    </button>
  )

  // ── 로그인 화면 ──
  if (view === 'login') return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 40px', boxSizing: 'border-box', background: 'var(--bg)' }}>
      {backBtn}
      <div style={{ textAlign: 'center', margin: '16px 0 28px' }}>
        <img src="/icons/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 10 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>로그인</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>설탕과소금 계정으로 로그인하세요</p>
      </div>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input className="form-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="이메일 입력" autoComplete="email" />
        </div>
        <div className="form-group">
          <label className="form-label">비밀번호</label>
          <input className="form-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="비밀번호" autoComplete="current-password" />
        </div>
        {error && <div style={{ background: '#ffebee', border: '1px solid var(--danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p></div>}
        <button className="btn btn-primary btn-full" type="submit" disabled={loading || !email || !password}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )

  // ── 회원가입 화면 ──
  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 40px', boxSizing: 'border-box', background: 'var(--bg)' }}>
      {backBtn}
      <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
        <img src="/icons/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 10 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>회원가입</h1>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 24, background: 'var(--border)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} className="btn" onClick={() => { setTab(t.id); reset() }}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 13, background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: tab === t.id ? 'var(--shadow)' : 'none' }}>
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
            onChange={e => setPassword(e.target.value)} placeholder="6자 이상" minLength={6} autoComplete="new-password" />
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
          {loading ? '처리 중...' : tab === 'student' ? '학생으로 가입' : '교사로 가입'}
        </button>
      </form>
    </div>
  )
}
