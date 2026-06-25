import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { recordActivity } from '../../lib/activity.js'
import jobQuestions         from '../../../data/questions.json'
import ncsQuestions         from '../../../data/ncs-questions.json'
import foodServiceQuestions from '../../../data/food-service-questions.json'

const QUESTION_POOLS = {
  'job-common':    jobQuestions,
  'ncs-basic':     ncsQuestions,
  'food-service':  foodServiceQuestions,
}

function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

// ── 완성형/연결형/면접형 여부 분류 ──────────────────────────────────────
const WORD_TYPES     = new Set(['fill', 'complete'])         // 한 단어
const SENTENCE_TYPES = new Set(['matching', 'multi', 'interview']) // 한 문장

function selfcheckInputType(practiceType) {
  if (WORD_TYPES.has(practiceType))     return 'word'
  if (SENTENCE_TYPES.has(practiceType)) return 'sentence'
  return 'sentence'  // 그 외 selfcheck 기본
}

// ── 한국어 입력 검증 ─────────────────────────────────────────────────────
// 낱자(자음/모음만: ㄱ-ㅣ) 비율이 높으면 "아무렇게나 입력" 판정
function validateKorean(text, inputType) {
  const t = text.trim()
  if (!t) return '답을 입력해 주세요.'

  // 완성된 한글 음절 (가-힣)
  const syllables = (t.match(/[가-힣]/g) || []).length
  // 낱자 자음/모음 (ㄱ-ㅎ, ㅏ-ㅣ)
  const jamo      = (t.match(/[ㄱ-ㅣ]/g) || []).length

  if (syllables === 0 && jamo > 0)
    return '자음·모음만 입력하셨습니다. 완성된 단어를 입력해 주세요.'
  if (jamo > syllables)
    return '올바른 단어로 입력해 주세요. (자음·모음이 너무 많습니다)'

  if (inputType === 'word') {
    if (syllables < 1)
      return '최소 한 단어(한글) 이상 입력해 주세요.'
  } else {
    // sentence
    if (syllables < 4)
      return '한 문장 이상 입력해 주세요. (최소 4자 이상)'
  }
  return null  // 통과
}

// ── 실제 시험 안내 문구 ──────────────────────────────────────────────────
const EXAM_NOTICE = {
  fill:      { title: '완성형 문항 안내', icon: '✏️', body: '실제 외부평가에서는 빈칸에 직접 단어·어구를 작성합니다.\n먼저 스스로 답을 적어본 뒤 모범답안과 비교해 보세요.' },
  complete:  { title: '완성형 문항 안내', icon: '✏️', body: '실제 외부평가에서는 빈칸에 직접 단어·어구를 작성합니다.\n먼저 스스로 답을 적어본 뒤 모범답안과 비교해 보세요.' },
  matching:  { title: '연결형 문항 안내', icon: '🔗', body: '실제 외부평가에서는 관련 개념을 직접 연결하는 문장을 작성합니다.\n먼저 스스로 한 문장으로 답해본 뒤 모범답안을 확인하세요.' },
  multi:     { title: '복수완성형 안내',  icon: '✏️', body: '실제 외부평가에서는 여러 빈칸에 직접 답을 작성합니다.\n먼저 스스로 적어본 뒤 모범답안과 비교해 보세요.' },
  interview: { title: '면접형 문항 안내', icon: '🎤', body: '실제 외부평가에서는 면접관 앞에서 구술로 답합니다.\n먼저 한 문장으로 적어본 뒤 모범답안의 핵심 키워드를 확인하세요.' },
  default:   { title: '서술형 문항 안내', icon: '📝', body: '실제 평가에서는 직접 답을 작성하거나 말하는 유형입니다.\n먼저 스스로 답해본 뒤 모범답안을 확인하세요.' },
}

