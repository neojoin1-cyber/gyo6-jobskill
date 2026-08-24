/**
 * TikiTakaEngine v3 — 기출·예상 문제로 배우는 대화형 학습 엔진
 * 티키타카 교육(문제→개념 공개) → 집중 퀴즈 → 결과
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { addXp } from '../../lib/xp.js'
import CompactText from '../../components/CompactText.jsx'

// ── 캐릭터 대사 ──────────────────────────────────────────────────────────────
const MSGS = {
  nova: {
    teachStart: n => `${n}개 핵심 문제로 개념을 익혀봐요! 🤖`,
    beforeQ:   ['이 문제 자주 나와요! 도전해봐요.', '핵심 개념 확인 문제예요!', 'AI 분석: 출제 빈도 최상! 💡', '알아두면 반드시 쓸 내용이에요!'],
    afterRight:['정확해요! 핵심 개념도 확인하세요 📊', '완벽! 개념 정리까지 해봐요 🎉', '역시! 아래 핵심 내용도 챙겨가요!'],
    afterWrong:['이 개념이 포인트예요 👇 확인해봐요!', '아쉬워요! 아래 핵심 내용을 읽어봐요 👇', 'AI가 핵심을 설명해 드릴게요 👇'],
    quizAsk:   ['이 문제가 자주 출제돼요!', '핵심 개념이에요, 집중하세요!', 'AI 분석 중요도 높음! 💡', '꼭 알아야 해요!'],
    quizRight: ['완벽해요! 📊', '정확한 분석이에요! 🎉', '역시 실력자예요!'],
    quizWrong: ['다시 분석해봐요. 힌트:', '이 개념을 확인해요:', 'AI가 힌트 드릴게요:'],
    combo:     n => `🔥 ${n}연속! 처리 효율 ${n}00%!`,
    result:    s => s >= 80 ? '완벽한 수행이에요! 🏆' : s >= 65 ? '잘했어요! 조금만 더요! 📈' : '다음엔 더 잘할 거예요! 💪',
  },
  senpai: {
    teachStart: n => `선배가 핵심 ${n}가지를 직접 가르쳐 드릴게요! 🎓`,
    beforeQ:   ['현장에서 이게 진짜 중요해요.', '이거 모르면 현장에서 혼나요 😅', '제가 신입일 때 이걸 몰라서...', '베테랑이 되려면 이건 기본!'],
    afterRight:['맞아요! 아래 내용도 현장에서 꼭 필요해요 👍', '역시! 핵심 개념도 확인하세요!', '바로 써먹을 수 있어요!'],
    afterWrong:['처음엔 헷갈려요, 핵심 개념 확인해봐요 👇', '선배가 설명해 드릴게요 👇', '이렇게 기억하면 됩니다 👇'],
    quizAsk:   ['현장에서 이게 진짜 중요해요.', '이거 모르면 현장에서 혼나요 😅', '베테랑이 되려면 이건 기본!'],
    quizRight: ['맞아요! 현장에서도 그렇게 해요! 👍', '역시! 감이 좋은데요?', '바로 써먹을 수 있어요!'],
    quizWrong: ['음... 현장 경험으론 이건데:', '선배가 알려드릴게요:', '처음엔 헷갈려요, 이렇게 기억해요:'],
    combo:     n => `🔥 ${n}연속! 현장 베테랑 느낌이에요!`,
    result:    s => s >= 80 ? '현장 투입 준비 완료예요! 🎓' : s >= 65 ? '좀 더 익히면 현장에서 쓸 수 있어요!' : '기초부터 다시 다져봐요!',
  },
  engineer: {
    teachStart: n => `${n}개 핵심 개념을 공학적으로 분석합니다. ⚙️`,
    beforeQ:   ['공정 분석 관점에서 중요합니다.', '품질 관리 핵심 요소입니다.', '시험에 자주 나오는 내용입니다.'],
    afterRight:['정확한 분석입니다! 핵심 개념도 확인하세요 ⚙️', '공정 이해도 우수! 아래도 꼼꼼히 보세요.'],
    afterWrong:['재분석이 필요합니다. 핵심 개념 확인 👇', '공학적으로 접근해봐요 👇'],
    quizAsk:   ['공정 분석 관점에서 중요합니다.', '품질 관리 핵심 요소입니다.'],
    quizRight: ['정확한 분석입니다! ⚙️', '공정 이해도 우수!', '훌륭합니다!'],
    quizWrong: ['재분석이 필요합니다. 힌트:', '공학적으로 접근해봐요:'],
    combo:     n => `⚙️ ${n}연속! 품질 분석 능력 향상 중!`,
    result:    s => s >= 80 ? '품질 관리사 수준이에요! ⚙️' : s >= 65 ? '분석 능력이 향상되고 있어요!' : '체계적으로 다시 접근해봐요.',
  },
  master: {
    teachStart: n => `달인이 핵심 ${n}가지를 직접 전수하겠소! 🏆`,
    beforeQ:   ['이것을 모르면 달인이 될 수 없소!', '달인의 시험이오.', '핵심 중의 핵심!', '이것이 품질의 정수라오.'],
    afterRight:['그래! 이게 달인의 경지야! 아래도 보게 🏆', '완벽해! 핵심 개념도 챙기게!'],
    afterWrong:['허허, 아직 멀었구나. 핵심 개념 확인해봐 👇', '달인이 가르쳐 드리마 👇'],
    quizAsk:   ['이것을 모르면 달인이 될 수 없소!', '달인의 시험이오.', '핵심 중의 핵심!'],
    quizRight: ['그래! 이게 달인의 경지야! 🏆', '완벽해! 역시 내 제자!', '달인의 길을 걷고 있어!'],
    quizWrong: ['허허, 아직 멀었구나. 힌트 드리지:', '달인이 가르쳐 드리마:'],
    combo:     n => `🏆 ${n}연속! 달인의 기운이 느껴져!`,
    result:    s => s >= 80 ? '달인의 경지에 올랐구나! 🏆' : s >= 65 ? '수련이 결실을 맺고 있어!' : '더 단련이 필요하다!',
  },
}

function pickMsg(arr) { return arr[Math.floor(Math.random() * arr.length)] }

const ANIM_CSS = `
@keyframes tiki-shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 60%{transform:translateX(7px)} }
@keyframes tiki-bounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-10px)} }
@keyframes tiki-pop    { 0%{transform:scale(0.7);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes tiki-slide  { 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes tiki-slideUp{ 0%{transform:translateY(24px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes tiki-glow   { 0%,100%{box-shadow:0 0 0 0 rgba(79,70,229,0)} 50%{box-shadow:0 0 0 12px rgba(79,70,229,0.18)} }
@keyframes tiki-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes tiki-fadein { 0%{opacity:0} 100%{opacity:1} }
`

// ── 캐릭터 스테이지 ──────────────────────────────────────────────────────────
function CharStage({ char, speech, anim, sub }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${char.color}14 0%, transparent 100%)`,
      padding: '10px 14px 10px',
      borderBottom: `1px solid ${char.color}20`,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: `${char.color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        animation: anim === 'bounce' ? 'tiki-bounce 0.5s ease'
                 : anim === 'shake'  ? 'tiki-shake 0.4s ease'
                 : anim === 'float'  ? 'tiki-float 2.5s ease infinite' : 'none',
        border: `2px solid ${char.color}30`,
        boxShadow: `0 3px 10px ${char.color}25`,
      }}>
        {char.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: char.color, marginBottom: 2 }}>{char.name}</p>
        <div style={{
          background: 'var(--card)', borderRadius: '4px 12px 12px 12px',
          padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          border: `1px solid ${char.color}18`, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: -6, top: 8, width: 0, height: 0,
            borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
            borderRight: `6px solid var(--card)`,
          }} />
          <p style={{ fontSize: 13, lineHeight: 1.5, animation: 'tiki-slide 0.25s ease', color: 'var(--text)' }}>
            {speech}
          </p>
          {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ── 선택지 버튼 (공통) ───────────────────────────────────────────────────────
function ChoiceBtn({ c, i, selected, answer, char, onSelect, disabled }) {
  const isThis  = selected === c.value
  const isRight = c.value === answer
  const isAnswered = selected !== null
  let bg = 'var(--card)', border = '1px solid var(--border)', color = 'var(--text)'
  let numBg = `${char.color}18`, numColor = char.color
  if (isAnswered) {
    if (isRight)     { bg='#D1FAE5'; border='2px solid #10B981'; color='#065F46'; numBg='#10B981'; numColor='#fff' }
    else if (isThis) { bg='#FEE2E2'; border='2px solid #EF4444'; color='#991B1B'; numBg='#EF4444'; numColor='#fff' }
    else             { bg='var(--bg)'; color='var(--text-muted)' }
  } else if (isThis) {
    bg=`${char.color}10`; border=`2px solid ${char.color}`; color=char.color; numBg=char.color; numColor='#fff'
  }
  return (
    <button onClick={() => onSelect(c.value)} disabled={disabled || isAnswered}
      style={{
        width:'100%', textAlign:'left', padding:'11px 13px',
        borderRadius:11, border, background:bg, color,
        cursor: (disabled||isAnswered) ? 'default' : 'pointer',
        fontSize:13, lineHeight:1.5,
        display:'flex', alignItems:'center', gap:9,
        transition:'all 0.18s',
        animation: isAnswered&&isThis&&!isRight ? 'tiki-shake 0.4s ease' : 'none',
      }}>
      <span style={{
        width:23, height:23, borderRadius:6, flexShrink:0,
        background:numBg, color:numColor,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: 12, fontWeight:700, transition:'all 0.18s',
      }}>
        {isAnswered&&isRight ? '✓' : isAnswered&&isThis ? '✗' : ['①','②','③','④','⑤'][i]}
      </span>
      {c.text}
    </button>
  )
}

// ── 개념 공개 패널 ───────────────────────────────────────────────────────────
function ConceptRevealPanel({ card, quizExplanation, char, isCorrect }) {
  return (
    <div style={{ animation: 'tiki-slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', marginTop: 12 }}>
      {/* 정답/오답 배지 */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginBottom:10,
        padding:'9px 12px', borderRadius:10,
        background: isCorrect ? '#D1FAE5' : '#FEE2E2',
        border: `1px solid ${isCorrect ? '#10B981' : '#EF4444'}`,
      }}>
        <span style={{ fontSize:18 }}>{isCorrect ? '✅' : '❌'}</span>
        <p style={{ fontSize:13, fontWeight:700, color: isCorrect ? '#065F46' : '#991B1B' }}>
          {isCorrect ? '정답 · 핵심 개념 확인' : '오답 · 핵심 개념 재확인'}
        </p>
      </div>

      {/* 개념 카드 */}
      <div style={{
        background:'var(--card)', borderRadius:14,
        border:`2px solid ${char.color}35`,
        overflow:'hidden',
      }}>
        {/* 개념 제목 바 */}
        <div style={{
          background:`linear-gradient(90deg, ${char.color}22, ${char.color}08)`,
          padding:'10px 14px', borderBottom:`1px solid ${char.color}18`,
          display:'flex', alignItems:'center', gap:8,
        }}>
          <div style={{
            width:28, height:28, borderRadius:8, flexShrink:0,
            background:`linear-gradient(135deg, ${char.color}, ${char.color}BB)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, color:'#fff',
          }}>
            {card.isInterview ? '📌' : '💡'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize: 12, fontWeight:700, color:char.color, textTransform:'uppercase', letterSpacing:0.5 }}>
              {card.isInterview ? '수행 기준' : '핵심 용어'}
            </p>
            <p style={{ fontSize:13, fontWeight:800, color:'var(--text)', lineHeight:1.35 }}>
              {card.term}
            </p>
          </div>
        </div>

        {/* 본문 내용 */}
        <div style={{ padding:'10px 14px' }}>
          {card.sections?.length >= 2 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {card.sections.map((sec, i) => {
                const cfg = {
                  check:  { bg:'#EFF6FF', border:'#3B82F6', label:'✅ 확인할 것', color:'#1D4ED8' },
                  action: { bg:'#F0FDF4', border:'#10B981', label:'🔧 현장 조치', color:'#065F46' },
                  record: { bg:'#FFFBEB', border:'#F59E0B', label:'📋 기록·보고', color:'#92400E' },
                }[sec.type] ?? { bg:'#F9FAFB', border:'#6B7280', label:'📄', color:'#374151' }
                return (
                  <div key={i} style={{ background:cfg.bg, borderRadius:8, padding:'8px 10px', borderLeft:`3px solid ${cfg.border}` }}>
                    <p style={{ fontSize: 12, fontWeight:700, color:cfg.color, marginBottom:3 }}>{cfg.label}</p>
                    <CompactText text={sec.text} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text)' }} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background:`${char.color}08`, borderRadius:8, padding:'10px 12px', borderLeft:`3px solid ${char.color}` }}>
              <CompactText text={card.definition} maxItemChars={70} style={{ fontSize: 13, color: 'var(--text)' }} />
            </div>
          )}
        </div>

        {/* 문제 해설 */}
        {quizExplanation && (
          <div style={{ background:'#FFFBEB', padding:'9px 14px', borderTop:'1px solid #FDE68A' }}>
            <p style={{ fontSize: 12, fontWeight:700, color:'#92400E', marginBottom:3 }}>💡 문제 해설</p>
            <CompactText text={quizExplanation} maxItemChars={68} style={{ fontSize: 12, color: '#78350F' }} />
          </div>
        )}

        {/* 핵심 포인트 */}
        {card.keyPoint && (
          <div style={{ background:`${char.color}06`, padding:'9px 14px', borderTop:`1px solid ${char.color}15` }}>
            <p style={{ fontSize: 12, fontWeight:700, color:char.color, marginBottom:3 }}>🔑 {card.label0 || '핵심 포인트'}</p>
            <CompactText text={card.keyPoint} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text)' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── 티키타카 교육 뷰 (핵심: 문제 → 답 → 개념 공개) ─────────────────────────
function TeachView({ cards, quizItems, char, onDone }) {
  const [idx,        setIdx]        = useState(0)
  const [selected,   setSelected]   = useState(null)
  const [showReveal, setShowReveal] = useState(false)
  const [charAnim,   setCharAnim]   = useState('float')
  const [speech,     setSpeech]     = useState(null)
  const scrollRef = useRef(null)
  const msgs      = MSGS[char.id] ?? MSGS.nova
  const initSpeech = useRef(msgs.teachStart(cards.length))

  useEffect(() => {
    setSelected(null)
    setShowReveal(false)
    setCharAnim('float')
    setSpeech(idx === 0 ? initSpeech.current : pickMsg(msgs.beforeQ))
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [idx])

  const card = cards[idx]
  const q    = idx < quizItems.length ? quizItems[idx] : null
  if (!card) { onDone(Math.min(cards.length, quizItems.length)); return null }

  const isAnswered = selected !== null
  const isCorrect  = selected === q?.answer
  const isLast     = idx === cards.length - 1

  function handleSelect(val) {
    if (isAnswered || !q) return
    setSelected(val)
    const ok = val === q.answer
    setCharAnim(ok ? 'bounce' : 'shake')
    setSpeech(pickMsg(ok ? msgs.afterRight : msgs.afterWrong))
    setTimeout(() => {
      setShowReveal(true)
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 60)
    }, 350)
  }

  function handleNext() {
    if (!isLast) setIdx(i => i + 1)
    else onDone(Math.min(cards.length, quizItems.length))
  }

  // 짝 지을 문제가 없는 개념 → 바로 개념 공개 (fallback)
  if (!q) {
    return (
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
        <CharStage char={char} speech={speech ?? initSpeech.current} anim={charAnim} />
        <div ref={scrollRef} style={{ flex:1, minHeight:0, overflowY:'auto', padding:'12px 14px 16px' }}>
          <ProgressDots total={cards.length} current={idx} color={char.color} />
          <ConceptRevealPanel card={card} quizExplanation={null} char={char} isCorrect />
        </div>
        <NextBtn isLast={isLast} char={char} onClick={handleNext} show />
      </div>
    )
  }

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'var(--bg)' }}>
      <CharStage char={char} speech={speech ?? initSpeech.current} anim={charAnim} />

      {/* 진행 헤더 */}
      <div style={{
        padding:'6px 14px', background:'var(--card)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10,
      }}>
        <ProgressDots total={cards.length} current={idx} color={char.color} inline />
        <span style={{ fontSize: 12, color:'var(--text-muted)', marginLeft:'auto' }}>
          {isAnswered
            ? (isCorrect ? '✅ 정답!' : '❌ 오답')
            : `개념 ${idx + 1}/${cards.length}`}
        </span>
      </div>

      <div ref={scrollRef} style={{ flex:1, minHeight:0, overflowY:'auto', padding:'12px 14px 16px' }}>
        {/* 문제 카드 */}
        <div style={{
          background:'var(--card)', borderRadius:16,
          border: isAnswered
            ? `2px solid ${isCorrect ? '#10B981' : '#EF4444'}`
            : `2px solid ${char.color}25`,
          padding:'14px 16px', marginBottom:10,
          boxShadow:'0 2px 14px rgba(0,0,0,0.06)',
          animation:'tiki-slide 0.3s ease',
          transition:'border 0.25s',
        }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:5,
            background:`${char.color}15`, borderRadius:20,
            padding:'3px 10px', marginBottom:10,
          }}>
            <span style={{ fontSize: 12, fontWeight:700, color:char.color }}>📝 확인 문제</span>
          </div>
          {q.context && (
            <div style={{
              background:'#F8FAFC', borderRadius:8, padding:'8px 10px',
              marginBottom:8, border:'1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, fontWeight:700, color:'var(--text-muted)', marginBottom:3 }}>[보기]</p>
              {q.context.split('\n').map((line, i) => (
                <p key={i} style={{ fontSize:12, lineHeight:1.6, color:'var(--text)' }}>{line}</p>
              ))}
            </div>
          )}
          {q.stem.split('\n').map((line, i) => (
            <p key={i} style={{ fontSize:14, lineHeight:1.8, fontWeight:500, color:'var(--text)', marginBottom:2 }}>
              {line}
            </p>
          ))}
        </div>

        {/* 선택지 */}
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:2 }}>
          {q.choices.map((c, i) => (
            <ChoiceBtn key={c.value} c={c} i={i} selected={selected} answer={q.answer} char={char} onSelect={handleSelect} />
          ))}
        </div>

        {/* 개념 공개 패널 */}
        {showReveal && (
          <ConceptRevealPanel
            card={card}
            quizExplanation={q.explanation}
            char={char}
            isCorrect={isCorrect}
          />
        )}
      </div>

      {/* 답한 뒤에만 다음 버튼 */}
      {isAnswered && <NextBtn isLast={isLast} char={char} onClick={handleNext} show />}
    </div>
  )
}

// ── 헬퍼: 진행 도트 ─────────────────────────────────────────────────────────
function ProgressDots({ total, current, color, inline }) {
  return (
    <div style={{ display:'flex', gap:5, ...(inline ? {} : { justifyContent:'center', marginBottom:12 }) }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? (inline ? 18 : 22) : (inline ? 6 : 8),
          height: inline ? 6 : 8, borderRadius:4,
          background: i < current ? '#10B981' : i === current ? color : 'var(--border)',
          transition:'all 0.3s',
        }} />
      ))}
    </div>
  )
}

// ── 헬퍼: 하단 다음 버튼 ────────────────────────────────────────────────────
function NextBtn({ isLast, char, onClick, show }) {
  if (!show) return null
  return (
    <div style={{
      padding:'12px 14px', borderTop:'1px solid var(--border)',
      background:'var(--card)', animation:'tiki-slide 0.25s ease',
    }}>
      <button onClick={onClick} style={{
        width:'100%', padding:'14px', borderRadius:14, border:'none',
        background: isLast ? `linear-gradient(90deg, ${char.color}, #059669)` : char.color,
        color:'#fff', cursor:'pointer', fontWeight:700, fontSize:15,
        animation: isLast ? 'tiki-glow 1.5s ease infinite' : 'none',
      }}>
        {isLast ? '퀴즈 시작! 🎯' : '이해했어요! 다음 →'}
      </button>
    </div>
  )
}

