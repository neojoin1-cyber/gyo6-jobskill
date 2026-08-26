import { useEffect, useMemo, useState } from 'react'
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  ChatCircleDots,
  CheckCircle,
  Lightbulb,
  PaperPlaneTilt,
  Pause,
  Play,
  User,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import { getTeacherLessonGuide } from '../../lib/teacherLessonGuides.js'
import { buildTeacherContextMaterials } from '../../lib/teacherContextMaterials.js'
import { getFirstClassLesson, matchesFirstClassLesson } from '../../lib/firstClassLessons.js'

const RHYTHM_STEPS = [
  { label: '개인 판단', seconds: 30, icon: User, words: '말하지 말고 먼저 혼자 고르게 합니다. 화면 속 근거 한 곳을 손가락이나 메모로 표시하게 하세요.' },
  { label: '짝 비교', seconds: 60, icon: UsersThree, words: '서로 선택만 확인하지 말고, 근거가 된 단어나 장면을 한 가지씩 교환하게 하세요.' },
  { label: '재선택', seconds: 20, icon: ArrowsClockwise, words: '친구의 근거를 들은 뒤 선택을 유지할지 바꿀지 다시 결정하게 하세요.' },
  { label: '이유 듣기', seconds: 60, icon: ChatCircleDots, words: '서로 다른 판단을 한 학생부터 이유를 듣고, 화면에서 근거를 직접 짚게 하세요.' },
  { label: '한 문장 정리', seconds: 30, icon: CheckCircle, words: '정답만 말하지 말고 “다음에는 무엇부터 확인할지” 한 문장으로 마무리하게 하세요.' },
]

