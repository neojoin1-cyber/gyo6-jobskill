import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import { demoClassDiagnostics } from '../../lib/teacherDemoAnalytics.js'

/**
 * 학급 진단 현황 — 담당 교사가 학급 학생들의 자가 진단평가 성취도·취약 영역을 확인.
 * rpc_class_diagnostics(class_id) → [{student_id, display_name, score, total, area_scores, created_at}]
 * 교사가 근거를 갖고 모의고사(약한 영역/난이도)를 오픈하도록 지원.
 */
export default function ClassDiagnosticsScreen({ classId, className, onBack, demo = false }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!onBack) return
    const id = pushBack(() => onBack?.())
    return () => popBack(id)
  }, [onBack])

  useEffect(() => {
    if (demo) {
      setErr('')
      setRows(demoClassDiagnostics(classId))
      return
    }
    let alive = true
    supabase.rpc('rpc_class_diagnostics', { p_class_id: classId })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setErr(error.message || '불러오기 실패'); return }
        setRows(Array.isArray(data) ? data : [])
      })
    return () => { alive = false }
  }, [classId, demo])

  const done = (rows || []).filter(r => r.total != null && r.total > 0)
  const avg = done.length ? Math.round(done.reduce((s, r) => s + (r.score / r.total) * 100, 0) / done.length) : null

  // 학급 전체 취약 영역 집계
  const areaAgg = {}
  for (const r of done) {
    const a = r.area_scores || {}
    for (const [name, v] of Object.entries(a)) {
      areaAgg[name] = areaAgg[name] || { total: 0, correct: 0 }
      areaAgg[name].total += v.total || 0
      areaAgg[name].correct += v.correct || 0
    }
  }
  const classWeak = Object.entries(areaAgg)
    .map(([name, v]) => ({ name, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct).slice(0, 3)

  return (
    <div className="screen">
      <div className="appbar">
        {onBack && <button className="appbar-back" onClick={onBack}>←</button>}
        <span className="appbar-title">📊 {className} 진단 현황</span>
      </div>
      <div className="screen-body">
        {err && <div className="card" style={{ color: 'var(--danger)' }}>{err}</div>}
        {rows === null && !err && <div style={{ textAlign: 'center', paddingTop: 40 }}><div className="spinner" /></div>}

        {rows && (
          <>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div><p style={statN}>{rows.length}</p><p style={statL}>학생</p></div>
                <div><p style={statN}>{done.length}</p><p style={statL}>진단 응시</p></div>
                <div><p style={{ ...statN, color: avg == null ? 'var(--text-muted)' : avg >= 60 ? '#059669' : '#D97706' }}>{avg == null ? '—' : avg + '%'}</p><p style={statL}>평균 성취도</p></div>
              </div>
            </div>

            {classWeak.length > 0 && (
              <div className="card" style={{ marginBottom: 14, background: '#FFF7ED', border: '1px solid #FB923C' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#C2410C', marginBottom: 8 }}>🎯 학급 공통 취약 영역 — 모의고사 출제 참고</p>
                {classWeak.map(w => (
                  <div key={w.name} style={{ fontSize: 13.5, color: '#7C2D12', padding: '3px 0' }}>· <b>{w.name}</b> — 평균 {w.pct}%</div>
                ))}
              </div>
            )}

            <p className="section-title">학생별 진단</p>
            {rows.length === 0 && <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>학급에 배정된 학생이 없습니다.</div>}
            {rows.map(r => {
              const pct = r.total ? Math.round((r.score / r.total) * 100) : null
              const weak = Object.entries(r.area_scores || {})
                .map(([n, v]) => ({ n, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
                .filter(x => x.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 3)
              return (
                <div key={r.student_id} className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.display_name || '학생'}</span>
                    {pct == null
                      ? <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>미응시</span>
                      : <span style={{ fontSize: 14, fontWeight: 800, color: pct >= 60 ? '#059669' : '#D97706' }}>{pct}% <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>({r.score}/{r.total})</span></span>}
                  </div>
                  {weak.length > 0 && (
                    <p style={{ fontSize: 12, color: '#B45309', marginTop: 5 }}>취약: {weak.map(w => `${w.n}(${w.pct}%)`).join(' · ')}</p>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

const statN = { fontSize: 24, fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1 }
const statL = { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }
