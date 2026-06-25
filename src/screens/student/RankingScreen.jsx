import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function RankingScreen() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(null)  // null = 전체
  const [rank, setRank] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    loadRank()
  }, [subjectId])

  async function loadSubjects() {
    const { data } = await supabase.from('subjects').select('id, name').order('name')
    setSubjects(data ?? [])
  }

  async function loadRank() {
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_my_rank', {
      p_subject_id: subjectId,
    })
    setRank(error ? null : data)
    setLoading(false)
  }

  const RankCard = ({ label, rank, total, color = 'var(--primary)' }) => (
    <div className="card" style={{
      flex: 1, textAlign: 'center', padding: '20px 12px',
      borderTop: `4px solid ${color}`,
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</p>
      {rank != null ? (
        <>
          <p style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{rank}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>/ {total}명</p>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>미참여</p>
      )}
    </div>
  )

  return (
    <div className="screen">
      <div className="appbar" style={{ justifyContent: 'space-between' }}>
        <span className="appbar-title">🏆 내 순위</span>
      </div>

      {/* 과목 필터 */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        overflowX: 'auto', borderBottom: '1px solid var(--border)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
            background: subjectId === null ? 'var(--primary)' : 'transparent',
            color: subjectId === null ? '#fff' : 'var(--text-muted)',
            borderColor: subjectId === null ? 'var(--primary)' : 'var(--border)',
          }}
          onClick={() => setSubjectId(null)}>
          전체
        </button>
        {subjects.map(s => (
          <button key={s.id}
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

      <div className="screen-body">
        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : !rank || rank.error ? (
          <div className="empty-state">
            <span className="empty-state-icon">📊</span>
            <span className="empty-state-title">아직 순위 데이터가 없습니다</span>
            <span>미션을 완료하면 순위가 집계됩니다.</span>
          </div>
        ) : (
          <>
            {/* 내 총점 */}
            <div className="card" style={{
              textAlign: 'center', padding: '24px 16px', marginBottom: 16,
              background: 'var(--primary-light)', border: '1.5px solid var(--primary)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>
                {subjectId ? subjects.find(s => s.id === subjectId)?.name : '전체 과목'} 누적 점수
              </p>
              <p style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
                {rank.my_score}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>점</p>
            </div>

            {/* 순위 3개 카드 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <RankCard
                label="학급 순위"
                rank={rank.class_rank}
                total={rank.class_total}
                color="var(--primary)"
              />
              <RankCard
                label="학교 순위"
                rank={rank.school_rank}
                total={rank.school_total}
                color="#f59e0b"
              />
              <RankCard
                label="전국 순위"
                rank={rank.national_opt_in ? rank.national_rank : null}
                total={rank.national_total}
                color="#ef4444"
              />
            </div>

            {/* 전국 랭킹 미참여 안내 */}
            {!rank.national_opt_in && (
              <div className="card" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  🔒 소속 학교가 전국 랭킹에 미참여 중입니다.<br />
                  학교관리자에게 전국 랭킹 참여를 요청하세요.
                </p>
              </div>
            )}

            {/* 개인정보 안내 */}
            <div className="card" style={{ marginTop: 8, background: 'transparent', border: 'none', padding: '0 4px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                다른 학생의 순위는 표시되지 않습니다.<br />
                전국 랭킹은 닉네임만 사용 · 실명 비공개
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
