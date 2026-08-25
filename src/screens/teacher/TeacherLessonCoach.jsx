import { useMemo, useState } from 'react'
import {
  ChatCircleDots,
  CheckCircle,
  Clock,
  Lightbulb,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react'
import { getTeacherLessonGuide, lessonTiming, LESSON_DURATIONS } from '../../lib/teacherLessonGuides.js'

export default function TeacherLessonCoach({ subject, mode, onMessage, onClose }) {
  const [minutes, setMinutes] = useState(25)
  const [section, setSection] = useState('flow')
  const [checked, setChecked] = useState([])
  const guide = useMemo(() => getTeacherLessonGuide(subject, mode), [subject, mode])
  const flow = lessonTiming(minutes)

  function toggle(index) {
    setChecked(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])
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
        <div><small>LIVE TEACHING COACH</small><h2>{guide.label} 수업 코치</h2></div>
        <button type="button" onClick={onClose} aria-label="수업 코치 닫기"><X /></button>
      </header>

      <section className="teacher-coach-focus">
        <b>오늘의 수업 초점</b>
        <p>{guide.focus}</p>
        <span><Lightbulb weight="fill" />{guide.modeHint}</span>
      </section>

      <nav className="teacher-coach-sections" aria-label="수업 코치 보기">
        <button className={section === 'flow' ? 'is-on' : ''} onClick={() => setSection('flow')}>수업 흐름</button>
        <button className={section === 'questions' ? 'is-on' : ''} onClick={() => setSection('questions')}>발문</button>
        <button className={section === 'feedback' ? 'is-on' : ''} onClick={() => setSection('feedback')}>사례·피드백</button>
      </nav>

      <div className="teacher-coach-scroll">
        {section === 'flow' && (
          <>
            <div className="teacher-coach-duration" aria-label="수업 시간 선택">
              {LESSON_DURATIONS.map(value => <button key={value} className={minutes === value ? 'is-on' : ''} onClick={() => { setMinutes(value); setChecked([]) }}><Clock />{value}분</button>)}
            </div>
            <blockquote><b>첫 멘트</b><p>“{guide.opening}”</p></blockquote>
            <ol className="teacher-coach-flow">
              {flow.map(([title, action, duration], index) => (
                <li key={title} className={checked.includes(index) ? 'is-done' : ''}>
                  <button onClick={() => toggle(index)} aria-label={`${title} ${checked.includes(index) ? '완료 취소' : '완료'}`}><CheckCircle weight={checked.includes(index) ? 'fill' : 'regular'} /></button>
                  <div><b>{index + 1}. {title}</b><p>{action}</p></div>
                  <span>{duration}분</span>
                </li>
              ))}
            </ol>
            <div className="teacher-coach-activity"><b>학생 활동</b><p>{guide.activity}</p></div>
            <div className="teacher-coach-exit"><b>마무리 확인</b><p>{guide.exit}</p></div>
          </>
        )}

        {section === 'questions' && (
          <div className="teacher-coach-question-list">
            <p>정답을 먼저 설명하지 않고 아래 순서로 물음.</p>
            {guide.prompts.map((prompt, index) => (
              <article key={prompt}><span>{index + 1}</span><p>“{prompt}”</p></article>
            ))}
            <button onClick={() => send('오늘의 생각 질문', guide.prompts.map((value, index) => `${index + 1}. ${value}`).join('\n'))}><ChatCircleDots />질문을 학급 메시지로 보내기</button>
          </div>
        )}

        {section === 'feedback' && (
          <div className="teacher-coach-feedback">
            <section className="is-good">
              <header><CheckCircle weight="fill" /><div><b>잘한 점을 구체적으로</b><span>행동을 짚고 유지할 이유를 말함</span></div></header>
              {guide.good.map(([title, signal, words]) => (
                <article key={title}><b>{title}</b><p>{signal}</p><blockquote>{words}</blockquote><button onClick={() => send('잘한 점 피드백', words)}><PaperPlaneTilt />보내기</button></article>
              ))}
            </section>
            <section className="is-improve">
              <header><Lightbulb weight="fill" /><div><b>보완할 점은 다음 행동까지</b><span>지적에서 끝내지 않고 다시 할 일을 줌</span></div></header>
              {guide.improve.map(([title, signal, words]) => (
                <article key={title}><b>{title}</b><p>{signal}</p><blockquote>{words}</blockquote><button onClick={() => send('다음 연습 피드백', words)}><PaperPlaneTilt />보내기</button></article>
              ))}
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}
