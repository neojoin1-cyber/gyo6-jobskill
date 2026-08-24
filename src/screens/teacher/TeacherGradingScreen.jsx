/**
 * 교사 채점 화면 v2 — 문항별 일괄 채점
 *
 * 흐름:
 *   1. 문항 목록: 채점 대기 중인 문항들, 각 카드에 모범답안 미리보기 + 대기 인원
 *   2. 문항 상세: 모범답안 고정 + 전체 학생 답안 리스트 → O/X 채점
 *   3. 특정 제출물의 모든 문항이 채점 완료되면 자동 저장 (rpc_grade_submission 호출)
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { getPassSpec } from '../../lib/passExam.js'
import jobQuestions         from '../../../data/questions.json'
import { ncs2026Questions as ncsQuestions } from '../../lib/ncs2026.js'
import { recruitWrittenQuestions } from '../../lib/recruitWritten.js'
import foodServiceQuestions from '../../lib/foodServiceBank.js'

const QUESTION_POOLS = {
  'job-common':   jobQuestions,
  'ncs-basic':    ncsQuestions,
  'recruit-written': recruitWrittenQuestions,
  'food-service': foodServiceQuestions,
}

function getQuestion(subjectId, qId) {
  const pool = QUESTION_POOLS[subjectId ?? 'job-common'] ?? jobQuestions
  return pool.find(q => q.id === qId) ?? null
}

export default function TeacherGradingScreen({ onBack }) {
  const [pending,      setPending]      = useState([])   // 채점 대기 submission 목록
  const [loading,      setLoading]      = useState(true)
  const [grades,       setGrades]       = useState({})   // { submissionId: { qId: 'O'|'X' } }
  const [saving,       setSaving]       = useState({})   // { submissionId: true } 저장 중 표시
  const [saved,        setSaved]        = useState({})   // { submissionId: true } 저장 완료 표시
  const [selected,     setSelected]     = useState(null) // 현재 채점 중인 qId
  const [passResults,  setPassResults]  = useState([])   // 합격 판정 이력
  const [showPassHist, setShowPassHist] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: subs }, { data: mocks }, { data: tc }] = await Promise.all([
      supabase
        .from('submissions')
        .select(`
          id, typed_answers, score, total_questions, completed_at,
          student:profiles!submissions_student_id_fkey(id, display_name),
          mission:missions!submissions_mission_id_fkey(
            id, title, subject_id, class_id,
            class:classes!missions_class_id_fkey(name)
          )
        `)
        .eq('grading_status', 'pending')
        .order('completed_at', { ascending: true }),
      supabase
        .from('mock_assessments')
        .select('id, typed_answers, subject_id, class_id, title, created_at, student:profiles!mock_assessments_student_id_fkey(display_name), classes(name)')
        .eq('grading_status', 'pending')
        .order('created_at', { ascending: true }),
      supabase.from('teacher_classes').select('class_id'),
    ])

    const myClassIds = new Set((tc ?? []).map(r => r.class_id))

    const subMine = (subs ?? [])
      .filter(r => myClassIds.has(r.mission?.class_id))
      .map(r => ({ ...r, source: 'mission' }))

    // 모의평가를 submission과 동일 형태로 정규화
    const mockMine = (mocks ?? [])
      .filter(r => myClassIds.has(r.class_id))
      .map(r => ({
        id: r.id,
        typed_answers: r.typed_answers,
        source: 'mock',
        student: r.student,
        mission: {
          subject_id: r.subject_id,
          class_id:   r.class_id,
          title:      `🧪 ${r.title}`,
          class:      r.classes,
        },
      }))

    setPending([...subMine, ...mockMine])

    // 합격 판정 이력 — RLS가 소속 학생만 반환
    // student_id FK가 auth.users를 참조하므로 profiles 조인을 별도 쿼리로 처리
    const { data: passRaw } = await supabase
      .from('pass_exam_results')
      .select('id, student_id, subject_id, paper_no, passed_count, verdict, weak_units, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (passRaw?.length) {
      const sids = [...new Set(passRaw.map(r => r.student_id))]
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', sids)
      const profMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]))
      setPassResults(passRaw.map(r => ({ ...r, student: profMap[r.student_id] ?? null })))
    } else {
      setPassResults([])
    }

    setLoading(false)
  }

  // ── 문항별 그룹화 ────────────────────────────────────────────────────────
  // { qId → { subjectId, question, answers: [{ submissionId, studentName, typedText, className, missionTitle, allQIds }] } }
  const questionMap = useMemo(() => {
    const map = {}
    for (const sub of pending) {
      const subjectId = sub.mission?.subject_id ?? 'job-common'
      const allQIds   = Object.keys(sub.typed_answers ?? {})
      for (const [qId, typedText] of Object.entries(sub.typed_answers ?? {})) {
        if (!map[qId]) {
          map[qId] = {
            subjectId,
            question: getQuestion(subjectId, qId),
            qId,
            answers: [],
          }
        }
        map[qId].answers.push({
          submissionId:  sub.id,
          source:        sub.source ?? 'mission',
          studentName:   sub.student?.display_name ?? '학생',
          typedText,
          className:     sub.mission?.class?.name ?? '',
          missionTitle:  sub.mission?.title ?? '',
          allQIds,
        })
      }
    }
    return map
  }, [pending])

  // 채점 완료로 해당 문항이 questionMap에서 사라지면 목록으로 자동 복귀
  useEffect(() => {
    if (selected && !questionMap[selected]) setSelected(null)
  }, [selected, questionMap])

  // ── 채점 기록 + 자동 저장 ─────────────────────────────────────────────────
  function markGrade(submissionId, qId, grade, allQIds, source) {
    const prevSub   = grades[submissionId] ?? {}
    const newSub    = { ...prevSub, [qId]: grade }
    const newGrades = { ...grades, [submissionId]: newSub }
    setGrades(newGrades)

    // 해당 제출물의 모든 문항 채점 완료 → 자동 저장
    if (allQIds.every(q => newSub[q])) {
      autoSave(submissionId, newSub, source)
    }
  }

  async function autoSave(submissionId, subGrades, source) {
    setSaving(prev => ({ ...prev, [submissionId]: true }))
    const { error } = source === 'mock'
      ? await supabase.rpc('rpc_grade_mock_assessment', { p_mock_id: submissionId, p_grades: subGrades })
      : await supabase.rpc('rpc_grade_submission', { p_submission_id: submissionId, p_grades: subGrades })
    setSaving(prev => ({ ...prev, [submissionId]: false }))
    if (!error) {
      setSaved(prev => ({ ...prev, [submissionId]: true }))
      // 저장된 제출물은 pending에서 제거
      setPending(prev => prev.filter(s => s.id !== submissionId))
    }
  }

  // 문항별 채점 진행률
  function progress(qId) {
    const ans    = questionMap[qId]?.answers ?? []
    const graded = ans.filter(a => grades[a.submissionId]?.[qId]).length
    return { graded, total: ans.length }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // ── 문항별 채점 상세 ────────────────────────────────────────────────────
  if (selected) {
    const entry = questionMap[selected]
    if (!entry) return null  // useEffect가 selected를 null로 초기화함
    const q = entry.question
    const { graded, total } = progress(selected)

    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => setSelected(null)}>←</button>
          <span className="appbar-title" style={{ fontSize: 14 }}>문항별 채점</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: graded === total ? 'var(--success)' : 'var(--primary)',
          }}>
            {graded}/{total}명
          </span>
        </div>

        {/* ── 모범답안 고정 패널 (스크롤 영역 밖) ── */}
        <div style={{
          flexShrink: 0,
          background: 'var(--primary-light)',
          borderBottom: '2px solid var(--primary)',
          padding: '12px 16px',
          zIndex: 10,
          maxHeight: '42vh',         /* 너무 긴 답안도 화면 절반 이하로 제한 */
          overflowY: 'auto',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, letterSpacing: 0.5 }}>
            문제
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
            {q?.stem ?? selected}
          </p>
          <div style={{ height: 1, background: 'var(--primary)', opacity: 0.2, marginBottom: 10 }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: '#c62828', marginBottom: 6, letterSpacing: 0.5 }}>
            모범답안
          </p>
          <p style={{
            fontSize: 15, fontWeight: 800, lineHeight: 1.75,
            whiteSpace: 'pre-wrap', color: '#17212b',
            background: '#fff', borderRadius: 8, padding: '10px 12px',
            border: '1px solid var(--primary)',
            marginBottom: q?.explanation ? 8 : 0,
          }}>
            {q?.modelAnswer ?? q?.answer ?? '(모범답안 없음)'}
          </p>
          {q?.explanation && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              💡 {q.explanation}
            </p>
          )}
        </div>

        {/* ── 학생 답안 목록 (스크롤) ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
          <p className="section-title" style={{ marginTop: 0 }}>학생 답안 ({total}명)</p>

          {entry.answers.map(({ submissionId, source, studentName, typedText, className, allQIds }) => {
            const grade     = grades[submissionId]?.[selected]
            const isSaving  = saving[submissionId]
            const isSaved   = saved[submissionId]
            const subGrades = grades[submissionId] ?? {}
            const doneCount = allQIds.filter(q => subGrades[q]).length

            return (
              <div key={submissionId} className="card" style={{
                marginBottom: 12,
                borderLeft: `4px solid ${
                  isSaved   ? 'var(--success)' :
                  grade === 'O' ? 'var(--success)' :
                  grade === 'X' ? 'var(--danger)'  : 'var(--border)'
                }`,
                opacity: isSaving ? 0.65 : 1,
                transition: 'border-color 0.2s, opacity 0.2s',
              }}>
                {/* 학생 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{studentName}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{className}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {isSaving ? (
                      <span style={{ fontSize: 12, color: 'var(--primary)' }}>저장 중...</span>
                    ) : isSaved ? (
                      <span style={{ fontSize: 12, background: 'var(--success)', color: '#fff', borderRadius: 999, padding: '2px 8px' }}>
                        채점 완료
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {doneCount}/{allQIds.length} 문항
                      </span>
                    )}
                  </div>
                </div>

                {/* 학생 답안 */}
                <div style={{
                  background: 'var(--bg)', borderRadius: 8,
                  padding: '10px 12px', marginBottom: 10,
                  border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>학생 답안</p>
                  <p style={{ fontSize: 14, lineHeight: 1.75, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                    "{typedText}"
                  </p>
                </div>

                {/* O/X 채점 버튼 */}
                {!isSaved && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { val: 'O', label: '정답 ✓', color: 'var(--success)' },
                      { val: 'X', label: '오답 ✗', color: 'var(--danger)'  },
                    ].map(({ val, label, color }) => (
                      <button key={val} disabled={isSaving}
                        onClick={() => markGrade(submissionId, selected, val, allQIds, source)}
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 10,
                          cursor: isSaving ? 'default' : 'pointer',
                          background: grade === val ? color : 'var(--card)',
                          border: `2px solid ${grade === val ? color : 'var(--border)'}`,
                          color: grade === val ? '#fff' : 'var(--text-muted)',
                          fontWeight: 700, fontSize: 15,
                          transition: 'all 0.15s',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {isSaved && (
                  <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700, textAlign: 'center' }}>
                    ✅ 채점 결과가 저장되었습니다
                  </p>
                )}
              </div>
            )
          })}

          {graded === total && total > 0 && (
            <div style={{
              background: 'var(--primary-light)', border: '1px solid var(--primary)',
              borderRadius: 10, padding: '14px 16px', textAlign: 'center', marginTop: 8,
            }}>
              <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                이 문항의 채점이 모두 완료되었습니다
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                모든 학생의 답안이 채점되어 자동 저장됩니다
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 문항 목록 화면 ─────────────────────────────────────────────────────
  const qEntries             = Object.entries(questionMap)
  const totalPendingAnswers  = qEntries.reduce((s, [, e]) => s + e.answers.length, 0)

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">서술형 채점</span>
        {qEntries.length > 0 && (
          <span style={{
            background: 'var(--danger)', color: '#fff',
            borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 700,
          }}>
            {qEntries.length}
          </span>
        )}
      </div>

      <div className="screen-body">
        {qEntries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">✅</span>
            <span className="empty-state-title">채점 대기 없음</span>
            <span>모든 서술형 답안이 채점되었습니다.</span>
          </div>
        ) : (
          <>
            <p className="section-title">
              채점 대기 — {qEntries.length}개 문항 · 총 {totalPendingAnswers}개 답안
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, marginTop: -6 }}>
              문항을 선택하면 모범답안과 학생 답안 목록을 함께 볼 수 있습니다
            </p>

            {qEntries.map(([qId, entry]) => {
              const q              = entry.question
              const { graded, total } = progress(qId)
              const allDone        = graded === total

              return (
                <div key={qId} className="card" style={{
                  marginBottom: 14,
                  borderLeft: `4px solid ${allDone ? 'var(--success)' : 'var(--primary)'}`,
                }}>
                  {/* 문항 유형 배지 */}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {q?.practiceType ?? '서술형'} · {entry.answers[0]?.className ?? ''}
                  </p>

                  {/* 문항 줄기 */}
                  <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                    {(q?.stem ?? qId).slice(0, 100)}{(q?.stem?.length ?? 0) > 100 ? '…' : ''}
                  </p>

                  {/* 모범답안 미리보기 */}
                  <div style={{
                    background: '#fff8df', border: '1px solid #e8d68e',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6b4b12', flexShrink: 0, marginTop: 1 }}>
                      모범답안
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#3e3422', lineHeight: 1.6 }}>
                      {(q?.modelAnswer ?? q?.answer ?? '(없음)').slice(0, 80)}
                      {(q?.modelAnswer ?? q?.answer ?? '').length > 80 ? '…' : ''}
                    </span>
                  </div>

                  {/* 하단: 진행률 + 버튼 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        fontSize: 13, fontWeight: allDone ? 700 : 400,
                        color: allDone ? 'var(--success)' : 'var(--text-muted)',
                      }}>
                        {allDone ? `✅ ${total}명 모두 채점됨` : `${graded}/${total}명 채점됨`}
                      </span>
                    </div>
                    <button
                      className={`btn ${allDone ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => setSelected(qId)}>
                      {allDone ? '결과 확인' : `채점하기 (${total - graded}명)`}
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── 합격 판정 이력 ───────────────────────────────────────── */}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowPassHist(v => !v)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 10,
              padding: '12px 16px', cursor: 'pointer',
            }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              🎯 합격 판정 이력
              {passResults.length > 0 && (
                <span style={{
                  marginLeft: 8, background: 'var(--primary)', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: 12,
                }}>{passResults.length}</span>
              )}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{showPassHist ? '▲' : '▼'}</span>
          </button>

          {showPassHist && (
            <div style={{ marginTop: 8 }}>
              {passResults.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  아직 합격 판정 기록이 없습니다.
                </p>
              ) : passResults.map(r => {
                const verdictIcon = r.verdict === 'pass' ? '🎉' : r.verdict === 'fail' ? '⚠️' : '📝'
                const verdictText = r.verdict === 'pass' ? '합격' : r.verdict === 'fail' ? '불합격' : '미정'
                const verdictColor = r.verdict === 'pass' ? 'var(--success)' : r.verdict === 'fail' ? 'var(--danger)' : 'var(--text-muted)'
                const date = new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
                return (
                  <div key={r.id} className="card" style={{
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
                    borderLeft: `4px solid ${verdictColor}`,
                  }}>
                    <span style={{ fontSize: 22 }}>{verdictIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {r.student?.display_name ?? '학생'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{date}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: verdictColor, fontSize: 13 }}>
                          {verdictText}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {r.passed_count ?? 0}/{getPassSpec(r.subject_id).units.length} 영역 통과
                          {r.paper_no ? ` · ${r.paper_no}회` : ''}
                        </span>
                      </div>
                      {(r.weak_units ?? []).length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.weak_units.map(u => (
                            <span key={u} style={{
                              background: '#fff3cd', color: '#856404',
                              borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                            }}>{u}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
