/**
 * InterviewStudyScreen — 면접교재 학습 모드
 * 학습 모드(답 통합 표시) / 퀴즈 모드(직접 풀기) 토글
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import { recordActivity } from '../../lib/activity.js'
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import interviewStudy from '../../../data/interview-study.json'
import interviewQuizData from '../../../data/interview-quiz.json'
import { getSummary } from '../../lib/studySummaries.js'
import StudySummary, { buildStudySummaryCards } from './StudySummary.jsx'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { buildInterviewConceptChecks, buildInterviewLearningQuestions } from '../../lib/interviewLearning.js'
import { studyQuestionsById } from '../../lib/assessmentPartition.js'
import { Buildings, CaretRight, CheckCircle, ChatCircleText, Target } from '@phosphor-icons/react'
import InterviewCareerLab from './InterviewCareerLab.jsx'
import CompactText from '../../components/CompactText.jsx'
import { getFirstClassFormative } from '../../lib/firstClassLessons.js'
import '../../styles/interview-study.css'
import {
  INTERVIEW_FOUNDATION_COURSES,
  interviewFoundationCategories,
  interviewFoundationCourseById,
} from '../../lib/interviewFoundationCourses.js'
import { INTERVIEW_ORGANIZATIONS } from '../../lib/interviewCareerContent.js'

const { lessons } = interviewStudy
const ALL_QUIZ_QUESTIONS = interviewQuizData.questions || []
const STUDY_QUIZ_QUESTIONS = studyQuestionsById(ALL_QUIZ_QUESTIONS)

const LEVEL_COLOR = {
  '진단': '#7b8fa1', '기초': '#1e6f5c',
  '표준': '#1565c0', '심화': '#6a1b9a', '종합': '#c62828',
}
const LEVEL_BADGE_BG = {
  '진단': '#f0f4f8', '기초': '#edf9f3',
  '표준': '#e3f0ff', '심화': '#f3e5f5', '종합': '#ffebee',
}

const PHASE_COPY = {
  theory: {
    badge: '1단계 · 기준 익히기',
    description: '카드를 한 장씩 넘기며 좋은 답변의 기준과 근거를 익힙니다.',
    next: '마지막 카드에서 2단계로 바로 이어집니다.',
  },
  quiz: {
    badge: '2단계 · 답변 고쳐 고르기',
    description: '제시된 답변의 약점을 찾고, 실전 면접에 더 적합한 수정안을 고릅니다.',
    next: '각 문항의 근거를 확인한 뒤 3단계로 이어집니다.',
  },
  practice: {
    badge: '3단계 · 내 경험으로 답하기',
    description: '실제 질문에 내 경험으로 먼저 답하고, 예시와 비교해 다시 고칩니다.',
    next: '20자 이상 작성 → 예시 비교 → 다음 질문 순서로 진행합니다.',
  },
}

function referenceSectionText(section) {
  return [section?.text, ...(section?.items || []), ...(section?.rows || []).flat()]
    .filter(Boolean)
    .join(' ')
}

function buildReferenceGroups(sections = []) {
  const groups = []
  let current = null
  let parentTitle = ''

  for (const section of sections) {
    if (section.type === 'h3') {
      parentTitle = section.text || ''
      current = { title: parentTitle, parentTitle, sections: [] }
      groups.push(current)
      continue
    }
    if (section.type === 'h4') {
      current = { title: section.text || parentTitle, parentTitle, sections: [] }
      groups.push(current)
      continue
    }
    if (!current) {
      current = { title: '단원 핵심', parentTitle: '', sections: [] }
      groups.push(current)
    }
    current.sections.push(section)
  }

  return groups.filter(group => group.sections.length > 0)
}

function referenceQuery(card, summary) {
  if (!card) return summary?.intro || summary?.title || ''
  if (card.type === 'point') {
    const point = card.point || {}
    return typeof point === 'string'
      ? point
      : [point.topic, point.learn, point.sampleQuestion, point.example].filter(Boolean).join(' ')
  }
  if (card.type === 'mission') return `내 답변 작성 실습 셀프 체크 ${summary?.mustRemember?.join(' ') || ''}`
  if (card.type === 'end') return `3줄 요약 핵심 정리 ${summary?.mustRemember?.join(' ') || ''}`
  return `${summary?.intro || ''} ${summary?.keyPoints?.[0]?.topic || ''}`
}

function selectReferenceGroup(sections, card, summary) {
  const groups = buildReferenceGroups(sections)
  if (!groups.length) return null

  const query = referenceQuery(card, summary).replace(/[^0-9A-Za-z가-힣]+/g, ' ')
  const tokens = [...new Set(query.split(/\s+/).filter(token => token.length >= 2))]
  let best = groups[0]
  let bestScore = -1

  for (const group of groups) {
    const title = `${group.parentTitle} ${group.title}`.replace(/[^0-9A-Za-z가-힣]+/g, ' ')
    const body = group.sections.map(referenceSectionText).join(' ')
    const score = tokens.reduce((sum, token) => {
      if (title.includes(token)) return sum + 6
      if (body.includes(token)) return sum + 1
      return sum
    }, 0)
    if (score > bestScore) {
      best = group
      bestScore = score
    }
  }

  return best
}

export default function InterviewStudyScreen({ initialArea = null, initialLesson = null, initialStep = 0, initialInteraction = null, onBack, onLearningContext }) {
  const [careerSection, setCareerSection] = useState(null)
  const [category,    setCategory]    = useState(initialArea)
  const [lessonId,    setLessonId]    = useState(initialLesson)
  const [view,           setView]           = useState('theory')
  const [practiceIdx,    setPracticeIdx]    = useState(0)
  const [showModel,      setShowModel]      = useState(false)
  const [showReference,  setShowReference]  = useState(false)
  const [theoryStep,     setTheoryStep]     = useState(initialStep)
  const [theoryInteraction, setTheoryInteraction] = useState(initialInteraction || {})
  const [quizChecked, setQuizChecked] = useState(false)
  const [phaseDone, setPhaseDone] = useState({ theory: false, quiz: false, practice: false })
  const [showReviewOnly, setShowReviewOnly] = useState(false)
  const [ivProgress, setIvProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('iv_progress') || '{}') }
    catch { return {} }
  })

  function markLessonProgress(id, status) {
    const next = { ...ivProgress, [id]: status }
    setIvProgress(next)
    localStorage.setItem('iv_progress', JSON.stringify(next))
  }

  const lesson = lessonId ? lessons.find(l => l.id === lessonId) : null

  // Keep these objects stable while teacher support state is updating. StudySummary
  // intentionally restarts when its summary or question set changes identity.
  const lessonQuizQuestions = useMemo(
    () => lesson ? buildInterviewConceptChecks(lesson, STUDY_QUIZ_QUESTIONS) : [],
    [lesson],
  )
  const lessonSummary = useMemo(() => lesson ? getSummary(`iv:${lesson.id}`) : null, [lesson])
  const theorySummary = useMemo(
    () => lessonSummary ? { ...lessonSummary, courseKind: 'interview' } : null,
    [lessonSummary],
  )
  const interviewLearningQuestions = useMemo(
    () => lesson ? buildInterviewLearningQuestions(lesson, STUDY_QUIZ_QUESTIONS) : [],
    [lesson],
  )
  const practiceQuestions = useMemo(
    () => interviewLearningQuestions.filter(question => question.isInterview).map(question => ({
      ...question,
      question: question.question || question.stem,
      structHint: question.structHint || question.context,
      hints: question.hints?.length ? question.hints : question.answerPoints,
    })),
    [interviewLearningQuestions],
  )
  const formativeAssessment = useMemo(
    () => getFirstClassFormative('interview', { areaId: category, lessonId }),
    [category, lessonId],
  )
  const theoryCards = useMemo(
    () => theorySummary ? buildStudySummaryCards(theorySummary, interviewLearningQuestions, undefined, undefined, formativeAssessment) : [],
    [theorySummary, interviewLearningQuestions, formativeAssessment],
  )
  const activeTheoryCard = theoryCards[theoryStep] || theoryCards[0] || null
  const activeReference = useMemo(
    () => lesson ? selectReferenceGroup(lesson.sections, activeTheoryCard, theorySummary) : null,
    [activeTheoryCard, lesson, theorySummary],
  )

  const selectedCourse = interviewFoundationCourseById(category)
  const catLessons = useMemo(() => {
    const categories = interviewFoundationCategories(category)
    return categories.length ? lessons.filter(lesson => categories.includes(lesson.category)) : []
  }, [category])

  useEffect(() => {
    const careerLabel = {
      pathways: '지원처별 면접 심화',
      institutions: '기업·기관 연구소',
      scripts: '답변 연결실',
      cover: '자기소개서 연결',
    }[careerSection]
    const activeInteraction = theoryInteraction.step === theoryStep ? theoryInteraction : null
    const activeQuestion = view === 'quiz'
      ? lessonQuizQuestions[practiceIdx] || null
      : view === 'practice'
        ? practiceQuestions[practiceIdx] || null
        : null
    onLearningContext?.({
      subject: 'interview',
      mode: 'study',
      stage: lesson ? (view === 'theory' ? activeTheoryCard?.type || 'concept' : 'question') : category ? 'lesson-choice' : careerSection ? 'concept' : 'area-choice',
      areaId: category,
      areaLabel: careerLabel || selectedCourse?.label || '고졸 공정채용 면접',
      lessonId,
      lessonLabel: lesson?.title || careerLabel || (category ? '단원 선택' : '학습 범위 선택'),
      title: lesson?.title || careerLabel || selectedCourse?.label,
      position: view === 'theory' ? theoryStep + 1 : practiceIdx + 1,
      step: view === 'theory' ? theoryStep : null,
      total: view === 'theory' ? theoryCards.length : view === 'quiz' ? lessonQuizQuestions.length : practiceQuestions.length,
      revealed: view === 'quiz' ? quizChecked : Boolean(activeInteraction?.revealed),
      questionId: activeQuestion?.id || null,
      content: view === 'theory' && theorySummary
        ? { kind: 'summary', summary: theorySummary, card: activeTheoryCard, interaction: activeInteraction }
        : activeQuestion
          ? { kind: 'question', question: activeQuestion }
          : null,
    })
  }, [activeTheoryCard, careerSection, category, lesson?.title, lessonId, lessonQuizQuestions, onLearningContext, practiceIdx, practiceQuestions, quizChecked, selectedCourse?.label, theoryCards.length, theoryInteraction, theoryStep, theorySummary, view])

  function openLesson(id) {
    setLessonId(id); setView('theory')
    setPracticeIdx(0); setShowModel(false); setShowReference(false); setTheoryStep(0); setTheoryInteraction({}); setQuizChecked(false); setPhaseDone({ theory: false, quiz: false, practice: false })
  }
  function goBack() {
    if (lessonId) { setLessonId(null); return }
    setCategory(null)
  }

  // Android 뒤로가기: 단원/카테고리 단계 → 그 다음 교재 목록
  const backRef = useRef(null)
  backRef.current = () => {
    if (careerSection) { setCareerSection(null); return }
    if (lessonId || category) { goBack(); return }
    onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  function switchView(v) {
    setView(v)
    setPracticeIdx(0); setShowModel(false); setShowReference(false); setQuizChecked(false)
  }

  if (careerSection) {
    return <InterviewCareerLab
      section={careerSection}
      onLearningContext={onLearningContext}
      onBack={() => setCareerSection(null)}
      onOpenCover={() => setCareerSection('cover')}
    />
  }

  // ── 카테고리 선택 ─────────────────────────────────────────────────────
  if (!category) {
    return (
      <div className="screen">
        <div className="appbar">
          {onBack && <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>}
          <span className="appbar-title">🎤 면접 학습</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lessons.length}개 단원</span>
        </div>
        <div className="screen-body">
          <div className="interview-study-hero">
            <img src={`${import.meta.env.BASE_URL}images/learning/workplace-interview.webp`} alt="직무 면접을 준비하는 특성화고 학생" />
            <div><strong>기초부터 지원처별 실전까지</strong><span>면접·기업연구·답변 첨삭을 한 흐름으로 완성</span></div>
          </div>
          <p className="section-title">먼저 · 기초 면접 6개 과정 · {lessons.length}단원</p>
          <div className="interview-foundation-course-list">
            {INTERVIEW_FOUNDATION_COURSES.map((course, courseIndex) => {
              const catL = lessons.filter(lesson => course.categories.includes(lesson.category))
              const cnt = catL.length
              const doneCount   = catL.filter(l => ivProgress[l.id] === 'done').length
              const reviewCount = catL.filter(l => ivProgress[l.id] === 'review').length
              const progressPct = cnt > 0 ? Math.round(doneCount / cnt * 100) : 0
              return (
                <button key={course.id} onClick={() => { setCategory(course.id); setShowReviewOnly(false) }}>
                  <span className="interview-foundation-course-index">{courseIndex + 1}</span>
                  <span className="interview-foundation-course-copy">
                    <strong>{course.label}</strong>
                    <small>{course.description}</small>
                    <span className="interview-foundation-course-meta">
                      <b>{cnt}개 단원</b>
                      {doneCount > 0 && <em><CheckCircle size={13} weight="fill" /> 완료 {doneCount}</em>}
                      {reviewCount > 0 && <em className="is-review">복습 {reviewCount}</em>}
                    </span>
                    <i><span style={{ width: `${progressPct}%` }} /></i>
                  </span>
                  <CaretRight size={18} />
                </button>
              )
            })}
          </div>
          <p className="section-title" style={{ marginTop: 20 }}>기초 학습 다음 단계</p>
          <div className="interview-career-entry-list">
            <button onClick={() => setCareerSection('pathways')}><Target size={22} weight="duotone" /><span><strong>1 · 지원처별 면접 심화</strong><small>금융권 · 공공기관 · 대기업 요구 파악</small></span><b>→</b></button>
            <button onClick={() => setCareerSection('institutions')}><Buildings size={22} weight="duotone" /><span><strong>2 · 기업·기관 연구소</strong><small>{INTERVIEW_ORGANIZATIONS.length}곳 맞춤 근거·모범답안·공식자료 점검</small></span><b>→</b></button>
            <button onClick={() => setCareerSection('scripts')}><ChatCircleText size={22} weight="duotone" /><span><strong>3 · 답변 연결실</strong><small>자기소개서 기반 1분 자기소개 · 지원동기 · 마지막 한마디</small></span><b>→</b></button>
          </div>
        </div>
      </div>
    )
  }

  // ── 단원 목록 ─────────────────────────────────────────────────────────
  if (!lessonId) {
    const hasReviewLessons = catLessons.some(l => ivProgress[l.id] === 'review')
    const displayLessons   = showReviewOnly ? catLessons.filter(l => ivProgress[l.id] === 'review') : catLessons
    const PROG_STYLE = {
      done:    { bg: '#d1fae5', color: '#065f46', label: '✓ 완료' },
      partial: { bg: '#fef3c7', color: '#92400e', label: '△ 일부' },
      review:  { bg: '#fee2e2', color: '#991b1b', label: '❌ 복습' },
    }
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">{selectedCourse?.label ?? category}</span>
          {hasReviewLessons && (
            <button onClick={() => setShowReviewOnly(v => !v)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none',
                background: showReviewOnly ? '#fee2e2' : 'var(--bg)',
                color: showReviewOnly ? '#991b1b' : 'var(--text-muted)',
                fontWeight: 700, cursor: 'pointer',
              }}>
              {showReviewOnly ? '❌ 복습만' : '복습 필터'}
            </button>
          )}
        </div>
        <div className="screen-body">
          {displayLessons.map(l => {
            const prog = ivProgress[l.id]
            const pc   = PROG_STYLE[prog]
            const conceptCount = buildInterviewConceptChecks(l, STUDY_QUIZ_QUESTIONS).length
            const practiceCount = buildInterviewLearningQuestions(l, STUDY_QUIZ_QUESTIONS)
              .filter(question => question.isInterview).length
            return (
              <button key={l.id} onClick={() => openLesson(l.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'var(--card)',
                  border: `1px solid ${prog === 'review' ? '#fca5a5' : 'var(--border)'}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span className="interview-foundation-category">{l.category}</span>
                    <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                      {l.title}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: LEVEL_BADGE_BG[l.level] ?? '#f0f4f8',
                        color: LEVEL_COLOR[l.level] ?? '#666',
                      }}>{l.level}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.durationMin}분</span>
                      {(conceptCount > 0 || practiceCount > 0) && (
                        <span style={{ fontSize: 12, color: 'var(--primary)' }}>
                          답변 고쳐 고르기 {conceptCount} · 내 경험으로 답하기 {practiceCount}
                        </span>
                      )}
                      {pc && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: pc.bg, color: pc.color }}>
                          {pc.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 단원 학습 ─────────────────────────────────────────────────────────
  const hasQuiz = lessonQuizQuestions.length > 0
  const hasPractice = practiceQuestions.length > 0

  const TABS = [
    { id: 'theory', label: '기준 익히기' },
    ...(hasQuiz ? [{ id: 'quiz', label: '답변 고쳐 고르기', count: `${lessonQuizQuestions.length}문항` }] : []),
    ...(hasPractice ? [{ id: 'practice', label: '내 경험으로 답하기', count: `${practiceQuestions.length}질문` }] : []),
  ]
  const activePhaseIndex = TABS.findIndex(tab => tab.id === view)

  return (
    <div className="screen interview-study-unit">
      <div className="appbar interview-study-unit-head">
        <div className="interview-study-unit-titlebar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">{lesson.title}</span>
          <span className="interview-study-level" style={{
            background: LEVEL_BADGE_BG[lesson.level] ?? '#f0f4f8',
            color: LEVEL_COLOR[lesson.level] ?? '#666',
          }}>{lesson.level}</span>
        </div>

        {/* 이동 메뉴가 아니라 한 방향 학습의 현재 위치를 보여 주는 진행표임. */}
        {TABS.length > 1 && (
          <ol className="interview-study-unit-tabs" aria-label="면접 단원 학습 순서"
            style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
            {TABS.map((t, index) => (
              <li key={t.id} aria-current={view === t.id ? 'step' : undefined}
                className={`${view === t.id ? 'is-active' : ''} ${phaseDone[t.id] ? 'is-done' : ''} ${index > activePhaseIndex && !phaseDone[t.id] ? 'is-upcoming' : ''}`}>
                <span><b>{index + 1}</b>{t.label}</span>
                <small>{phaseDone[t.id] ? '완료' : view === t.id ? '지금 진행' : `${index - activePhaseIndex}단계 뒤`}</small>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={`interview-study-phase-note is-${view}`}>
        <strong>{PHASE_COPY[view].badge}</strong>
        <div><span>{PHASE_COPY[view].description}</span><small>{PHASE_COPY[view].next}</small></div>
      </div>

      {/* 이론 본문 */}
      {view === 'theory' && (
        <div className="interview-study-theory">
          {lessonSummary && (
            <div className="interview-study-summary-wrap">
              <StudySummary
                summary={theorySummary}
                questions={interviewLearningQuestions}
                formativeAssessment={formativeAssessment}
                initialStep={initialStep}
                initialInteraction={initialInteraction}
                onStepChange={setTheoryStep}
                onInteractionChange={setTheoryInteraction}
                introStartLabel="1단계 기준 익히기 시작 →"
                startQuizLabel={hasQuiz ? `2단계 답변 고쳐 고르기 ${lessonQuizQuestions.length}문항 →` : `3단계 내 경험으로 답하기 ${practiceQuestions.length}질문 →`}
                onStartQuiz={(hasQuiz || hasPractice) ? () => { setPhaseDone(current => ({ ...current, theory: true })); switchView(hasQuiz ? 'quiz' : 'practice') } : null}
              />
            </div>
          )}
          {lessonSummary && theoryStep > 0 && activeReference && (
            <button className="interview-reference-toggle" type="button" aria-expanded={showReference}
              onClick={() => setShowReference(open => !open)}>
              <span>{showReference ? '현재 카드 보충자료 접기' : '현재 카드 보충자료 보기'}</span>
              <small>{activeReference.title}</small>
            </button>
          )}
          {lessonSummary && theoryStep > 0 && showReference && activeReference && (
            <CurrentReference group={activeReference} step={theoryStep} total={theoryCards.length} />
          )}
          {!lessonSummary && (
            <div className="interview-current-reference is-full-fallback">
              {lesson.sections.map((sec, i) => <SectionBlock key={i} sec={sec} />)}
            </div>
          )}
        </div>
      )}

      {/* 답변 고쳐 고르기 */}
      {view === 'quiz' && hasQuiz && (
        <InterviewQuizView
          questions={lessonQuizQuestions}
          lessonId={lesson.id}
          onMarkProgress={markLessonProgress}
          onQuestionChange={setPracticeIdx}
          onRevealChange={setQuizChecked}
          onReturnToTheory={() => switchView('theory')}
          onStartPractice={hasPractice ? () => switchView('practice') : null}
          onComplete={() => setPhaseDone(current => ({ ...current, quiz: true }))}
        />
      )}

      {/* 실습 문항 */}
      {view === 'practice' && hasPractice && (
        <PracticeView
          questions={practiceQuestions}
          idx={practiceIdx}
          setIdx={(i) => { setPracticeIdx(i); setShowModel(false) }}
          showModel={showModel}
          setShowModel={setShowModel}
          lessonId={lesson.id}
          onMarkProgress={markLessonProgress}
          summaryTips={lessonSummary?.tips}
          onReturnToTheory={() => switchView('theory')}
          onComplete={() => setPhaseDone(current => ({ ...current, practice: true }))}
        />
      )}
    </div>
  )
}

function CurrentReference({ group, step, total }) {
  const visibleSections = group.sections.slice(0, 10)
  return (
    <aside className="interview-current-reference" aria-label="현재 카드 보충자료">
      <header>
        <div>
          <span>현재 카드 {Math.min(step + 1, total)}/{total} 보충</span>
          <h3>{group.title}</h3>
        </div>
        {group.parentTitle && group.parentTitle !== group.title && <small>{group.parentTitle}</small>}
      </header>
      <div className="interview-current-reference-body">
        {visibleSections.map((section, index) => <SectionBlock key={index} sec={section} />)}
      </div>
      {group.sections.length > visibleSections.length && (
        <p className="interview-current-reference-note">
          이 단계에 필요한 핵심만 표시했습니다. 작성 실습과 사례 비교는 뒤의 학습 단계에서 이어집니다.
        </p>
      )}
    </aside>
  )
}

// ── 좋은 답변 클릭 토글 블록 ────────────────────────────────────────────────
function GoodAnswerBlock({ sec }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid #b9d4c2', borderRadius: 10,
      margin: '10px 0', overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', textAlign: 'left', padding: '10px 14px',
        background: '#f3faf5', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e6f5c' }}>
          ✅ 좋은 답변 보기 {sec.title ? `· ${sec.title.replace(/✅\s*/, '')}` : ''}
        </span>
        <span style={{ color: '#1e6f5c', fontSize: 13, flexShrink: 0, marginLeft: 8 }}>
          {open ? '▲ 접기' : '▼ 열기'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #b9d4c2', background: '#fff' }}>
          <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: '#1b5e20' }}>
            {sec.text}
          </p>
        </div>
      )}
    </div>
  )
}

