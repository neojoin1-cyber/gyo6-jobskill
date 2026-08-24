import { useState, useMemo, useEffect } from 'react'
import QuestionMedia from './QuestionMedia.jsx'
import PulldownForm from './PulldownForm.jsx'
import { buildLearningMistakes, buildLearningPoints, learningVisualFor } from '../../lib/learningExperience.js'
import CompactText from '../../components/CompactText.jsx'

const EMPTY_QUESTIONS = []

function ExpandableText({ text, style }) {
  return <CompactText text={text} style={style} />
}

function readableScenario(value) {
  return String(value ?? '')
    .replace(/\s*•\s*/g, '\n• ')
    .replace(/([.!?~])(?=[가-힣A-Za-z0-9【[])/g, '$1\n')
    .replace(/,(?=(?:아래|다음|단,|그리고|하지만|반면))/g, ',\n')
    .replace(/\^\^(?=[가-힣A-Za-z])/g, '^^\n')
    .replace(/^\s+|\s+$/g, '')
}

// learn 텍스트를 줄 단위로 파싱해 구조별 스타일로 렌더링 (📋 헤더, ①②③ 번호목록, 📌💡✅ 등)
function LearnLines({ text }) {
  return (
    <CompactText
      text={text}
      maxItemChars={76}
      style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', color: 'var(--text)' }}
    />
  )
}

function SampleQuestionCard({ sample, example, isOpen, selected, onSelect, onChange, onOpen }) {
  if (sample.isInterview) {
    return isOpen ? (
      <div data-learning-question="interview" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>{sample.format || '면접 질문형'}</p>
        <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 600, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
        <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--success)' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 5 }}>
            {sample.modelAnswer ? '모범 답변 핵심' : '직접 답해 볼 차례'}
          </p>
          {sample.modelAnswer ? (
            <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 13.5px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: '#1b5e20' }}>{sample.modelAnswer}</p>
          ) : (
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#1b5e20' }}>읽는 순서로 답의 뼈대 구성 · 자신의 경험과 행동 추가</p>
          )}
          {sample.answerPoints?.length > 0 && <ul className="learning-answer-points">{sample.answerPoints.map((point, index) => <li key={index}>{point}</li>)}</ul>}
        </div>
      </div>
    ) : (
      <button onClick={onOpen} style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
        면접에서는 어떻게 물을까?
      </button>
    )
  }

  if (sample.type === 'pulldown') {
    const blanks = sample.blanks || sample.sourceQuestion?.blanks || []
    const filled = Object.values(selected || {}).filter(value => value != null).length
    return (
      <div data-learning-question="pulldown" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>실제 출제형 · 풀다운형</p>
        {sample.context && <p style={{ fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{sample.context}</p>}
        <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 700, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
        <PulldownForm q={sample.sourceQuestion || sample} checked={isOpen} value={selected} onChange={onChange} />
        {!isOpen && (
          <button type="button" disabled={filled < blanks.length} onClick={onOpen} style={{ width: '100%', padding: '10px', borderRadius: 8, border: 0, background: filled < blanks.length ? '#E5E7EB' : '#4F46E5', color: filled < blanks.length ? '#6B7280' : '#fff', fontWeight: 800, cursor: filled < blanks.length ? 'default' : 'pointer' }}>
            {filled < blanks.length ? `빈칸 채우기 ${filled}/${blanks.length}` : '정답·근거 확인'}
          </button>
        )}
        {isOpen && sample.explanation && <div className="learning-evidence"><p className="learning-block-label">정답 근거</p><ExpandableText text={sample.explanation} style={{ fontSize: 12.5, lineHeight: 1.72 }} /></div>}
      </div>
    )
  }

  const answers = new Set(Array.isArray(sample.answer) ? sample.answer : [sample.answer])
  return (
    <div data-learning-question="choice" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>실제 출제형 · {sample.format || '선택형'}</p>
      {sample.sourceQuestion && <QuestionMedia q={sample.sourceQuestion} />}
      {sample.context && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d7f5', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#3b5bdb', marginBottom: 5 }}>지문 / 상황</p>
          <p style={{ fontSize: 'clamp(12px, 3.5vw, 13px)', lineHeight: 1.85, whiteSpace: 'pre-wrap', color: '#1a237e' }}>{sample.context}</p>
        </div>
      )}
      <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 700, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(sample.choices || []).map(choice => {
          const isCorrect = answers.has(choice.value)
          const isSelected = selected === choice.value
          const resultColor = isCorrect ? '#15803D' : '#B91C1C'
          return (
            <button
              type="button"
              data-learning-choice={choice.value}
              data-correct={isOpen ? String(isCorrect) : undefined}
              key={choice.value}
              onClick={() => onSelect(choice.value)}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                background: isOpen && isCorrect ? '#E8F5E9' : isOpen && isSelected ? '#FEF2F2' : '#fff',
                border: isOpen && (isCorrect || isSelected) ? `1.5px solid ${resultColor}` : isSelected ? '1.5px solid #4F46E5' : '1px solid var(--border)',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 13, color: isOpen && (isCorrect || isSelected) ? resultColor : 'var(--text-muted)', flexShrink: 0, minWidth: 18 }}>{choice.value}</span>
              <span style={{ fontSize: 'clamp(12.5px, 3.7vw, 13.5px)', lineHeight: 1.65, color: 'var(--text)', fontWeight: isOpen && isCorrect ? 700 : 500, flex: 1 }}>{choice.text}</span>
              {isOpen && isCorrect && <span aria-label="정답" style={{ flexShrink: 0, fontSize: 13, color: '#15803D', fontWeight: 800 }}>정답</span>}
              {isOpen && isSelected && !isCorrect && <span aria-label="내 선택" style={{ flexShrink: 0, fontSize: 13, color: '#B91C1C', fontWeight: 800 }}>내 선택</span>}
            </button>
          )
        })}
      </div>
      {!isOpen && <p data-learning-answer-state="hidden" style={{ margin: '8px 0 0', fontSize: 12, color: '#92400E', fontWeight: 700 }}>선지 선택 → 정답·근거 확인</p>}
      {isOpen && (
        <div data-learning-answer-state="revealed">
          {example && <div style={{ marginTop: 10, borderTop: '1px solid #FFE082', paddingTop: 8 }}><p style={{ fontSize: 12, color: '#B45309', fontWeight: 700, marginBottom: 4 }}>출제 포인트</p><CompactText text={example} maxItemChars={70} style={{ fontSize: 12, color: 'var(--text-muted)' }} /></div>}
          {sample.thinkingSteps?.length > 0 && <div className="learning-reasoning"><p className="learning-block-label">문제를 읽는 순서</p><ol>{sample.thinkingSteps.map((step, index) => <li key={index}>{step}</li>)}</ol></div>}
          {sample.explanation && <div className="learning-evidence"><p className="learning-block-label">정답 근거</p><ExpandableText text={sample.explanation} style={{ fontSize: 12.5, lineHeight: 1.72 }} /></div>}
        </div>
      )}
    </div>
  )
}

