import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, CaretRight, CheckCircle, Compass, Target } from '@phosphor-icons/react'
import { pushBack, popBack } from '../../lib/backButton.js'
import StudySummary, { buildStudySummaryCards } from './StudySummary.jsx'
import StudyModeToggle, { StudyModeStrip } from './StudyModeToggle.jsx'
import CompactText from '../../components/CompactText.jsx'

export default function GuidedStudyScreen({ program, onBack, onChallenge, onLearningContext }) {
  const [areaId, setAreaId] = useState(null)
  const [lessonId, setLessonId] = useState(null)
  const [step, setStep] = useState(0)
  const area = program.areas.find(item => item.id === areaId)
  const lesson = area?.lessons.find(item => item.id === lessonId)
  const cards = useMemo(() => lesson?.summary ? buildStudySummaryCards(lesson.summary) : [], [lesson])

  const backRef = useRef(null)
  backRef.current = () => {
    if (lessonId) { setLessonId(null); setStep(0); return }
    if (areaId) { setAreaId(null); return }
    onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  useEffect(() => {
    if (!onLearningContext) return
    if (!area) {
      onLearningContext({ subject: program.subjectId, mode: 'study', stage: 'area-choice', areaLabel: program.title, lessonLabel: '학습 범위 선택' })
      return
    }
    if (!lesson) {
      onLearningContext({ subject: program.subjectId, mode: 'study', stage: 'lesson-choice', areaLabel: area.label, lessonLabel: '단원 선택' })
      return
    }
    const card = cards[step]
    onLearningContext({
      subject: program.subjectId,
      mode: 'study',
      stage: card?.type || 'concept',
      areaLabel: area.label,
      lessonLabel: lesson.label,
      title: lesson.summary.title,
      position: step + 1,
      total: cards.length,
      revealed: true,
      content: { kind: 'summary', cardKind: card?.type || 'intro', summary: lesson.summary, card },
    })
  }, [area, cards, lesson, onLearningContext, program.subjectId, program.title, step])

  function selectMode(mode) {
    if (mode === 'game') onChallenge?.()
  }

  function openArea(id) {
    const selected = program.areas.find(item => item.id === id)
    setAreaId(id)
    if (selected?.lessons.length === 1) setLessonId(selected.lessons[0].id)
  }

  const doneKey = `${program.subjectId}.guided.done`
  const [done, setDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(doneKey) || '[]')) }
    catch { return new Set() }
  })
  function markDone(id) {
    const next = new Set(done); next.add(id); setDone(next)
    try { localStorage.setItem(doneKey, JSON.stringify([...next])) } catch { /* 저장 불가 환경 */ }
  }

  const headerTitle = lesson?.label || area?.label || program.title
  return <div className="screen guided-study-screen">
    <header className="guided-study-appbar">
      <button onClick={() => backRef.current()} aria-label="이전 화면"><ArrowLeft /></button>
      <div><span>{program.authority}</span><b>{headerTitle}</b></div>
      <StudyModeToggle mode="learn" onChange={selectMode} compact />
    </header>
    <StudyModeStrip mode="learn" right={lesson ? `${step + 1}/${Math.max(1, cards.length)}` : null} />
    <main className="screen-body guided-study-body">
      {!area && <>
        <section className="guided-study-intro">
          <div><Compass weight="duotone" /></div>
          <span>SELF STUDY</span>
          <h2>{program.title}</h2>
          <CompactText text={program.description} maxItemChars={72} />
          <ol>
            <li><span>1</span>학습 범위 선택</li>
            <li><span>2</span>{program.subjectId === 'cover-letter' ? '문항·감점 초안·작성 실습' : '개념·상황·사례 확인'}</li>
            <li><span>3</span>{program.subjectId === 'cover-letter' ? '실전 작성 진단으로 확인' : '진단으로 이해 확인'}</li>
          </ol>
        </section>
        <p className="guided-study-section-title">학습 범위 · {program.areas.length}개</p>
        <div className="guided-study-list">{program.areas.map((item, index) => {
          const completed = item.lessons.every(value => done.has(value.id))
          return <button key={item.id} onClick={() => openArea(item.id)}>
            <span className={completed ? 'is-done' : ''}>{completed ? <CheckCircle weight="fill" /> : index + 1}</span>
            <div><b>{item.label}</b><CompactText text={item.description} maxItemChars={64} /></div>
            <strong>{item.lessons.length}단원</strong><CaretRight />
          </button>
        })}</div>
      </>}

      {area && !lesson && <>
        <section className="guided-study-area-head"><BookOpen weight="duotone" /><div><span>선택한 범위</span><h2>{area.label}</h2><CompactText text={area.description} maxItemChars={72} /></div></section>
        <div className="guided-study-list">{area.lessons.map((item, index) => <button key={item.id} onClick={() => { setLessonId(item.id); setStep(0) }}>
          <span className={done.has(item.id) ? 'is-done' : ''}>{done.has(item.id) ? <CheckCircle weight="fill" /> : index + 1}</span>
          <div><b>{item.label}</b><p>{item.summary.keyPoints.length}개 핵심 · 실제 상황 · 확인 활동</p></div><CaretRight />
        </button>)}</div>
      </>}

      {lesson && <StudySummary
        summary={lesson.summary}
        initialStep={step}
        onStepChange={value => {
          setStep(value)
          if (value >= cards.length - 1) markDone(lesson.id)
        }}
        onStartQuiz={onChallenge}
      />}
    </main>
    {!area && <button className="guided-study-challenge" onClick={onChallenge}><Target weight="fill" />{program.challengeLabel}<CaretRight /></button>}
  </div>
}
