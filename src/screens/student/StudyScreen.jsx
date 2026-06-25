/**
 * StudyScreen — 기존 교과 학습 뷰
 * 학습 모드(답 통합 표시) / 퀴즈 모드(직접 풀기) 토글
 */
import { useState, useMemo } from 'react'
import { recordActivity } from '../../lib/activity.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import jobQuestions         from '../../../data/questions.json'
import ncsQuestions         from '../../../data/ncs-questions.json'
import foodServiceQuestions from '../../../data/food-service-questions.json'
import areaMapping          from '../../../data/areaMapping.json'

function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

const SUBJECTS = [
  { id: 'job-common',   label: '직업공통능력', icon: '📚', questions: jobQuestions },
  { id: 'ncs-basic',    label: 'NCS 기초',    icon: '🔧', questions: ncsQuestions },
  { id: 'food-service', label: '식음료서비스', icon: '🍽️', questions: foodServiceQuestions },
]

const JOB_AREAS = areaMapping.areas.map(a => ({
  id: a.id, label: a.displayName,
  lessons: a.lessons.map(l => ({ id: l.id, label: l.title })),
}))

function buildNCSAreas(qs) {
  const map = {}
  for (const q of qs) {
    if (!q.area || q.excludeFromQuiz) continue
    if (!map[q.area]) map[q.area] = { id: q.area, label: q.area, lessons: [] }
    const lid = q.lessonId ?? q.area
    if (!map[q.area].lessons.find(l => l.id === lid))
      map[q.area].lessons.push({ id: lid, label: q.lessonTitle ?? lid })
  }
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
}

function buildFoodAreas(qs) {
  const map = {}
  for (const q of qs) {
    if (q.excludeFromQuiz || q.lessonKind !== 'unit') continue
    if (!map[q.lessonId]) map[q.lessonId] = { id: q.lessonId, label: q.lessonTitle, lessons: [] }
  }
  return Object.values(map).sort((a, b) => a.id.localeCompare(b.id))
}

