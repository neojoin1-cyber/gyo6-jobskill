// 아침 출석 — 읽고, 한 문항 풀고, 출석이 찍힌다.
//
// 버튼 하나로 끝나는 출석은 이틀이면 지겨워진다. 짧은 글 한 편과 그 글을
// 읽어야만 풀리는 문항 하나를 사이에 두면, 출석 자체가 2분짜리 학습이 된다.
//
// 틀려도 출석은 된다. 출석은 성적이 아니라 습관이기 때문이다. 대신 맞히면
// XP를 더 준다.

import { useState } from 'react'
import { todaysTalk, markAttendance, getAttendance } from '../../lib/morningTalk.js'
import { addXp } from '../../lib/xp.js'

const XP_BASE = 10
const XP_BONUS = 10

export default function AttendanceScreen({ onBack, onDone }) {
  const talk = todaysTalk()
  const already = getAttendance()
  const [phase, setPhase] = useState(already.done ? 'done' : 'read')  // read | quiz | done
  const [pick, setPick] = useState(null)

  if (!talk) return (
    <Wrap title="🌅 아침 출석" onBack={onBack}>
      <div style={card}>
        <p style={{ textAlign: 'center' }}>오늘의 훈화를 불러오지 못했어요.</p>
        <button onClick={onBack} style={primaryBtn}>돌아가기</button>
      </div>
    </Wrap>
  )

  const q = talk.question
  const correctIdx = (q?.answer ?? 'A').charCodeAt(0) - 65
  const answered = pick !== null
  const correct = pick === correctIdx

  function submit(idx) {
    if (answered) return
    setPick(idx)
    const ok = idx === correctIdx
    // 출석 기록이 새로 찍힐 때만 XP를 준다. 재방문으로 XP를 반복 획득할 수 없다.
    if (markAttendance(talk.id, ok)) addXp(XP_BASE + (ok ? XP_BONUS : 0), 'attendance')
  }

  if (phase === 'done') return (
    <Wrap title="🌅 아침 출석" onBack={onBack}>
      <div style={{ ...card, textAlign: 'center' }}>
        <p style={{ fontSize: 44 }}>🌅</p>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>오늘 출석 완료!</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
          오늘의 한 줄을 하루에 한 번만 떠올려 보세요.
        </p>
        <p style={{
          fontSize: 15, fontWeight: 800, color: 'var(--primary)',
          marginTop: 12, lineHeight: 1.7,
        }}>“{talk.oneLine}”</p>
        <button onClick={() => { onDone?.(); onBack() }} style={primaryBtn}>돌아가기</button>
      </div>
    </Wrap>
  )

  if (phase === 'read') return (
    <Wrap title="🌅 아침 출석" onBack={onBack}>
      <div style={card}>
        <span style={chip}>{talk.theme}</span>
        <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 10, lineHeight: 1.5 }}>{talk.title}</h2>
        <p style={{ fontSize: 14.5, lineHeight: 2, marginTop: 12, whiteSpace: 'pre-wrap' }}>{talk.body}</p>
        <div style={{
          marginTop: 16, padding: '13px 15px', borderRadius: 10,
          background: 'var(--primary-light)', borderLeft: '3px solid var(--primary)',
        }}>
          <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', marginBottom: 5 }}>오늘의 한 줄</p>
          <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7 }}>{talk.oneLine}</p>
        </div>
        <button onClick={() => setPhase('quiz')} style={primaryBtn}>다 읽었어요 · 한 문항 풀기</button>
      </div>
    </Wrap>
  )

  // quiz
  return (
    <Wrap title="🌅 아침 출석" onBack={onBack}>
      <div style={card}>
        <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
          오늘의 훈화 확인
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7 }}>{q.stem}</p>
        <div style={{ marginTop: 12 }}>
          {q.choices.map((c, idx) => {
            let bd = 'var(--border)', bg = 'var(--card)'
            if (answered && idx === correctIdx) { bd = 'var(--success)'; bg = '#ECFDF5' }
            else if (answered && idx === pick)  { bd = 'var(--danger)';  bg = '#FEF2F2' }
            return (
              <button key={idx} onClick={() => submit(idx)} disabled={answered}
                style={{
                  width: '100%', display: 'flex', gap: 10, textAlign: 'left',
                  padding: '12px 14px', marginBottom: 8, borderRadius: 10,
                  border: `1.5px solid ${bd}`, background: bg, color: 'var(--text)',
                  fontSize: 14, lineHeight: 1.6, cursor: answered ? 'default' : 'pointer',
                }}>
                <span style={{ fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1 }}>{c}</span>
              </button>
            )
          })}
        </div>
        {answered && (
          <>
            <div style={{
              marginTop: 6, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${correct ? '#10B981' : '#EF4444'}`,
              background: correct ? '#ECFDF5' : '#FEF2F2',
            }}>
              <p style={{ fontWeight: 800, marginBottom: 6, color: correct ? '#047857' : '#B91C1C' }}>
                {correct ? `정답! +${XP_BASE + XP_BONUS} XP` : `정답은 ${correctIdx + 1}번 · 출석 +${XP_BASE} XP`}
              </p>
              <p style={{ fontSize: 13.5, lineHeight: 1.8, color: '#374151' }}>{q.explanation}</p>
            </div>
            <button onClick={() => setPhase('done')} style={primaryBtn}>출석 완료</button>
          </>
        )}
      </div>
    </Wrap>
  )
}

function Wrap({ title, onBack, children }) {
  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">{title}</span>
      </div>
      <div className="screen-body"><div style={{ maxWidth: 640, margin: '0 auto' }}>{children}</div></div>
    </div>
  )
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 16px' }
const chip = { display: 'inline-block', fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: 'var(--primary-light)', color: 'var(--primary)' }
const primaryBtn = { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 18 }
