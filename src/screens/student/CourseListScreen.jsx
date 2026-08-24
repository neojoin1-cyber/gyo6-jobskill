import { useState, lazy, Suspense, useMemo, useEffect, useRef } from 'react'
import ErrorBoundary          from '../../lib/ErrorBoundary.jsx'
import { pushBack, popBack }  from '../../lib/backButton.js'
import { getSubjectProgress, getProgressColor, syncSubjectProgress } from '../../lib/subjectProgress.js'
import { loadMySubjects } from '../../lib/subjectAccess.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'
import { ASSESS_GOALS, ASSESS_GOAL_LIST, getAssessGoal, setAssessGoal } from '../../lib/assessGoal.js'
import { lazyChunk } from '../../lib/lazyChunk.js'

// 과목별 청크 분리 — 해당 과목 선택 시에만 로드됨
const StudyScreen             = lazyChunk(() => import('./StudyScreen.jsx'), 'StudyScreen')
const InterviewStudyScreen    = lazyChunk(() => import('./InterviewStudyScreen.jsx'), 'InterviewStudyScreen')
const UniversalLearnScreen    = lazyChunk(() => import('./UniversalLearnScreen.jsx'), 'UniversalLearnScreen')
const MockAssessmentScreen    = lazyChunk(() => import('./MockAssessmentScreen.jsx'), 'MockAssessmentScreen')
const TextbookReader          = lazyChunk(() => import('./TextbookReader.jsx'), 'TextbookReader')
const DiagnosticScreen        = lazyChunk(() => import('./DiagnosticScreen.jsx'), 'DiagnosticScreen')
const PersonalityTestScreen   = lazyChunk(() => import('./PersonalityTestScreen.jsx'), 'PersonalityTestScreen')
const JobCommonDiagnosticHub  = lazyChunk(() => import('./JobCommonDiagnosticHub.jsx'), 'JobCommonDiagnosticHub')

// 모의고사 지원 과목 (평탄 문항 풀 + 자동채점 가능) — 전 과목
const MOCK_SUPPORTED = new Set(['job-common', 'ncs-basic', 'recruit-written', 'interview'])
// 진단은 모의와 별개다. 지금은 두 목록이 같지만 `mockReady` 하나로 두 버튼을
// 잠그고 있어서, 모의가 없는 과목이 생기면 **진단까지 함께 잠긴다.**
// 지금 값이 같다고 조건을 공유하면 나중에 조용히 틀린다.
const DIAG_SUPPORTED = new Set(['job-common', 'ncs-basic', 'recruit-written', 'interview'])

