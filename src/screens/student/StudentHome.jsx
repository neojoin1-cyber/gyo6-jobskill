import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { ThemeToggle } from '../../lib/theme.jsx'

const MISSION_STATUS_COLOR = { active: 'badge-green', closed: 'badge-gray', draft: 'badge-yellow' }
const MISSION_STATUS_LABEL = { active: '진행중', closed: '마감', draft: '대기' }

export default function StudentHome({ profile, onOpenMission, onLogout }) {
  const [missions,     setMissions]     = useState([])
  const [submissions,  setSubmissions]  = useState({})
  const [streak,       setStreak]       = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sc }, { data: streakData }] = await Promise.all([
      supabase.from('student_classes').select('class_id'),
      supabase.from('user_streaks').select('*').eq('user_id', profile.id).maybeSingle(),
    ])
    setStreak(streakData)

    const classIds = (sc ?? []).map(r => r.class_id)
    if (classIds.length === 0) { setLoading(false); return }

    const { data: ms } = await supabase
      .from('missions')
      .select('id, title, mission_type, status, question_count, time_limit_min, due_at, class_id, question_ids, area_ids, shuffle, classes(name)')
      .in('class_id', classIds)
      .in('status', ['active', 'closed'])
      .order('created_at', { ascending: false })

    setMissions(ms ?? [])

    if (ms?.length) {
      const { data: subs } = await supabase
        .from('submissions')
        .select('mission_id, score, total_questions, completed_at, grading_status')
        .eq('student_id', profile.id)
        .in('mission_id', ms.map(m => m.id))
      const subMap = {}
      for (const s of subs ?? []) subMap[s.mission_id] = s
      setSubmissions(subMap)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const pending = missions.filter(m => m.status === 'active' && !submissions[m.id])
  const done    = missions.filter(m => submissions[m.id])
  const closed  = missions.filter(m => m.status === 'closed' && !submissions[m.id])

  const todayActive = streak?.last_active_date === new Date().toISOString().slice(0, 10)

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">👋 {profile.display_name}</span>
        <ThemeToggle />
        <button className="appbar-back" onClick={onLogout} style={{ fontSize: 13 }}>로그아웃</button>
      </div>

      <div className="screen-body">

        {/* ── 스트릭 배너 ── */}
        {streak && (
          <div style={{
            background: todayActive
              ? 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)'
              : 'linear-gradient(135deg, var(--primary) 0%, #818CF8 100%)',
            borderRadius: 16, padding: '16px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
            color: '#fff',
          }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>
              {streak.current_streak >= 7 ? '🔥' : streak.current_streak >= 3 ? '⚡' : '✨'}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                {streak.current_streak}일 연속
                {todayActive && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8, opacity: 0.85 }}>오늘 완료!</span>}
              </p>
              <p style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                최장 {streak.longest_streak}일 · 총 {streak.total_days}일 학습
              </p>
            </div>
            {!todayActive && (
              <div style={{ textAlign: 'right', opacity: 0.9 }}>
                <p style={{ fontSize: 11 }}>오늘 학습하면</p>
                <p style={{ fontSize: 12, fontWeight: 700 }}>{streak.current_streak + 1}일로 ↑</p>
              </div>
            )}
          </div>
        )}

        {/* ── 미션 목록 ── */}
        {missions.length === 0 && !streak && (
          <div className="empty-state">
            <span className="empty-state-icon">📚</span>
            <span className="empty-state-title">아직 미션이 없습니다</span>
            <span>선생님이 미션을 배정하면 여기에 표시됩니다.</span>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <p className="section-title">🔥 진행 중인 미션</p>
            {pending.map(m => <MissionCard key={m.id} mission={m} sub={null} onStart={() => onOpenMission(m)} />)}
          </>
        )}

        {done.length > 0 && (
          <>
            <p className="section-title">✅ 완료한 미션</p>
            {done.map(m => <MissionCard key={m.id} mission={m} sub={submissions[m.id]} onStart={null} />)}
          </>
        )}

        {closed.length > 0 && (
          <>
            <p className="section-title">🔒 마감된 미션 (미응시)</p>
            {closed.map(m => <MissionCard key={m.id} mission={m} sub={null} onStart={null} />)}
          </>
        )}
      </div>
    </div>
  )
}

function MissionCard({ mission, sub, onStart }) {
  const isPending = mission.status === 'active' && !sub
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>{mission.title}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${MISSION_STATUS_COLOR[mission.status]}`}>
              {sub?.grading_status === 'pending' ? '채점 대기' : sub ? '완료' : MISSION_STATUS_LABEL[mission.status]}
            </span>
            <span className="badge badge-blue">{mission.mission_type}</span>
            {mission.classes && <span className="badge badge-gray">{mission.classes.name}</span>}
          </div>
        </div>
        {sub && sub.grading_status === 'pending' ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e65100' }}>채점 대기</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>선택형 {sub.score}/{sub.total_questions}</p>
          </div>
        ) : sub ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
              {Math.round(sub.score / sub.total_questions * 100)}%
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.score}/{sub.total_questions}</p>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: isPending ? 12 : 0 }}>
        <span>{mission.question_count}문항{mission.time_limit_min ? ` · ${mission.time_limit_min}분` : ''}</span>
        {mission.due_at && <span>마감: {new Date(mission.due_at).toLocaleDateString('ko')}</span>}
      </div>
      {isPending && (
        <button className="btn btn-primary btn-full" onClick={onStart}>
          미션 시작 →
        </button>
      )}
    </div>
  )
}
