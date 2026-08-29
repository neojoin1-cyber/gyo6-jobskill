import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowUp,
  Archive,
  Bank,
  BookmarkSimple,
  BookOpen,
  Buildings,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  Copy,
  DownloadSimple,
  Eye,
  Factory,
  FileText,
  FolderOpen,
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
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../App.jsx'
import CompactText from '../../components/CompactText.jsx'
import PersonalizedCareerExamplePanel from '../../components/PersonalizedCareerExamplePanel.jsx'
import CoverLetterAssessment from './CoverLetterAssessment.jsx'
import {
  COVER_LETTER_FIELDS,
  COVER_LETTER_QUESTION_LIBRARY,
  COVER_LETTER_SECTOR_CONTENT,
  COVER_LETTER_STEPS,
  INTERVIEW_ORGANIZATIONS,
  INTERVIEW_TRACKS,
} from '../../lib/interviewCareerContent.js'
import { buildEmployerFit, readEmployerStudentContext } from '../../lib/employerIntelligence.js'
import { publishCareerProfile } from '../../lib/careerProfileCloud.js'
import {
  CAREER_CONTEXT_KEY,
  careerEvidenceQuality,
  careerEvidenceSeeds,
  careerProfileSnapshot,
  normalizeCareerContext,
} from '../../lib/careerProfile.js'
import {
  COVER_EVIDENCE_ACTIONS,
  COVER_EVIDENCE_MAJOR_GROUPS,
  COVER_EVIDENCE_RESULTS,
  COVER_EVIDENCE_SOURCES,
  COVER_FIELD_ASSISTS,
  questionGuide,
} from '../../lib/coverLetterGuidance.js'
import { hifiveDepartment } from '../../lib/hifiveDepartmentCatalog.js'
import '../../styles/interview-career.css'

const SECTORS = [
  { id: 'finance', label: '금융권', icon: Bank },
  { id: 'public', label: '공공기관', icon: Buildings },
  { id: 'enterprise', label: '대기업', icon: Factory },
]

const SECTOR_FORM_EXAMPLES = {
  finance: { targetName: '예: NH농협은행', role: '예: 개인금융·디지털금융' },
  public: { targetName: '예: 한국전력공사', role: '예: 전기설비·사무행정' },
  enterprise: { targetName: '예: 삼성전자', role: '예: 설비기술·생산관리' },
}

const SECTION_META = {
  pathways: { title: '지원처별 면접 심화', eyebrow: '기초 다음 단계' },
  institutions: { title: '기업·기관 연구소', eyebrow: '지원처 전수 준비' },
  cover: { title: '자기소개서관', eyebrow: '개념·진단·실전 작성' },
  scripts: { title: '답변 연결실', eyebrow: '자기소개서에서 면접 답변으로' },
}

const STATUS_LABELS = {
  submitted: '첨삭 대기',
  in_review: '선생님 확인 중',
  revision_requested: '수정 요청',
  approved: '첨삭 완료',
}

const COVER_LENGTH_PRESETS = [
  { minLength: 350, limit: 500, label: '500자' },
  { minLength: 500, limit: 700, label: '700자' },
  { minLength: 600, limit: 800, label: '800자' },
  { minLength: 700, limit: 1000, label: '1000자' },
  { minLength: 1050, limit: 1500, label: '1500자' },
]

const COVER_PORTFOLIO_KEY = 'iv_cover_application_portfolio_v2'
const INTERVIEW_SCRIPT_PORTFOLIO_KEY = 'iv_interview_script_portfolio_v2'
const COVER_EVIDENCE_CACHE_KEY = 'iv_cover_evidence_cache_v2'
const APPLICATION_STATUS = {
  writing: '작성 중',
  submitted: '지원 완료',
  passed: '서류 합격',
  not_selected: '미선발',
  archived: '보관',
}

function readCareerProfile() {
  try { return normalizeCareerContext(JSON.parse(localStorage.getItem(CAREER_CONTEXT_KEY) || '{}')) }
  catch { return normalizeCareerContext() }
}

function readCareerEvidenceSeed() {
  try { return JSON.parse(localStorage.getItem('iv_cover_evidence_seed_v1') || 'null') }
  catch { return null }
}

