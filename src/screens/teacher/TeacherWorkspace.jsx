import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowClockwise,
  BookOpenText,
  Briefcase,
  Broadcast,
  Buildings,
  ChartBar,
  ChatCircleDots,
  CheckCircle,
  ClipboardText,
  FileText,
  GraduationCap,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  PresentationChart,
  Sparkle,
  Student,
  Target,
  TrendUp,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { STUDENT_CAMPUS_HALLS } from '../../lib/studentCampusRoutes.js'
import ClassDiagnosticsScreen from './ClassDiagnosticsScreen.jsx'
import ClassWeaknessScreen from './ClassWeaknessScreen.jsx'
import ClassProgressScreen from './ClassProgressScreen.jsx'
import ClassResultsScreen from './ClassResultsScreen.jsx'
import ClassPersonalityScreen from './ClassPersonalityScreen.jsx'
import '../../styles/campus.css'

const TABS = [
  { id: 'students', label: '학생 성장', icon: UsersThree },
  { id: 'diagnostics', label: '진단 현황', icon: PresentationChart, C: ClassDiagnosticsScreen },
  { id: 'weakness', label: '약한 영역', icon: Target, C: ClassWeaknessScreen },
  { id: 'progress', label: '학습 진도', icon: TrendUp, C: ClassProgressScreen },
  { id: 'results', label: '성취 결과', icon: ChartBar, C: ClassResultsScreen },
  { id: 'personality', label: '인성검사', icon: Sparkle, C: ClassPersonalityScreen },
]

const HALL_PRESENTATION = {
  'job-common': { icon: BookOpenText, className: 'spot-problem' },
  'ncs-basic': { icon: CheckCircle, className: 'spot-team' },
  'recruit-written': { icon: Briefcase, className: 'spot-career' },
  personality: { icon: ChartBar, className: 'spot-data' },
}

const CAMPUS_SPOTS = STUDENT_CAMPUS_HALLS
  .filter(hall => hall.id !== 'interview')
  .map(hall => ({ ...hall, ...HALL_PRESENTATION[hall.id] }))

const campusAsset = (name) => `${import.meta.env.BASE_URL}images/campus/${name}`

