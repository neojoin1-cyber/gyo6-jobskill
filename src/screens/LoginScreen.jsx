import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { supabase } from '../lib/supabase.js'
import { pushBack, popBack } from '../lib/backButton.js'
import {
  TRIAL_ACCOUNTS,
  PUBLIC_WEB_TRIAL_ENABLED,
  beginTrialSession,
  consumeTrialNotice,
  requestTrialToken,
  requestedTrialRole,
  trialStartAvailability,
} from '../lib/trialSession.js'

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

function JobgoLanding({ email, setEmail, password, setPassword, handleLogin, loading, error, success, openReset, onSchoolSignup }) {
  return (
    <main className="jobgo-landing">
      <header className="jobgo-landing-header">
        <a className="jobgo-landing-brand" href="https://gyo6.kr/" aria-label="설탕과소금 홈">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <span><small>설탕과소금</small><strong>스킬캠퍼스 / JOB고</strong></span>
        </a>
        <nav aria-label="JOB고 주요 메뉴">
          <a href="https://app.gyo6.kr/school-adoption">학교 도입 신청</a>
          <a href="https://app.gyo6.kr/school-adoption">JOB고 소개</a>
          <a href="https://app.gyo6.kr/school-materials/member-registration-guide">학생 메뉴얼</a>
          <a href="https://app.gyo6.kr/school-materials/member-registration-guide">선생님 메뉴얼</a>
          <a href="https://app.gyo6.kr/school-materials/member-registration-guide">학교관리자 메뉴얼</a>
          <a href="https://app.gyo6.kr/school-materials/member-registration-guide">회원등록 서식</a>
        </nav>
        <a className="jobgo-landing-jobs" href="https://gyo6.kr/jobs.html">고졸 채용 정보 <span>↗</span></a>
      </header>

      <section className="jobgo-landing-hero" aria-labelledby="jobgo-landing-title">
        <div className="jobgo-landing-copy">
          <p className="jobgo-landing-kicker">K-12 학교를 위한 안전한 진로 · 역량 학습 플랫폼</p>
          <h1 id="jobgo-landing-title" className="jobgo-landing-title-art" aria-label="직업공통능력 인증평가, 고졸 공채 필기 NCS, 자기소개서와 실전 면접 대비">
            <span className="jobgo-landing-title-ribbon">직업공통능력 인증평가</span>
            <span className="jobgo-landing-title-line jobgo-landing-title-pop">고졸 공채 필기 <em>(NCS)</em></span>
            <span className="jobgo-landing-title-line jobgo-landing-title-script">자기소개서</span>
            <span className="jobgo-landing-title-line jobgo-landing-title-accent">실전 면접 대비</span>
          </h1>
          <p className="jobgo-landing-lead">실제 현장의 다양한 역할을 바탕으로, 학생은 스스로 탐색하고 선생님은 깊이 있는 수업을, 학교는 안전한 학습 환경을 만듭니다.</p>
          <div className="jobgo-landing-actions">
            <a className="jobgo-landing-primary" href="https://app.gyo6.kr/school-materials/member-registration-guide">교재 공개<br />체험하기</a>
            <button className="jobgo-landing-secondary" type="button" onClick={onSchoolSignup}>관리자·선생님·기존 계정<br />로그인창 열기</button>
          </div>
          <p className="jobgo-landing-note">교재 공개 견본은 로그인·시간 제한 없이 읽고, 문제를 풀고, 작성 활동까지 경험할 수 있습니다. 학교 전체 체험은 자료 보호 원칙에 따라 잠겨 있습니다.</p>
          <a className="jobgo-landing-text-link" href="https://app.gyo6.kr/school-materials/member-registration-guide">JOB고 교재 공개 체험 시작하기 →</a>
        </div>

        <div className="jobgo-landing-visual">
          <a className="jobgo-landing-visual-image-link" href="https://app.gyo6.kr/school-adoption" aria-label="학교 도입 신청">
            <img src="https://gyo6.kr/assets/platform-hero-vocational.png" alt="선생님과 특성화고 학생들이 함께 취업 역량을 배우는 교실" />
          </a>
          <a className="jobgo-landing-badge" href="https://app.gyo6.kr/school-adoption" aria-label="학교장터 등록 상품 학교 도입 신청">
            <strong>학교장터(S2B) 등록 제품</strong><span>창업기업제품 · 소상공인 확인기업<br />학교 예산으로 바로 도입할 수 있습니다.</span><small>S2B 물품번호 202609219492759 · 공공기관 구매실적 반영 가능</small>
          </a>
          <div className="jobgo-landing-visual-copy">JOB고 베타버전에 참여하여<br />학생 취업지도의 새 터를 함께 만들<br />의욕 있는 선생님을 기다립니다.</div>
          <a className="jobgo-landing-visual-link" href="https://app.gyo6.kr/school-adoption">학교 도입 안내 보기 ↗</a>
        </div>

        <aside className="jobgo-landing-login" aria-labelledby="jobgo-login-title">
          <h2 id="jobgo-login-title">기존 계정으로 로그인하세요</h2>
          <p>학생·선생님·학교관리자·총괄관리자 모두 이곳에서 로그인합니다.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="jobgo-email">이메일</label>
            <input id="jobgo-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일을 입력하세요" autoComplete="username" required />
            <label htmlFor="jobgo-password">비밀번호</label>
            <input id="jobgo-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" autoComplete="current-password" required />
            <button className="jobgo-login-submit" type="submit" disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
          </form>
          <button className="jobgo-reset-link" type="button" onClick={openReset}>비밀번호를 잊으셨나요? 재설정 메일 받기</button>
          {error && <p className="jobgo-login-error" role="alert">{error}</p>}
          {success && <p className="jobgo-login-success" role="status">{success}</p>}
          <div className="jobgo-login-divider" />
          <button className="jobgo-signup-link" type="button" onClick={onSchoolSignup}>처음이에요 · 학교와 함께 가입</button>
          <small>메일로 받은 인증번호는 비밀번호 칸이 아닌 재설정 화면에 입력합니다.</small>
        </aside>
      </section>

      <section className="jobgo-landing-benefits" aria-label="JOB고 이용 대상">
        <article><span className="jobgo-benefit-icon student">●</span><div><h2>학생은<br /><em>스스로 학습</em></h2><p>다양한 직업과 역할을 탐색하며 지금의 관심이 더 넓은 가능성으로 이어지도록 지원합니다.</p></div></article>
        <article><span className="jobgo-benefit-icon teacher">◆</span><div><h2>선생님은<br /><em>수업과 피드백</em></h2><p>풍부한 수업 자료와 쉬운 운영으로 학생의 배움과 성장을 더 가까이에서 돕습니다.</p></div></article>
        <article><span className="jobgo-benefit-icon school">■</span><div><h2>학교는<br /><em>안전하게 운영</em></h2><p>간편한 도입 절차와 체계적인 지원으로 모든 학생이 안전하게 학습할 수 있는 환경을 만듭니다.</p></div></article>
      </section>

      <footer className="jobgo-landing-footer">
        <div><span>지금, 스킬캠퍼스와 함께</span><strong>우리 학교의 내일을 시작하세요</strong></div>
        <ol><li><b>1</b><span>도입 상담<small>학교 상황에 맞는 도입 방법을 안내합니다.</small></span></li><li><b>2</b><span>회원등록<small>관리자 계정을 생성하고 학교 구성원을 등록합니다.</small></span></li><li><b>3</b><span>바로 시작<small>자료와 기능을 학교 수업에 연결합니다.</small></span></li></ol>
        <a href="https://app.gyo6.kr/school-adoption">학교 도입 안내 보기</a>
      </footer>
    </main>
  )
}