function newApplicationId() {
  return `application-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function hasCoverContent(draft = {}) {
  return ['targetName', 'role', 'motivation', 'majorSkill', 'experience', 'action', 'result', 'contribution']
    .some(key => String(draft[key] || '').trim())
    || (Array.isArray(draft.coverItems) && draft.coverItems.some(item => String(item.answer || '').trim()))
}

function makeCoverApplication(baseDraft = {}, metadata = {}) {
  const id = metadata.id || newApplicationId()
  const now = new Date().toISOString()
  const sector = metadata.sector || baseDraft.sector || 'finance'
  const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === (metadata.organizationId || baseDraft.organizationId))
  const targetName = metadata.targetName ?? baseDraft.targetName ?? organization?.name ?? ''
  const role = metadata.role ?? baseDraft.role ?? organization?.roles?.[0] ?? ''
  const recruitmentTitle = metadata.recruitmentTitle || baseDraft.recruitmentTitle || (targetName ? `${targetName} 채용` : '첫 지원서')
  const status = metadata.status || baseDraft.applicationStatus || 'writing'
  const prepared = {
    ...baseDraft,
    sector,
    organizationId: metadata.organizationId ?? baseDraft.organizationId ?? '',
    targetName,
    role,
    applicationProjectId: id,
    recruitmentTitle,
    applicationDeadline: metadata.deadline ?? baseDraft.applicationDeadline ?? '',
    applicationStatus: status,
  }
  prepared.coverItems = Array.isArray(prepared.coverItems) && prepared.coverItems.length
    ? prepared.coverItems.map(normalizeCoverItem)
    : defaultCoverItems(sector, organization, prepared)
  return {
    id,
    recruitmentTitle,
    deadline: prepared.applicationDeadline,
    status,
    createdAt: metadata.createdAt || now,
    updatedAt: metadata.updatedAt || now,
    draft: prepared,
  }
}

function readCoverPortfolio(seed = {}) {
  let stored = null
  try { stored = JSON.parse(localStorage.getItem(COVER_PORTFOLIO_KEY) || 'null') } catch { /* 새 보관함으로 시작 */ }
  const projects = Array.isArray(stored?.projects)
    ? stored.projects.map(project => makeCoverApplication(project.draft || {}, project))
    : []
  let activeId = stored?.activeId

  if (!projects.length) {
    let legacy = {}
    try { legacy = JSON.parse(localStorage.getItem('iv_cover_draft') || '{}') } catch { /* 이전 초안 없음 */ }
    const first = makeCoverApplication({ sector: 'finance', ...legacy, ...seed }, {
      recruitmentTitle: seed.targetName ? `${seed.targetName} 채용` : hasCoverContent(legacy) ? `${legacy.targetName || '기존'} 작성본` : '첫 지원서',
    })
    projects.push(first)
    activeId = first.id
  } else if (seed.targetName) {
    const matching = projects.find(project => project.draft.organizationId === seed.organizationId && project.draft.role === seed.role)
    if (matching) activeId = matching.id
    else {
      const seeded = makeCoverApplication({ sector: 'finance', ...seed }, { recruitmentTitle: `${seed.targetName} 채용` })
      projects.unshift(seeded)
      activeId = seeded.id
    }
  }

  if (!projects.some(project => project.id === activeId)) activeId = projects[0].id
  return { projects, activeId }
}

function coverQuestionLimits(item = {}) {
  const limit = Math.max(100, Math.min(2000, Number(item.limit) || 700))
  const fallbackMinimum = Math.max(100, Math.round((limit * 0.72) / 50) * 50)
  const minLength = Math.max(50, Math.min(limit, Number(item.minLength) || fallbackMinimum))
  return { minLength, limit }
}

function normalizeCoverItem(item) {
  const limits = coverQuestionLimits(item)
  return { ...item, ...limits, answer: String(item?.answer || '') }
}

function coverTextareaRows(limit) {
  return Math.max(7, Math.min(16, Math.ceil(limit / 90)))
}

function coverAnswerBoxHeight(limit) {
  return Math.max(180, Math.ceil(limit / 44) * 23 + 34)
}

export default function InterviewCareerLab({ section, onBack, onOpenCover, initialWorkspace = 'learn', initialEvidenceSeed, initialCareerProfile, onLearningContext }) {
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

  if (section === 'scripts') {
    return <LabFrame meta={meta} onBack={onBack}><InterviewScriptBuilder /></LabFrame>
  }

  return <LabFrame meta={meta} onBack={onBack}><CoverLetterBuilder initialWorkspace={initialWorkspace} initialEvidenceSeed={initialEvidenceSeed} initialCareerProfile={initialCareerProfile} onLearningContext={onLearningContext} /></LabFrame>
}

function LabFrame({ meta, onBack, children }) {
  return (
    <div className="screen interview-career-screen">
      <header className="appbar interview-career-appbar">
        <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면으로 돌아가기"><ArrowLeft /></button>
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
        <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={triggerBack} aria-label="모듈 목록으로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">{track.label} · {lessonIndex + 1}/{module.lessons.length}</span><span className="appbar-title">{module.title}</span></div></header>
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
      <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={triggerBack} aria-label="지원처별 면접 심화로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">지원처별 심화</span><span className="appbar-title">{track.label}</span></div></header>
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
  const studentContext = useMemo(() => readEmployerStudentContext(), [])
  const hasStudentContext = studentContext.hasStudentData
  const rows = useMemo(() => INTERVIEW_ORGANIZATIONS
    .filter(item => item.sector === sector && (!query || `${item.name} ${item.group} ${item.identity} ${item.roles.join(' ')}`.toLowerCase().includes(query.toLowerCase())))
    .map(item => ({ ...item, fit: buildEmployerFit(item, studentContext) }))
    .sort((a, b) => hasStudentContext ? b.fit.score - a.fit.score || a.name.localeCompare(b.name, 'ko') : a.name.localeCompare(b.name, 'ko')), [sector, query, studentContext, hasStudentContext])

  function toggleSave(id) {
    const next = new Set(saved)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSaved(next)
    localStorage.setItem('iv_saved_orgs', JSON.stringify([...next]))
  }

  return (
    <>
      <div className="interview-source-note"><ShieldCheck size={20} weight="fill" /><p>{hasStudentContext ? `${studentContext.departmentName || '내 전공'}·자격·활동 근거와 가까운 지원처부터 정렬함. ` : ''}연구 자료는 답을 대신 써 주지 않으며 공식 자료와 내 경험을 연결해 면접·자기소개서에 함께 사용함.</p></div>
      <div className="interview-sector-tabs" role="tablist" aria-label="지원처 분야">{SECTORS.map(item => { const Icon = item.icon; return <button key={item.id} role="tab" aria-selected={sector === item.id} className={sector === item.id ? 'is-active' : ''} onClick={() => setSector(item.id)}><Icon size={17} />{item.label}</button> })}</div>
      <label className="interview-search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="기관·기업 검색" /></label>
      <p className="interview-result-count">{rows.length}곳 · 전체 {INTERVIEW_ORGANIZATIONS.length}곳 · 관심 지원처 {saved.size}곳</p>
      <div className="interview-org-list">{rows.map(item => <div key={item.id} className="interview-org-row"><button className="interview-org-main" onClick={() => onOpen(item.id)}><span><strong>{item.name}</strong><em>{item.group}</em>{hasStudentContext && <i>{item.fit.score}점 · {item.fit.level}</i>}<small>{item.identity}</small></span><CaretRight size={18} /></button><button className={`interview-save ${saved.has(item.id) ? 'is-saved' : ''}`} onClick={() => toggleSave(item.id)} aria-label={`${item.name} ${saved.has(item.id) ? '관심 해제' : '관심 저장'}`}><BookmarkSimple size={19} weight={saved.has(item.id) ? 'fill' : 'regular'} /></button></div>)}</div>
    </>
  )
}

function OrganizationDetail({ organization, onBack, onOpenCover }) {
  const sectorLabel = SECTORS.find(item => item.id === organization.sector)?.label
  const studentContext = useMemo(() => readEmployerStudentContext(), [])
  const fit = useMemo(() => buildEmployerFit(organization, studentContext), [organization, studentContext])
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
    localStorage.setItem('iv_cover_seed', JSON.stringify({ sector: organization.sector, organizationId: organization.id, targetName: organization.name, targetEvidence: `${organization.identity} · 확인 주제: ${organization.intelligence.themes[0]}`, role: fit.role }))
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
      <header className="appbar interview-career-appbar"><button className="appbar-back" onClick={triggerBack} aria-label="기업·기관 목록으로 돌아가기"><ArrowLeft /></button><div><span className="interview-career-eyebrow">{sectorLabel} · {organization.group}</span><span className="appbar-title">{organization.name}</span></div></header>
      <div className="screen-body interview-career-body">
        <section className="interview-org-identity"><h2>핵심 정체성</h2><CompactText text={organization.identity} maxItemChars={72} /></section>
        <section className="employer-fit-panel">
          <header><div><span>내 준비 연결</span><h3>{fit.studentLabel} → {fit.role}</h3></div><b>{fit.score}점<small>{fit.level}</small></b></header>
          <div className="employer-fit-columns"><div><strong>지금 쓸 수 있는 근거</strong><ul>{fit.matches.map(item => <li key={item}><CheckCircle weight="fill" />{item}</li>)}</ul></div><div><strong>지원 전 보완할 근거</strong><ol>{fit.gaps.map(item => <li key={item}>{item}</li>)}</ol></div></div>
          <p><b>지원동기 골격</b>{fit.draftBridge}</p>
        </section>
        <section className="interview-detail-section employer-timeline">
          <header><div><h3>최근 3개 연도 자료 확인</h3><p className="interview-section-help">인재상 문구를 외우지 않고 지속된 방향·직무 요구·최신 공고를 차례로 대조함.</p></div><span>{organization.intelligence.sourceLevel}</span></header>
          <div>{organization.intelligence.timeline.map(item => <article key={item.year}><b>{item.year}</b><span><strong>{item.title}</strong><small>{item.detail}</small></span><em>{item.status}</em></article>)}</div>
          <div className="employer-provenance">{organization.intelligence.provenance.map(item => <a key={item.url} href={item.url} target="_blank" rel="noreferrer"><ArrowSquareOut />{item.label}<small>{item.kind}</small></a>)}</div>
          <p className="employer-source-notice"><ShieldCheck weight="fill" />{organization.intelligence.notice}</p>
        </section>
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

const INTERVIEW_SCRIPT_LIMITS = {
  introduction: { label: '1분 자기소개', minLength: 250, limit: 350 },
  motivation: { label: '면접 지원동기', minLength: 220, limit: 350 },
  closing: { label: '마지막 한마디', minLength: 100, limit: 180 },
}

function readLocalJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}

function coverLinkSignature(draft) {
  const fields = ['organizationId', 'targetName', 'role', 'targetEvidence', 'majorSkill', 'action', 'result', 'motivation', 'contribution']
    .map(key => String(draft?.[key] || '').trim())
  const answers = Array.isArray(draft?.coverItems)
    ? draft.coverItems.map(item => [item.id, item.label, item.answer].map(value => String(value || '').trim()).join(':'))
    : []
  return [...fields, ...answers].filter(Boolean).join('|')
}

function speakingSeconds(text) {
  return Math.max(0, Math.round(String(text || '').trim().length / 5))
}

function newInterviewScriptId() {
  return `interview-script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeInterviewScriptSet(coverApplication, baseDraft = {}, metadata = {}) {
  const sourceDraft = coverApplication?.draft || {}
  const id = metadata.id || baseDraft.applicationProjectId || newInterviewScriptId()
  const now = new Date().toISOString()
  const title = metadata.title || baseDraft.recruitmentTitle || `${sourceDraft.recruitmentTitle || sourceDraft.targetName || '지원처'} 면접 답변`
  const sourceCoverApplicationId = metadata.sourceCoverApplicationId || baseDraft.sourceCoverApplicationId || coverApplication?.id || ''
  return {
    id,
    title,
    sourceCoverApplicationId,
    status: metadata.status || baseDraft.interviewScriptStatus || 'writing',
    createdAt: metadata.createdAt || now,
    updatedAt: metadata.updatedAt || now,
    draft: {
      sector: sourceDraft.sector || 'finance',
      organizationId: sourceDraft.organizationId || '',
      targetName: sourceDraft.targetName || '',
      role: sourceDraft.role || '',
      introduction: '',
      motivation: '',
      closing: '',
      coverSignature: coverLinkSignature(sourceDraft),
      ...baseDraft,
      applicationProjectId: id,
      sourceCoverApplicationId,
      recruitmentTitle: title,
    },
  }
}

function readInterviewScriptPortfolio() {
  const coverPortfolio = readCoverPortfolio()
  const stored = readLocalJson(INTERVIEW_SCRIPT_PORTFOLIO_KEY, null)
  const projects = Array.isArray(stored?.projects)
    ? stored.projects.map(project => {
        const coverApplication = coverPortfolio.projects.find(item => item.id === (project.sourceCoverApplicationId || project.draft?.sourceCoverApplicationId))
          || coverPortfolio.projects[0]
        return makeInterviewScriptSet(coverApplication, project.draft || {}, project)
      })
    : []
  let activeId = stored?.activeId

  if (!projects.length) {
    const legacy = readLocalJson('iv_interview_script_draft')
    const linkedCover = coverPortfolio.projects.find(item => item.id === legacy.sourceCoverApplicationId)
      || coverPortfolio.projects.find(item => item.id === coverPortfolio.activeId)
      || coverPortfolio.projects[0]
    const first = makeInterviewScriptSet(linkedCover, legacy, {
      title: legacy.recruitmentTitle || `${linkedCover?.recruitmentTitle || linkedCover?.draft?.targetName || '첫 지원처'} 면접 답변`,
    })
    projects.push(first)
    activeId = first.id
  }
  if (!projects.some(project => project.id === activeId)) activeId = projects[0].id
  return { projects, activeId, coverApplications: coverPortfolio.projects }
}

function InterviewScriptBuilder() {
  const { profile } = useAuth() ?? {}
  const initialPortfolio = useMemo(() => readInterviewScriptPortfolio(), [])
  const [scriptSets, setScriptSets] = useState(initialPortfolio.projects)
  const [activeScriptId, setActiveScriptId] = useState(initialPortfolio.activeId)
  const [coverApplications] = useState(initialPortfolio.coverApplications)
  const [showCreate, setShowCreate] = useState(false)
  const [newCoverId, setNewCoverId] = useState('')
  const [newSector, setNewSector] = useState('finance')
  const [newOrganizationId, setNewOrganizationId] = useState('')
  const [newTargetName, setNewTargetName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [active, setActive] = useState('introduction')
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const activeSet = scriptSets.find(item => item.id === activeScriptId) || scriptSets[0]
  const draft = activeSet?.draft || {}
  const linkedCoverApplication = coverApplications.find(item => item.id === activeSet?.sourceCoverApplicationId) || null
  const coverDraft = linkedCoverApplication?.draft || {}
  const createOrganizations = INTERVIEW_ORGANIZATIONS.filter(item => item.sector === newSector)
  const createOrganization = INTERVIEW_ORGANIZATIONS.find(item => item.id === newOrganizationId)
  const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === draft.organizationId)
  const linkedCoverItems = Array.isArray(coverDraft.coverItems)
    ? coverDraft.coverItems.filter(item => String(item.answer || '').trim())
    : []
  const sourceChanged = Boolean(coverLinkSignature(coverDraft)) && draft.coverSignature !== coverLinkSignature(coverDraft)
  const foreignOrganization = INTERVIEW_ORGANIZATIONS.find(item => item.id !== draft.organizationId && `${draft.introduction} ${draft.motivation} ${draft.closing}`.includes(item.name))
  const config = INTERVIEW_SCRIPT_LIMITS[active]
  const value = String(draft[active] || '')
  const introductionReady = String(draft.introduction || '').trim().length >= INTERVIEW_SCRIPT_LIMITS.introduction.minLength
  const motivationReady = String(draft.motivation || '').trim().length >= INTERVIEW_SCRIPT_LIMITS.motivation.minLength
  const closingReady = String(draft.closing || '').trim().length >= INTERVIEW_SCRIPT_LIMITS.closing.minLength
  const ready = draft.targetName && draft.role && introductionReady && motivationReady && closingReady && !sourceChanged && !foreignOrganization
  const scriptOrder = ['introduction', 'motivation', 'closing']
  const scriptReady = { introduction: introductionReady, motivation: motivationReady, closing: closingReady }
  const activeIndex = scriptOrder.indexOf(active)
  const scriptEvidence = Array.isArray(coverDraft.evidenceBank) ? coverDraft.evidenceBank[0] : null
  const scriptDepartment = hifiveDepartment(coverDraft.major)
  const scriptMajorGroup = scriptEvidence?.majorGroup || scriptDepartment?.majorGroup || 'general'
  const scriptSourceType = scriptEvidence?.sourceType || '전공 실습'

  useEffect(() => {
    supabase.rpc('rpc_my_cover_letters').then(({ data }) => setHistory(Array.isArray(data) ? data : []))
  }, [profile?.id])

  useEffect(() => {
    if (!activeSet) return
    localStorage.setItem(INTERVIEW_SCRIPT_PORTFOLIO_KEY, JSON.stringify({ projects: scriptSets, activeId: activeScriptId }))
    localStorage.setItem('iv_interview_script_draft', JSON.stringify(activeSet.draft))
  }, [activeScriptId, activeSet, scriptSets])

  function persist(next) {
    setScriptSets(current => {
      const projects = current.map(item => item.id === activeScriptId ? {
        ...item,
        title: next.recruitmentTitle || item.title,
        sourceCoverApplicationId: next.sourceCoverApplicationId || '',
        status: next.interviewScriptStatus || item.status,
        updatedAt: new Date().toISOString(),
        draft: next,
      } : item)
      localStorage.setItem(INTERVIEW_SCRIPT_PORTFOLIO_KEY, JSON.stringify({ projects, activeId: activeScriptId }))
      return projects
    })
    localStorage.setItem('iv_interview_script_draft', JSON.stringify(next))
    setNotice(null)
  }

  function createScriptSet() {
    const coverApplication = coverApplications.find(item => item.id === newCoverId) || null
    const targetName = (createOrganization?.name || newTargetName).trim()
    const role = newRole.trim()
    if (!targetName || !role) {
      setNotice({ ok: false, text: '지원할 기업·기관과 직무를 먼저 정해 주세요.' })
      return
    }
    const created = makeInterviewScriptSet(coverApplication, {
      sector: newSector,
      organizationId: createOrganization?.id || '',
      targetName,
      role,
      sourceCoverApplicationId: coverApplication?.id || '',
      coverSignature: coverApplication ? coverLinkSignature(coverApplication.draft) : '',
    }, {
      title: newTitle.trim() || `${targetName} ${role} 면접 답변`,
      sourceCoverApplicationId: coverApplication?.id || '',
    })
    setScriptSets(current => [created, ...current])
    setActiveScriptId(created.id)
    setActive('introduction')
    setShowCreate(false)
    setNewCoverId('')
    setNewOrganizationId('')
    setNewTargetName('')
    setNewRole('')
    setNewTitle('')
    setNotice({ ok: true, text: '새 면접 답변 세트를 만들었어요. 1분 자기소개부터 순서대로 작성합니다.' })
  }

  function removeScriptSet() {
    if (scriptSets.length <= 1 || !activeSet) return
    if (!window.confirm(`“${activeSet.title}” 답변 세트를 삭제할까요?`)) return
    const remaining = scriptSets.filter(item => item.id !== activeSet.id)
    setScriptSets(remaining)
    setActiveScriptId(remaining[0].id)
    setNotice({ ok: true, text: '선택한 면접 답변 세트를 삭제했어요.' })
  }

  function renameScriptSet(value) {
    persist({ ...draft, recruitmentTitle: value.slice(0, 60) })
  }

  function changeLinkedCover(sourceCoverApplicationId) {
    if (!sourceCoverApplicationId) {
      persist({ ...draft, sourceCoverApplicationId: '', coverSignature: '' })
      setNotice({ ok: true, text: '자기소개서 연결을 해제했어요. 면접 답변은 그대로 유지됩니다.' })
      return
    }
    const coverApplication = coverApplications.find(item => item.id === sourceCoverApplicationId)
    if (!coverApplication) return
    const source = coverApplication.draft || {}
    persist({
      ...draft,
      sector: source.sector || draft.sector,
      organizationId: source.organizationId || '',
      targetName: source.targetName || '',
      role: source.role || '',
      sourceCoverApplicationId: coverApplication.id,
      coverSignature: coverLinkSignature(source),
      linkedAt: new Date().toISOString(),
    })
    setNotice({ ok: true, text: '이 답변 세트에 연결할 자기소개서를 변경했어요.' })
  }

  function syncCover() {
    if (!linkedCoverApplication) {
      setNotice({ ok: false, text: '연결할 자기소개서를 먼저 선택해 주세요.' })
      return
    }
    if (!coverDraft.targetName || !coverDraft.role) {
      setNotice({ ok: false, text: '나를쓰다에서 지원처와 직무를 먼저 연결해 주세요.' })
      return
    }
    persist({
      ...draft,
      sector: coverDraft.sector || draft.sector,
      organizationId: coverDraft.organizationId || '',
      targetName: coverDraft.targetName,
      role: coverDraft.role,
      sourceCoverApplicationId: linkedCoverApplication?.id || '',
      coverSignature: coverLinkSignature(coverDraft),
      linkedAt: new Date().toISOString(),
    })
    setNotice({ ok: true, text: '지원처·직무·근거를 최신 자기소개서와 맞췄어요.' })
  }

  function append(text) {
    const current = String(draft[active] || '').trim()
    const nextValue = `${current}${current ? ' ' : ''}${text}`.slice(0, config.limit)
    persist({ ...draft, [active]: nextValue })
  }

  function continueScript() {
    if (!scriptReady[active]) {
      setNotice({ ok: false, text: `${config.label}을 권장 최소 ${config.minLength}자까지 먼저 완성해 주세요.` })
      return
    }
    const next = scriptOrder[activeIndex + 1]
    if (next) {
      setActive(next)
      setNotice(null)
    }
  }

  const assists = active === 'introduction'
    ? [
        { label: '전공·직무 연결', text: coverDraft.majorSkill || `${draft.role || '지원 직무'}에 필요한 전공 실습과 작업 기준을 익혀 왔습니다.` },
        { label: '대표 행동 근거', text: [coverDraft.action, coverDraft.result].filter(Boolean).join(' ') || '제가 직접 확인하고 개선한 대표 경험을 한 문장으로 정리합니다.' },
        { label: '입사 후 기여', text: coverDraft.contribution || `${draft.role || '지원 직무'}에서 정확한 확인과 기록으로 기여하겠습니다.` },
      ]
    : active === 'motivation' ? [
        { label: '개인 계기', text: coverDraft.motivation || '이 직무에 관심을 갖게 된 구체적인 경험을 적습니다.' },
        { label: '지원처 공식 근거', text: coverDraft.targetEvidence || `${draft.targetName || '지원처'}의 공식 사업·고객·제품 중 확인한 사실을 적습니다.` },
        { label: '직무 기여', text: coverDraft.contribution || `${draft.role || '지원 직무'}에서 처음 실천할 행동을 적습니다.` },
      ] : [
        { label: '핵심 강점 회수', text: coverDraft.result || '면접에서 확인받은 제 강점 한 가지를 짧게 다시 연결합니다.' },
        { label: '직무 첫 행동', text: coverDraft.contribution || `${draft.role || '지원 직무'}에서 기준을 빠르게 익히고 맡은 일을 정확히 확인하겠습니다.` },
        { label: '감사로 마무리', text: `오늘 ${draft.role || '지원 직무'}에 대한 제 준비를 말씀드릴 기회를 주셔서 감사합니다.` },
      ]

  async function submit() {
    if (!ready || submitting) {
      setNotice({ ok: false, text: sourceChanged ? '자기소개서 최신 내용을 먼저 다시 연결해 주세요.' : foreignOrganization ? `${foreignOrganization.name} 표기를 현재 지원처에 맞게 고쳐 주세요.` : '세 답변을 권장 분량까지 완성해 주세요.' })
      return
    }
    setSubmitting(true)
    const coverItems = Object.entries(INTERVIEW_SCRIPT_LIMITS).map(([id, item]) => ({ id, label: item.label, minLength: item.minLength, limit: item.limit, answer: draft[id] }))
    const submissionDraft = {
      ...draft,
      careerProfileSnapshot: careerProfileSnapshot(readCareerProfile(), { evidenceCount: scriptEvidence ? 1 : 0 }),
      documentType: 'interview-script',
      applicationProjectId: activeSet.id,
      sourceCoverApplicationId: linkedCoverApplication?.id || '',
      recruitmentTitle: activeSet.title,
      interviewScriptStatus: 'submitted',
      sourceCover: {
        applicationProjectId: linkedCoverApplication?.id || '',
        recruitmentTitle: linkedCoverApplication?.recruitmentTitle || coverDraft.recruitmentTitle || '',
        targetName: coverDraft.targetName,
        role: coverDraft.role,
        organizationId: coverDraft.organizationId,
        targetEvidence: coverDraft.targetEvidence,
        majorSkill: coverDraft.majorSkill,
        action: coverDraft.action,
        result: coverDraft.result,
        motivation: coverDraft.motivation,
        contribution: coverDraft.contribution,
        evidenceTitles: Array.isArray(coverDraft.evidenceBank) ? coverDraft.evidenceBank.map(item => item.title).filter(Boolean) : [],
        coverItems: linkedCoverItems.map(item => ({ id: item.id, label: item.label, answer: item.answer })),
      },
      coverItems,
    }
    const generatedText = coverItems.map((item, index) => `${index + 1}. ${item.label}\n${item.answer}`).join('\n\n')
    const { data, error } = await supabase.rpc('rpc_submit_cover_letter', {
      p_sector: draft.sector,
      p_organization_id: draft.organizationId || null,
      p_target_name: draft.targetName,
      p_role: draft.role,
      p_draft: submissionDraft,
      p_generated_text: generatedText,
    })
    setSubmitting(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: data?.error === 'no_class' ? '소속 학급을 확인한 뒤 다시 요청해 주세요.' : '첨삭 요청을 보내지 못했어요.' })
      return
    }
    setNotice({ ok: true, text: '자기소개서와 연결된 면접 답변을 선생님께 보냈어요.' })
    setScriptSets(current => current.map(item => item.id === activeSet.id ? { ...item, status: 'submitted', draft: { ...item.draft, interviewScriptStatus: 'submitted' }, updatedAt: new Date().toISOString() } : item))
    const { data: rows } = await supabase.rpc('rpc_my_cover_letters')
    setHistory(Array.isArray(rows) ? rows : [])
  }

  const activeHistory = history.filter(item => {
    const projectId = item.draft?.applicationProjectId || item.application_key
    return projectId ? projectId === activeSet?.id : item.draft?.documentType === 'interview-script' && item.target_name === draft.targetName && item.role_name === draft.role
  })

  return <div className="interview-script-builder">
    <section className="script-portfolio-card">
      <header><div><span>INTERVIEW ANSWER FILES</span><h2>면접 답변 세트</h2><p>지원처·직무·채용회차별로 여러 세트를 동시에 작성해요.</p></div><button onClick={() => setShowCreate(value => !value)}><Plus />새 답변 세트</button></header>
      <div className="script-set-switcher">
        <label><span>현재 작성 중</span><select value={activeSet?.id || ''} onChange={event => { setActiveScriptId(event.target.value); setNotice(null) }}>{scriptSets.map(item => <option key={item.id} value={item.id}>{item.title} · {item.status === 'submitted' ? '첨삭 요청함' : '작성 중'}</option>)}</select></label>
        <button onClick={removeScriptSet} disabled={scriptSets.length <= 1} aria-label="현재 면접 답변 세트 삭제"><Trash /></button>
      </div>
      <label className="script-set-title"><span>답변 세트 이름</span><input value={activeSet?.title || ''} maxLength={60} onChange={event => renameScriptSet(event.target.value)} placeholder="예: 2026 NH농협은행 1차 면접" /></label>
      {showCreate && <div className="script-create-panel">
        <div className="script-create-route"><b>지원처와 직무부터 정함</b><span>자기소개서가 없어도 시작할 수 있고, 나중에 연결할 수 있어요.</span></div>
        <label><span>분야</span><select value={newSector} onChange={event => { setNewSector(event.target.value); setNewOrganizationId(''); setNewTargetName(''); setNewRole('') }}>{SECTORS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>기업·기관</span><select value={newOrganizationId} onChange={event => { const id = event.target.value; const org = INTERVIEW_ORGANIZATIONS.find(item => item.id === id); setNewOrganizationId(id); setNewTargetName(org?.name || ''); setNewRole(org?.roles?.[0] || '') }}><option value="">목록에서 선택하거나 직접 입력</option>{createOrganizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {!newOrganizationId && <label><span>지원처 직접 입력</span><input value={newTargetName} maxLength={60} onChange={event => setNewTargetName(event.target.value)} placeholder={SECTOR_FORM_EXAMPLES[newSector].targetName} /></label>}
        <label><span>지원 직무</span>{createOrganization?.roles?.length ? <select value={newRole} onChange={event => setNewRole(event.target.value)}>{createOrganization.roles.map(role => <option key={role} value={role}>{role}</option>)}</select> : <input value={newRole} maxLength={60} onChange={event => setNewRole(event.target.value)} placeholder={SECTOR_FORM_EXAMPLES[newSector].role} />}</label>
        <label><span>답변 세트 이름</span><input value={newTitle} maxLength={60} onChange={event => setNewTitle(event.target.value)} placeholder="예: 2026 하반기 1차 면접" /></label>
        <label><span>기존 자기소개서 연결 <small>선택</small></span><select value={newCoverId} onChange={event => { const id = event.target.value; const cover = coverApplications.find(item => item.id === id); setNewCoverId(id); if (cover?.draft) { setNewSector(cover.draft.sector || 'finance'); setNewOrganizationId(cover.draft.organizationId || ''); setNewTargetName(cover.draft.targetName || ''); setNewRole(cover.draft.role || '') } }}><option value="">연결하지 않고 시작</option>{coverApplications.map(item => <option key={item.id} value={item.id}>{item.recruitmentTitle} · {item.draft?.targetName || '지원처 미정'} · {item.draft?.role || '직무 미정'}</option>)}</select></label>
        <button onClick={createScriptSet}><Plus />1분 자기소개부터 작성</button>
      </div>}
    </section>

    <section className="script-link-card">
      <header><FileText weight="duotone" /><div><span>지원처·근거 연결</span><h2>{draft.targetName || '지원처를 먼저 정하세요'}</h2><p>{draft.role || '지원 직무를 선택함'}</p></div></header>
      <label className="script-cover-selector"><span>이 답변의 기준 자기소개서 <small>선택</small></span><select value={linkedCoverApplication?.id || ''} onChange={event => changeLinkedCover(event.target.value)}><option value="">연결하지 않음</option>{coverApplications.map(item => <option key={item.id} value={item.id}>{item.recruitmentTitle} · {item.draft?.targetName || '지원처 미정'} · {item.draft?.role || '직무 미정'}</option>)}</select></label>
      <div className="script-link-flow"><span>자기소개서</span><CaretRight /><b>같은 근거</b><CaretRight /><span>면접 답변</span></div>
      {sourceChanged && <p className="script-link-warning"><WarningCircle weight="fill" />자기소개서 내용이 바뀜 · 면접 답변과 다시 맞춰야 함</p>}
      {foreignOrganization && <p className="script-link-warning"><WarningCircle weight="fill" />다른 지원처명 발견: {foreignOrganization.name} · 제출 전 수정 필요</p>}
      <button onClick={syncCover} disabled={!linkedCoverApplication}><CheckCircle weight="fill" />{linkedCoverApplication ? sourceChanged ? '최신 내용 다시 연결' : '자기소개서 내용 확인·연결' : '자기소개서는 나중에 연결 가능'}</button>
      {linkedCoverItems.length > 0 && <details className="script-linked-source"><summary><Eye />연결된 자기소개서 원문 {linkedCoverItems.length}개 확인<CaretRight /></summary><div>{linkedCoverItems.map(item => <article key={item.id}><b>{item.label}</b><p>{item.answer}</p></article>)}</div></details>}
    </section>

    <nav className="script-type-tabs" aria-label="면접 답변 작성 단계">{scriptOrder.map((id, index) => {
      const unlocked = index === 0 || scriptOrder.slice(0, index).every(key => scriptReady[key])
      return <button key={id} className={active === id ? 'is-on' : index < activeIndex ? 'is-done' : ''} disabled={!unlocked} onClick={() => { if (unlocked && index <= activeIndex) setActive(id) }}><span>{scriptReady[id] ? <CheckCircle weight="fill" /> : index + 1}</span>{INTERVIEW_SCRIPT_LIMITS[id].label}</button>
    })}</nav>

    <section className="script-writing-card">
      <header><div><span>{active === 'introduction' ? '전공·강점 → 대표 근거 → 기여' : active === 'motivation' ? '개인 계기 → 지원처 근거 → 직무 기여' : '핵심 강점 회수 → 첫 행동 → 감사'}</span><h3>{config.label} 완성</h3></div><b className={value.length < config.minLength ? 'is-short' : 'is-ready'}>{value.length}/{config.limit}자<small>약 {speakingSeconds(value)}초</small></b></header>
      <div className="script-assist-list">{assists.map(item => <button key={item.label} onClick={() => append(item.text)}><Plus /><span><b>{item.label}</b><small>{item.text}</small></span></button>)}</div>
      <label><span>내 답변 <small>권장 {config.minLength}~{config.limit}자</small></span><textarea value={value} maxLength={config.limit} rows={active === 'closing' ? 6 : 8} onChange={event => persist({ ...draft, [active]: event.target.value })} placeholder={active === 'introduction' ? '전공과 직무를 연결한 한 문장부터 시작함' : active === 'motivation' ? '지원처를 선택한 나의 계기부터 시작함' : '면접에서 확인된 강점 하나를 짧게 회수함'} /></label>
      <details className="script-model"><summary><Eye />내 학과·활동·자격과 비교할 구조 예시<CaretRight /></summary><PersonalizedCareerExamplePanel interviewType={active} role={draft.role} targetName={draft.targetName} defaultMajorGroup={scriptMajorGroup} defaultSourceType={scriptSourceType} evidenceAction={coverDraft.action} evidenceResult={coverDraft.result} canReveal={value.trim().length >= 60} onUseStarter={text => append(text)} /></details>
      {active !== 'closing' && <button className="script-next-step" onClick={continueScript}>다음 단계 · {INTERVIEW_SCRIPT_LIMITS[scriptOrder[activeIndex + 1]].label}<CaretRight /></button>}
    </section>

    {active === 'closing' && <section className="script-consistency-check"><h3>4단계 · 연결 점검</h3><div><span className={draft.targetName ? 'is-ok' : ''}><CheckCircle />지원처 일치</span><span className={draft.role ? 'is-ok' : ''}><CheckCircle />직무 일치</span><span className={introductionReady ? 'is-ok' : ''}><CheckCircle />자기소개 분량</span><span className={motivationReady ? 'is-ok' : ''}><CheckCircle />지원동기 분량</span><span className={closingReady ? 'is-ok' : ''}><CheckCircle />마지막 말 분량</span><span className={!foreignOrganization && !sourceChanged ? 'is-ok' : ''}><CheckCircle />세 답변 근거 일치</span></div></section>}
    {notice && <p className={`cover-notice ${notice.ok ? 'is-ok' : 'is-error'}`}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
    {active === 'closing' && <button className="script-submit" onClick={submit} disabled={submitting || !ready}><PaperPlaneTilt weight="fill" />{submitting ? '보내는 중' : ready ? '세 답변 교사 첨삭 요청' : '세 답변과 연결 점검을 먼저 완료'}</button>}
    <CoverHistory history={activeHistory} />
  </div>
}

function CoverLetterBuilder({ initialWorkspace = 'learn', initialEvidenceSeed: linkedEvidenceSeed, initialCareerProfile: linkedCareerProfile, onLearningContext }) {
  const { profile } = useAuth() ?? {}
  const seed = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('iv_cover_seed') || '{}') }
    catch { return {} }
  }, [])
  const initialPortfolio = useMemo(() => readCoverPortfolio(seed), [seed])
  const careerProfile = useMemo(() => normalizeCareerContext(linkedCareerProfile || readCareerProfile()), [linkedCareerProfile])
  const careerSources = useMemo(() => careerEvidenceSeeds(careerProfile), [careerProfile])
  const initialEvidenceSeed = useMemo(() => linkedEvidenceSeed || readCareerEvidenceSeed(), [linkedEvidenceSeed])
  const openEvidenceFirst = useMemo(() => localStorage.getItem('iv_cover_open_evidence') === '1', [])
  const [applications, setApplications] = useState(initialPortfolio.projects)
  const [activeApplicationId, setActiveApplicationId] = useState(initialPortfolio.activeId)
  const [draft, setDraft] = useState(() => initialPortfolio.projects.find(item => item.id === initialPortfolio.activeId)?.draft || initialPortfolio.projects[0].draft)
  const [stepIndex, setStepIndex] = useState(0)
  const [workspace, setWorkspace] = useState(openEvidenceFirst || initialWorkspace === 'evidence' ? 'evidence' : initialWorkspace === 'practical' ? 'practical' : initialWorkspace)
  const [practicalFlow] = useState(initialWorkspace === 'practical' || initialWorkspace === 'evidence')
  const assessmentFlow = workspace === 'diagnostic' || workspace === 'mock'
  const [view, setView] = useState('write')
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [evidenceBank, setEvidenceBank] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(COVER_EVIDENCE_CACHE_KEY) || 'null')
      return Array.isArray(cached) ? cached : Array.isArray(draft.evidenceBank) ? draft.evidenceBank : []
    } catch { return Array.isArray(draft.evidenceBank) ? draft.evidenceBank : [] }
  })
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
    : questionItems.filter(item => {
      const count = String(item.answer || '').trim().length
      const { minLength, limit } = coverQuestionLimits(item)
      return count < minLength || count > limit
    }).map(item => {
      const count = String(item.answer || '').trim().length
      const { minLength, limit } = coverQuestionLimits(item)
      return count > limit ? `${item.label} 답변을 최대 ${limit}자 안으로 줄여 주세요.` : `${item.label} 답변을 권장 최소 ${minLength}자까지 작성해 주세요.`
    })
  const ready = missing.length === 0 && questionProblems.length === 0
  const generated = useMemo(() => buildCoverLetter(draft, organization), [draft, organization])
  const activeApplication = applications.find(item => item.id === activeApplicationId) || applications[0]
  const applicationHistory = history.filter(item => {
    const projectId = item.draft?.applicationProjectId
    return projectId ? projectId === activeApplicationId : item.target_name === draft.targetName && item.role_name === draft.role
  })
  const flowMeta = practicalFlow
    ? { eyebrow: 'REAL APPLICATION', title: '실전자기소개서', description: '근거은행부터 지원처별 작성·PDF·교사 첨삭까지 한 흐름으로 완성함.' }
    : workspace === 'diagnostic'
      ? { eyebrow: 'WRITING CHECK-UP', title: '작성 기준 진단', description: '질문 의도·근거·구조·사실성 중 부족한 기준을 찾음.' }
      : workspace === 'mock'
        ? { eyebrow: 'WRITING SIMULATION', title: '자기소개서 모의고사', description: '실제 지원 문항을 제한시간과 글자 수에 맞춰 직접 작성함.' }
        : { eyebrow: 'WRITING CLASS', title: '자기소개서 자율학습', description: '개념부터 자주 묻는 항목별 작성법까지 단원 순서로 익힘.' }

  useEffect(() => {
    loadHistory()
    loadEvidenceBank()
    localStorage.removeItem('iv_cover_open_evidence')
    localStorage.removeItem('iv_cover_evidence_seed_v1')
  }, [profile?.id])

  useEffect(() => {
    localStorage.setItem(COVER_PORTFOLIO_KEY, JSON.stringify({ projects: applications, activeId: activeApplicationId }))
  }, [activeApplicationId, applications])

  async function loadHistory() {
    const { data } = await supabase.rpc('rpc_my_cover_letters')
    setHistory(Array.isArray(data) ? data : [])
  }

  async function loadEvidenceBank() {
    const studentId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (!studentId) return
    const { data, error } = await supabase
      .from('cover_letter_evidence')
      .select('id, major_group, source_type, title, situation, task, action, result, proof, skills, school_grade, occurred_period, career_source_id, quality_score, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    if (error || !Array.isArray(data)) return
    const items = data.map(normalizeEvidence)
    setEvidenceBank(items)
    persistEvidenceInDraft(items)
  }

  function persistEvidenceInDraft(items) {
    localStorage.setItem(COVER_EVIDENCE_CACHE_KEY, JSON.stringify(items))
  }

  async function saveEvidence(item) {
    const quality = careerEvidenceQuality(item)
    const localItem = { ...item, qualityScore: quality.score, id: item.id || `local-${Date.now()}`, createdAt: new Date().toISOString() }
    const studentId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (studentId) {
      const { data, error } = await supabase.from('cover_letter_evidence').insert({
        student_id: studentId,
        major_group: item.majorGroup,
        source_type: item.sourceType,
        title: item.title,
        situation: item.situation,
        task: item.task,
        action: item.action,
        result: item.result,
        proof: item.proof,
        skills: item.skills,
        school_grade: item.grade || null,
        occurred_period: item.occurredPeriod || '',
        career_source_id: item.careerSourceId || '',
        quality_score: quality.score,
      }).select('id, major_group, source_type, title, situation, task, action, result, proof, skills, school_grade, occurred_period, career_source_id, quality_score, created_at').single()
      if (!error && data) Object.assign(localItem, normalizeEvidence(data))
    }
    const next = [localItem, ...evidenceBank]
    setEvidenceBank(next)
    persistEvidenceInDraft(next)
    await publishCareerProfile(careerProfile, { evidenceCount: next.length })
    setNotice({ ok: true, text: '근거 1장을 저장했어요. 작성 문항에서 바로 불러올 수 있어요.' })
  }

  async function deleteEvidence(item) {
    const studentId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (studentId && item.id && !String(item.id).startsWith('local-')) {
      await supabase.from('cover_letter_evidence').delete().eq('id', item.id).eq('student_id', studentId)
    }
    const next = evidenceBank.filter(value => value.id !== item.id)
    setEvidenceBank(next)
    persistEvidenceInDraft(next)
    await publishCareerProfile(careerProfile, { evidenceCount: next.length })
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
    commitDraft(next)
    setWorkspace('write')
    setStepIndex(COVER_LETTER_STEPS.findIndex(value => value.id === 'experience'))
    setNotice({ ok: true, text: '선택한 근거를 경험 단계에 연결했어요. 사실과 표현을 다시 확인해 주세요.' })
  }

  function commitDraft(nextDraft, projectPatch = {}) {
    const next = {
      ...nextDraft,
      applicationProjectId: activeApplicationId,
      recruitmentTitle: projectPatch.recruitmentTitle ?? activeApplication?.recruitmentTitle ?? nextDraft.recruitmentTitle ?? '',
      applicationDeadline: projectPatch.deadline ?? activeApplication?.deadline ?? nextDraft.applicationDeadline ?? '',
      applicationStatus: projectPatch.status ?? activeApplication?.status ?? nextDraft.applicationStatus ?? 'writing',
    }
    setDraft(next)
    setApplications(current => current.map(project => project.id === activeApplicationId ? {
      ...project,
      ...projectPatch,
      recruitmentTitle: projectPatch.recruitmentTitle ?? project.recruitmentTitle,
      deadline: projectPatch.deadline ?? project.deadline,
      status: projectPatch.status ?? project.status,
      updatedAt: new Date().toISOString(),
      draft: next,
    } : project))
    localStorage.setItem('iv_cover_draft', JSON.stringify(next))
    localStorage.removeItem('iv_cover_seed')
  }

  function selectApplication(id, destination = 'write') {
    const selected = applications.find(item => item.id === id)
    if (!selected) return
    setActiveApplicationId(id)
    setDraft(selected.draft)
    localStorage.setItem('iv_cover_draft', JSON.stringify(selected.draft))
    setStepIndex(0)
    setNotice(null)
    setWorkspace(destination)
  }

  function createApplication(form, sourceId = null) {
    const source = applications.find(item => item.id === sourceId)
    const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === form.organizationId)
    const reusable = source ? {
      major: source.draft.major || '',
      majorSkill: source.draft.majorSkill || '',
      experience: source.draft.experience || '',
      action: source.draft.action || '',
      result: source.draft.result || '',
    } : {}
    const base = {
      sector: form.sector || organization?.sector || 'finance',
      organizationId: organization?.id || '',
      targetName: organization?.name || form.targetName.trim(),
      targetEvidence: organization?.identity || '',
      role: form.role.trim() || organization?.roles?.[0] || '',
      roleNeed: '',
      motivation: '',
      contribution: '',
      ...reusable,
      evidenceBank,
    }
    const project = makeCoverApplication(base, {
      recruitmentTitle: form.recruitmentTitle.trim() || `${base.targetName || '새 지원처'} 채용`,
      deadline: form.deadline,
    })
    const placeholders = applications.filter(item => hasCoverContent(item.draft) || item.id !== activeApplicationId)
    setApplications([project, ...placeholders])
    setActiveApplicationId(project.id)
    setDraft(project.draft)
    localStorage.setItem('iv_cover_draft', JSON.stringify(project.draft))
    setStepIndex(0)
    setWorkspace('write')
    setNotice({ ok: true, text: source ? '개인 경험 근거만 가져왔어요. 지원처 근거와 문항 답변은 새로 확인해 주세요.' : '새 지원서를 만들었어요. 채용공고의 실제 문항과 글자 수부터 확인해 주세요.' })
  }

  function updateApplicationStatus(id, status) {
    setApplications(current => current.map(project => project.id === id ? {
      ...project,
      status,
      updatedAt: new Date().toISOString(),
      draft: { ...project.draft, applicationStatus: status },
    } : project))
    if (id === activeApplicationId) setDraft(current => ({ ...current, applicationStatus: status }))
  }

  function update(key, value) {
    const next = { ...draft, [key]: value }
    if (key === 'sector') {
      const sectorDraft = { ...next, organizationId: '', targetName: '', targetEvidence: '', role: '', roleNeed: '', motivation: '', contribution: '' }
      sectorDraft.coverItems = defaultCoverItems(value, null, sectorDraft)
      Object.assign(next, sectorDraft)
    }
    if (key === 'organizationId') {
      const org = INTERVIEW_ORGANIZATIONS.find(item => item.id === value)
      const organizationDraft = {
        ...next,
        sector: org?.sector || next.sector,
        targetName: org?.name || '',
        targetEvidence: org?.identity || '',
        role: org?.roles?.[0] || '',
        roleNeed: '',
        motivation: '',
        contribution: '',
      }
      organizationDraft.coverItems = org ? defaultCoverItems(org.sector, org, organizationDraft) : defaultCoverItems(next.sector, null, organizationDraft)
      Object.assign(next, organizationDraft)
    }
    commitDraft(next)
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
      const safeName = String(`${draft.targetName || '지원처'}_${draft.recruitmentTitle || '자기소개서'}`).replace(/[\\/:*?"<>|]/g, '')
      pdf.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
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
    const submissionDraft = { ...draft, evidenceBank, careerProfileSnapshot: careerProfileSnapshot(careerProfile, { evidenceCount: evidenceBank.length }), applicationProjectId: activeApplicationId, recruitmentTitle: activeApplication?.recruitmentTitle || draft.recruitmentTitle, applicationDeadline: activeApplication?.deadline || draft.applicationDeadline }
    const { data, error } = await supabase.rpc('rpc_submit_cover_letter', { p_sector: draft.sector, p_organization_id: draft.organizationId || null, p_target_name: draft.targetName, p_role: draft.role, p_draft: submissionDraft, p_generated_text: generated.map(item => `${item.title}\n${item.body}`).join('\n\n') })
    setSubmitting(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: data?.error === 'no_class' ? '소속 학급을 확인한 뒤 다시 요청해 주세요.' : '첨삭 요청을 보내지 못했어요. 연결 상태를 확인해 주세요.' })
      return
    }
    updateApplicationStatus(activeApplicationId, 'submitted')
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
        <CoverHistory history={applicationHistory} />
      </div>
    )
  }

  return (
    <div className="cover-builder">
      {!assessmentFlow && <section className="cover-brand-panel">
        <div><span>{flowMeta.eyebrow}</span><h2>{flowMeta.title}</h2><p>{flowMeta.description}</p></div>
        {practicalFlow && <b>{evidenceBank.length}<small>근거 카드</small></b>}
      </section>}
      {workspace === 'practical' && <CoverApplicationPortfolio applications={applications} activeId={activeApplicationId} history={history} evidenceCount={evidenceBank.length} onCreate={createApplication} onSelect={selectApplication} onStatus={updateApplicationStatus} onEvidence={() => setWorkspace('evidence')} />}
      {workspace === 'learn' && <CoverLearningLibrary onLearningContext={onLearningContext} />}
      {workspace === 'diagnostic' && <CoverLetterAssessment mode="diagnostic" onGoLearn={() => setWorkspace('learn')} />}
      {workspace === 'mock' && <CoverLetterAssessment mode="mock" onGoLearn={() => setWorkspace('learn')} onGoPractical={() => setWorkspace('practical')} />}
      {workspace === 'evidence' && <><CoverApplicationContext applications={applications} activeId={activeApplicationId} mode="evidence" onSelect={id => selectApplication(id, 'evidence')} onProgress={() => setWorkspace('write')} /><EvidenceWorkbench items={evidenceBank} sourceCandidates={careerSources} initialSeed={initialEvidenceSeed} onSave={saveEvidence} onDelete={deleteEvidence} onUse={useEvidence} /></>}
      {workspace === 'write' && <>
      <CoverApplicationContext applications={applications} activeId={activeApplicationId} mode="write" onSelect={id => selectApplication(id, 'write')} onProgress={() => setWorkspace('practical')} />
      <div className="cover-progress"><div><strong>{sector.headline}</strong><span>{completed}/{COVER_LETTER_FIELDS.length}</span></div><div><i style={{ width: `${pct}%` }} /></div><p>자동 저장됨 · 한 단계씩 점검한 뒤 완성본으로 연결함</p></div>
      <nav className="cover-step-tabs" aria-label="자기소개서 작성 단계">{COVER_LETTER_STEPS.map((item, index) => <button key={item.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-past' : 'is-future'} disabled={index > stepIndex} onClick={() => { if (index <= stepIndex) setStepIndex(index) }}><span>{index < stepIndex ? <CheckCircle weight="fill" /> : index + 1}</span><b>{item.title.replace(/^\d+\.\s*/, '')}</b></button>)}</nav>
      <section className="cover-step-heading"><span>STEP {stepIndex + 1}</span><h2>{step.title.replace(/^\d+\.\s*/, '')}</h2><p>{step.check}</p></section>
      {step.id === 'target' && <><div className="cover-sector-picker">{SECTORS.map(item => { const Icon = item.icon; return <button key={item.id} className={draft.sector === item.id ? 'is-active' : ''} onClick={() => update('sector', item.id)}><Icon weight={draft.sector === item.id ? 'fill' : 'regular'} /><b>{item.label}</b><small>{COVER_LETTER_SECTOR_CONTENT[item.id].focus[0]}</small></button> })}</div><label className="cover-org-select"><span>연구한 지원처 불러오기</span><select value={draft.organizationId || ''} onChange={event => update('organizationId', event.target.value)}><option value="">직접 입력</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.group}</option>)}</select></label><div className="cover-sector-focus">{sector.focus.map(item => <span key={item}><CheckCircle weight="fill" />{item}</span>)}</div>{organization && <details className="cover-org-sample"><summary><FileText weight="duotone" /><span><b>{organization.name} 완성 예시 보기</b><small>구조만 참고하고 경험·수치 복사는 금지</small></span><CaretRight /></summary><div>{organization.sampleCoverLetter.map(item => <section key={item.title}><h3>{item.title}</h3><p>{item.body}</p></section>)}</div></details>}</>}
      {step.id === 'questions' && <QuestionComposer sector={draft.sector} organization={organization} items={questionItems} draft={draft} evidenceBank={evidenceBank} onChange={items => update('coverItems', items)} />}
      {step.id === 'audit' ? <section className="cover-ready"><FileText weight="duotone" /><h3>{ready ? '완성본을 만들 준비가 됐어요' : `${missing.length + questionProblems.length}가지를 더 확인해요`}</h3><p>{missing.length ? missing.map(item => item.label).join(' · ') : questionProblems.length ? questionProblems[0] : `${questionItems.length}개 문항을 화면에서 먼저 읽고 PDF 저장 또는 선생님 첨삭 요청으로 이어갈 수 있어요.`}</p><button onClick={openPreview} disabled={!ready}><Eye weight="fill" />완성본 생성·확인</button></section> : step.id !== 'questions' && <>
        {step.id === 'experience' && <section className="cover-evidence-entry"><ClipboardText weight="duotone" /><div><b>내 경험 근거부터 꺼내기</b><p>저장한 실습·프로젝트 경험을 선택하면 행동과 결과 칸에 연결됩니다.</p></div><button onClick={() => setWorkspace('evidence')}>{evidenceBank.length ? `근거 ${evidenceBank.length}장 보기` : '근거 만들기'}<CaretRight /></button></section>}
        <div className="cover-fields">{stepFields.map(field => <CoverField key={field.key} field={field} value={draft[field.key] || ''} sector={draft.sector} organization={organization} onChange={value => update(field.key, value)} />)}</div>
      </>}
      {notice && <p className={`cover-notice ${notice.ok ? 'is-ok' : 'is-error'}`}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}
      <footer className="cover-step-actions"><button onClick={() => setStepIndex(value => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft />이전</button>{stepIndex < COVER_LETTER_STEPS.length - 1 ? <button className="is-primary" onClick={goNext}>다음 단계<CaretRight /></button> : <button className="is-primary" onClick={openPreview} disabled={!ready}><Eye />완성본 보기</button>}</footer>
      <CoverHistory history={applicationHistory} />
      </>}
    </div>
  )
}

function CoverApplicationContext({ applications, activeId, mode, onSelect, onProgress }) {
  const active = applications.find(item => item.id === activeId) || applications[0]
  const available = applications.filter(item => item.status !== 'archived')
  return <section className="cover-active-application">
    <div><span>{mode === 'evidence' ? '근거를 연결할 지원서' : '작성 중인 지원서 선택'}</span><label><select value={active?.id || ''} onChange={event => onSelect(event.target.value)} aria-label="현재 작업할 지원서">{available.map(item => <option key={item.id} value={item.id}>{item.recruitmentTitle} · {item.draft.targetName || '지원처 미정'}</option>)}</select></label><small>{active?.draft.targetName || '지원처 선택 전'} · {active?.draft.role || '직무 선택 전'}{active?.deadline ? ` · ${active.deadline} 마감` : ''}</small></div>
    <button onClick={onProgress}>{mode === 'evidence' ? <ArrowLeft /> : <FolderOpen />}{mode === 'evidence' ? '작성으로 돌아가기' : '지원서 목록'}</button>
  </section>
}

function CoverApplicationPortfolio({ applications, activeId, history, evidenceCount, onCreate, onSelect, onStatus, onEvidence }) {
  const [showCreate, setShowCreate] = useState(false)
  const [copySourceId, setCopySourceId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState({ sector: 'finance', organizationId: '', targetName: '', role: '', recruitmentTitle: '', deadline: '' })
  const formExamples = SECTOR_FORM_EXAMPLES[form.sector] || SECTOR_FORM_EXAMPLES.finance
  const visible = applications.filter(item => showArchived || item.status !== 'archived')
  const submittedCount = applications.filter(item => ['submitted', 'passed'].includes(item.status)).length
  const passedCount = applications.filter(item => item.status === 'passed').length

  function change(key, value) {
    setForm(current => {
      const next = { ...current, [key]: value }
      if (key === 'sector') Object.assign(next, { organizationId: '', targetName: '', role: '' })
      if (key === 'organizationId') {
        const organization = INTERVIEW_ORGANIZATIONS.find(item => item.id === value)
        Object.assign(next, { targetName: organization?.name || '', role: organization?.roles?.[0] || '', recruitmentTitle: organization ? `${organization.name} 채용` : current.recruitmentTitle })
      }
      return next
    })
  }

  function openCreate(source = null) {
    setCopySourceId(source?.id || null)
    setForm({
      sector: source?.draft.sector || 'finance',
      organizationId: '',
      targetName: '',
      role: source?.draft.role || '',
      recruitmentTitle: '',
      deadline: '',
    })
    setShowCreate(true)
  }

  function submit() {
    if (!form.targetName.trim() || !form.role.trim()) return
    onCreate(form, copySourceId)
    setShowCreate(false)
    setCopySourceId(null)
  }

  function progressFor(project) {
    const completed = COVER_LETTER_FIELDS.filter(field => String(project.draft[field.key] || '').trim().length >= field.minLength).length
    const questions = Array.isArray(project.draft.coverItems) ? project.draft.coverItems : []
    const completeQuestions = questions.filter(item => {
      const { minLength, limit } = coverQuestionLimits(item)
      const count = String(item.answer || '').trim().length
      return count >= minLength && count <= limit
    }).length
    const total = COVER_LETTER_FIELDS.length + Math.max(questions.length, 2)
    return Math.min(100, Math.round((completed + completeQuestions) / total * 100))
  }

  function latestReview(project) {
    return history.find(item => item.draft?.applicationProjectId === project.id)
  }

  return (
    <section className="cover-application-portfolio">
      <header>
        <div><span>MY APPLICATIONS</span><h3>지원서 보관함</h3><p>지원처·직무·채용회차마다 자기소개서를 따로 관리하고, 나의 근거는 모든 지원서에서 함께 사용함.</p></div>
        <button onClick={() => openCreate()}><Plus weight="bold" />새 지원서</button>
      </header>
      <div className="cover-portfolio-summary">
        <div><b>{applications.filter(item => item.status !== 'archived').length}</b><span>전체 지원서</span></div>
        <div><b>{applications.filter(item => item.status === 'writing').length}</b><span>작성 중</span></div>
        <div><b>{submittedCount}</b><span>지원 완료</span></div>
        <div><b>{passedCount}</b><span>서류 합격</span></div>
      </div>

      {showCreate && <section className="cover-application-create">
        <header><div><b>{copySourceId ? '근거를 이어 새 지원서 만들기' : '새 지원서 만들기'}</b><p>{copySourceId ? '전공·경험·행동·결과만 가져오고 지원처 문장과 답변은 비워 둠.' : '지원하는 채용공고 한 건을 기준으로 작성 공간을 만듦.'}</p></div><button onClick={() => setShowCreate(false)} aria-label="새 지원서 만들기 닫기">×</button></header>
        <div className="cover-application-form">
          <label><span>지원 분야</span><select value={form.sector} onChange={event => change('sector', event.target.value)}>{SECTORS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>등록 지원처</span><select value={form.organizationId} onChange={event => change('organizationId', event.target.value)}><option value="">직접 입력</option>{INTERVIEW_ORGANIZATIONS.filter(item => item.sector === form.sector).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>기업·기관명</span><input value={form.targetName} onChange={event => change('targetName', event.target.value)} placeholder={formExamples.targetName} /></label>
          <label><span>지원 직무</span><input value={form.role} onChange={event => change('role', event.target.value)} placeholder={formExamples.role} /></label>
          <label className="is-wide"><span>채용공고·회차 이름</span><input value={form.recruitmentTitle} onChange={event => change('recruitmentTitle', event.target.value)} placeholder="예: 2026년 하반기 고졸 신입 채용" /></label>
          <label><span>마감일</span><input type="date" value={form.deadline} onChange={event => change('deadline', event.target.value)} /></label>
        </div>
        <button className="cover-application-create-submit" onClick={submit} disabled={!form.targetName.trim() || !form.role.trim()}><FolderOpen weight="fill" />작성 공간 만들기</button>
      </section>}

      <div className="cover-application-list">
        {visible.map(project => {
          const progress = progressFor(project)
          const review = latestReview(project)
          return <article key={project.id} className={project.id === activeId ? 'is-active' : ''}>
            <button className="cover-application-open" onClick={() => onSelect(project.id)}>
              <span><FileText weight="duotone" /></span>
              <div><small>{project.recruitmentTitle}</small><b>{project.draft.targetName || '지원처 미정'} · {project.draft.role || '직무 미정'}</b><p>{project.deadline ? `${project.deadline} 마감` : '마감일 미지정'} · 최근 저장 {new Date(project.updatedAt).toLocaleDateString('ko-KR')}</p><i><em style={{ width: `${progress}%` }} /></i></div>
              <strong>{progress}%<CaretRight /></strong>
            </button>
            <footer>
              <span className={`is-${review?.status || project.status}`}>{review ? STATUS_LABELS[review.status] || review.status : APPLICATION_STATUS[project.status]}</span>
              <select value={project.status} onChange={event => onStatus(project.id, event.target.value)} aria-label={`${project.recruitmentTitle} 진행 상태`}><option value="writing">작성 중</option><option value="submitted">지원 완료</option><option value="passed">서류 합격</option><option value="not_selected">미선발</option><option value="archived">보관</option></select>
              <button onClick={() => openCreate(project)}><Copy />근거로 새 지원서</button>
              {project.status !== 'archived' && <button onClick={() => onStatus(project.id, 'archived')}><Archive />보관</button>}
            </footer>
          </article>
        })}
      </div>
      {!visible.length && <div className="cover-portfolio-empty"><Archive /><b>보관 중인 지원서만 있어요</b><button onClick={() => setShowArchived(true)}>보관함 보기</button></div>}
      <div className="cover-portfolio-tools"><button onClick={onEvidence}><ClipboardText weight="fill" /><span><b>공용 근거은행 {evidenceCount}장</b><small>한 번 정리한 경험을 여러 지원서에 연결</small></span><CaretRight /></button><button onClick={() => setShowArchived(value => !value)}><Archive /><span><b>{showArchived ? '진행 중만 보기' : '보관 지원서 보기'}</b><small>미선발 지원서도 삭제하지 않고 다음 지원에 활용</small></span></button></div>
      <aside><ShieldCheck weight="fill" /><p>새 지원서에는 개인 경험 근거만 재사용합니다. 기업명·공식 근거·지원동기·공고 문항은 현재 채용공고에 맞춰 반드시 다시 확인합니다.</p></aside>
    </section>
  )
}

function CoverLearningLibrary({ onLearningContext }) {
  const groups = useMemo(() => {
    const grouped = new Map()
    COVER_LETTER_QUESTION_LIBRARY.forEach(item => {
      const group = questionGuide(item.id, item).group
      grouped.set(group, [...(grouped.get(group) || []), item])
    })
    return [...grouped.entries()].map(([label, items]) => ({ label, items }))
  }, [])
  const [groupLabel, setGroupLabel] = useState(null)
  const [index, setIndex] = useState(0)
  const group = groups.find(item => item.label === groupLabel)
  const item = group?.items[index]
  const content = useMemo(() => item ? questionGuide(item.id, item) : null, [item])

  useEffect(() => {
    if (!onLearningContext) return
    if (!group || !item || !content) {
      onLearningContext({
        subject: 'cover-letter',
        mode: 'study',
        stage: 'area-choice',
        areaLabel: '자기소개서 배우기',
        lessonLabel: '학습 범위 선택',
      })
      return
    }
    onLearningContext({
      subject: 'cover-letter',
      mode: 'study',
      stage: 'concept',
      areaLabel: group.label,
      lessonLabel: item.label,
      title: item.question,
      position: index + 1,
      total: group.items.length,
      revealed: true,
      content: {
        kind: 'question',
        question: {
          stem: item.question,
          context: `${group.label} · ${item.label}`,
          choices: [
            { label: '좋은 예시', text: content.good, explanation: item.purpose },
            { label: '감점 예시', text: content.trap, explanation: '지원처 근거·학생 행동·확인 가능한 결과 중 빠진 요소를 찾음.' },
          ],
          answerIndex: 0,
          explanation: item.purpose,
          thinkingSteps: content.structure,
          distractorTypes: [`감점 표현: ${content.trap}`],
        },
      },
    })
  }, [content, group, index, item, onLearningContext])

  function openGroup(label) {
    setGroupLabel(label)
    setIndex(0)
  }

  if (!group || !item || !content) {
    return <section className="cover-learning-library">
      <header><div><span>개념·질문 유형 30개</span><h3>자기소개서 개념과 작성법</h3><p>학습 범위를 고른 뒤 개념·실제 예시·감점 포인트를 순서대로 익힘.</p></div><BookOpen weight="duotone" /></header>
      <section className="cover-learning-overview"><strong>학습 순서</strong><div><span>1</span>범위 선택<i /><span>2</span>개념·질문 이해<i /><span>3</span>좋은 예시·감점 비교</div></section>
      <p className="cover-learning-count">학습 범위 선택 · 전체 {COVER_LETTER_QUESTION_LIBRARY.length}개 항목</p>
      <div className="cover-learning-unit-list">{groups.map((value, groupIndex) => <button key={value.label} onClick={() => openGroup(value.label)}><span>{groupIndex + 1}</span><div><b>{value.label}</b><p>{value.items.map(entry => entry.label).join(' · ')}</p></div><strong>{value.items.length}개</strong><CaretRight /></button>)}</div>
    </section>
  }

  const last = index === group.items.length - 1
  return <section className="cover-learning-session">
    <header><button onClick={() => setGroupLabel(null)} aria-label="학습 범위로 돌아가기"><ArrowLeft /></button><div><span>{group.label}</span><b>{item.label}</b></div><strong>{index + 1}/{group.items.length}</strong></header>
    <div className="cover-learning-progress"><i style={{ width: `${(index + 1) / group.items.length * 100}%` }} /></div>
    <article className="cover-learning-card">
      <div className="cover-learning-question"><span>개념 {index + 1}</span><h3>{item.label}</h3><p>{item.question}</p></div>
      <section><b>이 개념을 이해해요</b><p>{item.purpose}</p></section>
      <section className="is-structure"><b>답변은 이렇게 구성해요</b><ol>{content.structure.map(value => <li key={value}>{value}</li>)}</ol></section>
      <div className="cover-learning-examples"><section className="is-good"><b>좋은 예시</b><p>{content.good}</p></section><section className="is-trap"><b>감점 예시</b><p>{content.trap}</p></section></div>
      <PersonalizedCareerExamplePanel questionId={item.id} />
      <section className="is-evidence"><b>내 경험에서 찾을 것</b><div>{content.evidenceHints.map(value => <em key={value}>{value}</em>)}</div></section>
    </article>
    <footer><button onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}><ArrowLeft />이전</button><button className="is-primary" onClick={() => last ? setGroupLabel(null) : setIndex(value => value + 1)}>{last ? '단원 완료' : '다음'}<CaretRight /></button></footer>
  </section>
}

function EvidenceWorkbench({ items, sourceCandidates = [], initialSeed = null, onSave, onDelete, onUse }) {
  const emptyForm = { majorGroup: 'business', sourceType: '전공 실습', title: '', situation: '', task: '', action: '', result: '', proof: '', skills: [], grade: 1, occurredPeriod: '', careerSourceId: '' }
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(initialSeed || {}) }))
  const major = COVER_EVIDENCE_MAJOR_GROUPS.find(item => item.id === form.majorGroup) || COVER_EVIDENCE_MAJOR_GROUPS[0]
  const ready = form.title.trim().length >= 2 && form.situation.trim().length >= 10 && form.action.trim().length >= 15 && form.result.trim().length >= 8
  const quality = careerEvidenceQuality(form)

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
    setForm(current => ({ ...emptyForm, majorGroup: current.majorGroup, grade: current.grade }))
  }

  function selectSource(candidate) {
    setForm({ ...emptyForm, ...candidate, skills: candidate.skills || [] })
  }

  return (
    <section className="cover-evidence-workbench">
      <header><div><span>EXPERIENCE BANK</span><h3>작은 경험도 근거 1장으로</h3><p>수상 경력이 없어도 직접 한 행동과 확인 가능한 변화가 있으면 좋은 근거가 됨.</p></div><b>{items.length}</b></header>
      {sourceCandidates.length > 0 && <section className="evidence-source-candidates"><header><div><b>내 교과외활동에서 이어 쓰기</b><p>회원정보에 쌓은 기록을 불러오고, 비어 있는 행동만 사실대로 보완합니다.</p></div><span>{sourceCandidates.filter(candidate => !items.some(item => item.careerSourceId === candidate.id)).length}개 작성 가능</span></header><div>{sourceCandidates.map(candidate => { const used = items.some(item => item.careerSourceId === candidate.id); return <button key={candidate.id} disabled={used} onClick={() => selectSource(candidate)}><span>{candidate.grade}학년 · {candidate.sourceType}</span><b>{candidate.title}</b><small>{used ? '근거 카드로 전환됨' : candidate.missing.length ? `${candidate.missing.join(' · ')} 보완 필요` : '행동을 구체화하면 저장 가능'}</small><CaretRight /></button> })}</div></section>}
      <div className="evidence-guide-strip"><b>빈칸 대신 순서대로 고름</b><span>전공·상황</span><CaretRight /><span>내 역할</span><CaretRight /><span>행동</span><CaretRight /><span>결과</span></div>
      <section className="evidence-form">
        <fieldset><legend>1. 전공·분야</legend><div className="evidence-chip-grid">{COVER_EVIDENCE_MAJOR_GROUPS.map(item => <button key={item.id} className={form.majorGroup === item.id ? 'is-on' : ''} onClick={() => change('majorGroup', item.id)}>{item.label}</button>)}</div></fieldset>
        <fieldset><legend>2. 어디에서 한 경험인가?</legend><div className="evidence-chip-grid">{COVER_EVIDENCE_SOURCES.map(value => <button key={value} className={form.sourceType === value ? 'is-on' : ''} onClick={() => change('sourceType', value)}>{value}</button>)}</div></fieldset>
        <fieldset><legend>3. 이 경험에서 쓴 기술·태도</legend><div className="evidence-chip-grid">{major.examples.map(value => <button key={value} className={form.skills.includes(value) ? 'is-on' : ''} onClick={() => toggleSkill(value)}>{value}</button>)}</div></fieldset>
        <div className="evidence-history-fields"><label><span>기록 학년</span><select value={form.grade} onChange={event => change('grade', Number(event.target.value))}><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option></select></label><label><span>활동 기간</span><input value={form.occurredPeriod || ''} onChange={event => change('occurredPeriod', event.target.value)} placeholder="예: 2026.03~07" /></label></div>
        <label><span>근거 카드 이름 <small>나중에 찾기 쉬운 짧은 이름</small></span><input value={form.title} onChange={event => change('title', event.target.value)} placeholder="예: 판매 프로젝트 정산 오류 해결" /></label>
        <label><span>상황 <small>언제·어디서·무슨 일이 있었나?</small></span><div className="evidence-starters"><button onClick={() => append('situation', `${form.sourceType}에서 `)}>“{form.sourceType}에서”로 시작</button></div><textarea value={form.situation} onChange={event => change('situation', event.target.value)} placeholder="예: 교내 판매 프로젝트 마감 전 재고와 매출 기록이 맞지 않았음." rows={3} /></label>
        <label><span>내 역할·목표 <small>팀 전체가 아니라 내가 맡은 일</small></span><div className="evidence-starters"><button onClick={() => append('task', '제가 맡은 역할은 ')}>“제가 맡은 역할은” 넣기</button></div><textarea value={form.task} onChange={event => change('task', event.target.value)} placeholder="예: 거래 기록을 다시 확인해 마감 전에 정산표를 맞추는 역할" rows={3} /></label>
        <label><span>직접 한 행동 <small>확인 → 판단 → 실행 → 협업·보고</small></span><div className="evidence-starters">{COVER_EVIDENCE_ACTIONS.map(value => <button key={value} onClick={() => append('action', value)}>{value}</button>)}</div><textarea value={form.action} onChange={event => change('action', event.target.value)} placeholder="예: 거래 내역을 시간순으로 분류하고 영수증과 대조한 뒤 팀원과 수정 금액을 검산함." rows={4} /></label>
        <label><span>결과·배운 점 <small>수치·완성물·시간·오류·피드백</small></span><div className="evidence-starters">{COVER_EVIDENCE_RESULTS.map(value => <button key={value} onClick={() => append('result', value)}>{value}</button>)}</div><textarea value={form.result} onChange={event => change('result', event.target.value)} placeholder="예: 누락 3건을 찾아 정산표를 맞추고 검산 칸을 추가함." rows={3} /></label>
        <label><span>확인 근거 <small>없으면 비워도 됨</small></span><input value={form.proof} onChange={event => change('proof', event.target.value)} placeholder="예: 완성 파일·작업일지·담당 교사 피드백" /></label>
        <div className="evidence-quality"><span><b>{quality.level}</b><strong>{quality.score}/100</strong></span><div>{quality.checks.map(item => <em key={item.id} className={item.ok ? 'is-ok' : ''}>{item.ok ? <CheckCircle weight="fill" /> : <WarningCircle />}{item.label}</em>)}</div></div>
        <button className="evidence-save" onClick={save} disabled={!ready}><Plus />근거 1장 저장</button>
      </section>
      <section className="evidence-saved-list"><h3>저장한 근거</h3>{items.length === 0 ? <div className="evidence-empty"><ClipboardText /><b>아직 저장한 근거가 없음</b><p>전공 실습이나 작은 역할 하나부터 시작함.</p></div> : items.map(item => { const itemQuality = careerEvidenceQuality(item); return <article key={item.id}><header><div><span>{item.grade ? `${item.grade}학년 · ` : ''}{item.sourceType}</span><b>{item.title}</b><small className={`is-quality-${itemQuality.score}`}>{itemQuality.level} · {itemQuality.score}점</small></div><button onClick={() => onDelete(item)} aria-label="근거 삭제"><Trash /></button></header><p>{item.situation}</p><div>{item.skills.map(value => <em key={value}>{value}</em>)}</div><footer><span>{item.result}</span><button onClick={() => onUse(item)}>작성에 사용<CaretRight /></button></footer></article> })}</section>
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
    grade: row.school_grade || null,
    occurredPeriod: row.occurred_period || '',
    careerSourceId: row.career_source_id || '',
    qualityScore: Number(row.quality_score || 0),
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
    return normalizeCoverItem({ ...template, instanceId: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, answer: seedQuestionAnswer(id, draft) })
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
  const [custom, setCustom] = useState({ label: '', question: '', minLength: 500, limit: 700 })
  const available = COVER_LETTER_QUESTION_LIBRARY.filter(item => item.sectors.includes(sector) && !items.some(selected => selected.id === item.id && !selected.custom))

  function addTemplate(template) {
    onChange([...items, normalizeCoverItem({ ...template, instanceId: `${template.id}-${Date.now()}`, answer: seedQuestionAnswer(template.id, draft) })])
  }

  function addCustom() {
    if (custom.label.trim().length < 2 || custom.question.trim().length < 8) return
    const limits = coverQuestionLimits(custom)
    onChange([...items, { id: `custom-${Date.now()}`, instanceId: `custom-${Date.now()}`, custom: true, label: custom.label.trim(), question: custom.question.trim(), purpose: '지원처가 요구한 내용을 빠짐없이 자신의 근거로 작성함.', required: ['질문의 핵심 요구', '내 행동 근거', '지원 직무 연결'], ...limits, answer: '' }])
    setCustom({ label: '', question: '', minLength: 500, limit: 700 })
    setShowCustom(false)
  }

  function updateItem(index, changes) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? normalizeCoverItem({ ...item, ...changes }) : item))
  }

  function updateLimits(index, changes) {
    const current = items[index]
    const currentLimits = coverQuestionLimits(current)
    const limit = changes.limit == null ? currentLimits.limit : Math.max(100, Math.min(2000, Number(changes.limit) || 100))
    const minLength = changes.minLength == null ? Math.min(currentLimits.minLength, limit) : Math.max(50, Math.min(limit, Number(changes.minLength) || 50))
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, minLength, limit } : item))
  }

  function addStarter(index, starter) {
    const current = String(items[index].answer || '').trim()
    updateItem(index, { answer: `${current}${current ? '\n' : ''}${starter}`.slice(0, coverQuestionLimits(items[index]).limit) })
  }

  function useBankEvidence(index, evidence) {
    const answer = [evidence.situation, evidence.task, evidence.action, evidence.result].filter(Boolean).join(' ')
    updateItem(index, { answer: answer.slice(0, coverQuestionLimits(items[index]).limit), evidenceId: evidence.id })
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
      {showCustom && <div className="cover-custom-question"><label><span>항목 이름</span><input value={custom.label} onChange={event => setCustom(value => ({ ...value, label: event.target.value }))} placeholder="예: 당행 인재상" /></label><label><span>실제 질문</span><textarea value={custom.question} onChange={event => setCustom(value => ({ ...value, question: event.target.value }))} placeholder="채용공고의 자기소개서 문항을 입력" rows={3} /></label><div className="cover-custom-limits"><label><span>권장 최소</span><input type="number" min="50" max={custom.limit} step="50" value={custom.minLength} onChange={event => setCustom(value => ({ ...value, minLength: Math.min(Number(value.limit) || 700, Number(event.target.value) || 50) }))} /></label><label><span>최대 글자 수</span><input type="number" min="100" max="2000" step="50" value={custom.limit} onChange={event => setCustom(value => ({ ...value, limit: Number(event.target.value) || 100, minLength: Math.min(Number(value.minLength) || 50, Number(event.target.value) || 100) }))} /></label></div><button onClick={addCustom}><Plus />이 문항 추가</button></div>}
      <div className="cover-selected-questions">{items.map((item, index) => {
        const count = String(item.answer || '').length
        const { minLength, limit } = coverQuestionLimits(item)
        const guide = questionGuide(item.id, item)
        const selectedEvidence = evidenceBank.find(value => value.id === item.evidenceId) || evidenceBank[0]
        const warnings = coverAnswerWarnings(item.answer, draft, minLength, limit)
        const lengthStatus = count > limit ? `${count - limit}자 초과` : count < minLength ? `${minLength - count}자 더 필요` : '권장 분량 충족'
        return <article key={item.instanceId || `${item.id}-${index}`}><header><span>{index + 1}</span><div><b>{item.label}</b><p>{item.question}</p></div><div className="cover-question-order"><button onClick={() => move(index, -1)} disabled={index === 0} aria-label="위로 이동"><ArrowUp /></button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="아래로 이동"><ArrowDown /></button><button onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label="문항 삭제"><Trash /></button></div></header><div className="cover-question-purpose"><b>평가 의도</b><p>{item.purpose}</p><span>{item.required.map(value => <em key={value}>{value}</em>)}</span></div>
          <div className="cover-length-panel"><header><div><b>공고 글자 수</b><span>실제 채용공고 기준이 최우선</span></div><strong className={count < minLength || count > limit ? 'is-short' : 'is-ready'}>{lengthStatus}</strong></header><div className="cover-length-inputs"><label><span>권장 최소</span><input type="number" min="50" max={limit} step="50" value={minLength} onChange={event => updateLimits(index, { minLength: event.target.value })} /></label><label><span>최대 글자 수</span><input type="number" min="100" max="2000" step="50" value={limit} onChange={event => updateLimits(index, { limit: event.target.value })} /></label></div><div className="cover-length-presets" aria-label="자주 쓰는 글자 수 범위">{COVER_LENGTH_PRESETS.map(preset => <button key={preset.limit} className={limit === preset.limit ? 'is-on' : ''} onClick={() => updateLimits(index, preset)}>{preset.label}</button>)}</div></div>
          <details className="cover-answer-coach" open={!item.answer}><summary><PencilSimple />막막하면 답변 순서부터 고르기<CaretRight /></summary><div><section><b>답변 순서</b><ol>{guide.structure.map(value => <li key={value}>{value}</li>)}</ol></section><section><b>첫 문장 고르기</b><div>{guide.starters.map(value => <button key={value} onClick={() => addStarter(index, value)}>{value}</button>)}</div></section><section className="cover-answer-examples"><p><b>좋은 방향</b>{guide.good}</p><p><b>피할 표현</b>{guide.trap}</p></section><PersonalizedCareerExamplePanel questionId={item.id} role={draft.role} targetName={draft.targetName} defaultMajorGroup={selectedEvidence?.majorGroup || hifiveDepartment(draft.major)?.majorGroup || 'general'} defaultSourceType={selectedEvidence?.sourceType || '전공 실습'} onUseStarter={text => addStarter(index, text)} /><section><b>근거은행에서 가져오기</b>{evidenceBank.length ? <div>{evidenceBank.map(value => <button key={value.id} onClick={() => useBankEvidence(index, value)}>{value.title}</button>)}</div> : <p>근거 찾기에서 경험을 먼저 저장하면 여기서 선택할 수 있음.</p>}</section></div></details>
          <textarea value={item.answer || ''} maxLength={limit} onChange={event => updateItem(index, { answer: event.target.value })} placeholder="답변 순서를 고르고 근거은행의 실제 경험으로 한 칸씩 채움" rows={coverTextareaRows(limit)} />
          {warnings.length > 0 && <div className="cover-answer-warnings">{warnings.map(value => <span key={value}><WarningCircle weight="fill" />{value}</span>)}</div>}
          <footer><button onClick={() => updateItem(index, { answer: seedQuestionAnswer(item.id, draft) })}>기본 작성 근거 불러오기</button><span className={count >= minLength && count <= limit ? 'is-ready' : 'is-short'}>{count}자 · 권장 {minLength}~{limit}자</span></footer></article>
      })}</div>
      {!items.length && <div className="cover-question-empty"><ClipboardText /><b>제출할 문항을 먼저 구성해요</b><p>추천 문항을 고르거나 지원처 공고의 문항을 직접 추가함.</p></div>}
    </section>
  )
}

