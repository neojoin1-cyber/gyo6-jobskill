import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { formatDate } from '../../lib/dateUtils.js'

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
      diagRes,
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
      supabase.from('mock_assessments')
        .select('auto_score, total_questions')
        .eq('kind', 'diagnostic'),
    ])
    // 60%는 공식 합격선이 아니라 앱 내부 학습 보완 참고선이다.
    const diag = (diagRes?.data || []).filter(d => d.total_questions > 0)
    const diagCount = diag.length
    const diagAvg = diagCount ? Math.round(diag.reduce((s, d) => s + (d.auto_score / d.total_questions) * 100, 0) / diagCount) : null
    const passRate = diagCount ? Math.round(diag.filter(d => (d.auto_score / d.total_questions) * 100 >= 60).length / diagCount * 100) : null
    setStats({ schoolCount, teacherCount, studentCount, missionCount, submissionCount,
      recentMissions: recentMissions ?? [], diagCount, diagAvg, passRate })
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const { schoolCount, teacherCount, studentCount, missionCount, submissionCount, recentMissions, diagCount, diagAvg, passRate } = stats

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

      <p className="section-title">학습 성과 현황 (진단평가 기반)</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{diagCount ?? 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>진단 응시</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24 }}>🎯</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: diagAvg == null ? 'var(--text-muted)' : diagAvg >= 60 ? '#059669' : '#D97706', marginTop: 4 }}>{diagAvg == null ? '-' : diagAvg + '%'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>평균 성취도</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
          <div style={{ fontSize: 24 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: passRate == null ? 'var(--text-muted)' : passRate >= 50 ? '#059669' : '#D97706', marginTop: 4 }}>{passRate == null ? '-' : passRate + '%'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>학습 참고선 도달</div>
        </div>
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
            {formatDate(m.created_at)}
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
