import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  Bank,
  BookmarkSimple,
  BookOpen,
  Buildings,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  Eye,
  Factory,
  FileText,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  PencilSimple,
  PlayCircle,
  Plus,
  ShieldCheck,
  Target,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { pushBack, popBack } from '../../lib/backButton.js'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../App.jsx'
import CompactText from '../../components/CompactText.jsx'
import {
  COVER_LETTER_FIELDS,
  COVER_LETTER_QUESTION_LIBRARY,
  COVER_LETTER_SECTOR_CONTENT,
  COVER_LETTER_STEPS,
  INTERVIEW_ORGANIZATIONS,
  INTERVIEW_TRACKS,
} from '../../lib/interviewCareerContent.js'
import '../../styles/interview-career.css'

const SECTORS = [
  { id: 'finance', label: '금융권', icon: Bank },
  { id: 'public', label: '공공기관', icon: Buildings },
  { id: 'enterprise', label: '대기업', icon: Factory },
]

const SECTION_META = {
  pathways: { title: '지원처별 면접 심화', eyebrow: '기초 다음 단계' },
  institutions: { title: '기업·기관 연구소', eyebrow: '지원처 전수 준비' },
  cover: { title: '자기소개서 완성실', eyebrow: '작성부터 첨삭까지' },
}

const STATUS_LABELS = {
  submitted: '첨삭 대기',
  in_review: '선생님 확인 중',
  revision_requested: '수정 요청',
  approved: '첨삭 완료',
}

export default function InterviewCareerLab({ section, onBack, onOpenCover }) {
  const [detail, setDetail] = useState(null)
  const meta = SECTION_META[section] || SECTION_META.pathways
  const backRef = useRef(null)
  backRef.current = () => detail ? setDetail(null) : onBack?.()

  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  if (section === 'pathways') {
    const track = INTERVIEW_TRACKS.find(item => item.id === detail)
    return track
      ? <TrackDetail track={track} onBack={() => setDetail(null)} />
      : <LabFrame meta={meta} onBack={onBack}><TrackList onOpen={setDetail} /></LabFrame>
  }

  if (section === 'institutions') {
    const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === detail)
    return organization
      ? <OrganizationDetail organization={organization} onBack={() => setDetail(null)} onOpenCover={onOpenCover} />
      : <LabFrame meta={meta} onBack={onBack}><OrganizationList onOpen={setDetail} /></LabFrame>
  }

  return <LabFrame meta={meta} onBack={onBack}><CoverLetterBuilder /></LabFrame>
}

function LabFrame({ meta, onBack, children }) {
  return (
    <div className="screen interview-career-screen">
      <header className="appbar interview-career-appbar">
        <button className="appbar-back" onClick={onBack} aria-label="면접 학습으로 돌아가기"><ArrowLeft /></button>
        <div><span className="interview-career-eyebrow">{meta.eyebrow}</span><span className="appbar-title">{meta.title}</span></div>
      </header>
      <div className="screen-body interview-career-body">{children}</div>
    </div>
  )
}

function TrackList({ onOpen }) {
  return (
    <>
      <div className="interview-career-lead"><Target size={22} weight="fill" /><div><strong>세 분야 모두 별도 대비</strong><p>공통 면접 기초를 익힌 뒤 지원처의 역할·고객·현장 상황에 맞춰 답변을 바꿈.</p></div></div>
      <div className="interview-track-list">
        {INTERVIEW_TRACKS.map((track, index) => {
          const Icon = SECTORS[index].icon
          return <button key={track.id} className="interview-track-row" onClick={() => onOpen(track.id)}><span className={`interview-track-icon is-${track.id}`}><Icon size={22} weight="duotone" /></span><span><strong>{track.label}</strong><small>{track.description}</small><em>{track.modules.length}개 심화 모듈</em></span><CaretRight size={18} /></button>
        })}
      </div>
    </>
  )
}