// 완전교재(리더) 노출 과목. 두 직업공통능력 교재는 서로 다른 공식 기준을
// 자율학습 화면에서 제공하므로 구형 통합 완전교재로 폴백하지 않는다.
const TEXTBOOK_READY = new Set(['personality'])

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
    meta: '12주제 자율학습 · 진단평가 · 모의면접',
    type: 'interview',
  },
  {
    id: 'personality',
    icon: '🧭',
    name: '인성검사',
    tag: '공채 필기·인적성',
    tagColor: '#0F766E',
    bg: '#CCFBF1',
    desc: '인성검사 이해·응답 전략 + 모의검사·결과분석 · 정답 없는 검사 대비',
    meta: '완전교재 · 진단 · 실전 모의검사',
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

export default function CourseListScreen({ resolveSubjects, onBack, hideAppbar, deepLink } = {}) {
  // 수업 덱의 링크로 들어오면 교재·모드 고르기를 건너뛰고 그 차시를 바로 연다.
  const [course, setCourse] = useState(deepLink?.subject ?? null)
  // 홈의 학습관은 과목 소개·방식 선택부터 열고, 교사 수업 링크만 자율학습으로 직행한다.
  const [mode,   setMode]   = useState(deepLink?.subject ? (deepLink.mode === null ? null : 'study') : null)   // null=모드선택 | 'study' | 'mock'
  const [remediation, setRemediation] = useState(null)
  // 직업공통능력만 학년별로 진단 규모가 다르다. 기기에만 저장한다(서버 왕복 없음).
  const [goal,   setGoalState] = useState(getAssessGoal)
  const setGoal = id => { setAssessGoal(id); setGoalState(id) }
  const [allowed, setAllowed] = useState(null) // Set<id> = 배정된 교재만 | null = 전체

  // 열람 가능 교재 결정: 역할별 resolver(교사·학교관리자) 또는 기본(학생 배정). 미배정·오류=전체.
  useEffect(() => { (resolveSubjects || loadMySubjects)().then(setAllowed).catch(() => setAllowed(null)) }, [])
  const visibleCatalog = allowed ? VISIBLE_CATALOG.filter(c => allowed.has(c.id)) : VISIBLE_CATALOG

  const selected = CATALOG.find(c => c.id === course)

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
        <PersonalityTestScreen subjectName={selected.name} mode={mode === 'diagnostic' ? 'quick' : 'full'} onBack={backToChooser} />
      </Lazy>
    )
  }

  // ── 완전교재 리더 모드 ──
  if (selected && mode === 'textbook') {
    return (
      <Lazy onRetry={backToChooser}>
        <TextbookReader subjectId={course} subjectName={selected.name} onBack={backToChooser} />
      </Lazy>
    )
  }

  // ── 진단평가 모드 (자가 성취도 진단) ──
  if (selected && mode === 'diagnostic') {
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
          onBack={backToChooser} onGoTextbook={target => { setRemediation(target); setMode('study') }} />
      </Lazy>
    )
  }

  // ── 모의고사 모드 ──
  if (selected && mode === 'mock') {
    return (
      <Lazy onRetry={backToChooser}>
        <MockAssessmentScreen subjectId={course} subjectName={selected.name} onBack={backToChooser} />
      </Lazy>
    )
  }

  // ── 자율학습 모드 ──
  if (selected && mode === 'study') {
    if (selected.type === 'study') {
      return (
        <Lazy onRetry={backToChooser}>
          <StudyScreen
            initialSubject={course}
            initialArea={remediation?.area ?? deepLink?.area ?? undefined}
            initialLesson={remediation?.lesson ?? deepLink?.lesson ?? undefined}
            initialQuestionId={deepLink?.questionId ?? undefined}
            initialQuestionIndex={deepLink?.index ?? undefined}
            onBack={backToChooser} />
        </Lazy>
      )
    }
    if (course === 'interview') {
      return (
        <Lazy onRetry={backToChooser}>
          <InterviewStudyScreen onBack={backToChooser} />
        </Lazy>
      )
    }
  }

  // ── 모드 선택 화면 (과목 선택 후) ──
  if (selected) {
    const isPersonality = selected.type === 'personality'
    const mockReady = MOCK_SUPPORTED.has(course) || isPersonality
    const diagReady = DIAG_SUPPORTED.has(course) || isPersonality
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={backToList}>←</button>
          <span className="appbar-title">{selected.icon} {selected.name}</span>
        </div>
      <div className="screen-body">
          {(course === 'ncs-basic' || course === 'recruit-written') && (
            <div className={`written-path-guide ${course === 'ncs-basic' ? 'core' : 'advanced'}`}>
              <strong>{course === 'ncs-basic' ? 'STEP 1 · 필기 공통 필수' : 'STEP 2 · 지원처 심화 필수'}</strong>
              <p>{course === 'ncs-basic'
                ? '공공기관·금융권·대기업 필기의 공통 중심축입니다. 이 본과정을 익힌 뒤 지원처별 추가 영역을 채용필기 심화·확장에서 보완합니다.'
                : 'NCS 공통 본과정을 대체하지 않습니다. NCS를 바탕으로 지원 기관·업종별 추가 출제영역까지 함께 완성하는 심화 과정입니다.'}</p>
            </div>
          )}
          {/* 세 학습 기능은 순서 강제 없이 목적에 따라 선택한다. */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>원하는 학습 기능을 바로 선택하세요</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(isPersonality
                ? [['📘', '학습방법', '익히기'], ['📊', '인성 진단', '자가진단'], ['📝', '실전 모의', '점검']]
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

          {course === 'job-common' && (
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
          )}

          <p className="section-title">학습 방식 선택</p>

          {TEXTBOOK_READY.has(course) && (
            <button onClick={() => setMode('textbook')}
              style={{
                width: '100%', textAlign: 'left', background: 'var(--card)',
                border: '2px solid var(--primary)', borderRadius: 14,
                padding: '16px', marginBottom: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📘</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  <span style={stepBadge}>선택 · 익히기</span>학습방법
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>인성검사의 원리와 응답 전략을 익히는 가이드입니다. <strong style={{ color: 'var(--primary)' }}>먼저 여기부터!</strong></p>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
            </button>
          )}

          {!isPersonality && (
          <button onClick={() => setMode('study')}
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
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>요점정리로 개념을 익히고 <strong>문제 풀이로 반복</strong>합니다. 틀린 문항은 오답노트로 복습. <strong style={{ color: 'var(--primary)' }}>처음이면 여기부터!</strong></p>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>
          )}

          <button onClick={() => diagReady && setMode('diagnostic')}
            disabled={!diagReady}
            style={{
              width: '100%', textAlign: 'left',
              background: diagReady ? 'var(--card)' : 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px', marginBottom: 12,
              cursor: diagReady ? 'pointer' : 'default', opacity: diagReady ? 1 : 0.6,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📊</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                <span style={{ ...stepBadge, background: '#E0E7FF', color: '#4338CA' }}>선택 · 진단</span>{isPersonality ? '인성 진단' : '진단평가'}
                {course === 'job-common' && goal && ASSESS_GOALS[goal].recommend === 'diagnostic' && <span style={goalPick}>내 목표에 맞음</span>}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {isPersonality
                  ? <><strong>48문항 · 약 13분 · 총 20회 반복 진단.</strong> 핵심 문항으로 내 응답 경향·신뢰도를 빠르게 점검합니다.</>
                  : course === 'job-common'
                    ? goal === 'cert'
                      // 목표가 3학년인데 첫마디가 "1·2학년"이면 자기 것이 아니라고 읽힌다.
                      // 학년이 아니라 **목적**을 먼저 말한다 — 실제로 3학년도 약점 점검에 쓴다.
                      ? <><strong>약한 영역을 빠르게 찾는 단계</strong>입니다. 앱 빠른 진단 40문항, 더 촘촘히 보려면 215문항 자가진단도 고를 수 있어요.</>
                      : <><strong>215문항 자가진단</strong>(1·2학년 규모) 또는 <strong>앱 빠른 진단 40문항</strong>을 목적에 따라 선택합니다.</>
                    : course === 'ncs-basic'
                      ? <>전체·영역·소단원 중 범위를 고르고 <strong>5~40문항</strong>으로 약점과 보완 순서를 찾습니다. 공식 합격 판정이 아닙니다.</>
                      : course === 'recruit-written'
                        ? <>채용 트랙·세부 단원 중 범위를 고르고 <strong>5~40문항</strong>으로 약점과 보완 순서를 찾습니다. 실제 기관 합격 판정이 아닙니다.</>
                      : <>전체·영역·소단원을 골라 <strong>이해도와 부족한 부분</strong>을 진단하고 바로 보완학습으로 이동합니다.</>}
              </p>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>

          <button onClick={() => mockReady && setMode('mock')}
            disabled={!mockReady}
            style={{
              width: '100%', textAlign: 'left',
              background: mockReady ? 'var(--card)' : 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px', marginBottom: 12,
              cursor: mockReady ? 'pointer' : 'default', opacity: mockReady ? 1 : 0.6,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📝</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                <span style={{ ...stepBadge, background: '#DBEAFE', color: '#1D4ED8' }}>선택 · 실전</span>{isPersonality ? '실전 모의검사' : '모의고사'}
                {course === 'job-common' && goal && ASSESS_GOALS[goal].recommend === 'mock' && <span style={goalPick}>내 목표에 맞음</span>}
                {!mockReady && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>준비 중</span>}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {isPersonality
                  ? '190문항 · 약 51분 · 총 10회 반복 검사. 실전 규모로 응시하고 상세 결과 분석을 받습니다.'
                  : mockReady
                  ? course === 'job-common'
                    ? goal === 'self'
                      ? '5영역 342문항 · 240분 인증진단 규모입니다. 1·2학년이라면 위 진단평가부터 권합니다.'
                      : '내 목표 규모입니다 — 공개된 2026 구성의 5영역 문항 수·제한시간을 반영해 영역별 또는 342문항 전체 실전을 연습합니다.'
                    : course === 'recruit-written'
                      ? '지원 분야를 고른 뒤 문항 수와 제한시간을 설정해 실제 필기처럼 응시합니다.'
                    : '영역·문항 수·제한시간을 정하고, 중간 해설 없이 실제 시험처럼 응시합니다.'
                  : '과목별 모의고사 형태로 곧 제공될 예정입니다.'}
              </p>
            </div>
            {mockReady && <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>}
          </button>

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
