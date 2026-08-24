import { useState, useRef, useEffect } from 'react'

/**
 * 실전 시험 화면에서만 뜨는 도구 모음.
 *
 * ### 왜 필요한가
 *
 * 교육부 직업공통능력 인증진단은 컴퓨터로 치른다. 공식 매뉴얼이 밝힌 화면
 * 기능은 이렇다 — **형광펜·지우개·계산기·메모장**, **[문항체크]** 로 나중에
 * 다시 볼 문항 표시, **[이전]/[다음]** 으로 자유로운 이동.
 *
 * 우리 시험 화면에는 이 가운데 하나도 없었다. 그래서 학생은 실제보다 어려운
 * 조건에서 연습한다. 특히 수리활용은 50분에 50문항인데 계산기 없이 풀면
 * 시간 배분 감각 자체가 어긋난다. 반대로 "못 푼 문항을 표시해 두고 넘어가는"
 * 실전 전략은 아예 연습할 기회가 없다.
 *
 * 시험이 아닌 연습 화면에는 뜨지 않는다. 시간 제한이 있는 실전에서만 쓴다.
 */
export default function ExamTools({ total, idx, answers, questions, flags, onToggleFlag, onJump }) {
  const [open, setOpen] = useState(null)   // 'list' | 'calc' | 'memo' | null
  const flagged = !!flags[questions[idx]?.id]

  return (
    <>
      <div style={bar}>
        <button style={btn(flagged)} onClick={() => onToggleFlag(questions[idx]?.id)}>
          {flagged ? '🚩 체크됨' : '☐ 문항체크'}
        </button>
        <button style={btn(open === 'list')} onClick={() => setOpen(o => o === 'list' ? null : 'list')}>
          📋 문항목록
        </button>
        <button style={btn(open === 'calc')} onClick={() => setOpen(o => o === 'calc' ? null : 'calc')}>
          🔢 계산기
        </button>
        <button style={btn(open === 'memo')} onClick={() => setOpen(o => o === 'memo' ? null : 'memo')}>
          📝 메모장
        </button>
      </div>

      {open === 'list' && (
        <div style={panel}>
          <p style={hint}>
            답한 문항은 진하게, 체크한 문항은 깃발로 표시됩니다. 번호를 누르면 그 문항으로 이동합니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {questions.map((q, i) => {
              const done = answers[q?.id] !== undefined
              const flag = !!flags[q?.id]
              return (
                <button key={q?.id ?? i} onClick={() => { onJump(i); setOpen(null) }}
                  style={{
                    width: 40, height: 34, borderRadius: 8, fontSize: 12, fontWeight: 800,
                    cursor: 'pointer', position: 'relative',
                    border: i === idx ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: done ? 'var(--primary)' : 'var(--card)',
                    color: done ? '#fff' : 'var(--text-muted)',
                  }}>
                  {i + 1}
                  {flag && <span style={{ position: 'absolute', top: -4, right: -2, fontSize: 10 }}>🚩</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {open === 'calc' && <Calculator />}
      {open === 'memo' && <Memo total={total} />}
    </>
  )
}

/** 실제 시험 화면의 계산기와 같은 수준 — 사칙연산과 백분율. */
function Calculator() {
  const [expr, setExpr] = useState('')
  const [out, setOut] = useState('')

  function press(k) {
    if (k === 'C') { setExpr(''); setOut(''); return }
    if (k === '←') { setExpr(e => e.slice(0, -1)); return }
    if (k === '=') {
      try {
        // 숫자와 연산자만 남긴다. 그 밖의 것은 계산하지 않는다.
        const safe = expr.replace(/[^0-9+\-*/.() %]/g, '').replace(/%/g, '/100')
        if (!safe.trim()) return
        // eslint-disable-next-line no-new-func
        const v = Function(`"use strict"; return (${safe})`)()
        setOut(Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '계산할 수 없음')
      } catch { setOut('계산할 수 없음') }
      return
    }
    setExpr(e => e + k)
  }

  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+']
  return (
    <div style={panel}>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
        marginBottom: 8, background: 'var(--card)', textAlign: 'right',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', minHeight: 18 }}>{expr || '0'}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{out || ''}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {keys.map(k => (
          <button key={k} onClick={() => press(k)} style={calcKey}>{k}</button>
        ))}
        <button onClick={() => press('C')} style={{ ...calcKey, background: '#fee2e2' }}>C</button>
        <button onClick={() => press('←')} style={calcKey}>←</button>
        <button onClick={() => press('=')} style={{ ...calcKey, gridColumn: 'span 2', background: 'var(--primary)', color: '#fff' }}>=</button>
      </div>
    </div>
  )
}

/** 메모장 — 기기에만 남고 서버로 가지 않는다. 시험이 끝나면 지운다. */
function Memo() {
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem('sst.exam.memo') || '' } catch { return '' }
  })
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div style={panel}>
      <p style={hint}>메모는 이 기기에만 남고 제출되지 않습니다. 계산 과정이나 지문에서 찾은 조건을 적어 두세요.</p>
      <textarea ref={ref} value={text} rows={5}
        onChange={e => {
          setText(e.target.value)
          try { sessionStorage.setItem('sst.exam.memo', e.target.value) } catch { /* 무시 */ }
        }}
        style={{
          width: '100%', border: '1px solid var(--border)', borderRadius: 8,
          padding: 10, fontSize: 14, lineHeight: 1.6, resize: 'vertical',
          background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit',
        }} />
    </div>
  )
}

const bar = {
  display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap',
  borderBottom: '1px solid var(--border)', background: 'var(--bg)',
}
const btn = (on) => ({
  flex: 1, minWidth: 78, padding: '7px 6px', fontSize: 12, fontWeight: 700,
  borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: on ? '#eef2ff' : 'var(--card)',
  color: on ? 'var(--primary)' : 'var(--text)',
})
const panel = {
  padding: '10px 12px', borderBottom: '1px solid var(--border)',
  background: 'var(--bg)', maxHeight: 260, overflowY: 'auto',
}
const hint = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }
const calcKey = {
  padding: '10px 0', fontSize: 15, fontWeight: 700, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
}