function CoverField({ field, value, sector, organization, onChange }) {
  const current = String(value).trim().length
  const ready = current >= field.minLength
  const assist = COVER_FIELD_ASSISTS[field.key]
  const example = organization?.fieldExamples?.[field.key] || field.examples[sector]
  const exampleLabel = organization ? `${organization.name} 맞춤 구조 예시` : `${COVER_LETTER_SECTOR_CONTENT[sector]?.label || '지원 분야'} 공통 구조 예시`
  function addStarter(starter) {
    const text = String(value || '').trim()
    onChange(`${text}${text ? '\n' : ''}${starter}`)
  }
  return (
    <article className={`cover-field-card ${ready ? 'is-ready' : ''}`}>
      <header><div><span>{ready ? <CheckCircle weight="fill" /> : <PencilSimple />}</span><strong>{field.label}</strong></div><small className={ready ? 'is-ready' : ''}>{current}/{field.minLength}자 기준</small></header>
      <div className="cover-field-guide"><div><b>꼭 넣기</b><ul>{field.required.map(item => <li key={item}>{item}</li>)}</ul></div><p><WarningCircle weight="fill" /><span><b>주의</b>{field.caution}</span></p></div>
      {field.showExample !== false && <details><summary>{exampleLabel} 보기</summary><div className="cover-example-box"><b>{organization ? '선택한 지원처 기준' : '분야 공통 기준'}</b><p>{example}</p><small>구조만 참고함. 공식 사실은 현재 공고·공식 사이트에서 다시 확인하고 경험·수치는 내 사실로 작성함.</small></div></details>}
      {assist && <details className="cover-field-assist"><summary><PencilSimple />막막하면 한 칸씩 시작</summary><div><section><b>먼저 답할 세 가지</b><ol>{assist.prompts.map(value => <li key={value}>{value}</li>)}</ol></section><section><b>첫 문장 고르기</b><div>{assist.starters.map(value => <button key={value} onClick={() => addStarter(value)}>{value}</button>)}</div></section></div></details>}
      <textarea id={`cover-${field.key}`} value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} rows={field.key === 'action' || field.key === 'motivation' ? 6 : 4} />
    </article>
  )
}

