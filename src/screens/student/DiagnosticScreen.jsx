import { useEffect, useMemo, useRef, useState } from 'react'
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import { buildDiagnosticPaper, diagnosticGroupOfQuestion, getDiagnosticScopes } from '../../lib/mockData.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { addXp } from '../../lib/xp.js'
import { recordAnswer } from '../../lib/mastery.js'
import { recordQuestion } from '../../lib/subjectProgress.js'
import DifficultyBadge from './DifficultyBadge.jsx'
import QuestionPriorityBadge from './QuestionPriorityBadge.jsx'
import ListeningPrompt from './ListeningPrompt.jsx'
import QuestionMedia from './QuestionMedia.jsx'
import { supabase } from '../../lib/supabase.js'
import { currentUserId } from '../../lib/authUser.js'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import { CheckCircle } from '@phosphor-icons/react'

async function submitDiagnostic(subjectId, scopeName, correctN, total, byArea, qids) {
  try {
    const uid = await currentUserId()
    if (!uid) return
    const { data: sc } = await supabase.from('student_classes')
      .select('class_id').eq('student_id', uid).limit(1).maybeSingle()
    await supabase.from('mock_assessments').insert({
      student_id: uid, class_id: sc?.class_id ?? null,
      subject_id: subjectId, kind: 'diagnostic', title: `진단평가 · ${scopeName}`,
      question_ids: qids, auto_score: correctN, auto_total: total,
      total_questions: total, grading_status: 'auto', area_scores: byArea,
    })
  } catch { /* 오프라인 또는 마이그레이션 전에는 로컬 리포트만 유지 */ }
}

const COURSE_ID = { 'food-service': 3, quality: 2, interview: 4, 'ncs-basic': 1, 'job-common': 1, 'recruit-written': 1 }
const LEARNING_REVIEW_LINE = 60
const COUNT_PRESETS = [5, 10, 20, 40]

function histKey(subjectId, scopeKey) { return `diag_hist_${subjectId}_${scopeKey}` }
function loadHist(subjectId, scopeKey) {
  try { return JSON.parse(localStorage.getItem(histKey(subjectId, scopeKey)) || '[]') } catch { return [] }
}
function pushHist(subjectId, scopeKey, rec) {
  const h = loadHist(subjectId, scopeKey); h.push(rec)
  try { localStorage.setItem(histKey(subjectId, scopeKey), JSON.stringify(h.slice(-20))) } catch {}
  return h
}
function answerIndex(q) { return String(q.answer || 'A').charCodeAt(0) - 65 }
function barColor(pct) { return pct >= 80 ? '#059669' : pct >= 60 ? '#2563EB' : pct >= 40 ? '#D97706' : '#DC2626' }
function evidenceLabel(total) { return total >= 10 ? '근거 충분' : total >= 5 ? '참고 가능' : '추가 확인 필요' }
function reasonOf(q) {
  return q.ncsElement || q.teenupBlueprint?.process || q.demandLevel || q.skillTag || q.lessonTitle || '개념 적용'
}

