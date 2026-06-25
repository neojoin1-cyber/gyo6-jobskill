/**
 * QualityMgmtScreen — 품질경영 학습+문제풀이
 * 교재(이론+148문항) / 문제풀이(520문항+모의평가10회)
 * 6가지 문제 유형: choice / ox / text / matching / multi / interview
 * 학습 모드(답 통합) / 퀴즈 모드(직접 풀기) 토글
 */
import { useState, useMemo } from 'react'
import { recordActivity } from '../../lib/activity.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import studyData    from '../../../data/quality-mgmt-study.json'
import practiceData from '../../../data/quality-mgmt-practice.json'

const SOURCE_TABS = [
  { id: 'textbook', label: '📖 교재',     sub: '이론+148문항' },
  { id: 'practice', label: '📝 문제풀이', sub: '520문항·모의10회' },
]

export default function QualityMgmtScreen({ onBack }) {
  const [source,      setSource]      = useState('textbook') // 'textbook' | 'practice'
  const [unitId,      setUnitId]      = useState(null)
  const [view,        setView]        = useState('theory')
  const [learnQIdx,   setLearnQIdx]   = useState(0)  // 학습 위치 (유지)
  const [quizQIdx,    setQuizQIdx]    = useState(0)  // 퀴즈 위치 (전환 시 리셋)
  const [studyMode,   setStudyMode]   = useState('learn')
  const [quizDone,    setQuizDone]    = useState(false)

  const qIdx = studyMode === 'learn' ? learnQIdx : quizQIdx

  const data   = source === 'textbook' ? studyData : practiceData
  const units  = data.units
  const unit   = unitId ? units.find(u => u.id === unitId) : null
  const questions = unit?.questions ?? []

  function selectSource(id) {
    setSource(id); setUnitId(null); setView('theory')
    setLearnQIdx(0); setQuizQIdx(0); setStudyMode('learn'); setQuizDone(false)
  }
  function selectUnit(id) {
    setUnitId(id)
    const u = units.find(u => u.id === id)
    const hasTheory = source === 'textbook' && (u?.sections?.length ?? 0) > 3
    setView(hasTheory ? 'theory' : 'questions')
    setLearnQIdx(0); setQuizQIdx(0); setStudyMode('learn'); setQuizDone(false)
  }
  function goQuestion(i) {
    if (studyMode === 'learn') setLearnQIdx(i)
    else setQuizQIdx(i)
  }
  function switchStudyMode(m) {
    if (m === studyMode) return
    if (m === 'quiz') setQuizQIdx(0)
    setQuizDone(false); setStudyMode(m)
  }

  // ── 탭 바 ─────────────────────────────────────────────────────────────
  const sourceBar = (
    <div style={{
      display: 'flex', borderBottom: '2px solid var(--border)',
      background: 'var(--card)',
    }}>
      {SOURCE_TABS.map(t => (
        <button key={t.id} onClick={() => selectSource(t.id)}
          style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: source === t.id ? 'var(--primary-light)' : 'transparent',
            color: source === t.id ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: source === t.id ? 700 : 400, fontSize: 13,
            borderBottom: source === t.id ? '2px solid var(--primary)' : 'none',
            lineHeight: 1.3,
          }}>
          {t.label}
          <span style={{ display: 'block', fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{t.sub}</span>
        </button>
      ))}
    </div>
  )

  // ── 단원/섹션 목록 ────────────────────────────────────────────────────
  if (!unitId) {
    const unitList  = units.filter(u => u.kind === 'unit')
    const mockList  = units.filter(u => u.kind === 'mock')

    return (
      <div className="screen">
        <div className="appbar">
          {onBack && <button className="appbar-back" onClick={onBack}>←</button>}
          <span className="appbar-title">⚙️ 품질경영</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.meta.questionCount}문항</span>
        </div>
        {sourceBar}
        <div className="screen-body">
          {/* 단원 */}
          <p className="section-title">단원 학습</p>
          {unitList.map(u => (
            <button key={u.id} onClick={() => selectUnit(u.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{u.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {source === 'textbook' && u.sections.length > 0
                  ? `이론 ${u.sections.filter(s=>['h5','h6'].includes(s.type)).length}항목 · `
                  : ''}
                {u.questions.length}문항 →
              </span>
            </button>
          ))}

          {/* 모의평가 (문제풀이만) */}
          {mockList.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: 14 }}>실전 모의평가</p>
              {/* 지필/면접 각 5회 쌍으로 표시 */}
              {Array.from({ length: 5 }, (_, i) => {
                const jiPil  = mockList.find(u => u.title.includes(`지필`) && u.title.includes(`${i+1}회`))
                const myFace = mockList.find(u => u.title.includes(`면접`) && u.title.includes(`${i+1}회`))
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {[jiPil, myFace].filter(Boolean).map(u => (
                      <button key={u.id} onClick={() => selectUnit(u.id)}
                        style={{
                          flex: 1, textAlign: 'left', background: 'var(--card)',
                          border: '1px solid var(--border)', borderRadius: 10,
                          padding: '10px 12px', cursor: 'pointer',
                        }}>
                        <p style={{ fontWeight: 700, fontSize: 13 }}>{u.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {u.questions.length}문항
                        </p>
                      </button>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── 이론 보기 (교재만) ────────────────────────────────────────────────
  const hasTheory = unit.sections.length > 3

  if (view === 'theory' && hasTheory) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => setUnitId(null)}>←</button>
          <span className="appbar-title" style={{ fontSize: 12 }}>{unit.title}</span>
        </div>
        {sourceBar}

        {/* 이론/문제 탭 */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
          {[
            { id: 'theory',    label: '📖 이론 본문' },
            { id: 'questions', label: `📝 문제 (${questions.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {unit.sections.map((sec, i) => (
            <TheorySectionBlock key={i} sec={sec} />
          ))}
          {questions.length > 0 && (
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => { setView('questions'); setLearnQIdx(0); setQuizQIdx(0); setStudyMode('learn') }}>
              📝 문제 풀기 ({questions.length}문항) →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── 문제 뷰 ───────────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => setUnitId(null)}>←</button>
          <span className="appbar-title" style={{ fontSize: 12 }}>{unit.title}</span>
        </div>
        {sourceBar}
        <div className="screen-body">
          <div className="empty-state">
            <span className="empty-state-icon">📭</span>
            <span className="empty-state-title">문제가 없습니다</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 퀴즈 완료 화면 ─────────────────────────────────────────────────────
  if (studyMode === 'quiz' && quizDone) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => { setQuizDone(false); setUnitId(null) }}>←</button>
          <span className="appbar-title">퀴즈 완료!</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
          <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>퀴즈 완료!</p>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
            총 <strong>{questions.length}문항</strong>을 모두 풀었습니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <button className="btn btn-primary btn-full"
              onClick={() => { setQuizQIdx(0); setQuizDone(false) }}>
              🔄 다시 풀기 (1번부터)
            </button>
            <button className="btn btn-secondary btn-full"
              onClick={() => { setStudyMode('learn'); setQuizDone(false) }}>
              📖 학습 모드로
            </button>
            <button className="btn btn-ghost btn-full"
              onClick={() => { setUnitId(null); setQuizDone(false) }}>
              ← 단원 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  const q     = questions[qIdx]
  const total = questions.length

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={() => {
          if (view === 'questions' && hasTheory) setView('theory')
          else setUnitId(null)
        }}>←</button>
        <span className="appbar-title" style={{ fontSize: 12 }}>{unit.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qIdx + 1}/{total}</span>
      </div>
      {sourceBar}

      {/* 이론/문제 탭 (교재이고 이론 있을 때만) */}
      {hasTheory && (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
          {[
            { id: 'theory',    label: '📖 이론 본문' },
            { id: 'questions', label: `📝 문제 (${questions.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
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

      {/* 진행 바 */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{
          height: '100%', background: 'var(--primary)',
          width: `${((qIdx + 1) / total) * 100}%`, transition: 'width 0.2s',
        }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* 학습/퀴즈 모드 토글 */}
        <ModeToggle studyMode={studyMode} onSwitch={switchStudyMode} />

        {/* 퀴즈 모드 안내 */}
        {studyMode === 'quiz' && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
            💡 학습 ↔ 퀴즈 전환 시 퀴즈는 1번 문항부터 다시 시작됩니다
          </p>
        )}

        {/* 문제 카드 */}
        <QuestionCard
          key={`${q.id}-${studyMode}`}
          q={q}
          studyMode={studyMode}
        />

        {/* 이전/다음 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
            disabled={qIdx === 0}
            onClick={() => goQuestion(qIdx - 1)}>← 이전</button>
          {studyMode === 'quiz' && qIdx === total - 1 ? (
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}
              onClick={() => { setQuizDone(true); recordActivity('quiz') }}>
              ✅ 퀴즈 완료
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1 }}
              disabled={qIdx === total - 1}
              onClick={() => goQuestion(qIdx + 1)}>다음 →</button>
          )}
        </div>

        {/* 문항 점프 */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 5,
          marginTop: 14, maxHeight: 120, overflowY: 'auto',
        }}>
          {questions.map((qq, i) => (
            <button key={i} onClick={() => goQuestion(i)}
              style={{
                width: 34, height: 34, borderRadius: 7, fontSize: 11, fontWeight: 700,
                border: `2px solid ${i === qIdx ? 'var(--primary)' : 'var(--border)'}`,
                background: i === qIdx ? 'var(--primary)' : 'var(--card)',
                color: i === qIdx ? '#fff' : 'var(--text)',
                cursor: 'pointer',
              }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 모드 토글 ─────────────────────────────────────────────────────────────────
function ModeToggle({ studyMode, onSwitch }) {
  return (
    <div style={{
      display: 'flex', marginBottom: 14,
      background: 'var(--bg)', borderRadius: 10,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {[
        { id: 'learn', label: '📖 학습', sub: '답 바로 확인' },
        { id: 'quiz',  label: '📝 퀴즈', sub: '1번부터 시작' },
      ].map(m => (
        <button key={m.id} onClick={() => onSwitch(m.id)}
          style={{
            flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
            background: studyMode === m.id ? 'var(--primary)' : 'transparent',
            color: studyMode === m.id ? '#fff' : 'var(--text-muted)',
            fontWeight: studyMode === m.id ? 700 : 400, fontSize: 13, lineHeight: 1.3,
          }}>
          {m.label}
          <span style={{ display: 'block', fontSize: 10, opacity: studyMode === m.id ? 0.8 : 0.6, fontWeight: 400 }}>
            {m.sub}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 문제 카드 (유형별 분기) ───────────────────────────────────────────────────
function QuestionCard({ q, studyMode }) {
  const isLearn = studyMode === 'learn'

  return (
    <div>
      {/* 메타 배지 */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        <TypeBadge type={q.type} />
        {q.evalType && <span className="badge badge-blue">{q.evalType}</span>}
        {q.difficulty && <span className="badge badge-gray" style={{ fontSize: 10 }}>{q.difficulty}</span>}
      </div>

      {/* 문제 제목 (연습문제 N ...) */}
      <p style={{
        fontSize: 13, fontWeight: 700, lineHeight: 1.7,
        marginBottom: 10, color: 'var(--text)',
      }}>{q.heading}</p>

      {/* 문제 지문 (stems) */}
      <StemBlock stems={q.stems} />

      {/* 유형별 렌더링 */}
      {q.type === 'choice'    && <ChoiceCard    q={q} isLearn={isLearn} />}
      {q.type === 'ox'        && <OXCard        q={q} isLearn={isLearn} />}
      {q.type === 'text'      && <TextCard      q={q} isLearn={isLearn} />}
      {q.type === 'matching'  && <MatchingCard  q={q} isLearn={isLearn} />}
      {q.type === 'multi'     && <MultiCard     q={q} isLearn={isLearn} />}
      {q.type === 'interview' && <InterviewCard q={q} isLearn={isLearn} />}
    </div>
  )
}

// ── 유형 배지 ─────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  choice: '선다형', ox: 'O/X', text: '단답형',
  matching: '연결형', multi: '복수입력', interview: '면접형',
}
const TYPE_COLORS = {
  choice: '#1565c0', ox: '#2e7d32', text: '#6a1b9a',
  matching: '#bf360c', multi: '#0277bd', interview: '#4a148c',
}
function TypeBadge({ type }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: TYPE_COLORS[type] + '18',
      color: TYPE_COLORS[type],
      border: `1px solid ${TYPE_COLORS[type]}44`,
    }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ── 지문 블록 ─────────────────────────────────────────────────────────────────
function StemBlock({ stems }) {
  if (!stems || stems.length === 0) return null
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 10, padding: '12px 14px',
      border: '1px solid var(--border)', marginBottom: 12,
    }}>
      {stems.map((s, i) => {
        if (s.type === 'p') return (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.8, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{s.text}</p>
        )
        if (s.type === 'ul' || s.type === 'ol') {
          const Tag = s.type
          return (
            <Tag key={i} style={{ paddingLeft: 20, margin: '6px 0' }}>
              {s.items.map((item, j) => (
                <li key={j} style={{ fontSize: 13, lineHeight: 1.7 }}>{item}</li>
              ))}
            </Tag>
          )
        }
        if (s.type === 'blockquote') return (
          <div key={i} style={{
            borderLeft: '4px solid var(--primary)', background: '#edf9f3',
            padding: '8px 12px', margin: '8px 0', borderRadius: '0 8px 8px 0',
          }}>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{s.text}</p>
          </div>
        )
        return null
      })}
    </div>
  )
}

// ── 정답/해설 공통 블록 ───────────────────────────────────────────────────────
function AnswerExplanation({ q }) {
  return (
    <div style={{ marginTop: 10 }}>
      {q.modelAnswer && (
        <div style={{
          background: '#fff8df', borderRadius: 10, padding: '12px 14px',
          border: '1px solid #ffc107', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 6 }}>📖 모범답안</p>
          <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{q.modelAnswer}</p>
        </div>
      )}
      {q.scoringPoints?.length > 0 && (
        <div style={{
          background: '#edf9f3', borderRadius: 10, padding: '10px 14px',
          border: '1px solid #b9d4c2', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1e6f5c', marginBottom: 6 }}>✅ 채점 포인트</p>
          {q.scoringPoints.map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
              <p style={{ fontSize: 12, lineHeight: 1.7 }}>{pt}</p>
            </div>
          ))}
        </div>
      )}
      {q.explanation && (
        <div style={{
          background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px',
          border: '1px solid var(--primary)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>💡 해설</p>
          <p style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{q.explanation}</p>
        </div>
      )}
    </div>
  )
}

// ── choice ────────────────────────────────────────────────────────────────────
function ChoiceCard({ q, isLearn }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  if (isLearn) {
    return (
      <div>
        {q.choices.map((c, i) => {
          const correct = c.value === q.answer
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '10px 14px', marginBottom: 6,
              borderRadius: 10,
              background: correct ? '#e8f5e9' : 'transparent',
              border: `2px solid ${correct ? 'var(--success)' : 'var(--border)'}`,
            }}>
              <span style={{ fontWeight: 800, flexShrink: 0, color: correct ? 'var(--success)' : 'var(--text-muted)', fontSize: 15 }}>
                {correct ? '✓' : `${i + 1}.`}
              </span>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: correct ? '#1b5e20' : 'var(--text-muted)', fontWeight: correct ? 700 : 400 }}>
                {c.text}
              </p>
            </div>
          )
        })}
        <AnswerExplanation q={q} />
      </div>
    )
  }

  return (
    <div>
      {q.choices.map((c, i) => {
        const isCorrect  = c.value === q.answer
        const isSelected = selected === i
        let bg = 'var(--card)', border = 'var(--border)', color = 'var(--text)'
        if (revealed) {
          if (isCorrect)       { bg = '#e8f5e9'; border = 'var(--success)'; color = '#1b5e20' }
          else if (isSelected) { bg = '#ffebee'; border = 'var(--danger)';  color = '#b71c1c' }
        } else if (isSelected) { bg = 'var(--primary-light)'; border = 'var(--primary)' }
        return (
          <button key={i}
            onClick={() => { if (!revealed) setSelected(i) }}
            style={{
              width: '100%', textAlign: 'left', background: bg,
              border: `2px solid ${border}`, borderRadius: 10, padding: '12px 14px',
              marginBottom: 8, cursor: revealed ? 'default' : 'pointer',
              color, fontWeight: (revealed && (isCorrect || isSelected)) ? 700 : 400,
              fontSize: 14, lineHeight: 1.6,
            }}>
            <span style={{ fontWeight: 700, marginRight: 8, color: 'var(--text-muted)' }}>{i + 1}.</span>
            {c.text}
            {revealed && isCorrect  && <span style={{ marginLeft: 6 }}>✓</span>}
            {revealed && isSelected && !isCorrect && <span style={{ marginLeft: 6 }}>✗</span>}
          </button>
        )
      })}
      {!revealed
        ? <button className="btn btn-secondary btn-full" onClick={() => {
            setRevealed(true)
            if (selected !== null && q.choices[selected]?.value !== q.answer) {
              saveWrongAnswer(q, 2, selected !== null ? String(selected + 1) : null)
            } else if (selected === null) {
              saveWrongAnswer(q, 2, null)
            }
          }}>
            {selected !== null ? '채점하기' : '정답 보기'}
          </button>
        : <AnswerExplanation q={q} />
      }
    </div>
  )
}

// ── OX ────────────────────────────────────────────────────────────────────────
function OXCard({ q, isLearn }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  if (isLearn) {
    const isO = q.answer === 'O'
    return (
      <div>
        <div style={{
          padding: '16px', marginBottom: 10, borderRadius: 12, textAlign: 'center',
          background: isO ? '#e8f5e9' : '#ffebee',
          border: `2px solid ${isO ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          <p style={{ fontSize: 36, fontWeight: 800, color: isO ? 'var(--success)' : 'var(--danger)' }}>
            {q.answer}
          </p>
          <p style={{ fontSize: 12, marginTop: 4, color: isO ? '#1b5e20' : '#b71c1c' }}>
            {isO ? '맞다 (옳은 설명)' : '틀리다 (잘못된 설명)'}
          </p>
        </div>
        <AnswerExplanation q={q} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {['O', 'X'].map(val => {
          const isCorrect  = val === q.answer
          const isSelected = selected === val
          let bg = 'var(--card)', border = 'var(--border)'
          if (revealed) {
            if (isCorrect)       { bg = '#e8f5e9'; border = 'var(--success)' }
            else if (isSelected) { bg = '#ffebee'; border = 'var(--danger)'  }
          } else if (isSelected) { bg = 'var(--primary-light)'; border = 'var(--primary)' }
          return (
            <button key={val}
              onClick={() => { if (!revealed) setSelected(val) }}
              style={{
                flex: 1, padding: '20px 0', background: bg, border: `2px solid ${border}`,
                borderRadius: 12, cursor: revealed ? 'default' : 'pointer',
                fontSize: 28, fontWeight: 800,
                color: revealed && isCorrect ? 'var(--success)' : revealed && isSelected ? 'var(--danger)' : 'var(--text)',
              }}>
              {val}
            </button>
          )
        })}
      </div>
      {!revealed
        ? <button className="btn btn-secondary btn-full" onClick={() => {
            setRevealed(true)
            if (selected !== null && selected !== q.answer) {
              saveWrongAnswer(q, 2, selected)
            } else if (selected === null) {
              saveWrongAnswer(q, 2, null)
            }
          }}>
            {selected ? '채점하기' : '정답 보기'}
          </button>
        : <AnswerExplanation q={q} />
      }
    </div>
  )
}

// ── 단답형(text) ──────────────────────────────────────────────────────────────
function TextCard({ q, isLearn }) {
  const [input, setInput]     = useState('')
  const [revealed, setRevealed] = useState(false)

  if (isLearn) {
    return (
      <div>
        <div style={{
          background: '#e8f5e9', border: '2px solid var(--success)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 10, textAlign: 'center',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>정답</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#1b5e20' }}>{q.answer}</p>
        </div>
        <AnswerExplanation q={q} />
      </div>
    )
  }

  const normalize = s => (s || '').replace(/\s+/g, '').toLowerCase()
  const correct   = normalize(input) === normalize(q.answer)

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="답을 입력하세요"
        disabled={revealed}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px 14px', fontSize: 15, borderRadius: 10,
          border: `2px solid ${revealed ? (correct ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
          background: revealed ? (correct ? '#e8f5e9' : '#ffebee') : 'var(--card)',
          marginBottom: 12,
        }}
      />
      {!revealed
        ? <button className="btn btn-secondary btn-full" onClick={() => setRevealed(true)}>
            {input.trim() ? '채점하기' : '정답 보기'}
          </button>
        : (
          <div>
            {input.trim() && (
              <p style={{
                fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 10,
                color: correct ? 'var(--success)' : 'var(--danger)',
              }}>
                {correct ? '✓ 정답입니다!' : '✗ 오답 — 정답: ' + q.answer}
              </p>
            )}
            <AnswerExplanation q={q} />
          </div>
        )
      }
    </div>
  )
}

// ── 연결형(matching) ──────────────────────────────────────────────────────────
function MatchingCard({ q, isLearn }) {
  const [answers, setAnswers] = useState({})
  const [revealed, setRevealed] = useState(false)

  // 정답 맵 { expected_key: option_text }
  const optionMap = useMemo(() => {
    const m = {}
    for (const opt of q.options) m[opt.key] = opt.text
    return m
  }, [q])

  if (isLearn) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          {q.pairs.map((pair, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 10,
              background: '#e8f5e9', border: '1px solid #b9d4c2',
            }}>
              <span style={{ flexShrink: 0, fontWeight: 700, color: '#1b5e20', fontSize: 13 }}>
                {pair.left.substring(0, 1)}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: '#1b5e20', fontWeight: 600, marginBottom: 4 }}>
                  {pair.left.substring(1)}
                </p>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: '#2e7d32' }}>
                  → {optionMap[pair.expected] ?? pair.expected}
                </p>
              </div>
            </div>
          ))}
        </div>
        <AnswerExplanation q={q} />
      </div>
    )
  }

  const allSelected = q.pairs.every((_, i) => answers[i])

  return (
    <div>
      {q.pairs.map((pair, i) => {
        const selected = answers[i]
        const isCorrect = revealed && selected === pair.expected
        const isWrong   = revealed && selected && selected !== pair.expected
        return (
          <div key={i} style={{
            marginBottom: 10, padding: '10px 12px', borderRadius: 10,
            background: isCorrect ? '#e8f5e9' : isWrong ? '#ffebee' : 'var(--card)',
            border: `1px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : 'var(--border)'}`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {pair.left}
            </p>
            <select
              value={selected || ''}
              disabled={revealed}
              onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : 'var(--border)'}`,
                fontSize: 13, background: 'var(--card)',
              }}>
              <option value="">선택하세요</option>
              {q.options.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.text}</option>
              ))}
            </select>
            {revealed && isWrong && (
              <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>
                정답: {optionMap[pair.expected]}
              </p>
            )}
          </div>
        )
      })}
      {!revealed
        ? <button className="btn btn-secondary btn-full"
            onClick={() => setRevealed(true)}
            disabled={!allSelected}>
            {allSelected ? '채점하기' : '정답 보기'}
          </button>
        : <AnswerExplanation q={q} />
      }
    </div>
  )
}

// ── 복수입력(multi) ───────────────────────────────────────────────────────────
function MultiCard({ q, isLearn }) {
  const [answers, setAnswers]   = useState({})
  const [revealed, setRevealed] = useState(false)

  if (isLearn) {
    return (
      <div>
        {q.inputs.map((inp, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start',
            padding: '10px 14px', borderRadius: 10,
            background: '#e8f5e9', border: '1px solid #b9d4c2',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: 'var(--success)',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{inp.order}</span>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: '#1b5e20' }}>{inp.expected}</p>
          </div>
        ))}
        <AnswerExplanation q={q} />
      </div>
    )
  }

  return (
    <div>
      {q.inputs.map((inp, i) => {
        const val = answers[i] || ''
        const norm = s => (s || '').replace(/\s+/g, '').toLowerCase()
        const correct  = revealed && norm(val).length > 0 && inp.expected.toLowerCase().includes(norm(val))
        const wrong    = revealed && val && !correct
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{inp.order}</span>
            <input
              type="text"
              value={val}
              onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
              disabled={revealed}
              placeholder={`${inp.order}번 답 입력`}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13,
                border: `2px solid ${correct ? 'var(--success)' : wrong ? 'var(--danger)' : 'var(--border)'}`,
                background: correct ? '#e8f5e9' : wrong ? '#ffebee' : 'var(--card)',
              }}
            />
          </div>
        )
      })}
      {!revealed
        ? <button className="btn btn-secondary btn-full" onClick={() => setRevealed(true)}>
            정답 보기
          </button>
        : (
          <div>
            {q.inputs.map((inp, i) => (
              <p key={i} style={{ fontSize: 12, color: 'var(--success)', marginBottom: 4 }}>
                <strong>답 {inp.order}:</strong> {inp.expected}
              </p>
            ))}
            <AnswerExplanation q={q} />
          </div>
        )
      }
    </div>
  )
}

// ── 면접형(interview) ─────────────────────────────────────────────────────────
function InterviewCard({ q, isLearn }) {
  const [revealed, setRevealed] = useState(false)

  const criteria = q.criteria ?? []

  return (
    <div>
      {/* 채점 기준 (학습/퀴즈 공통) */}
      {criteria.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>💡 답변 포인트</p>
          {criteria.slice(0, 3).map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < Math.min(criteria.length, 3) - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>•</span>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>{c.point}</p>
            </div>
          ))}
        </div>
      )}

      {/* 학습 모드: 모범답안 바로 표시 */}
      {isLearn && (
        <div>
          {q.modelAnswer && (
            <div style={{
              background: '#fff8df', border: '1px solid #ffc107',
              borderRadius: 10, padding: '12px 14px', marginBottom: 10,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 8 }}>📖 모범답안</p>
              <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{q.modelAnswer}</p>
            </div>
          )}
          {q.scoringPoints?.length > 0 && (
            <div style={{
              background: '#edf9f3', border: '1px solid #b9d4c2',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1e6f5c', marginBottom: 6 }}>✅ 핵심 포인트</p>
              {q.scoringPoints.map((pt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
                  <p style={{ fontSize: 12, lineHeight: 1.7 }}>{pt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 퀴즈 모드: 토글 */}
      {!isLearn && (
        !revealed
          ? <button className="btn btn-secondary btn-full" onClick={() => setRevealed(true)}>
              📖 모범답안 확인하기
            </button>
          : (
            <div>
              {q.modelAnswer && (
                <div style={{
                  background: '#fff8df', border: '1px solid #ffc107',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#856404', marginBottom: 8 }}>📖 모범답안</p>
                  <p style={{ fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{q.modelAnswer}</p>
                </div>
              )}
              {q.scoringPoints?.length > 0 && (
                <div style={{
                  background: '#edf9f3', border: '1px solid #b9d4c2',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#1e6f5c', marginBottom: 6 }}>✅ 핵심 포인트</p>
                  {q.scoringPoints.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
                      <p style={{ fontSize: 12, lineHeight: 1.7 }}>{pt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
      )}
    </div>
  )
}

// ── 이론 섹션 블록 ────────────────────────────────────────────────────────────
function TheorySectionBlock({ sec }) {
  const headingStyle = (size, color, borderColor) => ({
    fontSize: size, fontWeight: 800, color,
    borderLeft: `4px solid ${borderColor}`, paddingLeft: 10,
    margin: '18px 0 8px',
  })

  switch (sec.type) {
    case 'h3': return <h3 style={headingStyle(15, '#1e4d3f', 'var(--primary)')}>{sec.text}</h3>
    case 'h4': return <p style={{ fontSize: 14, fontWeight: 700, color: '#164e63', margin: '14px 0 6px' }}>{sec.text}</p>
    case 'h5': return (
      <div style={{
        background: 'var(--primary-light)', borderRadius: 8, padding: '8px 12px',
        margin: '16px 0 8px', borderLeft: '4px solid var(--primary)',
      }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{sec.text}</p>
      </div>
    )
    case 'h6': return <p style={{ fontSize: 13, fontWeight: 700, color: '#37474f', margin: '10px 0 4px' }}>{sec.text}</p>
    case 'p':  return <p style={{ fontSize: 13, lineHeight: 1.8, margin: '4px 0', color: 'var(--text)' }}>{sec.text}</p>
    case 'ul': return (
      <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
        {sec.items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '3px 0' }}>{item}</li>
        ))}
      </ul>
    )
    case 'ol': return (
      <ol style={{ paddingLeft: 20, margin: '6px 0' }}>
        {sec.items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '3px 0' }}>{item}</li>
        ))}
      </ol>
    )
    case 'blockquote': return (
      <div style={{
        borderLeft: '4px solid var(--primary)', background: '#edf9f3',
        padding: '10px 14px', margin: '10px 0', borderRadius: '0 8px 8px 0',
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>{sec.text}</p>
      </div>
    )
    case 'table': return (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {sec.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    border: '1px solid var(--border)', padding: '7px 10px',
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
    default: return null
  }
}
