/**
 * InterviewStudyScreen — 면접교재 학습 모드
 * 학습 모드(답 통합 표시) / 퀴즈 모드(직접 풀기) 토글
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { recordActivity } from '../../lib/activity.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import interviewStudy from '../../../data/interview-study.json'
import interviewQuizData from '../../../data/interview-quiz.json'
import { getSummary } from '../../lib/studySummaries.js'
import StudySummary from './StudySummary.jsx'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { buildInterviewConceptChecks, buildInterviewLearningQuestions } from '../../lib/interviewLearning.js'
import { studyQuestionsById } from '../../lib/assessmentPartition.js'
import { Buildings, CaretRight, CheckCircle, FileText, Target } from '@phosphor-icons/react'
import InterviewCareerLab from './InterviewCareerLab.jsx'
import CompactText from '../../components/CompactText.jsx'
import {
  INTERVIEW_FOUNDATION_COURSES,
  interviewFoundationCategories,
  interviewFoundationCourseById,
} from '../../lib/interviewFoundationCourses.js'

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

export default function InterviewStudyScreen({ onBack }) {
  const [careerSection, setCareerSection] = useState(null)
  const [category,    setCategory]    = useState(null)
  const [lessonId,    setLessonId]    = useState(null)
  const [view,           setView]           = useState('theory')
  const [practiceIdx,    setPracticeIdx]    = useState(0)
  const [showModel,      setShowModel]      = useState(false)
  const [showReference,  setShowReference]  = useState(false)
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

  const selectedCourse = interviewFoundationCourseById(category)
  const catLessons = useMemo(() => {
    const categories = interviewFoundationCategories(category)
    return categories.length ? lessons.filter(lesson => categories.includes(lesson.category)) : []
  }, [category])

  function openLesson(id) {
    setLessonId(id); setView('theory')
    setPracticeIdx(0); setShowModel(false); setShowReference(false)
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
    setPracticeIdx(0); setShowModel(false)
  }

  if (careerSection) {
    return <InterviewCareerLab
      section={careerSection}
      onBack={() => setCareerSection(null)}
      onOpenCover={() => setCareerSection('cover')}
    />
  }

  // ── 카테고리 선택 ─────────────────────────────────────────────────────
  if (!category) {
    return (
      <div className="screen">
        <div className="appbar">
          {onBack && <button className="appbar-back" onClick={onBack}>←</button>}
          <span className="appbar-title">🎤 면접 학습</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lessons.length}개 단원</span>
        </div>
        <div className="screen-body">
          <div className="interview-study-hero">
            <img src={`${import.meta.env.BASE_URL}images/learning/workplace-interview.webp`} alt="직무 면접을 준비하는 특성화고 학생" />
            <div><strong>기초부터 지원처별 실전까지</strong><span>면접·기업연구·자기소개서를 한 흐름으로 완성</span></div>
          </div>
          <p className="section-title">심화 준비</p>
          <div className="interview-career-entry-list">
            <button onClick={() => setCareerSection('pathways')}><Target size={22} weight="duotone" /><span><strong>지원처별 면접 심화</strong><small>금융권 · 공공기관 · 대기업</small></span><b>→</b></button>
            <button onClick={() => setCareerSection('institutions')}><Buildings size={22} weight="duotone" /><span><strong>기업·기관 연구소</strong><small>46곳 사례·모범답안·공식자료 점검</small></span><b>→</b></button>
            <button onClick={() => setCareerSection('cover')}><FileText size={22} weight="duotone" /><span><strong>자기소개서 완성실</strong><small>분야 선택부터 PDF·교사 첨삭까지</small></span><b>→</b></button>
          </div>
          <p className="section-title" style={{ marginTop: 20 }}>기초 면접 · 6개 과정 · {lessons.length}단원</p>
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
          <button className="appbar-back" onClick={goBack}>←</button>
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
                          개념 {conceptCount} · 답변 {practiceCount}
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
  const lessonQuizQuestions = buildInterviewConceptChecks(lesson, STUDY_QUIZ_QUESTIONS)
  const hasQuiz = lessonQuizQuestions.length > 0
  const lessonSummary = getSummary(`iv:${lesson.id}`)
  const interviewLearningQuestions = buildInterviewLearningQuestions(lesson, STUDY_QUIZ_QUESTIONS)
  const practiceQuestions = interviewLearningQuestions.filter(question => question.isInterview).map(question => ({
        ...question,
        question: question.question || question.stem,
        structHint: question.structHint || question.context,
        hints: question.hints?.length ? question.hints : question.answerPoints,
      }))
  const hasPractice = practiceQuestions.length > 0

  const TABS = [
    { id: 'theory',   label: '1 개념 익히기' },
    ...(hasQuiz      ? [{ id: 'quiz',     label: `2 개념 확인 ${lessonQuizQuestions.length}` }] : []),
    ...(hasPractice  ? [{ id: 'practice', label: `3 답변 연습 ${practiceQuestions.length}` }] : []),
  ]

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={goBack}>←</button>
        <span className="appbar-title" style={{ fontSize: 12 }}>{lesson.title}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: LEVEL_BADGE_BG[lesson.level] ?? '#f0f4f8',
          color: LEVEL_COLOR[lesson.level] ?? '#666',
        }}>{lesson.level}</span>
      </div>

      {/* 탭 바 */}
      {TABS.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchView(t.id)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                background: view === t.id ? 'var(--primary-light)' : 'transparent',
                color: view === t.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: view === t.id ? 700 : 400, fontSize: 12,
                borderBottom: view === t.id ? '2px solid var(--primary)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 이론 본문 */}
      {view === 'theory' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
          {lessonSummary && (
            <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '2px solid var(--border)' }}>
              <StudySummary
                summary={{ ...lessonSummary, courseKind: 'interview' }}
                questions={interviewLearningQuestions}
              />
            </div>
          )}
          {lessonSummary && (
            <button className="btn btn-secondary btn-full" style={{ marginBottom: showReference ? 14 : 0 }}
              onClick={() => setShowReference(open => !open)}>
              {showReference ? '상세 참고자료 접기' : '상세 참고자료 펼치기'}
            </button>
          )}
          {(!lessonSummary || showReference) && lesson.sections.map((sec, i) => (
              <SectionBlock key={i} sec={sec} />
            ))}
          {(hasQuiz || hasPractice) && (
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => switchView(hasQuiz ? 'quiz' : 'practice')}>
              {hasQuiz ? '개념 확인 시작 →' : '답변 연습 시작 →'}
            </button>
          )}
        </div>
      )}

      {/* 개념 퀴즈 (선다형/OX) */}
      {view === 'quiz' && hasQuiz && (
        <InterviewQuizView
          questions={lessonQuizQuestions}
          lessonId={lesson.id}
          onMarkProgress={markLessonProgress}
          onReturnToTheory={() => switchView('theory')}
          onStartPractice={hasPractice ? () => switchView('practice') : null}
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
        />
      )}
    </div>
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
function PracticeView({ questions, idx, setIdx, showModel, setShowModel, lessonId, onMarkProgress, summaryTips, onReturnToTheory }) {
  const [practiceDone, setPracticeDone]   = useState(false)
  const [selfEvalSaved, setSelfEvalSaved] = useState(null)
  // 답변 초안과 채점 기준 체크. 문항마다 따로 보관하고 기기에만 남긴다
  // (서버 왕복 없음). 면접 답변은 개인적인 내용이라 밖으로 내보내지 않는다.
  const [drafts, setDrafts]   = useState(() => loadDrafts(lessonId))
  const [checked, setChecked] = useState(() => loadChecks(lessonId))

  const pq    = questions[idx]
  const total = questions.length

  // ── 실습 완료 화면 ─────────────────────────────────────────────────────
  if (practiceDone) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>실습 완료!</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          총 <strong>{total}문항</strong>을 모두 풀었습니다.
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
            ← 개념 다시 보기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>

      {/* 단원 학습 팁 */}
      {summaryTips?.length > 0 && <TipsBox tips={summaryTips} />}

      {/* 진행 표시 + 점프 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          실습 {idx + 1} / {total}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {questions.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: `2px solid ${i === idx ? 'var(--primary)' : 'var(--border)'}`,
                background: i === idx ? 'var(--primary)' : 'var(--card)',
                color: i === idx ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}>{i + 1}
            </button>
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
            ☑️ 채점 기준
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
          {(drafts[pq.id ?? idx] || '').trim().length}자
          {(drafts[pq.id ?? idx] || '').trim().length >= 150 && ' · 1분 30초 분량에 가까워요'}
        </p>
      </div>

      {/* 먼저 답을 떠올린 뒤 모범답안을 펼친다. */}
      {!showModel ? (
        <button
          type="button"
          className="btn btn-secondary btn-full"
          aria-expanded="false"
          style={{ marginBottom: 14 }}
          onClick={() => setShowModel(true)}
        >
          📖 모범답안 펼치기
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
            onClick={() => { setPracticeDone(true); recordActivity('quiz') }}>
            답변 연습 마치기
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }}
            disabled={idx === total - 1}
            onClick={() => setIdx(idx + 1)}>다음 →</button>
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

// ── 면접 개념 퀴즈 (선다형/OX) ─────────────────────────────────────────────
function InterviewQuizView({ questions, lessonId, onMarkProgress, onReturnToTheory, onStartPractice }) {
  const [idx, setIdx]               = useState(0)
  const [selected, setSelected]     = useState(null)
  const [checked, setChecked]       = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [selfEvalSaved, setSelfEvalSaved] = useState(null)

  const q = questions[idx]
  const isOx = q?.type === 'ox'
  const total = questions.length

  if (quizCompleted) {
    const accuracy = total > 0 ? Math.round(correctCount / total * 100) : 0
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>
          {accuracy >= 80 ? '🎉' : accuracy >= 50 ? '💪' : '📚'}
        </div>
        <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>퀴즈 완료!</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { label: '정답',  val: correctCount,         bg: '#d1fae5', color: '#065f46' },
            { label: '오답',  val: total - correctCount, bg: '#fee2e2', color: '#991b1b' },
            { label: '정확도', val: `${accuracy}%`,      bg: '#e0f2fe', color: '#0369a1' },
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
              ← 개념 다시 보기
            </button>
          )}
          <button className="btn btn-primary btn-full"
            onClick={onStartPractice || (() => { setIdx(0); setCorrectCount(0); setQuizCompleted(false); setSelfEvalSaved(null); setSelected(null); setChecked(false) })}>
            {onStartPractice ? '답변 연습으로 →' : '다시 확인하기'}
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
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
      <button type="button" className="btn btn-ghost"
        style={{ minHeight: 36, padding: '6px 10px', marginBottom: 10 }}
        onClick={onReturnToTheory}>
        ← 개념으로
      </button>
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
            <p style={{ fontSize: 12, fontWeight: 800, color: '#3b5bdb', marginBottom: 4 }}>📋 상황</p>
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
            {correct ? '🎉 정답입니다!' : `❌ 오답 · 정답: ${q.answer}`}
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
                onClick={() => setQuizCompleted(true)}>🏁 결과 보기</button>
          }
        </div>
      )}
    </div>
  )
}
