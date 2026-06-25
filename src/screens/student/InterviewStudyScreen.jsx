/**
 * InterviewStudyScreen — 면접교재 학습 모드
 * 학습 모드(답 통합 표시) / 퀴즈 모드(직접 풀기) 토글
 */
import { useState, useMemo } from 'react'
import { recordActivity } from '../../lib/activity.js'
import interviewStudy from '../../../data/interview-study.json'

const { lessons } = interviewStudy

const LEVEL_COLOR = {
  '진단': '#7b8fa1', '기초': '#1e6f5c',
  '표준': '#1565c0', '심화': '#6a1b9a', '종합': '#c62828',
}
const LEVEL_BADGE_BG = {
  '진단': '#f0f4f8', '기초': '#edf9f3',
  '표준': '#e3f0ff', '심화': '#f3e5f5', '종합': '#ffebee',
}

const CATEGORIES = [...new Set(lessons.map(l => l.category))]

export default function InterviewStudyScreen() {
  const [category,    setCategory]    = useState(null)
  const [lessonId,    setLessonId]    = useState(null)
  const [view,             setView]             = useState('theory')
  const [learnPracticeIdx, setLearnPracticeIdx] = useState(0)  // 학습 위치 (유지)
  const [quizPracticeIdx,  setQuizPracticeIdx]  = useState(0)  // 퀴즈 위치 (전환 시 리셋)
  const [studyMode,        setStudyMode]        = useState('learn')
  const [showModel,        setShowModel]        = useState(false)

  const practiceIdx = studyMode === 'learn' ? learnPracticeIdx : quizPracticeIdx

  const lesson = lessonId ? lessons.find(l => l.id === lessonId) : null

  const catLessons = useMemo(() =>
    category ? lessons.filter(l => l.category === category) : []
  , [category])

  function openLesson(id) {
    setLessonId(id); setView('theory')
    setLearnPracticeIdx(0); setQuizPracticeIdx(0)
    setStudyMode('learn'); setShowModel(false)
  }
  function goBack() {
    if (lessonId) { setLessonId(null); return }
    setCategory(null)
  }
  function switchMode(m) {
    if (m === studyMode) return
    // 퀴즈 진입 시 항상 1번부터
    if (m === 'quiz') setQuizPracticeIdx(0)
    setShowModel(false)
    setStudyMode(m)
  }
  function switchView(v) {
    setView(v)
    setLearnPracticeIdx(0); setQuizPracticeIdx(0)
    setStudyMode('learn'); setShowModel(false)
  }

  // ── 카테고리 선택 ─────────────────────────────────────────────────────
  if (!category) {
    return (
      <div className="screen">
        <div className="appbar">
          <span className="appbar-title">🎤 면접 학습</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lessons.length}개 단원</span>
        </div>
        <div className="screen-body">
          <p className="section-title">분야 선택</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const cnt = lessons.filter(l => l.category === cat).length
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '14px 12px', cursor: 'pointer',
                    textAlign: 'center',
                  }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{cat}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cnt}개 단원</p>
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
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={goBack}>←</button>
          <span className="appbar-title">{category}</span>
        </div>
        <div className="screen-body">
          {catLessons.map(l => (
            <button key={l.id} onClick={() => openLesson(l.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                    {l.title}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: LEVEL_BADGE_BG[l.level] ?? '#f0f4f8',
                      color: LEVEL_COLOR[l.level] ?? '#666',
                    }}>{l.level}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.durationMin}분</span>
                    {l.practiceQuestions.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--primary)' }}>
                        실습 {l.practiceQuestions.length}문항
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 단원 학습 ─────────────────────────────────────────────────────────
  const hasPractice = lesson.practiceQuestions.length > 0

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={goBack}>←</button>
        <span className="appbar-title" style={{ fontSize: 12 }}>{lesson.title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: LEVEL_BADGE_BG[lesson.level] ?? '#f0f4f8',
          color: LEVEL_COLOR[lesson.level] ?? '#666',
        }}>{lesson.level}</span>
      </div>

      {/* 이론 / 실습 탭 */}
      {hasPractice && (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
          {[
            { id: 'theory',   label: '📖 이론 본문' },
            { id: 'practice', label: `✍️ 실습 (${lesson.practiceQuestions.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => switchView(t.id)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                background: view === t.id ? 'var(--primary-light)' : 'transparent',
                color: view === t.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: view === t.id ? 700 : 400, fontSize: 13,
                borderBottom: view === t.id ? '2px solid var(--primary)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 이론 본문 */}
      {view === 'theory' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {lesson.sections.map((sec, i) => (
            <SectionBlock key={i} sec={sec} />
          ))}
          {hasPractice && (
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => switchView('practice')}>
              ✍️ 실습 문항 풀기 →
            </button>
          )}
        </div>
      )}

      {/* 실습 문항 */}
      {view === 'practice' && hasPractice && (
        <PracticeView
          questions={lesson.practiceQuestions}
          idx={practiceIdx}
          setIdx={(i) => {
            if (studyMode === 'learn') setLearnPracticeIdx(i)
            else setQuizPracticeIdx(i)
            setShowModel(false)
          }}
          studyMode={studyMode}
          onSwitchMode={switchMode}
          showModel={showModel}
          setShowModel={setShowModel}
        />
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
          <p style={{ fontSize: 13, lineHeight: 1.7, fontStyle: 'italic' }}>{sec.text}</p>
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
                color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
              }}>{i + 1}</span>
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>{item}</p>
            </div>
          ))}
        </div>
      )
    case 'good_answer':
      return (
        <div style={{
          background: '#f3faf5', border: '1px solid #b9d4c2',
          borderRadius: 8, padding: '10px 14px', margin: '10px 0',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1e6f5c', marginBottom: 6 }}>✅ 좋은 답변 예시</p>
          <p style={{ fontSize: 12, lineHeight: 1.7 }}>{sec.text}</p>
        </div>
      )
    case 'hr':
      return <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
    default:
      return null
  }
}

// ── 실습 문항 뷰 ──────────────────────────────────────────────────────────────
function PracticeView({ questions, idx, setIdx, studyMode, onSwitchMode, showModel, setShowModel }) {
  const [quizDone, setQuizDone] = useState(false)

  const pq    = questions[idx]
  const total = questions.length
  const isLearn = studyMode === 'learn'

  // ── 퀴즈 완료 화면 ─────────────────────────────────────────────────────
  if (studyMode === 'quiz' && quizDone) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
        <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>퀴즈 완료!</p>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          총 <strong>{total}문항</strong>을 모두 풀었습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <button className="btn btn-primary btn-full"
            onClick={() => { setIdx(0); setQuizDone(false) }}>
            🔄 다시 풀기 (1번부터)
          </button>
          <button className="btn btn-secondary btn-full"
            onClick={() => { onSwitchMode('learn'); setQuizDone(false) }}>
            📖 학습 모드로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

      {/* 학습/퀴즈 모드 토글 */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 14,
        background: 'var(--bg)', borderRadius: 10,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {[
          { id: 'learn', label: '📖 학습', sub: '모범답안 바로 확인' },
          { id: 'quiz',  label: '📝 퀴즈', sub: '1번부터 시작'      },
        ].map(m => (
          <button key={m.id} onClick={() => { onSwitchMode(m.id); setQuizDone(false) }}
            style={{
              flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
              background: studyMode === m.id ? 'var(--primary)' : 'transparent',
              color: studyMode === m.id ? '#fff' : 'var(--text-muted)',
              fontWeight: studyMode === m.id ? 700 : 400, fontSize: 13,
              lineHeight: 1.3,
            }}>
            {m.label}
            <span style={{
              display: 'block', fontSize: 10,
              opacity: studyMode === m.id ? 0.8 : 0.6, fontWeight: 400,
            }}>{m.sub}</span>
          </button>
        ))}
      </div>

      {/* 퀴즈 모드 안내 */}
      {studyMode === 'quiz' && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
          💡 학습 ↔ 퀴즈 전환 시 퀴즈는 1번 문항부터 다시 시작됩니다
        </p>
      )}

      {/* 진행 표시 + 점프 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          실습 {idx + 1} / {total}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {questions.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700,
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
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
          🎤 면접 질문
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8 }}>
          "{pq.question}"
        </p>
      </div>

      {/* 구조 힌트 (학습/퀴즈 공통) */}
      {pq.structHint && (
        <div style={{
          background: '#f6f8fa', borderLeft: '4px solid var(--primary)',
          borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 12,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
            📐 답변 구조 힌트
          </p>
          <p style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {pq.structHint}
          </p>
        </div>
      )}

      {/* 힌트 목록 (학습/퀴즈 공통) */}
      {pq.hints?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            💡 답변 포인트
          </p>
          {pq.hints.map((h, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '6px 0',
              borderBottom: i < pq.hints.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>•</span>
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>{h}</p>
            </div>
          ))}
        </div>
      )}

      {/* 셀프 체크 (학습/퀴즈 공통) */}
      {pq.checkboxes?.length > 0 && (
        <div style={{
          background: '#fff8df', borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, border: '1px solid #ffc107',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 8 }}>
            ☑️ 채점 기준
          </p>
          {pq.checkboxes.map((cb, i) => (
            <p key={i} style={{ fontSize: 12, lineHeight: 1.7, color: '#3e3422' }}>□ {cb}</p>
          ))}
        </div>
      )}

      {/* ── 학습 모드: 모범답안 바로 표시 ── */}
      {isLearn && (
        <ModelAnswerBlock pq={pq} />
      )}

      {/* ── 퀴즈 모드: 생각 후 토글 ── */}
      {!isLearn && (
        <>
          {!showModel ? (
            <button className="btn btn-secondary btn-full" style={{ marginBottom: 14 }}
              onClick={() => setShowModel(true)}>
              📖 모범답안 확인하기
            </button>
          ) : (
            <ModelAnswerBlock pq={pq} />
          )}
        </>
      )}

      {/* 이전 / 다음 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }}
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}>← 이전</button>
        {studyMode === 'quiz' && idx === total - 1 ? (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}
            onClick={() => { setQuizDone(true); recordActivity('quiz') }}>
            ✅ 퀴즈 완료
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

// ── 모범답안 블록 (학습/퀴즈 공용) ────────────────────────────────────────────
function ModelAnswerBlock({ pq }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {pq.modelAnswer && (
        <div style={{
          background: '#fff8df', border: '1px solid #ffc107',
          borderRadius: 10, padding: '12px 14px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 8 }}>
            📖 모범답안
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
            {pq.modelAnswer}
          </p>
        </div>
      )}

      {pq.answerPoints?.length > 0 && (
        <div style={{
          background: '#edf9f3', border: '1px solid #b9d4c2',
          borderRadius: 10, padding: '10px 14px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1e6f5c', marginBottom: 8 }}>
            ✅ 핵심 포인트
          </p>
          {pq.answerPoints.map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
              <p style={{ fontSize: 12, lineHeight: 1.7 }}>{pt}</p>
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