export default function StudyScreen() {
  const [subjectId,    setSubjectId]    = useState('job-common')
  const [areaId,       setAreaId]       = useState(null)
  const [lessonId,     setLessonId]     = useState(null)
  const [learnIdx,     setLearnIdx]     = useState(0)
  const [quizIdx,      setQuizIdx]      = useState(0)
  const [studyMode,    setStudyMode]    = useState('learn')
  const [quizAnswer,   setQuizAnswer]   = useState(null)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizDone,     setQuizDone]     = useState(false)
  const [showJump,     setShowJump]     = useState(false)

  const questionIdx = studyMode === 'learn' ? learnIdx : quizIdx

  const subject = SUBJECTS.find(s => s.id === subjectId)

  const areas = useMemo(() => {
    if (subjectId === 'job-common')   return JOB_AREAS
    if (subjectId === 'ncs-basic')    return buildNCSAreas(ncsQuestions)
    if (subjectId === 'food-service') return buildFoodAreas(foodServiceQuestions)
    return []
  }, [subjectId])

  const lessons = useMemo(() => {
    if (!areaId) return []
    return areas.find(a => a.id === areaId)?.lessons ?? []
  }, [areas, areaId])

  const questionPool = useMemo(() => {
    const qs = subject?.questions ?? []
    if (!areaId) return []
    if (subjectId === 'job-common') {
      if (lessonId && lessonId !== '__all__') {
        return qs.filter(q => !q.excludeFromQuiz && (q.lessonId === lessonId || q.id.startsWith(lessonId)))
      }
      const area = JOB_AREAS.find(a => a.id === areaId)
      const lids = new Set(area?.lessons.map(l => l.id) ?? [])
      return qs.filter(q => !q.excludeFromQuiz && lids.has(q.lessonId))
    }
    if (subjectId === 'ncs-basic')    return qs.filter(q => !q.excludeFromQuiz && q.area === areaId)
    if (subjectId === 'food-service') return qs.filter(q => !q.excludeFromQuiz && q.lessonId === areaId)
    return []
  }, [subject, subjectId, areaId, lessonId])

  function selectSubject(id) {
    setSubjectId(id); setAreaId(null); setLessonId(null)
    setLearnIdx(0); setQuizIdx(0); setStudyMode('learn'); setQuizDone(false); resetQuiz()
  }
  function selectArea(id) {
    setAreaId(id); setLessonId(null)
    setLearnIdx(0); setQuizIdx(0); setQuizDone(false); resetQuiz()
  }
  function selectLesson(id) {
    setLessonId(id)
    setLearnIdx(0); setQuizIdx(0); setQuizDone(false); resetQuiz()
  }
  function goQuestion(i) {
    if (studyMode === 'learn') setLearnIdx(i)
    else setQuizIdx(i)
    resetQuiz()
  }
  function switchMode(m) {
    if (m === studyMode) return
    if (m === 'quiz') setQuizIdx(0)
    setQuizDone(false); resetQuiz(); setStudyMode(m)
  }
  function resetQuiz() {
    setQuizAnswer(null); setQuizRevealed(false)
  }

  // ── 과목 선택 바 ──────────────────────────────────────────────────────
  const subjectBar = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {SUBJECTS.map(s => (
        <button key={s.id}
          className={`btn ${subjectId === s.id ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '8px 14px', fontSize: 13, flex: 1 }}
          onClick={() => selectSubject(s.id)}>
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  )

  // ── 영역 선택 ─────────────────────────────────────────────────────────
  if (!areaId) {
    return (
      <div className="screen">
        <div className="appbar">
          <span className="appbar-title">📚 학습하기</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subject?.label}</span>
        </div>
        <div className="screen-body">
          {subjectBar}
          <p className="section-title">영역 선택</p>
          {areas.map(a => (
            <button key={a.id} onClick={() => selectArea(a.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {a.lessons?.length > 0 ? `${a.lessons.length}개 단원` : ''} →
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 단원 선택 (직업공통만) ────────────────────────────────────────────
  const selectedArea = areas.find(a => a.id === areaId)
  if (!lessonId && lessons.length > 0 && subjectId === 'job-common') {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => { setAreaId(null); setLessonId(null) }}>←</button>
          <span className="appbar-title">{selectedArea?.label}</span>
        </div>
        <div className="screen-body">
          {subjectBar}
          <button className="btn btn-secondary btn-full" style={{ marginBottom: 14 }}
            onClick={() => { setLessonId('__all__'); setLearnIdx(0); setQuizIdx(0); resetQuiz() }}>
            이 영역 전체 학습 ({questionPool.length}문항)
          </button>
          <p className="section-title">단원 선택</p>
          {lessons.map(l => {
            const cnt = (subject?.questions ?? []).filter(
              q => !q.excludeFromQuiz && (q.lessonId === l.id || q.id.startsWith(l.id))
            ).length
            return (
              <button key={l.id} onClick={() => selectLesson(l.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'var(--card)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1, lineHeight: 1.5 }}>{l.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{cnt}문항 →</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 문항 없음 ─────────────────────────────────────────────────────────
  if (questionPool.length === 0) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => setLessonId(null)}>←</button>
          <span className="appbar-title">학습</span>
        </div>
        <div className="screen-body">
          <div className="empty-state">
            <span className="empty-state-icon">📭</span>
            <span className="empty-state-title">학습 문항이 없습니다</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 퀴즈 완료 화면 ───────────────────────────────────────────────────
  if (studyMode === 'quiz' && quizDone) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => { setQuizDone(false); setAreaId(null) }}>←</button>
          <span className="appbar-title">퀴즈 완료!</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
          <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>퀴즈 완료!</p>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
            총 <strong>{questionPool.length}문항</strong>을 모두 풀었습니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <button className="btn btn-primary btn-full"
              onClick={() => { setQuizIdx(0); setQuizDone(false); resetQuiz() }}>
              🔄 다시 풀기 (1번부터)
            </button>
            <button className="btn btn-secondary btn-full"
              onClick={() => { setStudyMode('learn'); setQuizDone(false); resetQuiz() }}>
              📖 학습 모드로
            </button>
            <button className="btn btn-ghost btn-full"
              onClick={() => { setAreaId(null); setQuizDone(false) }}>
              ← 단원 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 문항 학습 뷰 ──────────────────────────────────────────────────────
  const q          = questionPool[questionIdx]
  const total      = questionPool.length
  const isSelf     = q?.questionMode === 'selfcheck'
  const isOX       = q?.questionMode === 'ox'
  const correctIdx = answerIdx(q?.answer)
  const isLearn    = studyMode === 'learn'

  const backTitle = lessonId && lessonId !== '__all__'
    ? lessons.find(l => l.id === lessonId)?.label ?? '학습'
    : selectedArea?.label ?? '학습'

  function handleBack() {
    if (subjectId === 'job-common' && lessonId !== '__all__') setLessonId(null)
    else setAreaId(null)
    resetQuiz(); setShowJump(false)
  }

  return (
    <div className="screen" style={{ position: 'relative' }}>
      {/* ── 컴팩트 단일 헤더 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px', height: 44,
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button onClick={handleBack}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--primary)', padding: '0 4px', flexShrink: 0 }}>
          ←
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {backTitle}
        </span>
        {/* 학습/퀴즈 미니 토글 */}
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 8, padding: 2, flexShrink: 0 }}>
          {[{ id: 'learn', label: '학습' }, { id: 'quiz', label: '퀴즈' }].map(m => (
            <button key={m.id} onClick={() => switchMode(m.id)}
              style={{
                padding: '4px 10px', border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: studyMode === m.id ? 'var(--primary)' : 'transparent',
                color: studyMode === m.id ? '#fff' : 'var(--text-muted)',
              }}>
              {m.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
          {questionIdx + 1}/{total}
        </span>
      </div>

      {/* 진행 바 */}
      <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{ height: '100%', background: 'var(--primary)', width: `${((questionIdx + 1) / total) * 100}%`, transition: 'width 0.2s' }} />
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 8px' }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {q?.area && <span className="badge badge-blue">{q.area}</span>}
          {q?.lessonTitle && <span className="badge badge-gray" style={{ fontSize: 10 }}>{q.lessonTitle}</span>}
          {isSelf && <span className="badge badge-yellow">서술형</span>}
          {isOX   && <span className="badge badge-green">O/X</span>}
        </div>

        {isLearn && <LearnCard q={q} isSelf={isSelf} isOX={isOX} correctIdx={correctIdx} />}
        {!isLearn && (
          <QuizCard
            q={q} isSelf={isSelf} isOX={isOX} correctIdx={correctIdx}
            quizAnswer={quizAnswer} setQuizAnswer={setQuizAnswer}
            revealed={quizRevealed} setRevealed={setQuizRevealed}
            courseId={subjectId === 'food-service' ? 3 : 1}
          />
        )}
      </div>

      {/* ── 고정 하단 네비게이션 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button className="btn btn-ghost" style={{ flex: 1, padding: '10px 0' }}
          disabled={questionIdx === 0}
          onClick={() => goQuestion(questionIdx - 1)}>
          ← 이전
        </button>
        <button onClick={() => setShowJump(v => !v)}
          style={{
            padding: '10px 14px', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)',
          }}>
          {questionIdx + 1}/{total}
        </button>
        {studyMode === 'quiz' && questionIdx === total - 1 ? (
          <button className="btn btn-primary" style={{ flex: 1, padding: '10px 0', background: 'var(--success)' }}
            onClick={() => { setQuizDone(true); recordActivity('quiz') }}>
            완료 ✅
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1, padding: '10px 0' }}
            disabled={questionIdx === total - 1}
            onClick={() => goQuestion(questionIdx + 1)}>
            다음 →
          </button>
        )}
      </div>

      {/* ── 번호 이동 바텀시트 ── */}
      {showJump && (
        <>
          <div onClick={() => setShowJump(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--card)', borderRadius: '18px 18px 0 0',
            border: '1px solid var(--border)', padding: '16px 14px 28px',
            zIndex: 100, maxHeight: '45vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>문항 이동 · 전체 {total}문항</span>
              <button onClick={() => setShowJump(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {questionPool.map((_, i) => (
                <button key={i} onClick={() => { goQuestion(i); setShowJump(false) }}
                  style={{
                    width: 42, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700,
                    border: `2px solid ${i === questionIdx ? 'var(--primary)' : 'var(--border)'}`,
                    background: i === questionIdx ? 'var(--primary)' : 'var(--card)',
                    color: i === questionIdx ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 학습 카드 (답 통합 표시) ─────────────────────────────────────────────────
function LearnCard({ q, isSelf, isOX, correctIdx }) {
  return (
    <div>
      {/* 문항 내용 (맥락/질문) */}
      <div style={{
        background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
        border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
          학습 내용
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{q?.stem}</p>
      </div>

      {/* MCQ — 정답 강조, 오답 흐리게 */}
      {!isSelf && !isOX && (
        <div style={{ marginBottom: 12 }}>
          {q?.choices?.map((text, ci) => {
            const correct = ci === correctIdx
            return (
              <div key={ci} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                background: correct ? '#e8f5e9' : 'transparent',
                border: `2px solid ${correct ? 'var(--success)' : 'var(--border)'}`,
              }}>
                <span style={{
                  fontSize: 15, fontWeight: 800, flexShrink: 0, lineHeight: 1.5,
                  color: correct ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {correct ? '✓' : `${ci + 1}.`}
                </span>
                <p style={{
                  fontSize: 14, lineHeight: 1.6,
                  color: correct ? '#1b5e20' : 'var(--text-muted)',
                  fontWeight: correct ? 700 : 400,
                }}>
                  {text}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* OX — 판단 표시 */}
      {isOX && (
        <div style={{
          padding: '16px', marginBottom: 12, borderRadius: 12, textAlign: 'center',
          background: q?.answer === 'A' ? '#e8f5e9' : '#ffebee',
          border: `2px solid ${q?.answer === 'A' ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          <p style={{
            fontSize: 36, fontWeight: 800, lineHeight: 1,
            color: q?.answer === 'A' ? 'var(--success)' : 'var(--danger)',
          }}>
            {q?.answer === 'A' ? 'O' : 'X'}
          </p>
          <p style={{
            fontSize: 12, marginTop: 6,
            color: q?.answer === 'A' ? '#1b5e20' : '#b71c1c',
          }}>
            {q?.answer === 'A' ? '맞다 (옳은 설명)' : '틀리다 (잘못된 설명)'}
          </p>
        </div>
      )}

      {/* selfcheck — 모범답안 바로 표시 */}
      {isSelf && q?.modelAnswer && (
        <div style={{
          background: '#fff8df', borderRadius: 10, padding: '12px 14px',
          border: '1px solid #ffc107', marginBottom: 12,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 6 }}>📖 모범답안</p>
          <p style={{ fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{q.modelAnswer}</p>
        </div>
      )}

      {/* 해설 */}
      {q?.explanation && (
        <div style={{
          background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px',
          border: '1px solid var(--primary)', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>💡 해설</p>
          <p style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{q.explanation}</p>
        </div>
      )}

      {/* 학습 포인트 */}
      {q?.teachingNote && (
        <div style={{
          background: '#f3e5f5', borderRadius: 10, padding: '10px 14px',
          border: '1px solid #ce93d8',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 }}>⭐ 학습 포인트</p>
          <p style={{ fontSize: 12, color: '#4a148c', lineHeight: 1.7 }}>{q.teachingNote}</p>
        </div>
      )}
    </div>
  )
}

// ── 퀴즈 카드 (직접 풀기) ────────────────────────────────────────────────────
function QuizCard({ q, isSelf, isOX, correctIdx, quizAnswer, setQuizAnswer, revealed, setRevealed, courseId = 1 }) {
  return (
    <div>
      {/* 문항 줄기 */}
      <div style={{
        background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
        border: '1px solid var(--border)', marginBottom: 14,
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {q?.stem}
        </p>
      </div>

      {/* MCQ 선택지 */}
      {!isSelf && !isOX && (
        <div style={{ marginBottom: 14 }}>
          {q?.choices?.map((text, ci) => {
            const isCorrect  = ci === correctIdx
            const isSelected = quizAnswer === ci
            let bg = 'var(--card)', border = 'var(--border)', color = 'var(--text)'
            if (revealed) {
              if (isCorrect)       { bg = '#e8f5e9'; border = 'var(--success)'; color = '#1b5e20' }
              else if (isSelected) { bg = '#ffebee'; border = 'var(--danger)';  color = '#b71c1c' }
            } else if (isSelected) {
              bg = 'var(--primary-light)'; border = 'var(--primary)'
            }
            return (
              <button key={ci}
                onClick={() => { if (!revealed) setQuizAnswer(ci) }}
                style={{
                  width: '100%', textAlign: 'left', background: bg,
                  border: `2px solid ${border}`, borderRadius: 10,
                  padding: '12px 14px', marginBottom: 8,
                  cursor: revealed ? 'default' : 'pointer',
                  color, fontWeight: (revealed && (isCorrect || isSelected)) ? 700 : 400,
                  fontSize: 14, lineHeight: 1.6,
                }}>
                <span style={{ fontWeight: 700, marginRight: 8, color: 'var(--text-muted)' }}>{ci + 1}.</span>
                {text}
                {revealed && isCorrect  && <span style={{ marginLeft: 6 }}>✓ 정답</span>}
                {revealed && isSelected && !isCorrect && <span style={{ marginLeft: 6 }}>✗ 오답</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* OX */}
      {isOX && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {['O', 'X'].map((val, ci) => {
            const isCorrect  = ci === correctIdx
            const isSelected = quizAnswer === ci
            let bg = 'var(--card)', border = 'var(--border)'
            if (revealed) {
              if (isCorrect)       { bg = '#e8f5e9'; border = 'var(--success)' }
              else if (isSelected) { bg = '#ffebee'; border = 'var(--danger)'  }
            } else if (isSelected) {
              bg = 'var(--primary-light)'; border = 'var(--primary)'
            }
            return (
              <button key={val}
                onClick={() => { if (!revealed) setQuizAnswer(ci) }}
                style={{
                  flex: 1, padding: '20px 0', background: bg,
                  border: `2px solid ${border}`, borderRadius: 12,
                  cursor: revealed ? 'default' : 'pointer',
                  fontSize: 28, fontWeight: 800,
                  color: revealed && isCorrect ? 'var(--success)' : revealed && isSelected ? 'var(--danger)' : 'var(--text)',
                }}>
                {val}
              </button>
            )
          })}
        </div>
      )}

      {/* selfcheck 안내 */}
      {isSelf && (
        <div style={{
          background: '#fff8df', borderRadius: 10,
          padding: '12px 14px', marginBottom: 14, border: '1px solid #ffc107',
        }}>
          <p style={{ fontSize: 12, color: '#856404', fontWeight: 700, marginBottom: 4 }}>서술형 문항</p>
          <p style={{ fontSize: 12, color: '#856404', lineHeight: 1.7 }}>
            스스로 답을 생각한 뒤 아래 모범답안과 비교해 보세요.
          </p>
        </div>
      )}

      {/* 채점/정답 보기 */}
      {!revealed ? (
        <button className="btn btn-secondary btn-full" style={{ marginBottom: 14 }}
          onClick={() => {
            setRevealed(true)
            // 오답이거나 정답 안 고르고 본 경우 저장
            const wrong = !isSelf && !isOX && quizAnswer !== null && quizAnswer !== correctIdx
            const oxWrong = isOX && quizAnswer !== null && quizAnswer !== correctIdx
            if (wrong || oxWrong || (quizAnswer === null && !isSelf)) {
              const answerLabel = quizAnswer !== null
                ? String.fromCharCode(65 + (isOX ? quizAnswer : quizAnswer))
                : null
              saveWrongAnswer(q, courseId, answerLabel)
            }
          }}>
          {isSelf ? '📖 모범답안 보기' : quizAnswer !== null ? '채점하기' : '정답 보기'}
        </button>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {(q?.modelAnswer || q?.answer) && (
            <div style={{
              background: '#fff8df', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #ffc107', marginBottom: 10,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 6 }}>📖 모범답안</p>
              <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {q.modelAnswer ?? (isOX
                  ? (q.answer === 'A' ? 'O' : 'X')
                  : q.choices?.[correctIdx])}
              </p>
            </div>
          )}
          {q?.explanation && (
            <div style={{
              background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px',
              border: '1px solid var(--primary)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>💡 해설</p>
              <p style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{q.explanation}</p>
            </div>
          )}
          {q?.teachingNote && (
            <div style={{
              background: '#f3e5f5', borderRadius: 10, padding: '10px 14px', marginTop: 10,
              border: '1px solid #ce93d8',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 }}>⭐ 학습 포인트</p>
              <p style={{ fontSize: 12, color: '#4a148c', lineHeight: 1.7 }}>{q.teachingNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
