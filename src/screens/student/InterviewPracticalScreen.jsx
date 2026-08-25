import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CaretRight,
  CheckCircle,
  ClipboardText,
  Clock,
  Eye,
  PlayCircle,
  Repeat,
  Target,
  WarningCircle,
} from '@phosphor-icons/react'
import { INTERVIEW_OBSERVATION_AREAS, INTERVIEW_PRACTICAL_STAGES, practicalProgressKey } from '../../lib/interviewPracticalContent.js'
import '../../styles/interview-practical.css'

function readProgress() {
  try { return JSON.parse(localStorage.getItem(practicalProgressKey()) || '{}') }
  catch { return {} }
}

export default function InterviewPracticalScreen({ onBack }) {
  const [view, setView] = useState('route')
  const [stageId, setStageId] = useState(INTERVIEW_PRACTICAL_STAGES[0].id)
  const [progress, setProgress] = useState(readProgress)
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [choice, setChoice] = useState(null)
  const [runStep, setRunStep] = useState(0)
  const stage = INTERVIEW_PRACTICAL_STAGES.find(item => item.id === stageId) || INTERVIEW_PRACTICAL_STAGES[0]
  const doneCount = Object.values(progress).filter(Boolean).length
  const scenario = stage.scenarios[scenarioIndex % stage.scenarios.length]
  const percent = Math.round(doneCount / INTERVIEW_PRACTICAL_STAGES.length * 100)

  function saveDone(id, value = true) {
    const next = { ...progress, [id]: value }
    setProgress(next)
    localStorage.setItem(practicalProgressKey(), JSON.stringify(next))
  }

  function openStage(id) {
    setStageId(id)
    setScenarioIndex(0)
    setChoice(null)
    setView('stage')
  }

  function nextScenario() {
    setChoice(null)
    setScenarioIndex(value => value + 1)
  }

  function startRun() {
    setRunStep(0)
    setView('run')
  }

  if (view === 'stage') return (
    <PracticalFrame title={stage.title} eyebrow={`${stage.timing} · ${stage.goal}`} onBack={() => setView('route')}>
      <section className="practical-stage-lead"><Target weight="fill" /><div><span>이번 연습 기준</span><h2>{stage.goal}</h2></div></section>
      <section className="practical-check-card">
        <header><ClipboardText weight="duotone" /><div><span>STUDENT CHECK</span><h3>내 행동 먼저 확인</h3></div></header>
        <ul>{stage.student.map(item => <li key={item}><CheckCircle />{item}</li>)}</ul>
      </section>
      <section className="practical-examples">
        <article className="is-good"><span>잘된 행동</span><p>{stage.good}</p></article>
        <article className="is-trap"><span>다시 연습</span><p>{stage.bad}</p></article>
      </section>
      <section className="practical-scenario">
        <header><span>상황 {scenarioIndex % stage.scenarios.length + 1}/{stage.scenarios.length}</span><h3>{scenario.prompt}</h3></header>
        <button className={choice === 'best' ? 'is-picked is-best' : ''} onClick={() => setChoice('best')}><b>A</b><span>{scenario.best}</span></button>
        <button className={choice === 'trap' ? 'is-picked is-trap' : ''} onClick={() => setChoice('trap')}><b>B</b><span>{scenario.trap}</span></button>
        {choice && <div className={choice === 'best' ? 'is-correct' : 'is-wrong'}>{choice === 'best' ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}<p>{choice === 'best' ? '현장 안내와 상대 신호를 우선한 행동임.' : `더 나은 행동: ${scenario.best}`}</p></div>}
        <footer><button onClick={nextScenario} disabled={!choice}><Repeat />다른 상황</button><button className="is-primary" onClick={() => { saveDone(stage.id); setView('route') }}><CheckCircle weight="fill" />이 단계 연습 완료</button></footer>
      </section>
    </PracticalFrame>
  )

  if (view === 'run') {
    const current = INTERVIEW_PRACTICAL_STAGES[runStep]
    const isLast = runStep === INTERVIEW_PRACTICAL_STAGES.length - 1
    return (
      <PracticalFrame title="전 과정 리허설" eyebrow={`${runStep + 1}/${INTERVIEW_PRACTICAL_STAGES.length} · 멈추지 않고 끝까지`} onBack={() => setView('route')}>
        <section className="practical-run-progress"><span>{INTERVIEW_PRACTICAL_STAGES.map((item, index) => <i key={item.id} className={index <= runStep ? 'is-on' : ''} />)}</span><b>{current.short}</b></section>
        <section className="practical-run-card">
          <div className="practical-run-clock"><Clock weight="duotone" /><span>{current.timing}</span></div>
          <small>STEP {runStep + 1}</small><h2>{current.title}</h2><p>{current.goal}</p>
          <div><b>지금 행동하기</b>{current.student.slice(0, 2).map(item => <span key={item}><CheckCircle />{item}</span>)}</div>
        </section>
        <section className="practical-self-check">
          <h3>소리 내어 연습한 뒤 선택</h3>
          <div>{INTERVIEW_OBSERVATION_AREAS.slice(0, 4).map(item => <span key={item.id}><Eye />{item.label}</span>)}</div>
        </section>
        <footer className="practical-run-actions">
          <button onClick={() => setRunStep(value => Math.max(0, value - 1))} disabled={runStep === 0}><ArrowLeft />이전</button>
          <button onClick={() => { saveDone(current.id); if (isLast) setView('complete'); else setRunStep(value => value + 1) }}>{isLast ? '리허설 마침' : '연습하고 다음'}<CaretRight /></button>
        </footer>
      </PracticalFrame>
    )
  }

  if (view === 'complete') return (
    <PracticalFrame title="실전면접 리허설" eyebrow="전 과정 1회 완료" onBack={() => setView('route')}>
      <section className="practical-complete"><CheckCircle weight="fill" /><span>FULL RUN COMPLETE</span><h2>입장 전부터 건물 밖까지 완주</h2><p>다음 회차에는 고칠 행동을 하나만 정함. 답변 내용과 전달 행동을 함께 녹화해 비교함.</p><button onClick={startRun}><Repeat />다시 리허설</button></section>
    </PracticalFrame>
  )

  return (
    <PracticalFrame title="실전면접" eyebrow="학습 다음 · 행동으로 완성" onBack={onBack}>
      <section className="practical-hero">
        <div><span>INTERVIEW FULL RUN</span><h2>대기부터 퇴장까지<br />한 번에 연습</h2><p>외운 예절보다 안내 확인·직무 답변·상황 회복을 익힘.</p></div>
        <div className="practical-score"><b>{percent}%</b><span>{doneCount}/{INTERVIEW_PRACTICAL_STAGES.length} 단계</span></div>
      </section>
      <button className="practical-start-run" onClick={startRun}><PlayCircle weight="fill" /><span><b>전 과정 리허설 시작</b><small>9단계 · 멈추지 않고 실제처럼</small></span><CaretRight /></button>
      <section className="practical-route">
        <header><span>상황별 먼저 연습</span><h3>면접 동선 9단계</h3></header>
        <div>{INTERVIEW_PRACTICAL_STAGES.map((item, index) => <button key={item.id} className={progress[item.id] ? 'is-done' : ''} onClick={() => openStage(item.id)}><span>{progress[item.id] ? <CheckCircle weight="fill" /> : index + 1}</span><div><b>{item.title}</b><small>{item.goal}</small></div><CaretRight /></button>)}</div>
      </section>
      <section className="practical-rule"><WarningCircle weight="fill" /><div><b>고정 예절 암기 금지</b><p>지원처 안내·면접위원 신호가 최우선. 상황이 모호하면 짧게 확인함.</p></div></section>
    </PracticalFrame>
  )
}

function PracticalFrame({ title, eyebrow, onBack, children }) {
  return <div className="screen interview-practical-screen"><header className="appbar practical-appbar"><button className="appbar-back" onClick={onBack} aria-label="이전 화면"><ArrowLeft /></button><div><small>{eyebrow}</small><span className="appbar-title">{title}</span></div></header><main className="screen-body interview-practical-body">{children}</main></div>
}
