/**
 * TextbookBrowse — 배정된 교재 목록을 완전교재 리더로 열람(공용).
 * props: subjectIds (Set<id> | 'all' | null=로딩), fallbackNote(문자열, 'all'일 때 안내)
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { pushBack, popBack } from '../../lib/backButton.js'
import { SUBJECT_CATALOG } from '../../lib/subjectCatalog.js'
import { lazyChunk } from '../../lib/lazyChunk.js'

const TextbookReader = lazyChunk(() => import('../student/TextbookReader.jsx'), 'TextbookReader')

export default function TextbookBrowse({ subjectIds, fallbackNote }) {
  const [reading, setReading] = useState(null)   // {id,name}

  useEffect(() => {
    if (!reading) return
    const id = pushBack(() => setReading(null))
    return () => popBack(id)
  }, [reading])

  if (reading) {
    return (
      <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
        <TextbookReader subjectId={reading.id} subjectName={reading.name} onBack={() => setReading(null)} />
      </Suspense>
    )
  }

  if (subjectIds == null) return <div className="loading-screen"><div className="spinner" /></div>

  const books = subjectIds === 'all' ? SUBJECT_CATALOG : SUBJECT_CATALOG.filter(s => subjectIds.has(s.id))

  return (
    <>
      {subjectIds === 'all' && fallbackNote && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>{fallbackNote}</p>
      )}
      {books.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📚</span>
          <span className="empty-state-title">배정된 교재가 없습니다</span>
          <span>학교·학급 관리자가 교재를 배정하면 여기에 표시됩니다.</span>
        </div>
      ) : books.map(b => (
        <button key={b.id} onClick={() => setReading({ id: b.id, name: b.name })}
          style={{ width: '100%', textAlign: 'left', background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px', marginBottom: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{b.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>완전교재 열람 →</p>
          </div>
        </button>
      ))}
    </>
  )
}
