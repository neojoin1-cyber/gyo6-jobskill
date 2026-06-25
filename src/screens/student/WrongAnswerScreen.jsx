/**
 * WrongAnswerScreen — 오답노트
 * MCQ/OX: submissions.answers를 questions.json과 비교해 오답 자동 추출
 * selfcheck: typed_answers 표시 + 모범답안 비교 (자가 점검)
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import jobQuestions         from '../../../data/questions.json'
import ncsQuestions         from '../../../data/ncs-questions.json'
import foodServiceQuestions from '../../../data/food-service-questions.json'

// 과목별 ID → 문항 맵
const QUESTION_MAP = {
  'job-common':   Object.fromEntries(jobQuestions.map(q => [q.id, q])),
  'ncs-basic':    Object.fromEntries(ncsQuestions.map(q => [q.id, q])),
  'food-service': Object.fromEntries(foodServiceQuestions.map(q => [q.id, q])),
}

const SUBJECT_LABEL = {
  'job-common':   '직업공통능력',
  'ncs-basic':    'NCS 기초',
  'food-service': '식음료서비스',
}

function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

// 제출 1건에서 오답 목록 추출
function extractWrongAnswers(sub, subjectId) {
  const qMap   = QUESTION_MAP[subjectId] ?? QUESTION_MAP['job-common']
  const wrong  = []

  // MCQ / OX 오답
  for (const [qId, selVal] of Object.entries(sub.answers ?? {})) {
    if (qId.startsWith('_')) continue
    const q = qMap[qId]
    if (!q || q.questionMode === 'selfcheck') continue
    const sel = typeof selVal === 'number' ? selVal : parseInt(selVal)
    if (isNaN(sel)) continue
    const correctIdx = answerIdx(q.answer)
    if (sel !== correctIdx) {
      wrong.push({
        qId,
        question: q,
        myIdx:    sel,
        correctIdx,
        type:     'mcq',
        missionId: sub.mission_id,
        submittedAt: sub.completed_at,
      })
    }
  }

  // selfcheck 답안 (모범답안 있는 것만)
  for (const [qId, typedText] of Object.entries(sub.typed_answers ?? {})) {
    const q = qMap[qId]
    if (!q) continue
    wrong.push({
      qId,
      question:    q,
      typedText,
      type:        'selfcheck',
      missionId:   sub.mission_id,
      submittedAt: sub.completed_at,
    })
  }

  return wrong
}

export default function WrongAnswerScreen({ profile }) {
  const [subs,    setSubs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')   // all | job-common | ncs-basic | food-service
  const [repeatOnly, setRepeatOnly] = useState(false)
  const [expandedId, setExpandedId] = useState(null)  // 펼쳐진 문항 qId+missionId

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('submissions')
      .select('id, mission_id, answers, typed_answers, score, total_questions, completed_at, grading_status, missions(id, title, subject_id, question_count)')
      .eq('student_id', profile.id)
      .order('completed_at', { ascending: false })
    setSubs(data ?? [])
    setLoading(false)
  }

  // 전체 오답 목록 계산
  const allWrong = useMemo(() => {
    const list = []
    for (const sub of subs) {
      const subjectId = sub.missions?.subject_id ?? 'job-common'
      const items     = extractWrongAnswers(sub, subjectId)
      for (const item of items) {
        list.push({ ...item, subjectId, missionTitle: sub.missions?.title ?? '(미션 없음)' })
      }
    }
    return list
  }, [subs])

  // 반복 오답 계산 (같은 qId가 2회 이상)
  const repeatCounts = useMemo(() => {
    const counts = {}
    for (const w of allWrong) {
      counts[w.qId] = (counts[w.qId] ?? 0) + 1
    }
    return counts
  }, [allWrong])

  // 필터 적용
  const filtered = useMemo(() => {
    let list = allWrong
    if (filter !== 'all') list = list.filter(w => w.subjectId === filter)
    if (repeatOnly)       list = list.filter(w => (repeatCounts[w.qId] ?? 0) >= 2)
    return list
  }, [allWrong, filter, repeatOnly, repeatCounts])

  // 미션별 그룹핑
  const grouped = useMemo(() => {
    const map = {}
    for (const item of filtered) {
      const key = item.missionId
      if (!map[key]) map[key] = { missionTitle: item.missionTitle, subjectId: item.subjectId, submittedAt: item.submittedAt, items: [] }
      map[key].items.push(item)
    }
    return Object.values(map)
  }, [filtered])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const repeatCount = Object.values(repeatCounts).filter(c => c >= 2).length
  const selfCheckCount = allWrong.filter(w => w.type === 'selfcheck').length

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">📋 오답노트</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          총 {allWrong.filter(w => w.type === 'mcq').length}개 오답
        </span>
      </div>

      <div className="screen-body">
        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <StatCard label="MCQ 오답" value={allWrong.filter(w => w.type === 'mcq').length} color="var(--danger)" />
          <StatCard label="반복 오답" value={repeatCount} color="#e65100" />
          <StatCard label="서술형 답안" value={selfCheckCount} color="var(--primary)" />
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: '전체' },
            { id: 'job-common', label: '직업공통' },
            { id: 'ncs-basic', label: 'NCS' },
            { id: 'food-service', label: '식음료' },
          ].map(f => (
            <button key={f.id}
              className={`btn ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 999 }}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 반복오답 토글 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={repeatOnly} onChange={e => setRepeatOnly(e.target.checked)} />
          <span style={{ fontWeight: 700, color: repeatOnly ? '#e65100' : 'var(--text-muted)' }}>
            🔴 반복 오답만 보기 ({repeatCount}개)
          </span>
        </label>

        {/* 결과 없음 */}
        {grouped.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">{allWrong.length === 0 ? '🎉' : '🔍'}</span>
            <span className="empty-state-title">
              {allWrong.length === 0 ? '오답이 없습니다!' : '해당 조건의 오답이 없습니다'}
            </span>
            <span>{allWrong.length === 0 ? '모든 문제를 맞혔어요.' : '필터를 변경해 보세요.'}</span>
          </div>
        )}

        {/* 미션별 오답 목록 */}
        {grouped.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p className="section-title" style={{ margin: 0, flex: 1 }}>{group.missionTitle}</p>
              <span className="badge badge-blue">{SUBJECT_LABEL[group.subjectId] ?? group.subjectId}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(group.submittedAt).toLocaleDateString('ko')}
              </span>
            </div>

            {group.items.map((item, ii) => (
              <WrongItem
                key={`${item.qId}-${ii}`}
                item={item}
                isRepeat={(repeatCounts[item.qId] ?? 0) >= 2}
                repeatCount={repeatCounts[item.qId] ?? 1}
                expanded={expandedId === `${item.qId}-${gi}-${ii}`}
                onToggle={() => setExpandedId(
                  expandedId === `${item.qId}-${gi}-${ii}` ? null : `${item.qId}-${gi}-${ii}`
                )}
              />
            ))}
          </div>
        ))}

        {/* 학습 팁 */}
        {allWrong.length > 0 && (
          <div style={{
            background: 'var(--primary-light)', borderRadius: 10,
            padding: '12px 14px', marginTop: 8,
            border: '1px solid var(--primary)',
          }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 4 }}>
              💡 시험 임박 학습 팁
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              반복 오답 {repeatCount}개를 집중 복습하세요. 한 번 틀린 문제는 다시 틀리기 쉽습니다.
              "반복 오답만 보기"를 켜서 핵심만 빠르게 정리하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 10, padding: '10px 8px',
      textAlign: 'center', border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
    </div>
  )
}

