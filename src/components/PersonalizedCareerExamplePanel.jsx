import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, CheckCircle, PencilSimple, Plus, ShieldCheck } from '@phosphor-icons/react'
import { userLocalStorage as localStorage } from '../lib/userLocalStorage.js'
import {
  PERSONALIZED_ACTIVITY_PROFILES,
  PERSONALIZED_EXAMPLE_STYLES,
  PERSONALIZED_MAJOR_PROFILES,
  buildPersonalizedCoverExample,
  buildPersonalizedInterviewExample,
  certificateOptions,
  personalizedExampleCoverage,
} from '../lib/personalizedCareerExamples.js'
import {
  HIFIVE_DEPARTMENT_SUMMARY,
  hifiveDepartment,
  hifiveDepartmentOptions,
} from '../lib/hifiveDepartmentCatalog.js'
import { careerContextForEngine } from '../lib/careerProfile.js'
import SearchSuggestionInput from './SearchSuggestionInput.jsx'
import '../styles/personalized-career-example.css'

function readContext() {
  try { return JSON.parse(localStorage.getItem('iv_personalized_example_context') || '{}') }
  catch { return {} }
}

export default function PersonalizedCareerExamplePanel({
  questionId,
  interviewType,
  role = '',
  targetName = '',
  defaultMajorGroup = 'general',
  defaultSourceType = '전공 실습',
  evidenceAction = '',
  evidenceResult = '',
  canReveal = true,
  onUseStarter,
}) {
  const cached = useMemo(readContext, [])
  const engineContext = useMemo(() => careerContextForEngine(cached), [cached])
  const [majorGroup, setMajorGroup] = useState(engineContext.majorGroup || defaultMajorGroup)
  const [departmentName, setDepartmentName] = useState(cached.departmentName || '')
  const [sourceType, setSourceType] = useState(engineContext.sourceType || defaultSourceType)
  const [certificateId, setCertificateId] = useState(engineContext.certificateId || '')
  const [styleId, setStyleId] = useState(cached.styleId || 'clear')
  const [variant, setVariant] = useState(0)
  const [includeExpansion, setIncludeExpansion] = useState(false)
  const departments = useMemo(() => hifiveDepartmentOptions({ includeExpansion }), [includeExpansion])
  const certificates = certificateOptions(majorGroup)
  const coverage = useMemo(() => personalizedExampleCoverage(), [])
  const departmentCoverage = Math.floor(
    (interviewType ? coverage.interviewExamples : coverage.coverExamples)
      / coverage.majors
      * HIFIVE_DEPARTMENT_SUMMARY.departmentNames,
  )
  const options = { questionId, type: interviewType, majorGroup, departmentName, sourceType, certificateId, qualificationName: engineContext.qualificationName, qualificationIssuer: engineContext.qualificationIssuer, styleId, variant, role, targetName, evidenceAction, evidenceResult }
  const example = interviewType ? buildPersonalizedInterviewExample(options) : buildPersonalizedCoverExample(options)

  useEffect(() => {
    localStorage.setItem('iv_personalized_example_context', JSON.stringify({ ...readContext(), majorGroup, departmentName, sourceType, certificateId, styleId }))
  }, [certificateId, departmentName, majorGroup, sourceType, styleId])

  function changeMajor(value) {
    setMajorGroup(value)
    setDepartmentName('')
    setCertificateId('')
    setVariant(0)
  }

  function changeDepartment(value) {
    setDepartmentName(value)
    const matched = hifiveDepartment(value)
    if (matched && matched.majorGroup !== majorGroup) {
      setMajorGroup(matched.majorGroup)
      setCertificateId('')
    }
    setVariant(0)
  }

  return <section className="personalized-example-panel">
    <header><div><span>HIFIVE 학과 기반 · 가상 구조 예시</span><b>{interviewType ? '내 조건으로 답변 비교' : '내 조건으로 문항 예시 비교'}</b><small>공통 학과 {HIFIVE_DEPARTMENT_SUMMARY.repeatedDepartmentNames}개 우선 · 학과 반영 {departmentCoverage.toLocaleString('ko-KR')}개 조합</small></div><button onClick={() => setVariant(value => (value + 1) % coverage.variants)} aria-label="다른 가상 사례 보기"><ArrowDown />다른 사례</button></header>
    <div className="personalized-example-controls">
      <label className="is-wide"><span>학과</span><SearchSuggestionInput value={departmentName} onChange={changeDepartment} onSelect={item => changeDepartment(item.name)} items={departments} getLabel={item => item.name} getMeta={item => `${item.schoolCount}개교`} placeholder="학과명 검색 또는 직접 입력" ariaLabel="학과 검색 및 직접 입력" /></label>
      <label><span>학과군</span><select value={majorGroup} onChange={event => changeMajor(event.target.value)}>{PERSONALIZED_MAJOR_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label><span>실제 활동</span><select value={sourceType} onChange={event => { setSourceType(event.target.value); setVariant(0) }}>{PERSONALIZED_ACTIVITY_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="is-wide"><span>취득·준비한 자격 <small>없으면 선택 안 함</small></span><select value={certificateId} onChange={event => { setCertificateId(event.target.value); setVariant(0) }}><option value="">자격을 답변에 넣지 않음</option>{certificates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    <div className="personalized-example-styles" aria-label="표현 방식">{PERSONALIZED_EXAMPLE_STYLES.map(item => <button key={item.id} className={styleId === item.id ? 'is-on' : ''} onClick={() => setStyleId(item.id)}>{item.label}</button>)}</div>
    <button className={`personalized-expansion-toggle ${includeExpansion ? 'is-on' : ''}`} onClick={() => setIncludeExpansion(value => !value)}><CheckCircle weight={includeExpansion ? 'fill' : 'regular'} />{includeExpansion ? '한 학교 학과까지 검색 중' : `희소 학과 ${HIFIVE_DEPARTMENT_SUMMARY.singleSchoolDepartmentNames}개도 검색`}</button>
    {!canReveal ? <div className="personalized-example-locked"><PencilSimple /><b>내 답변을 60자 이상 먼저 작성하면 비교 예시가 열립니다.</b></div> : <article className="personalized-example-result"><div>{example.context.map(value => <span key={value}>{value}</span>)}</div><h4>{example.title}</h4><p>{example.body}</p><small><ShieldCheck weight="fill" />{example.disclaimer}</small>{onUseStarter && <button onClick={() => onUseStarter(example.starter)}><Plus />첫 문장만 내 답변에 사용</button>}</article>}
  </section>
}
