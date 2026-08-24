import { useState, useEffect } from 'react'
import { fetchOpenWrongAnswers, reviewWrongAnswer } from '../../lib/wrongAnswers.js'
import { findQuestion, priorityWeight } from '../../lib/questionIndex.js'
import { getDueItems, recordReview } from '../../lib/srs.js'
import { learningModeOf } from '../../lib/learningMode.js'
import { addXp } from '../../lib/xp.js'

// 두 가지 복습이 있다. 고르는 기준도, 끝나는 조건도 다르다.
//
//   오답(wrong)  자주 틀리고 자주 나오는 것부터. 3연속 정답이면 정복.
//   간격반복(srs) 잊을 때가 된 것부터. 풀고 나면 다음 복습일이 미뤄진다.
//
// 화면은 같아도 되지만 문구까지 같으면 학생은 왜 이걸 또 푸는지 모른다.
const SOURCES = {
  wrong: {
    title: '🎯 우선 복습', icon: '🎯',
    headline: '중요한 오답부터 다시!',
    empty: '복습할 오답이 없어요!',
    emptyHint: '문제를 풀다 틀리면 여기 모여요. 자주 틀리고 자주 나오는 것부터 다시 풀 수 있어요.',
    backLabel: '오답노트로',
  },
  srs: {
    title: '🔁 오늘의 복습', icon: '🔁',
    headline: '잊을 때가 된 문항이에요',
    empty: '오늘 복습할 문항이 없어요!',
    emptyHint: '문제를 풀면 잊어버릴 때쯤 다시 물어봐요. 오늘은 쉬어도 좋아요.',
    backLabel: '홈으로',
  },
}

/**
 * 우선 복습 큐 — 오답을 (자주 틀림 빈도 × 빈출도)로 정렬해 중요한 것부터 재풀이.
 * 정답 3연속이면 서버가 자동 '정복(resolved)' 처리 → 큐에서 사라짐.
 * props: onBack, onDone?()
 */
