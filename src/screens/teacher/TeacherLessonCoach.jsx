import { useEffect, useMemo, useState } from 'react'
import {
  ChatCircleDots,
  CheckCircle,
  Lightbulb,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react'
import { getTeacherLessonGuide } from '../../lib/teacherLessonGuides.js'
import { buildTeacherContextMaterials } from '../../lib/teacherContextMaterials.js'

export default function TeacherLessonCoach({ subject, mode, context = {}, onMessage, onClose }) {
  const [section, setSection] = useState('now')
  const [observed, setObserved] = useState([])
  const guide = useMemo(() => getTeacherLessonGuide(subject, mode), [subject, mode])
  const materials = useMemo(() => buildTeacherContextMaterials(context, guide), [context, guide])
  const support = useMemo(() => currentStageSupport(context, guide, materials), [context, guide, materials])

  useEffect(() => setObserved([]), [context.stage, context.position, context.questionId])

  function toggleObserved(index) {
    setObserved(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])
  }

  function send(title, body) {
    onMessage?.({
      scope: 'class',
      title: `[${guide.label}] ${title}`,
      body,
    })
  }

  return (
    <aside className="teacher-lesson-coach" aria-label="교사용 수업 코치">
      <header>
        <div><small>LIVE CONTEXT GUIDE</small><h2>{context.lessonLabel || guide.label}</h2></div>
        <button type="button" onClick={onClose} aria-label="수업 코치 닫기"><X /></button>
      </header>

      <section className="teacher-coach-focus">
        <b>{support.kicker}</b>
        <p>{support.focus}</p>
        <span><Lightbulb weight="fill" />{support.status}</span>
      </section>

      <nav className="teacher-coach-sections" aria-label="현재 학습 내용의 교사용 자료">
        <button className={section === 'now' ? 'is-on' : ''} onClick={() => setSection('now')}>추가 자료</button>
        <button className={section === 'feedback' ? 'is-on' : ''} onClick={() => setSection('feedback')}>좋은·잘못된 사례</button>
        <button className={section === 'mistakes' ? 'is-on' : ''} onClick={() => setSection('mistakes')}>실수 포인트</button>
        <button className={section === 'questions' ? 'is-on' : ''} onClick={() => setSection('questions')}>발문·확인</button>
      </nav>

      <div className="teacher-coach-scroll">
        {section === 'now' && (
          <>
            <section className="teacher-coach-now">
              <header><span>{support.position}</span><b>{materials.heading}</b></header>
              {materials.situation && <p className="teacher-coach-source">{materials.situation}</p>}
            </section>
            <section className="teacher-coach-explain"><b>이 화면에서 더 설명할 내용</b><ul>{materials.explanations.map(item => <li key={item}>{item}</li>)}</ul></section>
            {materials.answerSummary && <section className="teacher-coach-answer"><b>교사용 정답 확인</b><p>{materials.answerSummary}</p></section>}
            {materials.examples.map(example => (
              <section className="teacher-coach-example" key={`${example.title}:${example.text}`}><b>{example.title}</b><p>{example.text}</p></section>
            ))}
            <blockquote><b>이 화면에서 학생에게 물을 말</b><p>{support.words}</p></blockquote>
            <div className="teacher-coach-activity"><b>다음으로 넘기는 기준</b><p>{support.next}</p></div>
          </>
        )}

        {section === 'feedback' && (
          <div className="teacher-coach-feedback">
            <section className="is-good">
              <header><CheckCircle weight="fill" /><div><b>현재 내용의 좋은 사례</b><span>지금 화면의 근거·선지·해설에서 가져옴</span></div></header>
              {materials.good.map(item => (
                <article key={`${item.title}:${item.text}`}><b>{item.title}</b><p>{item.text}</p><blockquote>{item.detail}</blockquote><button onClick={() => send('잘한 점 피드백', `${item.text}\n${item.detail}`)}><PaperPlaneTilt />보내기</button></article>
              ))}
              {!materials.good.length && <p className="teacher-coach-empty">이 순서에는 별도 모범 사례보다 핵심 설명 확인이 우선임.</p>}
            </section>
            <section className="is-improve">
              <header><Lightbulb weight="fill" /><div><b>현재 내용의 잘못된 사례</b><span>실제 오답과 빠뜨린 조건을 함께 확인</span></div></header>
              {materials.bad.map(item => (
                <article key={`${item.title}:${item.text}`}><b>{item.title}</b><p>{item.text}</p><blockquote>{item.detail}</blockquote><button onClick={() => send('다음 연습 피드백', `${item.text}\n${item.detail}`)}><PaperPlaneTilt />보내기</button></article>
              ))}
              {!materials.bad.length && <p className="teacher-coach-empty">현재 카드에 연결된 실제 오답 사례가 없음.</p>}
            </section>
          </div>
        )}

        {section === 'mistakes' && (
          <div className="teacher-coach-mistakes">
            <header><b>이 화면에서 특히 틀리는 지점</b><span>일반론이 아닌 현재 문항·카드 기준</span></header>
            {materials.mistakes.map((item, index) => <article key={item}><span>{index + 1}</span><p>{item}</p></article>)}
            {!materials.mistakes.length && <p className="teacher-coach-empty">현재 카드에는 별도 오답 함정이 없음. 좋은 사례와 추가 설명을 중심으로 진행함.</p>}
          </div>
        )}

        {section === 'questions' && (
          <>
            <div className="teacher-coach-question-list">
              <p>현재 화면의 표현과 자료를 직접 짚어 질문함.</p>
              {materials.prompts.map((prompt, index) => (
                <article key={prompt}><span>{index + 1}</span><p>{prompt}</p></article>
              ))}
              <button onClick={() => send('현재 학습 질문', materials.prompts.map((value, index) => `${index + 1}. ${value}`).join('\n'))}><ChatCircleDots />질문을 학급 메시지로 보내기</button>
            </div>
          <div className="teacher-coach-checklist">
            <p>현재 내용에서 학생이 확인한 것만 표시함.</p>
            {materials.checklist.map((item, index) => {
              const done = observed.includes(index)
              return (
                <button key={item} className={done ? 'is-done' : ''} onClick={() => toggleObserved(index)} aria-pressed={done}>
                  <CheckCircle weight={done ? 'fill' : 'regular'} /><span>{item}</span>
                </button>
              )
            })}
            <footer><b>{observed.length}/{materials.checklist.length}</b><span>확인 완료</span></footer>
          </div>
          </>
        )}
      </div>
    </aside>
  )
}

