import { useState, useEffect } from 'react'
import { filterActiveSubjects } from '../../lib/subjectCatalog.js'
import { supabase } from '../../lib/supabase.js'
import { getLevelInfo } from '../../lib/xp.js'

const MEDAL = ['🥇', '🥈', '🥉']

export default function RankingScreen() {
  const [tab,       setTab]       = useState('weekly')   // 'weekly' | 'mission'
  const [subjects,  setSubjects]  = useState([])
  const [subjectId, setSubjectId] = useState(null)
  const [rank,      setRank]      = useState(null)
  const [weekly,    setWeekly]    = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { loadSubjects() }, [])
  useEffect(() => { if (tab === 'mission') loadRank(); else loadWeekly() }, [tab, subjectId])

  async function loadSubjects() {
    const { data: rawSubjects } = await supabase.from('subjects').select('id, name').order('name')
    const data = filterActiveSubjects(rawSubjects)
    setSubjects(data ?? [])
  }

  async function loadWeekly() {
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_class_weekly_rank')
    setWeekly(error ? null : data)
    setLoading(false)
  }

  async function loadRank() {
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_my_rank', { p_subject_id: subjectId })
    setRank(error ? null : data)
    setLoading(false)
  }

  const RankCard = ({ label, rank, total, color = 'var(--primary)' }) => (
    <div className="card" style={{ flex: 1, textAlign: 'center', padding: '20px 12px', borderTop: `4px solid ${color}` }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</p>
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
        <span className="appbar-title">🏆 랭킹</span>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[
          { id: 'weekly',  label: '주간 우리 반 🔥' },
          { id: 'mission', label: '미션 점수 📊' },
        ].map(t => (
          <button key={t.id}
            style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 13, fontWeight: tab === t.id ? 800 : 500,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 미션 탭 과목 필터 */}
      {tab === 'mission' && (
        <div style={{
          display: 'flex', gap: 6, padding: '10px 16px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)', flexShrink: 0,
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
      )}

      <div className="screen-body">
        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : tab === 'weekly' ? (
          <WeeklyLeaderboard data={weekly} />
        ) : (
          <MissionRankView rank={rank} subjects={subjects} subjectId={subjectId} RankCard={RankCard} />
        )}
      </div>
    </div>
  )
}

// ── 주간 학급 리더보드 ────────────────────────────────────────────────────
function WeeklyLeaderboard({ data }) {
  if (!data || data.length === 0) return (
    <div className="empty-state">
      <span className="empty-state-icon">🔥</span>
      <span className="empty-state-title">이번 주 아직 기록이 없습니다</span>
      <span>학습하면 주간 XP 랭킹에 표시됩니다.</span>
    </div>
  )

  const me = data.find(r => r.is_me)

  return (
    <>
      {/* 내 이번 주 XP */}
      {me && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--primary-light)', border: '1.5px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 40 }}>{MEDAL[me.rank_pos - 1] ?? '👤'}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>
                {me.display_name} (나) — {me.rank_pos}위
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>이번 주 {(me.weekly_xp ?? 0).toLocaleString()} XP</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>레벨</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: getLevelInfo(me.weekly_xp ?? 0).color }}>
                {getLevelInfo(me.weekly_xp).icon}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="section-title">이번 주 우리 반 TOP 10</p>
      {data.map((r) => (
        <div key={r.student_id}
          className="card"
          style={{
            marginBottom: 8, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            background: r.is_me ? 'var(--primary-light)' : 'var(--card)',
            border: r.is_me ? '1.5px solid var(--primary)' : '1px solid var(--border)',
          }}>
          <span style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>
            {MEDAL[r.rank_pos - 1] ?? `${r.rank_pos}`}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: r.is_me ? 800 : 600, fontSize: 14,
              color: r.is_me ? 'var(--primary)' : 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.display_name}{r.is_me ? ' (나)' : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: (r.weekly_xp ?? 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
              {(r.weekly_xp ?? 0).toLocaleString()}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>XP</p>
          </div>
        </div>
      ))}

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
        주간 XP는 매주 월요일 자동 초기화됩니다
      </p>
    </>
  )
}

// ── 미션 점수 랭킹 뷰 ────────────────────────────────────────────────────
function MissionRankView({ rank, subjects, subjectId, RankCard }) {
  if (!rank || rank.error) return (
    <div className="empty-state">
      <span className="empty-state-icon">📊</span>
      <span className="empty-state-title">아직 순위 데이터가 없습니다</span>
      <span>미션을 완료하면 순위가 집계됩니다.</span>
    </div>
  )
  return (
    <>
      <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16, background: 'var(--primary-light)', border: '1.5px solid var(--primary)' }}>
        <p style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>
          {subjectId ? subjects.find(s => s.id === subjectId)?.name : '전체 과목'} 누적 점수
        </p>
        <p style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{rank.my_score}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>점</p>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <RankCard label="학급 순위" rank={rank.class_rank} total={rank.class_total} color="var(--primary)" />
        <RankCard label="학교 순위" rank={rank.school_rank} total={rank.school_total} color="#f59e0b" />
        <RankCard label="전국 순위" rank={rank.national_opt_in ? rank.national_rank : null} total={rank.national_total} color="#ef4444" />
      </div>
      {!rank.national_opt_in && (
        <div className="card" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            🔒 소속 학교가 전국 랭킹에 미참여 중입니다.<br />
            학교관리자에게 전국 랭킹 참여를 요청하세요.
          </p>
        </div>
      )}
      <div className="card" style={{ marginTop: 8, background: 'transparent', border: 'none', padding: '0 4px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          다른 학생의 순위는 표시되지 않습니다.<br />
          전국 랭킹은 닉네임만 사용 · 실명 비공개
        </p>
      </div>
    </>
  )
}