// ── 퀴즈 뷰 ─────────────────────────────────────────────────────────────────
function QuizView({ items, char, isRetry, onComplete }) {
  const [qIdx,         setQIdx]         = useState(0)
  const [selected,     setSelected]     = useState(null)
  const [combo,        setCombo]        = useState(0)
  const [xpPop,        setXpPop]        = useState(null)
  const [charAnim,     setCharAnim]     = useState('none')
  const [speech,       setSpeech]       = useState(() => pickMsg((MSGS[char.id]??MSGS.nova).quizAsk))
  const [wrongIds,     setWrongIds]     = useState([])
  const [correctCount, setCorrectCount] = useState(0)
  const [canNext,      setCanNext]      = useState(false)
  const scrollRef = useRef(null)
  const msgs = MSGS[char.id] ?? MSGS.nova

  const q          = items[qIdx]
  const isAnswered = selected !== null
  const isCorrect  = selected === q?.answer

  useEffect(() => {
    setSelected(null)
    setCanNext(false)
    setSpeech(pickMsg(msgs.quizAsk))
    setCharAnim('none')
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [qIdx])

  function handleSelect(val) {
    if (isAnswered) return
    setSelected(val)
    const ok = val === q.answer
    if (ok) {
      const newCombo = combo + 1
      setCombo(newCombo)
      setCorrectCount(c => c + 1)
      setCharAnim('bounce')
      const xp = 10 + (newCombo >= 3 ? 5 : 0)
      setSpeech(newCombo >= 3 ? msgs.combo(newCombo) : pickMsg(msgs.quizRight))
      addXp(xp)
      setXpPop({ xp, key: Date.now() })
      // 정답: 해설 있으면 2.5s, 없으면 1.4s 후 자동 다음
      setTimeout(() => advance(false), q.explanation ? 2500 : 1400)
    } else {
      setCombo(0)
      setCharAnim('shake')
      setSpeech(q.hint ? `${pickMsg(msgs.quizWrong)} ${q.hint}` : pickMsg(msgs.quizWrong))
      setWrongIds(prev => prev.includes(q.id) ? prev : [...prev, q.id])
      // 오답: 2초 후 수동 다음 버튼 활성화
      setTimeout(() => setCanNext(true), 2000)
    }
  }

  function advance(wasWrong) {
    if (qIdx < items.length - 1) setQIdx(i => i + 1)
    else onComplete({ correctCount: correctCount + (wasWrong ? 0 : 1), total: items.length, wrongIds })
  }

  if (!q) return null

  const pct = Math.round((qIdx / items.length) * 100)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
      <CharStage char={char} speech={speech} anim={charAnim}
        sub={isRetry ? '💪 틀린 문제 재도전!' : undefined} />

      {/* 진행 바 */}
      <div style={{
        padding:'6px 14px', background:'var(--card)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10,
      }}>
        <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', background:char.color, width:`${pct}%`, borderRadius:3, transition:'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{qIdx+1}/{items.length}</span>
        {combo >= 3 && (
          <div style={{
            background:'#FEF3C7', borderRadius:20, padding:'2px 8px',
            display:'flex', alignItems:'center', gap:3, animation:'tiki-pop 0.3s ease',
          }}>
            <span style={{ fontSize:12 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight:700, color:'#92400E' }}>{combo}연속</span>
          </div>
        )}
      </div>

      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'12px 14px 8px' }}>
        {/* 문제 카드 */}
        <div style={{
          background:'var(--card)', borderRadius:14,
          border: isAnswered
            ? `2px solid ${isCorrect ? '#10B981' : '#EF4444'}`
            : '1px solid var(--border)',
          padding:'14px 16px', marginBottom:10,
          boxShadow:'var(--shadow)', animation:'tiki-slide 0.25s ease',
          transition:'border 0.2s',
        }}>
          {q.context && (
            <div style={{
              background:'#F8FAFC', borderRadius:8, padding:'8px 10px',
              marginBottom:10, border:'1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>[보기]</p>
              {q.context.split('\n').map((line, i) => (
                <p key={i} style={{ fontSize:13, lineHeight:1.6, color:'var(--text)' }}>{line}</p>
              ))}
            </div>
          )}
          {q.stem.split('\n').map((line, i) => (
            <p key={i} style={{ fontSize:14, lineHeight:1.8, fontWeight:500, color:'var(--text)', marginBottom:2 }}>
              {line}
            </p>
          ))}
        </div>

        {/* 선택지 */}
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:10 }}>
          {q.choices.map((c, i) => (
            <ChoiceBtn key={c.value} c={c} i={i} selected={selected} answer={q.answer} char={char} onSelect={handleSelect} />
          ))}
        </div>

        {/* 해설 — 정답 시에도 explanation 있으면 표시, 오답 시 항상 표시 */}
        {isAnswered && (q.explanation || q.hint) && (
          <div style={{
            background: isCorrect ? `${char.color}08` : '#FFFBEB',
            borderRadius:10, padding:'10px 13px',
            border: isCorrect ? `1px solid ${char.color}25` : '1px solid #FDE68A',
            animation:'tiki-slideUp 0.3s ease',
          }}>
            <p style={{ fontSize: 12, fontWeight:700, color: isCorrect ? char.color : '#92400E', marginBottom:3 }}>
              {isCorrect ? '💡 학습 포인트' : '💡 해설'}
            </p>
            <CompactText text={q.explanation || q.hint} maxItemChars={70}
              style={{ fontSize: 13, color: isCorrect ? 'var(--text)' : '#78350F' }} />
          </div>
        )}

        {/* 오답 수동 다음 버튼 */}
        {isAnswered && !isCorrect && canNext && (
          <div style={{ marginTop:10, animation:'tiki-slide 0.2s ease' }}>
            <button onClick={() => advance(true)} style={{
              width:'100%', padding:'14px', borderRadius:14, border:'none',
              background:char.color, color:'#fff', cursor:'pointer', fontWeight:700, fontSize:15,
            }}>
              다음 문제 →
            </button>
          </div>
        )}
      </div>

      {xpPop && (
        <div key={xpPop.key} style={{
          position:'fixed', bottom:100, right:20, zIndex:500,
          background:'#FEF3C7', borderRadius:20, padding:'6px 14px',
          fontSize:14, fontWeight:800, color:'#92400E',
          boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
          animation:'tiki-pop 0.3s ease', pointerEvents:'none',
        }}>
          +{xpPop.xp} XP ✨
        </div>
      )}
    </div>
  )
}