function currentStageSupport(context, guide, materials) {
  const position = context.total
    ? `${context.position || 1}/${context.total}`
    : `개념 ${context.position || 1}`
  const title = String(materials.heading || context.title || context.lessonLabel || guide.focus).replace(/\s+/g, ' ').trim()
  const shortTitle = title.length > 88 ? `${title.slice(0, 88)}…` : title

  if (['concept', 'intro', 'point', 'recap', 'term', 'tip', 'end'].includes(context.stage)) {
    return {
      kicker: `${context.areaLabel || guide.label} · ${position}`,
      position,
      focus: shortTitle,
      status: '학생 화면은 그대로 두고, 이 카드에 연결된 추가 자료와 사례만 교사용으로 덧붙임.',
      words: materials.prompts[0] || `${shortTitle}에서 가장 중요한 판단 기준은 무엇인가요?`,
      next: '학생이 현재 화면의 핵심 근거와 적용 예시를 각각 한 가지 말하면 다음 카드로 이동함.',
    }
  }

  const revealed = Boolean(context.revealed)
  return {
    kicker: `${context.areaLabel || guide.label} · 문항 ${position}`,
    position,
    focus: shortTitle,
    status: revealed ? '현재 문항의 정답 근거·실제 오답·실수 포인트를 함께 복기함.' : '학생 화면의 지문과 선지를 유지한 채, 현재 문항 전용 자료로 판단 근거를 확인함.',
    words: revealed
      ? materials.prompts.find(prompt => /실수|틀|막/.test(prompt)) || '처음 판단에서 놓친 정보는 무엇이고, 다음에는 무엇부터 확인할까요?'
      : materials.prompts[0] || '어느 정보가 지금 선택의 근거가 되었나요? 화면에서 직접 짚어 볼까요?',
    next: revealed
      ? '학생이 오답 원인과 다음 확인 행동을 말하면 다음 문항으로 이동함.'
      : '최소 두 학생이 서로 다른 근거를 말한 뒤 정답과 해설을 공개함.',
  }
}