function coverAnswerWarnings(answer, draft, minLength = 100, limit = 2000) {
  const text = String(answer || '').trim()
  if (!text) return ['답변 순서 또는 근거 카드를 선택해 시작함.']
  const warnings = []
  if (text.length > limit) warnings.push(`최대 ${limit}자보다 ${text.length - limit}자 많음. 핵심 근거를 남기고 줄임.`)
  if (text.length < minLength) warnings.push(`권장 최소 ${minLength}자까지 행동·결과·직무 연결을 보완함.`)
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
      {generated.map(item => <section key={item.title} className={item.limit ? 'cover-document-question' : ''}><h2>{item.title}</h2>{item.question && <small>{item.question}</small>}{item.limit && <div className="cover-document-limit"><span>공고 기준 {item.minLength}~{item.limit}자</span><b className={item.body.length < item.minLength ? 'is-short' : ''}>{item.body.length}/{item.limit}자</b></div>}<div className={item.limit ? 'cover-document-answer-box' : ''} style={item.limit ? { minHeight: `${coverAnswerBoxHeight(item.limit)}px` } : undefined}><p>{item.body}</p></div></section>)}
      <footer><p>제출 전 확인: 학교명·가족관계 등 블라인드 정보, 다른 회사명, 사실과 다른 수치가 없는지 확인함.</p><span>설탕과소금 스킬캠퍼스 · 학생 작성본</span></footer>
    </article>
  )
})

