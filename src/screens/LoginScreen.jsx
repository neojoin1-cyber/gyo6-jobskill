import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { supabase } from '../lib/supabase.js'
import { pushBack, popBack } from '../lib/backButton.js'

/**
 * 역할별 첫인상.
 *
 * 학생과 교사가 같은 화면으로 들어오면, 도입을 검토하는 선생님에게
 * 보라색 게임 화면이 먼저 보인다. "애들 장난감"으로 읽히기 쉬워
 * 진입 시점부터 톤을 나눈다. 로그인 로직은 하나를 공유한다.
 */
const AUDIENCE = {
  student: {
    key: 'student',
    emoji: '🎒',
    pick: '학생이에요',
    pickDesc: '오늘 학습하고 XP 쌓기',
    bg: 'linear-gradient(160deg, #4C1D95 0%, #6D28D9 45%, #92400E 100%)',
    accent: '#5B21B6',
    onAccent: '#fff',
    title: '설탕과소금',
    sub: '달콤한 취업 성공을 위한 짭짤한 실력 준비',
    sectionLabel: '학습 과목',
  },
  teacher: {
    key: 'teacher',
    emoji: '🏫',
    pick: '선생님이에요',
    pickDesc: '학급 관리 · 수업자료 · 미션 배정',
    bg: 'linear-gradient(160deg, #0F2A44 0%, #14532D 60%, #0F3B33 100%)',
    accent: '#0F766E',
    onAccent: '#fff',
    title: '설탕과소금 교사용',
    sub: '교육부 인증 · NCS 기반 수업 운영과 학급 관리',
    sectionLabel: '수업에 쓰는 과목',
  },
}


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

const COURSES = globalThis.SUGAR_SALT_MARKETING_SUBJECTS ?? []

const FEATURES = [
  { icon: '🎯', text: '교사 미션 · 학급 관리' },
  { icon: '🏆', text: '학급 · 전국 랭킹' },
  { icon: '📝', text: '오답노트' },
  { icon: '🔥', text: '학습 스트릭' },
  { icon: '🌙', text: '다크모드' },
  { icon: '📡', text: '오프라인 지원' },
]