// ── 이론 섹션 블록 렌더러 ────────────────────────────────────────────────────
function SectionBlock({ sec }) {
  switch (sec.type) {
    case 'h3':
      return (
        <h3 style={{
          fontSize: 15, fontWeight: 800, color: '#1e4d3f',
          borderLeft: '4px solid var(--primary)', paddingLeft: 10,
          margin: '20px 0 10px',
        }}>{sec.text}</h3>
      )
    case 'h4':
      return (
        <p style={{ fontSize: 14, fontWeight: 700, color: '#164e63', margin: '14px 0 6px' }}>
          {sec.text}
        </p>
      )
    case 'p':
      return (
        <p style={{ fontSize: 13, lineHeight: 1.8, margin: '6px 0', color: 'var(--text)' }}>
          {sec.text}
        </p>
      )
    case 'ul':
      return (
        <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
          {sec.items.map((item, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '3px 0' }}>{item}</li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol style={{ paddingLeft: 20, margin: '6px 0' }}>
          {sec.items.map((item, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '3px 0' }}>{item}</li>
          ))}
        </ol>
      )
    case 'blockquote':
      return (
        <div style={{
          borderLeft: '4px solid var(--primary)', background: '#edf9f3',
          padding: '10px 14px', margin: '10px 0', borderRadius: '0 8px 8px 0',
        }}>
          <CompactText text={sec.text} maxItemChars={68} style={{ fontSize: 13 }} />
        </div>
      )
    case 'pre':
      return (
        <div style={{
          background: '#f6f8fa', border: '1px solid var(--border)',
          borderLeft: '4px solid var(--primary)', borderRadius: '0 8px 8px 0',
          padding: '10px 14px', margin: '10px 0',
        }}>
          <p style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {sec.text}
          </p>
        </div>
      )
    case 'table':
      return (
        <div style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {sec.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      border: '1px solid var(--border)', padding: '8px 10px',
                      background: ri === 0 ? 'var(--primary-light)' : 'var(--card)',
                      fontWeight: ri === 0 ? 700 : 400,
                    }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'summary3':
      return (
        <div style={{ margin: '10px 0' }}>
          {sec.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 12px', marginBottom: 6,
              background: '#f8fcfa', borderRadius: 8,
              border: '1px solid rgba(15,118,110,0.18)',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)',
                color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
              }}>{i + 1}</span>
              <CompactText text={item} maxItemChars={68} style={{ fontSize: 13 }} />
            </div>
          ))}
        </div>
      )
    case 'good_answer':
      return <GoodAnswerBlock sec={sec} />
    case 'hr':
      return <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
    default:
      return null
  }
}


