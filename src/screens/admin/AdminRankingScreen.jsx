import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function AdminRankingScreen() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(null)
  const [viewType, setViewType] = useState('school') // 'school' | 'class'
  const [rankings, setRankings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('subjects').select('id, name').then(({ data }) => setSubjects(data ?? []))
  }, [])

  useEffect(() => { load() }, [viewType, subjectId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('rpc_national_rankings', {
      p_type: viewType,
      p_subject_id: subjectId,
    })
    setRankings(data ?? [])
    setLoading(false)
  }

  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      {/* 과목 필터 */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 0 8px',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {[{ id: null, name: '전체' }, ...subjects].map(s => (
          <button key={s.id ?? 'all'}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              background: subjectId === s.id ? 'var(--primary)' : 'transparent',
              color: subjectId === s.id ? '#fff' : 'var(--text-muted)',
              borderColor: subjectId === s.id ? 'var(--primary)' : 'var(--border)',
            }}
            onClick={() => setSubjectId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {/* 뷰 전환 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['school', '학교 순위'], ['class', '학급 순위']].map(([t, label]) => (
          <button key={t}
            className={`btn ${viewType === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 13 }}
            onClick={() => setViewType(t)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : !rankings || rankings.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <span className="empty-state-title">아직 데이터가 없습니다</span>
        </div>
      ) : viewType === 'school' ? (
        rankings.map(r => {
          const m = medal(r.national_rank)
          return (
            <div key={r.school_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 6,
              background: 'var(--card)', borderRadius: 10,
              border: '1px solid var(--border)',
              opacity: r.national_ranking_opt_in ? 1 : 0.55,
            }}>
              <span style={{ width: 30, textAlign: 'center', fontSize: m ? 20 : 14, fontWeight: 700 }}>
                {r.national_ranking_opt_in ? (m ?? r.national_rank) : '—'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{r.school_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.region} · {r.class_count}학급 · {r.student_count}명
                  {!r.national_ranking_opt_in && ' · 전국랭킹 미참여'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, color: 'var(--primary)' }}>평균 {r.avg_score}점</p>
              </div>
            </div>
          )
        })
      ) : (
        rankings.map(r => {
          const m = medal(r.national_rank)
          return (
            <div key={r.class_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 6,
              background: 'var(--card)', borderRadius: 10,
              border: '1px solid var(--border)',
            }}>
              <span style={{ width: 30, textAlign: 'center', fontSize: m ? 20 : 14, fontWeight: 700 }}>
                {m ?? r.national_rank}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{r.class_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.school_name} · {r.region} · {r.student_count}명
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, color: 'var(--primary)' }}>평균 {r.avg_score}점</p>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
