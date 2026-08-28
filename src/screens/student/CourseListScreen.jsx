import { useState, lazy, Suspense, useMemo, useEffect, useRef } from 'react'
import ErrorBoundary          from '../../lib/ErrorBoundary.jsx'
import { pushBack, popBack }  from '../../lib/backButton.js'
import { getSubjectProgress, getProgressColor, syncSubjectProgress } from '../../lib/subjectProgress.js'
import { loadMySubjects } from '../../lib/subjectAccess.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'
import { ASSESS_GOALS, ASSESS_GOAL_LIST, getAssessGoal, setAssessGoal } from '../../lib/assessGoal.js'
import { lazyChunk } from '../../lib/lazyChunk.js'
import CompactText from '../../components/CompactText.jsx'

// 과목별 청크 분리 — 해당 과목 선택 시에만 로드됨
const StudyScreen             = lazyChunk(() => import('./StudyScreen.jsx'), 'StudyScreen')
const InterviewStudyScreen    = lazyChunk(() => import('./InterviewStudyScreen.jsx'), 'InterviewStudyScreen')
const InterviewCareerLab      = lazyChunk(() => import('./InterviewCareerLab.jsx'), 'InterviewCareerLab')
const InterviewPracticalScreen = lazyChunk(() => import('./InterviewPracticalScreen.jsx'), 'InterviewPracticalScreen')
const MockAssessmentScreen    = lazyChunk(() => import('./MockAssessmentScreen.jsx'), 'MockAssessmentScreen')
const PersonalityGuidedStudyScreen = lazyChunk(() => import('./PersonalityGuidedStudyScreen.jsx'), 'PersonalityGuidedStudyScreen')
const CoverGuidedStudyScreen  = lazyChunk(() => import('./CoverGuidedStudyScreen.jsx'), 'CoverGuidedStudyScreen')
const DiagnosticScreen        = lazyChunk(() => import('./DiagnosticScreen.jsx'), 'DiagnosticScreen')
const PersonalityTestScreen   = lazyChunk(() => import('./PersonalityTestScreen.jsx'), 'PersonalityTestScreen')
const JobCommonDiagnosticHub  = lazyChunk(() => import('./JobCommonDiagnosticHub.jsx'), 'JobCommonDiagnosticHub')

// 모의고사 지원 과목 (평탄 문항 풀 + 자동채점 가능) — 전 과목
const MOCK_SUPPORTED = new Set(['job-common', 'ncs-basic', 'recruit-written', 'interview', 'cover-letter'])
// 진단은 모의와 별개다. 지금은 두 목록이 같지만 `mockReady` 하나로 두 버튼을
// 잠그고 있어서, 모의가 없는 과목이 생기면 **진단까지 함께 잠긴다.**
// 지금 값이 같다고 조건을 공유하면 나중에 조용히 틀린다.
const DIAG_SUPPORTED = new Set(['job-common', 'ncs-basic', 'recruit-written', 'interview', 'cover-letter'])

// 고른 목표에 맞는 카드에 붙는 표시. 목표를 고르지 않았으면 아무 데도 안 붙는다.
const goalPick = { display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: '#166534',
  background: '#DCFCE7', padding: '2px 7px', borderRadius: 20, marginLeft: 6, verticalAlign: 'middle' }

// 학습 단계 배지 (완전교재/자율학습/모의고사 카드 제목 앞)
const stepBadge = {
  display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
  color: '#5B21B6', background: '#EDE9FE', padding: '2px 7px', borderRadius: 20, marginRight: 7,
  verticalAlign: 'middle',
}

function CourseLoadingScreen() {
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>교재 불러오는 중...</p>
    </div>
  )
}

