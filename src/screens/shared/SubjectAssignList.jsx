/**
 * SubjectAssignList — 대상(학급/학생) 목록에 6개 교재 토글 칩을 붙여 배정/해제.
 * props: targets [{id,name,sub?}], assigned {targetId:Set<subjectId>}, saving 'targetId|subjectId', onToggle(target,subject,isOn)
 */
import { SUBJECT_CATALOG } from '../../lib/subjectCatalog.js'

export default function SubjectAssignList({ targets, assigned, saving, onToggle, emptyText }) {
  if (!targets || targets.length === 0) {
    return <div className="empty-state"><span className="empty-state-icon">🗂️</span><span className="empty-state-title">{emptyText || '대상이 없습니다'}</span></div>
  }
  return (
    <>
      {targets.map(t => {
        const set = assigned[t.id] || new Set()
        return (
          <div key={t.id} className="card" style={{ marginBottom: 10 }}>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              {t.name}{t.sub && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> · {t.sub}</span>}
              <span style={{ marginLeft: 'auto', float: 'right', fontSize: 11, color: 'var(--text-muted)' }}>{set.size}/{SUBJECT_CATALOG.length}</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUBJECT_CATALOG.map(s => {
                const on = set.has(s.id)
                const busy = saving === `${t.id}|${s.id}`
                return (
                  <button key={s.id} disabled={busy}
                    onClick={() => onToggle(t, s, on)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '7px 10px', borderRadius: 20, fontSize: 12.5, fontWeight: on ? 800 : 500,
                      cursor: 'pointer', opacity: busy ? 0.5 : 1,
                      background: on ? 'var(--primary)' : 'var(--bg)',
                      color: on ? '#fff' : 'var(--text)',
                      border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
                    <span>{s.icon}</span>{s.name}{on ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
