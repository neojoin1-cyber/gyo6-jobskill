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
import {
  COVER_EVIDENCE_ACTIONS,
  COVER_EVIDENCE_MAJOR_GROUPS,
  COVER_EVIDENCE_RESULTS,
  COVER_EVIDENCE_SOURCES,
  COVER_FIELD_ASSISTS,
  questionGuide,
} from '../../lib/coverLetterGuidance.js'
import '../../styles/interview-career.css'

const SECTORS = [
  { id: 'finance', label: '금융권', icon: Bank },
  { id: 'public', label: '공공기관', icon: Buildings },
  { id: 'enterprise', label: '대기업', icon: Factory },
]

const SECTION_META = {
  pathways: { title: '지원처별 면접 심화', eyebrow: '기초 다음 단계' },
  institutions: { title: '기업·기관 연구소', eyebrow: '지원처 전수 준비' },
  cover: { title: '나를쓰다', eyebrow: '자기소개서 학습·작성·첨삭' },
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
  const [workspace, setWorkspace] = useState('learn')
  const [view, setView] = useState('write')
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [evidenceBank, setEvidenceBank] = useState(() => Array.isArray(draft.evidenceBank) ? draft.evidenceBank : [])
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

  useEffect(() => {
    if (!profile?.id) return
    loadHistory()
    loadEvidenceBank()
  }, [profile?.id])

  async function loadHistory() {
    const { data } = await supabase.rpc('rpc_my_cover_letters')
    setHistory(Array.isArray(data) ? data : [])
  }

  async function loadEvidenceBank() {
    const { data, error } = await supabase
      .from('cover_letter_evidence')
      .select('id, major_group, source_type, title, situation, task, action, result, proof, skills, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
    if (error || !Array.isArray(data)) return
    const items = data.map(normalizeEvidence)
    setEvidenceBank(items)
    persistEvidenceInDraft(items)
  }

  function persistEvidenceInDraft(items) {
    setDraft(current => {
      const next = { ...current, evidenceBank: items }
      localStorage.setItem('iv_cover_draft', JSON.stringify(next))
      return next
    })
  }

  async function saveEvidence(item) {
    const localItem = { ...item, id: item.id || `local-${Date.now()}`, createdAt: new Date().toISOString() }
    if (profile?.id) {
      const { data, error } = await supabase.from('cover_letter_evidence').insert({
        student_id: profile.id,
        major_group: item.majorGroup,
        source_type: item.sourceType,
        title: item.title,
        situation: item.situation,
        task: item.task,
        action: item.action,
        result: item.result,
        proof: item.proof,
        skills: item.skills,
      }).select('id, major_group, source_type, title, situation, task, action, result, proof, skills, created_at').single()
      if (!error && data) Object.assign(localItem, normalizeEvidence(data))
    }
    const next = [localItem, ...evidenceBank]
    setEvidenceBank(next)
    persistEvidenceInDraft(next)
    setNotice({ ok: true, text: '근거 1장을 저장했어요. 작성 문항에서 바로 불러올 수 있어요.' })
  }

  async function deleteEvidence(item) {
    if (profile?.id && item.id && !String(item.id).startsWith('local-')) {
      await supabase.from('cover_letter_evidence').delete().eq('id', item.id).eq('student_id', profile.id)
    }
    const next = evidenceBank.filter(value => value.id !== item.id)
    setEvidenceBank(next)
    persistEvidenceInDraft(next)
  }

  function useEvidence(item) {
    const next = {
      ...draft,
      majorSkill: draft.majorSkill || `${item.sourceType}에서 ${item.skills.join('·')} 역량을 활용함.`,
      experience: `${item.situation} ${item.task}`.trim(),
      action: item.action,
      result: `${item.result}${item.proof ? ` 확인 근거: ${item.proof}` : ''}`.trim(),
      evidenceBank,
    }
    setDraft(next)
    localStorage.setItem('iv_cover_draft', JSON.stringify(next))
    setWorkspace('write')
    setStepIndex(COVER_LETTER_STEPS.findIndex(value => value.id === 'experience'))
    setNotice({ ok: true, text: '선택한 근거를 경험 단계에 연결했어요. 사실과 표현을 다시 확인해 주세요.' })
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

  function startQuestion(item) {
    const exists = questionItems.some(selected => selected.id === item.id && !selected.custom)
    if (!exists) {
      update('coverItems', [...questionItems, { ...item, instanceId: `${item.id}-${Date.now()}`, answer: seedQuestionAnswer(item.id, draft) }])
    }
    setWorkspace('write')
    setStepIndex(COVER_LETTER_STEPS.findIndex(value => value.id === 'questions'))
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
      <section className="cover-brand-panel">
        <div><span>MY CAREER STORY</span><h2>나를쓰다</h2><p>고르기부터 시작해 내 경험을 근거로 바꾸고, 문항에 맞는 글로 완성함.</p></div>
        <b>{evidenceBank.length}<small>근거 카드</small></b>
      </section>
      <nav className="cover-workspace-tabs" aria-label="나를쓰다 메뉴">
        <button className={workspace === 'learn' ? 'is-on' : ''} onClick={() => setWorkspace('learn')}><BookOpen />배우기</button>
        <button className={workspace === 'evidence' ? 'is-on' : ''} onClick={() => setWorkspace('evidence')}><ClipboardText />근거 찾기</button>
        <button className={workspace === 'write' ? 'is-on' : ''} onClick={() => setWorkspace('write')}><PencilSimple />작성하기</button>
      </nav>
      {workspace === 'learn' && <CoverLearningLibrary onStart={startQuestion} />}
      {workspace === 'evidence' && <EvidenceWorkbench items={evidenceBank} onSave={saveEvidence} onDelete={deleteEvidence} onUse={useEvidence} />}
      {workspace === 'write' && <>
      <div className="cover-progress"><div><strong>{sector.headline}</strong><span>{completed}/{COVER_LETTER_FIELDS.length}</span></div><div><i style={{ width: `${pct}%` }} /></div><p>자동 저장됨 · 한 단계씩 점검한 뒤 완성본으로 연결함</p></div>
      <nav className="cover-step-tabs" aria-label="자기소개서 작성 단계">{COVER_LETTER_STEPS.map((item, index) => <button key={item.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-past' : ''} onClick={() => setStepIndex(index)}><span>{index < stepIndex ? <CheckCircle weight="fill" /> : index + 1}</span><b>{item.title.replace(/^\d+\.\s*/, '')}</b></button>)}</nav>
      <section className="cover-step-heading"><span>STEP {stepIndex + 1}</span><h2>{step.title.replace(/^\d+\.\s*/, '')}</h2><p>{step.check}</p></section>
      {step.id === 'target' && <><div className="cover-sector-picker">{SECTORS.map(item => { const Icon = item.icon; return <button key={item.id} className={draft.sector === item.id ? 'is-active' : ''} onClick={() => update('sector', item.id)}><Icon weight={draft.sector === item.id ? 'fill' : 'regular'} /><b>{item.label}</b><small>{COVER_LETTER_SECTOR_CONTENT[item.id].focus[0]}</small></button> })}</div><label className="cover-org-select"><span>연구한 지원처 불러오기</span><select value={draft.organizationId || ''} onChange={event => update('organizationId', event.target.value)}><option value="">직접 입력</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.group}</option>)}</select></label><div className="cover-sector-focus">{sector.focus.map(item => <span key={item}><CheckCircle weight="fill" />{item}</span>)}</div>{organization && <details className="cover-org-sample"><summary><FileText weight="duotone" /><span><b>{organization.name} 완성 예시 보기</b><small>구조만 참고하고 경험·수치 복사는 금지</small></span><CaretRight /></summary><div>{organization.sampleCoverLetter.map(item => <section key={item.title}><h3>{item.title}</h3><p>{item.body}</p></section>)}</div></details>}</>}
      {step.id === 'questions' && <QuestionComposer sector={draft.sector} organization={organization} items={questionItems} draft={draft} evidenceBank={evidenceBank} onChange={items => update('coverItems', items)} />}
      {step.id === 'audit' ? <section className="cover-ready"><FileText weight="duotone" /><h3>{ready ? '완성본을 만들 준비가 됐어요' : `${missing.length + questionProblems.length}가지를 더 확인해요`}</h3><p>{missing.length ? missing.map(item => item.label).join(' · ') : questionProblems.length ? questionProblems[0] : `${questionItems.length}개 문항을 화면에서 먼저 읽고 PDF 저장 또는 선생님 첨삭 요청으로 이어갈 수 있어요.`}</p><button onClick={openPreview} disabled={!ready}><Eye weight="fill" />완성본 생성·확인</button></section> : step.id !== 'questions' && <div className="cover-fields">{stepFields.map(field => <CoverField key={field.key} field={field} value={draft[field.key] || ''} sector={draft.sector} onChange={value => update(field.key, value)} />)}</div>}
      {notice && <p className={`cover-notice ${notice.ok ? 'is-ok' : 'is-error'}`}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
      <footer className="cover-step-actions"><button onClick={() => setStepIndex(value => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft />이전</button>{stepIndex < COVER_LETTER_STEPS.length - 1 ? <button className="is-primary" onClick={goNext}>다음 단계<CaretRight /></button> : <button className="is-primary" onClick={openPreview} disabled={!ready}><Eye />완성본 보기</button>}</footer>
      <CoverHistory history={history} />
      </>}
    </div>
  )
}

function CoverLearningLibrary({ onStart }) {
  const [sector, setSector] = useState('all')
  const [query, setQuery] = useState('')
  const visible = COVER_LETTER_QUESTION_LIBRARY.filter(item => {
    const sectorMatch = sector === 'all' || item.sectors.includes(sector)
    const guide = questionGuide(item.id, item)
    return sectorMatch && (!query || `${item.label} ${item.question} ${item.purpose} ${guide.group}`.toLowerCase().includes(query.toLowerCase()))
  })
  return (
    <section className="cover-learning-library">
      <header><div><span>30개 자주 묻는 항목</span><h3>질문의 뜻부터 익히기</h3><p>모범문장 암기보다 평가 의도·답변 순서·내 근거를 먼저 확인함.</p></div><BookOpen weight="duotone" /></header>
      <div className="cover-learning-filters">
        <div>{[{ id: 'all', label: '전체' }, ...SECTORS].map(item => <button key={item.id} className={sector === item.id ? 'is-on' : ''} onClick={() => setSector(item.id)}>{item.label}</button>)}</div>
        <label><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="지원동기·갈등·안전 등 검색" /></label>
      </div>
      <p className="cover-learning-count">{visible.length}개 항목 · 실제 공고의 질문과 글자 수를 최종 확인함</p>
      <div className="cover-learning-list">{visible.map(item => {
        const content = questionGuide(item.id, item)
        return <details key={item.id}><summary><span>{content.group}</span><div><b>{item.label}</b><p>{item.question}</p></div><CaretRight /></summary><div className="cover-learning-detail"><section><b>평가자는 이것을 봄</b><p>{item.purpose}</p></section><section><b>답변 순서</b><ol>{content.structure.map(value => <li key={value}>{value}</li>)}</ol></section><section className="is-good"><b>좋은 예시</b><p>{content.good}</p></section><section className="is-trap"><b>감점 예시</b><p>{content.trap}</p></section><div><b>찾아볼 내 경험</b><span>{content.evidenceHints.map(value => <em key={value}>{value}</em>)}</span></div><button onClick={() => onStart(item)}><PencilSimple />이 문항 작성에 추가</button></div></details>
      })}</div>
    </section>
  )
}

function EvidenceWorkbench({ items, onSave, onDelete, onUse }) {
  const [form, setForm] = useState({ majorGroup: 'business', sourceType: '전공 실습', title: '', situation: '', task: '', action: '', result: '', proof: '', skills: [] })
  const major = COVER_EVIDENCE_MAJOR_GROUPS.find(item => item.id === form.majorGroup) || COVER_EVIDENCE_MAJOR_GROUPS[0]
  const ready = form.title.trim().length >= 2 && form.situation.trim().length >= 10 && form.action.trim().length >= 15 && form.result.trim().length >= 8

  function change(key, value) { setForm(current => ({ ...current, [key]: value })) }
  function toggleSkill(value) {
    change('skills', form.skills.includes(value) ? form.skills.filter(item => item !== value) : [...form.skills, value])
  }
  function append(key, value) {
    const current = String(form[key] || '').trim()
    change(key, current ? `${current} ${value}` : value)
  }
  async function save() {
    if (!ready) return
    await onSave({ ...form, skills: form.skills.length ? form.skills : major.examples.slice(0, 1) })
    setForm(current => ({ ...current, title: '', situation: '', task: '', action: '', result: '', proof: '', skills: [] }))
  }

  return (
    <section className="cover-evidence-workbench">
      <header><div><span>EXPERIENCE BANK</span><h3>작은 경험도 근거 1장으로</h3><p>수상 경력이 없어도 직접 한 행동과 확인 가능한 변화가 있으면 좋은 근거가 됨.</p></div><b>{items.length}</b></header>
      <div className="evidence-guide-strip"><b>빈칸 대신 순서대로 고름</b><span>전공·상황</span><CaretRight /><span>내 역할</span><CaretRight /><span>행동</span><CaretRight /><span>결과</span></div>
      <section className="evidence-form">
        <fieldset><legend>1. 전공·분야</legend><div className="evidence-chip-grid">{COVER_EVIDENCE_MAJOR_GROUPS.map(item => <button key={item.id} className={form.majorGroup === item.id ? 'is-on' : ''} onClick={() => change('majorGroup', item.id)}>{item.label}</button>)}</div></fieldset>
        <fieldset><legend>2. 어디에서 한 경험인가?</legend><div className="evidence-chip-grid">{COVER_EVIDENCE_SOURCES.map(value => <button key={value} className={form.sourceType === value ? 'is-on' : ''} onClick={() => change('sourceType', value)}>{value}</button>)}</div></fieldset>
        <fieldset><legend>3. 이 경험에서 쓴 기술·태도</legend><div className="evidence-chip-grid">{major.examples.map(value => <button key={value} className={form.skills.includes(value) ? 'is-on' : ''} onClick={() => toggleSkill(value)}>{value}</button>)}</div></fieldset>
        <label><span>근거 카드 이름 <small>나중에 찾기 쉬운 짧은 이름</small></span><input value={form.title} onChange={event => change('title', event.target.value)} placeholder="예: 판매 프로젝트 정산 오류 해결" /></label>
        <label><span>상황 <small>언제·어디서·무슨 일이 있었나?</small></span><div className="evidence-starters"><button onClick={() => append('situation', `${form.sourceType}에서 `)}>“{form.sourceType}에서”로 시작</button></div><textarea value={form.situation} onChange={event => change('situation', event.target.value)} placeholder="예: 교내 판매 프로젝트 마감 전 재고와 매출 기록이 맞지 않았음." rows={3} /></label>
        <label><span>내 역할·목표 <small>팀 전체가 아니라 내가 맡은 일</small></span><div className="evidence-starters"><button onClick={() => append('task', '제가 맡은 역할은 ')}>“제가 맡은 역할은” 넣기</button></div><textarea value={form.task} onChange={event => change('task', event.target.value)} placeholder="예: 거래 기록을 다시 확인해 마감 전에 정산표를 맞추는 역할" rows={3} /></label>
        <label><span>직접 한 행동 <small>확인 → 판단 → 실행 → 협업·보고</small></span><div className="evidence-starters">{COVER_EVIDENCE_ACTIONS.map(value => <button key={value} onClick={() => append('action', value)}>{value}</button>)}</div><textarea value={form.action} onChange={event => change('action', event.target.value)} placeholder="예: 거래 내역을 시간순으로 분류하고 영수증과 대조한 뒤 팀원과 수정 금액을 검산함." rows={4} /></label>
        <label><span>결과·배운 점 <small>수치·완성물·시간·오류·피드백</small></span><div className="evidence-starters">{COVER_EVIDENCE_RESULTS.map(value => <button key={value} onClick={() => append('result', value)}>{value}</button>)}</div><textarea value={form.result} onChange={event => change('result', event.target.value)} placeholder="예: 누락 3건을 찾아 정산표를 맞추고 검산 칸을 추가함." rows={3} /></label>
        <label><span>확인 근거 <small>없으면 비워도 됨</small></span><input value={form.proof} onChange={event => change('proof', event.target.value)} placeholder="예: 완성 파일·작업일지·담당 교사 피드백" /></label>
        <button className="evidence-save" onClick={save} disabled={!ready}><Plus />근거 1장 저장</button>
      </section>
      <section className="evidence-saved-list"><h3>저장한 근거</h3>{items.length === 0 ? <div className="evidence-empty"><ClipboardText /><b>아직 저장한 근거가 없음</b><p>전공 실습이나 작은 역할 하나부터 시작함.</p></div> : items.map(item => <article key={item.id}><header><div><span>{item.sourceType}</span><b>{item.title}</b></div><button onClick={() => onDelete(item)} aria-label="근거 삭제"><Trash /></button></header><p>{item.situation}</p><div>{item.skills.map(value => <em key={value}>{value}</em>)}</div><footer><span>{item.result}</span><button onClick={() => onUse(item)}>작성에 사용<CaretRight /></button></footer></article>)}</section>
    </section>
  )
}

function normalizeEvidence(row) {
  return {
    id: row.id,
    majorGroup: row.major_group,
    sourceType: row.source_type,
    title: row.title,
    situation: row.situation,
    task: row.task || '',
    action: row.action,
    result: row.result,
    proof: row.proof || '',
    skills: Array.isArray(row.skills) ? row.skills : [],
    createdAt: row.created_at,
  }
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

function QuestionComposer({ sector, organization, items, draft, evidenceBank, onChange }) {
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

  function addStarter(index, starter) {
    const current = String(items[index].answer || '').trim()
    updateItem(index, { answer: `${current}${current ? '\n' : ''}${starter}`.slice(0, items[index].limit) })
  }

  function useBankEvidence(index, evidence) {
    const answer = [evidence.situation, evidence.task, evidence.action, evidence.result].filter(Boolean).join(' ')
    updateItem(index, { answer: answer.slice(0, items[index].limit), evidenceId: evidence.id })
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
      <div className="cover-selected-questions">{items.map((item, index) => {
        const count = String(item.answer || '').length
        const guide = questionGuide(item.id, item)
        const warnings = coverAnswerWarnings(item.answer, draft)
        return <article key={item.instanceId || `${item.id}-${index}`}><header><span>{index + 1}</span><div><b>{item.label}</b><p>{item.question}</p></div><div className="cover-question-order"><button onClick={() => move(index, -1)} disabled={index === 0} aria-label="위로 이동"><ArrowUp /></button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="아래로 이동"><ArrowDown /></button><button onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label="문항 삭제"><Trash /></button></div></header><div className="cover-question-purpose"><b>평가 의도</b><p>{item.purpose}</p><span>{item.required.map(value => <em key={value}>{value}</em>)}</span></div>
          <details className="cover-answer-coach" open={!item.answer}><summary><PencilSimple />막막하면 답변 순서부터 고르기<CaretRight /></summary><div><section><b>답변 순서</b><ol>{guide.structure.map(value => <li key={value}>{value}</li>)}</ol></section><section><b>첫 문장 고르기</b><div>{guide.starters.map(value => <button key={value} onClick={() => addStarter(index, value)}>{value}</button>)}</div></section><section className="cover-answer-examples"><p><b>좋은 방향</b>{guide.good}</p><p><b>피할 표현</b>{guide.trap}</p></section><section><b>근거은행에서 가져오기</b>{evidenceBank.length ? <div>{evidenceBank.map(value => <button key={value.id} onClick={() => useBankEvidence(index, value)}>{value.title}</button>)}</div> : <p>근거 찾기에서 경험을 먼저 저장하면 여기서 선택할 수 있음.</p>}</section></div></details>
          <textarea value={item.answer || ''} onChange={event => updateItem(index, { answer: event.target.value.slice(0, item.limit) })} placeholder="답변 순서를 고르고 근거은행의 실제 경험으로 한 칸씩 채움" rows={7} />
          {warnings.length > 0 && <div className="cover-answer-warnings">{warnings.map(value => <span key={value}><WarningCircle weight="fill" />{value}</span>)}</div>}
          <footer><button onClick={() => updateItem(index, { answer: seedQuestionAnswer(item.id, draft) })}>기본 작성 근거 불러오기</button><span className={count >= 80 ? 'is-ready' : ''}>{count}/{item.limit}자</span></footer></article>
      })}</div>
      {!items.length && <div className="cover-question-empty"><ClipboardText /><b>제출할 문항을 먼저 구성해요</b><p>추천 문항을 고르거나 지원처 공고의 문항을 직접 추가함.</p></div>}
    </section>
  )
}

function CoverField({ field, value, sector, onChange }) {
  const current = String(value).trim().length
  const ready = current >= field.minLength
  const assist = COVER_FIELD_ASSISTS[field.key]
  function addStarter(starter) {
    const text = String(value || '').trim()
    onChange(`${text}${text ? '\n' : ''}${starter}`)
  }
  return (
    <article className={`cover-field-card ${ready ? 'is-ready' : ''}`}>
      <header><div><span>{ready ? <CheckCircle weight="fill" /> : <PencilSimple />}</span><strong>{field.label}</strong></div><small className={ready ? 'is-ready' : ''}>{current}/{field.minLength}자 기준</small></header>
      <div className="cover-field-guide"><div><b>꼭 넣기</b><ul>{field.required.map(item => <li key={item}>{item}</li>)}</ul></div><p><WarningCircle weight="fill" /><span><b>주의</b>{field.caution}</span></p></div>
      {field.showExample !== false && <details><summary>이 분야의 구체적 예시 보기</summary><div className="cover-example-box"><b>구조 참고</b><p>{field.examples[sector]}</p><small>기관명·경험·수치는 내 사실로 바꿔 작성함.</small></div></details>}
      {assist && <details className="cover-field-assist"><summary><PencilSimple />막막하면 한 칸씩 시작</summary><div><section><b>먼저 답할 세 가지</b><ol>{assist.prompts.map(value => <li key={value}>{value}</li>)}</ol></section><section><b>첫 문장 고르기</b><div>{assist.starters.map(value => <button key={value} onClick={() => addStarter(value)}>{value}</button>)}</div></section></div></details>}
      <textarea id={`cover-${field.key}`} value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} rows={field.key === 'action' || field.key === 'motivation' ? 6 : 4} />
    </article>
  )
}

function coverAnswerWarnings(answer, draft) {
  const text = String(answer || '').trim()
  if (!text) return ['답변 순서 또는 근거 카드를 선택해 시작함.']
  const warnings = []
  if (text.length < 80) warnings.push('행동과 결과를 더 구체적으로 적음.')
  if (/(열심히|최선을 다|성실하|노력하)(였|했|겠습니다|다고)/.test(text) && !/(확인|기록|비교|설명|조정|측정|검산)/.test(text)) warnings.push('추상 표현을 실제 행동 동사로 바꿈.')
  if ((text.match(/저는/g) || []).length >= 4) warnings.push('“저는” 반복을 줄이고 행동부터 씀.')
  if (/(부모|아버지|어머니|출신 학교|고등학교명|출생지|남자로서|여자로서)/.test(text)) warnings.push('블라인드 채용에서 제외할 개인정보를 확인함.')
  const otherOrganizations = INTERVIEW_ORGANIZATIONS.filter(item => item.name !== draft.targetName && text.includes(item.name))
  if (otherOrganizations.length) warnings.push(`다른 지원처명(${otherOrganizations[0].name})이 들어갔는지 확인함.`)
  return warnings.slice(0, 3)
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
