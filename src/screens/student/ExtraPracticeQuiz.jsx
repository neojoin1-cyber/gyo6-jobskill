import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle, Target, XCircle } from '@phosphor-icons/react'
import CompactText from '../../components/CompactText.jsx'
import { markAssessmentPracticeExposure, practiceCoverageWindow } from '../../lib/assessmentExposure.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'

const roundKey = scope => `gyo6.extra-practice.round.${scope}`

function savedRound(scope) {
  const value = Number(localStorage.getItem(roundKey(scope)) || 0)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function correctIndex(question) {
  if (Number.isInteger(question?.answer)) return question.answer
  const letter = String(question?.answer || '').toUpperCase()
  return /^[A-E]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1
}

export default function ExtraPracticeQuiz({ title, questions, scope, courseId = 1, onClose, onFullPractice, onComplete }) {
  const [round, setRound] = useState(() => savedRound(scope))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const paper = useMemo(() => practiceCoverageWindow(questions, scope, 2, round), [questions, round, scope])
  const question = paper[index]
  const responseMode = question && (!Array.isArray(question.choices) || question.choices.length < 2)
  const displayChoices = responseMode
    ? ['전혀 그렇지 않다', '그렇지 않은 편이다', '보통이다', '그런 편이다', '매우 그렇다']
    : question?.choices || []

  function check() {
    if (selected == null || !question) return
    const answer = correctIndex(question)
    const correct = responseMode || selected === answer
    setChecked(true)
    if (correct) setScore(value => value + 1)
    else saveWrongAnswer({ ...question, answer: String.fromCharCode(65 + answer) }, courseId, String.fromCharCode(65 + selected))
    if (question.id?.startsWith('NEW26-')) markAssessmentPracticeExposure(question.id)
  }

  function next() {
    if (index + 1 < paper.length) {
      setIndex(value => value + 1)
      setSelected(null)
      setChecked(false)
      return
    }
    const nextRound = round + 1
    try { localStorage.setItem(roundKey(scope), String(nextRound)) } catch { /* 저장 불가 환경 */ }
    setFinished(true)
    onComplete?.({ score, total: paper.length })
  }

  function another() {
    const nextRound = round + 1
    try { localStorage.setItem(roundKey(scope), String(nextRound)) } catch { /* 저장 불가 환경 */ }
    setRound(nextRound)
    setIndex(0)
    setSelected(null)
    setChecked(false)
    setScore(0)
    setFinished(false)
  }

  if (!paper.length) return null

  if (finished) return <div className="screen extra-practice-screen">
    <header className="extra-practice-appbar"><button onClick={onClose} aria-label="학습으로 돌아가기"><ArrowLeft /></button><b>추가 문제 완료</b></header>
    <main className="screen-body extra-practice-result">
      <CheckCircle weight="duotone" />
      <span>짧게 한 번 더</span>
      <h2>{responseMode ? `${paper.length}문항 응답 완료` : `${score}/${paper.length}문항 정답`}</h2>
      <p>{responseMode ? '좋아 보이는 답보다 평소 반복되는 행동을 기준으로 응답했습니다.' : score === paper.length ? '오늘 배운 기준을 새로운 상황에도 정확히 적용했습니다.' : '틀린 문항은 오답노트에 저장했습니다. 해설을 확인한 뒤 다시 풀어 보세요.'}</p>
      <button className="btn btn-primary btn-full" onClick={another}>새로운 2문제 더 풀기</button>
      {onFullPractice && <button className="btn btn-secondary btn-full" onClick={onFullPractice}>전체 문제풀이로 이동</button>}
      <button className="btn btn-ghost btn-full" onClick={onClose}>학습으로 돌아가기</button>
    </main>
  </div>

  const answer = correctIndex(question)
  const correct = checked && selected === answer
  return <div className="screen extra-practice-screen">
    <header className="extra-practice-appbar"><button onClick={onClose} aria-label="학습으로 돌아가기"><ArrowLeft /></button><div><span>추가 2문제</span><b>{title || '배운 내용 바로 적용'}</b></div><strong>{index + 1}/{paper.length}</strong></header>
    <main className="screen-body extra-practice-body">
      <section className="extra-practice-heading"><Target weight="duotone" /><div><span>문제은행에서 새 문제</span><h2>한 번 더 풀어 실력으로 굳히기</h2></div></section>
      {question.context && <article className="extra-practice-context"><span>제시문</span><CompactText text={question.context} maxItemChars={80} /></article>}
      <h3>{question.stem || question.question || question.text}</h3>
      <div className="extra-practice-choices">{displayChoices.map((choice, choiceIndex) => {
        const isSelected = selected === choiceIndex
        const state = checked && choiceIndex === answer ? 'is-correct' : checked && isSelected ? 'is-wrong' : isSelected ? 'is-selected' : ''
        return <button key={`${question.id}-${choiceIndex}`} className={state} disabled={checked} onClick={() => setSelected(choiceIndex)}><span>{choiceIndex + 1}</span><b>{typeof choice === 'object' ? choice.text || choice.label || choice.value : choice}</b></button>
      })}</div>
      {checked && <section className={`extra-practice-feedback ${correct ? 'is-correct' : 'is-wrong'}`}>
        {correct ? <CheckCircle weight="fill" /> : <XCircle weight="fill" />}
        <div><b>{responseMode ? '응답을 기록했습니다' : correct ? '정확합니다' : `${answer + 1}번을 다시 확인하세요`}</b><CompactText text={responseMode ? '이 문항에는 정답이 없습니다. 실제 평소 행동과 일관되게 답했는지만 확인하세요.' : question.explanation || '정답의 근거를 제시문과 보기에서 다시 확인하세요.'} maxItemChars={80} /></div>
      </section>}
      {!checked ? <button className="btn btn-primary btn-full" disabled={selected == null} onClick={check}>정답 확인</button> : <button className="btn btn-primary btn-full" onClick={next}>{index + 1 === paper.length ? '결과 보기' : <>다음 문제 <ArrowRight /></>}</button>}
    </main>
  </div>
}
