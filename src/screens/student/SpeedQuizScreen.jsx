// 주간 스피드 퀴즈 — 60초 안에 최대한 많이.
//
// 학습 화면은 정확도만 다룬다. 실제 필기시험은 시간이 모자라서 틀리는데,
// 앱에는 '빨라졌는지'를 알 수 있는 곳이 없었다. 그래서 규칙 자체가 학습
// 목표가 되게 했다 — 틀리면 3초를 잃으므로 찍는 것이 손해다.
//
// 새 표를 만들지 않았다. 점수를 주간 XP로 환산해 넣으면 이미 있는 주간
// 랭킹 위에서 반 대항전이 저절로 성립한다.

import { useState, useEffect, useRef } from 'react'
import {
  ROUND_SECONDS, WRONG_PENALTY, SPEED_AREAS,
  drawRound, scoreOf, saveResult, getWeeklyBest, getPlaysThisWeek,
} from '../../lib/speedQuiz.js'
import { addXp } from '../../lib/xp.js'

export default function SpeedQuizScreen({ onBack, onDone }) {
  const [phase, setPhase] = useState('intro')      // intro | play | done
  const [area, setArea] = useState(null)           // null = 전 영역
  const [queue, setQueue] = useState([])
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(ROUND_SECONDS)
  const [pick, setPick] = useState(null)
  const [correct, setCorrect] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [result, setResult] = useState(null)
  const timer = useRef(null)

  const best = getWeeklyBest()
  const plays = getPlaysThisWeek()

  // 타이머 콜백은 시작 시점의 상태를 붙잡고 있다. 점수는 ref 로 따로 들고
  // 있어야 시간이 다 됐을 때 최신 값으로 채점된다.
  const scoreRef = useRef({ correct: 0, bestStreak: 0 })
  scoreRef.current = { correct, bestStreak }

  useEffect(() => () => clearInterval(timer.current), [])

  function finish() {
    clearInterval(timer.current)
    const { correct: c, bestStreak: b } = scoreRef.current
    const score = scoreOf(c, b)
    const saved = saveResult(score)
    if (score > 0) addXp(Math.min(40, Math.round(score / 5)), 'speed_quiz')
    setResult({ score, correct: c, bestStreak: b, isBest: score >= saved.best })
    setPhase('done')
  }

  function start() {
    const q = drawRound(area, 40)
    if (!q.length) return
    setQueue(q); setI(0); setLeft(ROUND_SECONDS)
    setPick(null); setCorrect(0); setStreak(0); setBestStreak(0)
    setPhase('play')
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      setLeft(t => {
        if (t <= 1) { finish(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function choose(idx) {
    if (pick !== null) return
    const q = queue[i]
    const ci = q.answer.charCodeAt(0) - 65
    const ok = idx === ci
    setPick(idx)
    if (ok) {
      setCorrect(n => n + 1)
      setStreak(s => {
        const ns = s + 1
        setBestStreak(b => Math.max(b, ns))
        return ns
      })
    } else {
      setStreak(0)
      setLeft(t => Math.max(0, t - WRONG_PENALTY))   // 찍기를 손해로 만든다
    }
    setTimeout(() => {
      setPick(null)
      setI(n => (n + 1 < queue.length ? n + 1 : 0))  // 문항이 떨어지면 처음부터
    }, ok ? 320 : 900)
  }

  if (phase === 'intro') return (
    <Wrap title="⚡ 스피드 퀴즈" onBack={onBack}>
      <div style={card}>
        <p style={{ fontSize: 42, textAlign: 'center' }}>⚡</p>
        <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginTop: 4 }}>
          60초, 최대한 많이
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 10, textAlign: 'center' }}>
          맞히면 <b>+10점</b>, 연속으로 맞히면 보너스.<br />
          틀리면 <b>{WRONG_PENALTY}초</b>를 잃어요 — 찍으면 손해예요.
        </p>

        <div style={{
          display: 'flex', gap: 10, marginTop: 14, padding: '12px 14px',
          borderRadius: 10, background: 'var(--bg)',
        }}>
          <Stat label="이번 주 최고" value={best ? best + '점' : '—'} />
          <Stat label="이번 주 도전" value={plays + '회'} />
        </div>

        <p style={{ fontSize: 12, fontWeight: 800, marginTop: 16, marginBottom: 8 }}>영역 고르기</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip on={area === null} onClick={() => setArea(null)}>전 영역</Chip>
          {SPEED_AREAS.map(a => (
            <Chip key={a.area} on={area === a.area} onClick={() => setArea(a.area)}>
              {a.area}
            </Chip>
          ))}
        </div>

        <button onClick={start} style={primaryBtn}>시작 (60초)</button>
      </div>
    </Wrap>
  )

  if (phase === 'done') return (
    <Wrap title="⚡ 스피드 퀴즈" onBack={onBack}>
      <div style={{ ...card, textAlign: 'center' }}>
        <p style={{ fontSize: 42 }}>{result.isBest ? '🏆' : '⚡'}</p>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{result.score}점</h2>
        {result.isBest && (
          <p style={{ fontSize: 13, color: '#B45309', fontWeight: 800, marginTop: 4 }}>
            이번 주 최고 기록!
          </p>
        )}
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>
          정답 {result.correct}개 · 최고 연속 {result.bestStreak}개
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.8 }}>
          점수는 주간 XP에 반영돼요. 반 랭킹에서 확인해 보세요.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => setPhase('intro')} style={ghostBtn}>다시 하기</button>
          <button onClick={() => { onDone?.(); onBack() }} style={{ ...primaryBtn, marginTop: 0 }}>
            나가기
          </button>
        </div>
      </div>
    </Wrap>
  )

  const q = queue[i]
  if (!q) return null
  const ci = q.answer.charCodeAt(0) - 65
  const answered = pick !== null
  const low = left <= 10

  return (
    <Wrap title="⚡ 스피드 퀴즈" onBack={() => { clearInterval(timer.current); onBack() }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            fontSize: 26, fontWeight: 800, minWidth: 58,
            color: low ? 'var(--danger)' : 'var(--primary)',
          }}>{left}s</div>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              width: ((left / ROUND_SECONDS) * 100) + '%', height: '100%',
              background: low ? 'var(--danger)' : 'var(--primary)', transition: 'width .3s linear',
            }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>
            {correct}개
            {streak >= 3 && <span style={{ color: '#B45309' }}> · {streak}연속🔥</span>}
          </div>
        </div>

        {q.context && (
          <div style={{
            fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-muted)',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '9px 11px', marginBottom: 8, whiteSpace: 'pre-wrap',
          }}>{q.context}</div>
        )}
        <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, marginBottom: 12 }}>{q.stem}</p>

        {q.choices.map((c, idx) => {
          let bd = 'var(--border)', bg = 'var(--card)'
          if (answered && idx === ci)        { bd = 'var(--success)'; bg = '#ECFDF5' }
          else if (answered && idx === pick) { bd = 'var(--danger)';  bg = '#FEF2F2' }
          return (
            <button key={idx} onClick={() => choose(idx)} disabled={answered}
              style={{
                width: '100%', display: 'flex', gap: 10, textAlign: 'left',
                padding: '13px 14px', marginBottom: 8, borderRadius: 11,
                border: '1.5px solid ' + bd, background: bg, color: 'var(--text)',
                fontSize: 14.5, lineHeight: 1.6, cursor: answered ? 'default' : 'pointer',
              }}>
              <span style={{ fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
              <span style={{ flex: 1 }}>{c}</span>
            </button>
          )
        })}
        {answered && pick !== ci && (
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', textAlign: 'center', marginTop: 4 }}>
            −{WRONG_PENALTY}초
          </p>
        )}
      </div>
    </Wrap>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 800 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12.5, fontWeight: on ? 800 : 500, padding: '7px 12px', borderRadius: 999,
      border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
      background: on ? 'var(--primary)' : 'var(--bg)',
      color: on ? '#fff' : 'var(--text)', cursor: 'pointer',
    }}>{children}</button>
  )
}

function Wrap({ title, onBack, children }) {
  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">{title}</span>
      </div>
      <div className="screen-body">{children}</div>
    </div>
  )
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 16px', maxWidth: 640, margin: '0 auto' }
const primaryBtn = { flex: 1, width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 18 }
const ghostBtn = { flex: 1, padding: '13px', borderRadius: 10, background: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)', fontWeight: 800, fontSize: 15, cursor: 'pointer' }