function WrongItem({ item, isRepeat, repeatCount, expanded, onToggle }) {
  const q = item.question

  return (
    <div className="card" style={{
      marginBottom: 8,
      borderLeft: `4px solid ${isRepeat ? '#e65100' : item.type === 'selfcheck' ? 'var(--primary)' : 'var(--danger)'}`,
    }}>
      {/* 헤더 */}
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', padding: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>
            {item.type === 'selfcheck' ? '📝' : isRepeat ? '🔴' : '❌'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {q?.stem ?? item.qId}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {q?.area && <span className="badge badge-gray" style={{ fontSize: 10 }}>{q.area}</span>}
              {q?.lessonTitle && <span className="badge badge-gray" style={{ fontSize: 10 }}>{q.lessonTitle}</span>}
              {isRepeat && (
                <span className="badge" style={{ background: '#fff3e0', color: '#e65100', fontSize: 10 }}>
                  반복 {repeatCount}회
                </span>
              )}
              {item.type === 'selfcheck' && (
                <span className="badge badge-blue" style={{ fontSize: 10 }}>서술형</span>
              )}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* 펼쳐진 상세 */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {item.type === 'mcq' ? (
            // MCQ 오답 상세
            <>
              {q?.choices?.map((text, ci) => {
                const isCorrect  = ci === item.correctIdx
                const isSelected = ci === item.myIdx
                return (
                  <p key={ci} style={{
                    fontSize: 13, padding: '4px 0',
                    color: isCorrect ? 'var(--success)' : isSelected ? 'var(--danger)' : 'var(--text-muted)',
                    fontWeight: isCorrect || isSelected ? 700 : 400,
                  }}>
                    {isSelected ? '▶ ' : isCorrect ? '✓ ' : '　'}
                    {ci + 1}. {text}
                    {isCorrect && ' ← 정답'}
                    {isSelected && !isCorrect && ' ← 내 답 (오답)'}
                  </p>
                )
              })}
              {q?.explanation && (
                <div style={{
                  background: 'var(--primary-light)', borderRadius: 8,
                  padding: '8px 12px', marginTop: 10,
                }}>
                  <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>💡 해설</p>
                  <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>{q.explanation}</p>
                </div>
              )}
            </>
          ) : (
            // selfcheck 상세
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>내가 쓴 답</p>
                <p style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  "{item.typedText}"
                </p>
              </div>
              {(q?.modelAnswer || q?.answer) && (
                <div style={{
                  background: '#fff8df', borderRadius: 8,
                  padding: '8px 12px', border: '1px solid #ffc107',
                }}>
                  <p style={{ fontSize: 11, color: '#856404', fontWeight: 700, marginBottom: 4 }}>📖 모범답안</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#17212b' }}>
                    {q.modelAnswer ?? q.answer}
                  </p>
                </div>
              )}
              {q?.explanation && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                  💡 {q.explanation}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