function buildCoverLetter(draft, organization) {
  const orgName = draft.targetName || organization?.name || '지원처'
  if (Array.isArray(draft.coverItems) && draft.coverItems.length) {
    return draft.coverItems.map((item, index) => {
      const limits = coverQuestionLimits(item)
      return { title: `${index + 1}. ${item.label}`, question: item.question, body: String(item.answer || '').trim(), ...limits }
    })
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
  return <section className="cover-history"><h3><ChatCircleText weight="duotone" />첨삭 이력</h3>{history.slice(0, 5).map(item => { const highlights = Array.isArray(item.section_feedback?.highlights) ? item.section_feedback.highlights : []; const type = item.draft?.documentType === 'interview-script' ? '면접 답변' : '작성·답변'; return <article key={item.id}><header><div><small>{type}</small><b>{item.target_name}</b></div><span className={`is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span></header><small>{new Date(item.created_at).toLocaleString('ko-KR')}</small>{item.feedback_summary && <p><strong>선생님 전체 조언</strong>{item.feedback_summary}</p>}{highlights.length > 0 && <div className="cover-history-highlights"><b>문장별 메모 {highlights.length}개</b>{highlights.map(mark => <blockquote key={mark.id} style={{ '--mark-color': mark.color }}><span>“{mark.quote}”</span><p>{mark.note}</p></blockquote>)}</div>}</article> })}</section>
}
