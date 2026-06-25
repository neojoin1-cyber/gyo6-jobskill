import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function StatsScreen() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [
      { count: schoolCount },
      { count: teacherCount },
      { count: studentCount },
      { count: missionCount },
      { count: submissionCount },
      { data: recentMissions },
    ] = await Promise.all([
      supabase.from('schools').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('missions').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('*', { count: 'exact', head: true }),
      supabase.from('missions')
        .select('id, title, status, created_at, classes(name, schools(name))')
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setStats({ schoolCount, teacherCount, studentCount, missionCount, submissionCount, recentMissions: recentMissions ?? [] })
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const { schoolCount, teacherCount, studentCount, missionCount, submissionCount, recentMissions } = stats

  const cards = [
    { icon: '🏫', label: '학교', value: schoolCount },
    { icon: '👩‍🏫', label: '교사', value: teacherCount },
    { icon: '🧑‍🎓', label: '학생', value: studentCount },
    { icon: '📋', label: '미션', value: missionCount },
    { icon: '✅', label: '제출', value: submissionCount },
    { icon: '📈', label: '참여율', value: missionCount > 0 ? `${Math.round(submissionCount / missionCount)}건/미션` : '-' },
  ]

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <p className="section-title" style={{ paddingTop: 12 }}>전체 현황</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{c.value ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <p className="section-title">최근 미션 (10건)</p>
      {recentMissions.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">📋</span>
          <span className="empty-state-title">미션 없음</span>
        </div>
      )}
      {recentMissions.map(m => (
        <div key={m.id} className="card" style={{ marginBottom: 8 }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {m.classes?.schools?.name ?? '?'} · {m.classes?.name ?? '?'} ·{' '}
            {new Date(m.created_at).toLocaleDateString('ko')}
          </p>
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'draft' ? 'badge-yellow' : 'badge-gray'}`}>
              {m.status === 'active' ? '진행중' : m.status === 'draft' ? '대기' : '마감'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