function TrackDetail({ track, onBack }) {
  const Icon = track.id === 'finance' ? Bank : track.id === 'public' ? Buildings : Factory
  const [moduleId, setModuleId] = useState(null)
  const [lessonIndex, setLessonIndex] = useState(0)
  const [done, setDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`iv_track_done_${track.id}`) || '[]')) }
    catch { return new Set() }
  })
  const module = track.modules.find(item => item.id === moduleId)

  function openModule(id) {
    setModuleId(id)
    setLessonIndex(0)
  }

  function completeLesson() {
    const key = `${module.id}:${lessonIndex}`
    const next = new Set(done)
    next.add(key)
    setDone(next)
    localStorage.setItem(`iv_track_done_${track.id}`, JSON.stringify([...next]))
    if (lessonIndex < module.lessons.length - 1) setLessonIndex(value => value + 1)
  }

  if (module) {
    const lesson = module.lessons[lessonIndex]
    const lessonKey = `${module.id}:${lessonIndex}`
    return (
      <div className="screen interview-career-screen">
        <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={() => setModuleId(null)} aria-label="모듈 목록으로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">{track.label} · {lessonIndex + 1}/{module.lessons.length}</span><span className="appbar-title">{module.title}</span></div></header>
        <div className="screen-body interview-career-body">
          <div className="track-lesson-progress"><span>{module.lessons.map((item, index) => <i key={item.title} className={index <= lessonIndex ? 'is-on' : ''} />)}</span><b>{done.has(lessonKey) ? '학습 완료' : '학습 중'}</b></div>
          <section className="track-lesson-card">
            <header><span>핵심 {lessonIndex + 1}</span><h2>{lesson.title}</h2></header>
            <div className="track-lesson-concept"><BookOpen weight="duotone" /><div><b>이렇게 이해함</b><CompactText text={lesson.concept} maxItemChars={68} /></div></div>
            <div className="track-lesson-case"><b>실제 답변에서는</b><p>{lesson.example}</p></div>
            <div className="track-lesson-trap"><WarningCircle weight="fill" /><div><b>이 답변은 피함</b><CompactText text={lesson.trap} maxItemChars={68} /></div></div>
            <div className="track-lesson-practice"><NotePencil weight="duotone" /><div><b>지금 말해 보기</b><CompactText text={lesson.practice} maxItemChars={68} /></div></div>
          </section>
          <footer className="track-lesson-actions"><button onClick={() => setLessonIndex(value => Math.max(0, value - 1))} disabled={lessonIndex === 0}><ArrowLeft />이전 핵심</button><button onClick={completeLesson}>{lessonIndex === module.lessons.length - 1 ? <><CheckCircle weight="fill" />모듈 완료</> : <><PlayCircle weight="fill" />완료하고 다음</>}</button></footer>
        </div>
      </div>
    )
  }
  return (
    <div className="screen interview-career-screen">
      <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={onBack} aria-label="지원처별 면접 심화로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">지원처별 심화</span><span className="appbar-title">{track.label}</span></div></header>
      <div className="screen-body interview-career-body">
        <div className="interview-track-heading"><Icon size={28} weight="duotone" /><CompactText text={track.description} maxItemChars={72} /></div>
        <div className="track-completion-strip"><span>{done.size}/{track.modules.reduce((sum, item) => sum + item.lessons.length, 0)} 핵심 완료</span><div><i style={{ width: `${done.size / track.modules.reduce((sum, item) => sum + item.lessons.length, 0) * 100}%` }} /></div></div>
        <div className="interview-module-list">{track.modules.map((item, index) => { const completed = item.lessons.every((lesson, lessonNo) => done.has(`${item.id}:${lessonNo}`)); return <button key={item.id} className="interview-module-row" onClick={() => openModule(item.id)}><span>{completed ? <CheckCircle weight="fill" /> : index + 1}</span><div><h3>{item.title}</h3><p>{item.focus}</p><small>{item.lessons.length}개 핵심 · 실전 예시 · 답변 과제</small></div><CaretRight /></button> })}</div>
        <section className="interview-practice-band"><h3>이 과정의 완료 기준</h3><CompactText text={track.completion} maxItemChars={68} /><ul><li>분야 공통 4개 모듈을 모두 학습함</li><li>각 핵심의 말하기 과제를 자신의 경험으로 답함</li><li>기업·기관 연구소에서 실제 지원처 자료와 연결함</li></ul></section>
      </div>
    </div>
  )
}