export default function DiagnosticScreen({ subjectId, subjectName, onBack, onGoTextbook, onLearningContext }) {
  const scopes = useMemo(() => getDiagnosticScopes(subjectId), [subjectId])
  const [scopeLevel, setScopeLevel] = useState('all')
  const [scopeKey, setScopeKey] = useState('__all__')
  const [questionCount, setQuestionCount] = useState(20)
  const [phase, setPhase] = useState('intro')
  const [paper, setPaper] = useState([])
  const [i, setI] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const courseId = COURSE_ID[subjectId] ?? 1
  const selectedScope = scopes.find(s => s.key === scopeKey) || scopes[0] || { key: '__all__', name: '전체 영역', count: 0, level: 'all' }
  const visibleScopes = scopes.filter(s => s.level === scopeLevel)
  const countOptions = COUNT_PRESETS.filter(n => n <= selectedScope.count)
  const safeCountOptions = countOptions.length ? countOptions : [Math.max(1, selectedScope.count)]
  const hist = loadHist(subjectId, selectedScope.key)

  useEffect(() => {
    const question = phase === 'quiz' ? paper[i] : null
    onLearningContext?.({
      subject: subjectId,
      mode: 'diagnostic',
      stage: phase === 'quiz' ? 'question' : phase,
      areaLabel: selectedScope.name,
      lessonLabel: phase === 'quiz' ? `${i + 1}/${paper.length} 문항` : '진단 범위 선택',
      questionId: question?.id,
      index: phase === 'quiz' ? i : null,
      position: phase === 'quiz' ? i + 1 : 1,
      total: phase === 'quiz' ? paper.length : 1,
      revealed: false,
      content: question ? { kind: 'question', question } : undefined,
    })
  }, [i, onLearningContext, paper, phase, selectedScope.name, subjectId])

  useEffect(() => {
    const first = scopes.find(s => s.level === scopeLevel)
    if (first && !scopes.some(s => s.key === scopeKey && s.level === scopeLevel)) setScopeKey(first.key)
  }, [scopeLevel, scopes, scopeKey])

  useEffect(() => {
    const opts = COUNT_PRESETS.filter(n => n <= selectedScope.count)
    const preferred = selectedScope.level === 'unit' ? 10 : 20
    setQuestionCount(opts.includes(preferred) ? preferred : (opts.at(-1) || selectedScope.count || 1))
  }, [selectedScope.key, selectedScope.count, selectedScope.level])

  const backRef = useRef(null)
  backRef.current = () => {
    if (phase === 'quiz') {
      const hasResponse = answers.length > 0 || selected != null
      if (!hasResponse || confirm('진단을 중단할까요? 지금까지의 응답은 저장되지 않습니다.')) setPhase('intro')
    } else if (phase === 'result') setPhase('intro')
    else onBack?.()
  }
  useEffect(() => { const id = pushBack(() => backRef.current()); return () => popBack(id) }, [])

  function start() {
    const attempt = loadHist(subjectId, selectedScope.key).length
    const nextPaper = buildDiagnosticPaper(subjectId, attempt, questionCount, selectedScope.key)
    if (!nextPaper.length) return
    setPaper(nextPaper); setAnswers([]); setI(0); setSelected(null); setResult(null); setPhase('quiz')
  }

  function confirmAnswer() {
    if (selected == null) return
    const q = paper[i]
    const correct = selected === answerIndex(q)
    const rec = { q, pick: selected, correct }
    const group = diagnosticGroupOfQuestion(subjectId, q)
    recordAnswer(subjectId, group.unitId || group.area || 'diag', correct)
    recordQuestion(subjectId, q.id, correct)
    if (!correct) saveWrongAnswer(q, courseId, String.fromCharCode(65 + selected))
    const next = [...answers, rec]
    setAnswers(next); setSelected(null)
    if (i + 1 < paper.length) setI(i + 1)
    else finish(next)
  }

  function finish(all) {
    const byArea = {}
    const byUnit = {}
    const reasons = {}
    let correctN = 0
    for (const item of all) {
      const group = diagnosticGroupOfQuestion(subjectId, item.q)
      byArea[group.area] ||= { total: 0, correct: 0 }
      byArea[group.area].total++
      const unitKey = `${group.area}::${group.unit}`
      byUnit[unitKey] ||= { area: group.area, unit: group.unit, unitId: group.unitId, total: 0, correct: 0 }
      byUnit[unitKey].total++
      if (item.correct) {
        byArea[group.area].correct++; byUnit[unitKey].correct++; correctN++
      } else {
        const reason = reasonOf(item.q)
        reasons[reason] = (reasons[reason] || 0) + 1
      }
    }
    const toRows = source => Object.values(source).map(v => ({
      ...v, pct: Math.round((v.correct / v.total) * 100), evidence: evidenceLabel(v.total),
    })).sort((a, b) => a.pct - b.pct || b.total - a.total)
    const areaSource = Object.fromEntries(Object.entries(byArea).map(([area, v]) => [area, { area, unit: area, unitId: area, ...v }]))
    const areaRows = toRows(areaSource)
    const unitRows = toRows(byUnit)
    const focusRows = selectedScope.level === 'unit' || unitRows.length > 1 ? unitRows : areaRows
    const weak = focusRows.filter(a => a.pct < LEARNING_REVIEW_LINE).slice(0, 3)
    const reasonRows = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const pct = Math.round((correctN / all.length) * 100)
    addXp(20, 'diagnostic')
    pushHist(subjectId, selectedScope.key, { pct, n: all.length, ts: Date.now(), scope: selectedScope.name })
    submitDiagnostic(subjectId, selectedScope.name, correctN, all.length, byArea, all.map(item => item.q.id))
    setResult({ pct, correctN, total: all.length, areas: areaRows, units: unitRows, weak, reasons: reasonRows, scope: selectedScope })
    setPhase('result')
  }

  if (phase === 'intro') {
    const last = hist.at(-1)
    const hasUnits = scopes.some(s => s.level === 'unit')
    return (
      <div className="screen">
        <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">{subjectName} 진단평가</span></div>
        <div className="screen-body">
          <div style={{ ...card, border: '1px solid #818CF8' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#4338CA', marginBottom: 5 }}>학습 처방형 진단</p>
            <h2 style={{ fontSize: 19, fontWeight: 900, marginBottom: 7 }}>어디가 막혔는지 찾고 바로 보완</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
              합격을 판정하는 시험이 아님. 선택한 범위의 이해도를 확인하고, 틀린 사고과정과 먼저 복습할 단원을 안내함.
            </p>
          </div>

          <section style={sectionBlock}>
            <p style={sectionLabel}>1. 진단 범위</p>
            <div style={segmented}>
              {[['all', '전체'], ['area', '영역'], ['unit', '소단원']].map(([key, label]) => (
                <button key={key} disabled={key === 'unit' && !hasUnits} onClick={() => setScopeLevel(key)}
                  style={{ ...segmentBtn, ...(scopeLevel === key ? segmentActive : {}), opacity: key === 'unit' && !hasUnits ? .45 : 1 }}>
                  {label}
                </button>
              ))}
            </div>
            {visibleScopes.length > 1 && (
              <select value={scopeKey} onChange={e => setScopeKey(e.target.value)} style={selectStyle} aria-label="진단 범위 선택">
                {visibleScopes.map(s => <option key={s.key} value={s.key}>{s.level === 'unit' ? `${s.area} · ` : ''}{s.name} ({s.count}문항 풀)</option>)}
              </select>
            )}
            {visibleScopes.length === 1 && <p style={selectionSummary}>{visibleScopes[0].name} · 문항 풀 {visibleScopes[0].count}개</p>}
          </section>

          <section style={sectionBlock}>
            <p style={sectionLabel}>2. 진단 깊이</p>
            <div style={segmented}>
              {safeCountOptions.map(n => (
                <button key={n} onClick={() => setQuestionCount(n)} style={{ ...segmentBtn, ...(questionCount === n ? segmentActive : {}) }}>{n}문항</button>
              ))}
            </div>
            <p style={helperText}>{questionCount <= 5 ? '빠른 확인' : questionCount <= 10 ? '핵심 확인' : questionCount <= 20 ? '표준 진단' : '정밀 진단'} · 시간 제한 없음 · 결과에서 보완 순서 제공</p>
          </section>

          <button onClick={start} style={primaryBtn}>{selectedScope.name} 진단 시작 · {questionCount}문항</button>
          <p style={{ ...helperText, textAlign: 'center', marginTop: 10 }}>오답은 오답노트에 저장됨 · 공식 인증·합격 결과가 아님</p>

          {last && (
            <div style={{ ...card, marginTop: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>같은 범위 최근 진단</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>{last.pct}%</p>
              <p style={helperText}>{last.scope || selectedScope.name} · {last.n}문항 · 최근 {Math.min(hist.length, 20)}회 기록</p>
              <HistoryBars hist={hist} />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'quiz') {
    const q = paper[i]
    const pct = Math.round((i / paper.length) * 100)
    return (
      <div className="screen">
        <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">진단 {i + 1} / {paper.length}</span></div>
        <div style={{ height: 5, background: 'var(--border)' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)' }} /></div>
        <div className="screen-body">
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><QuestionPriorityBadge q={q} subjectId={subjectId} /><DifficultyBadge q={q} /></span>
              <span style={helperText}>{selectedScope.name}</span>
            </div>
            <ListeningPrompt key={q.id} q={q} revealTranscript={false} />
            <QuestionMedia q={q} />
            {q.context && <div style={ctxBox}>{q.context}</div>}
            <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.65, marginBottom: 14 }}>{q.stem}</p>
            <p style={{ ...helperText, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={15} /> 선택한 답만 표시됨 · 정답은 제출 후 결과에서 확인
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.choices.map((choice, idx) => (
                <button key={idx} onClick={() => setSelected(idx)} aria-pressed={selected === idx} style={{ ...choiceBtn, ...(selected === idx ? choiceSelected : {}) }}>
                  <span style={{ ...letter, ...(selected === idx ? { background: '#0f766e', color: '#fff' } : {}) }}>{idx + 1}</span><span style={{ flex: 1 }}>{choice}</span>
                  {selected === idx && <span style={selectedLabel}><CheckCircle size={15} weight="fill" />선택됨</span>}
                </button>
              ))}
            </div>
            <button disabled={selected == null} onClick={confirmAnswer} style={{ ...primaryBtn, marginTop: 14, opacity: selected == null ? .45 : 1 }}>
              {i + 1 === paper.length ? '응답 제출하고 결과 보기' : '이 답으로 다음'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const r = result
  const onTrack = r.pct >= LEARNING_REVIEW_LINE
  const focus = r.weak[0] || r.units[0] || r.areas[0]
  return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">진단 결과</span></div>
      <div className="screen-body">
        <div style={{ ...card, background: onTrack ? '#ECFDF5' : '#FFF7ED', border: `1px solid ${onTrack ? '#10B981' : '#FB923C'}` }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: onTrack ? '#047857' : '#C2410C' }}>{r.scope.name} · 학습 진단</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}><p style={{ fontSize: 40, fontWeight: 900, color: onTrack ? '#059669' : '#D97706' }}>{r.pct}%</p><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.correctN}/{r.total} 정답</p></div>
          <p style={{ fontSize: 13.5, fontWeight: 700 }}>{onTrack ? '핵심 이해는 안정적. 틀린 과정만 보완 권장.' : '약점이 확인됨. 아래 순서대로 보완 권장.'}</p>
          <p style={{ ...helperText, marginTop: 5 }}>학습 보완 참고선 {LEARNING_REVIEW_LINE}% · 공식 판정 아님</p>
        </div>

        <div style={card}>
          <p style={sectionLabel}>{r.scope.level === 'unit' || r.units.length > 1 ? '소단원별 진단' : '영역별 진단'}</p>
          {(r.scope.level === 'unit' || r.units.length > 1 ? r.units : r.areas).map(item => (
            <div key={`${item.area}-${item.unit}`} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 4 }}><span style={{ fontWeight: 700 }}>{item.unit}</span><span style={{ fontWeight: 900, color: barColor(item.pct), whiteSpace: 'nowrap' }}>{item.pct}% · {item.evidence}</span></div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${item.pct}%`, background: barColor(item.pct) }} /></div>
              <p style={{ ...helperText, marginTop: 3 }}>{item.correct}/{item.total}문항 정답</p>
            </div>
          ))}
        </div>

        <div style={{ ...card, border: '1px solid #FB923C' }}>
          <p style={{ ...sectionLabel, color: '#C2410C' }}>보완 순서</p>
          {r.weak.length ? r.weak.map((item, idx) => (
            <div key={`${item.area}-${item.unit}`} style={prescriptionRow}><span style={orderBadge}>{idx + 1}</span><span><b>{item.unit}</b><br /><span style={helperText}>{item.pct}% · 개념 다시 보기 → 예제 확인 → 오답 재풀이</span></span></div>
          )) : <p style={{ fontSize: 13.5 }}>우선 보완 영역 없음. 틀린 문항만 오답노트에서 확인 권장.</p>}
          {r.reasons.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}><p style={{ fontSize: 12, fontWeight: 800, marginBottom: 5 }}>오답에서 많이 나타난 학습 요소</p><p style={{ ...helperText, lineHeight: 1.7 }}>{r.reasons.map(([name, count]) => `${name} ${count}회`).join(' · ')}</p></div>
          )}
          {onGoTextbook && focus && <button onClick={() => onGoTextbook({ area: focus.area, lesson: focus.unitId, unit: focus.unit })} style={{ ...primaryBtn, marginTop: 12, background: '#EA580C' }}>{focus.unit} 보완학습으로 이동</button>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setPhase('intro')} style={{ ...outlineBtn, flex: 1 }}>범위 바꾸기</button><button onClick={start} style={{ ...primaryBtn, flex: 1 }}>같은 범위 재진단</button></div>
      </div>
    </div>
  )
}

function HistoryBars({ hist }) {
  return <div style={{ height: 54, display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 10 }} aria-label="최근 진단 점수">{hist.slice(-12).map((item, idx) => <div key={`${item.ts}-${idx}`} title={`${item.pct}%`} style={{ flex: 1, height: `${Math.max(8, item.pct)}%`, background: item.pct >= LEARNING_REVIEW_LINE ? '#4F46E5' : '#F59E0B', borderRadius: '3px 3px 0 0' }} />)}</div>
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }
const sectionBlock = { marginBottom: 18 }
const sectionLabel = { fontSize: 13, fontWeight: 900, marginBottom: 9 }
const segmented = { display: 'flex', gap: 6, padding: 4, background: 'var(--bg)', borderRadius: 10 }
const segmentBtn = { flex: 1, minHeight: 40, border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const segmentActive = { background: 'var(--card)', color: 'var(--primary)', borderColor: 'var(--primary)', boxShadow: '0 1px 3px rgba(15,23,42,.08)' }
const selectStyle = { width: '100%', minHeight: 46, marginTop: 9, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--text)', padding: '0 12px', fontSize: 13.5, fontWeight: 700 }
const selectionSummary = { marginTop: 9, padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontWeight: 700 }
const helperText = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 7 }
const primaryBtn = { width: '100%', minHeight: 48, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const outlineBtn = { minHeight: 48, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const ctxBox = { fontSize: 13, color: '#374151', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }
const choiceBtn = { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '13px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, cursor: 'pointer', color: 'var(--text)' }
const choiceSelected = { border: '1px solid #0f766e', background: '#ecfdf5', boxShadow: 'inset 0 0 0 1px #0f766e' }
const letter = { width: 24, height: 24, flexShrink: 0, borderRadius: 12, background: 'var(--bg)', color: 'var(--primary)', fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const selectedLabel = { display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#0f766e', fontSize: 11.5, fontWeight: 800 }
const prescriptionRow = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, lineHeight: 1.5 }
const orderBadge = { width: 24, height: 24, borderRadius: 12, background: '#FFEDD5', color: '#C2410C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }
