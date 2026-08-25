/**
 * ClassWeaknessScreen — 학급 약점 현황(교사·학급관리자·학교관리자·총괄).
 * rpc_class_weakness(class_id) → { areas:[{course_id,area,wrong_count,student_count}], students:[{student_id,display_name,open_count,top_area}] }
 * 학생들의 부족한 부분(미해결 오답)을 영역별·학생별로 파악.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { pushBack, popBack } from '../../lib/backButton.js'

const COURSE_NAME = { 1: '직업공통능력', 4: '면접', 5: '인성검사' }

export default function ClassWeaknessScreen({ classId, className, onBack }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { const id = pushBack(() => onBack?.()); return () => popBack(id) }, [])
  useEffect(() => {
    supabase.rpc('rpc_class_weakness', { p_class_id: classId })
      .then(({ data, error }) => { if (error) setErr(error.message); else setData(data || { areas: [], students: [] }) })
  }, [classId])

  const areas = (data?.areas || []).filter(area => ![2, 3].includes(Number(area.course_id)))
  const students = data?.students || []
  const maxWrong = Math.max(1, ...areas.map(a => a.wrong_count || 0))
  const withOpen = students.filter(s => (s.open_count || 0) > 0)

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">📉 {className || '학급'} 약점 현황</span>
      </div>
      <div className="screen-body">
        {err && <div className="card" style={{ color: '#b91c1c' }}>{err}</div>}
        {!data && !err && <div className="loading-screen"><div className="spinner" /></div>}

        {data && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0 10px', lineHeight: 1.6 }}>
              학생들의 <b>미해결 오답</b>을 영역·학생별로 집계했습니다. 오답이 많은 영역을 함께 지도하세요.
            </p>

            <p className="section-title">영역별 약점 (오답 많은 순)</p>
            {areas.length === 0 ? (
              <div className="empty-state"><span className="empty-state-icon">✅</span><span className="empty-state-title">쌓인 오답이 없습니다</span></div>
            ) : (
              <div className="card">
                {areas.slice(0, 12).map((a, i) => (
                  <div key={i} style={{ margin: '9px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{a.area} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {COURSE_NAME[a.course_id] || '기타'}</span></span>
                      <span style={{ color: '#dc2626', fontWeight: 800 }}>{a.wrong_count}건 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {a.student_count}명</span></span>
                    </div>
                    <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(a.wrong_count / maxWrong) * 100}%`, background: '#f87171', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="section-title">학생별 (미해결 오답 많은 순)</p>
            {withOpen.length === 0 ? (
              <div className="empty-state"><span className="empty-state-icon">👍</span><span className="empty-state-title">미해결 오답이 있는 학생이 없습니다</span></div>
            ) : withOpen.map(s => (
              <div key={s.student_id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{s.display_name || '학생'}</p>
                  {s.top_area && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>가장 약한 영역: <b>{s.top_area}</b></p>}
                </div>
                <span className="badge badge-red">오답 {s.open_count}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
