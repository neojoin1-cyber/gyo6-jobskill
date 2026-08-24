// 요구 수준에 맞는 연습을 문항 옆에 붙인다.
//
// 채점 전에는 학생이 무언가를 내놓게 하고(이유 고르기·근거 적기),
// 채점 뒤에는 그것과 해설을 견주게 한다. 답을 본 뒤에는 "나도 그렇게
// 생각했다"고 느끼기 쉬워서, 미리 남겨 둔 것이 있어야 비교가 된다.
//
// 확인 수준은 물어보지 않는다. 찾아 읽는 문항에 매번 이유를 적게 하면
// 반복 연습이 느려지기만 한다 — 그 수준에 필요한 건 속도다.

import { useEffect, useState } from 'react'
import {
  learningModeOf, readCoachNote, writeCoachNote, coachFeedback,
} from '../../lib/learningMode.js'

export default function DemandCoach({ q, checked, correct }) {
  const mode = learningModeOf(q)
  const [note, setNote] = useState(null)

  useEffect(() => { setNote(readCoachNote(q?.id)) }, [q?.id])

  function save(next) {
    setNote(next)
    if (q?.id) writeCoachNote(q.id, next)
  }

  if (!q) return null

  const tint = mode.method === 'repeat' ? '#0F766E'
    : mode.method === 'explain' ? '#7C3AED' : '#B45309'

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <span style={{ fontSize: 15 }}>{mode.icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: tint }}>{mode.title}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>· {mode.goal}</span>
    </div>
  )

  const box = children => (
    <div style={{
      background: 'var(--card)', border: `1px solid ${tint}33`,
      borderLeft: `3px solid ${tint}`, borderRadius: 10,
      padding: '12px 14px', marginBottom: 12,
    }}>{header}{children}</div>
  )

  if (checked) {
    return box(
      <>
        <p style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--text)' }}>
          {coachFeedback(mode, note, correct)}
        </p>
        {mode.method === 'evidence' && note?.evidence?.trim() && (
          <p style={{
            fontSize: 12, lineHeight: 1.8, color: 'var(--text-muted)',
            marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)',
          }}>
            내가 적은 근거 — {note.evidence.trim()}
          </p>
        )}
      </>
    )
  }

  if (mode.method === 'repeat') {
    return box(
      <p style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{mode.before}</p>
    )
  }

  if (mode.method === 'explain') {
    return box(
      <>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{mode.prompt}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mode.reasons.map(r => {
            const on = note?.reason === r.id
            return (
              <button key={r.id} type="button"
                onClick={() => save({ ...note, reason: on ? null : r.id })}
                style={{
                  fontSize: 12, padding: '7px 11px', borderRadius: 999, cursor: 'pointer',
                  background: on ? tint : 'var(--bg)',
                  color: on ? '#fff' : 'var(--text)',
                  border: `1px solid ${on ? tint : 'var(--border)'}`,
                  fontWeight: on ? 700 : 500, transition: 'all .15s',
                }}>{r.label}</button>
            )
          })}
        </div>
      </>
    )
  }

  return box(
    <>
      <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{mode.prompt}</p>
      <textarea
        value={note?.evidence ?? ''}
        onChange={e => save({ ...note, evidence: e.target.value })}
        placeholder={mode.placeholder}
        rows={2}
        style={{
          width: '100%', fontSize: 13, lineHeight: 1.7, padding: '9px 11px',
          borderRadius: 8, border: '1px solid var(--border)', resize: 'vertical',
          background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
        }} />
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
        적은 내용은 이 기기에만 저장되고 선생님께 전송되지 않습니다.
      </p>
    </>
  )
}

/** 문항 머리에 붙이는 작은 표시. 이 문항을 **어떻게** 다뤄야 하는지 알려 준다. */
export function DemandChip({ q }) {
  const mode = learningModeOf(q)
  const tint = mode.method === 'repeat' ? '#0F766E'
    : mode.method === 'explain' ? '#7C3AED' : '#B45309'
  return (
    <span title={mode.goal} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      fontSize: 11, fontWeight: 700, color: tint,
      background: `${tint}14`, border: `1px solid ${tint}33`,
      borderRadius: 999, padding: '3px 9px',
    }}>
      <span style={{ fontSize: 12 }}>{mode.icon}</span>{mode.title}
    </span>
  )
}