// lazy 교재 로딩 실패(청크 404·네트워크) 시 백지 대신 복구 화면을 보여준다.
function Lazy({ children, onRetry }) {
  return (
    <ErrorBoundary title="교재를 불러오지 못했어요" label="course-lazy" onRetry={onRetry}>
      <Suspense fallback={<CourseLoadingScreen />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

const CATALOG = [
  {
    id: 'job-common',
    icon: '🏅',
    name: COMMON_ABILITY_COURSES['job-common'].title,
    tag: COMMON_ABILITY_COURSES['job-common'].authorityBadge,
    tagColor: '#5B21B6',
    bg: '#EDE9FE',
    desc: '특성화고·마이스터고 직업공통능력 인증진단 대비',
    meta: '의사소통 국어·영어 · 수리활용 · 문제해결 · 직무적응',
    type: 'study',
  },
  {
    id: 'ncs-basic',
    icon: '📖',
    name: COMMON_ABILITY_COURSES['ncs-basic'].title,
    tag: COMMON_ABILITY_COURSES['ncs-basic'].authorityBadge,
    tagColor: '#1D4ED8',
    bg: '#DBEAFE',
    desc: 'NCS 26v1에 따른 현행 직업공통능력 학습',
    meta: '공공기관·금융권·대기업 필기의 공통 중심축 · 공식 7영역·21개 능력',
    pathBadge: 'STEP 1 · 필기 공통 필수',
    type: 'study',
  },
  {
    id: 'recruit-written',
    icon: '📝',
    name: '채용필기 심화·확장',
    tag: '지원처별 추가 출제영역',
    tagColor: '#9A3412',
    bg: '#FFEDD5',
    desc: 'NCS 본과정에 더해 지원 기관·업종이 요구하는 추가 필기영역 심화',
    meta: '공공기관형·금융권형·대기업형 · 잔여역량·상식·직무적성',
    pathBadge: 'STEP 2 · 지원처 심화 필수',
    type: 'study',
  },
  {
    id: 'interview',
    icon: '🎤',
    name: '고졸 공정채용 면접',
    tag: 'NCS 능력중심·블라인드',
    tagColor: '#92400E',
    bg: '#FEF3C7',
    desc: '채용공고·직무기술서 기반 고졸 면접 완전 대비',
    meta: '자율학습 · 진단평가 · 모의면접 · 실전면접 리허설',
    type: 'interview',
  },
  {
    id: 'cover-letter',
    icon: '✍️',
    name: '자기소개서관',
    tag: '개념부터 제출본까지',
    tagColor: '#0F766E',
    bg: '#DDF7F0',
    desc: '개념·작성 기준을 익히고 지원처별 제출본까지 완성',
    meta: '자율학습 · 진단평가 · 모의고사 · 근거은행 · 작성 · 교사 첨삭',
    type: 'cover',
  },
  {
    id: 'personality',
    icon: '🧭',
    name: '인성검사',
    tag: '공채 필기·인적성',
    tagColor: '#0F766E',
    bg: '#CCFBF1',
    desc: '인성검사 이해·응답 전략 + 모의검사·결과분석 · 정답 없는 검사 대비',
    meta: '자율학습 · 진단평가 · 모의고사',
    type: 'personality',
  },
]

// 학생 교재 탭에 노출할 과목 (준비 완료된 두 과목만)
const VISIBLE_CATALOG = CATALOG.filter(c => !c.hidden)

// 과목 카드에 표시되는 학습 진행 바
// 진행율 = 과목 전체 영역/단원을 실제로 풀어 익힌 비율(패시브 열람 제외).
// canSync=true(학생 본인 화면)일 때만 서버에 미러링(교사·관리자 열람 시엔 미표시).
function MasteryBar({ subjectId, canSync }) {
  const prog = useMemo(() => getSubjectProgress(subjectId), [subjectId])
  useEffect(() => { if (canSync && prog) syncSubjectProgress(subjectId) }, [canSync, subjectId, prog?.pct])
  if (!prog) return null   // 인성검사 등 정답 없는 과목 — 진행율 미적용
  const { pct, done, total } = prog
  const color = getProgressColor(pct)
  const unit = (subjectId === 'interview') ? '단원' : '영역'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <p style={{ fontSize: 12, color, fontWeight: 700, marginTop: 3 }}>
        {pct >= 80 ? '🏆' : pct >= 50 ? '📈' : '📚'} 학습 진행 {pct}%
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> · {done}/{total} {unit} 숙달</span>
      </p>
    </div>
  )
}

export default function CourseListScreen({ resolveSubjects, onBack, hideAppbar, deepLink, onContextChange } = {}) {
  // 교실 수업의 「따라가기」도 학생이 직접 고른 것과 같은 모드로 연다.
  // 예전 수업 덱은 무조건 자율학습으로 바꿨지만, 이제 진단·모의·실전까지
  // 학생 앱 자체가 교실 콘텐츠이므로 원래 모드를 잃으면 안 된다.
  const [course, setCourse] = useState(deepLink?.subject ?? null)
  const linkedMode = deepLink?.mode === null
    ? null
    : ['study', 'diagnostic', 'mock', 'practical', 'cover-practical'].includes(deepLink?.mode)
      ? deepLink.mode
      : 'study'
  // 홈의 학습관은 과목 소개·방식 선택부터 열고, 교사 수업 링크는 같은 학습 모드로 직행한다.
  const [mode,   setMode]   = useState(deepLink?.subject ? linkedMode : null)
  const [remediation, setRemediation] = useState(null)
  // 직업공통능력만 학년별로 진단 규모가 다르다. 기기에만 저장한다(서버 왕복 없음).
  const [goal,   setGoalState] = useState(getAssessGoal)
  const setGoal = id => { setAssessGoal(id); setGoalState(id) }
  const [showOtherModes, setShowOtherModes] = useState(false)
  const [allowed, setAllowed] = useState(null) // Set<id> = 배정된 교재만 | null = 전체

  // 열람 가능 교재 결정: 역할별 resolver(교사·학교관리자) 또는 기본(학생 배정). 미배정·오류=전체.
  useEffect(() => { (resolveSubjects || loadMySubjects)().then(setAllowed).catch(() => setAllowed(null)) }, [])
  const visibleCatalog = allowed ? VISIBLE_CATALOG.filter(c => allowed.has(c.id)) : VISIBLE_CATALOG

  const selected = CATALOG.find(c => c.id === course)

  useEffect(() => {
    onContextChange?.({ subject: course, mode })
  }, [course, mode, onContextChange])

  function backToChooser() { setMode(null) }
  function backToList() {
    if (deepLink?.subject && onBack) { onBack(); return }
    setCourse(null); setMode(null); setRemediation(null)
  }

  // course 선택 상태일 때 Android 뒤로가기를 가로채 과목목록/모드선택으로 되돌림.
  // mode가 있으면 모드선택으로, 없으면 과목목록으로.
  // (FoodServiceScreen 등 하위화면이 로드됐을 때는 해당 화면의 핸들러가 우선 처리)
  const backRef = useRef(null)
  backRef.current = () => {
    if (mode !== null) { setMode(null) }
    else if (course !== null) { backToList() }
    else if (onBack) { onBack() }
  }
  useEffect(() => {
    // 상위(교사·관리자) 임베드 시 최상위 목록에서도 뒤로가기를 상위로 위임
    if (!course && !onBack) return
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [course])

  // ── 인성검사 진단/모의(정답 없는 검사 → 결과 분석) ──
  if (selected && selected.type === 'personality' && (mode === 'diagnostic' || mode === 'mock')) {
    return (
      <Lazy onRetry={backToChooser}>
        <PersonalityTestScreen subjectName={selected.name} mode={mode === 'diagnostic' ? 'quick' : 'full'} onLearningContext={onContextChange} onBack={backToChooser} />
      </Lazy>
    )
  }

  // ── 진단평가 모드 (자가 성취도 진단) ──
  if (selected && mode === 'diagnostic') {
    if (course === 'cover-letter') {
      return <Lazy onRetry={backToChooser}><InterviewCareerLab section="cover" initialWorkspace="diagnostic" onLearningContext={onContextChange} onBack={backToChooser} /></Lazy>
    }
    if (course === 'job-common') {
      return (
        <Lazy onRetry={backToChooser}>
          <JobCommonDiagnosticHub onBack={backToChooser} />
        </Lazy>
      )
    }
    return (
      <Lazy onRetry={backToChooser}>
        <DiagnosticScreen subjectId={course} subjectName={selected.name}
          onLearningContext={onContextChange} onBack={backToChooser} onGoTextbook={target => { setRemediation(target); setMode('study') }} />
      </Lazy>
    )
  }

  // ── 모의고사 모드 ──
  if (selected && mode === 'mock') {
    if (course === 'cover-letter') {
      return <Lazy onRetry={backToChooser}><InterviewCareerLab section="cover" initialWorkspace="mock" onLearningContext={onContextChange} onBack={backToChooser} /></Lazy>
    }
    return (
      <Lazy onRetry={backToChooser}>
        <MockAssessmentScreen subjectId={course} subjectName={selected.name} onLearningContext={onContextChange} onBack={backToChooser} />
      </Lazy>
    )
  }

  if (selected && course === 'interview' && mode === 'practical') {
    return <Lazy onRetry={backToChooser}><InterviewPracticalScreen onLearningContext={onContextChange} onBack={backToChooser} /></Lazy>
  }

  if (selected && course === 'cover-letter' && mode === 'cover-practical') {
    return <Lazy onRetry={backToChooser}><InterviewCareerLab section="cover" initialWorkspace="practical" onLearningContext={onContextChange} onBack={backToChooser} /></Lazy>
  }

  // ── 자율학습 모드 ──
  if (selected && mode === 'study') {
    if (selected.type === 'study') {
      return (
        <Lazy onRetry={backToChooser}>
          <StudyScreen
            initialSubject={course}
            initialTrack={deepLink?.track ?? undefined}
            initialArea={remediation?.area ?? deepLink?.area ?? undefined}
            initialLesson={remediation?.lesson ?? deepLink?.lesson ?? undefined}
            initialQuestionId={deepLink?.questionId ?? undefined}
            initialQuestionIndex={deepLink?.index ?? undefined}
            initialStep={deepLink?.step ?? 0}
            initialInteraction={deepLink?.interaction ?? null}
            onLearningContext={onContextChange}
            onBack={backToChooser} />
        </Lazy>
      )
    }
    if (course === 'interview') {
      return (
        <Lazy onRetry={backToChooser}>
          <InterviewStudyScreen
            initialArea={deepLink?.area ?? undefined}
            initialLesson={deepLink?.lesson ?? undefined}
            initialStep={deepLink?.step ?? 0}
            initialInteraction={deepLink?.interaction ?? null}
            onLearningContext={onContextChange}
            onBack={backToChooser}
          />
        </Lazy>
      )
    }
    if (course === 'cover-letter') {
      return <Lazy onRetry={backToChooser}><CoverGuidedStudyScreen initialArea={deepLink?.area ?? undefined} initialLesson={deepLink?.lesson ?? undefined} initialStep={deepLink?.step ?? 0} initialInteraction={deepLink?.interaction ?? null} onLearningContext={onContextChange} onChallenge={() => setMode('diagnostic')} onBack={backToChooser} /></Lazy>
    }
    if (course === 'personality') {
      return <Lazy onRetry={backToChooser}><PersonalityGuidedStudyScreen initialArea={deepLink?.area ?? undefined} initialLesson={deepLink?.lesson ?? undefined} initialStep={deepLink?.step ?? 0} initialInteraction={deepLink?.interaction ?? null} onLearningContext={onContextChange} onChallenge={() => setMode('diagnostic')} onBack={backToChooser} /></Lazy>
    }
  }

  // ── 모드 선택 화면 (과목 선택 후) ──
  if (selected) {
    const isPersonality = selected.type === 'personality'
    const mockReady = MOCK_SUPPORTED.has(course) || isPersonality
    const diagReady = DIAG_SUPPORTED.has(course) || isPersonality
    const writtenGuide = course === 'ncs-basic'
      ? '공공기관·금융권·대기업 필기 공통 중심축\n본과정 완료 후 채용필기 심화관에서 지원처별 영역 보완'
      : 'NCS 공통 본과정과 함께 학습 필요\n지원 기관·업종별 추가 출제영역을 완성하는 심화 과정'
    const diagnosticCopy = isPersonality
      ? '48문항 · 약 13분 · 총 20회\n응답 경향·신뢰도 빠른 점검'
      : course === 'job-common'
        ? goal === 'cert'
          ? '약한 영역 빠른 탐색\n앱 진단 40문항 또는 정밀 자가진단 215문항 선택'
          : '자가진단 215문항 또는 앱 진단 40문항 선택\n목적에 맞춰 약점과 보완 순서 확인'
        : course === 'ncs-basic'
          ? '전체·영역·소단원 범위 선택\n5~40문항으로 약점·보완 순서 확인\n공식 합격 판정 아님'
          : course === 'recruit-written'
            ? '채용 트랙·세부 단원 범위 선택\n5~40문항으로 약점·보완 순서 확인\n실제 기관 합격 판정 아님'
            : course === 'cover-letter'
              ? '실제 초안의 문항 요구·지원처·근거·구조·사실성 진단\n고쳐야 할 작성 단계로 바로 연결'
              : course === 'interview'
                ? '실제 면접 상황·답변 대응을 전체·영역·소단원별 진단\n약한 상황과 답변 연습으로 바로 연결'
                : '전체·영역·소단원 범위 선택\n이해도 진단 후 보완학습 바로 연결'
    const mockCopy = isPersonality
      ? '190문항 · 약 51분 · 총 10회\n실전 응시 후 상세 결과 분석'
      : mockReady
        ? course === 'job-common'
          ? goal === 'self'
            ? '5영역 342문항 · 240분 인증진단 규모\n1·2학년은 진단평가부터 권장'
            : '2026 공개 구성의 영역별 문항 수·시간 반영\n영역별 또는 342문항 전체 실전 가능'
          : course === 'recruit-written'
            ? '지원 분야·문항 수·제한시간 선택\n중간 해설 없는 실제 필기 방식'
            : course === 'cover-letter'
              ? '지원 분야·항목·글자 수·제한시간 선택\n실제 자기소개서 1개 항목 작성·자가 점검'
              : course === 'interview'
                ? '면접 영역·질문 수·제한시간 선택\n중간 해설 없이 실제 면접처럼 답변 점검'
                : '영역·문항 수·제한시간 선택\n중간 해설 없는 실제 시험 방식'
        : '과목별 모의고사 준비 중'
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={backToList}>←</button>
          <span className="appbar-title">{selected.icon} {selected.name}</span>
        </div>
      <div className="screen-body learning-mode-flow">
          {(course === 'ncs-basic' || course === 'recruit-written') && (
            <div className={`written-path-guide ${course === 'ncs-basic' ? 'core' : 'advanced'}`}>
              <strong>{course === 'ncs-basic' ? 'STEP 1 · 필기 공통 필수' : 'STEP 2 · 지원처 심화 필수'}</strong>
              <CompactText text={writtenGuide} maxItemChars={68} />
            </div>
          )}
          {/* 면접은 지식 점검 뒤 실제 행동 리허설까지 네 기능으로 완성한다. */}
          <div className="learning-mode-overview" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>이 과목에서 제공하는 학습 기능</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(isPersonality
                ? [['📚', '자율학습', '검사 이해'], ['📊', '진단평가', '응답 점검'], ['📝', '모의고사', '실전 검사']]
                : course === 'interview'
                  ? [['📚', '자율학습', '기준·수정·답변 연습'], ['📊', '진단평가', '대응 약점 확인'], ['📝', '모의면접', '답변 점검'], ['🎬', '실전면접', '행동 리허설']]
                  : course === 'cover-letter'
                    ? [['📚', '자율학습', '작성법 이해'], ['📊', '진단평가', '기준 점검'], ['📝', '모의고사', '제한 작성'], ['✍️', '실전자기소개서', '직접 완성']]
                  : [['📚', '자율학습', '배우기·반복'], ['📊', '진단평가', '약점 처방'], ['📝', '모의고사', '실전 재현']]
              ).map(([icon, a, b]) => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--primary-light)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 3px' }}>{icon}</div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.3 }}>{a}<br /><strong style={{ color: 'var(--text)' }}>{b}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showOtherModes && course === 'job-common' && <div className="learning-mode-goal">{(
            goal === null ? (
              /* 고르기 전까지는 아래 카드가 어느 규모인지 알 수 없으므로 먼저 묻는다. */
              <div style={{ background: 'var(--card)', border: '2px solid var(--primary)', borderRadius: 14, padding: '14px', marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>어떤 시험을 준비하나요?</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  학년에 따라 진단 문항 수가 다릅니다. 고르면 알맞은 학습을 먼저 보여 드리고, 언제든 바꿀 수 있습니다.
                </p>
                {ASSESS_GOAL_LIST.map(g => (
                  <button key={g.id} onClick={() => setGoal(g.id)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 12,
                      padding: '13px 14px', marginBottom: 8, minHeight: 44, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{g.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{g.label}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{g.scale} · {g.desc}</span>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--primary-light)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', marginBottom: 16 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{ASSESS_GOALS[goal].emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                  <strong>{ASSESS_GOALS[goal].label}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> · {ASSESS_GOALS[goal].scale}</span>
                </span>
                <button onClick={() => setGoal(goal === 'self' ? 'cert' : 'self')}
                  className="btn-ghost"
                  style={{ flexShrink: 0, minHeight: 44, padding: '0 12px', fontSize: 12.5, fontWeight: 700 }}>
                  바꾸기
                </button>
              </div>
            )
          )}</div>}

          <p className="section-title learning-mode-title">추천 학습</p>

          <button onClick={() => setMode('study')}
            className="learning-mode-primary"
            style={{
              width: '100%', textAlign: 'left', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px', marginBottom: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📚</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                <span style={stepBadge}>선택 · 학습</span>자율학습
              </p>
              <CompactText text={isPersonality
                ? '검사 원리·문항 형식·응답 습관 학습\n정답 만들기 없이 신뢰도·실전 루틴 성찰'
                : course === 'cover-letter'
                ? '문항 요구·항목별 실전 작성법 학습\n감점 초안 고쳐쓰기·내 경험 근거 찾기'
                : course === 'interview'
                  ? '좋은 답변 기준을 익히고 수정안을 고름\n내 경험으로 직접 답변·녹화·수정 반복'
                  : '요점정리로 개념 학습\n문제 풀이로 반복\n오답노트로 복습 · 처음이면 여기부터'} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>

          <button type="button" className="learning-mode-more" onClick={() => setShowOtherModes(value => !value)} aria-expanded={showOtherModes}>
            <span>{showOtherModes ? '다른 방식 접기' : '진단·모의·실전 보기'}</span>
            <b>{showOtherModes ? '↑' : '↓'}</b>
          </button>

          <button onClick={() => diagReady && setMode('diagnostic')}
            disabled={!diagReady}
            className="learning-mode-option learning-mode-diagnostic"
            style={{
              width: '100%', textAlign: 'left',
              background: diagReady ? 'var(--card)' : 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px', marginBottom: 12,
              cursor: diagReady ? 'pointer' : 'default', opacity: diagReady ? 1 : 0.6,
              display: showOtherModes ? 'flex' : 'none', alignItems: 'center', gap: 14,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📊</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                <span style={{ ...stepBadge, background: '#E0E7FF', color: '#4338CA' }}>선택 · 진단</span>진단평가
                {course === 'job-common' && goal && ASSESS_GOALS[goal].recommend === 'diagnostic' && <span style={goalPick}>내 목표에 맞음</span>}
              </p>
              <CompactText text={diagnosticCopy} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>

          <button onClick={() => mockReady && setMode('mock')}
            disabled={!mockReady}
            className="learning-mode-option learning-mode-mock"
            style={{
              width: '100%', textAlign: 'left',
              background: mockReady ? 'var(--card)' : 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px', marginBottom: 12,
              cursor: mockReady ? 'pointer' : 'default', opacity: mockReady ? 1 : 0.6,
              display: showOtherModes ? 'flex' : 'none', alignItems: 'center', gap: 14,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📝</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                <span style={{ ...stepBadge, background: '#DBEAFE', color: '#1D4ED8' }}>선택 · 실전</span>{course === 'interview' ? '모의면접' : '모의고사'}
                {course === 'job-common' && goal && ASSESS_GOALS[goal].recommend === 'mock' && <span style={goalPick}>내 목표에 맞음</span>}
                {!mockReady && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>준비 중</span>}
              </p>
              <CompactText text={mockCopy} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
            </div>
            {mockReady && <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>}
          </button>

          {course === 'interview' && (
            <button onClick={() => setMode('practical')}
              className="learning-mode-option learning-mode-practical"
              style={{
                width: '100%', textAlign: 'left', background: '#ECFDF5',
                border: '2px solid #0F766E', borderRadius: 14,
                padding: '16px', marginBottom: 12, cursor: 'pointer',
                display: showOtherModes ? 'flex' : 'none', alignItems: 'center', gap: 14,
              }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  <span style={{ ...stepBadge, background: '#CCFBF1', color: '#0F766E' }}>선택 · 리허설</span>실전면접
                </p>
                <CompactText text={'대기·입장·착석·답변·마지막 한마디·퇴장 9단계\n변형 상황 판단 · 습관 점검 · 전 과정 리허설'} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
              </div>
              <span style={{ color: '#0F766E', fontSize: 20, flexShrink: 0 }}>›</span>
            </button>
          )}

          {course === 'cover-letter' && (
            <button onClick={() => setMode('cover-practical')}
              className="learning-mode-option learning-mode-practical"
              style={{
                width: '100%', textAlign: 'left', background: '#ECFDF5',
                border: '2px solid #0F766E', borderRadius: 14,
                padding: '16px', marginBottom: 12, cursor: 'pointer',
                display: showOtherModes ? 'flex' : 'none', alignItems: 'center', gap: 14,
              }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✍️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  <span style={{ ...stepBadge, background: '#CCFBF1', color: '#0F766E' }}>선택 · 작성</span>실전자기소개서
                </p>
                <CompactText text={'근거 찾기·지원처 문항 구성·분량 맞춤·작성\n완성본 미리보기 · PDF 저장 · 선생님 첨삭'} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
              </div>
              <span style={{ color: '#0F766E', fontSize: 20, flexShrink: 0 }}>›</span>
            </button>
          )}

        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {!hideAppbar && (
        <div className="appbar">
          {onBack && <button className="appbar-back" onClick={onBack}>←</button>}
          <span className="appbar-title">📚 교재</span>
        </div>
      )}
      <div className="screen-body">
        <p className="section-title">학습 과목 선택</p>
        {visibleCatalog.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">📚</span>
            <span className="empty-state-title">배정된 교재가 없습니다</span>
            <span>선생님(학교·학급 관리자)이 교재를 배정하면 여기에 표시됩니다.</span>
          </div>
        )}
        {visibleCatalog.map(c => (
          <button key={c.id} onClick={() => setCourse(c.id)}
            style={{
              width: '100%', textAlign: 'left', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px', marginBottom: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: c.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                {c.pathBadge && <span className={`written-path-badge ${c.id === 'ncs-basic' ? 'core' : 'advanced'}`}>{c.pathBadge}</span>}
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: c.tagColor, background: c.bg,
                  padding: '2px 7px', borderRadius: 20,
                  border: `1px solid ${c.tagColor}44`,
                  whiteSpace: 'nowrap',
                }}>
                  {c.tag}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>{c.desc}</p>
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{c.meta}</span>
              <MasteryBar subjectId={c.id} canSync={!resolveSubjects} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
