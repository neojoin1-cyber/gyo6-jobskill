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

function applicationLabel(row) {
  return row?.draft?.recruitmentTitle || row?.recruitment_title || `${row?.target_name || '지원처'} 채용`
}

function applicationDeadline(row) {
  return row?.draft?.applicationDeadline || row?.application_deadline || ''
}

function applicationKey(row) {
  return row?.draft?.applicationProjectId || row?.application_key || `${row?.student_id}-${row?.target_name}-${row?.role_name}`
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
  recruitmentTitle: '채용회차',
  proof: '확인 자료',
  situation: '상황',
  task: '맡은 역할',
}

const HIDDEN_DRAFT_KEYS = new Set([
  'coverSignature', 'documentType', 'introduction', 'motivation', 'organizationId',
  'role', 'sector', 'targetName', 'linkedAt', 'generatedText', 'applicationProjectId',
  'recruitmentTitle', 'applicationDeadline', 'applicationStatus',
])

function draftEvidenceEntries(draft) {
  if (draft?.documentType === 'interview-script') return []
  return Object.entries(draft || {})
    .filter(([key, value]) => !HIDDEN_DRAFT_KEYS.has(key) && typeof value === 'string' && value.trim())
    .map(([key, value]) => ({ key, label: DRAFT_EVIDENCE_LABELS[key] || key, value }))
}

function sourceEvidenceEntries(sourceCover) {
  return Object.entries(sourceCover || {})
    .filter(([key, value]) => !['organizationId', 'applicationProjectId'].includes(key) && typeof value === 'string' && value.trim())
    .map(([key, value]) => ({ key, label: DRAFT_EVIDENCE_LABELS[key] || key, value }))
}

