import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function ClassResultsScreen({ classId, className, onBack }) {
  const [missions, setMissions] = useState([])
  const [selectedMission, setSelectedMission] = useState(null)
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMissions()
  }, [])

  async function loadMissions() {
    const { data } = await supabase
      .from('missions')
      .select('id, title, mission_type, status, question_count')
      .eq('class_id', classId)
      .in('status', ['active', 'closed'])
      .order('created_at', { ascending: false })
    setMissions(data ?? [])
    if (data?.length > 0) selectMission(data[0])
    else setLoading(false)
  }

  async function selectMission(mission) {
    setSelectedMission(mission)
    setLoading(true)
    const { data } = await supabase
      .from('class_rankings')
      .select('*')
      .eq('class_id', classId)
      .eq('mission_id', mission.id)
      .order('rank_in_mission', { ascending: true })
    setRankings(data ?? [])
    setLoading(false)
  }

  const medalIcon = rank => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">{className} — 결과</span>
      </div>

      <div className="screen-body">
        {missions.length === 0 && !loading ? (
          <div className="empty-state">
            <span className="empty-state-icon">📋</span>
            <span className="empty-state-title">완료된 미션이 없습니다</span>
          </div>
        ) : (
          <>
            {/* 미션 선택 */}
            <p className="section-title">미션 선택</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              {missions.map(m => (
                <button key={m.id}
                  className={`btn ${selectedMission?.id === m.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => selectMission(m)}>
                  {m.title}
                </button>
              ))}
            </div>

            {/* 랭킹 */}
            <p className="section-title">미션 랭킹</p>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
            ) : rankings.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">😶</span>
                <span className="empty-state-title">아직 제출한 학생이 없습니다</span>
              </div>
            ) : (
              rankings.map(r => (
                <div key={r.student_id} className="list-item" style={{ cursor: 'default' }}>
                  <div style={{ width: 36, textAlign: 'center', fontSize: r.rank_in_mission <= 3 ? 22 : 15, fontWeight: 700, flexShrink: 0 }}>
                    {medalIcon(r.rank_in_mission)}
                  </div>
                  <div className="list-item-body">
                    <p className="list-item-title">{r.display_name}</p>
                    <p className="list-item-sub">
                      {r.score}/{r.total_questions}문항 정답
                      {r.time_taken_sec ? ` · ${Math.floor(r.time_taken_sec/60)}분${r.time_taken_sec%60}초` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>{r.pct}%</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>학급 종합 {r.rank_in_class}위</p>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