export default function MissionScreen({ mission, onBack, onViewWrongAnswers }) {
  const [questions,   setQuestions]   = useState([])
  const [idx,         setIdx]         = useState(0)
  const [answers,     setAnswers]     = useState({})  // qId → number(mcq/ox) | 'O'|'X'(selfcheck)
  const [typed,       setTyped]       = useState({})  // qId → string (selfcheck 타이핑)
  const [typeError,   setTypeError]   = useState({})  // qId → string | null
  const [revealed,    setRevealed]    = useState({})  // qId → bool (모범답안 공개됨)
  const [phase,       setPhase]       = useState('loading')
  const [result,      setResult]      = useState(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [examPopup,   setExamPopup]   = useState(null)  // { type, onClose }
  const shownNotice = useRef(new Set())
  const startTime   = useRef(Date.now())
  const textareaRef = useRef(null)

  useEffect(() => { loadQuestions() }, [])

  // 문항 변경 시 textarea에 포커스
  useEffect(() => {
    if (phase === 'quiz' && questions[idx]?.questionMode === 'selfcheck') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [idx, phase])

  function loadQuestions() {
    const subjectId   = mission.subject_id ?? 'job-common'
    const allQuestions = QUESTION_POOLS[subjectId] ?? jobQuestions
    const qIds        = mission.question_ids ?? []
    let pool          = []

    if (qIds.length > 0 && !qIds[0].endsWith('-Q*')) {
      const idSet = new Set(qIds)
      pool = allQuestions.filter(q => idSet.has(q.id) && !q.excludeFromQuiz)
    }
    if (pool.length === 0 && qIds.length > 0 && qIds[0].startsWith('area:')) {
      const areas = new Set(qIds.map(q => q.replace('area:', '')))
      pool = allQuestions.filter(q => areas.has(q.area) && !q.excludeFromQuiz)
    }
    if (pool.length === 0 && qIds.length > 0) {
      const prefixes = qIds.map(p => p.replace(/-Q\*$/, ''))
      pool = allQuestions.filter(q =>
        prefixes.some(p => q.lessonId === p || q.id.startsWith(p + '-Q')) &&
        !q.excludeFromQuiz
      )
    }
    if (pool.length === 0 && mission.area_ids?.length > 0) {
      pool = allQuestions.filter(q =>
        mission.area_ids.some(a =>
          q.area === a || q.lessonId?.startsWith(a.replace('a','C')) || q.id.startsWith(a)
        ) && !q.excludeFromQuiz
      )
    }
    if (pool.length === 0) pool = allQuestions.filter(q => !q.excludeFromQuiz)

    if (pool.length === 0) {
      setErrorMsg(`문항 매칭 실패. question_ids 첫 3개: ${qIds.slice(0,3).join(', ')}`)
      setPhase('error')
      return
    }

    if (mission.shuffle) pool = pool.sort(() => Math.random() - 0.5)
    setQuestions(pool.slice(0, mission.question_count))
    startTime.current = Date.now()
    setPhase('quiz')
  }

  // examNotice 체크 후 이동
  function tryGoTo(nextIdx) {
    const nextQ = questions[nextIdx]
    if (!nextQ) return
    if (nextQ.examNotice === 'first' && !shownNotice.current.has(nextQ.practiceType)) {
      shownNotice.current.add(nextQ.practiceType ?? 'default')
      setExamPopup({ type: nextQ.practiceType ?? 'default', onClose: () => { setExamPopup(null); setIdx(nextIdx) } })
    } else {
      setIdx(nextIdx)
    }
  }

  useEffect(() => {
    if (phase !== 'quiz' || questions.length === 0) return
    const q = questions[0]
    if (q.examNotice === 'first' && !shownNotice.current.has(q.practiceType)) {
      shownNotice.current.add(q.practiceType ?? 'default')
      setExamPopup({ type: q.practiceType ?? 'default', onClose: () => setExamPopup(null) })
    }
  }, [phase, questions])

  // ── 자가채점 타이핑 검증 → 모범답안 공개 ────────────────────────────────
  function handleReveal(q) {
    const inputType = selfcheckInputType(q.practiceType)
    const err = validateKorean(typed[q.id] ?? '', inputType)
    if (err) {
      setTypeError(prev => ({ ...prev, [q.id]: err }))
      textareaRef.current?.focus()
      return
    }
    setTypeError(prev => ({ ...prev, [q.id]: null }))
    setRevealed(prev => ({ ...prev, [q.id]: true }))
  }

  async function submitQuiz() {
    // 자동채점(mcq/ox)과 서술형(selfcheck) 분리
    let autoScore = 0
    const mcqPayload  = {}
    const typedPayload = {}

    for (const q of questions) {
      if (q.questionMode === 'selfcheck') {
        typedPayload[q.id] = typed[q.id] ?? ''
      } else {
        const sel = answers[q.id] ?? null
        mcqPayload[q.id] = sel
        if (sel !== null && sel === answerIdx(q.answer)) autoScore++
      }
    }

    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    setSubmitting(true)
    recordActivity('mission')
    const { data, error } = await supabase.rpc('rpc_submit_mission', {
      p_mission_id:    mission.id,
      p_answers:       { ...mcqPayload, _score: autoScore },
      p_time_taken_sec: timeTaken,
      p_typed_answers: typedPayload,
    })
    setSubmitting(false)
    if (error) { alert('제출 오류: ' + error.message); return }
    setResult({
      score:          data.score,
      total:          data.total,
      gradingStatus:  data.grading_status,
      timeTaken,
      questions,
      answers:        mcqPayload,
      typed,
    })
    setPhase('result')
  }

  // ── 에러 ──
  if (phase === 'error') return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={onBack}>←</button><span className="appbar-title">오류</span></div>
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <span className="empty-state-title">문항을 불러올 수 없습니다</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '0 16px' }}>{errorMsg}</span>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onBack}>돌아가기</button>
      </div>
    </div>
  )

  if (phase === 'loading') return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={onBack}>←</button><span className="appbar-title">{mission.title}</span></div>
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  // ── 결과 ──
  if (phase === 'result' && result) {
    const autoTotal   = result.questions.filter(q => q.questionMode !== 'selfcheck').length
    const selfTotal   = result.questions.filter(q => q.questionMode === 'selfcheck').length
    const pct         = autoTotal > 0 ? Math.round(result.score / autoTotal * 100) : 0
    const isPending   = result.gradingStatus === 'pending'

    return (
      <div className="screen">
        <div className="appbar"><span className="appbar-title">미션 결과</span></div>
        <div className="screen-body">
          <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
            <div style={{ fontSize: 64 }}>{isPending ? '📬' : pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪'}</div>
            {autoTotal > 0 && (
              <>
                <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>{pct}점</p>
                <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  선택형 {result.score}/{autoTotal}문항 · {Math.floor(result.timeTaken/60)}분 {result.timeTaken%60}초
                </p>
              </>
            )}
            {isPending && (
              <div style={{
                margin: '12px auto 0', maxWidth: 320,
                background: '#fff8e1', borderRadius: 10, padding: '12px 16px',
                border: '1px solid #f9a825',
              }}>
                <p style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: 14 }}>
                  📝 서술형 {selfTotal}문항 — 교사 채점 대기 중
                </p>
                <p style={{ fontSize: 12, color: '#e65100', lineHeight: 1.6 }}>
                  선생님이 채점을 완료하면 최종 점수가 확정됩니다.
                </p>
              </div>
            )}
          </div>

          <p className="section-title">문항 확인</p>
          {result.questions.map((q, i) => {
            const myAns   = result.answers[q.id]
            const myTyped = result.typed?.[q.id]
            const isSelf  = q.questionMode === 'selfcheck'
            const isOX    = q.questionMode === 'ox'
            const isRight = !isSelf && myAns !== null && myAns !== undefined && myAns === answerIdx(q.answer)
            const borderColor = isSelf ? 'var(--border)' : isRight ? 'var(--success)' : 'var(--danger)'

            return (
              <div key={q.id} className="card" style={{ marginBottom: 10, borderLeft: `4px solid ${borderColor}` }}>
                <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                  {isSelf ? '📝' : isRight ? '✅' : '❌'} Q{i+1}. {q.stem}
                </p>

                {isSelf ? (
                  <>
                    {myTyped && (
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>내가 작성한 답</p>
                        <p style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.6 }}>"{myTyped}"</p>
                      </div>
                    )}
                    <p style={{ fontSize: 12, color: '#e65100', fontWeight: 600 }}>⏳ 교사 채점 대기 중</p>
                  </>
                ) : isOX ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    정답: <b style={{ color: 'var(--success)' }}>{q.answer === 'A' ? 'O' : 'X'}</b>
                    {myAns !== null && myAns !== undefined ? ` · 내 답: ${myAns === 0 ? 'O' : 'X'}` : ''}
                  </p>
                ) : (
                  q.choices?.map((text, ci) => {
                    const correctIdx = answerIdx(q.answer)
                    const isCorrect  = ci === correctIdx
                    const isSelected = ci === myAns
                    return (
                      <p key={ci} style={{
                        fontSize: 13, padding: '3px 0',
                        color: isCorrect ? 'var(--success)' : (isSelected && !isCorrect) ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: isCorrect || isSelected ? 700 : 400,
                      }}>
                        {isSelected ? '▶ ' : '　'}{ci+1}. {text}{isCorrect ? ' ✓' : ''}
                      </p>
                    )
                  })
                )}

                {!isSelf && q.explanation && (
                  <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {onViewWrongAnswers && result.questions.some(q => q.questionMode !== 'selfcheck') && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onViewWrongAnswers}>
                📋 오답노트
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onBack}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 퀴즈 ──
  const q      = questions[idx]
  const total  = questions.length
  const isLast = idx === total - 1
  const qMode  = q?.questionMode ?? 'mcq'

  // selfcheck는 revealed 기준, 나머지는 answers 기준
  const isRevealed      = revealed[q?.id] ?? false
  const currentAnswered = qMode === 'selfcheck'
    ? isRevealed
    : answers[q?.id] !== undefined

  // 제출 가능 여부: 모든 문항이 완료됐는지 (selfcheck = revealed)
  const totalAnswered = questions.reduce((n, qItem) => {
    if (qItem.questionMode === 'selfcheck') return n + (revealed[qItem.id] ? 1 : 0)
    return n + (answers[qItem.id] !== undefined ? 1 : 0)
  }, 0)
  const typedVal        = typed[q?.id]    ?? ''
  const inputType       = selfcheckInputType(q?.practiceType)
  const inputErr        = typeError[q?.id] ?? null

  // examNotice 안내 팝업 (전체화면)
  if (examPopup) {
    const info = EXAM_NOTICE[examPopup.type] ?? EXAM_NOTICE.default
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => { setExamPopup(null); onBack() }}>←</button>
          <span className="appbar-title">{mission.title}</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid var(--primary)', maxWidth: 360 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{info.icon}</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{info.title}</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 20 }}>{info.body}</p>
            <button className="btn btn-primary btn-full" onClick={examPopup.onClose}>
              알겠어요, 학습 시작!
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={() => {
          if (window.confirm('퀴즈를 종료할까요? 진행상황이 사라집니다.')) onBack()
        }}>←</button>
        <span className="appbar-title">{mission.title}</span>
        <span style={{ fontSize: 13 }}>{idx+1}/{total}</span>
      </div>

      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--primary)', width: `${(idx+1)/total*100}%`, transition: 'width 0.3s' }} />
      </div>

      <div className="screen-body">
        {/* 서술형 배지 */}
        {qMode === 'selfcheck' && q.examNotice === 'badge' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            background: '#fff8e1', borderRadius: 8, marginBottom: 10,
            border: '1px solid #f9a825',
          }}>
            <span style={{ fontSize: 13 }}>📝</span>
            <span style={{ fontSize: 12, color: '#e65100' }}>실제 평가에서는 직접 작성·서술하는 유형</span>
          </div>
        )}

        {/* 문항 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>문항 {idx+1}</p>
          <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{q?.stem}</p>
        </div>

        {/* ── MCQ ── */}
        {qMode === 'mcq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {q?.choices?.map((text, ci) => {
              const selected = answers[q.id] === ci
              return (
                <button key={ci} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: ci }))}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: selected ? 'var(--primary-light)' : 'var(--card)',
                    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                    fontSize: 14, lineHeight: 1.5, color: 'var(--text)', transition: 'all 0.15s',
                  }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: selected ? 'var(--primary)' : 'var(--border)',
                    color: selected ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{ci+1}</span>
                  <span style={{ flex: 1 }}>{text}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── O/X ── */}
        {qMode === 'ox' && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[['O', 'var(--success)'], ['X', 'var(--danger)']].map(([label, color], ci) => {
              const selected = answers[q.id] === ci
              return (
                <button key={label} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: ci }))}
                  style={{
                    flex: 1, padding: '28px 0', borderRadius: 16, cursor: 'pointer',
                    background: selected ? color : 'var(--card)',
                    border: `2px solid ${selected ? color : 'var(--border)'}`,
                    fontSize: 40, fontWeight: 900, lineHeight: 1,
                    color: selected ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── 자가채점 (완성형·연결형·면접형) ── */}
        {qMode === 'selfcheck' && (
          <div style={{ marginBottom: 24 }}>
            {/* 1단계: 타이핑 */}
            {!isRevealed && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {inputType === 'word'
                    ? '먼저 스스로 답을 한 단어로 적어 보세요.'
                    : '먼저 스스로 답을 한 문장으로 적어 보세요.'}
                </p>
                <textarea
                  ref={textareaRef}
                  value={typedVal}
                  onChange={e => {
                    setTyped(prev => ({ ...prev, [q.id]: e.target.value }))
                    if (typeError[q.id]) setTypeError(prev => ({ ...prev, [q.id]: null }))
                  }}
                  onKeyDown={e => {
                    // 완성형(한 단어)에서 Enter → 바로 검증
                    if (inputType === 'word' && e.key === 'Enter') { e.preventDefault(); handleReveal(q) }
                  }}
                  placeholder={inputType === 'word' ? '예: 고객 서비스' : '예: 고객 응대 시 밝은 표정과 친절한 말투가 중요합니다.'}
                  rows={inputType === 'word' ? 1 : 3}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: 15,
                    border: `2px solid ${inputErr ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 10, fontFamily: 'var(--font)', resize: 'none',
                    background: 'var(--card)', color: 'var(--text)', boxSizing: 'border-box',
                    lineHeight: 1.6,
                  }}
                />
                {inputErr && (
                  <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                    ⚠️ {inputErr}
                  </p>
                )}
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 12 }}
                  onClick={() => handleReveal(q)}
                  disabled={!typedVal.trim()}>
                  📖 모범답안 확인하기
                </button>
              </div>
            )}

            {/* 2단계: 모범답안 공개 — 교사가 채점 */}
            {isRevealed && (
              <div>
                {typedVal && (
                  <div style={{
                    background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                    border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>내가 작성한 답</p>
                    <p style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.6 }}>"{typedVal}"</p>
                  </div>
                )}
                <div style={{
                  background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                  border: '1px solid var(--primary)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4, fontWeight: 700 }}>모범답안</p>
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {q.modelAnswer || q.answer}
                  </p>
                  {q.explanation && (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
                <div style={{ background: '#fff8e1', borderRadius: 8, padding: '8px 12px', border: '1px solid #f9a825' }}>
                  <p style={{ fontSize: 12, color: '#e65100' }}>
                    📝 선생님이 내 답과 모범답안을 비교하여 채점합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 이전/다음/제출 */}
        <div style={{ display: 'flex', gap: 10 }}>
          {idx > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIdx(i => i-1)}>
              ← 이전
            </button>
          )}
          {!isLast ? (
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => tryGoTo(idx + 1)}
              disabled={!currentAnswered}>
              다음 →
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}
              onClick={submitQuiz}
              disabled={
                submitting || totalAnswered < total
              }>
              {submitting ? '제출 중...' : `제출 (${totalAnswered}/${total})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