export default function TeacherWorkspace({
  profile, classes, missions, pendingCount,
  onNavigate, onOpenClassroom, onOpenMessages, onOpenCoverReviews, onOpenStudentCampus, onTab, tab,
  workspaceState = 'ready', onRefresh,
  demo = false,
}) {
  const demoClasses = useMemo(() => demo ? [{ id: 'c1', name: '3학년 2반', class_code: 'CAMPUS32' }] : [], [demo])
  const sourceClasses = demo ? demoClasses : (classes ?? [])
  const teacherName = String(profile?.display_name || '선생님').replace(/\s*(?:선생님|선생)$/, '') || '선생'
  const [classId, setClassId] = useState(null)
  const [pane, setPane] = useState('students')
  const [live, setLive] = useState(demo ? demoLive() : null)
  const [query, setQuery] = useState('')
  const [showClassForm, setShowClassForm] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [classSaving, setClassSaving] = useState(false)
  const [classError, setClassError] = useState('')

  useEffect(() => {
    if (!classId && sourceClasses.length) setClassId(sourceClasses[0].id)
  }, [sourceClasses, classId])

  const cls = useMemo(() => sourceClasses.find(item => item.id === classId) ?? null, [sourceClasses, classId])

  async function loadLive() {
    if (!classId || demo) return
    setLive('loading')
    const { data } = await supabase.rpc('rpc_class_live', { p_class_id: classId })
    setLive(data?.error ? null : data)
  }

  useEffect(() => { loadLive() }, [classId, demo])

  const myMissions = (missions ?? []).filter(item => item.class_id === classId)
  const Pane = TABS.find(item => item.id === pane)?.C ?? null
  const students = live && live !== 'loading' ? (live.students ?? []) : []
  const visibleStudents = students.filter(item => item.display_name?.toLowerCase().includes(query.toLowerCase()))
  const priorityStudent = [...students].sort((a, b) => (b.wrong_open ?? 0) - (a.wrong_open ?? 0))[0] ?? null

  async function createClass(event) {
    event.preventDefault()
    if (!newClassName.trim() || classSaving) return
    setClassSaving(true)
    setClassError('')
    const { error } = await supabase.rpc('rpc_create_class', {
      p_name: newClassName.trim(),
      p_grade: newGrade ? Number(newGrade) : null,
      p_academic_year: new Date().getFullYear(),
    })
    setClassSaving(false)
    if (error) {
      setClassError('학급을 만들지 못했습니다. 학교관리자에게 배정 권한을 확인해 주세요.')
      return
    }
    setNewClassName('')
    setNewGrade('')
    setShowClassForm(false)
    await onRefresh?.()
  }

  const menu = [
    { id: 'dashboard', icon: GraduationCap, label: '학급 캠퍼스' },
    { id: 'grading', icon: ClipboardText, label: '채점함', badge: pendingCount },
    { id: 'ranking', icon: ChartBar, label: '성장 순위' },
  ]

  return (
    <div className="teacher-campus">
      <aside className="teacher-campus-rail">
        <div className="teacher-campus-brand">
          <span><GraduationCap weight="fill" /></span>
          <div><b>설탕과소금</b><small>TEACHER CAMPUS</small></div>
        </div>

        <nav className="teacher-campus-menu">
          {menu.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id} className={tab === item.id ? 'is-on' : ''} onClick={() => onTab?.(item.id)}>
                <Icon weight={tab === item.id ? 'fill' : 'regular'} />
                <span>{item.label}</span>
                {item.badge > 0 && <i>{item.badge}</i>}
              </button>
            )
          })}
        </nav>

        <div className="teacher-quick-actions">
          <button className="start-class" onClick={onOpenClassroom}><Broadcast weight="fill" /> 수업 시작</button>
          <button onClick={() => onOpenStudentCampus?.()}><BookOpenText /> 학생 화면 보기</button>
          <button onClick={() => onOpenMessages?.({ scope: 'class', target: classId })}><ChatCircleDots /> 메시지</button>
          <button onClick={() => onOpenCoverReviews?.(classId)}><FileText /> 자소서 첨삭</button>
          <button disabled={!cls} title={!cls ? '담당 학급 연결 후 사용할 수 있습니다' : undefined}
            onClick={() => onNavigate?.('create-mission', { classId: cls.id, className: cls.name })}><Sparkle /> 미션 만들기</button>
        </div>

        <div className="teacher-class-picker">
          <p>담당 학급</p>
          {sourceClasses.length === 0 && <span className="teacher-no-class">배정된 학급이 없습니다.</span>}
          {sourceClasses.map(item => (
            <button key={item.id} className={item.id === classId ? 'is-on' : ''} onClick={() => setClassId(item.id)}>
              <span>{item.name}</span><small>{item.class_code}</small>
            </button>
          ))}
        </div>

        <div className="teacher-account">
          <span>{teacherName.slice(0, 1)}</span>
          <div><b>{teacherName} 선생님</b><small>담당 학급 범위</small></div>
        </div>
      </aside>

      <section className="teacher-campus-main">
        {workspaceState === 'loading' ? (
          <div className="teacher-campus-empty"><div className="spinner" /><b>담당 학급을 불러오는 중입니다</b></div>
        ) : workspaceState === 'error' ? (
          <div className="teacher-campus-empty teacher-campus-error">
            <WarningCircle weight="fill" /><b>학급 정보를 불러오지 못했습니다</b>
            <span>연결 상태를 확인한 뒤 다시 불러와 주세요.</span>
            <button onClick={onRefresh}><ArrowClockwise /> 다시 불러오기</button>
          </div>
        ) : !cls ? (
          <div className="teacher-empty-workspace">
            <header className="teacher-ready-greeting">
              <span className="teacher-ready-avatar">{teacherName.slice(0, 1)}</span>
              <div>
                <small>TEACHER PASS</small>
                <h1>{teacherName} 선생님, 먼저 캠퍼스를 둘러보세요</h1>
                <p>학생이 보는 학습을 그대로 익히고, 수업에서는 더 크게 함께 진행할 수 있어요.</p>
              </div>
              <button onClick={() => onOpenStudentCampus?.()}><Buildings weight="fill" /><span>학생 화면 그대로</span><ArrowRight /></button>
            </header>

            <section className="campus-map teacher-learning-map" aria-label="교사가 미리 살펴보는 스킬캠퍼스 지도">
              <img src={campusAsset('skill-campus-map.webp')} alt="학생들과 함께 학습하는 스킬캠퍼스 전경" />
              {CAMPUS_SPOTS.map(({ id, label, badge, authority, icon: Icon, className }) => (
                <button key={id} className={`campus-spot ${className}`} onClick={() => onOpenStudentCampus?.(id)} aria-label={`${label} · ${authority}`}>
                  <Icon weight="bold" />
                  <span className="campus-spot-copy"><small>{badge}</small><b>{label}</b></span>
                </button>
              ))}
              <button className="campus-active-spot" onClick={() => onOpenStudentCampus?.('interview')}>
                <ChatCircleDots weight="fill" />
                <span className="campus-spot-copy"><small>면접 필수</small><b>고졸면접관</b></span>
              </button>
            </section>

            {showClassForm && (
              <form className="teacher-class-form" onSubmit={createClass}>
                <label><span>학급 이름</span><input value={newClassName} onChange={event => setNewClassName(event.target.value)} placeholder="예: 3학년 취업준비반" required /></label>
                <label><span>학년</span><select value={newGrade} onChange={event => setNewGrade(event.target.value)}><option value="">선택 안 함</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option></select></label>
                <button type="submit" disabled={classSaving}>{classSaving ? '연결 중...' : '학급 만들기'}</button>
                {classError && <p role="alert">{classError}</p>}
              </form>
            )}

            <section className="teacher-bonus-section">
              <header><span>선생님 보너스 패스</span><h2>가르치고, 살피고, 바로 도와주는 도구</h2></header>
              <div className="teacher-bonus-grid">
                <button className="is-class" onClick={onOpenClassroom}><span><Broadcast weight="fill" /></span><b>수업 스튜디오</b><small>문항·훈화·수업 덱</small><ArrowRight /></button>
                <button onClick={() => onNavigate?.('textbook-browse')}><span><BookOpenText weight="fill" /></span><b>교재 미리보기</b><small>학생 학습 그대로</small><ArrowRight /></button>
                <button onClick={() => onOpenMessages?.()}><span><ChatCircleDots weight="fill" /></span><b>소통·상담</b><small>공지·개별 메시지</small><ArrowRight /></button>
                <button onClick={() => onOpenCoverReviews?.()}><span><FileText weight="fill" /></span><b>자소서 첨삭</b><small>형광펜·메모·총평</small><ArrowRight /></button>
              </div>
            </section>

            <section className="teacher-connect-class">
              <div><span><UsersThree weight="fill" /></span><div><small>학급 연결 시 자동 활성화</small><h2>학생 성장 신호를 한 화면에</h2><p>진도·진단·오답·성취·인성검사·개별 상담까지 담당 학급 범위에서 관리.</p></div></div>
              <div className="teacher-connect-actions">
                <button className="is-primary" onClick={() => setShowClassForm(value => !value)}><Plus weight="bold" /> 담당 학급 연결</button>
                <button onClick={() => onNavigate?.('pending-students')}><Student weight="fill" /> 학생 승인</button>
              </div>
            </section>
          </div>
        ) : (
          <>
            <header className="teacher-campus-head">
              <div>
                <span>MY CLASS CAMPUS</span>
                <h1>{cls.name}</h1>
                <p>오늘 학생들의 흐름을 살피고 필요한 순간에 바로 도와주세요.</p>
              </div>
              <div className="teacher-campus-code">학급 코드 <b>{cls.class_code}</b></div>
              <button className="teacher-refresh" onClick={loadLive} disabled={demo}><ArrowClockwise /> 새로고침</button>
            </header>

            <section className="teacher-campus-summary">
              <div className="summary-image"><img src={`${import.meta.env.BASE_URL}images/campus/skill-campus-map.webp`} alt="스킬캠퍼스 전경" /></div>
              <div className="summary-copy">
                <span className="summary-live"><i /> 오늘의 캠퍼스가 열렸어요</span>
                <h2>{live && live !== 'loading' ? `${live.summary?.active ?? 0}명이 학습 중이에요` : '학생 현황을 준비하고 있어요'}</h2>
                <p>학습 진도, 성취, 미해결 오답과 대화를 한 화면에서 이어갑니다.</p>
              </div>
              <div className="teacher-summary-stats">
                <TeacherStat value={live?.summary?.active ?? 0} label="오늘 참여" tone="blue" />
                <TeacherStat value={live?.summary?.solved ?? 0} label="푼 문항" tone="mint" />
                <TeacherStat value={students.reduce((sum, item) => sum + (item.wrong_open ?? 0), 0)} label="미해결 오답" tone="coral" />
                <TeacherStat value={live?.summary?.idle ?? 0} label="도움 필요" tone="yellow" />
              </div>
            </section>

            <section className="teacher-smart-brief" aria-label="오늘의 우선 코칭 신호">
              <header><span>SMART BRIEF</span><h2>오늘 먼저 볼 신호</h2></header>
              <div>
                <button onClick={() => setPane('weakness')}>
                  <span className="is-coral"><Target weight="fill" /></span>
                  <small>오답 우선 코칭</small>
                  <b>{priorityStudent ? `${priorityStudent.display_name} · ${priorityStudent.wrong_open ?? 0}개` : '쌓인 오답 없음'}</b>
                  <ArrowRight />
                </button>
                <button onClick={() => setPane('progress')}>
                  <span className="is-mint"><TrendUp weight="fill" /></span>
                  <small>학습 참여</small>
                  <b>{live && live !== 'loading' ? `${live.summary?.active ?? 0}/${live.summary?.total ?? students.length}명 진행 중` : '현황 불러오는 중'}</b>
                  <ArrowRight />
                </button>
                <button onClick={() => onOpenMessages?.({ scope: 'class', target: classId })}>
                  <span className="is-blue"><ChatCircleDots weight="fill" /></span>
                  <small>바로 소통</small>
                  <b>학급 공지·개별 격려</b>
                  <ArrowRight />
                </button>
              </div>
            </section>

            <nav className="teacher-campus-tabs">
              {TABS.map(item => {
                const Icon = item.icon
                return <button key={item.id} className={pane === item.id ? 'is-on' : ''} onClick={() => setPane(item.id)}><Icon weight={pane === item.id ? 'fill' : 'regular'} /> {item.label}</button>
              })}
              {myMissions.length > 0 && <button className={pane === 'missions' ? 'is-on' : ''} onClick={() => setPane('missions')}><CheckCircle /> 미션 {myMissions.length}</button>}
            </nav>

            <div className="teacher-campus-pane">
              {pane === 'students' && (
                <StudentGrowthTable
                  students={visibleStudents}
                  query={query}
                  setQuery={setQuery}
                  loading={live === 'loading'}
                  onMessage={student => onOpenMessages?.({ scope: 'personal', target: student.student_id, studentName: student.display_name })}
                  onWrong={() => setPane('weakness')}
                />
              )}
              {pane === 'missions' && (
                <div className="teacher-mission-list">
                  {myMissions.map(item => <button key={item.id}><span>{item.status}</span><b>{item.title}</b><small>{item.mission_type}</small></button>)}
                </div>
              )}
              {pane !== 'students' && pane !== 'missions' && Pane && (
                <Pane key={`${cls.id}:${pane}`} classId={cls.id} className={cls.name} onBack={null} embedded
                  onMessage={student => onOpenMessages?.({ scope: 'personal', target: student.student_id, studentName: student.display_name })} />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function TeacherStat({ value, label, tone }) {
  return <div className={`teacher-stat is-${tone}`}><b>{value}</b><span>{label}</span></div>
}

function StudentGrowthTable({ students, query, setQuery, loading, onMessage, onWrong }) {
  return (
    <section className="student-growth">
      <header>
        <div><h2>학생 성장 신호</h2><p>오늘의 활동과 누적 오답을 함께 보고 바로 코칭할 수 있어요.</p></div>
        <label><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="학생 이름 검색" /></label>
      </header>
      <div className="student-growth-table">
        <div className="student-growth-row is-head"><span>학생</span><span>오늘 활동</span><span>오늘 오답</span><span>미해결 오답</span><span>최근 상태</span><span>코칭</span></div>
        {loading && <div className="student-growth-loading">학생 성장 신호를 불러오는 중입니다.</div>}
        {!loading && students.length === 0 && <div className="student-growth-loading">표시할 학생이 없습니다.</div>}
        {!loading && students.map(student => (
          <div key={student.student_id} className="student-growth-row">
            <span className="student-name"><i>{student.display_name?.slice(0, 1)}</i><b>{student.display_name}</b></span>
            <span><b>{student.solved ?? 0}</b>개</span>
            <span className={student.wrong_today ? 'is-alert' : ''}><b>{student.wrong_today ?? 0}</b>개</span>
            <button className={student.wrong_open ? 'wrong-pill is-alert' : 'wrong-pill'} onClick={onWrong}><WarningCircle weight="fill" /> {student.wrong_open ?? 0}개</button>
            <span className={student.idle ? 'student-state is-idle' : 'student-state'}><i /> {student.idle ? '시작 전' : '학습 중'}</span>
            <button className="student-message-button" onClick={() => onMessage(student)}><PaperPlaneTilt /> 메시지</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function demoLive() {
  return {
    summary: { total: 28, active: 19, idle: 9, solved: 146, avg: 7.7 },
    students: [
      { student_id: 's1', display_name: '이수현', solved: 12, wrong_today: 1, wrong_open: 2, idle: false },
      { student_id: 's2', display_name: '박민준', solved: 9, wrong_today: 3, wrong_open: 7, idle: false },
      { student_id: 's3', display_name: '최유나', solved: 7, wrong_today: 0, wrong_open: 1, idle: false },
      { student_id: 's4', display_name: '정도윤', solved: 0, wrong_today: 0, wrong_open: 5, idle: true },
      { student_id: 's5', display_name: '김서연', solved: 5, wrong_today: 2, wrong_open: 4, idle: false },
    ],
  }
}