export default function TeacherLessonCoach({ subject, mode, context = {}, projectionSafe = false, onMessage, onClose }) {
  const [section, setSection] = useState('rhythm')
  const [observed, setObserved] = useState([])
  const [rhythmIndex, setRhythmIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(RHYTHM_STEPS[0].seconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [rhythmDone, setRhythmDone] = useState([])
  const guide = useMemo(() => getTeacherLessonGuide(subject, mode), [subject, mode])
  const firstClassPlan = useMemo(() => getFirstClassLesson(subject), [subject])
  const firstClassActive = useMemo(() => matchesFirstClassLesson(subject, context), [subject, context])
  const materials = useMemo(() => buildTeacherContextMaterials(context, guide), [context, guide])
  const support = useMemo(() => currentStageSupport(context, guide, materials), [context, guide, materials])
  const choiceBranch = useMemo(() => buildChoiceBranch(context, materials), [context, materials])
  const choiceBranchKey = choiceBranch?.key || ''

  useEffect(() => {
    setObserved([])
    setRhythmIndex(0)
    setSecondsLeft(RHYTHM_STEPS[0].seconds)
    setTimerRunning(false)
    setRhythmDone([])
  }, [context.stage, context.position, context.questionId])

  useEffect(() => {
    if (choiceBranch) setSection('branch')
    else if (section === 'branch') setSection('rhythm')
  }, [choiceBranchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (firstClassActive && Number(context.position || 1) === 1) setSection('flow')
  }, [context.lessonId, firstClassActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (projectionSafe && ['now', 'feedback', 'mistakes'].includes(section)) {
      setSection(choiceBranch ? 'branch' : 'rhythm')
    }
  }, [choiceBranch, projectionSafe, section])

  useEffect(() => {
    if (!timerRunning) return undefined
    const timerId = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          setTimerRunning(false)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [timerRunning])

  const rhythm = RHYTHM_STEPS[rhythmIndex]

  function selectRhythm(index) {
    setRhythmIndex(index)
    setSecondsLeft(RHYTHM_STEPS[index].seconds)
    setTimerRunning(false)
  }

  function advanceRhythm() {
    setRhythmDone(current => current.includes(rhythmIndex) ? current : [...current, rhythmIndex])
    if (rhythmIndex < RHYTHM_STEPS.length - 1) selectRhythm(rhythmIndex + 1)
  }

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
        {projectionSafe && <em>집중 화면에서는 학생에게 보여도 되는 진행 자료만 표시함.</em>}
      </section>

      <nav className="teacher-coach-sections" aria-label="현재 학습 내용의 교사용 자료">
        {firstClassPlan && <button className={section === 'flow' ? 'is-on' : ''} onClick={() => setSection('flow')}>첫 수업 흐름</button>}
        <button className={section === 'rhythm' ? 'is-on' : ''} onClick={() => setSection('rhythm')}>수업 리듬</button>
        {choiceBranch && <button className={section === 'branch' ? 'is-on is-branch' : 'is-branch'} onClick={() => setSection('branch')}>선택 후 심화</button>}
        {!projectionSafe && <button className={section === 'now' ? 'is-on' : ''} onClick={() => setSection('now')}>추가 자료</button>}
        {!projectionSafe && <button className={section === 'feedback' ? 'is-on' : ''} onClick={() => setSection('feedback')}>좋은·잘못된 사례</button>}
        {!projectionSafe && <button className={section === 'mistakes' ? 'is-on' : ''} onClick={() => setSection('mistakes')}>실수 포인트</button>}
        <button className={section === 'questions' ? 'is-on' : ''} onClick={() => setSection('questions')}>발문·확인</button>
      </nav>

      <div className="teacher-coach-scroll">
        {section === 'flow' && firstClassPlan && (
          <section className="teacher-coach-first-flow">
            <header>
              <small>FIRST CLASS · 45분</small>
              <h3>{firstClassPlan.title}</h3>
              <p>{firstClassPlan.objective}</p>
            </header>
            <div className="teacher-coach-first-path">
              <b>메뉴 경로</b>
              <p>{firstClassPlan.path.join(' → ')}</p>
            </div>
            <ol>
              {firstClassPlan.flow.map((item, index) => (
                <li key={`${item.minutes}:${item.phase}`}>
                  <span>{index + 1}</span>
                  <article>
                    <header><b>{item.phase}</b><time>{item.minutes}</time></header>
                    <dl>
                      <div><dt>메뉴</dt><dd>{item.menu}</dd></div>
                      <div><dt>누를 버튼</dt><dd>{item.button}</dd></div>
                      <div className="is-talk"><dt>교사 멘트</dt><dd>“{item.teacherTalk}”</dd></div>
                      <div><dt>제시 자료</dt><dd>{item.material}</dd></div>
                      <div><dt>학생 활동</dt><dd>{item.studentAction}</dd></div>
                    </dl>
                  </article>
                </li>
              ))}
            </ol>
            <footer>
              <b>마지막 9분</b>
              <p>복습 2문항과 새 상황 변형 1문항을 개별로 풀고, 해설 뒤 틀린 이유와 다음 확인 행동을 남깁니다.</p>
            </footer>
          </section>
        )}

        {section === 'rhythm' && (
          <section className="teacher-coach-rhythm">
            <header>
              <div><small>현재 카드 수업 흐름</small><b>{rhythm.label}</b></div>
              <span>{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</span>
            </header>
            <div className="teacher-coach-rhythm-steps" aria-label="수업 리듬 단계">
              {RHYTHM_STEPS.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    type="button"
                    key={item.label}
                    className={`${rhythmIndex === index ? 'is-on' : ''} ${rhythmDone.includes(index) ? 'is-done' : ''}`}
                    onClick={() => selectRhythm(index)}
                    aria-pressed={rhythmIndex === index}
                  >
                    <Icon weight={rhythmDone.includes(index) ? 'fill' : 'regular'} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
            <blockquote>
              <b>지금 선생님이 할 일</b>
              <p>{rhythm.words}</p>
            </blockquote>
            <div className="teacher-coach-rhythm-prompt">
              <b>현재 화면 발문</b>
              <p>{rhythmIndex === 0 ? support.words : materials.prompts[Math.min(rhythmIndex - 1, materials.prompts.length - 1)] || support.words}</p>
            </div>
            <div className="teacher-coach-timer-actions">
              <button type="button" onClick={() => setTimerRunning(value => !value)} disabled={secondsLeft === 0}>
                {timerRunning ? <Pause weight="fill" /> : <Play weight="fill" />}
                {timerRunning ? '잠시 멈춤' : '타이머 시작'}
              </button>
              <button type="button" onClick={() => { setSecondsLeft(rhythm.seconds); setTimerRunning(false) }}>
                <ArrowCounterClockwise />다시
              </button>
              <button type="button" className="is-next" onClick={advanceRhythm}>
                {rhythmIndex === RHYTHM_STEPS.length - 1 ? '이 카드 완료' : '다음 단계'}
              </button>
            </div>
            <footer><b>{rhythmDone.length}/{RHYTHM_STEPS.length}</b><span>수업 리듬 진행</span></footer>
          </section>
        )}

        {section === 'branch' && choiceBranch && (
          <section className="teacher-coach-branch" aria-live="polite">
            <header>
              <div><small>학생 선택에 바로 이어가기</small><b>{choiceBranch.choice}</b></div>
              <span>{choiceBranch.topic}</span>
            </header>
            <blockquote>
              <b>선생님의 첫 반응</b>
              <p>{choiceBranch.firstResponse}</p>
            </blockquote>
            <ol>
              {choiceBranch.steps.map((item, index) => (
                <li key={item.title}>
                  <span>{index + 1}</span>
                  <div><b>{item.title}</b><p>{item.words}</p></div>
                </li>
              ))}
            </ol>
            {choiceBranch.evidence && (
              <div className="teacher-coach-branch-evidence">
                <b>필요할 때만 공개할 현재 카드 근거</b>
                <p>{choiceBranch.evidence}</p>
              </div>
            )}
            <footer><b>다음으로 넘기는 기준</b><p>{choiceBranch.next}</p></footer>
          </section>
        )}

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

function buildChoiceBranch(context, materials) {
  const interaction = context.content?.interaction
  const choice = interaction?.reconsidered
  if (!choice) return null

  const topic = compactText(interaction.topic || materials.heading || context.title, 54)
  const changedCondition = compactText(interaction.twist || '조건이 달라졌을 때도 같은 판단이 가능한가요?', 120)
  const evidence = compactText(interaction.evidence || materials.explanations?.[0] || materials.situation, 180)
  const shared = {
    key: `${context.lessonId || context.lessonLabel || ''}:${interaction.step}:${choice}`,
    choice,
    topic,
    evidence,
  }

  if (choice === '판단 유지') {
    return {
      ...shared,
      firstResponse: '“그대로”라고만 끝내지 말고, 바뀐 조건에도 흔들리지 않는 근거를 화면에서 하나 고르게 하세요.',
      steps: [
        { title: '결정적 근거 짚기', words: `“${changedCondition}”에도 판단을 유지하게 하는 단어나 장면은 무엇인가요?` },
        { title: '반대편과 맞대기', words: '짝은 판단을 바꿔야 한다는 근거를 하나 제시하고, 어느 근거가 더 직접적인지 비교하게 하세요.' },
        { title: '한 번 더 흔들기', words: '“그렇다면 어떤 정보가 추가되면 판단을 수정하겠나요?”라고 물어 판단의 경계까지 말하게 하세요.' },
      ],
      next: '유지 근거와 판단을 바꿀 경계 조건을 각각 한 문장으로 말하면 다음 카드로 이동함.',
    }
  }

  if (choice === '판단 수정') {
    return {
      ...shared,
      firstResponse: '바꿨다는 사실보다 무엇 때문에 바뀌었는지가 핵심입니다. 이전 판단과 달라진 단서를 나란히 말하게 하세요.',
      steps: [
        { title: '변화 지점 찾기', words: `“${changedCondition}”에서 처음 판단을 뒤집은 말이나 조건은 정확히 무엇인가요?` },
        { title: '전·후 판단 비교', words: '“처음에는 ___ 때문에 ___, 지금은 ___ 때문에 ___” 형식으로 답하게 하세요.' },
        { title: '과잉 수정 막기', words: '바뀐 조건과 관계없는 정보 하나를 골라 왜 판단 근거가 아닌지 설명하게 하세요.' },
      ],
      next: '판단을 바꾼 직접 조건과 바뀌지 않은 조건을 구분해 말하면 다음 카드로 이동함.',
    }
  }

  return {
    ...shared,
    firstResponse: '“모르겠다”로 끝내지 말고, 결정에 꼭 필요한 정보가 무엇인지 질문으로 바꾸게 하세요.',
    steps: [
      { title: '빈칸 이름 붙이기', words: `“${changedCondition}”에 답하려면 누구의 행동·수치·결과 중 무엇이 더 필요한가요?` },
      { title: '질문 한 문장 만들기', words: '“___을 확인할 수 있나요?” 형식으로 면접관이나 상황 속 인물에게 물을 질문을 만들게 하세요.' },
      { title: '정보 한 조각만 공개', words: '현재 카드 근거를 한 번에 설명하지 말고 한 문장만 공개한 뒤 다시 판단하게 하세요.' },
    ],
    next: '필요한 정보와 그 정보가 들어오면 내릴 판단을 함께 말하면 다음 카드로 이동함.',
  }
}

function compactText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function currentStageSupport(context, guide, materials) {
  const position = context.total
    ? `${context.position || 1}/${context.total}`
    : `개념 ${context.position || 1}`
  const title = String(materials.heading || context.title || context.lessonLabel || guide.focus).replace(/\s+/g, ' ').trim()
  const shortTitle = title.length > 88 ? `${title.slice(0, 88)}…` : title

  if (['concept', 'intro', 'point', 'recap', 'term', 'tip', 'mission', 'formative', 'end'].includes(context.stage)) {
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
