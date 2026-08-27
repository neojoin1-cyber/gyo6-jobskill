import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, CaretRight, CheckCircle, Compass, Target } from '@phosphor-icons/react'
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import StudySummary, { buildStudySummaryCards } from './StudySummary.jsx'
import { StudyModeStrip } from './StudyModeToggle.jsx'
import CompactText from '../../components/CompactText.jsx'
import { getFirstClassFormative } from '../../lib/firstClassLessons.js'

export default function GuidedStudyScreen({ program, initialArea = null, initialLesson = null, initialStep = 0, initialInteraction = null, onBack, onChallenge, onLearningContext }) {
  const [areaId, setAreaId] = useState(initialArea)
  const [lessonId, setLessonId] = useState(initialLesson)
  const [step, setStep] = useState(initialStep)
  const [interaction, setInteraction] = useState(initialInteraction || {})
  const area = program.areas.find(item => item.id === areaId)
  const lesson = area?.lessons.find(item => item.id === lessonId)
  const formativeAssessment = useMemo(
    () => getFirstClassFormative(program.subjectId, { areaId, lessonId }),
    [program.subjectId, areaId, lessonId],
  )
  const cards = useMemo(
    () => lesson?.summary ? buildStudySummaryCards(lesson.summary, undefined, undefined, undefined, formativeAssessment) : [],
    [lesson, formativeAssessment],
  )

  const backRef = useRef(null)
  backRef.current = () => {
    if (lesson) { setLessonId(null); setStep(0); setInteraction({}); return }
    if (area) { setAreaId(null); setInteraction({}); return }
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
    const activeInteraction = interaction.step === step ? interaction : null
    onLearningContext({
      subject: program.subjectId,
      mode: 'study',
      stage: card?.type || 'concept',
      areaId,
      areaLabel: area.label,
      lessonId,
      lessonLabel: lesson.label,
      title: lesson.summary.title,
      position: step + 1,
      step,
      total: cards.length,
      revealed: Boolean(activeInteraction?.revealed),
      content: { kind: 'summary', cardKind: card?.type || 'intro', summary: lesson.summary, card, interaction: activeInteraction },
    })
  }, [area, areaId, cards, interaction, lesson, lessonId, onLearningContext, program.subjectId, program.title, step])

  function openArea(id) {
    const selected = program.areas.find(item => item.id === id)
    setAreaId(id)
    setInteraction({})
    if (selected?.lessons.length === 1) setLessonId(selected.lessons[0].id)
  }

  const doneKey = `${program.subjectId}.guided.done`
  const [done, setDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(doneKey) || '[]')) }
    catch { return new Set() }
  })
  const markDone = useCallback(id => {
    setDone(current => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      try { localStorage.setItem(doneKey, JSON.stringify([...next])) } catch { /* 저장 불가 환경 */ }
      return next
    })
  }, [doneKey])

  const orderedLessons = useMemo(
    () => program.areas.flatMap(areaItem => areaItem.lessons.map(lessonItem => ({ areaId: areaItem.id, lesson: lessonItem }))),
    [program.areas],
  )
  const currentLessonIndex = orderedLessons.findIndex(item => item.lesson.id === lessonId)
  const nextLesson = currentLessonIndex >= 0 ? orderedLessons[currentLessonIndex + 1] || null : null
  const allDone = orderedLessons.length > 0 && orderedLessons.every(item => done.has(item.lesson.id))

  const handleSummaryStepChange = useCallback(value => {
    setStep(value)
    if (lesson?.id && value >= cards.length - 1) markDone(lesson.id)
  }, [cards.length, lesson?.id, markDone])

  function continueAfterLesson() {
    if (lesson?.id) markDone(lesson.id)
    if (nextLesson) {
      setAreaId(nextLesson.areaId)
      setLessonId(nextLesson.lesson.id)
      setStep(0)
      setInteraction({})
      return
    }
    onChallenge?.()
  }

  const headerTitle = lesson?.label || area?.label || program.title
  return <div className="screen guided-study-screen">
    <header className="guided-study-appbar">
      <button onClick={triggerBack} aria-label="이전 화면"><ArrowLeft /></button>
      <div><span>{program.authority}</span><b>{headerTitle}</b></div>
      {lesson && <span className="guided-study-position" aria-label={`현재 학습 장면 ${step + 1}/${Math.max(1, cards.length)}`}>{step + 1}/{Math.max(1, cards.length)}</span>}
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
            <li><span className="guided-step-number">1</span><b>학습 범위 선택</b></li>
            <li><span className="guided-step-number">2</span><b>{program.subjectId === 'cover-letter' ? '문항 파악·초안 수정' : '개념·상황·사례 확인'}</b></li>
            <li><span className="guided-step-number">3</span><b>{program.subjectId === 'cover-letter' ? '실전 작성 진단' : '진단으로 이해 확인'}</b></li>
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
        <div className="guided-study-list">{area.lessons.map((item, index) => <button key={item.id} onClick={() => { setLessonId(item.id); setStep(0); setInteraction({}) }}>
          <span className={done.has(item.id) ? 'is-done' : ''}>{done.has(item.id) ? <CheckCircle weight="fill" /> : index + 1}</span>
          <div><b>{item.label}</b><p>{item.summary.keyPoints.length}개 핵심 · 실제 상황 · 확인 활동</p></div><CaretRight />
        </button>)}</div>
      </>}

      {lesson && <StudySummary
        summary={lesson.summary}
        formativeAssessment={formativeAssessment}
        initialStep={step}
        initialInteraction={initialInteraction}
        onInteractionChange={setInteraction}
        onStepChange={handleSummaryStepChange}
        onStartQuiz={continueAfterLesson}
        startQuizLabel={nextLesson ? '다음 단원 학습 →' : `${program.challengeLabel} →`}
      />}
    </main>
    {!area && <button className="guided-study-challenge" onClick={onChallenge} disabled={!allDone}>
      <Target weight="fill" />{allDone ? program.challengeLabel : '모든 단원 학습 후 종합 진단'}<CaretRight />
    </button>}
  </div>
}