export default function LoginScreen() {
  const [view,          setView]         = useState('landing') // 'landing' | 'login' | 'signup' | 'reset'
  const [tab,           setTab]          = useState('student')
  const [email,         setEmail]        = useState('')
  const [password,      setPassword]     = useState('')
  const [loading,       setLoading]      = useState(false)
  const [audience,      setAudience]     = useState(null)   // 'student' | 'teacher'
  const [error,         setError]        = useState('')
  const [success,       setSuccess]      = useState('')
  const [trialMessage,  setTrialMessage] = useState(() => consumeTrialNotice())
  const [showExitDialog, setShowExitDialog] = useState(false)
  const trialLaunchRef = useRef(false)

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
    if (!Capacitor.isNativePlatform() && PUBLIC_WEB_TRIAL_ENABLED && requestedTrialRole()) return
    supabase.from('schools').select('id, name, region, education_office').order('name').then(({ data }) => {
      setSchools(data ?? [])
      if (data?.length === 1) setSelectedSchool(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!PUBLIC_WEB_TRIAL_ENABLED || Capacitor.isNativePlatform() || trialLaunchRef.current) return
    const role = requestedTrialRole()
    if (!role) return
    trialLaunchRef.current = true
    handleTrialLogin(role)
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

  async function handleTrialLogin(role) {
    if (Capacitor.isNativePlatform() || !TRIAL_ACCOUNTS[role]) return
    reset()
    setTrialMessage('')
    setAudience(role === 'school_admin' ? 'teacher' : role)

    const availability = trialStartAvailability(role)
    if (!availability.allowed) {
      setTrialMessage(availability.reason)
      removeTrialQuery()
      return
    }

    setLoading(true)
    try {
      const ticket = await requestTrialToken(role)
      const { error: err } = await supabase.auth.verifyOtp({
        token_hash: ticket.tokenHash,
        type: 'magiclink',
      })
      if (err) {
        setTrialMessage(fmtErr(err))
        return
      }
      const started = beginTrialSession(role)
      if (!started.allowed) {
        await supabase.auth.signOut({ scope: 'local' })
        setTrialMessage(started.reason)
      }
    } catch (ex) {
      setTrialMessage(fmtErr(ex))
    } finally {
      setLoading(false)
      removeTrialQuery()
    }
  }

  function removeTrialQuery() {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('trial')
      url.searchParams.delete('trial_nonce')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    } catch { /* noop */ }
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

  // 공개 체험·역할 선택 화면은 폐기하고, 운영 루트는 JOB고 안내와 계정 로그인으로 고정한다.
  if (!audience) return (
    <JobgoLanding
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      handleLogin={handleLogin}
      loading={loading}
      error={error}
      success={success}
      openReset={openReset}
      onSchoolSignup={() => { window.location.assign('/school-adoption') }}
    />
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
        {PUBLIC_WEB_TRIAL_ENABLED && !isNative && (
          <button className="trial-role-start" type="button" onClick={() => handleTrialLogin(audience)} disabled={loading}>
            <span>{loading ? '체험 화면 여는 중' : `${A.key === 'teacher' ? '교사' : '학생'} 체험 바로 시작`}</span>
            <small>계정 입력 없음 · 시간 제한 없음 · 저장 안 됨</small>
          </button>
        )}
        {trialMessage && <div className="trial-login-message on-color" role="status">{trialMessage}</div>}
        {/* 로그인·회원가입은 웹·앱 모두에서 사용 가능(PWA). 웹에서도 직접 시연·테스트 가능. */}
        <button onClick={() => { setView('login'); reset() }}
          style={{ width: '100%', minHeight: 52, padding: '15px', background: '#fff', color: A.accent, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          내 계정으로 로그인
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
