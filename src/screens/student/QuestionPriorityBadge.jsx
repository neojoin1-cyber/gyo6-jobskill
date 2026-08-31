import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { questionPriority } from '../../lib/questionPriority.js'

export default function QuestionPriorityBadge({ q, subjectId, showReason = false }) {
  const [open, setOpen] = useState(false)
  const priority = questionPriority(q, subjectId)
  if (!priority) return null
  const sourceYears = [...new Set(priority.sources.map(source => source.year).filter(Boolean))].join('·')
  const tooltip = `${priority.label}: ${priority.reason}${sourceYears ? ` (${sourceYears} 근거)` : ''}`

  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        className={`question-priority-badge is-${priority.key}`}
        title={tooltip}
        aria-label={`${tooltip}. 근거 보기`}
        data-question-priority={priority.key}
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer',
          color: priority.color, background: priority.background,
          border: `1px solid ${priority.border}`, borderRadius: 999,
          padding: '2px 8px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap',
        }}
      >
        {priority.label}{showReason ? ` · ${priority.reason}` : ''}
      </button>
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15, 23, 42, .46)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${priority.label} 근거`}
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(420px, 100%)', maxHeight: 'min(560px, 82vh)', overflowY: 'auto', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 18px 48px rgba(15, 23, 42, .24)', padding: 18 }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: priority.color, background: priority.background, border: `1px solid ${priority.border}`, borderRadius: 999, padding: '3px 9px', fontSize: 13, fontWeight: 900 }}>{priority.label}</span>
              <b style={{ flex: 1, fontSize: 16 }}>표시 근거</b>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" title="닫기" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', color: 'var(--text)', cursor: 'pointer' }}><X size={18} /></button>
            </header>
            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.65 }}>{priority.reason}</p>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {priority.sources.map(source => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '8px 0', color: 'var(--primary)', fontSize: 13, lineHeight: 1.45, textDecoration: 'none' }}>
                  <b>{source.year}</b> · {source.label}
                </a>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.55 }}>이 배지는 문항 원문이 기출이라는 뜻이 아니라, 현재 학습 주제가 공개 평가틀·채용공고의 평가 범위와 연결된다는 뜻입니다.</p>
          </section>
        </div>
      )}
    </span>
  )
}
