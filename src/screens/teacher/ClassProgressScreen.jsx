/**
 * ClassProgressScreen — 학급 학습 진행현황(교사·학급관리자·학교관리자·총괄).
 * rpc_class_progress(class_id) → {
 *   students:[{student_id, display_name, subjects:[{subject_id,pct,sections_done,sections_total,updated_at}], overall}],
 *   subjects:[{subject_id, avg_pct, learner_count}]
 * }
 * 진행율 = 과목 전체 영역/단원을 실제로 풀어 익힌 비율(패시브 열람 제외, 학생 카드와 동일 기준).
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'

const SUBJECT_NAME = {
  'job-common': COMMON_ABILITY_COURSES['job-common'].title,
  'ncs-basic': COMMON_ABILITY_COURSES['ncs-basic'].title,
  'food-service': '식음료서비스',
  'recruit-written': '채용필기 심화·확장', 'quality': '품질경영', 'interview': '고졸 공정채용 면접', 'personality': '인성검사',
}
function pctColor(p) { return p >= 80 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444' }
function Bar({ pct }) {
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct || 0}%`, background: pctColor(pct || 0), borderRadius: 4, transition: 'width .4s' }} />
    </div>
  )
}

export default function ClassProgressScreen({ classId, className, onBack, onMessage }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { const id = pushBack(() => onBack?.()); return () => popBack(id) }, [])
  useEffect(() => {
    supabase.rpc('rpc_class_progress', { p_class_id: classId })
      .then(({ data, error }) => { if (error) setErr(error.message); else setData(data || { students: [], subjects: [] }) })
  }, [classId])

  const students = data?.students || []
  const subjects = data?.subjects || []
  const started = students.filter(s => (s.subjects || []).length > 0)
  const average = started.length ? Math.round(started.reduce((sum, student) => sum + (student.overall ?? 0), 0) / started.length) : 0
  const support = students.filter(student => !(student.subjects || []).length || (student.overall ?? 0) < 40)
  const onTrack = students.filter(student => (student.overall ?? 0) >= 80)
  const orderedStudents = [...students].sort((a, b) => {
    const aStarted = (a.subjects || []).length > 0
    const bStarted = (b.subjects || []).length > 0
    if (aStarted !== bStarted) return aStarted ? -1 : 1
    return (a.overall ?? 0) - (b.overall ?? 0)
  })

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">📈 {className || '학급'} 학습 진행현황</span>
      </div>
      <div className="screen-body">
        {err && <div className="card" style={{ color: '#b91c1c' }}>{err}</div>}
        {!data && !err && <div className="loading-screen"><div className="spinner" /></div>}

        {data && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0 10px', lineHeight: 1.6 }}>
              진행율은 <b>과목 전체 영역·단원을 실제로 풀어 익힌 비율</b>입니다. 교재를 그냥 넘겨보는 것은
              진행으로 집계되지 않아, 실제 학습량을 반영합니다.
            </p>

            <div className="class-progress-summary">
              <div><b>{students.length}</b><span>학급 학생</span></div>
              <div><b>{started.length}</b><span>학습 시작</span></div>
              <div><b>{average}%</b><span>평균 진도</span></div>
              <div className={support.length ? 'is-alert' : ''}><b>{support.length}</b><span>지원 필요</span></div>
              <div className="is-good"><b>{onTrack.length}</b><span>80% 이상</span></div>
            </div>

            <p className="section-title">과목별 학급 평균</p>
            {subjects.length === 0 ? (
              <div className="empty-state"><span className="empty-state-icon">📚</span><span className="empty-state-title">아직 학습 기록이 없습니다</span></div>
            ) : (
              <div className="card">
                {subjects.map((s, i) => (
                  <div key={i} style={{ margin: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{SUBJECT_NAME[s.subject_id] || s.subject_id}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · {s.learner_count}명 학습</span></span>
                      <span style={{ color: pctColor(s.avg_pct), fontWeight: 800 }}>{s.avg_pct}%</span>
                    </div>
                    <Bar pct={s.avg_pct} />
                  </div>
                ))}
              </div>
            )}

            <p className="section-title">학생별 진행율</p>
            {students.length === 0 ? (
              <div className="empty-state"><span className="empty-state-icon">🧑‍🎓</span><span className="empty-state-title">학습을 시작한 학생이 없습니다</span></div>
            ) : orderedStudents.map(st => {
              const hasProgress = (st.subjects || []).length > 0
              const needsSupport = !hasProgress || (st.overall ?? 0) < 40
              return (
              <div key={st.student_id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{st.display_name || '학생'}</p>
                    <span className={`progress-student-status ${needsSupport ? 'is-alert' : 'is-good'}`}>
                      {hasProgress ? needsSupport ? '진도 지원 필요' : '계획대로 학습 중' : '아직 시작하지 않음'}
                    </span>
                  </div>
                  <div className="progress-student-actions">
                    <span style={{ fontSize: 12, fontWeight: 800, color: pctColor(st.overall) }}>종합 {st.overall ?? 0}%</span>
                    {onMessage && <button type="button" onClick={() => onMessage(st)}>메시지</button>}
                  </div>
                </div>
                {(st.subjects || []).map((sub, j) => (
                  <div key={j} style={{ margin: '6px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{SUBJECT_NAME[sub.subject_id] || sub.subject_id}
                        {sub.sections_total ? <span> · {sub.sections_done}/{sub.sections_total}</span> : null}</span>
                      <span style={{ color: pctColor(sub.pct), fontWeight: 700 }}>{sub.pct}%</span>
                    </div>
                    <Bar pct={sub.pct} />
                  </div>
                ))}
                {!hasProgress && <p className="progress-not-started">첫 학습을 시작하면 과목별 진도가 여기에 표시됩니다.</p>}
              </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
