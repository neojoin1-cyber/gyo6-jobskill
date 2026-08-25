import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle,
  ClipboardText,
  FileText,
  Highlighter,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilLine,
  Student,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { REVIEW_COACH_ISSUES, REVIEW_RUBRIC } from '../../lib/coverLetterGuidance.js'
import '../../styles/cover-letter-review.css'

const STATUS = {
  submitted: '첨삭 대기',
  in_review: '확인 중',
  revision_requested: '수정 요청',
  approved: '첨삭 완료',
}

function documentLabel(row) {
  return row?.draft?.documentType === 'interview-script' ? '면접 답변' : '자기소개서'
}

const DRAFT_EVIDENCE_LABELS = {
  targetName: '지원처',
  role: '지원 직무',
  targetEvidence: '지원처 공식 근거',
  majorSkill: '전공·직무 역량',
  action: '나의 행동',
  result: '확인된 결과',
  motivation: '지원동기 근거',
  contribution: '입사 후 기여',
  proof: '확인 자료',
  situation: '상황',
  task: '맡은 역할',
}

const HIDDEN_DRAFT_KEYS = new Set([
  'coverSignature', 'documentType', 'introduction', 'motivation', 'organizationId',
  'role', 'sector', 'targetName', 'linkedAt', 'generatedText',
])

function draftEvidenceEntries(draft) {
  if (draft?.documentType === 'interview-script') return []
  return Object.entries(draft || {})
    .filter(([key, value]) => !HIDDEN_DRAFT_KEYS.has(key) && typeof value === 'string' && value.trim())
    .map(([key, value]) => ({ key, label: DRAFT_EVIDENCE_LABELS[key] || key, value }))
}

function sourceEvidenceEntries(sourceCover) {
  return Object.entries(sourceCover || {})
    .filter(([key, value]) => key !== 'organizationId' && typeof value === 'string' && value.trim())
    .map(([key, value]) => ({ key, label: DRAFT_EVIDENCE_LABELS[key] || key, value }))
}

