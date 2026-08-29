import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowsClockwise, Bell, Briefcase, CheckCircle, ClipboardText, Desktop, Minus, Plus, SignOut, Target, Trash } from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { getDeviceSyncStatus, syncDeviceState } from '../../lib/deviceSync.js'
import { isSharedDevice, setSharedDevice } from '../../lib/deviceSettings.js'
import { LEARNING_DATA_GROUPS, resetLearningGroup } from '../../lib/learningDataManagement.js'
import { deleteOwnAccount, logoutSafely } from '../../lib/sessionLifecycle.js'
import { userLocalStorage } from '../../lib/userLocalStorage.js'
import { loadMyCareerFeedback, publishCareerProfile } from '../../lib/careerProfileCloud.js'
import { PERSONALIZED_MAJOR_PROFILES } from '../../lib/personalizedCareerExamples.js'
import {
  CAREER_CONTEXT_KEY,
  EXTRACURRICULAR_CATEGORIES,
  QUALIFICATION_CATALOG,
  QUALIFICATION_STATUSES,
  QUALIFICATION_VALIDITY_TYPES,
  SCHOOL_GRADE_OPTIONS,
  CAREER_PROFILE_SYNC_MAX_BYTES,
  addMonthsToIsoDate,
  careerEvidenceSeeds,
  careerGradeRoadmap,
  careerProfileByteLength,
  careerContextForEngine,
  careerProfileReadiness,
  createRecordId,
  extracurricularCategory,
  qualificationCatalogDefaults,
  normalizeCareerContext,
} from '../../lib/careerProfile.js'
import { hifiveDepartment, hifiveDepartmentOptions } from '../../lib/hifiveDepartmentCatalog.js'
import SearchSuggestionInput from '../../components/SearchSuggestionInput.jsx'
import CareerChoiceMenu from '../../components/CareerChoiceMenu.jsx'
import RankingScreen from './RankingScreen.jsx'
import SaveExitDialog from '../../components/SaveExitDialog.jsx'

function readCareerContext() {
  try {
    return normalizeCareerContext(JSON.parse(userLocalStorage.getItem(CAREER_CONTEXT_KEY) || '{}'))
  } catch {
    return normalizeCareerContext()
  }
}

const emptyQualification = (currentGrade = 1) => ({ name: '', issuer: '', status: 'preparing', statusDetail: '', level: '', levelKind: 'none', validityType: 'none', validFrom: '', validUntil: '', validityMonths: 0, validityNote: '', validitySource: '', grade: currentGrade, achievedAt: '', targetDate: '', proof: '', notes: '', profileId: '', catalogId: '' })
const emptyActivity = (currentGrade = 1) => ({ category: 'club', customCategoryName: '', name: '', organizer: '', rank: '', hours: '', role: '', outcome: '', notes: '', proof: '', period: '', grade: currentGrade, skills: [], customFields: [] })