// ── 결과 화면 ─────────────────────────────────────────────────────────────────
function ResultView({ score, correct, total, wrongCount, stars, char, onRetry, onNext, onMap }) {
  const msgs = MSGS[char.id] ?? MSGS.nova
  const circumference = 2 * Math.PI * 44
  const dashOffset    = circumference * (1 - score / 100)
  const scoreColor    = score >= 80 ? '#059669' : score >= 65 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
      <CharStage char={char} speech={msgs.result(score)} anim={score >= 50 ? 'bounce' : 'none'} />
      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px 80px' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ position:'relative', width:120, height:120, margin:'0 auto 12px' }}>
            <svg width="120" height="120" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="44" fill="none" stroke="var(--border)" strokeWidth="10" />
              <circle cx="60" cy="60" r="44" fill="none"
                stroke={scoreColor} strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <p style={{ fontSize:30, fontWeight:800, lineHeight:1, color:scoreColor }}>{score}</p>
              <p style={{ fontSize: 12, color:'var(--text-muted)' }}>점</p>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:8 }}>
            {[1,2,3].map(s => (
              <span key={s} style={{
                fontSize:28, opacity:s<=stars?1:0.2,
                animation: s<=stars ? `tiki-pop ${0.2*s+0.3}s ease` : 'none',
                filter: s<=stars ? 'drop-shadow(0 0 4px #FCD34D)' : 'none',
              }}>⭐</span>
            ))}
          </div>
          <p style={{ fontSize:14, color:'var(--text-muted)' }}>
            {correct}/{total}문항 정답 · {wrongCount}개 오답
          </p>
        </div>
        <div style={{
          background: score>=80?'#D1FAE5':score>=65?'#FEF3C7':'#FEE2E2',
          borderRadius:14, padding:'16px',
          border:`2px solid ${score>=80?'#059669':score>=65?'#F59E0B':'#EF4444'}`,
          marginBottom:20, textAlign:'center',
        }}>
          <p style={{ fontSize:22, marginBottom:6 }}>{score>=80?'🏆':score>=65?'📈':'📚'}</p>
          <p style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>
            {score>=80?'클리어!':score>=65?'아쉬워요, 조금만 더!':'다시 도전해봐요!'}
          </p>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>
            {score>=80?'다음 단원이 열렸어요!':score>=65?'한번 더 하면 별 3개 가능해요!':'오답을 복습하고 다시 도전해봐요.'}
          </p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {score >= 50 ? (
            <button onClick={onNext} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none',
              background: score>=80 ? '#059669' : char.color,
              color:'#fff', cursor:'pointer', fontWeight:700, fontSize:15,
            }}>
              {score>=80?'🏅 다음 단원 도전! →':'🔄 다시 도전하기'}
            </button>
          ) : (
            <button onClick={onRetry} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none',
              background:char.color, color:'#fff', cursor:'pointer', fontWeight:700, fontSize:15,
            }}>
              📚 처음부터 다시 배우기
            </button>
          )}
          <button onClick={onMap} style={{
            width:'100%', padding:'13px', borderRadius:12,
            border:'1px solid var(--border)', background:'var(--card)',
            color:'var(--text)', cursor:'pointer', fontWeight:600, fontSize:14,
          }}>
            지도로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 엔진 ────────────────────────────────────────────────────────────────