function OrganizationList({ onOpen }) {
  const [sector, setSector] = useState('finance')
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('iv_saved_orgs') || '[]')) }
    catch { return new Set() }
  })
  const rows = useMemo(() => INTERVIEW_ORGANIZATIONS.filter(item => item.sector === sector && (!query || `${item.name} ${item.group} ${item.identity}`.toLowerCase().includes(query.toLowerCase()))), [sector, query])

  function toggleSave(id) {
    const next = new Set(saved)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSaved(next)
    localStorage.setItem('iv_saved_orgs', JSON.stringify([...next]))
  }

  return (
    <>
      <div className="interview-source-note"><ShieldCheck size={20} weight="fill" /><p>연구 자료는 답을 대신 써 주는 문장이 아님. 공식 자료와 내 경험을 연결해 면접·자기소개서에 함께 사용함.</p></div>
      <div className="interview-sector-tabs" role="tablist" aria-label="지원처 분야">{SECTORS.map(item => { const Icon = item.icon; return <button key={item.id} role="tab" aria-selected={sector === item.id} className={sector === item.id ? 'is-active' : ''} onClick={() => setSector(item.id)}><Icon size={17} />{item.label}</button> })}</div>
      <label className="interview-search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="기관·기업 검색" /></label>
      <p className="interview-result-count">{rows.length}곳 · 전체 {INTERVIEW_ORGANIZATIONS.length}곳 · 관심 지원처 {saved.size}곳</p>
      <div className="interview-org-list">{rows.map(item => <div key={item.id} className="interview-org-row"><button className="interview-org-main" onClick={() => onOpen(item.id)}><span><strong>{item.name}</strong><em>{item.group}</em><small>{item.identity}</small></span><CaretRight size={18} /></button><button className={`interview-save ${saved.has(item.id) ? 'is-saved' : ''}`} onClick={() => toggleSave(item.id)} aria-label={`${item.name} ${saved.has(item.id) ? '관심 해제' : '관심 저장'}`}><BookmarkSimple size={19} weight={saved.has(item.id) ? 'fill' : 'regular'} /></button></div>)}</div>
    </>
  )
}

function OrganizationDetail({ organization, onBack, onOpenCover }) {
  const sectorLabel = SECTORS.find(item => item.id === organization.sector)?.label
  const [checks, setChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`iv_org_checks_${organization.id}`) || '{}') }
    catch { return {} }
  })
  const [courseDone, setCourseDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`iv_org_course_${organization.id}`) || '[]')) }
    catch { return new Set() }
  })

  function toggleCheck(index) {
    const next = { ...checks, [index]: !checks[index] }
    setChecks(next)
    localStorage.setItem(`iv_org_checks_${organization.id}`, JSON.stringify(next))
  }

  function bridgeToCover() {
    localStorage.setItem('iv_cover_seed', JSON.stringify({ sector: organization.sector, organizationId: organization.id, targetName: organization.name, targetEvidence: organization.identity, role: organization.roles[0] }))
    onOpenCover?.()
  }

  function toggleCourse(id) {
    const next = new Set(courseDone)
    if (next.has(id)) next.delete(id); else next.add(id)
    setCourseDone(next)
    localStorage.setItem(`iv_org_course_${organization.id}`, JSON.stringify([...next]))
  }

  return (
    <div className="screen interview-career-screen">
      <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={onBack} aria-label="기업·기관 목록으로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">{sectorLabel} · {organization.group}</span><span className="appbar-title">{organization.name}</span></div></header>
      <div className="screen-body interview-career-body">
        <section className="interview-org-identity"><h2>핵심 정체성</h2><CompactText text={organization.identity} maxItemChars={72} /></section>
        <section className="interview-detail-section organization-course"><header><div><h3>이 지원처 면접 완성과정</h3><p className="interview-section-help">기관 이름만 외우지 않고 5개 결과물을 차례로 완성함.</p></div><b>{courseDone.size}/5</b></header>{organization.interviewCourse.map((stage, index) => <details key={stage.id} open={index === 0}><summary><span>{courseDone.has(stage.id) ? <CheckCircle weight="fill" /> : index + 1}</span><div><strong>{stage.title}</strong><small>{stage.goal}</small></div><CaretRight /></summary><div className="organization-course-body"><ul>{stage.tasks.map(task => <li key={task}>{task}</li>)}</ul><p><b>완성 결과물</b>{stage.output}</p><button className={courseDone.has(stage.id) ? 'is-done' : ''} onClick={() => toggleCourse(stage.id)}>{courseDone.has(stage.id) ? '완료 취소' : '이 단계 완료'}</button></div></details>)}</section>
        <section className="interview-detail-section"><h3>연결할 직무</h3><div className="interview-chip-row">{organization.roles.map(role => <span key={role}>{role}</span>)}</div></section>
        <section className="interview-detail-section organization-evidence"><h3>답변에서 증명할 기준과 실례</h3><p className="interview-section-help">가치 단어만 말하지 않고 아래와 같은 행동·결과로 증명함.</p>{organization.evidenceExamples.map(item => <article key={item.value}><header><CheckCircle size={18} weight="fill" /><strong>{item.value}</strong></header><ul>{item.examples.map(example => <li key={example}>{example}</li>)}</ul></article>)}</section>
        <section className="interview-detail-section organization-questions"><h3>예상 질문과 모범답안</h3><p className="interview-section-help">먼저 내 경험으로 말한 뒤 답변 골격과 비교함. 대괄호는 반드시 자신의 사실로 바꿈.</p>{organization.questions.map((item, index) => <details key={item.question} open={index === 0}><summary><span>Q{index + 1}</span>{item.question}</summary><div><b>답변 순서</b><p>{item.answerGuide}</p><b>모범답안</b><p>{item.model}</p></div></details>)}</section>
        <section className="interview-detail-section organization-checks"><h3>공식 자료 확인표</h3><p className="interview-section-help">체크 표시만 하는 목록이 아니라 실제 확인 결과를 메모할 순서임.</p>{organization.officialChecks.map((item, index) => <button key={item.title} className={checks[index] ? 'is-done' : ''} onClick={() => toggleCheck(index)}><span>{checks[index] ? <CheckCircle weight="fill" /> : <ClipboardText />}</span><div><strong>{item.title}</strong><p>{item.method}</p></div></button>)}</section>
        <section className="organization-cover-bridge"><FileText size={24} weight="duotone" /><div><strong>자기소개서와 바로 연결</strong><p>{organization.coverLetterBridge}</p></div><button onClick={bridgeToCover}>이 기관으로 작성 시작<CaretRight /></button></section>
        <details className="organization-cover-sample"><summary><FileText weight="duotone" /><span><b>{organization.name} 완성 예시 자기소개서</b><small>가상 학생의 구조 예시 · 사실과 수치는 반드시 내 경험으로 교체</small></span><CaretRight /></summary><div>{organization.sampleCoverLetter.map(item => <section key={item.title}><h3>{item.title}</h3><p>{item.body}</p></section>)}</div></details>
        <a className="interview-official-link" href={organization.officialUrl} target="_blank" rel="noreferrer">공식 사이트에서 최신 정보 확인<ArrowSquareOut size={17} /></a>
        <p className="interview-asof">콘텐츠 기준 {organization.verifiedAt} · 실제 지원은 현재 채용공고가 최우선</p>
      </div>
    </div>
  )
}