// 답변 초안은 기기에만 둔다. 면접 답변은 개인적인 내용이고, 서버로 보내면
// 학생이 솔직하게 못 쓴다. localStorage 가 막힌 환경에서도 화면은 떠야 한다.
const DRAFT_KEY = id => `gyo6.iv.draft.${id}`
const CHECK_KEY = id => `gyo6.iv.check.${id}`
function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 저장 실패는 무시 */ }
}
const loadDrafts = id => loadJson(DRAFT_KEY(id))
const loadChecks = id => loadJson(CHECK_KEY(id))

// ── 실습 문항 뷰 ──────────────────────────────────────────────────────────────
function PracticeView({ questions, idx, setIdx, showModel, setShowModel, lessonId, onMarkProgress, summaryTips, onReturnToTheory, onComplete }) {
  const [practiceDone, setPracticeDone]   = useState(false)
  const [selfEvalSaved, setSelfEvalSaved] = useState(null)
  // 답변 초안과 채점 기준 체크. 문항마다 따로 보관하고 기기에만 남긴다
  // (서버 왕복 없음). 면접 답변은 개인적인 내용이라 밖으로 내보내지 않는다.
  const [drafts, setDrafts]   = useState(() => loadDrafts(lessonId))
  const [checked, setChecked] = useState(() => loadChecks(lessonId))

  const pq    = questions[idx]
  const total = questions.length
  const activeDraft = (drafts[pq?.id ?? idx] || '').trim()
  const draftReady = activeDraft.length >= 20
  const comparisonDone = draftReady && showModel

  // ── 실습 완료 화면 ─────────────────────────────────────────────────────
  if (practiceDone) {
    return (
      <div className="interview-study-activity interview-study-practice is-complete" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>내 답변 연습 완료!</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          총 <strong>{total}개 질문</strong>에 내 경험으로 직접 답했습니다.
        </p>

        {onMarkProgress && (
          <div style={{ width: '100%', maxWidth: 320, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>이 단원 자기평가</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { s: 'done',    emoji: '✅', label: '완료',  bg: '#d1fae5', color: '#065f46', sub: '잘 이해했어요' },
                { s: 'partial', emoji: '📝', label: '일부',  bg: '#fef3c7', color: '#92400e', sub: '일부 어려워요' },
                { s: 'review',  emoji: '🔄', label: '복습',  bg: '#fee2e2', color: '#991b1b', sub: '다시 봐야해요' },
              ].map(({ s, emoji, label, bg, color, sub }) => (
                <button key={s}
                  onClick={() => { onMarkProgress(lessonId, s); setSelfEvalSaved(s) }}
                  style={{
                    padding: '10px 6px', borderRadius: 10,
                    border: `2px solid ${selfEvalSaved === s ? color : 'transparent'}`,
                    background: selfEvalSaved === s ? bg : 'var(--card)',
                    color: selfEvalSaved === s ? color : 'var(--text)',
                    cursor: 'pointer', textAlign: 'center',
                  }}>
                  <p style={{ fontSize: 18 }}>{emoji}</p>
                  <p style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{label}</p>
                  <p style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>{sub}</p>
                </button>
              ))}
            </div>
            {selfEvalSaved && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>✓ 저장되었습니다</p>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <button className="btn btn-primary btn-full"
            onClick={() => { setIdx(0); setPracticeDone(false); setSelfEvalSaved(null) }}>
            다시 연습하기
          </button>
          <button className="btn btn-secondary btn-full"
            onClick={onReturnToTheory}>
            ← 학습 내용 다시 보기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-study-activity interview-study-practice" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>

      {/* 단원 학습 팁 */}
      {summaryTips?.length > 0 && <TipsBox tips={summaryTips} />}

      {/* 문항 번호는 이동 버튼이 아니라 현재 위치를 알려 주는 진행표임. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          실습 {idx + 1} / {total}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {questions.map((_, i) => (
            <span key={i} aria-current={i === idx ? 'step' : undefined}
              style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: `2px solid ${i === idx ? 'var(--primary)' : 'var(--border)'}`,
                background: i === idx ? 'var(--primary)' : 'var(--card)',
                color: i === idx ? '#fff' : 'var(--text-muted)',
                display: 'grid', placeItems: 'center',
              }}>{i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* 제목 */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{pq.h4}</p>

      {/* 면접 질문 */}
      <div style={{
        background: 'var(--card)', border: '2px solid var(--primary)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 14,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
          🎤 면접 질문
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8 }}>
          "{pq.question}"
        </p>
      </div>

      {/* 구조 힌트 */}
      {pq.structHint && (
        <div style={{
          background: '#f6f8fa', borderLeft: '4px solid var(--primary)',
          borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
            📐 답변 구조 힌트
          </p>
          <p style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {pq.structHint}
          </p>
        </div>
      )}

      {/* 힌트 목록 */}
      {pq.hints?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            💡 답변 포인트
          </p>
          {pq.hints.map((h, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '6px 0',
              borderBottom: i < pq.hints.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>•</span>
              <CompactText text={h} maxItemChars={68} style={{ fontSize: 13 }} />
            </div>
          ))}
        </div>
      )}

      {/* 셀프 체크 */}
      {pq.checkboxes?.length > 0 && (
        <div style={{
          background: '#fff8df', borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, border: '1px solid #ffc107',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#856404', marginBottom: 8 }}>
            ☑️ 답변 점검
          </p>
          {pq.checkboxes.map((cb, i) => {
            const on = !!checked[`${pq.id ?? idx}:${i}`]
            return (
              <button key={i} type="button" aria-pressed={on}
                onClick={() => {
                  const next = { ...checked, [`${pq.id ?? idx}:${i}`]: !on }
                  setChecked(next); saveJson(CHECK_KEY(lessonId), next)
                }}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%',
                  minHeight: 44, padding: '8px 4px', background: 'none', border: 0,
                  textAlign: 'left', cursor: 'pointer',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: on ? '#166534' : '#856404' }}>
                  {on ? '☑' : '□'}
                </span>
                <span style={{
                  fontSize: 12, lineHeight: 1.7, color: '#3e3422',
                  textDecoration: on ? 'line-through' : 'none', opacity: on ? 0.65 : 1,
                }}>{cb}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 답변을 직접 써 보는 칸.
          채점 기준과 모범답안은 있는데 정작 답을 쓸 곳이 없었다 — 머릿속으로만
          생각하고 모범답안을 보면 자기 답과 무엇이 다른지 비교가 안 된다. */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor={`iv-draft-${idx}`}
          style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          ✍️ 내 답변 <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
            — 먼저 써 본 뒤 모범답안과 견줘 보세요. 이 기기에만 저장됩니다.
          </span>
        </label>
        <textarea
          id={`iv-draft-${idx}`}
          value={drafts[pq.id ?? idx] || ''}
          onChange={e => {
            const next = { ...drafts, [pq.id ?? idx]: e.target.value }
            setDrafts(next); saveJson(DRAFT_KEY(lessonId), next)
          }}
          placeholder="위 구조 힌트를 참고해 소리 내어 말하듯 적어 보세요."
          rows={5}
          style={{
            width: '100%', padding: '11px 12px', fontSize: 14, lineHeight: 1.65,
            border: '1px solid var(--border)', borderRadius: 10, resize: 'vertical',
            fontFamily: 'inherit', background: 'var(--card)', color: 'var(--text)',
          }} />
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
          {activeDraft.length}자 · 20자 이상 쓰면 예시와 비교할 수 있어요
          {activeDraft.length >= 150 && ' · 1분 30초 분량에 가까워요'}
        </p>
      </div>

      {/* 먼저 답을 떠올린 뒤 모범답안을 펼친다. */}
      {!showModel ? (
        <button
          type="button"
          className="btn btn-secondary btn-full"
          aria-expanded="false"
          disabled={!draftReady}
          style={{ marginBottom: 14 }}
          onClick={() => setShowModel(true)}
        >
          {draftReady ? '📖 내 답변과 예시 비교하기' : '내 답변을 20자 이상 먼저 작성해 주세요'}
        </button>
      ) : (
        <ModelAnswerBlock pq={pq} />
      )}
      {!showModel && !(drafts[pq.id ?? idx] || '').trim() && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -8, marginBottom: 14, textAlign: 'center' }}>
          먼저 내 답을 써 보면 모범답안이 훨씬 잘 들어옵니다.
        </p>
      )}

      {/* 이전 / 다음 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }}
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}>← 이전</button>
        {idx === total - 1 ? (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}
            disabled={!comparisonDone}
            onClick={() => { setPracticeDone(true); onComplete?.(); recordActivity('quiz') }}>
            {comparisonDone ? '답변 연습 마치기' : '예시 비교 후 마칠 수 있어요'}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }}
            disabled={!comparisonDone}
            onClick={() => setIdx(idx + 1)}>{comparisonDone ? '다음 질문 →' : '예시 비교 후 다음으로'}</button>
        )}
      </div>
    </div>
  )
}

// ── 단원 팁 접이식 박스 ───────────────────────────────────────────────────────
function TipsBox({ tips }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 14, border: '1px solid #fca5a5', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', textAlign: 'left', padding: '9px 13px',
        background: '#fff1f2', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#be123c' }}>💡 이 단원 학습 팁 ({tips.length}개)</span>
        <span style={{ fontSize: 12, color: '#be123c' }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div style={{ padding: '10px 13px', background: '#fff' }}>
          {tips.map((t, i) => (
            <p key={i} style={{ fontSize: 12, lineHeight: 1.75, marginBottom: i < tips.length - 1 ? 8 : 0, color: 'var(--text)' }}>
              • {t}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function blindSafeModelAnswer(text) {
  return String(text || '')
    .replace(/(?:OO|○○)고(?:등학교)?\s*(?:OO|○○)과\s*출신/g, '전공 교육 과정을 이수한')
    .replace(/(?:OO|○○)고(?:등학교)?\s*(?:OO|○○)과에서/g, '전공 교육 과정에서')
    .replace(/(?:OO|○○)고(?:등학교)?\s*([가-힣A-Za-z·]+과)에서/g, '$1 교육 과정에서')
    .replace(/(?:OO|○○)고(?:등학교)?/g, '재학 과정')
}

// ── 모범답안 블록 (학습/퀴즈 공용) ────────────────────────────────────────────
function ModelAnswerBlock({ pq }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {pq.modelAnswer && (
        <div style={{
          background: '#fff8df', border: '1px solid #ffc107',
          borderRadius: 10, padding: '12px 14px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#856404', marginBottom: 8 }}>
            📖 모범답안
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
            {blindSafeModelAnswer(pq.modelAnswer)}
          </p>
        </div>
      )}

      {pq.answerPoints?.length > 0 && (
        <div style={{
          background: '#edf9f3', border: '1px solid #b9d4c2',
          borderRadius: 10, padding: '10px 14px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e6f5c', marginBottom: 8 }}>
            ✅ 핵심 포인트
          </p>
          {pq.answerPoints.map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
              <CompactText text={pt} maxItemChars={68} style={{ fontSize: 12 }} />
            </div>
          ))}
        </div>
      )}

      {!pq.modelAnswer && !pq.answerPoints?.length && (
        <div style={{
          background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            이 문항은 개인 경험 기반 자유 답변 문항입니다.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            위 힌트와 체크 기준을 참고해 자신만의 답변을 완성하세요.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 답변 고쳐 고르기 (선다형) ──────────────────────────────────────────────
function InterviewQuizView({ questions, lessonId, onMarkProgress, onQuestionChange, onRevealChange, onReturnToTheory, onStartPractice, onComplete }) {
  const [idx, setIdx]               = useState(0)
  const [selected, setSelected]     = useState(null)
  const [checked, setChecked]       = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [selfEvalSaved, setSelfEvalSaved] = useState(null)

  const q = questions[idx]
  const isOx = q?.type === 'ox'
  const total = questions.length

  useEffect(() => { onQuestionChange?.(idx) }, [idx, onQuestionChange])
  useEffect(() => { onRevealChange?.(checked) }, [checked, onRevealChange])

  if (quizCompleted) {
    const accuracy = total > 0 ? Math.round(correctCount / total * 100) : 0
    return (
      <div className="interview-study-activity interview-study-quiz is-complete" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>
          {accuracy >= 80 ? '🎉' : accuracy >= 50 ? '💪' : '📚'}
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>답변 고쳐 고르기 완료!</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { label: '적절한 수정', val: correctCount,         bg: '#d1fae5', color: '#065f46' },
            { label: '다시 볼 선택', val: total - correctCount, bg: '#fee2e2', color: '#991b1b' },
            { label: '적용률',       val: `${accuracy}%`,       bg: '#e0f2fe', color: '#0369a1' },
          ].map(({ label, val, bg, color }) => (
            <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 14px', minWidth: 72 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color }}>{val}</p>
              <p style={{ fontSize: 12, color, marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {onMarkProgress && (
          <div style={{ width: '100%', maxWidth: 320, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>이 단원 자기평가</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { s: 'done',    emoji: '✅', label: '완료',  bg: '#d1fae5', color: '#065f46', sub: '잘 알았어요' },
                { s: 'partial', emoji: '📝', label: '일부',  bg: '#fef3c7', color: '#92400e', sub: '보완 필요' },
                { s: 'review',  emoji: '🔄', label: '복습',  bg: '#fee2e2', color: '#991b1b', sub: '다시 봐야해요' },
              ].map(({ s, emoji, label, bg, color, sub }) => (
                <button key={s}
                  onClick={() => { onMarkProgress(lessonId, s); setSelfEvalSaved(s) }}
                  style={{
                    padding: '10px 6px', borderRadius: 10,
                    border: `2px solid ${selfEvalSaved === s ? color : 'transparent'}`,
                    background: selfEvalSaved === s ? bg : 'var(--card)',
                    color: selfEvalSaved === s ? color : 'var(--text)',
                    cursor: 'pointer', textAlign: 'center',
                  }}>
                  <p style={{ fontSize: 18 }}>{emoji}</p>
                  <p style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{label}</p>
                  <p style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>{sub}</p>
                </button>
              ))}
            </div>
            {selfEvalSaved && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>✓ 저장되었습니다</p>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          {accuracy < 80 && (
            <button className="btn btn-secondary btn-full" onClick={onReturnToTheory}>
              ← 학습 내용 다시 보기
            </button>
          )}
          <button className="btn btn-primary btn-full"
            onClick={onStartPractice || (() => { setIdx(0); setCorrectCount(0); setQuizCompleted(false); setSelfEvalSaved(null); setSelected(null); setChecked(false) })}>
            {onStartPractice ? '3단계 내 경험으로 답하기 →' : '다시 확인하기'}
          </button>
        </div>
      </div>
    )
  }

  if (!q) return null

  function handleSelect(val) {
    if (checked) return
    setSelected(val)
  }

  function handleCheck() {
    if (!selected) return
    setChecked(true)
    const correct = selected === q.answer
    if (correct) setCorrectCount(c => c + 1)
    else saveWrongAnswer(q, 'interview', selected)
  }

  function next() {
    setIdx(i => Math.min(total - 1, i + 1))
    setSelected(null); setChecked(false)
  }
  function prev() {
    setIdx(i => Math.max(0, i - 1))
    setSelected(null); setChecked(false)
  }

  const correct = checked && selected === q.answer

  return (
    <div className="interview-study-activity interview-study-quiz" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
      {/* 진행바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${total > 1 ? (idx / (total-1)) * 100 : 100}%`, background: 'var(--primary)', borderRadius: 999 }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{idx+1}/{total}</span>
      </div>

      {/* 문항 */}
      <div className="card" style={{ marginBottom: 12 }}>
        {q.context && (
          <div style={{ background: '#f0f4ff', border: '1px solid #c7d7f5', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#3b5bdb', marginBottom: 4 }}>📋 현재 답변 상황</p>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#1a237e' }}>{q.context}</p>
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.6, marginBottom: 14 }}>{q.stem}</p>

        {/* OX 버튼 */}
        {isOx && (
          <div style={{ display: 'flex', gap: 10 }}>
            {['O', 'X'].map(v => {
              const isSel = selected === v
              const isRight = checked && v === q.answer
              const isWrong = checked && isSel && v !== q.answer
              return (
                <button key={v} onClick={() => handleSelect(v)}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: 24, fontWeight: 900,
                    borderRadius: 12, border: '2px solid',
                    borderColor: isRight ? 'var(--success)' : isWrong ? 'var(--danger)' : isSel ? 'var(--primary)' : 'var(--border)',
                    background: isRight ? '#dcfce7' : isWrong ? '#fee2e2' : isSel ? 'var(--primary-light)' : 'var(--bg)',
                    color: isRight ? 'var(--success)' : isWrong ? 'var(--danger)' : isSel ? 'var(--primary)' : 'var(--text)',
                    cursor: checked ? 'default' : 'pointer',
                  }}>
                  {v === 'O' ? '⭕' : '❌'}
                </button>
              )
            })}
          </div>
        )}

        {/* 선다형 보기 */}
        {!isOx && (q.choices || []).map((c, ci) => {
          const letter = String.fromCharCode(65 + ci)
          const isSel  = selected === letter
          const isRight = checked && letter === q.answer
          const isWrong = checked && isSel && letter !== q.answer
          return (
            <button key={ci} onClick={() => handleSelect(letter)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 13px',
                borderRadius: 10, border: '1.5px solid',
                borderColor: isRight ? 'var(--success)' : isWrong ? 'var(--danger)' : isSel ? 'var(--primary)' : 'var(--border)',
                background: isRight ? '#dcfce7' : isWrong ? '#fee2e2' : isSel ? 'var(--primary-light)' : 'var(--card)',
                color: isRight ? 'var(--success)' : isWrong ? 'var(--danger)' : isSel ? 'var(--primary)' : 'var(--text)',
                marginBottom: 8, cursor: checked ? 'default' : 'pointer',
                fontWeight: isSel || isRight ? 700 : 400, fontSize: 13,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
              {/* 고르는 값은 A~E 로 저장하되 화면에는 번호로 — 해설이 "2번"이라고 말한다. */}
              <span style={{ fontWeight: 800, flexShrink: 0 }}>{ci + 1}.</span>
              <span style={{ lineHeight: 1.5 }}>{c}</span>
            </button>
          )
        })}
      </div>

      {/* 정답 확인 / 해설 */}
      {!checked && selected && (
        <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }}
          onClick={handleCheck}>
          ✅ 확인
        </button>
      )}

      {checked && (
        <div style={{
          background: correct ? '#f0fdf4' : '#fff7f7',
          border: `1px solid ${correct ? '#86efac' : '#fca5a5'}`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: correct ? 'var(--success)' : 'var(--danger)', marginBottom: 6 }}>
            {correct ? '면접용 수정으로 적절합니다' : `다시 볼 선택 · 권장 ${String(q.answer).charCodeAt(0) - 64}번`}
          </p>
          {q.explanation && (
            <CompactText text={q.explanation} maxItemChars={70} style={{ fontSize: 12, color: 'var(--text)' }} />
          )}
        </div>
      )}

      {/* 이전/다음 */}
      {checked && (
        <div style={{ display: 'flex', gap: 10 }}>
          {idx > 0 && <button className="btn btn-ghost" style={{ flex: 1 }} onClick={prev}>← 이전</button>}
          {idx < total - 1
            ? <button className="btn btn-primary" style={{ flex: 2 }} onClick={next}>다음 →</button>
            : <button className="btn btn-primary" style={{ flex: 2, background: 'var(--success)' }}
                onClick={() => { setQuizCompleted(true); onComplete?.() }}>🏁 결과 보기</button>
          }
        </div>
      )}
    </div>
  )
}