function QualificationDetailFields({ record, onChange, currentGrade }) {
  const catalog = QUALIFICATION_CATALOG.find(item => item.id === record.catalogId)
  const levelOptions = [
    { id: 'none', label: '해당 없음', description: '급수나 점수를 구분하지 않는 자격' },
    ...(catalog?.levels || []).map(level => ({ id: `preset:${level}`, label: level })),
    { id: 'custom', label: '직접 입력', description: '목록에 없는 급수·등급·점수' },
  ]
  const levelChoice = record.levelKind === 'custom' ? 'custom' : record.levelKind === 'preset' && record.level ? `preset:${record.level}` : 'none'
  const passed = ['writtenPassed', 'practicalPassed', 'acquired', 'custom'].includes(record.status)
  const dateLabel = record.status === 'writtenPassed' ? '필기 합격일' : record.status === 'practicalPassed' ? '실기 합격일' : record.status === 'acquired' ? '최종 합격·취득일' : record.status === 'custom' ? '상태 기준일' : '목표일'

  function changeLevel(choice) {
    if (choice === 'none') {
      onChange('levelKind', 'none')
      onChange('level', '')
      return
    }
    if (choice === 'custom') {
      onChange('levelKind', 'custom')
      if (catalog?.levels?.includes(record.level)) onChange('level', '')
      return
    }
    onChange('levelKind', 'preset')
    onChange('level', choice.replace(/^preset:/, ''))
  }

  function changeResultDate(value) {
    onChange(passed ? 'achievedAt' : 'targetDate', value)
    if (passed && record.validityType === 'expires') {
      onChange('validFrom', value)
      if (record.validityMonths) onChange('validUntil', addMonthsToIsoDate(value, record.validityMonths))
    }
  }

  function changeStatus(value) {
    const nextPassed = ['writtenPassed', 'practicalPassed', 'acquired', 'custom'].includes(value)
    onChange('status', value)
    if (value !== 'custom') onChange('statusDetail', '')
    if (nextPassed) onChange('targetDate', '')
    else onChange('achievedAt', '')
  }

  function changeValidity(value) {
    onChange('validityType', value)
    if (value !== 'expires') {
      onChange('validFrom', '')
      onChange('validUntil', '')
      return
    }
    if (record.achievedAt) {
      onChange('validFrom', record.achievedAt)
      if (record.validityMonths) onChange('validUntil', addMonthsToIsoDate(record.achievedAt, record.validityMonths))
    }
  }

  return <>
    <CareerChoiceMenu label={catalog?.levelLabel || '급수·등급'} hint="선택 또는 직접 입력" value={levelChoice} options={levelOptions} onChange={changeLevel} />
    {record.levelKind === 'custom' && <label><span>{catalog?.levelLabel || '급수·등급'} 직접 입력</span><input value={record.level || ''} onChange={event => onChange('level', event.target.value)} placeholder="예: 1급, A등급, 850점" /></label>}
    <CareerChoiceMenu label="진행 상태" hint="전형에 맞게 선택" value={record.status || 'preparing'} options={QUALIFICATION_STATUSES} onChange={changeStatus} />
    {record.status === 'custom' && <label><span>상태 직접 입력</span><input value={record.statusDetail || ''} onChange={event => onChange('statusDetail', event.target.value)} placeholder="예: 서류 제출, 면접 대기" /></label>}
    <label><span>기록 학년</span><select value={record.grade || currentGrade} onChange={event => onChange('grade', Number(event.target.value))}>{SCHOOL_GRADE_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>{dateLabel}</span><input type="date" value={passed ? record.achievedAt || '' : record.targetDate || ''} onChange={event => changeResultDate(event.target.value)} /></label>
    <CareerChoiceMenu label="유효기간" hint="자격별로 다름" value={record.validityType || 'none'} options={QUALIFICATION_VALIDITY_TYPES} onChange={changeValidity} />
    {record.validityType === 'expires' && <>
      <label><span>유효 시작일</span><input type="date" value={record.validFrom || ''} onChange={event => onChange('validFrom', event.target.value)} /></label>
      <label><span>만료일</span><input type="date" value={record.validUntil || ''} onChange={event => onChange('validUntil', event.target.value)} /></label>
    </>}
    {(record.validityType === 'check' || record.validityNote) && <label className="is-wide"><span>유효기간 메모</span><input value={record.validityNote || ''} onChange={event => onChange('validityNote', event.target.value)} placeholder="발급기관 기준을 확인해 기록" /></label>}
    {record.validitySource && <a className="account-validity-source is-wide" href={record.validitySource} target="_blank" rel="noreferrer">발급기관의 유효기간 기준 확인</a>}
    <label className="is-wide"><span>확인 자료</span><input value={record.proof || ''} onChange={event => onChange('proof', event.target.value)} placeholder="예: 합격 확인서·자격증 번호 일부·학습 기록" /></label>
  </>
}

function ActivityDetailFields({ record, onChange, currentGrade }) {
  const guide = extracurricularCategory(record)
  const customFields = Array.isArray(record.customFields) ? record.customFields : []
  const updateCustomField = (index, key, value) => onChange('customFields', customFields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field))
  const changeCategory = value => {
    const next = extracurricularCategory({ category: value })
    onChange('category', value)
    if (value !== 'other') onChange('customCategoryName', '')
    if (!next.usesRank) onChange('rank', '')
    if (!next.usesHours) onChange('hours', '')
  }

  return <>
    <CareerChoiceMenu label="활동 구분" hint="선택하면 입력 항목이 바뀜" value={record.category || 'club'} options={EXTRACURRICULAR_CATEGORIES} onChange={changeCategory} className="is-wide" />
    {record.category === 'other' && <label className="is-wide"><span>특별 활동 구분명</span><input value={record.customCategoryName || ''} onChange={event => onChange('customCategoryName', event.target.value)} placeholder="예: 교내 방송 제작, 가족 돌봄, 개인 창작" /></label>}
    <label><span>{guide.nameLabel}</span><input value={record.name || ''} onChange={event => onChange('name', event.target.value)} placeholder={`${guide.nameLabel} 직접 입력`} /></label>
    <label><span>{guide.organizerLabel}</span><input value={record.organizer || ''} onChange={event => onChange('organizer', event.target.value)} placeholder="학교·기업·기관·단체" /></label>
    <label><span>기록 학년</span><select value={record.grade || currentGrade} onChange={event => onChange('grade', Number(event.target.value))}>{SCHOOL_GRADE_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>활동 기간</span><input value={record.period || ''} onChange={event => onChange('period', event.target.value)} placeholder="예: 2026.03~2026.07" /></label>
    {guide.usesHours && <label><span>봉사 시간</span><input value={record.hours || ''} onChange={event => onChange('hours', event.target.value)} placeholder="예: 24시간" /></label>}
    {guide.usesRank && <label><span>순위·등급</span><input value={record.rank || ''} onChange={event => onChange('rank', event.target.value)} placeholder="예: 금상, 2위, 본선" /></label>}
    <label><span>{guide.roleLabel}</span><input value={record.role || ''} onChange={event => onChange('role', event.target.value)} placeholder="내가 직접 한 일을 구체적으로" /></label>
    <label><span>{guide.outcomeLabel}</span><input value={record.outcome || ''} onChange={event => onChange('outcome', event.target.value)} placeholder="수치·변화·산출물·피드백" /></label>
    <label><span>사용한 기술·태도</span><input value={(record.skills || []).join(', ')} onChange={event => onChange('skills', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} placeholder="예: 협업, 검산, 고객응대" /></label>
    <label className="is-wide"><span>확인 자료</span><input value={record.proof || ''} onChange={event => onChange('proof', event.target.value)} placeholder="작업 파일·활동일지·사진·담당자 피드백" /></label>
    <label className="is-wide"><span>비고·배운 점</span><input value={record.notes || ''} onChange={event => onChange('notes', event.target.value)} placeholder="상황 설명이나 다음에 보완할 점" /></label>
    <div className="account-custom-fields is-wide">
      <header><div><b>나만의 추가 항목</b><small>이 활동에만 필요한 입력칸을 최대 10개까지 만듭니다.</small></div><button type="button" disabled={customFields.length >= 10} onClick={() => onChange('customFields', [...customFields, { id: createRecordId('field'), label: '', value: '' }])}><Plus /> {customFields.length >= 10 ? '10개 완료' : '입력칸 추가'}</button></header>
      {customFields.map((field, index) => <div key={field.id}><input aria-label="추가 항목명" value={field.label || ''} onChange={event => updateCustomField(index, 'label', event.target.value)} placeholder="항목명 예: 담당 장비" /><input aria-label="추가 항목 내용" value={field.value || ''} onChange={event => updateCustomField(index, 'value', event.target.value)} placeholder="내용 입력" /><button type="button" aria-label="추가 항목 삭제" onClick={() => onChange('customFields', customFields.filter((_, fieldIndex) => fieldIndex !== index))}><Minus /></button></div>)}
    </div>
  </>
}

function formatSync(value) {
  if (!value) return '이 기기에서 아직 동기화하지 않음'
  return new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AccountDataScreen({ onOpenCareer }) {
  const { profile } = useAuth() ?? {}
  const [view, setView] = useState('account')
  const [shared, setShared] = useState(() => isSharedDevice())
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [status, setStatus] = useState(() => getDeviceSyncStatus())
  const [confirm, setConfirm] = useState(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [career, setCareer] = useState(readCareerContext)
  const [qualificationDraft, setQualificationDraft] = useState(() => emptyQualification(readCareerContext().currentGrade))
  const [activityDraft, setActivityDraft] = useState(() => emptyActivity(readCareerContext().currentGrade))
  const [careerSaved, setCareerSaved] = useState('')
  const [evidenceStatus, setEvidenceStatus] = useState({ loading: true, count: 0, error: false })
  const [teacherFeedback, setTeacherFeedback] = useState(null)
  const initials = useMemo(() => String(profile?.display_name || '나').slice(0, 1), [profile?.display_name])
  const departments = useMemo(() => hifiveDepartmentOptions({ includeExpansion: true }), [])
  const qualificationCatalog = QUALIFICATION_CATALOG
  const readiness = useMemo(() => careerProfileReadiness(career, { evidenceCount: evidenceStatus.count }), [career, evidenceStatus.count])
  const roadmap = useMemo(() => careerGradeRoadmap(career, { evidenceCount: evidenceStatus.count }), [career, evidenceStatus.count])

  useEffect(() => {
    let active = true
    if (!profile?.id) {
      setEvidenceStatus({ loading: false, count: 0, error: false })
      return () => { active = false }
    }
    supabase.from('cover_letter_evidence').select('id').eq('student_id', profile.id).then(({ data, error }) => {
      if (active) setEvidenceStatus({ loading: false, count: Array.isArray(data) ? data.length : 0, error: Boolean(error) })
    }).catch(() => {
      if (active) setEvidenceStatus({ loading: false, count: 0, error: true })
    })
    return () => { active = false }
  }, [profile?.id])

  useEffect(() => {
    let active = true
    if (!profile?.id) return () => { active = false }
    loadMyCareerFeedback().then(result => {
      if (active && result.ok) setTeacherFeedback(result.feedback)
    })
    return () => { active = false }
  }, [profile?.id])

  function changeCareer(key, value) {
    setCareerSaved('')
    setCareer(current => {
      if (key === 'majorGroup') return { ...current, majorGroup: value }
      if (key === 'departmentName') {
        const matched = hifiveDepartment(value)
        return { ...current, departmentName: value, majorGroup: matched?.majorGroup || current.majorGroup, certificateId: matched && matched.majorGroup !== current.majorGroup ? '' : current.certificateId }
      }
      return { ...current, [key]: value }
    })
  }

  function chooseDepartment(item) {
    setCareerSaved('')
    setCareer(current => ({ ...current, departmentName: item.name, majorGroup: item.majorGroup || current.majorGroup }))
  }

  function chooseQualification(item) {
    setQualificationDraft(current => ({ ...current, ...qualificationCatalogDefaults(item), name: item.name, issuer: item.issuer, profileId: item.profileId || '', catalogId: item.id }))
  }

  function addQualification() {
    const name = qualificationDraft.name.trim()
    if (!name) return
    if (career.qualifications.some(item => item.name.trim() === name && String(item.issuer || '').trim() === qualificationDraft.issuer.trim() && String(item.level || '').trim() === qualificationDraft.level.trim())) {
      setCareerSaved('같은 자격·급수와 발급기관이 이미 등록되어 있습니다.')
      return
    }
    const record = { ...qualificationDraft, id: createRecordId('qualification'), name, issuer: qualificationDraft.issuer.trim() }
    setCareer(current => ({ ...current, qualifications: [...current.qualifications, record] }))
    setQualificationDraft(emptyQualification(career.currentGrade))
    setCareerSaved('')
  }

  function updateQualification(id, key, value) {
    setCareer(current => ({ ...current, qualifications: current.qualifications.map(item => item.id === id ? { ...item, [key]: value } : item) }))
    setCareerSaved('')
  }

  function addActivity() {
    const name = activityDraft.name.trim()
    if (!name) return
    if (career.extracurricularActivities.some(item => item.category === activityDraft.category && item.name.trim() === name && String(item.organizer || '').trim() === activityDraft.organizer.trim())) {
      setCareerSaved('같은 교과외활동과 주관기관이 이미 등록되어 있습니다.')
      return
    }
    setCareer(current => ({ ...current, extracurricularActivities: [...current.extracurricularActivities, { ...activityDraft, id: createRecordId('activity'), name }] }))
    setActivityDraft(emptyActivity(career.currentGrade))
    setCareerSaved('')
  }

  function updateActivity(id, key, value) {
    setCareer(current => ({ ...current, extracurricularActivities: current.extracurricularActivities.map(item => item.id === id ? { ...item, [key]: value } : item) }))
    setCareerSaved('')
  }

  async function saveCareerContext() {
    const payload = careerContextForEngine({ ...career, lastReviewedAt: new Date().toISOString() })
    if (careerProfileByteLength(payload) > CAREER_PROFILE_SYNC_MAX_BYTES) {
      setCareerSaved('저장 용량을 넘었습니다 · 긴 비고·추가 항목을 줄인 뒤 다시 저장하세요')
      return
    }
    userLocalStorage.setItem(CAREER_CONTEXT_KEY, JSON.stringify(payload))
    setCareer(payload)
    setStatus(getDeviceSyncStatus())
    setCareerSaved('이 기기에 저장됨 · 학교 계정 연결 중')
    const published = await publishCareerProfile(payload, { evidenceCount: evidenceStatus.count })
    setCareerSaved(published.ok
      ? '저장·학교 계정 연결 완료 · PC와 휴대폰에서 이어짐'
      : published.offline
        ? '이 기기에 저장됨 · 인터넷 연결 후 학교 계정에 반영됨'
        : '이 기기에는 저장됨 · 지금 동기화에서 다시 연결할 수 있음')
  }

  function developActivity(item) {
    const seed = careerEvidenceSeeds(career).find(value => value.id === item.id)
    if (!seed) return
    const profile = careerContextForEngine(career)
    if (careerProfileByteLength(profile) > CAREER_PROFILE_SYNC_MAX_BYTES) {
      setCareerSaved('작성근거로 보내기 전에 긴 비고·추가 항목을 줄여 저장하세요')
      return
    }
    userLocalStorage.setItem('iv_cover_evidence_seed_v1', JSON.stringify(seed))
    userLocalStorage.setItem('iv_cover_open_evidence', '1')
    userLocalStorage.setItem(CAREER_CONTEXT_KEY, JSON.stringify(profile))
    onOpenCareer?.({ workspace: 'evidence', evidenceSeed: seed, careerProfile: profile })
  }

  async function syncNow() {
    setSyncing(true)
    const result = await syncDeviceState()
    if (result.ok) await publishCareerProfile(career, { evidenceCount: evidenceStatus.count })
    setStatus(getDeviceSyncStatus())
    setSyncResult(result.ok
      ? 'PC와 휴대폰에서 이어갈 준비가 됐습니다.'
      : result.offline
        ? '인터넷 연결 후 자동으로 동기화합니다.'
        : result.tooLarge
          ? '저장 자료가 커서 동기화를 멈췄습니다. 오래된 작성본을 정리한 뒤 다시 시도해 주세요.'
          : '동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setSyncing(false)
  }

  async function removeAccount() {
    if (deletePhrase.trim() !== '계정 삭제') return
    setDeleting(true)
    setDeleteError('')
    const result = await deleteOwnAccount()
    if (!result.ok) {
      setDeleteError(result.error?.message || '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  if (view === 'ranking') return (
    <div className="account-ranking-wrap">
      <div className="account-section-tabs">
        <button onClick={() => setView('account')}>계정·기기</button>
        <button className="is-on">내 순위</button>
      </div>
      <RankingScreen />
    </div>
  )

  return (
    <div className="screen account-data-screen">
      <div className="account-section-tabs">
        <button className="is-on">계정·기기</button>
        <button onClick={() => setView('ranking')}>내 순위</button>
      </div>
      <div className="screen-body account-data-body">
        <header className="account-identity"><span>{initials}</span><div><h1>{profile?.display_name || '학생'}</h1><p>내 학습 기록과 기기 연결</p></div></header>

        <section className="account-career-panel">
          <header><Briefcase weight="duotone" /><div><h2>취업 준비 기본정보</h2><p>자기소개서와 면접에서 공통으로 사용할 학과·자격·교과외활동 기록</p></div></header>
          <section className="account-career-readiness">
            <header><div><span>{career.currentGrade}학년 · {roadmap.stage}</span><h3>{readiness.level}</h3><p>{roadmap.headline}</p></div><strong>{readiness.score}<small>/100</small></strong></header>
            <div className="account-readiness-bars">{readiness.checks.map(item => <div key={item.id}><span>{item.label}<b>{item.score}/{item.max}</b></span><i><em style={{ width: `${Math.round(item.score / item.max * 100)}%` }} /></i></div>)}</div>
            <div className="account-grade-picker" aria-label="현재 학년">{SCHOOL_GRADE_OPTIONS.map(item => <button key={item.id} className={career.currentGrade === item.id ? 'is-on' : ''} onClick={() => changeCareer('currentGrade', item.id)}>{item.label}</button>)}</div>
            <section><Target weight="fill" /><div><b>지금 먼저 할 일</b>{roadmap.nextActions.slice(0, 3).map(item => <p key={item}>{item}</p>)}</div></section>
          </section>
          {teacherFeedback && <section className="account-career-feedback"><ClipboardText weight="fill" /><div><span>담당 선생님 지도</span><b>{teacherFeedback.next_action}</b><p>{teacherFeedback.note}</p>{teacherFeedback.review_on && <small>{teacherFeedback.review_on}에 함께 확인</small>}</div></section>}
          <div className="account-career-fields">
            <label className="is-wide"><span>학과 <small>가나다순 목록 선택 또는 직접 입력</small></span><SearchSuggestionInput value={career.departmentName} onChange={value => changeCareer('departmentName', value)} onSelect={chooseDepartment} items={departments} getLabel={item => item.name} getMeta={item => `${PERSONALIZED_MAJOR_PROFILES.find(group => group.id === item.majorGroup)?.label || '공통·기타'} · ${item.schoolCount}개교`} placeholder="예: 스마트기계, 조리, 회계" ariaLabel="학과 검색 및 직접 입력" /></label>
            <label className="is-wide"><span>학과군 <small>학과 선택 후에도 직접 변경 가능</small></span><select value={career.majorGroup} onChange={event => changeCareer('majorGroup', event.target.value)}>{PERSONALIZED_MAJOR_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label><span>관심 산업·분야</span><input value={career.targetIndustry} onChange={event => changeCareer('targetIndustry', event.target.value)} placeholder="예: 반도체·공공 전력" /></label>
            <label><span>관심 직무</span><input value={career.targetRole} onChange={event => changeCareer('targetRole', event.target.value)} placeholder="예: 설비보전·사무행정" /></label>
            <label className="is-wide"><span>이번 학기 목표</span><input value={career.semesterGoal} onChange={event => changeCareer('semesterGoal', event.target.value)} placeholder="예: 전기기능사 취득과 실습 근거 카드 2장 완성" /></label>
          </div>

          <section className="account-career-editor">
            <header><div><h3>취득·준비 중인 자격</h3><p>급수·진행 상태·유효기간까지 실제 전형에 맞게 기록합니다.</p></div><span>{career.qualifications.length}개</span></header>
            <div className="account-record-form qualification-form">
              <label className="is-wide"><span>자격 명칭</span><SearchSuggestionInput value={qualificationDraft.name} onChange={value => setQualificationDraft(current => ({ ...current, name: value, catalogId: '', profileId: '' }))} onSelect={chooseQualification} items={qualificationCatalog} getLabel={item => item.name} getMeta={item => `${item.issuer} · ${item.type}`} placeholder="자격 명칭 검색 또는 직접 입력" ariaLabel="자격 명칭 검색 및 직접 입력" /></label>
              <label><span>발급·시행기관</span><input value={qualificationDraft.issuer} onChange={event => setQualificationDraft(current => ({ ...current, issuer: event.target.value }))} placeholder="직접 입력 가능" /></label>
              <QualificationDetailFields record={qualificationDraft} currentGrade={career.currentGrade} onChange={(key, value) => setQualificationDraft(current => ({ ...current, [key]: value }))} />
              <button type="button" className="account-add-record" onClick={addQualification} disabled={!qualificationDraft.name.trim()}><Plus /> 자격 추가</button>
            </div>
            <div className="account-record-list">{career.qualifications.map(item => <article key={item.id}>
              <div className="account-record-grid"><label><span>자격 명칭</span><input value={item.name} onChange={event => updateQualification(item.id, 'name', event.target.value)} /></label><label><span>발급·시행기관</span><input value={item.issuer || ''} onChange={event => updateQualification(item.id, 'issuer', event.target.value)} /></label><QualificationDetailFields record={item} currentGrade={career.currentGrade} onChange={(key, value) => updateQualification(item.id, key, value)} /></div>
              <button type="button" className="account-remove-record" onClick={() => setCareer(current => ({ ...current, qualifications: current.qualifications.filter(value => value.id !== item.id) }))} aria-label={`${item.name} 삭제`} title={`${item.name} 삭제`}><Trash /></button>
            </article>)}</div>
          </section>

          <section className="account-career-editor">
            <header><div><h3>교과외활동</h3><p>활동을 고르면 그 상황에 필요한 기록 항목이 나타납니다.</p></div><span>{career.extracurricularActivities.length}개</span></header>
            <div className="account-record-form activity-form">
              <ActivityDetailFields record={activityDraft} currentGrade={career.currentGrade} onChange={(key, value) => setActivityDraft(current => ({ ...current, [key]: value }))} />
              <button type="button" className="account-add-record" onClick={addActivity} disabled={!activityDraft.name.trim()}><Plus /> 활동 추가</button>
            </div>
            <div className="account-record-list">{career.extracurricularActivities.map(item => <article key={item.id}>
              <div className="account-record-grid activity-record-grid"><ActivityDetailFields record={item} currentGrade={career.currentGrade} onChange={(key, value) => updateActivity(item.id, key, value)} /></div>
              <button type="button" className="account-develop-evidence" onClick={() => developActivity(item)}><ClipboardText />근거 카드로 발전<ArrowRight /></button>
              <button type="button" className="account-remove-record" onClick={() => setCareer(current => ({ ...current, extracurricularActivities: current.extracurricularActivities.filter(value => value.id !== item.id) }))} aria-label={`${item.name} 삭제`} title={`${item.name} 삭제`}><Trash /></button>
            </article>)}</div>
          </section>
          <div className="account-career-sources"><span>공식 자료 확인</span><a href="https://www.career.go.kr/" target="_blank" rel="noreferrer">커리어넷</a><a href="https://www.hifive.go.kr/" target="_blank" rel="noreferrer">HIFIVE</a><a href="https://www.q-net.or.kr/" target="_blank" rel="noreferrer">Q-Net</a><a href="https://license.korcham.net/" target="_blank" rel="noreferrer">대한상공회의소</a><a href="https://license.kpc.or.kr/" target="_blank" rel="noreferrer">KPC</a></div>
          <div className="account-career-actions"><button onClick={saveCareerContext}>기본정보 저장</button><button onClick={() => onOpenCareer?.()}>작성근거 관리</button></div>
          <p className={evidenceStatus.error ? 'is-error' : ''}>{evidenceStatus.loading ? '저장한 작성근거 확인 중' : evidenceStatus.error ? '작성근거를 불러오지 못함 · 자기소개서관에서 다시 확인' : `저장한 작성근거 ${evidenceStatus.count}장`}{careerSaved ? ` · ${careerSaved}` : ''}</p>
        </section>

        <section className="account-sync-panel">
          <div><b>PC·휴대폰 이어하기</b><span>{formatSync(status.lastSync)} · {status.dirty}개 변경 대기</span></div>
          <button onClick={syncNow} disabled={syncing}><ArrowsClockwise /> {syncing ? '동기화 중' : '지금 동기화'}</button>
          {syncResult && <p><CheckCircle weight="fill" /> {syncResult}</p>}
        </section>

        <section className="account-setting-row">
          <Desktop />
          <div><b>공용 PC 모드</b><span>로그아웃 전에 동기화하고 이 계정의 기기 사본을 제거함</span></div>
          <button className={`switch-control${shared ? ' is-on' : ''}`} role="switch" aria-checked={shared} aria-label="공용 PC 모드" onClick={() => { const next = !shared; setShared(next); setSharedDevice(next) }}><span /></button>
        </section>

        <section className="account-setting-row">
          <Bell />
          <div><b>기기 알림</b><span>현재 앱에서는 선생님 메시지를 소식 메뉴에서 확인함. 기기 알림은 안정화 뒤 다시 제공함.</span></div>
          <button className="account-setting-action" disabled>준비 중</button>
        </section>

        <section className="account-reset-section">
          <header><h2>과목별 다시 학습</h2><p>선택한 과목의 내 진행 기록만 지우고 처음부터 시작합니다.</p></header>
          <div className="account-reset-list">
            {LEARNING_DATA_GROUPS.map(group => <div key={group.id}><span><b>{group.label}</b><small>{group.detail}</small></span><button onClick={() => setConfirm(group)} title={`${group.label} 기록 초기화`} aria-label={`${group.label} 기록 초기화`}><Trash /></button></div>)}
          </div>
        </section>

        <button className="account-logout" onClick={() => setConfirmLogout(true)}><SignOut /> 저장하고 로그아웃</button>
        <button className="account-delete" onClick={() => { setDeletePhrase(''); setDeleteError(''); setDeleteOpen(true) }}><Trash /> 계정 및 데이터 삭제</button>
        <div className="account-legal-links"><a href="https://gyo6.kr/privacy.html" target="_blank" rel="noreferrer">개인정보처리방침</a><a href="https://gyo6.kr/account-deletion.html" target="_blank" rel="noreferrer">계정 삭제 안내</a></div>
      </div>

      {confirm && <div className="account-confirm" role="dialog" aria-modal="true"><div><h2>{confirm.label} 기록을 지울까요?</h2><p>다른 과목과 계정 정보는 그대로 유지됩니다. 삭제 내용은 다음 동기화 때 다른 기기에도 반영됩니다.</p><footer><button onClick={() => setConfirm(null)}>취소</button><button className="is-danger" onClick={() => { resetLearningGroup(confirm.id); setConfirm(null); setStatus(getDeviceSyncStatus()) }}>기록 지우기</button></footer></div></div>}
      {deleteOpen && <div className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="student-account-delete-title"><div><h2 id="student-account-delete-title">계정과 모든 데이터를 삭제할까요?</h2><p>학습 기록, 작성본, 오답, 첨삭 기록과 계정 정보가 영구 삭제되며 되돌릴 수 없습니다. 계속하려면 아래에 <b>계정 삭제</b>를 입력하세요.</p><label className="account-delete-label">확인 문구<input autoFocus value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} placeholder="계정 삭제" disabled={deleting} /></label>{deleteError && <p className="account-delete-error" role="alert">{deleteError}</p>}<footer><button onClick={() => setDeleteOpen(false)} disabled={deleting}>취소</button><button className="is-danger" onClick={removeAccount} disabled={deleting || deletePhrase.trim() !== '계정 삭제'}>{deleting ? '삭제 중' : '영구 삭제'}</button></footer></div></div>}
      <SaveExitDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onSaveExit={() => logoutSafely({ clearDevice: shared })}
        onDiscardExit={shared ? () => logoutSafely({ clearDevice: true, discardLocal: true }) : undefined}
        title="학습 기록을 저장하고 로그아웃할까요?"
        description={shared ? '서버 동기화가 끝나면 이 공용 PC에서 현재 계정의 학습 사본을 제거합니다.' : '현재 학습 위치와 작성 내용을 동기화한 뒤 로그아웃합니다.'}
        actionLabel="저장 후 로그아웃"
      />
    </div>
  )
}
