export default function QuestionMedia({ q }) {
  const visual = q?.visual
  if (!visual) return null

  if (visual.type === 'table') {
    return (
      <figure style={figureStyle} aria-label={visual.caption || '문항 표 자료'}>
        {visual.caption && <figcaption style={captionStyle}>{visual.caption}</figcaption>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
            <thead>
              <tr>
                {visual.columns.map(column => (
                  <th key={column} style={headerCellStyle}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visual.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={cellStyle}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visual.note && <p style={noteStyle}>{visual.note}</p>}
      </figure>
    )
  }

  if (visual.type === 'bar') {
    const max = Math.max(...visual.items.map(item => Number(item.value) || 0), 1)
    return (
      <figure style={figureStyle} aria-label={visual.caption || '문항 막대그래프 자료'}>
        {visual.caption && <figcaption style={captionStyle}>{visual.caption}</figcaption>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visual.items.map(item => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 42px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{item.label}</span>
              <div style={{ height: 18, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{ width: `${(Number(item.value) / max) * 100}%`, height: '100%', background: '#2563EB' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textAlign: 'right' }}>{item.value}</span>
            </div>
          ))}
        </div>
        {visual.note && <p style={noteStyle}>{visual.note}</p>}
      </figure>
    )
  }

  return null
}

const figureStyle = {
  margin: '0 0 12px',
  padding: '12px',
  border: '1px solid #93C5FD',
  borderRadius: 12,
  background: '#F8FAFC',
}
const captionStyle = { marginBottom: 9, fontSize: 12.5, fontWeight: 800, color: '#1E3A8A' }
const headerCellStyle = { padding: '8px 7px', border: '1px solid #CBD5E1', background: '#DBEAFE', color: '#1E3A8A', fontSize: 12, textAlign: 'center' }
const cellStyle = { padding: '8px 7px', border: '1px solid #CBD5E1', color: '#1E293B', fontSize: 12.5, textAlign: 'center' }
const noteStyle = { marginTop: 8, fontSize: 12.5, lineHeight: 1.55, color: '#64748B' }