export default function TikiTakaEngine({ unit, char, onComplete, onBack }) {
  const [phase,         setPhase]         = useState(unit.conceptCards?.length > 0 ? 'teach' : 'quiz')
  const [result,        setResult]        = useState(null)
  const [teachUsedCount,setTeachUsedCount] = useState(0)
  const msgs = MSGS[char.id] ?? MSGS.nova

  // 셔플된 전체 퀴즈 아이템 (한 번만 계산)
  const allQuizItems = useMemo(() => {
    const arr = [...unit.quizItems]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, Math.min(15, arr.length))
  }, [unit])

  const conceptCount = unit.conceptCards?.length ?? 0
  // TeachView에 넘길 문제 (앞에서 conceptCount개)
  const teachItems   = allQuizItems.slice(0, conceptCount)

  function handleTeachDone(usedCount) {
    setTeachUsedCount(usedCount)
    const remaining = allQuizItems.slice(usedCount)
    if (remaining.length > 0) {
      setPhase('quiz')
    } else {
      const r = { correct: 0, total: 0, wrongIds: [], score: 100, stars: 3 }
      setResult(r); setPhase('result'); onComplete(r)
    }
  }

  function handleQuizComplete({ correctCount, total, wrongIds }) {
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
    const stars = score >= 80 ? 3 : score >= 65 ? 2 : score >= 50 ? 1 : 0
    const r = { correct: correctCount, total, wrongIds, score, stars }
    setResult(r); setPhase('result'); onComplete(r)
  }

  return (
    <>
      <style>{ANIM_CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        {/* 앱바 */}
        <div className="appbar" style={{ background: char.color }}>
          <button className="appbar-back" onClick={onBack} style={{ color:'#fff', opacity:0.85 }}>←</button>
          <span className="appbar-title" style={{ color:'#fff', fontSize:14 }}>{unit.title}</span>
          <span style={{ fontSize: 12, color:'rgba(255,255,255,0.75)' }}>
            {phase==='teach'?'개념 학습':phase==='quiz'?'퀴즈':phase==='retry'?'오답 재도전':'결과'}
          </span>
        </div>

        {phase === 'teach' && conceptCount > 0 && (
          <TeachView
            cards={unit.conceptCards}
            quizItems={teachItems}
            char={char}
            onDone={handleTeachDone}
          />
        )}

        {phase === 'quiz' && (
          <QuizView
            items={allQuizItems.slice(teachUsedCount)}
            char={char}
            isRetry={false}
            onComplete={handleQuizComplete}
          />
        )}

        {phase === 'retry' && result?.wrongIds?.length > 0 && (
          <QuizView
            items={unit.quizItems.filter(q => result.wrongIds.includes(q.id))}
            char={char}
            isRetry={true}
            onComplete={({ correctCount, total }) => {
              const newScore = Math.round(((result.correct + correctCount) / (result.total + total)) * 100)
              const stars = newScore>=80?3:newScore>=65?2:newScore>=50?1:0
              const r = { ...result, score: newScore, stars }
              setResult(r); setPhase('result'); onComplete(r)
            }}
          />
        )}

        {phase === 'result' && result && (
          <ResultView
            score={result.score} correct={result.correct}
            total={result.total} wrongCount={result.wrongIds?.length ?? 0}
            stars={result.stars} char={char}
            onRetry={() => setPhase('teach')}
            onNext={() => {
              if (result.score >= 50 && result.wrongIds?.length > 0) setPhase('retry')
              else onBack()
            }}
            onMap={onBack}
          />
        )}
      </div>
    </>
  )
}