export default function CoverLetterReviewScreen({ onBack, initialClassId, demo = false }) {
  const { profile, isTrial } = useAuth() ?? {}
  const demoMode = demo || Boolean(isTrial)
  const demoItems = useMemo(() => demoMode ? demoRows() : [], [demoMode])
  const [classes, setClasses] = useState(demoMode ? [{ id: 'c1', name: '3학년 2반' }] : [])
  const [classId, setClassId] = useState(initialClassId || (demoMode ? 'c1' : ''))
  const [rows, setRows] = useState(demoItems)
  const [selectedId, setSelectedId] = useState(demoItems[0]?.id || null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('pending')
  const [summary, setSummary] = useState('')
  const [feedback, setFeedback] = useState({})
  const [selection, setSelection] = useState(null)
  const [selectionNote, setSelectionNote] = useState('')
  const [selectionColor, setSelectionColor] = useState('#fef08a')
  const [loading, setLoading] = useState(!demoMode)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => { if (!demoMode) loadClasses() }, [demoMode, profile?.id])
  useEffect(() => { if (!demoMode) loadRows() }, [demoMode, profile?.id, classId])
  useEffect(() => {
    if (!demoMode) return
    setClasses([{ id: 'c1', name: '3학년 2반' }])
    setClassId(current => current || 'c1')
    setRows(demoItems)
    setSelectedId(current => demoItems.some(item => item.id === current) ? current : demoItems[0]?.id || null)
    setLoading(false)
  }, [demoMode, demoItems])

  async function loadClasses() {
    const teacherId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (!teacherId) return
    const { data } = await supabase.from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', teacherId)
    const list = (data || []).map(item => ({ id: item.class_id, name: item.classes?.name || '이름 없는 학급' }))
    setClasses(list)
    if (!classId && list.length === 1) setClassId(list[0].id)
  }

  async function loadRows() {
    if (demoMode) return
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
    const matchesQuery = !query || `${item.student_name} ${item.target_name} ${item.role_name} ${applicationLabel(item)}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = status === 'all' || (status === 'pending' ? ['submitted', 'in_review'].includes(item.status) : item.status === status)
    return matchesQuery && matchesStatus
  }), [rows, query, status])
  const selected = visible.find(item => item.id === selectedId) || null
  const relatedVersions = useMemo(() => selected ? rows
    .filter(item => applicationKey(item) === applicationKey(selected))
    .sort((a, b) => b.revision_no - a.revision_no) : [], [rows, selected])
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

  useEffect(() => {
    if (!visible.some(item => item.id === selectedId)) setSelectedId(visible[0]?.id || null)
  }, [classId, query, rows, status])

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
    if (demoMode) {
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
          <div><span>TEACHER WRITING COACH</span><h1>자기소개서·면접답변 첨삭실</h1><p>지원처별 작성본을 같은 근거와 수정 이력으로 지도함.</p></div>
        <div className="cover-review-summary"><b>{rows.filter(item => ['submitted', 'in_review'].includes(item.status)).length}</b><span>첨삭 대기</span></div>
      </header>

      <div className="cover-review-layout">
        <aside className="cover-review-queue">
          <div className="cover-review-filters">
            <select value={classId} onChange={event => setClassId(event.target.value)}><option value="">담당 학급 전체</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <label><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="학생·지원처·채용회차 검색" /></label>
            <div><button className={status === 'pending' ? 'is-on' : ''} onClick={() => setStatus('pending')}>대기</button><button className={status === 'revision_requested' ? 'is-on' : ''} onClick={() => setStatus('revision_requested')}>수정</button><button className={status === 'approved' ? 'is-on' : ''} onClick={() => setStatus('approved')}>완료</button><button className={status === 'all' ? 'is-on' : ''} onClick={() => setStatus('all')}>전체</button></div>
          </div>
          <div className="cover-review-list">
            {loading && <p className="cover-review-empty">첨삭 요청을 불러오는 중입니다.</p>}
            {!loading && visible.length === 0 && <p className="cover-review-empty">조건에 맞는 제출물이 없습니다.</p>}
            {visible.map(item => <button key={item.id} data-application={applicationKey(item)} className={selectedId === item.id ? 'is-on' : ''} onClick={() => setSelectedId(item.id)}><span><Student weight="duotone" /></span><div><header><b>{item.student_name}</b><em className={`is-${item.status}`}>{STATUS[item.status]}</em></header><strong>{documentLabel(item)} · {applicationLabel(item)}</strong><small>{item.target_name} · {item.role_name} · 작성본 v{item.revision_no}{applicationDeadline(item) ? ` · ${applicationDeadline(item)} 마감` : ''}</small></div></button>)}
          </div>
        </aside>

        {!selected ? <section className="cover-review-no-selection"><FileText /><b>첨삭할 글을 선택하세요</b></section> : <>
          <section className="cover-review-document">
            <header><div><span>{documentLabel(selected)} · {selected.student_name} 학생 · {selected.class_name}</span><h2>{applicationLabel(selected)}</h2><p>{selected.target_name} · {selected.role_name} 지원 · 작성본 v{selected.revision_no}{applicationDeadline(selected) ? ` · ${applicationDeadline(selected)} 마감` : ''}</p></div><em>{STATUS[selected.status]}</em></header>
            <section className="cover-review-application-context"><b>{selected.draft?.documentType === 'interview-script' ? '답변 세트별 첨삭' : '지원 건별 첨삭'}</b><p>{selected.draft?.documentType === 'interview-script' ? `다른 면접 답변 세트와 분리되어 있으며, 연결 자기소개서 “${selected.draft?.sourceCover?.recruitmentTitle || selected.target_name}”의 근거와 함께 확인합니다.` : '같은 학생의 다른 기업·직무·채용회차 작성본과 분리된 문서입니다. 이 지원서 안에서 이전 버전과 수정 방향을 이어서 확인합니다.'}</p>{relatedVersions.length > 1 && <div>{relatedVersions.map(item => <button key={item.id} className={item.id === selected.id ? 'is-on' : ''} onClick={() => { setStatus('all'); setSelectedId(item.id) }}>v{item.revision_no} · {STATUS[item.status]}</button>)}</div>}</section>
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

const DEMO_COVER_ANSWERS = {
  ibkMotivation: `교내 매점 정산 프로젝트에서 기록의 정확성이 곧 상대방의 신뢰라는 점을 배웠습니다. 마감 직전 거래 합계가 맞지 않았을 때 단순히 계산을 다시 하는 데 그치지 않고, 영수증과 판매 기록을 시간순으로 나누어 비교했습니다. 그 결과 누락된 거래 3건을 찾아 정산표를 바로잡았고, 이후에는 입력자와 확인자를 나눈 검산 칸을 추가해 같은 오류가 반복되지 않도록 했습니다. 이 경험을 통해 금융 업무에서는 작은 숫자 하나도 고객의 판단과 조직의 신뢰에 영향을 줄 수 있으며, 확인 과정을 설명 가능한 형태로 남기는 태도가 중요하다는 것을 알았습니다. IBK기업은행이 중소기업과 고객의 성장을 금융으로 지원한다는 점을 공식 채용·사업 자료에서 확인했고, 현장에서 고객의 상황을 정확히 듣고 필요한 절차를 이해하기 쉽게 안내하는 역할에 매력을 느꼈습니다. 저는 숫자를 끝까지 확인하는 습관과 팀원에게 수정 근거를 공유한 경험을 기업금융 업무에 연결하겠습니다. 입행 후에는 상품과 규정을 먼저 정확히 익히고, 상담 내용을 빠짐없이 기록하며, 모르는 내용은 임의로 답하지 않고 확인 후 안내하겠습니다. 고객이 안심하고 다음 결정을 내릴 수 있도록 정확성과 설명 책임을 지키는 행원이 되겠습니다.`,
  ibkCompetency: `상업정보 수업과 교내 정산 프로젝트를 통해 자료를 분류하고 원본과 대조하는 기본 역량을 길렀습니다. 프로젝트에서는 팀원 4명이 일주일 동안 모은 판매 기록을 하나의 스프레드시트로 합치는 역할을 맡았습니다. 처음에는 입력 형식이 서로 달라 날짜와 금액을 정렬해도 오류 지점을 찾기 어려웠습니다. 저는 먼저 날짜, 결제 방식, 품목, 금액의 열 기준을 통일하고 원본 영수증 번호를 함께 적도록 표를 바꿨습니다. 이후 필터 기능으로 중복 항목을 확인하고, 일별 합계와 현금 보유액을 대조해 누락 3건을 찾았습니다. 수정 전후의 금액은 다른 팀원과 교차 검산했고, 변경 이유를 메모 칸에 남겨 담당 교사가 과정을 바로 확인할 수 있게 했습니다. 그 결과 마감 시간 안에 정산표를 완성했으며 다음 활동부터는 같은 양식을 공통 기준으로 사용했습니다. 이 과정에서 도구를 잘 다루는 것보다 어떤 기준으로 확인했는지 설명하고 다른 사람이 다시 검증할 수 있게 만드는 일이 더 중요하다는 점을 배웠습니다. 기업금융 업무에서도 고객이 제출한 자료와 시스템 정보를 정확히 확인하고, 개인정보를 필요한 범위에서만 다루며, 이상한 수치가 보이면 근거를 나누어 점검하겠습니다. 입행 후에는 내부 규정과 상품 지식을 꾸준히 학습해 정확한 자료 처리와 신뢰할 수 있는 고객 안내로 팀에 기여하겠습니다.`,
  ibkExperience: `팀 프로젝트에서 의견 차이를 조정하며 오류를 해결한 경험이 있습니다. 매점 정산표의 합계가 맞지 않자 한 팀원은 시간이 부족하니 차액을 기타 항목으로 처리하자고 했고, 다른 팀원은 전체 자료를 처음부터 다시 입력하자고 했습니다. 저는 두 방법 모두 빠른 마감이나 정확한 원인 확인 중 하나를 놓칠 수 있다고 판단했습니다. 먼저 팀원들에게 차액을 임의로 처리하면 다음 정산에서도 같은 문제가 반복될 수 있다는 점을 설명하고, 20분 동안 오류 가능성이 큰 구간부터 함께 확인하자고 제안했습니다. 역할을 날짜별 원본 확인, 입력값 대조, 수정 금액 검산으로 나누고 저는 두 자료의 번호가 맞지 않는 행을 표시했습니다. 확인 과정에서 영수증은 있지만 표에 없는 거래 2건과 금액이 잘못 입력된 거래 1건을 찾았습니다. 수정 뒤에는 팀원 두 명이 합계를 각각 계산해 같은 결과인지 확인했고, 담당 교사에게 원인과 수정 내역을 함께 보고했습니다. 덕분에 마감 전에 정확한 정산표를 제출했고, 다음 활동에서는 처음부터 영수증 번호와 확인자 칸을 사용해 오류 확인 시간이 줄었습니다. 저는 이 경험으로 협업이 단순히 관계를 좋게 유지하는 것이 아니라, 의견 차이가 생겼을 때 공동 목표와 판단 근거를 분명히 하고 각자의 행동을 연결하는 과정임을 배웠습니다. 입행 후에도 규정과 자료를 기준으로 해결 방향을 제안하겠습니다.`,
  ibkContribution: `입행 초기에는 기업금융 업무에서 사용하는 기본 용어, 고객 확인 절차, 개인정보 보호 기준을 정확히 익히는 데 집중하겠습니다. 교육 내용을 단순히 암기하지 않고 상담 단계별 확인 항목을 제 말로 정리하고, 모르는 사항은 선배에게 질문한 뒤 근거 규정과 함께 기록하겠습니다. 고객을 응대할 때는 요청 내용을 먼저 끝까지 듣고 제가 이해한 내용을 다시 확인해 불필요한 재방문이나 서류 누락을 줄이겠습니다. 교내 정산 프로젝트에서 원본 번호와 검산 칸을 추가해 반복 오류를 줄였던 것처럼, 맡은 업무에서도 작은 불편이나 반복되는 실수를 발견하면 원인을 기록하고 팀이 함께 사용할 수 있는 확인 방법을 제안하겠습니다. 다만 익숙하지 않은 단계에서 임의로 절차를 바꾸지 않고 담당자와 규정을 먼저 확인하겠습니다. 이후에는 중소기업 고객이 필요한 금융 절차와 서류를 이해하기 쉬운 말로 안내할 수 있도록 상품과 산업에 대한 학습 범위를 넓히겠습니다. 상담 후에는 전달한 내용과 후속 일정을 정확히 남겨 다음 담당자도 같은 기준으로 고객을 지원할 수 있게 하겠습니다. 정확한 처리, 이해하기 쉬운 설명, 책임 있는 후속 확인을 매일의 업무 기준으로 삼아 고객이 믿고 다시 찾는 행원으로 성장하겠습니다.`,
  kepcoMotivation: `전기설비 실습에서 작은 결선 오류 하나가 전체 회로의 정상 작동을 막는 경험을 하며 설비 업무의 책임을 배웠습니다. 조별 실습 중 측정값이 기준과 다르게 나왔을 때 처음에는 부품 불량을 의심했지만, 저는 회로도와 실제 배선을 구간별로 비교해 원인을 확인하자고 제안했습니다. 전원을 차단하고 안전 상태를 확인한 뒤 측정 지점을 나누어 점검했고, 단자 한 곳의 오결선을 찾아 바로잡았습니다. 수정 후에는 팀원과 다시 측정해 정상 범위가 나온 것을 확인하고, 오류 위치와 점검 순서를 실습일지에 남겼습니다. 이 경험을 통해 전기설비 업무는 빠르게 손을 움직이는 것보다 안전 절차를 지키고 이상 징후의 근거를 끝까지 확인하는 태도가 중요하다는 것을 알았습니다. 한국전력공사가 안정적인 전력 공급을 위해 설비를 운영하고 점검한다는 점을 공식 자료에서 확인했으며, 국민의 일상과 산업 현장을 뒷받침하는 업무에 제 전공 역량을 쓰고 싶어 지원했습니다. 입사 후에는 작업 전 위험 요인과 절차를 먼저 확인하고, 측정 결과와 조치 내용을 정확히 기록하겠습니다. 혼자 판단하기 어려운 이상은 즉시 보고하고 동료와 교차 확인해 안전을 우선하겠습니다. 반복 실수를 줄이기 위해 실습에서 만든 점검 순서처럼 현장의 기준을 꾸준히 익히며, 안정적인 설비 운영에 신뢰할 수 있는 행동으로 기여하겠습니다.`,
  kepcoCompetency: `전기설비 실습에서 회로도를 기준으로 문제 구간을 좁히고 측정 결과를 기록하는 역량을 길렀습니다. 자동제어 회로를 구성하는 조별 과제에서 전원을 인가했지만 표시등이 켜지지 않는 문제가 발생했습니다. 팀원들은 배선을 모두 다시 연결하자는 의견을 냈지만, 저는 무작정 해체하면 원인을 확인하기 어렵고 같은 실수를 반복할 수 있다고 생각했습니다. 먼저 전원을 차단하고 무전압 상태를 확인한 뒤 회로도를 전원부, 제어부, 출력부로 나눴습니다. 각 구간의 단자 번호와 실제 결선을 한 명이 읽고 다른 한 명이 확인하도록 역할을 정했으며, 저는 측정값과 확인 결과를 실습일지에 기록했습니다. 그 과정에서 제어부 단자 한 곳이 반대로 연결된 것을 발견해 담당 교사의 확인을 받은 뒤 수정했습니다. 재가동 전에는 공구와 주변 정리 상태를 점검했고, 수정 후 정상 측정값과 표시등 작동을 확인했습니다. 과제를 마친 뒤에는 오류 원인, 조치 내용, 다음 점검 순서를 표로 정리해 조원들과 공유했습니다. 이 경험으로 설비 문제 해결에는 안전 확보, 기준 확인, 단계별 측정, 기록과 보고가 함께 필요하다는 점을 배웠습니다. 입사 후에도 작업 절차와 보호구 기준을 철저히 지키고, 이상 징후를 수치와 현상으로 구분해 보고하겠습니다. 선배의 점검 방식을 적극적으로 배우고 반복되는 문제는 기록을 비교해 예방 중심의 설비 관리에 기여하겠습니다.`,
}

function demoGeneratedText(sections) {
  return sections.map(([title, body], index) => `${index + 1}. ${title}\n${body}`).join('\n\n')
}

function demoRows() {
  return [{
    id: 'cover-demo-1', student_id: 's1', student_name: '이수현', class_id: 'c1', class_name: '3학년 2반',
    sector: 'finance', organization_id: 'ibk', target_name: 'IBK기업은행', role_name: '기업금융',
    revision_no: 2, status: 'submitted', created_at: new Date().toISOString(),
    draft: {
      applicationProjectId: 'application-demo-ibk', recruitmentTitle: '2026년 하반기 고졸 신입 채용', applicationDeadline: '2026-09-18',
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
    generated_text: demoGeneratedText([
      ['지원동기', DEMO_COVER_ANSWERS.ibkMotivation],
      ['직무와 전공 역량', DEMO_COVER_ANSWERS.ibkCompetency],
      ['경험으로 증명한 강점', DEMO_COVER_ANSWERS.ibkExperience],
      ['입사 후 기여', DEMO_COVER_ANSWERS.ibkContribution],
    ]),
  }, {
    id: 'cover-demo-2', student_id: 's1', student_name: '이수현', class_id: 'c1', class_name: '3학년 2반',
    sector: 'public', organization_id: 'kepco', target_name: '한국전력공사', role_name: '전기설비',
    revision_no: 1, status: 'revision_requested', created_at: new Date(Date.now() - 86400000).toISOString(),
    draft: {
      applicationProjectId: 'application-demo-kepco', recruitmentTitle: '2026년 2차 고졸 채용', applicationDeadline: '2026-10-02',
      targetEvidence: '안정적인 전력 공급과 설비 안전을 지원 직무의 핵심 기준으로 확인함.',
      action: '배선 실습에서 회로도를 기준으로 측정 지점을 나누고 이상값이 나온 구간을 다시 결선함.',
      result: '오결선 한 곳을 찾아 정상 측정값을 확보하고 점검 순서를 실습일지에 남김.',
      coverItems: [
        { id: 'motivation', label: '지원동기', minLength: 500, limit: 700 },
        { id: 'job-competency', label: '직무역량', minLength: 500, limit: 700 },
      ],
    },
    generated_text: demoGeneratedText([
      ['지원동기', DEMO_COVER_ANSWERS.kepcoMotivation],
      ['직무역량', DEMO_COVER_ANSWERS.kepcoCompetency],
    ]),
  }, {
    id: 'interview-demo-1', student_id: 's2', student_name: '박민준', class_id: 'c1', class_name: '3학년 2반',
    sector: 'finance', organization_id: 'ibk', target_name: 'IBK기업은행', role_name: '개인금융',
    revision_no: 1, status: 'submitted', created_at: new Date(Date.now() - 3600000).toISOString(),
    draft: {
      documentType: 'interview-script', applicationProjectId: 'interview-script-demo-ibk-a', sourceCoverApplicationId: 'application-demo-ibk-a',
      recruitmentTitle: 'IBK기업은행 1차 면접 답변 A', interviewScriptStatus: 'submitted',
      sourceCover: {
        applicationProjectId: 'application-demo-ibk-a', recruitmentTitle: '2026년 하반기 고졸 신입 채용',
        targetName: 'IBK기업은행', role: '개인금융', targetEvidence: '중소기업과 고객의 성장을 지원하는 금융 역할을 공식 자료에서 확인함.',
        action: '교내 매점 정산표의 누락 항목을 원본 영수증과 대조하고 팀원과 교차 검산함.', result: '누락 3건을 수정하고 다음 정산부터 검산 칸을 사용함.',
        coverItems: [{ id: 'motivation', label: '지원동기', answer: '정확한 확인으로 신뢰를 지킨 경험을 고객 금융 업무와 연결해 작성했습니다.' }],
      },
      coverItems: [
        { id: 'introduction', label: '1분 자기소개', minLength: 250, limit: 350 },
        { id: 'motivation', label: '면접 지원동기', minLength: 220, limit: 350 },
        { id: 'closing', label: '마지막 한마디', minLength: 100, limit: 180 },
      ],
    },
    generated_text: '1. 1분 자기소개\n안녕하십니까. 정확한 확인과 꾸준한 개선을 실천해 온 개인금융 지원자입니다. 교내 매점 정산 과정에서 원본 영수증과 거래 자료를 대조해 누락 3건을 찾았고, 팀원과 교차 검산해 정산표를 바로잡았습니다. 이후 검산 칸을 추가해 같은 오류가 반복되지 않도록 했습니다. IBK기업은행에서도 고객의 정보를 정확히 확인하고 이해하기 쉬운 안내로 신뢰를 쌓겠습니다.\n\n2. 면접 지원동기\n정확한 기록과 확인이 고객 신뢰의 출발점이라는 것을 정산 경험에서 배웠습니다. 중소기업과 고객의 성장을 지원하는 IBK기업은행의 역할을 확인했고, 개인금융 업무에서 고객의 상황을 세심하게 듣고 규정에 맞는 안내를 제공하고자 지원했습니다.\n\n3. 마지막 한마디\n오늘 답변드린 교차 검산 경험처럼, 입행 후에도 작은 오류를 지나치지 않고 확인 가능한 행동으로 고객 신뢰에 기여하겠습니다. 면접 기회를 주셔서 감사합니다.',
  }]
}