function CoverLetterBuilder() {
  const { profile } = useAuth() ?? {}
  const seed = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('iv_cover_seed') || '{}') }
    catch { return {} }
  }, [])
  const [draft, setDraft] = useState(() => {
    try {
      const restored = { sector: 'finance', ...JSON.parse(localStorage.getItem('iv_cover_draft') || '{}'), ...seed }
      const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === restored.organizationId)
      const coverItems = Array.isArray(restored.coverItems) && restored.coverItems.length
        ? restored.coverItems
        : defaultCoverItems(restored.sector, organization, restored)
      return { ...restored, coverItems }
    } catch { return { sector: 'finance', coverItems: [], ...seed } }
  })
  const [stepIndex, setStepIndex] = useState(0)
  const [view, setView] = useState('write')
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const previewRef = useRef(null)
  const sector = COVER_LETTER_SECTOR_CONTENT[draft.sector] || COVER_LETTER_SECTOR_CONTENT.finance
  const organizations = INTERVIEW_ORGANIZATIONS.filter(item => item.sector === draft.sector)
  const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === draft.organizationId)
  const step = COVER_LETTER_STEPS[stepIndex]
  const stepFields = COVER_LETTER_FIELDS.filter(field => field.step === step.id)
  const completed = COVER_LETTER_FIELDS.filter(field => String(draft[field.key] || '').trim().length >= field.minLength).length
  const pct = Math.round(completed / COVER_LETTER_FIELDS.length * 100)
  const missing = COVER_LETTER_FIELDS.filter(field => String(draft[field.key] || '').trim().length < field.minLength)
  const questionItems = Array.isArray(draft.coverItems) ? draft.coverItems : []
  const questionProblems = questionItems.length < 2
    ? ['자기소개서 문항을 2개 이상 구성해 주세요.']
    : questionItems.filter(item => String(item.answer || '').trim().length < 80).map(item => `${item.label} 답변을 80자 이상 작성해 주세요.`)
  const ready = missing.length === 0 && questionProblems.length === 0
  const generated = useMemo(() => buildCoverLetter(draft, organization), [draft, organization])

  useEffect(() => { if (profile?.id) loadHistory() }, [profile?.id])

  async function loadHistory() {
    const { data } = await supabase.rpc('rpc_my_cover_letters')
    setHistory(Array.isArray(data) ? data : [])
  }

  function update(key, value) {
    const next = { ...draft, [key]: value }
    if (key === 'sector') Object.assign(next, { organizationId: '', targetName: '', targetEvidence: '', role: '', coverItems: defaultCoverItems(value, null, next) })
    if (key === 'organizationId') {
      const org = INTERVIEW_ORGANIZATIONS.find(item => item.id === value)
      Object.assign(next, { targetName: org?.name || '', targetEvidence: org?.identity || '', role: org?.roles?.[0] || '', coverItems: org ? defaultCoverItems(org.sector, org, next) : next.coverItems })
    }
    setDraft(next)
    localStorage.setItem('iv_cover_draft', JSON.stringify(next))
    localStorage.removeItem('iv_cover_seed')
    setNotice(null)
  }

  function goNext() {
    const unfinished = stepFields.find(field => String(draft[field.key] || '').trim().length < field.minLength)
    if (unfinished) {
      setNotice({ ok: false, text: `${unfinished.label} 내용을 조금 더 구체적으로 채워 주세요.` })
      document.getElementById(`cover-${unfinished.key}`)?.focus()
      return
    }
    if (step.id === 'questions' && questionProblems.length) {
      setNotice({ ok: false, text: questionProblems[0] })
      return
    }
    setNotice(null)
    if (stepIndex < COVER_LETTER_STEPS.length - 1) setStepIndex(value => value + 1)
  }

  function openPreview() {
    if (missing.length) {
      const targetStep = COVER_LETTER_STEPS.findIndex(item => item.id === missing[0].step)
      setStepIndex(Math.max(0, targetStep))
      setNotice({ ok: false, text: `${missing[0].label}부터 완성하면 전체 초안을 만들 수 있어요.` })
      return
    }
    if (questionProblems.length) {
      setStepIndex(COVER_LETTER_STEPS.findIndex(item => item.id === 'questions'))
      setNotice({ ok: false, text: questionProblems[0] })
      return
    }
    setView('preview')
    setNotice(null)
  }

  async function downloadPdf() {
    if (!previewRef.current || pdfBusy) return
    setPdfBusy(true)
    setNotice(null)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const margin = 12
      const width = 210 - margin * 2
      const pageHeight = 297 - margin * 2
      const imageHeight = canvas.height * width / canvas.width
      const image = canvas.toDataURL('image/jpeg', 0.94)
      let position = margin
      let remaining = imageHeight
      pdf.addImage(image, 'JPEG', margin, position, width, imageHeight)
      while (remaining > pageHeight) {
        remaining -= pageHeight
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(image, 'JPEG', margin, position, width, imageHeight)
      }
      const safeName = String(draft.targetName || '지원처').replace(/[\\/:*?"<>|]/g, '')
      pdf.save(`${safeName}_자기소개서_${new Date().toISOString().slice(0, 10)}.pdf`)
      setNotice({ ok: true, text: 'PDF 파일을 저장했어요.' })
    } catch {
      setNotice({ ok: false, text: 'PDF를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
    } finally {
      setPdfBusy(false)
    }
  }

  async function submitForReview() {
    if (!ready || submitting) { openPreview(); return }
    setSubmitting(true)
    setNotice(null)
    const { data, error } = await supabase.rpc('rpc_submit_cover_letter', { p_sector: draft.sector, p_organization_id: draft.organizationId || null, p_target_name: draft.targetName, p_role: draft.role, p_draft: draft, p_generated_text: generated.map(item => `${item.title}\n${item.body}`).join('\n\n') })
    setSubmitting(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: data?.error === 'no_class' ? '소속 학급을 확인한 뒤 다시 요청해 주세요.' : '첨삭 요청을 보내지 못했어요. 연결 상태를 확인해 주세요.' })
      return
    }
    setNotice({ ok: true, text: '담당 선생님께 첨삭을 요청했어요. 수정 전 초안도 이력에 남아요.' })
    loadHistory()
  }

  if (view === 'preview') {
    return (
      <div className="cover-preview-screen">
        <div className="cover-preview-tools"><button onClick={() => setView('write')}><PencilSimple />계속 수정</button><button onClick={downloadPdf} disabled={pdfBusy}><DownloadSimple />{pdfBusy ? 'PDF 만드는 중' : 'PDF 저장'}</button></div>
        <CoverPreview ref={previewRef} draft={draft} organization={organization} generated={generated} />
        {notice && <p className={`cover-notice ${notice.ok ? 'is-ok' : 'is-error'}`}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
        <button className="cover-submit-review" onClick={submitForReview} disabled={submitting}><PaperPlaneTilt weight="fill" />{submitting ? '보내는 중' : '선생님께 첨삭 요청'}</button>
        <CoverHistory history={history} />
      </div>
    )
  }

  return (
      <div className="cover-builder">
      <div className="cover-progress"><div><strong>{sector.headline}</strong><span>{completed}/{COVER_LETTER_FIELDS.length}</span></div><div><i style={{ width: `${pct}%` }} /></div><p>자동 저장됨 · 한 단계씩 점검한 뒤 완성본으로 연결함</p></div>
      <nav className="cover-step-tabs" aria-label="자기소개서 작성 단계">{COVER_LETTER_STEPS.map((item, index) => <button key={item.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-past' : ''} onClick={() => setStepIndex(index)}><span>{index < stepIndex ? <CheckCircle weight="fill" /> : index + 1}</span><b>{item.title.replace(/^\d+\.\s*/, '')}</b></button>)}</nav>
      <section className="cover-step-heading"><span>STEP {stepIndex + 1}</span><h2>{step.title.replace(/^\d+\.\s*/, '')}</h2><p>{step.check}</p></section>
      {step.id === 'target' && <><div className="cover-sector-picker">{SECTORS.map(item => { const Icon = item.icon; return <button key={item.id} className={draft.sector === item.id ? 'is-active' : ''} onClick={() => update('sector', item.id)}><Icon weight={draft.sector === item.id ? 'fill' : 'regular'} /><b>{item.label}</b><small>{COVER_LETTER_SECTOR_CONTENT[item.id].focus[0]}</small></button> })}</div><label className="cover-org-select"><span>연구한 지원처 불러오기</span><select value={draft.organizationId || ''} onChange={event => update('organizationId', event.target.value)}><option value="">직접 입력</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.group}</option>)}</select></label><div className="cover-sector-focus">{sector.focus.map(item => <span key={item}><CheckCircle weight="fill" />{item}</span>)}</div>{organization && <details className="cover-org-sample"><summary><FileText weight="duotone" /><span><b>{organization.name} 완성 예시 보기</b><small>구조만 참고하고 경험·수치 복사는 금지</small></span><CaretRight /></summary><div>{organization.sampleCoverLetter.map(item => <section key={item.title}><h3>{item.title}</h3><p>{item.body}</p></section>)}</div></details>}</>}
      {step.id === 'questions' && <QuestionComposer sector={draft.sector} organization={organization} items={questionItems} draft={draft} onChange={items => update('coverItems', items)} />}
      {step.id === 'audit' ? <section className="cover-ready"><FileText weight="duotone" /><h3>{ready ? '완성본을 만들 준비가 됐어요' : `${missing.length + questionProblems.length}가지를 더 확인해요`}</h3><p>{missing.length ? missing.map(item => item.label).join(' · ') : questionProblems.length ? questionProblems[0] : `${questionItems.length}개 문항을 화면에서 먼저 읽고 PDF 저장 또는 선생님 첨삭 요청으로 이어갈 수 있어요.`}</p><button onClick={openPreview} disabled={!ready}><Eye weight="fill" />완성본 생성·확인</button></section> : step.id !== 'questions' && <div className="cover-fields">{stepFields.map(field => <CoverField key={field.key} field={field} value={draft[field.key] || ''} sector={draft.sector} onChange={value => update(field.key, value)} />)}</div>}
      {notice && <p className={`cover-notice ${notice.ok ? 'is-ok' : 'is-error'}`}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
      <footer className="cover-step-actions"><button onClick={() => setStepIndex(value => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft />이전</button>{stepIndex < COVER_LETTER_STEPS.length - 1 ? <button className="is-primary" onClick={goNext}>다음 단계<CaretRight /></button> : <button className="is-primary" onClick={openPreview} disabled={!ready}><Eye />완성본 보기</button>}</footer>
      <CoverHistory history={history} />
    </div>
  )
}

function defaultCoverItems(sector, organization, draft) {
  const ids = organization?.recommendedQuestionIds || (sector === 'finance'
    ? ['motivation', 'job-competency', 'customer', 'ethics', 'growth']
    : sector === 'public'
      ? ['motivation', 'job-competency', 'public-value', 'safety', 'collaboration']
      : ['motivation', 'job-competency', 'problem-solving', 'quality', 'collaboration'])
  return ids.map(id => {
    const template = COVER_LETTER_QUESTION_LIBRARY.find(item => item.id === id)
    return { ...template, instanceId: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, answer: seedQuestionAnswer(id, draft) }
  }).filter(item => item.id)
}

function seedQuestionAnswer(id, draft) {
  if (id === 'motivation') return `${draft.motivation || ''} ${draft.targetEvidence || ''}`.trim()
  if (id === 'job-competency') return `${draft.roleNeed || ''} ${draft.majorSkill || ''}`.trim()
  if (['experience', 'problem-solving', 'quality', 'safety', 'collaboration', 'customer', 'ethics', 'public-value'].includes(id)) return `${draft.experience || ''} ${draft.action || ''} ${draft.result || ''}`.trim()
  if (id === 'growth') return String(draft.contribution || '').trim()
  return ''
}

function QuestionComposer({ sector, organization, items, draft, onChange }) {
  const [showLibrary, setShowLibrary] = useState(items.length === 0)
  const [showCustom, setShowCustom] = useState(false)
  const [custom, setCustom] = useState({ label: '', question: '', limit: 700 })
  const available = COVER_LETTER_QUESTION_LIBRARY.filter(item => item.sectors.includes(sector) && !items.some(selected => selected.id === item.id && !selected.custom))

  function addTemplate(template) {
    onChange([...items, { ...template, instanceId: `${template.id}-${Date.now()}`, answer: seedQuestionAnswer(template.id, draft) }])
  }

  function addCustom() {
    if (custom.label.trim().length < 2 || custom.question.trim().length < 8) return
    onChange([...items, { id: `custom-${Date.now()}`, instanceId: `custom-${Date.now()}`, custom: true, label: custom.label.trim(), question: custom.question.trim(), purpose: '지원처가 요구한 내용을 빠짐없이 자신의 근거로 작성함.', required: ['질문의 핵심 요구', '내 행동 근거', '지원 직무 연결'], limit: Math.max(200, Math.min(2000, Number(custom.limit) || 700)), answer: '' }])
    setCustom({ label: '', question: '', limit: 700 })
    setShowCustom(false)
  }

  function updateItem(index, changes) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }

  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <section className="cover-question-composer">
      <div className="cover-question-toolbar"><div><b>{organization ? `${organization.name} 추천 문항` : '지원처 문항 구성'}</b><p>공고의 실제 문항과 글자 수가 다르면 직접 수정함.</p></div><button onClick={() => setShowLibrary(value => !value)}><Plus />문항 선택</button><button onClick={() => setShowCustom(value => !value)}><NotePencil />직접 추가</button></div>
      {showLibrary && <div className="cover-question-library">{available.length ? available.map(item => <button key={item.id} onClick={() => addTemplate(item)}><span><b>{item.label}</b><small>{item.question}</small></span><Plus /></button>) : <p>이 분야에서 추가할 수 있는 기본 문항을 모두 선택했어요.</p>}</div>}
      {showCustom && <div className="cover-custom-question"><label><span>항목 이름</span><input value={custom.label} onChange={event => setCustom(value => ({ ...value, label: event.target.value }))} placeholder="예: 당행 인재상" /></label><label><span>실제 질문</span><textarea value={custom.question} onChange={event => setCustom(value => ({ ...value, question: event.target.value }))} placeholder="채용공고의 자기소개서 문항을 입력" rows={3} /></label><label><span>글자 수</span><input type="number" min="200" max="2000" step="50" value={custom.limit} onChange={event => setCustom(value => ({ ...value, limit: event.target.value }))} /></label><button onClick={addCustom}><Plus />이 문항 추가</button></div>}
      <div className="cover-selected-questions">{items.map((item, index) => { const count = String(item.answer || '').length; return <article key={item.instanceId || `${item.id}-${index}`}><header><span>{index + 1}</span><div><b>{item.label}</b><p>{item.question}</p></div><div className="cover-question-order"><button onClick={() => move(index, -1)} disabled={index === 0} aria-label="위로 이동"><ArrowUp /></button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="아래로 이동"><ArrowDown /></button><button onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label="문항 삭제"><Trash /></button></div></header><div className="cover-question-purpose"><b>평가 의도</b><p>{item.purpose}</p><span>{item.required.map(value => <em key={value}>{value}</em>)}</span></div><textarea value={item.answer || ''} onChange={event => updateItem(index, { answer: event.target.value.slice(0, item.limit) })} placeholder="근거 은행에서 관련 경험을 가져와 질문에 맞게 다시 구성" rows={7} /><footer><button onClick={() => updateItem(index, { answer: seedQuestionAnswer(item.id, draft) })}>내 근거 가져오기</button><span className={count >= 80 ? 'is-ready' : ''}>{count}/{item.limit}자</span></footer></article> })}</div>
      {!items.length && <div className="cover-question-empty"><ClipboardText /><b>제출할 문항을 먼저 구성해요</b><p>추천 문항을 고르거나 지원처 공고의 문항을 직접 추가함.</p></div>}
    </section>
  )
}

function CoverField({ field, value, sector, onChange }) {
  const current = String(value).trim().length
  const ready = current >= field.minLength
  return (
    <article className={`cover-field-card ${ready ? 'is-ready' : ''}`}>
      <header><div><span>{ready ? <CheckCircle weight="fill" /> : <PencilSimple />}</span><strong>{field.label}</strong></div><small className={ready ? 'is-ready' : ''}>{current}/{field.minLength}자 기준</small></header>
      <div className="cover-field-guide"><div><b>꼭 넣기</b><ul>{field.required.map(item => <li key={item}>{item}</li>)}</ul></div><p><WarningCircle weight="fill" /><span><b>주의</b>{field.caution}</span></p></div>
      {field.showExample !== false && <details><summary>이 분야의 구체적 예시 보기</summary><div className="cover-example-box"><b>구조 참고</b><p>{field.examples[sector]}</p><small>기관명·경험·수치는 내 사실로 바꿔 작성함.</small></div></details>}
      <textarea id={`cover-${field.key}`} value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} rows={field.key === 'action' || field.key === 'motivation' ? 6 : 4} />
    </article>
  )
}

const CoverPreview = forwardRef(function CoverPreview({ draft, organization, generated }, ref) {
  return (
    <article ref={ref} className="cover-document">
      <header><div><span>자기소개서 완성본</span><h1>{draft.targetName}</h1><p>{draft.role} 지원</p></div><div><b>{COVER_LETTER_SECTOR_CONTENT[draft.sector]?.label}</b><small>{new Date().toLocaleDateString('ko-KR')}</small></div></header>
      {organization && <section className="cover-document-source"><ShieldCheck weight="fill" /><p><b>지원처 연구 연결</b>{organization.identity}</p></section>}
      {generated.map(item => <section key={item.title}><h2>{item.title}</h2>{item.question && <small>{item.question}</small>}<p>{item.body}</p></section>)}
      <footer><p>제출 전 확인: 학교명·가족관계 등 블라인드 정보, 다른 회사명, 사실과 다른 수치가 없는지 확인함.</p><span>설탕과소금 스킬캠퍼스 · 학생 작성본</span></footer>
    </article>
  )
})

function buildCoverLetter(draft, organization) {
  const orgName = draft.targetName || organization?.name || '지원처'
  if (Array.isArray(draft.coverItems) && draft.coverItems.length) {
    return draft.coverItems.map((item, index) => ({ title: `${index + 1}. ${item.label}`, question: item.question, body: String(item.answer || '').trim() }))
  }
  return [
    { title: '1. 지원동기', body: `${draft.motivation || ''} ${draft.targetEvidence || ''} 이러한 이유로 ${orgName}의 ${draft.role || '지원 직무'}에 지원했습니다.`.trim() },
    { title: '2. 직무와 전공 역량', body: `${draft.roleNeed || ''} 저는 ${draft.major || '전공'} 과정에서 ${draft.majorSkill || ''} 이 경험을 지원 직무의 기본기로 활용하겠습니다.`.trim() },
    { title: '3. 경험으로 증명한 강점', body: `${draft.experience || ''} 이를 해결하기 위해 ${draft.action || ''} 그 결과 ${draft.result || ''}`.trim() },
    { title: '4. 입사 후 기여', body: `${draft.contribution || ''} 맡은 업무의 기준을 정확히 익히고, 확인 가능한 행동과 결과로 신뢰받는 구성원이 되겠습니다.`.trim() },
  ]
}

function CoverHistory({ history }) {
  if (!history.length) return null
  return <section className="cover-history"><h3><ChatCircleText weight="duotone" />첨삭 이력</h3>{history.slice(0, 5).map(item => { const highlights = Array.isArray(item.section_feedback?.highlights) ? item.section_feedback.highlights : []; return <article key={item.id}><header><b>{item.target_name}</b><span className={`is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span></header><small>{new Date(item.created_at).toLocaleString('ko-KR')}</small>{item.feedback_summary && <p><strong>선생님 전체 조언</strong>{item.feedback_summary}</p>}{highlights.length > 0 && <div className="cover-history-highlights"><b>문장별 메모 {highlights.length}개</b>{highlights.map(mark => <blockquote key={mark.id} style={{ '--mark-color': mark.color }}><span>“{mark.quote}”</span><p>{mark.note}</p></blockquote>)}</div>}</article> })}</section>
}
