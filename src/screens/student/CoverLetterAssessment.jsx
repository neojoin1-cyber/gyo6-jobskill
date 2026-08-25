import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Play,
  Target,
  WarningCircle,
} from '@phosphor-icons/react'
import { COVER_LETTER_QUESTION_LIBRARY } from '../../lib/coverQuestionLibrary.js'
import { questionGuide } from '../../lib/coverLetterGuidance.js'
import { COVER_ASSESSMENT_AREAS as AREAS, COVER_DIAGNOSTIC_QUESTIONS } from '../../lib/coverAssessmentBank.js'

function areasOf(questions) {
  return [...new Set(questions.map(item => item.area))]
}

const MOCK_SECTORS = [
  { id: 'finance', label: '금융권' },
  { id: 'public', label: '공공기관' },
  { id: 'enterprise', label: '대기업' },
]

function CoverWritingMock({ onGoLearn, onGoPractical }) {
  const [sector, setSector] = useState('finance')
  const prompts = useMemo(() => COVER_LETTER_QUESTION_LIBRARY.filter(item => item.sectors.includes(sector)), [sector])
  const [promptId, setPromptId] = useState('motivation')
  const [limit, setLimit] = useState(700)
  const [minutes, setMinutes] = useState(30)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [answer, setAnswer] = useState('')
  const prompt = prompts.find(item => item.id === promptId) || prompts[0]
  const guide = prompt ? questionGuide(prompt.id, prompt) : null
  const length = [...answer].length

  useEffect(() => {
    if (prompts.some(item => item.id === promptId)) return
    setPromptId(prompts[0]?.id || '')
  }, [promptId, prompts])
  useEffect(() => {
    if (!started || finished || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [finished, remaining, started])
  useEffect(() => {
    if (started && !finished && remaining === 0) setFinished(true)
  }, [finished, remaining, started])

  function start() {
    setAnswer(''); setFinished(false); setStarted(true); setRemaining(minutes * 60)
  }
  function reset() {
    setStarted(false); setFinished(false); setAnswer('')
  }

  if (!started) return <section className="cover-writing-mock-setup">
    <header><span>WRITING SIMULATION</span><h3>자기소개서 모의고사</h3><p>실제 지원 문항 1개를 글자 수와 제한시간에 맞춰 직접 작성함.</p></header>
    <div className="cover-writing-mock-steps"><span><b>1</b>조건 선택</span><i /><span><b>2</b>제한 작성</span><i /><span><b>3</b>기준 점검</span></div>
    <fieldset><legend>지원 분야</legend><div className="cover-assessment-scopes">{MOCK_SECTORS.map(item => <button key={item.id} className={sector === item.id ? 'is-on' : ''} onClick={() => setSector(item.id)}>{item.label}</button>)}</div></fieldset>
    <label className="cover-writing-mock-field"><span>실전 항목</span><select value={prompt?.id || ''} onChange={event => setPromptId(event.target.value)}>{prompts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className="cover-assessment-options"><label><span>글자 수</span><select value={limit} onChange={event => setLimit(Number(event.target.value))}><option value="500">500자</option><option value="700">700자</option><option value="1000">1000자</option><option value="1500">1500자</option></select></label><label><span>제한 시간</span><select value={minutes} onChange={event => setMinutes(Number(event.target.value))}><option value="20">20분</option><option value="30">30분</option><option value="40">40분</option><option value="60">60분</option></select></label></div>
    {prompt && <article className="cover-writing-mock-preview"><span>{prompt.label}</span><p>{prompt.question}</p><small>반드시 넣을 내용 · {prompt.required.join(' · ')}</small></article>}
    <button className="cover-assessment-start" onClick={start}><Play weight="fill" />모의고사 시작</button>
  </section>

  if (finished) {
    const minimum = Math.round(limit * .8)
    const checks = [
      { label: `권장 분량 ${minimum}~${limit}자`, ok: length >= minimum && length <= limit },
      { label: '질문의 필수 요구를 모두 확인함', ok: prompt.required.length <= 3 ? length >= 250 : length >= 350 },
      { label: '내 행동을 나타내는 문장이 있음', ok: /(확인|분류|비교|점검|조정|기록|제안|수정|실행|보고|연습|제작|분석)/.test(answer) },
      { label: '결과·변화를 확인할 표현이 있음', ok: /(결과|이후|줄였|높였|완성|개선|해결|달성|배웠|변화|피드백|오류|시간|건|%)/.test(answer) },
      { label: '과장·복사 없이 설명 가능한 사실로 작성함', ok: !/(무조건|완벽한 인재|최고의 회사|뭐든지|100% 혼자)/.test(answer) && length >= 120 },
    ]
    const passed = checks.filter(item => item.ok).length
    try { localStorage.setItem('iv_cover_mock_draft', JSON.stringify({ sector, promptId: prompt.id, limit, minutes, answer, checks, at: new Date().toISOString() })) } catch { /* 저장 불가 환경 */ }
    return <section className="cover-writing-mock-result">
      <header className={passed >= 4 ? 'is-good' : 'is-review'}><CheckCircle weight="fill" /><div><span>작성 결과</span><strong>{passed}/5</strong><p>{length}/{limit}자 · 자동 점검은 초안 검토용임</p></div></header>
      <article><span>{prompt.label}</span><h3>{prompt.question}</h3><p>{answer || '작성된 내용 없음'}</p></article>
      <div className="cover-writing-rubric">{checks.map(item => <div key={item.label} className={item.ok ? 'is-ok' : 'is-missing'}>{item.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}<span>{item.label}</span></div>)}</div>
      <section className="cover-writing-coach"><b>다음 수정 순서</b><ol>{guide.structure.map(item => <li key={item}>{item}</li>)}</ol><p>좋은 예시는 구조 참고용임. 경험·수치·표현은 자신의 사실로 다시 작성함.</p></section>
      <div className="cover-result-actions"><button onClick={reset}><ArrowLeft />조건 바꾸기</button><button onClick={onGoPractical || onGoLearn}><FileText />실전자기소개서로 이어가기</button></div>
    </section>
  }

  return <section className="cover-writing-mock-run">
    <header><div><span>{MOCK_SECTORS.find(item => item.id === sector)?.label}</span><b>{prompt.label}</b></div><time className={remaining < 300 ? 'is-ending' : ''}><Clock />{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</time></header>
    <div className="cover-writing-mock-progress"><i style={{ width: `${Math.min(100, length / limit * 100)}%` }} /></div>
    <article className="cover-writing-mock-prompt"><span>실전 문항</span><h3>{prompt.question}</h3><div>{prompt.required.map(item => <em key={item}>{item}</em>)}</div></article>
    <label className="cover-writing-mock-editor"><span>답변 작성 <b className={length > limit ? 'is-over' : length < limit * .8 ? 'is-short' : 'is-ready'}>{length}/{limit}자</b></span><textarea value={answer} maxLength={limit} onChange={event => setAnswer(event.target.value)} placeholder="지원처의 문항에 답하듯 직접 작성함. 상황보다 내 판단·행동·결과를 구체적으로 적음." /></label>
    <button className="cover-assessment-start" disabled={length < 80} onClick={() => setFinished(true)}><CheckCircle weight="fill" />제출하고 기준 점검</button>
  </section>
}

export default function CoverLetterAssessment({ mode = 'diagnostic', onGoLearn, onGoPractical }) {
  if (mode === 'mock') return <CoverWritingMock onGoLearn={onGoLearn} onGoPractical={onGoPractical} />
  return <CoverKnowledgeDiagnostic onGoLearn={onGoLearn} />
}

function CoverKnowledgeDiagnostic({ onGoLearn }) {
  const bank = COVER_DIAGNOSTIC_QUESTIONS
  const [scope, setScope] = useState('all')
  const count = 12
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)

  const questions = useMemo(() => {
    const scoped = scope === 'all' ? bank : bank.filter(item => item.area === scope)
    return scoped.slice(0, Math.min(count, scoped.length))
  }, [bank, count, scope])
  const current = questions[index]

  function start() {
    setIndex(0); setAnswers({}); setFinished(false); setStarted(true)
  }
  function choose(choice) {
    if (!current || answers[current.id] !== undefined) return
    setAnswers(value => ({ ...value, [current.id]: choice }))
  }
  function next() {
    if (index < questions.length - 1) setIndex(value => value + 1)
    else setFinished(true)
  }

  if (!started) {
    return <section className="cover-assessment-setup">
      <header><span>WRITING CHECK-UP</span><h3>실전 작성 진단</h3><p>초안을 읽고 실제로 고칠 부분을 판단함</p></header>
      <div className="cover-assessment-scopes"><button className={scope === 'all' ? 'is-on' : ''} onClick={() => setScope('all')}>전체</button>{areasOf(bank).map(area => <button key={area} className={scope === area ? 'is-on' : ''} onClick={() => setScope(area)}>{AREAS[area]}</button>)}</div>
      <div className="cover-assessment-ready"><Target weight="duotone" /><div><b>{questions.length}문항 준비됨</b><p>완료 후 약한 기준과 학습 위치 안내</p></div></div>
      <button className="cover-assessment-start" onClick={start}><Play weight="fill" />진단 시작</button>
    </section>
  }

  if (finished) {
    const correct = questions.filter(item => answers[item.id] === item.answer).length
    const score = Math.round(correct / Math.max(1, questions.length) * 100)
    const areaResults = areasOf(questions).map(area => {
      const items = questions.filter(item => item.area === area)
      const done = items.filter(item => answers[item.id] === item.answer).length
      return { area, done, total: items.length, pct: Math.round(done / items.length * 100) }
    }).sort((a, b) => a.pct - b.pct)
    try { localStorage.setItem('iv_cover_diagnostic_result', JSON.stringify({ score, areaResults, at: new Date().toISOString() })) } catch { /* local storage unavailable */ }
    return <section className="cover-assessment-result">
      <header className={score >= 80 ? 'is-good' : 'is-review'}><CheckCircle weight="fill" /><div><span>실전 작성 진단 결과</span><strong>{score}점</strong><p>{correct}/{questions.length}개 상황에서 적절하게 수정함</p></div></header>
      <div className="cover-area-results">{areaResults.map(item => <article key={item.area}><div><b>{AREAS[item.area]}</b><span>{item.done}/{item.total}</span></div><i><span style={{ width: `${item.pct}%` }} /></i><small>{item.pct < 70 ? '보완 필요' : '기준 이해'}</small></article>)}</div>
      <section className="cover-result-review"><h4>다시 고칠 상황</h4>{questions.filter(item => answers[item.id] !== item.answer).map(item => <details key={item.id}><summary><WarningCircle />{item.stem}</summary><p><b>권장 수정</b> {item.choices[item.answer]}</p><p>{item.explanation}</p></details>)}</section>
      <div className="cover-result-actions"><button onClick={() => { setStarted(false); setFinished(false) }}><ArrowLeft />다시 설정</button><button onClick={onGoLearn}><FileText />부족한 기준 학습</button></div>
    </section>
  }

  const selected = answers[current.id]
  const canMove = selected !== undefined
  return <section className="cover-assessment-run">
    <header><div><b>{AREAS[current.area]}</b><span>{index + 1}/{questions.length}</span></div><i><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></i></header>
    <article><span>작성 상황 {index + 1}</span><h3>{current.stem}</h3></article>
    <div className="cover-assessment-choices">{current.choices.map((choice, choiceIndex) => { const show = selected !== undefined; return <button key={choice} className={show ? choiceIndex === current.answer ? 'is-correct' : choiceIndex === selected ? 'is-wrong' : '' : selected === choiceIndex ? 'is-selected' : ''} onClick={() => choose(choiceIndex)}><span>{choiceIndex + 1}</span>{choice}</button> })}</div>
    {selected !== undefined && <div className={`cover-diagnostic-explain ${selected === current.answer ? 'is-correct' : 'is-wrong'}`}><b>{selected === current.answer ? '적절한 수정' : `권장 수정 ${current.answer + 1}번`}</b><p>{current.explanation}</p></div>}
    <button className="cover-assessment-next" disabled={!canMove} onClick={next}>{index === questions.length - 1 ? '결과 보기' : '다음 상황'}</button>
  </section>
}