export default function PriorityReviewScreen({ onBack, onDone, source = 'wrong' }) {
  const spec = SOURCES[source] ?? SOURCES.wrong
  const [queue, setQueue] = useState(null)   // 랭킹된 [{q, wrong_count, score}]
  const [i, setI]         = useState(0)
  const [pick, setPick]   = useState(null)
  const [mastered, setMastered] = useState(0) // 이번 세션 정복 수
  const [correctN, setCorrectN] = useState(0)
  const [phase, setPhase] = useState('load')  // load | drill | done

  useEffect(() => {
    let alive = true
    const usable = q => q && q.choices?.length >= 2 && /^[A-E]$/.test(q.answer || '')

    const build = source === 'srs'
      ? getDueItems(20).then(rows => rows
          .map(r => ({ q: findQuestion(r.itemId), subject: r.subject, unitId: r.unitId }))
          .filter(x => usable(x.q)))
      : fetchOpenWrongAnswers().then(rows => rows
          .map(r => ({ q: findQuestion(r.question_id), wrong_count: r.wrong_count || 1,
            streak: r.review_streak || 0 }))
          .filter(x => usable(x.q))
          .map(x => ({ ...x, score: x.wrong_count * priorityWeight(x.q.examPriority) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20))

    build.then(items => {
      if (!alive) return
      setQueue(items)
      setPhase(items.length ? 'intro' : 'empty')
    })
    return () => { alive = false }
  }, [source])

  const cur = queue?.[i]

  function choose(idx) {
    if (pick !== null) return
    const correctIdx = cur.q.answer.charCodeAt(0) - 65
    const ok = idx === correctIdx
    setPick(idx)
    if (ok) { setCorrectN(n => n + 1); addXp(4, 'priority_review') }

    if (source === 'srs') {
      // 결과를 스케줄에 반영해야 다음 복습일이 미뤄진다. 기록하지 않으면
      // 풀어도 계속 '오늘 복습할 문항'에 남아 학생이 같은 것을 무한히 만난다.
      recordReview({ subject: cur.subject, unitId: cur.unitId, itemId: cur.q.id,
        demand: learningModeOf(cur.q).id }, ok ? 4 : 1)
      return
    }
    reviewWrongAnswer(cur.q.id, ok).then(status => {
      if (ok && status === 'resolved') setMastered(m => m + 1)
    })
  }

  function next() {
    setPick(null)
    if (i + 1 < queue.length) setI(i + 1)
    else { onDone?.(); setPhase('done') }
  }

  if (phase === 'load') return <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>

  if (phase === 'empty') return (
    <Wrap title={spec.title} onBack={onBack}>
      <div style={card}><p style={{ fontSize: 40, textAlign: 'center' }}>🎉</p>
        <p style={{ textAlign: 'center', fontWeight: 700, marginTop: 6 }}>{spec.empty}</p>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{spec.emptyHint}</p>
        <button onClick={onBack} style={primaryBtn}>돌아가기</button>
      </div>
    </Wrap>
  )

  if (phase === 'intro') return (
    <Wrap title={spec.title} onBack={onBack}>
      <div style={card}>
        <p style={{ fontSize: 40, textAlign: 'center' }}>{spec.icon}</p>
        <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginTop: 4 }}>{spec.headline}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 10, textAlign: 'center' }}>
          {source === 'srs' ? (
            <>
              전에 풀어 본 문항 가운데 <b>잊어버릴 때가 된 {queue.length}문항</b>이에요.<br />
              지금 다시 맞히면 다음에는 <b>더 나중에</b> 물어볼게요.
            </>
          ) : (
            <>
              <b>자주 틀린 문제 × 시험에 자주 나오는 문제</b> 순으로 {queue.length}문항을 골랐어요.<br />
              같은 문제를 <b>3번 연속 맞히면</b> 정복! 오답노트에서 사라져요.
            </>
          )}
        </p>
        <button onClick={() => setPhase('drill')} style={primaryBtn}>복습 시작 ({queue.length}문항)</button>
      </div>
    </Wrap>
  )

  if (phase === 'done') return (
    <Wrap title={spec.title} onBack={onBack}>
      <div style={{ ...card, textAlign: 'center' }}>
        <p style={{ fontSize: 40 }}>✅</p>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>복습 완료!</h2>
        <p style={{ fontSize: 15, marginTop: 8 }}>{correctN} / {queue.length} 정답</p>
        {mastered > 0 && <p style={{ fontSize: 14, color: '#059669', fontWeight: 700, marginTop: 6 }}>🏆 {mastered}문항 정복 (오답노트에서 제거)</p>}
        <button onClick={onBack} style={primaryBtn}>{spec.backLabel}</button>
      </div>
    </Wrap>
  )

  // drill
  const correctIdx = cur.q.answer.charCodeAt(0) - 65
  const answered = pick !== null
  const correct = pick === correctIdx
  return (
    <Wrap title={`${spec.title} ${i + 1}/${queue.length}`} onBack={onBack}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {source === 'wrong' ? (
            <>
              <span style={badge}>🔁 {cur.wrong_count}번 틀림</span>
              <span style={{ ...badge, background: '#EDE9FE', color: '#6D28D9' }}>정복까지 {Math.max(0, 3 - cur.streak)}연속</span>
            </>
          ) : (
            <span style={{ ...badge, background: '#EDE9FE', color: '#6D28D9' }}>🔁 잊을 때가 됐어요</span>
          )}
          {cur.q.examPriority === 'high' && <span style={{ ...badge, background: '#FEE2E2', color: '#B91C1C' }}>🔥 빈출</span>}
        </div>
        {cur.q.context && <div style={ctxBox}>{cur.q.context}</div>}
        <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>{cur.q.stem}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {cur.q.choices.map((c, idx) => {
            let st = { ...choiceBtn }
            if (answered) {
              if (idx === correctIdx) st = { ...st, border: '2px solid #10B981', background: '#ECFDF5' }
              else if (idx === pick) st = { ...st, border: '2px solid #EF4444', background: '#FEF2F2' }
              else st = { ...st, opacity: 0.6 }
            }
            return (
              <button key={idx} onClick={() => choose(idx)} disabled={answered} style={st}>
                <span style={letter}>{idx + 1}</span><span style={{ flex: 1 }}>{c}</span>
                {answered && idx === correctIdx && <span>✓</span>}
                {answered && idx === pick && idx !== correctIdx && <span>✗</span>}
              </button>
            )
          })}
        </div>
        {answered && (
          <div style={{ marginTop: 14, borderRadius: 12, padding: '12px 14px', border: '1px solid', borderColor: correct ? '#10B981' : '#EF4444', background: correct ? '#ECFDF5' : '#FEF2F2' }}>
            <p style={{ fontWeight: 800, color: correct ? '#047857' : '#B91C1C', marginBottom: 6 }}>
              {correct ? '정답! 잘했어요' : `정답은 ${correctIdx + 1}번`}
            </p>
            {cur.q.explanation && <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cur.q.explanation}</p>}
          </div>
        )}
        {answered && <button onClick={next} style={{ ...primaryBtn, marginTop: 16 }}>{i + 1 < queue.length ? '다음 →' : '복습 완료'}</button>}
      </div>
    </Wrap>
  )
}

function Wrap({ title, onBack, children }) {
  return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={onBack}>←</button><span className="appbar-title">{title}</span></div>
      <div className="screen-body">{children}</div>
    </div>
  )
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 16px', marginBottom: 14 }
const primaryBtn = { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 14 }
const badge = { fontSize: 12.5, fontWeight: 800, padding: '4px 9px', borderRadius: 12, background: '#FEF3C7', color: '#92400E' }
const ctxBox = { fontSize: 13, color: '#374151', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }
const choiceBtn = { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '13px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, cursor: 'pointer', color: 'var(--text)' }
const letter = { width: 24, height: 24, flexShrink: 0, borderRadius: 12, background: 'var(--bg)', color: 'var(--primary)', fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }
