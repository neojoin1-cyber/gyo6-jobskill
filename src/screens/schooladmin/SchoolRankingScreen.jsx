import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function SchoolRankingScreen() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(null)
  const [classRankings, setClassRankings] = useState(null)
  const [schoolPos, setSchoolPos] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('subjects').select('id, name').then(({ data }) => setSubjects(data ?? []))
  }, [])

  useEffect(() => { load() }, [subjectId])

  async function load() {
    setLoading(true)
    const [cr, sp] = await Promise.all([
      supabase.rpc('rpc_school_class_rankings', { p_subject_id: subjectId }),
      supabase.rpc('rpc_school_position',       { p_subject_id: subjectId }),
    ])
    setClassRankings(cr.data ?? [])
    setSchoolPos(sp.data)
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

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {/* 학교 전국 위치 */}
          {schoolPos && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px 8px', borderTop: '3px solid var(--primary)' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>학교 평균점수</p>
                <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>{schoolPos.school_avg}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>점</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px 8px', borderTop: '3px solid #ef4444' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>전국 학교 순위</p>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>
                  {schoolPos.national_opt_in ? (schoolPos.national_rank ?? '-') : '미참여'}
                </p>
                {schoolPos.national_opt_in && (
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {schoolPos.national_total}교</p>
                )}
              </div>
            </div>
          )}

          {/* 학교내 학급 순위 */}
          <p className="section-title">학교내 학급 순위</p>
          {!classRankings || classRankings.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📊</span>
              <span className="empty-state-title">아직 데이터가 없습니다</span>
            </div>
          ) : (
            classRankings.map(r => {
              const m = medal(r.rank_in_school)
              return (
                <div key={r.class_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', marginBottom: 6,
                  background: 'var(--card)', borderRadius: 10,
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ width: 30, textAlign: 'center', fontSize: m ? 20 : 14, fontWeight: 700 }}>
                    {m ?? r.rank_in_school}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700 }}>{r.class_name}</p>
                    {r.grade && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.grade}학년</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: 'var(--primary)' }}>평균 {r.avg_score}점</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.student_count}명</p>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