export default function LoginScreen() {
  const [view,          setView]         = useState('landing') // 'landing' | 'login' | 'signup' | 'reset'
  const [tab,           setTab]          = useState('student')
  const [email,         setEmail]        = useState('')
  const [password,      setPassword]     = useState('')
  const [loading,       setLoading]      = useState(false)
  const [audience,      setAudience]     = useState(null)   // 'student' | 'teacher'
  const [error,         setError]        = useState('')
  const [success,       setSuccess]      = useState('')
  const [showExitDialog, setShowExitDialog] = useState(false)

  // 비밀번호 재설정(인앱 OTP: 이메일→6자리 코드→새 비밀번호)
  const [resetStep,     setResetStep]    = useState('email') // 'email' | 'code'
  const [resetCode,     setResetCode]    = useState('')
  const [newPw,         setNewPw]        = useState('')
  const [newPw2,        setNewPw2]       = useState('')

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

  // 뒤로가기: login/signup → landing, landing → 종료 확인 (최신 상태를 ref로 읽어 1회 등록)
  const backRef = useRef(null)
  backRef.current = () => {
    if (view === 'reset') { setView('login'); setError(''); setSuccess(''); return }
    if (view === 'login' || view === 'signup') { setView('landing'); setError(''); setSuccess(''); return }
    if (view === 'landing' && audience) { setAudience(null); return }
    setShowExitDialog(true)
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
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
    if (!err) return '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.'
    // 다양한 에러 형태에서 메시지 추출 (빈 객체 '{}' 노출 방지)
    let msg = ''
    if (typeof err === 'string') msg = err
    else msg = err.message || err.error_description || err.error_message || err.error || err.msg || err.hint || err.details || ''
    if (typeof msg !== 'string') msg = ''
    msg = msg.trim()
    // 서버가 빈 본문(500 등)을 돌려주면 message 가 문자열 '{}' / '[]' / 'null'
    // 로 들어온다. 빈 객체는 막고 있었지만 이 문자열 형태는 그대로 통과해
    // 화면에 '{}' 가 노출됐다. 의미 없는 값은 메시지 없음으로 취급한다.
    if (/^(\{\s*\}|\[\s*\]|null|undefined|""|'')$/.test(msg)) msg = ''

    if (msg.includes('Invalid login credentials'))  return '이메일 또는 비밀번호가 틀렸습니다.'
    if (msg.includes('Email not confirmed'))        return '이메일 인증이 완료되지 않았습니다.'
    if (/Database error|querying schema|unexpected_failure/i.test(msg))
      return '계정에 일시적인 문제가 있어 로그인하지 못했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.'
    if (msg.includes('User already registered') || msg.includes('already been registered')) return '이미 가입된 이메일입니다. 로그인 탭을 이용하세요.'
    if (msg.includes('Password should be'))         return '비밀번호는 6자 이상이어야 합니다.'
    if (/Failed to fetch|NetworkError|fetch failed|Load failed|ERR_|ENOTFOUND|timeout/i.test(msg))
      return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
    if (msg) return msg

    // 메시지가 전혀 없는 경우(빈 객체 등) — 상태/코드 힌트 + 안내. 절대 '{}' 를 보여주지 않는다.
    const code = err.status ?? err.statusCode ?? err.code
    if (code === 0 || code === '0' || code == null)
      return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
    return `요청을 처리하지 못했습니다 (코드 ${code}). 잠시 후 다시 시도해 주세요.`
  }

  async function handleLogin(e) {
    e.preventDefault(); reset(); setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError(fmtErr(err))
    } catch (ex) {
      setError(fmtErr(ex))
    } finally {
      setLoading(false)
    }
  }

  async function handleStudentJoin(e) {
    e.preventDefault(); reset()
    if (!studentSchool)      { setError('학교를 선택하세요.'); return }
    if (!selectedDept)       { setError('학과를 선택하세요.'); return }
    if (!selectedGrade)      { setError('학년을 선택하세요.'); return }
    if (!selectedClass)      { setError('학반을 선택하세요.'); return }
    if (!displayName.trim()) { setError('이름을 입력하세요.'); return }
    setLoading(true)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email: email.trim(), password })
      if (signUpErr) { setError(fmtErr(signUpErr)); return }

      if (!signUpData?.session) {
        setError('가입 확인에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.')
        return
      }

      const { error: rpcErr } = await supabase.rpc('rpc_student_join', {
        p_display_name: displayName.trim(),
        p_nickname:     nickname.trim() || null,
        p_class_id:     selectedClass,
      })
      if (rpcErr) { setError(fmtErr(rpcErr)); return }

      setSuccess('가입 완료! 선생님의 승인 후 사용할 수 있습니다.')
    } catch (ex) {
      setError(fmtErr(ex))
    } finally {
      setLoading(false)
    }
  }

  async function handleTeacherJoin(e) {
    e.preventDefault(); reset()
    if (!teacherName.trim()) { setError('이름을 입력하세요.'); return }
    if (!selectedSchool)     { setError('학교를 선택하세요.'); return }
    setLoading(true)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email: email.trim(), password })
      if (signUpErr) { setError(fmtErr(signUpErr)); return }

      if (!signUpData?.session) {
        setError('가입 확인에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.')
        return
      }

      const { error: rpcErr } = await supabase.rpc('rpc_create_teacher_profile', {
        p_display_name: teacherName.trim(),
        p_school_id:    selectedSchool,
      })
      if (rpcErr) { setError(fmtErr(rpcErr)); return }

      setSuccess('가입 신청 완료! 학교관리자의 승인 후 사용할 수 있습니다.')
    } catch (ex) {
      setError(fmtErr(ex))
    } finally {
      setLoading(false)
    }
  }

  // ── 비밀번호 재설정 (인앱 OTP) ─────────────────────────────────────────────
  function openReset() {
    reset(); setResetStep('email'); setResetCode(''); setNewPw(''); setNewPw2('')
    setView('reset')
  }

  async function handleSendResetCode(e) {
    e.preventDefault(); reset()
    if (!email.trim()) { setError('이메일을 입력하세요.'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (err) { setError(fmtErr(err)); return }
      setResetStep('code')
      setSuccess('인증 코드를 이메일로 보냈습니다. 메일함(스팸함 포함)을 확인해 6자리 코드를 입력하세요.')
    } catch (ex) {
      setError(fmtErr(ex))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyReset(e) {
    e.preventDefault(); reset()
    if (!/^\d{6}$/.test(resetCode.trim())) { setError('이메일로 받은 6자리 코드를 입력하세요.'); return }
    if (newPw.length < 6)                  { setError('새 비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== newPw2)                  { setError('새 비밀번호가 서로 일치하지 않습니다.'); return }
    setLoading(true)
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: resetCode.trim(), type: 'recovery' })
      if (vErr) { setError(fmtErr(vErr)); return }
      const { error: uErr } = await supabase.auth.updateUser({ password: newPw })
      if (uErr) { setError(fmtErr(uErr)); return }
      setSuccess('비밀번호가 변경되었습니다. 잠시 후 자동으로 로그인됩니다.')
      // verifyOtp가 세션을 발급 → App이 자동 로그인 처리. 안전하게 뷰 정리.
    } catch (ex) {
      setError(fmtErr(ex))
    } finally {
      setLoading(false)
    }
  }

  const submitFn = view === 'login' ? handleLogin
    : tab === 'student' ? handleStudentJoin
    : handleTeacherJoin

  // ── 랜딩 화면 ──
  const isNative = Capacitor.isNativePlatform()

  // ── 역할 선택 (첫 화면) ──
  if (!audience) return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #1E1B4B 0%, #312E81 55%, #0F3B33 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="설탕과소금"
          style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>설탕과소금</h1>
        <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, margin: 0 }}>
          특성화고 · 마이스터고 취업 학습 플랫폼
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, width: '100%', margin: '0 auto' }}>
        {[AUDIENCE.student, AUDIENCE.teacher].map(a => (
          <button key={a.key} onClick={() => { setAudience(a.key); reset() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, width: '100%',
              minHeight: 88, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
              background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.28)',
              borderRadius: 18, color: '#fff',
            }}>
            <span style={{ fontSize: 34, lineHeight: 1 }}>{a.emoji}</span>
            <span style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{a.pick}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{a.pickDesc}</span>
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>›</span>
          </button>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 28, lineHeight: 1.6 }}>
        학교관리자·운영자도 선생님으로 들어오시면 됩니다
      </p>
    </div>
  )

  const A = AUDIENCE[audience] ?? AUDIENCE.student
  if (view === 'landing') return (
    <div style={{ height: '100dvh', background: A.bg, overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
      {/* 앱 종료 확인 다이얼로그 */}
      {showExitDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>앱을 종료할까요?</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>설탕과소금을 종료합니다.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowExitDialog(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={() => { setShowExitDialog(false); if (Capacitor.isNativePlatform()) CapApp.exitApp() }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#6D28D9', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                종료
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 헤더 */}
      <div style={{ textAlign: 'center', padding: '52px 24px 24px' }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="설탕과소금"
          style={{ width: 80, height: 80, borderRadius: 22, marginBottom: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }} />
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.5 }}>{A.title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          {A.sub}
        </p>
      </div>

      {/* 버튼 — 헤더 바로 아래 최상단 */}
      <div style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 로그인·회원가입은 웹·앱 모두에서 사용 가능(PWA). 웹에서도 직접 시연·테스트 가능. */}
        <button onClick={() => { setView('login'); reset() }}
          style={{ width: '100%', minHeight: 52, padding: '15px', background: '#fff', color: A.accent, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          로그인
        </button>
        <button onClick={() => { setView('signup'); setTab('student'); reset() }}
          style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.13)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          회원가입
        </button>
        {!isNative && (
          <>
            <a href="https://play.google.com/apps/internaltest/4701531516564569722"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3.18 23.76a2 2 0 0 0 2.2-.23l12.3-7.1-3.35-3.35L3.18 23.76z" fill="#EA4335"/>
                <path d="M22.38 10.27C21.88 9.9 18 7.6 5.38.23A2 2 0 0 0 3.18.47L14.33 11.6l8.05-1.33z" fill="#4285F4"/>
                <path d="M3.18.47A2 2 0 0 0 2 2.24v19.52a2 2 0 0 0 1.18 1.77l11.15-11.15L3.18.47z" fill="#34A853"/>
                <path d="M14.33 12l3.35 3.35 4.7-2.72a2 2 0 0 0 0-3.46l-4.7-2.7L14.33 12z" fill="#FBBC04"/>
              </svg>
              안드로이드 앱으로 설치 (Google Play)
            </a>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.74)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              ※ 웹에서도 바로 학습 가능 · 폰은 위 링크로 앱 설치
            </p>
          </>
        )}
      </div>

      {/* 글래스 카드 */}
      <div style={{ margin: '0 16px', borderRadius: 22, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden' }}>
        {/* 과목 */}
        <div style={{ padding: '18px 20px 12px' }}>
          <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 14px', textTransform: 'uppercase' }}>{A.sectionLabel}</p>
          {COURSES.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < COURSES.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* 앱 기능 */}
        <div style={{ padding: '14px 20px 18px' }}>
          <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px', textTransform: 'uppercase' }}>앱 기능</p>
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

      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '24px 0 0', paddingBottom: 'max(80px, env(safe-area-inset-bottom, 0px))', lineHeight: 1.9 }}>
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
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '24px 24px calc(120px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', background: 'var(--bg)' }}>
      {backBtn}
      <div style={{ textAlign: 'center', margin: '16px 0 28px' }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 10 }} />
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
      <button onClick={openReset}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'block', margin: '16px auto 0', textDecoration: 'underline' }}>
        비밀번호를 잊으셨나요?
      </button>
    </div>
  )

  // ── 비밀번호 재설정 화면 (인앱 OTP) ──
  if (view === 'reset') return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '24px 24px calc(120px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', background: 'var(--bg)' }}>
      <button onClick={() => { setView('login'); reset() }}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer', padding: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        ← 로그인으로
      </button>
      <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>비밀번호 재설정</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {resetStep === 'email' ? '가입한 이메일로 인증 코드를 보내드립니다' : '이메일로 받은 6자리 코드와 새 비밀번호를 입력하세요'}
        </p>
      </div>

      {resetStep === 'email' ? (
        <form onSubmit={handleSendResetCode}>
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="가입한 이메일" autoComplete="email" />
          </div>
          {error && <div style={{ background: '#ffebee', border: '1px solid var(--danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p></div>}
          {success && <div style={{ background: '#e8f5e9', border: '1px solid var(--success)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: 'var(--success)', margin: 0 }}>{success}</p></div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading || !email}>
            {loading ? '전송 중...' : '인증 코드 받기'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyReset}>
          {success && <div style={{ background: '#e8f5e9', border: '1px solid var(--success)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: 'var(--success)', margin: 0, lineHeight: 1.6 }}>{success}</p></div>}
          <div className="form-group">
            <label className="form-label">인증 코드 (6자리)</label>
            <input className="form-input" type="text" inputMode="numeric" maxLength={6} value={resetCode}
              onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="예: 123456"
              style={{ letterSpacing: 4, fontSize: 18, textAlign: 'center' }} />
          </div>
          <div className="form-group">
            <label className="form-label">새 비밀번호</label>
            <input className="form-input" type="password" value={newPw}
              onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">새 비밀번호 확인</label>
            <input className="form-input" type="password" value={newPw2}
              onChange={e => setNewPw2(e.target.value)} placeholder="다시 입력" autoComplete="new-password" />
          </div>
          {error && <div style={{ background: '#ffebee', border: '1px solid var(--danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p></div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading || !resetCode || !newPw || !newPw2}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
          <button type="button" onClick={handleSendResetCode} disabled={loading}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'block', margin: '14px auto 0', textDecoration: 'underline' }}>
            코드를 못 받으셨나요? 다시 보내기
          </button>
        </form>
      )}
    </div>
  )

  // ── 회원가입 화면 ──
  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '24px 24px calc(120px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', background: 'var(--bg)' }}>
      {backBtn}
      <div style={{ textAlign: 'center', margin: '16px 0 24px' }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 10 }} />
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
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>전국 랭킹용, 선택</span>
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