export default function StudySummary({ summary, questions = EMPTY_QUESTIONS, onStartQuiz, initialStep = 0, onStepChange }) {
  const { title, intro, keyPoints = [], mustRemember = [], terms = [], tips = [] } = summary || {}
  const learningPoints = useMemo(() => buildLearningPoints(summary, questions), [summary, questions])
  const learningMistakes = useMemo(() => buildLearningMistakes(summary, questions), [summary, questions])
  const introVisual = useMemo(() => learningVisualFor(`${title ?? ''} ${intro ?? ''}`), [title, intro])

  // 카드 시퀀스 구성
  const cards = useMemo(() => {
    const c = [{ type: 'intro' }]
    learningPoints.forEach((p, i) => c.push({ type: 'point', point: p, text: typeof p === 'string' ? p : '', n: i + 1 }))
    if (mustRemember.length) c.push({ type: 'recap' })
    // 용어 데이터가 소스마다 term/word/name 키를 혼용 → 모두 수용(빈 headline 방지)
    terms.forEach(t => c.push({ type: 'term', term: t.term ?? t.word ?? t.name, def: t.def ?? t.definition }))
    learningMistakes.forEach(mistake => c.push({ type: 'tip', mistake }))
    c.push({ type: 'end' })
    return c
  }, [summary, learningPoints, learningMistakes])

  const [step, setStep]         = useState(initialStep)
  const [revealed, setRevealed] = useState({})  // stepIndex → true
  const [sampleSelections, setSampleSelections] = useState({})
  const [known, setKnown]       = useState({})   // 용어 자기평가

  // 단원이 바뀌면 처음부터
  useEffect(() => { setStep(initialStep); setRevealed({}); setSampleSelections({}); setKnown({}) }, [summary, questions]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])

  if (!summary || cards.length === 0) return null

  const card    = cards[step]
  const isOpen  = !!revealed[step]
  const open    = () => setRevealed(r => ({ ...r, [step]: true }))
  const selectSample = value => {
    setSampleSelections(current => ({ ...current, [step]: value }))
    open()
  }
  const total   = cards.length
  const next    = () => setStep(s => Math.min(total - 1, s + 1))
  const prev    = () => setStep(s => Math.max(0, s - 1))
  const restart = () => { setStep(0); setRevealed({}); setSampleSelections({}); setKnown({}) }

  // 핵심 포인트: '— 확인:' / '(확인:' 뒤(또는 두 번째 문장)를 가렸다 공개
  function splitPoint(text) {
    let m = text.match(/^(.*?)\s*[—(]\s*확인\s*[:：]\s*(.+?)\)?$/)
    if (m && m[1].trim().length > 6) return { head: m[1].trim(), tail: m[2].trim(), label: '확인할 것' }
    m = text.match(/^(.+?[.。])\s+(.+)$/)
    if (m && m[1].length > 10 && m[2].length > 6) return { head: m[1].trim(), tail: m[2].trim(), label: '이어서' }
    return { head: text, tail: '', label: '' }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 360 }}>
      {/* 지금 학습 중인 단원 제목 (항상 표시 — 무엇을 공부하는지 명확히) */}
      {card.type !== 'intro' && (
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
          <span style={{ flexShrink: 0 }}>📖</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </p>
      )}

      {/* 진행바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${total > 1 ? (step + 1) / total * 100 : 100}%`, background: 'var(--primary)', borderRadius: 999, transition: 'width 0.25s' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{step + 1}/{total}</span>
      </div>

      <div style={{ flex: 1 }}>
        {/* ── 도입 ── */}
        {card.type === 'intro' && (
          <div style={{ padding: '4px 0 8px' }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 'clamp(15px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.4, marginBottom: 6 }}>{title}</h2>
            </div>
            {summary.courseKind && (
              <div className={`learning-course learning-course-${summary.courseKind}`}>
                <span>{{
                  'education-certification': '교육부·대한상공회의소 인증',
                  ncs: '고용노동부·한국산업인력공단 NCS',
                  recruitment: '채용필기 심화·확장',
                  interview: '고졸 공정채용 면접',
                }[summary.courseKind] || '자율학습'}</span>
                <strong>개념 이해 · 실제 형식 · 독립 연습</strong>
              </div>
            )}
            <figure className="learning-scene learning-scene-intro">
              <img src={introVisual.src} alt={introVisual.alt} />
              <figcaption>직무 상황을 먼저 보고, 개념과 실제 출제형을 연결합니다.</figcaption>
            </figure>
            {intro && (
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>📌 이 단원에서 배우는 것</p>
                <CompactText text={intro} maxItemChars={76} style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', color: 'var(--text)' }} />
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--primary)', marginTop: 14, fontWeight: 700, textAlign: 'center' }}>
              핵심 {keyPoints.length}개 · 용어 {terms.length}개 — 한 장씩 넘기며 확인해요
            </p>
          </div>
        )}

        {/* ── 핵심 포인트 (가렸다 공개) ── */}
        {card.type === 'point' && typeof card.point === 'object' && card.point ? (() => {
          const p = card.point
          const isMem = p.mode === '암기'
          return (
            <div className="card" style={{ borderLeft: `4px solid ${isMem ? '#E65100' : 'var(--primary)'}`, padding: '14px 14px 12px' }}>
              {/* 헤더: 핵심 번호 + 모드 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>핵심 {card.n}</span>
                {p.mode && (
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: isMem ? '#FFF3E0' : '#E8EAF6', color: isMem ? '#E65100' : '#3949AB' }}>
                    {isMem ? '🧠 시험 출제 암기' : '💡 개념 이해'}
                  </span>
                )}
              </div>

              {p.visual && (
                <figure className="learning-scene">
                  <img src={p.visual.src} alt={p.visual.alt} />
                  <figcaption>이 장면에서 어떤 정보와 판단이 필요할까요?</figcaption>
                </figure>
              )}

              {p.situation && (
                <div className="learning-situation">
                  <p className="learning-block-label">상황부터 이해하기</p>
                  <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
                    {readableScenario(p.situation)}
                  </p>
                </div>
              )}

              {/* 수행 목표: 지금 이것을 할 수 있어야 합니다 */}
              {p.topic && (
                <div style={{ background: isMem ? '#FFF3E0' : '#EEF2FF', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: isMem ? '#C05300' : '#4338CA', marginBottom: 3 }}>
                    이번에 익힐 판단
                  </p>
                  <p style={{ fontSize: 'clamp(13px, 3.9vw, 15px)', fontWeight: 700, lineHeight: 1.5, color: isMem ? '#7C2D12' : '#1E1B4B' }}>
                    {p.topic}
                  </p>
                </div>
              )}

              {/* 핵심 내용: 구조별 스마트 렌더링 */}
              {p.learn && (
                <div style={{ marginBottom: p.example ? 10 : 0 }}>
                  <p className="learning-block-label">개념을 이렇게 이해해요</p>
                  <LearnLines text={p.learn} />
                </div>
              )}

              {/* 외부평가 출제 예시: sampleQuestion(object/string) 또는 example(string) */}
              {p.sampleQuestion ? (
                typeof p.sampleQuestion === 'object' ? (
                  <SampleQuestionCard
                    sample={p.sampleQuestion}
                    example={p.example}
                    isOpen={isOpen}
                    selected={sampleSelections[step]}
                    onSelect={selectSample}
                    onChange={value => setSampleSelections(current => ({ ...current, [step]: value }))}
                    onOpen={open}
                  />
                ) : (
                  // 구 포맷: sampleQuestion이 string — 텍스트로 그대로 표시
                  isOpen ? (
                    <div style={{ marginTop: 10, background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 10, padding: '11px 13px' }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>📝 외부평가에서는 이렇게</p>
                    <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.sampleQuestion}</p>
                    </div>
                  ) : (
                    <button onClick={open}
                      style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                        border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309',
                        fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                      📝 시험엔 어떻게 나올까? — 탭하여 확인
                    </button>
                  )
                )
              ) : p.example ? (
                isOpen ? (
                  <div style={{ marginTop: 10, background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 10, padding: '11px 13px' }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>📝 외부평가에서는 이렇게</p>
                    <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.example}</p>
                  </div>
                ) : (
                  <button onClick={open}
                    style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                      border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309',
                      fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    📝 시험엔 어떻게 나올까? — 탭하여 확인
                  </button>
                )
              ) : null}
            </div>
          )
        })() : card.type === 'point' && (() => {
          const { head, tail, label } = splitPoint(card.text)
          return (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>✅ 핵심 {card.n}</p>
              <CompactText text={head} maxItemChars={72} style={{ fontSize: 'clamp(13.5px, 4.05vw, 16px)', fontWeight: 600 }} />
              {tail && (
                isOpen ? (
                  <div style={{ marginTop: 12, background: 'var(--primary-light)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{label}</p>
                    <CompactText text={tail} maxItemChars={72} style={{ fontSize: 'clamp(13px, 3.85vw, 15px)', color: 'var(--text)' }} />
                  </div>
                ) : (
                  <button onClick={open}
                    style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px dashed var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    👆 먼저 떠올려본 뒤, 탭하여 「{label}」 확인
                  </button>
                )
              )}
            </div>
          )
        })()}

        {/* ── 꼭 기억할 것 ── */}
        {card.type === 'recap' && (
          <div className="card" style={{ background: '#FFF8E1', border: '1px solid #F9A825' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#E65100', marginBottom: 12 }}>📌 꼭 기억할 것</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {mustRemember.map((m, i) => (
                <li key={i} style={{ fontSize: 'clamp(13px, 3.85vw, 15px)', fontWeight: 600, color: '#7a4a00', lineHeight: 1.75 }}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 용어 플래시카드 (뜻 → 용어 역방향) ──
            뜻(핵심 내용)을 항상 노출해 콘텐츠 접촉을 보장하고, 정답(용어)은 짧은 단어라
            자가 채점이 명확하다. 생성 인출로 용어 정착을 강화한다. */}
        {card.type === 'term' && (
          <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 12, textAlign: 'center' }}>🧩 설명을 읽고 용어를 떠올려보세요</p>
            {/* 뜻(프롬프트) — 항상 표시 */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <CompactText text={card.def} maxItemChars={72} style={{ fontSize: 'clamp(14px, 4vw, 16px)', color: 'var(--text)' }} />
            </div>
            {isOpen ? (
              <>
                {/* 정답 용어 공개 */}
                <div style={{ marginTop: 12, background: '#E8F5E9', borderRadius: 10, padding: '12px 14px', border: '1.5px solid var(--success)', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>✅ 정답 용어</p>
                  <p style={{ fontSize: 'clamp(18px, 5.4vw, 22px)', fontWeight: 800, lineHeight: 1.35, color: '#1b5e20' }}>{card.term}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setKnown(k => ({ ...k, [step]: 'again' })); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: known[step] === 'again' ? '#fee2e2' : 'var(--card)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    🔁 다시 볼래요
                  </button>
                  <button onClick={() => { setKnown(k => ({ ...k, [step]: 'known' })); next() }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    ✓ 맞혔어요
                  </button>
                </div>
              </>
            ) : (
              <button onClick={open}
                style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 10, border: '1.5px dashed var(--success)', background: 'transparent', color: 'var(--success)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                ✅ 정답 용어 보기
              </button>
            )}
          </div>
        )}

        {/* ── 자주 틀리는 점 ── */}
        {card.type === 'tip' && (() => {
          const mistake = card.mistake || {}
          if (!mistake.wrongChoice) return (
            <div className="card learning-mistake-card">
              <p className="learning-mistake-title">자주 틀리는 점</p>
              <CompactText className="learning-mistake-point" text={mistake.point} />
            </div>
          )
          return (
            <div className="card learning-mistake-card">
              <p className="learning-mistake-title">실제 오답으로 고쳐 보기</p>
              {mistake.stem && <p className="learning-mistake-stem">{mistake.stem}</p>}
              <div className="learning-wrong-choice">
                <span>{mistake.wrongChoice.label}</span>
                <p>{mistake.wrongChoice.text}</p>
              </div>
              <div className="learning-mistake-analysis">
                <strong>왜 틀리나</strong>
                <CompactText text={`${mistake.trap || ''}\n${mistake.whyWrong || ''}`} maxItemChars={72} />
              </div>
              {mistake.correctChoice?.length > 0 && (
                <div className="learning-correct-choice">
                  <strong>바르게 고치기</strong>
                  {mistake.correctChoice.map(choice => (
                    <p key={choice.label}><span>{choice.label}</span>{choice.text}</p>
                  ))}
                </div>
              )}
              <div className="learning-mistake-point">
                <strong>다음부터 확인할 것</strong>
                <CompactText text={mistake.point} maxItemChars={72} />
              </div>
              {mistake.checklist?.length > 0 && (
                <ol className="learning-mistake-checklist">
                  {mistake.checklist.map((item, index) => <li key={index}>{item}</li>)}
                </ol>
              )}
            </div>
          )
        })()}

        {/* ── 마무리 ── */}
        {card.type === 'end' && (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
            <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>요점 학습 완료!</p>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18, textAlign: 'left' }}>
              <CompactText text={`핵심 ${keyPoints.length}개 확인 완료\n실제 오답 ${learningMistakes.length}개 교정 완료\n다음: 도움 없이 적용`} />
            </div>
            {onStartQuiz && (
              <button className="btn btn-primary btn-full" style={{ marginBottom: 8 }} onClick={onStartQuiz}>
                🎮 도전하기 — 채점받고 XP 받기 →
              </button>
            )}
            <button className="btn btn-ghost btn-full" onClick={restart}>🔁 처음부터 다시</button>
          </div>
        )}
      </div>

      {/* ── 이전/다음 ── */}
      {card.type !== 'end' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {step > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={prev}>← 이전</button>
          )}
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={next}>
            {card.type === 'intro' ? '학습 시작 →' : '다음 →'}
          </button>
        </div>
      )}
    </div>
  )
}
