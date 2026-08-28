/**
 * ClassPersonalityScreen — 학급 인성검사 경향 (담당 교사).
 * rpc_class_personality(class_id) → [{student_id, display_name, mode, paper_no, profile, reliability, created_at}]
 * 정답 없는 검사이므로 '점수'가 아니라 학급의 6요인 평균 경향 + 응답 신뢰도 도달률을 보여준다.
 */
import { useState, useEffect } from 'react'
import { pushBack, popBack } from '../../lib/backButton.js'
import { loadClassPersonality, aggregateClassPersonality } from '../../lib/personalityResults.js'
import { demoClassPersonality } from '../../lib/teacherDemoAnalytics.js'

const band = (v) => v >= 66 ? 'high' : v >= 40 ? 'mid' : 'low'
const bandColor = { high: '#22c55e', mid: '#6366f1', low: '#f59e0b' }

export default function ClassPersonalityScreen({ classId, className, onBack, demo = false }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!onBack) return
    const id = pushBack(onBack)
    return () => popBack(id)
  }, [onBack])

  useEffect(() => {
    if (demo) {
      setErr('')
      setRows(demoClassPersonality(classId))
      return
    }
    let alive = true
    loadClassPersonality(classId)
      .then(data => { if (alive) setRows(data) })
      .catch(e => { if (alive) setErr(e.message || '불러오기 실패') })
    return () => { alive = false }
  }, [classId, demo])

  const agg = rows ? aggregateClassPersonality(rows) : null
  const done = (rows || []).filter(r => Array.isArray(r.profile) && r.profile.length > 0)

  return (
    <div className="screen">
      <div className="appbar">
        {onBack && <button className="appbar-back" onClick={onBack}>←</button>}
        <span className="appbar-title">🧭 {className} 인성검사 경향</span>
      </div>
      <div className="screen-body">
        {err && <div className="card" style={{ color: '#b91c1c' }}>{err}</div>}
        {!rows && !err && <div className="loading-screen"><div className="spinner" /></div>}

        {agg && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <Stat icon="👥" label="학급 인원" value={agg.totalStudents} />
              <Stat icon="✍️" label="응시 인원" value={agg.doneCount} />
              <Stat icon="✅" label="신뢰도 양호" value={agg.reliableRate == null ? '-' : agg.reliableRate + '%'}
                color={agg.reliableRate == null ? undefined : agg.reliableRate >= 60 ? '#059669' : '#D97706'} />
            </div>

            {agg.doneCount === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🧭</span>
                <span className="empty-state-title">아직 응시한 학생이 없습니다</span>
                <span>학생이 인성검사(진단·모의)를 응시하면 학급 경향이 표시됩니다.</span>
              </div>
            ) : (
              <>
                <p className="section-title">학급 6요인 평균 경향</p>
                <div className="card">
                  {agg.dims.map(d => (
                    <div key={d.key} style={{ margin: '11px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        <span>{d.name}</span><span style={{ color: bandColor[band(d.avg)], fontWeight: 800 }}>{d.avg}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${d.avg}%`, background: bandColor[band(d.avg)], borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                    ※ 인성검사는 정답이 없습니다. 낮은 요인은 '부족'이 아니라 <b>지도·상담 참고</b>로 활용하세요.
                    특히 <b>신뢰도(일관·솔직)</b>가 낮은 학생은 응답 태도 지도가 필요합니다.
                  </p>
                </div>

                <p className="section-title">학생별 응답 신뢰도</p>
                {done.map(r => {
                  const rel = r.reliability || {}
                  return (
                    <div key={r.student_id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{r.display_name || '학생'}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {r.mode === 'full' ? '실전 모의' : '간이 진단'}{r.paper_no ? ` · ${r.paper_no}회` : ''} · 일관성 {rel.consistency ?? '-'} · 솔직성 {rel.social ?? '-'}
                        </p>
                      </div>
                      <span className={`badge ${rel.reliable ? 'badge-green' : 'badge-yellow'}`}>
                        {rel.reliable ? '신뢰 양호' : '태도 지도'}
                      </span>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color || 'var(--primary)', marginTop: 4 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
