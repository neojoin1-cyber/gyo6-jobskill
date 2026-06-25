import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function TeacherRankingScreen() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(null)
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInit()
  }, [])

  useEffect(() => {
    if (selectedClass) loadRankData()
  }, [selectedClass, subjectId])

  async function loadInit() {
    const [{ data: tc }, { data: subs }] = await Promise.all([
      supabase.from('teacher_classes').select('class_id, classes(id, name, grade)'),
      supabase.from('subjects').select('id, name'),
    ])
    const cls = (tc ?? []).map(r => r.classes)
    setClasses(cls)
    setSubjects(subs ?? [])
    if (cls.length > 0) setSelectedClass(cls[0].id)
  }

  async function loadRankData() {
    setLoading(true)
    const [lb, pos] = await Promise.all([
      supabase.rpc('rpc_class_leaderboard', { p_class_id: selectedClass, p_subject_id: subjectId }),
      supabase.rpc('rpc_class_position',    { p_class_id: selectedClass, p_subject_id: subjectId }),
    ])
    setLeaderboard(lb.data ?? [])
    setPosition(pos.data)
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

      {/* 학급 선택 탭 */}
      {classes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {classes.map(c => (
            <button key={c.id}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 13,
                whiteSpace: 'nowrap', cursor: 'pointer', fontWeight: 700,
                background: selectedClass === c.id ? 'var(--primary)' : 'var(--card)',
                color: selectedClass === c.id ? '#fff' : 'var(--text)',
                borderColor: selectedClass === c.id ? 'var(--primary)' : 'var(--border)',
              }}
              onClick={() => setSelectedClass(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🏫</span>
          <span className="empty-state-title">담당 학급이 없습니다</span>
        </div>
      ) : loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {/* 학급 위치 카드 */}
          {position && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderTop: '3px solid #f59e0b' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>학급평균</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{position.class_avg}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>점</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderTop: '3px solid var(--primary)' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>학교 학급순위</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>
                  {position.school_rank ?? '-'}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {position.school_total}학급</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderTop: '3px solid #ef4444' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>전국 학급순위</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#ef4444' }}>
                  {position.national_opt_in ? (position.national_rank ?? '-') : '미참여'}
                </p>
                {position.national_opt_in && (
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {position.national_total}학급</p>
                )}
              </div>
            </div>
          )}

          {/* 학급 학생 순위 */}
          <p className="section-title">학급 학생 순위</p>
          {!leaderboard || leaderboard.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📊</span>
              <span className="empty-state-title">아직 제출 데이터가 없습니다</span>
            </div>
          ) : (
            leaderboard.map(r => {
              const m = medal(r.rank_in_class)
              return (
                <div key={r.student_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', marginBottom: 6,
                  background: 'var(--card)', borderRadius: 10,
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ width: 30, textAlign: 'center', fontSize: m ? 20 : 14, fontWeight: 700 }}>
                    {m ?? r.rank_in_class}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{r.display_name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.total_score}점</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                      {r.missions_done}개 완료
                    </span>
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
