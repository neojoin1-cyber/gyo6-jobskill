/**
 * 풀다운(Pull-down) 문항 — 서식의 빈칸을 목록에서 골라 채운다.
 *
 * ### 왜 만들었나
 *
 * 교육부 인증진단의 공식 문항 유형에 **풀다운**이 있다 —
 * "실제 컴퓨터를 통해 직무를 수행하는 것과 동일한 방식으로 정답을 선택하는
 * 방식의 문항".
 *
 * 우리에게는 이 유형이 **한 문항도 없었다.** 학생은 보기 넷 중 하나를 고르는
 * 연습만 하다가, 시험장에서 처음으로 표의 빈칸을 드롭다운으로 채우게 된다.
 *
 * 형식만 다른 것이 아니다. 요구하는 일이 다르다. 사지선다는 "넷 중 맞는 것"을
 * 고르지만, 풀다운은 **여러 칸을 서로 어긋나지 않게 동시에 채워야** 한다.
 * 한 칸을 잘못 채우면 그 칸만 틀리는 것이 아니라 표 전체가 틀린다.
 *
 * 그래서 채점도 그렇게 한다 — **모든 칸이 맞아야 정답**이다.
 */

/** 모든 칸을 맞게 채웠는가. */
export function isPulldownCorrect(q, value) {
  const blanks = q?.blanks || []
  if (!blanks.length) return false
  const picked = value || {}
  return blanks.every((b, i) => picked[i] === b.answer)
}

/** 채운 칸 수. 진행 표시에 쓴다. */
export function pulldownFilled(value) {
  return Object.values(value || {}).filter(v => v != null).length
}

export default function PulldownForm({ q, checked, value, onChange }) {
  const blanks = q?.blanks || []
  const picked = value || {}

  function set(i, v) {
    if (checked) return
    onChange?.({ ...picked, [i]: v === '' ? null : Number(v) })
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {q?.table && <TableView table={q.table} />}

      <p style={hint}>
        {checked
          ? '초록색은 맞게 채운 칸, 빨간색은 어긋난 칸입니다.'
          : '각 칸에서 알맞은 값을 골라 표를 완성하세요. 모든 칸이 맞아야 정답입니다.'}
      </p>

      {blanks.map((b, i) => {
        const sel = picked[i]
        const ok = checked ? sel === b.answer : null
        return (
          <div key={b.id ?? i} style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
            padding: '10px 12px', borderRadius: 10,
            border: ok === null ? '1px solid var(--border)'
              : ok ? '1px solid #66bb6a' : '1px solid #ef5350',
            background: ok === null ? 'var(--card)' : ok ? '#e8f5e9' : '#ffebee',
          }}>
            <span style={{ flex: '0 0 40%', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {b.label}
            </span>
            <select
              value={sel == null ? '' : String(sel)}
              onChange={e => set(i, e.target.value)}
              disabled={checked}
              style={{
                flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
              }}>
              <option value="">선택하세요</option>
              {b.options.map((o, oi) => (
                <option key={oi} value={oi}>{o}</option>
              ))}
            </select>
          </div>
        )
      })}

      {checked && (
        <div style={{
          marginTop: 4, padding: '10px 12px', borderRadius: 10,
          background: '#f0f7ff', border: '1px solid #c7d7f5',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>정답</p>
          {blanks.map((b, i) => (
            <p key={b.id ?? i} style={{ fontSize: 12.5, lineHeight: 1.8, color: '#1e3a8a' }}>
              {b.label} → <b>{b.options[b.answer]}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** 문항이 제시하는 표. 자료를 보고 빈칸을 채우는 형식이라 표가 함께 있어야 한다. */
function TableView({ table }) {
  const cols = table?.columns || []
  const rows = table?.rows || []
  if (!cols.length) return null
  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      {table.caption && (
        <p style={{ fontSize: 12, fontWeight: 700, color: '#3b5bdb', marginBottom: 6 }}>
          📋 {table.caption}
        </p>
      )}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{
                border: '1px solid var(--border)', padding: '7px 9px',
                background: '#eef2ff', color: '#3730a3', fontWeight: 800, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} style={{
                  border: '1px solid var(--border)', padding: '7px 9px',
                  textAlign: ci === 0 ? 'left' : 'right', whiteSpace: 'nowrap',
                  color: String(cell) === '?' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: String(cell) === '?' ? 800 : 400,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const hint = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 10 }