export default function CoverLetterReviewScreen({ onBack, initialClassId, demo = false }) {
  const { profile } = useAuth() ?? {}
  const demoItems = useMemo(() => demo ? demoRows() : [], [demo])
  const [classes, setClasses] = useState(demo ? [{ id: 'c1', name: '3학년 2반' }] : [])
  const [classId, setClassId] = useState(initialClassId || (demo ? 'c1' : ''))
  const [rows, setRows] = useState(demoItems)
  const [selectedId, setSelectedId] = useState(demoItems[0]?.id || null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('pending')
  const [summary, setSummary] = useState('')
  const [feedback, setFeedback] = useState({})
  const [selection, setSelection] = useState(null)
  const [selectionNote, setSelectionNote] = useState('')
  const [selectionColor, setSelectionColor] = useState('#fef08a')
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => { if (!demo) loadClasses() }, [demo, profile?.id])
  useEffect(() => { if (!demo) loadRows() }, [demo, profile?.id, classId])

  async function loadClasses() {
    const teacherId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (!teacherId) return
    const { data } = await supabase.from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', teacherId)
    const list = (data || []).map(item => ({ id: item.class_id, name: item.classes?.name || '이름 없는 학급' }))
    setClasses(list)
    if (!classId && list.length === 1) setClassId(list[0].id)
  }

  async function loadRows() {
    if (demo) return
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_teacher_cover_letters', { p_class_id: classId || null, p_limit: 150 })
    setLoading(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: '첨삭 요청을 불러오지 못했습니다.' })
      return
    }
    const list = Array.isArray(data) ? data : []
    setRows(list)
    setSelectedId(current => list.some(item => item.id === current) ? current : list[0]?.id || null)
  }

  const visible = useMemo(() => rows.filter(item => {
    const matchesQuery = !query || `${item.student_name} ${item.target_name} ${item.role_name}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = status === 'all' || (status === 'pending' ? ['submitted', 'in_review'].includes(item.status) : item.status === status)
    return matchesQuery && matchesStatus
  }), [rows, query, status])
  const selected = rows.find(item => item.id === selectedId) || null
  const documentSections = useMemo(() => splitGeneratedText(selected?.generated_text, selected?.draft), [selected?.generated_text, selected?.draft])
  const highlights = Array.isArray(feedback.highlights) ? feedback.highlights : []

  useEffect(() => {
    if (!selected) return
    setSummary(selected.feedback_summary || '')
    setFeedback(selected.section_feedback || {})
    setSelection(null)
    setSelectionNote('')
    setNotice(null)
  }, [selectedId])

  function captureSelection(sectionTitle, body) {
    const quote = window.getSelection()?.toString().trim().replace(/\s+/g, ' ') || ''
    if (quote.length < 3 || !String(body).replace(/\s+/g, ' ').includes(quote)) return
    setSelection({ sectionTitle, quote: quote.slice(0, 240) })
    setSelectionNote('')
  }

  function selectParagraph(sectionTitle, body) {
    setSelection({ sectionTitle, quote: String(body).trim().slice(0, 240) })
    setSelectionNote('')
  }

  function addHighlight() {
    if (!selection || selectionNote.trim().length < 2) {
      setNotice({ ok: false, text: '문장을 드래그하고 부분 메모를 적어 주세요.' })
      return
    }
    const next = [...highlights, { id: `mark-${Date.now()}`, sectionTitle: selection.sectionTitle, quote: selection.quote, note: selectionNote.trim(), color: selectionColor }]
    setFeedback(current => ({ ...current, highlights: next }))
    setSelection(null)
    setSelectionNote('')
    window.getSelection()?.removeAllRanges?.()
    setNotice(null)
  }

  function applyQuickIssue(issue) {
    if (selection) {
      setSelectionColor(issue.color)
      setSelectionNote(issue.note)
      return
    }
    const text = `${issue.label}: ${issue.action}`
    setSummary(current => `${current}${current.trim() ? '\n' : ''}${text}`.slice(0, 500))
  }

  function setRubric(id, value) {
    setFeedback(current => ({ ...current, rubric: { ...(current.rubric || {}), [id]: value } }))
  }

  function addSummaryFrame(text) {
    setSummary(current => `${current}${current.trim() ? '\n' : ''}${text}`.slice(0, 500))
  }

  async function save(decision) {
    if (!selected || summary.trim().length < 10 || saving) {
      setNotice({ ok: false, text: '전체 조언을 10자 이상 구체적으로 적어 주세요.' })
      return
    }
    setSaving(true)
    setNotice(null)
    if (demo) {
      setRows(current => current.map(item => item.id === selected.id ? { ...item, status: decision, feedback_summary: summary, section_feedback: feedback } : item))
      setSaving(false)
      setNotice({ ok: true, text: decision === 'approved' ? '첨삭 완료로 전달했습니다.' : '수정 조언을 학생에게 전달했습니다.' })
      return
    }
    const { data, error } = await supabase.rpc('rpc_review_cover_letter', {
      p_submission_id: selected.id,
      p_summary: summary.trim(),
      p_section_feedback: feedback,
      p_decision: decision,
    })
    setSaving(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: '첨삭을 저장하지 못했습니다. 담당 학급 범위를 확인해 주세요.' })
      return
    }
    setNotice({ ok: true, text: decision === 'approved' ? '첨삭 완료로 전달했습니다.' : '수정 조언을 학생에게 전달했습니다.' })
    await loadRows()
  }

  return (
    <main className="cover-review-screen">
      <header className="cover-review-head">
        <button onClick={onBack} aria-label="교사 캠퍼스로 돌아가기"><ArrowLeft /></button>
          <div><span>TEACHER WRITING COACH</span><h1>나를쓰다 첨삭실</h1><p>자기소개서와 연결된 면접 답변까지 같은 근거로 지도함.</p></div>
        <div className="cover-review-summary"><b>{rows.filter(item => ['submitted', 'in_review'].includes(item.status)).length}</b><span>첨삭 대기</span></div>
      </header>

      <div className="cover-review-layout">
        <aside className="cover-review-queue">
          <div className="cover-review-filters">
            <select value={classId} onChange={event => setClassId(event.target.value)}><option value="">담당 학급 전체</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <label><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="학생·지원처 검색" /></label>
            <div><button className={status === 'pending' ? 'is-on' : ''} onClick={() => setStatus('pending')}>대기</button><button className={status === 'revision_requested' ? 'is-on' : ''} onClick={() => setStatus('revision_requested')}>수정</button><button className={status === 'approved' ? 'is-on' : ''} onClick={() => setStatus('approved')}>완료</button><button className={status === 'all' ? 'is-on' : ''} onClick={() => setStatus('all')}>전체</button></div>
          </div>
          <div className="cover-review-list">
            {loading && <p className="cover-review-empty">첨삭 요청을 불러오는 중입니다.</p>}
            {!loading && visible.length === 0 && <p className="cover-review-empty">조건에 맞는 제출물이 없습니다.</p>}
            {visible.map(item => <button key={item.id} className={selectedId === item.id ? 'is-on' : ''} onClick={() => setSelectedId(item.id)}><span><Student weight="duotone" /></span><div><header><b>{item.student_name}</b><em className={`is-${item.status}`}>{STATUS[item.status]}</em></header><strong>{item.target_name}</strong><small>{documentLabel(item)} · {item.role_name} · {item.class_name} · {item.revision_no}차</small></div></button>)}
          </div>
        </aside>

        {!selected ? <section className="cover-review-no-selection"><FileText /><b>첨삭할 글을 선택하세요</b></section> : <>
          <section className="cover-review-document">
            <header><div><span>{selected.student_name} 학생 · {selected.class_name}</span><h2>{selected.target_name}</h2><p>{documentLabel(selected)} · {selected.role_name} 지원 · {selected.revision_no}차</p></div><em>{STATUS[selected.status]}</em></header>
            <p className="cover-review-select-help"><Highlighter weight="fill" />메모할 문장을 드래그하면 오른쪽 첨삭함에 선택됨.</p>
            {documentSections.map(item => <article key={item.title} className={item.limit ? 'has-length-guide' : ''} style={item.limit ? { minHeight: `${reviewAnswerBoxHeight(item.limit)}px` } : undefined}><header className="cover-review-section-head"><div><h3>{item.title}</h3>{item.limit && <small className={item.count < item.minLength ? 'is-short' : 'is-ready'}>{item.count}자 · 권장 {item.minLength}~{item.limit}자</small>}</div><button onClick={() => selectParagraph(item.title, item.body)}><Highlighter />문단 메모</button></header><p onMouseUp={() => captureSelection(item.title, item.body)}>{renderHighlightedText(item.body, highlights.filter(mark => mark.sectionTitle === item.title))}</p></article>)}
            <details><summary>학생이 입력한 원본 근거 보기</summary>{draftEvidenceEntries(selected.draft).map(item => <div key={item.key}><b>{item.label}</b><p>{item.value}</p></div>)}{sourceEvidenceEntries(selected.draft?.sourceCover).map(item => <div key={`source-${item.key}`}><b>연결 자기소개서 · {item.label}</b><p>{item.value}</p></div>)}{Array.isArray(selected.draft?.sourceCover?.coverItems) && selected.draft.sourceCover.coverItems.map(item => <div key={`source-item-${item.id}`}><b>연결 자기소개서 원문 · {item.label}</b><p>{item.answer}</p></div>)}{Array.isArray(selected.draft?.evidenceBank) && selected.draft.evidenceBank.map(item => <div key={item.id}><b>근거 카드 · {item.title}</b><p>{[item.situation, item.task, item.action, item.result].filter(Boolean).join(' ')}</p></div>)}</details>
          </section>

          <aside className="cover-review-coach">
            <header><PencilLine weight="duotone" /><div><h2>첨삭 조언</h2><p>대신 써 주기보다 학생이 고칠 기준을 알려 줌.</p></div></header>
            <section className="cover-review-rubric"><header><ClipboardText /><div><b>빠른 평가</b><p>각 기준을 고르면 첨삭 이력에 함께 저장됨.</p></div></header>{REVIEW_RUBRIC.map(item => <div key={item.id}><span>{item.label}</span><div>{[{ value: 1, label: '보완' }, { value: 2, label: '확인' }, { value: 3, label: '좋음' }].map(option => <button key={option.value} className={feedback.rubric?.[item.id] === option.value ? 'is-on' : ''} onClick={() => setRubric(item.id, option.value)}>{option.label}</button>)}</div></div>)}</section>
            <section className="cover-review-quick"><header><b>첨삭 유형 고르기</b><p>{selection ? '선택한 문장에 맞는 조언을 자동으로 준비함.' : '문장을 먼저 선택하면 부분 메모로, 지금 누르면 총평으로 들어감.'}</p></header><div>{REVIEW_COACH_ISSUES.map(issue => <button key={issue.id} onClick={() => applyQuickIssue(issue)} style={{ '--issue-color': issue.color }}>{issue.label}</button>)}</div></section>
            <section className={`cover-highlight-editor ${selection ? 'is-active' : ''}`}><header><Highlighter weight="fill" /><div><b>{selection ? selection.sectionTitle : '문장 형광펜 메모'}</b><p>{selection ? `“${selection.quote}”` : '왼쪽 문서에서 메모할 문장을 드래그함.'}</p></div></header>{selection && <><div className="cover-highlight-legend"><span><i style={{ background: '#bbf7d0' }} />좋은 근거</span><span><i style={{ background: '#fef08a' }} />보완</span><span><i style={{ background: '#fecdd3' }} />오류·위험</span></div><div className="cover-highlight-colors" aria-label="형광펜 색">{['#bbf7d0', '#fef08a', '#fecdd3'].map(color => <button key={color} className={selectionColor === color ? 'is-on' : ''} style={{ background: color }} onClick={() => setSelectionColor(color)} aria-label="형광펜 색 선택" />)}</div><textarea value={selectionNote} onChange={event => setSelectionNote(event.target.value)} placeholder="위 첨삭 유형을 고르거나, 왜 고쳐야 하는지와 다음 행동을 적음" rows={3} /><button className="cover-add-highlight" onClick={addHighlight}><Highlighter />부분 메모 추가</button></>}</section>
            {highlights.length > 0 && <section className="cover-highlight-list"><b>부분 메모 {highlights.length}개</b>{highlights.map(mark => <article key={mark.id} style={{ '--mark-color': mark.color }}><span>“{mark.quote}”</span><p>{mark.note}</p><button onClick={() => setFeedback(current => ({ ...current, highlights: highlights.filter(item => item.id !== mark.id) }))} aria-label="부분 메모 삭제"><Trash /></button></article>)}</section>}
            {documentSections.map((item, index) => { const key = `section-${index}`; return <label key={key}><span>{item.title}</span><textarea value={feedback[key] || ''} onChange={event => setFeedback(current => ({ ...current, [key]: event.target.value }))} placeholder="좋은 점 1개와 다음 수정 행동 1개" rows={3} /></label> })}
            <label className="cover-review-overall"><span>전체 조언 <small>{summary.length}/500</small></span><div className="cover-summary-starters"><button onClick={() => addSummaryFrame('좋은 점: 구체적인 행동 근거를 유지하세요.')}>강점 틀</button><button onClick={() => addSummaryFrame('우선 수정: 질문의 핵심 요구에 맞춰 행동과 결과를 보완하세요.')}>우선 수정 틀</button><button onClick={() => addSummaryFrame('재제출 전: 지원처명·블라인드 정보·글자 수를 마지막으로 확인하세요.')}>재제출 틀</button></div><textarea value={summary} onChange={event => setSummary(event.target.value.slice(0, 500))} placeholder="좋아진 점 → 가장 먼저 고칠 점 → 다음 제출 전 확인할 일" rows={5} /></label>
            {notice && <p className={notice.ok ? 'is-ok' : 'is-error'}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
            <footer><button onClick={() => save('revision_requested')} disabled={saving}><PencilLine />수정 요청</button><button onClick={() => save('approved')} disabled={saving}><CheckCircle weight="fill" />첨삭 완료</button></footer>
          </aside>
        </>}
      </div>
    </main>
  )
}

function splitGeneratedText(text, draft) {
  const coverItems = Array.isArray(draft?.coverItems) ? draft.coverItems : []
  return String(text || '').split(/\n\n+/).map((block, index) => {
    const [title, ...body] = block.split('\n')
    const answer = body.join('\n')
    const source = coverItems[index]
    if (!source) return { title: title || '자기소개서', body: answer }
    const limit = Math.max(100, Math.min(2000, Number(source.limit) || 700))
    const minLength = Math.max(50, Math.min(limit, Number(source.minLength) || Math.round((limit * 0.72) / 50) * 50))
    return { title: title || '자기소개서', body: answer, count: answer.trim().length, minLength, limit }
  }).filter(item => item.title || item.body)
}

function reviewAnswerBoxHeight(limit) {
  return Math.max(170, Math.ceil(limit / 52) * 22 + 42)
}

function renderHighlightedText(text, highlights) {
  if (!highlights.length) return text
  const normalized = String(text || '')
  const ranges = highlights.map(mark => {
    const index = normalized.indexOf(mark.quote)
    return index < 0 ? null : { start: index, end: index + mark.quote.length, ...mark }
  }).filter(Boolean).sort((a, b) => a.start - b.start)
  if (!ranges.length) return normalized
  const parts = []
  let cursor = 0
  ranges.forEach((range, index) => {
    if (range.start < cursor) return
    if (range.start > cursor) parts.push(normalized.slice(cursor, range.start))
    parts.push(<mark key={`${range.id}-${index}`} style={{ background: range.color }} title={range.note}>{normalized.slice(range.start, range.end)}</mark>)
    cursor = range.end
  })
  if (cursor < normalized.length) parts.push(normalized.slice(cursor))
  return parts
}

function demoRows() {
  return [{
    id: 'cover-demo-1', student_id: 's1', student_name: '이수현', class_id: 'c1', class_name: '3학년 2반',
    sector: 'finance', organization_id: 'ibk', target_name: 'IBK기업은행', role_name: '기업금융',
    revision_no: 2, status: 'submitted', created_at: new Date().toISOString(),
    draft: {
      targetEvidence: '중소기업의 성장과 금융 접근성을 지원하는 역할을 공식 자료에서 확인함.',
      roleNeed: '고객 요구를 정확히 확인하고 규정에 맞게 설명하는 능력과 개인정보 보호 태도',
      action: '거래 자료를 시간순으로 다시 분류하고 원본 영수증과 대조한 뒤 팀원과 수정 전후 금액을 검산함.',
      result: '누락된 거래 3건을 찾아 정산표를 맞추고 검산 칸을 추가함.',
      coverItems: [
        { id: 'motivation', label: '지원동기', minLength: 500, limit: 700 },
        { id: 'job-competency', label: '직무와 전공 역량', minLength: 500, limit: 700 },
        { id: 'experience', label: '경험으로 증명한 강점', minLength: 500, limit: 700 },
        { id: 'growth', label: '입사 후 기여', minLength: 450, limit: 650 },
      ],
    },
    generated_text: '1. 지원동기\n교내 정산 프로젝트에서 정확한 기록이 신뢰를 만든다는 점을 배웠습니다. 중소기업 금융 접근성을 지원하는 기관의 역할과 제 경험을 연결해 지원했습니다.\n\n2. 직무와 전공 역량\n스프레드시트로 거래 자료를 분류하고 원본과 대조하는 검산 과정을 수행했습니다.\n\n3. 경험으로 증명한 강점\n누락된 거래를 찾아 팀원과 수정 전후 금액을 재확인하고 검산표를 개선했습니다.\n\n4. 입사 후 기여\n상품과 규정을 정확히 익히고 고객이 이해하기 쉬운 안내에 기여하겠습니다.',
  }]
}
