import { useMemo, useState } from 'react'

/**
 * 끌어다 놓기(연결형) 문항을 **실제로 풀 수 있게** 하는 판.
 *
 * ### 왜 만들었나
 *
 * 교육부 인증진단의 공식 문항 유형에 **끌어다 놓기(Drag & Drop)** 가 있다 —
 * "보기에서 적절한 답안을 끌고 와서 정해진 영역에 가져다 놓는 방식".
 *
 * 우리에게도 연결형 문항이 16개 있었지만 **풀 수 없었다.** 왼쪽·오른쪽 짝을
 * 그냥 나란히 보여 주고 "연결 관계를 생각해 보세요"라고 할 뿐, 학생이 직접
 * 맞춰 보거나 채점을 받을 수 없었다. 보고 지나가는 자료였지 문항이 아니었다.
 *
 * ### 왜 끌기가 아니라 누르기인가
 *
 * 학생 대부분이 휴대폰으로 푼다. 좁은 화면에서 손가락으로 끄는 조작은
 * 스크롤과 충돌해 실패하기 쉽다. **왼쪽을 누르고 오른쪽을 누르면 이어지는**
 * 방식으로 만든다. 실제 시험에서 요구하는 판단(무엇과 무엇이 짝인가)은
 * 그대로이고, 조작만 화면에 맞춘다.
 */
export default function MatchingBoard({ q, checked, value, onChange }) {
  const pairs = q?.pairs || []
  // 오른쪽 항목은 섞어서 보여 준다. 순서대로 놓여 있으면 읽지 않고도 맞는다.
  const rights = useMemo(() => {
    const arr = pairs.map((p, i) => ({ i, text: p.right }))
    // 문항마다 같은 순서가 나오도록 id 기반으로 섞는다(새로고침해도 동일).
    let h = 2166136261
    for (const ch of String(q?.id ?? '')) h = ((h ^ ch.charCodeAt(0)) * 16777619) & 0xFFFFFFFF
    for (let k = arr.length - 1; k > 0; k--) {
      h = (h * 1103515245 + 12345) & 0x7FFFFFFF
      const j = h % (k + 1)
      ;[arr[k], arr[j]] = [arr[j], arr[k]]
    }
    return arr
  }, [q?.id, pairs.length])

  const [picked, setPicked] = useState(null)   // 지금 고른 왼쪽 index
  const links = value || {}                    // { 왼쪽index: 오른쪽 원래index }

  function tapLeft(i) {
    if (checked) return
    setPicked(p => (p === i ? null : i))
  }
  function tapRight(origIdx) {
    if (checked || picked === null) return
    const next = { ...links }
    // 이미 다른 왼쪽이 쓰고 있던 오른쪽이면 그쪽 연결을 끊는다.
    for (const k of Object.keys(next)) if (next[k] === origIdx) delete next[k]
    next[picked] = origIdx
    setPicked(null)
    onChange?.(next)
  }
  function clearOne(i) {
    if (checked) return
    const next = { ...links }
    delete next[i]
    onChange?.(next)
  }

  const usedRights = new Set(Object.values(links))

  return (
    <div style={{ marginBottom: 12 }}>
      <p style={hint}>
        {checked
          ? '초록색은 맞게 이은 것, 빨간색은 어긋난 것입니다.'
          : '왼쪽을 누른 뒤 알맞은 오른쪽을 누르면 이어집니다. 다시 누르면 취소돼요.'}
      </p>

      {pairs.map((p, i) => {
        const linked = links[i]
        const right = linked != null ? pairs[linked]?.right : null
        const ok = checked ? linked === i : null
        return (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 6,
          }}>
            <button type="button" onClick={() => tapLeft(i)} disabled={checked}
              style={{
                ...cell,
                flex: '0 0 38%',
                border: picked === i ? '2px solid #1565c0' : '1px solid #90caf9',
                background: picked === i ? '#e3f0ff' : 'var(--card)',
                fontWeight: 700, color: '#1565c0',
              }}>
              {p.left}
            </button>
            <button type="button" onClick={() => linked != null && clearOne(i)} disabled={checked || linked == null}
              style={{
                ...cell, flex: 1, textAlign: 'left',
                border: ok === null ? '1px dashed var(--border)'
                  : ok ? '1px solid #66bb6a' : '1px solid #ef5350',
                background: ok === null ? (right ? 'var(--bg)' : 'transparent')
                  : ok ? '#e8f5e9' : '#ffebee',
                color: right ? 'var(--text)' : 'var(--text-muted)',
              }}>
              {right ?? '여기에 이어 주세요'}
              {/* 틀린 자리에는 맞는 답을 함께 보여 준다. 색만 빨갛게 칠하고
                  끝내면 무엇이 맞는지 모른 채 넘어간다. */}
              {checked && ok === false && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#2e7d32' }}>
                  정답: {p.right}
                </span>
              )}
            </button>
          </div>
        )
      })}

      {!checked && (
        <>
          <p style={{ ...hint, marginTop: 10 }}>고를 수 있는 항목</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rights.map(r => (
              <button key={r.i} type="button" onClick={() => tapRight(r.i)}
                disabled={usedRights.has(r.i) || picked === null}
                style={{
                  ...cell, padding: '8px 11px', fontSize: 12.5,
                  opacity: usedRights.has(r.i) ? 0.35 : 1,
                  border: '1px solid #c7d7f5', background: '#f0f7ff', color: '#1e3a8a',
                }}>
                {r.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** 모든 짝을 맞게 이었는가. */
export function isMatchingCorrect(q, value) {
  const pairs = q?.pairs || []
  if (!pairs.length) return false
  const links = value || {}
  return pairs.every((_, i) => links[i] === i)
}

const cell = {
  padding: '10px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
}
const hint = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }
