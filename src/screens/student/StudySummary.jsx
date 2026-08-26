import { useState, useMemo, useEffect } from 'react'
import QuestionMedia from './QuestionMedia.jsx'
import ListeningPrompt from './ListeningPrompt.jsx'
import PulldownForm from './PulldownForm.jsx'
import { buildLearningMistakes, buildLearningPoints, learningVisualFor } from '../../lib/learningExperience.js'
import { analyzeWritingDraft } from '../../lib/writingDraftCheck.js'
import { buildAutonomousFormative } from '../../lib/autonomousFormative.js'
import CompactText from '../../components/CompactText.jsx'

const EMPTY_QUESTIONS = []

function learningLanguage(courseKind, isListening = false) {
  if (courseKind === 'cover-letter') return {
    practical: true,
    practiceLabel: '자기소개서 작성 실전',
    introMode: '문항 파악 · 초안 수정 · 독립 작성',
    introCaption: '실제 지원 문항과 감점 초안을 보고, 내 사실 근거로 직접 고쳐 씁니다.',
    countLabel: '작성 도구',
    memoryLabel: '작성 기준',
    understandLabel: '작성법 익히기',
    pointLabel: '이번에 익힐 작성법',
    learnLabel: '실제 작성은 이렇게',
    revealLabel: '작성 실전 펼치기',
    revealedLabel: '작성 실전',
    toolLabel: '제출 전 작성 도구',
    toolAction: '작성 도구 확인',
  }
  if (courseKind === 'interview') return {
    practical: true,
    practiceLabel: '면접 답변 실전',
    introMode: '상황 판단 · 답변 구성 · 직접 말하기',
    introCaption: '실제 면접 상황을 보고, 적절한 대응과 내 경험 답변을 직접 연습합니다.',
    countLabel: '답변 도구',
    memoryLabel: '답변 기준',
    understandLabel: '상황·답변 익히기',
    pointLabel: '이번에 익힐 대응',
    learnLabel: '실제 면접에서는 이렇게',
    revealLabel: '답변 실전 펼치기',
    revealedLabel: '답변 실전',
    toolLabel: '면접 직전 답변 도구',
    toolAction: '답변 도구 확인',
  }
  if (courseKind === 'personality') return {
    practical: false,
    practiceLabel: '응답 상황 판단',
    introMode: '상황 비교 · 응답 기준 · 일관성 성찰',
    introCaption: '정답을 맞히는 대신 비슷한 상황의 내 기준이 일관되는지 차분히 확인합니다.',
    countLabel: '응답 기준',
    memoryLabel: '응답 기준',
    understandLabel: '상황 이해',
    pointLabel: '먼저 판단할 상황',
    learnLabel: '선택 뒤 확인할 기준',
    revealLabel: '내 기준 확인하기',
    revealedLabel: '응답 기준 확인',
    toolLabel: '일관성 점검',
    toolAction: '응답 기준 확인',
  }
  if (isListening) return {
    practical: false,
    practiceLabel: '듣고 판단하기',
    introMode: '상황 듣기 · 핵심 메모 · 판단 확인',
    introCaption: '음성을 먼저 듣고 인물·목적·조건을 메모한 뒤, 판단 근거를 확인합니다.',
    countLabel: '핵심 표현',
    memoryLabel: '듣기 단서',
    understandLabel: '듣기 이해',
    pointLabel: '이번에 들을 정보',
    learnLabel: '들은 뒤 이렇게 판단해요',
    revealLabel: '듣기 판단 확인하기',
    revealedLabel: '듣기 판단 확인',
    toolLabel: '정답 근거',
    toolAction: '정답 근거 보기',
  }
  return {
    practical: false,
    practiceLabel: '실제 출제형',
    introMode: '개념 이해 · 실제 형식 · 독립 연습',
    introCaption: '직무 상황을 먼저 보고, 개념과 실제 출제형을 연결합니다.',
    countLabel: '용어',
    memoryLabel: '시험 출제 암기',
    understandLabel: '개념 이해',
    pointLabel: '이번에 익힐 판단',
    learnLabel: '개념을 이렇게 이해해요',
    revealLabel: '시험엔 어떻게 나올까? — 탭하여 확인',
    revealedLabel: '외부평가에서는 이렇게',
    toolLabel: '정답 용어',
    toolAction: '정답 용어 보기',
  }
}

export function buildStudySummaryCards(summary, questions = EMPTY_QUESTIONS, preparedPoints, preparedMistakes, formativeAssessment = null) {
  const learningPoints = preparedPoints ?? buildLearningPoints(summary, questions)
  const learningMistakes = preparedMistakes ?? buildLearningMistakes(summary, questions)
  const mustRemember = summary?.mustRemember ?? []
  const terms = summary?.terms ?? []
  const cards = [{ type: 'intro' }]
  learningPoints.forEach((point, index) => cards.push({
    type: 'point',
    point,
    text: typeof point === 'string' ? point : '',
    n: index + 1,
  }))
  const practical = learningLanguage(summary?.courseKind).practical
  if (!practical && mustRemember.length) cards.push({ type: 'recap' })
  if (!practical) terms.forEach(term => cards.push({
    type: 'term',
    term: term.term ?? term.word ?? term.name,
    def: term.def ?? term.definition,
  }))
  learningMistakes
    .filter(mistake => !practical && mistake.wrongChoice)
    .forEach(mistake => cards.push({ type: 'tip', mistake }))
  cards.push({
    type: 'mission',
    practical,
    criteria: buildMissionCriteria(mustRemember, terms, learningMistakes),
  })
  const effectiveAssessment = formativeAssessment || buildAutonomousFormative(summary, questions)
  if (effectiveAssessment?.questions?.length) cards.push({ type: 'formative', assessment: effectiveAssessment })
  cards.push({ type: 'end' })
  return cards
}

function buildMissionCriteria(mustRemember = [], terms = [], mistakes = []) {
  const candidates = [
    ...mustRemember,
    ...terms.map(term => `${term.term ?? term.word ?? term.name ?? ''}: ${term.def ?? term.definition ?? ''}`),
    ...mistakes.map(mistake => mistake.point),
  ]
  return [...new Set(candidates.map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 6)
}

function engagementCopy(courseKind, isListening = false) {
  if (isListening) return {
    first: '음성을 먼저 듣고, 들린 단서만으로 판단하세요.',
    reveal: '들은 단서와 해설을 맞대어 확인하세요.',
    twist: '한 번만 다시 들을 수 있다면 어떤 단서를 먼저 메모할까요?',
  }
  if (courseKind === 'cover-letter') return {
    first: '채용 담당자가 처음 15초만 읽는다고 생각하고 직접 고쳐 쓰세요.',
    reveal: '내 문장 속 실제 근거와 문항 요구가 연결되는지 확인하세요.',
    twist: '지원 기업이 바뀌어도 이 문장을 그대로 제출할 수 있을까요?',
  }
  if (courseKind === 'interview') return {
    first: '모범 답변을 보기 전에 20초 동안 실제로 소리 내어 답해 보세요.',
    reveal: '내 답과 핵심 구조를 비교하고 빠진 행동 근거를 찾으세요.',
    twist: '면접관이 “그래서 본인이 직접 한 일은 무엇인가요?”라고 되묻는다면?',
  }
  if (courseKind === 'personality') return {
    first: '좋아 보이는 답이 아니라 평소 행동과 가까운 쪽을 먼저 고르세요.',
    reveal: '비슷한 상황에서도 같은 기준으로 답할 수 있는지 확인하세요.',
    twist: '친한 사람과 낯선 사람이 함께 있을 때도 같은 선택을 할까요?',
  }
  if (courseKind === 'recruitment') return {
    first: '해설을 보기 전에 제한 시간 안에 조건부터 표시하고 판단하세요.',
    reveal: '정답보다 먼저, 내 판단을 바꾼 결정적 조건을 찾으세요.',
    twist: '풀이 시간이 절반이라면 어떤 조건부터 확인해야 할까요?',
  }
  if (courseKind === 'ncs') return {
    first: '현장 조건을 먼저 읽고 가장 타당한 행동을 예측하세요.',
    reveal: '정답 근거와 함정 선지의 차이를 한 문장으로 설명하세요.',
    twist: '조건 하나가 달라지면 지금 선택도 달라져야 할까요?',
  }
  return {
    first: '설명을 읽기 전에 현장에서 내가 할 행동을 먼저 판단하세요.',
    reveal: '처음 판단과 실제 기준이 어디서 갈렸는지 확인하세요.',
    twist: '현장 조건이 하나 바뀌어도 같은 판단을 유지할 수 있을까요?',
  }
}

function reconsiderFollowUp(choice, topic) {
  const subject = topic || '현재 판단'
  if (choice === '판단 유지') return {
    title: '유지할 근거와 바뀔 경계를 함께 말해 보기',
    actions: [
      `${subject} 판단을 유지하게 하는 화면 속 근거를 하나 고릅니다.`,
      '어떤 정보가 추가되면 판단을 바꿀지도 한 가지 정합니다.',
    ],
    frame: '“나는 ___라는 근거로 판단을 유지한다. 다만 ___라면 판단을 바꾸겠다.”',
  }
  if (choice === '판단 수정') return {
    title: '무엇 때문에 판단이 바뀌었는지 비교하기',
    actions: [
      '처음 판단의 근거와 새로 발견한 조건을 각각 하나 찾습니다.',
      '판단을 바꾼 결정적인 단어나 행동을 정확히 짚습니다.',
    ],
    frame: '“처음에는 ___ 때문에 ___라고 봤지만, ___를 확인해 ___로 바꿨다.”',
  }
  return {
    title: '결정에 필요한 정보를 질문으로 바꾸기',
    actions: [
      '지금 정보만으로 결정할 수 없는 빈칸이 무엇인지 찾습니다.',
      '그 빈칸을 확인할 질문을 한 문장으로 만듭니다.',
    ],
    frame: '“___을 확인할 수 있나요? 그 정보가 ___라면 나는 ___라고 판단하겠다.”',
  }
}

function ExpandableText({ text, style }) {
  return <CompactText text={text} style={style} />
}

function readableScenario(value) {
  return String(value ?? '')
    .replace(/\s*•\s*/g, '\n• ')
    .replace(/([.!?~])(?=[가-힣A-Za-z0-9【[])/g, '$1\n')
    .replace(/,(?=(?:아래|다음|단,|그리고|하지만|반면))/g, ',\n')
    .replace(/\^\^(?=[가-힣A-Za-z])/g, '^^\n')
    .replace(/^\s+|\s+$/g, '')
}

function learningContext(value, isListening = false) {
  const text = readableScenario(value)
  if (isListening) return { kind: 'listening', label: '듣기 전 확인할 질문', text }
  const misread = text.match(/^[“"](.+?)[”"](?:을|를)\s*[“"](.+?)[”"](?:으)?로\s*(?:잘못\s*읽|오해|해석)/)
  if (misread) return {
    kind: 'misread',
    label: '제시문과 오독 비교',
    source: misread[1],
    mistaken: misread[2],
    text,
  }
  if (/(실수|놓침|생략|무작위|잘못|오해|급하게|단정|반복 선택|누르고|고치다가)/.test(text)) {
    return { kind: 'mistake', label: '먼저 바로잡을 실수', text }
  }
  if (/^[“"]/.test(text) || /(문항|문장|표현|안내문|자료|결과)/.test(text)) {
    return { kind: 'prompt', label: '먼저 읽을 제시문', text }
  }
  return { kind: 'scenario', label: '먼저 파악할 상황', text }
}

// learn 텍스트를 줄 단위로 파싱해 구조별 스타일로 렌더링 (📋 헤더, ①②③ 번호목록, 📌💡✅ 등)
function LearnLines({ text }) {
  return (
    <CompactText
      text={text}
      maxItemChars={76}
      style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', color: 'var(--text)' }}
    />
  )
}

function SampleQuestionCard({ sample, example, courseKind, isOpen, selected, onSelect, onChange, onOpen }) {
  const language = learningLanguage(courseKind, !!sample.sourceQuestion?.audioText)
  if (sample.type === 'writing-practice') {
    const answer = typeof selected === 'string' ? selected : ''
    const limit = Number(sample.limit) || 700
    const draftCheck = isOpen ? analyzeWritingDraft(answer, sample) : null
    const statusStyle = {
      met: { label: '확인됨', color: '#047857', background: '#ECFDF5', border: '#A7F3D0' },
      partial: { label: '부분 확인', color: '#A16207', background: '#FFFBEB', border: '#FDE68A' },
      missing: { label: '보완 필요', color: '#BE123C', background: '#FFF1F2', border: '#FECDD3' },
    }
    return (
      <div data-learning-question="writing-practice" className="learning-writing-practice" style={{ marginTop: 10, background: '#F8FAFF', border: '1.5px solid #A5B4FC', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#4338CA', marginBottom: 8 }}>{sample.format || '실전 고쳐쓰기'}</p>
        {sample.context && <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}><b style={{ fontSize: 12, color: '#4338CA' }}>지원 문항</b><p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.7 }}>{sample.context}</p></div>}
        {sample.draft && <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}><b style={{ fontSize: 12, color: '#BE123C' }}>감점 초안</b><p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.7 }}>{sample.draft}</p></div>}
        <p style={{ fontSize: 13.5, fontWeight: 750, lineHeight: 1.65, marginBottom: 8 }}>{sample.stem}</p>
        <label style={{ display: 'block' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, fontSize: 12, fontWeight: 750, color: '#4338CA' }}><span>내 문장</span><span>{[...answer].length}/{limit}자</span></span>
          <textarea value={answer} maxLength={limit} rows={5} onChange={event => onChange(event.target.value)} placeholder="내 경험의 상황·행동·결과가 보이도록 직접 고쳐 씀" style={{ width: '100%', minHeight: 118, resize: 'vertical', border: '1px solid #C7D2FE', borderRadius: 8, padding: '10px 11px', font: 'inherit', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text)', background: '#fff' }} />
        </label>
        {!isOpen && <button type="button" disabled={answer.trim().length < 20} onClick={onOpen} style={{ width: '100%', marginTop: 9, minHeight: 42, border: 0, borderRadius: 8, background: answer.trim().length < 20 ? '#E5E7EB' : '#4F46E5', color: answer.trim().length < 20 ? '#6B7280' : '#fff', fontWeight: 800, cursor: answer.trim().length < 20 ? 'default' : 'pointer' }}>{answer.trim().length < 20 ? '20자 이상 작성하면 내용 점검 가능' : '초안 내용 점검'}</button>}
        {isOpen && <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
          <section data-writing-check-status={draftCheck.status} aria-live="polite" style={{ background: draftCheck.status === 'off-topic' ? '#FFF1F2' : draftCheck.status === 'review-ready' ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${draftCheck.status === 'off-topic' ? '#FECDD3' : draftCheck.status === 'review-ready' ? '#A7F3D0' : '#CBD5E1'}`, borderRadius: 8, padding: '11px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <b style={{ display: 'block', fontSize: 13, color: draftCheck.status === 'off-topic' ? '#BE123C' : draftCheck.status === 'review-ready' ? '#047857' : '#334155' }}>{draftCheck.title}</b>
                <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{draftCheck.description}</p>
              </div>
              <span style={{ flexShrink: 0, borderRadius: 999, padding: '4px 8px', background: '#fff', border: '1px solid #CBD5E1', fontSize: 11.5, fontWeight: 800, color: '#334155' }}>{draftCheck.metCount}/{draftCheck.total} 확인</span>
            </div>
          </section>

          {draftCheck.warnings.length > 0 && <div data-writing-check-warnings style={{ display: 'grid', gap: 6 }}>
            {draftCheck.warnings.map(warning => <div key={warning.id} style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '9px 11px' }}>
              <b style={{ display: 'block', fontSize: 12, color: '#C2410C' }}>{warning.title}</b>
              <p style={{ marginTop: 3, fontSize: 12, lineHeight: 1.6, color: '#7C2D12' }}>{warning.detail}</p>
            </div>)}
          </div>}

          {draftCheck.criteria.length > 0 && <section data-writing-check-criteria style={{ display: 'grid', gap: 7 }}>
            <b style={{ fontSize: 12.5, color: '#334155' }}>문항 필수 요구 점검</b>
            {draftCheck.criteria.map(item => {
              const visual = statusStyle[item.status]
              return <div key={item.label} data-writing-criterion={item.status} style={{ background: visual.background, border: `1px solid ${visual.border}`, borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 12.5, color: '#1E293B' }}>{item.label}</b>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: visual.color }}>{visual.label}</span>
                </div>
                {item.evidence && <p style={{ marginTop: 5, fontSize: 12, lineHeight: 1.6, color: '#334155' }}>입력문 근거: “{item.evidence}”</p>}
                <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: visual.color }}>{item.guidance}</p>
              </div>
            })}
          </section>}

          {sample.structure?.length > 0 && <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '9px 11px' }}>
            <b style={{ fontSize: 12, color: '#4338CA' }}>다시 쓸 순서</b>
            <p style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.65 }}>{sample.structure.join(' → ')}</p>
          </div>}
          {sample.modelAnswer && <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}><b style={{ fontSize: 12, color: '#B45309' }}>구조 참고 예시 · 내 문장 판정 아님</b><p style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.75 }}>{sample.modelAnswer}</p></div>}
          <p style={{ fontSize: 11.5, lineHeight: 1.65, color: 'var(--text-muted)' }}>자동 점검은 입력문에 드러난 표현과 근거 단서를 확인하는 초안 보조 기능입니다. 경험의 사실 여부와 지원처 적합성은 본인과 교사가 최종 확인해야 합니다.</p>
        </div>}
      </div>
    )
  }
  if (sample.type === 'reflection') {
    return (
      <div data-learning-question="reflection" className="learning-reflection-card">
        <p className="learning-reflection-label">{sample.label || '응답 기준 성찰 · 정답 없음'}</p>
        {sample.context && <p className="learning-reflection-context">{sample.context}</p>}
        <p className="learning-reflection-stem">{sample.stem}</p>
        <div className="learning-reflection-choices">
          {(sample.choices || []).map(choice => (
            <button key={choice.value} type="button" className={selected === choice.value ? 'is-selected' : ''} onClick={() => onSelect(choice.value)}>
              <span>{choice.value}</span>{choice.text}
            </button>
          ))}
        </div>
        {isOpen ? (
          <div className="learning-reflection-feedback">
            <b>선택 뒤 확인할 기준</b>
            <CompactText text={sample.feedback || sample.explanation} maxItemChars={72} />
            {sample.thinkingSteps?.length > 0 && <ol>{sample.thinkingSteps.map(step => <li key={step}>{step}</li>)}</ol>}
          </div>
        ) : <p className="learning-reflection-help">내 기준과 가까운 문장 선택 → 성찰 포인트 확인</p>}
      </div>
    )
  }
  if (sample.isInterview) {
    return isOpen ? (
      <div data-learning-question="interview" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>{sample.format || '면접 질문형'}</p>
        <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 600, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
        <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--success)' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 5 }}>
            {sample.modelAnswer ? '모범 답변 핵심' : '직접 답해 볼 차례'}
          </p>
          {sample.modelAnswer ? (
            <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 13.5px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: '#1b5e20' }}>{sample.modelAnswer}</p>
          ) : (
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#1b5e20' }}>읽는 순서로 답의 뼈대 구성 · 자신의 경험과 행동 추가</p>
          )}
          {sample.answerPoints?.length > 0 && <ul className="learning-answer-points">{sample.answerPoints.map((point, index) => <li key={index}>{point}</li>)}</ul>}
        </div>
      </div>
    ) : (
      <button onClick={onOpen} style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
        20초 동안 먼저 답한 뒤 핵심 보기
      </button>
    )
  }

  if (sample.type === 'pulldown') {
    const blanks = sample.blanks || sample.sourceQuestion?.blanks || []
    const filled = Object.values(selected || {}).filter(value => value != null).length
    return (
      <div data-learning-question="pulldown" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>{language.practiceLabel} · 풀다운형</p>
        {sample.context && <p style={{ fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{sample.context}</p>}
        <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 700, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
        <PulldownForm q={sample.sourceQuestion || sample} checked={isOpen} value={selected} onChange={onChange} />
        {!isOpen && (
          <button type="button" disabled={filled < blanks.length} onClick={onOpen} style={{ width: '100%', padding: '10px', borderRadius: 8, border: 0, background: filled < blanks.length ? '#E5E7EB' : '#4F46E5', color: filled < blanks.length ? '#6B7280' : '#fff', fontWeight: 800, cursor: filled < blanks.length ? 'default' : 'pointer' }}>
            {filled < blanks.length ? `빈칸 채우기 ${filled}/${blanks.length}` : '정답·근거 확인'}
          </button>
        )}
        {isOpen && sample.explanation && <div className="learning-evidence"><p className="learning-block-label">정답 근거</p><ExpandableText text={sample.explanation} style={{ fontSize: 12.5, lineHeight: 1.72 }} /></div>}
      </div>
    )
  }

  const answers = new Set(Array.isArray(sample.answer) ? sample.answer : [sample.answer])
  return (
    <div data-learning-question="choice" style={{ marginTop: 10, background: '#FFFDE7', border: '1.5px solid #FFE082', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 8 }}>{language.practiceLabel} · {sample.format || '선택형'}</p>
      {sample.context && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d7f5', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#3b5bdb', marginBottom: 5 }}>지문 / 상황</p>
          <p style={{ fontSize: 'clamp(12px, 3.5vw, 13px)', lineHeight: 1.85, whiteSpace: 'pre-wrap', color: '#1a237e' }}>{sample.context}</p>
        </div>
      )}
      <p style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', fontWeight: 700, lineHeight: 1.75, color: 'var(--text)', marginBottom: 10 }}>{sample.stem}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(sample.choices || []).map(choice => {
          const isCorrect = answers.has(choice.value)
          const isSelected = selected === choice.value
          const resultColor = isCorrect ? '#15803D' : '#B91C1C'
          return (
            <button
              type="button"
              data-learning-choice={choice.value}
              data-correct={isOpen ? String(isCorrect) : undefined}
              key={choice.value}
              onClick={() => onSelect(choice.value)}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                background: isOpen && isCorrect ? '#E8F5E9' : isOpen && isSelected ? '#FEF2F2' : '#fff',
                border: isOpen && (isCorrect || isSelected) ? `1.5px solid ${resultColor}` : isSelected ? '1.5px solid #4F46E5' : '1px solid var(--border)',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 13, color: isOpen && (isCorrect || isSelected) ? resultColor : 'var(--text-muted)', flexShrink: 0, minWidth: 18 }}>{choice.value}</span>
              <span style={{ fontSize: 'clamp(12.5px, 3.7vw, 13.5px)', lineHeight: 1.65, color: 'var(--text)', fontWeight: isOpen && isCorrect ? 700 : 500, flex: 1 }}>{choice.text}</span>
              {isOpen && isCorrect && <span aria-label="정답" style={{ flexShrink: 0, fontSize: 13, color: '#15803D', fontWeight: 800 }}>정답</span>}
              {isOpen && isSelected && !isCorrect && <span aria-label="내 선택" style={{ flexShrink: 0, fontSize: 13, color: '#B91C1C', fontWeight: 800 }}>내 선택</span>}
            </button>
          )
        })}
      </div>
      {!isOpen && <p data-learning-answer-state="hidden" style={{ margin: '8px 0 0', fontSize: 12, color: '#92400E', fontWeight: 700 }}>선지 선택 → 정답·근거 확인</p>}
      {isOpen && (
        <div data-learning-answer-state="revealed">
          {example && <div style={{ marginTop: 10, borderTop: '1px solid #FFE082', paddingTop: 8 }}><p style={{ fontSize: 12, color: '#B45309', fontWeight: 700, marginBottom: 4 }}>출제 포인트</p><CompactText text={example} maxItemChars={70} style={{ fontSize: 12, color: 'var(--text-muted)' }} /></div>}
          {sample.thinkingSteps?.length > 0 && <div className="learning-reasoning"><p className="learning-block-label">문제를 읽는 순서</p><ol>{sample.thinkingSteps.map((step, index) => <li key={index}>{step}</li>)}</ol></div>}
          {sample.explanation && <div className="learning-evidence"><p className="learning-block-label">정답 근거</p><ExpandableText text={sample.explanation} style={{ fontSize: 12.5, lineHeight: 1.72 }} /></div>}
        </div>
      )}
    </div>
  )
}

function FormativeAssessmentCard({ assessment, answers, checked, onSelect, onCheck }) {
  const questions = assessment?.questions || []
  const complete = questions.length > 0 && questions.every((_, index) => checked[index])
  const score = questions.reduce((sum, question, index) => sum + (checked[index] && answers[index] === question.answer ? 1 : 0), 0)

  return (
    <section className="learning-formative" data-learning-card="formative-assessment">
      <header>
        <span>학습 마무리 · 3문항</span>
        <h3>{assessment.title}</h3>
        <p>{assessment.objective}</p>
      </header>
      <div className="learning-formative-guide">
        <b>1·2번</b><span>오늘 배운 기준 확인</span><b>3번</b><span>처음 보는 상황에 적용</span>
      </div>
      <ol>
        {questions.map((question, index) => {
          const selected = answers[index]
          const isChecked = Boolean(checked[index])
          const isCorrect = isChecked && selected === question.answer
          return (
            <li key={`${index}:${question.stem}`} className={question.kind === 'transfer' ? 'is-transfer' : ''}>
              <header>
                <span>{index + 1}</span>
                <div><b>{question.kind === 'transfer' ? '새 상황 변형' : '학습 내용 확인'}</b><p>{question.stem}</p></div>
              </header>
              <div className="learning-formative-choices">
                {question.choices.map((option, optionIndex) => {
                  const selectedOption = selected === optionIndex
                  const correctOption = isChecked && optionIndex === question.answer
                  const wrongOption = isChecked && selectedOption && !correctOption
                  return (
                    <button
                      type="button"
                      key={option}
                      disabled={isChecked}
                      className={`${selectedOption ? 'is-selected' : ''} ${correctOption ? 'is-correct' : ''} ${wrongOption ? 'is-wrong' : ''}`}
                      onClick={() => onSelect(index, optionIndex)}
                    >
                      <span>{optionIndex + 1}</span><p>{option}</p>{correctOption && <b>정답</b>}
                    </button>
                  )
                })}
              </div>
              {!isChecked ? (
                <button type="button" className="learning-formative-check" disabled={!Number.isInteger(selected)} onClick={() => onCheck(index)}>
                  {Number.isInteger(selected) ? '정답·해설 확인' : '답을 먼저 선택해 주세요'}
                </button>
              ) : (
                <div className={`learning-formative-explanation ${isCorrect ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
                  <b>{isCorrect ? '정확히 이해했어요' : `정답은 ${question.answer + 1}번입니다`}</b>
                  <p>{question.explanation}</p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {complete && (
        <footer role="status">
          <span>형성평가 완료</span><b>{score}/{questions.length}</b>
          <p>{score === questions.length ? '세 기준을 모두 이해했습니다. 학습 정리에서 오늘의 행동 원칙을 확인하세요.' : '틀린 문항의 해설에서 놓친 조건을 확인한 뒤 학습 정리로 이동하세요.'}</p>
        </footer>
      )}
    </section>
  )
}

export default function StudySummary({ summary, questions = EMPTY_QUESTIONS, formativeAssessment = null, onStartQuiz, introStartLabel = '학습 시작 →', startQuizLabel = null, initialStep = 0, initialInteraction = null, onStepChange, onInteractionChange }) {
  const { title, intro, keyPoints = [], mustRemember = [], terms = [], tips = [] } = summary || {}
  const learningPoints = useMemo(() => buildLearningPoints(summary, questions), [summary, questions])
  const learningMistakes = useMemo(() => buildLearningMistakes(summary, questions), [summary, questions])
  const introVisual = useMemo(() => learningVisualFor(`${title ?? ''} ${intro ?? ''}`, summary?.courseKind), [title, intro, summary?.courseKind])
  const listeningQuestionCount = questions.filter(question => !!question?.audioText).length
  const isListeningLesson = listeningQuestionCount > 0 && listeningQuestionCount === questions.length
  const language = learningLanguage(summary?.courseKind, isListeningLesson)
  const effectiveFormative = useMemo(
    () => formativeAssessment || buildAutonomousFormative(summary, questions),
    [formativeAssessment, questions, summary],
  )

  // 학생 화면과 교사용 현재 단계 지원이 같은 카드 순서를 공유함.
  const cards = useMemo(
    () => buildStudySummaryCards(summary, questions, learningPoints, learningMistakes, effectiveFormative),
    [summary, questions, learningPoints, learningMistakes, effectiveFormative],
  )

  const [step, setStep]         = useState(initialStep)
  const restoreInteraction = initialInteraction?.step === initialStep ? initialInteraction : null
  const [revealed, setRevealed] = useState(() => restoreInteraction?.revealed ? { [initialStep]: true } : {})  // stepIndex → true
  const [sampleSelections, setSampleSelections] = useState({})
  const [reconsidered, setReconsidered] = useState(() => restoreInteraction?.reconsidered ? { [initialStep]: restoreInteraction.reconsidered } : {})
  const [mission, setMission] = useState({ criterion: '', action: '', confirmed: false })
  const [formativeAnswers, setFormativeAnswers] = useState({})
  const [formativeChecked, setFormativeChecked] = useState({})
  const [known, setKnown]       = useState({})   // 용어 자기평가

  // 단원이 바뀌면 처음부터
  useEffect(() => {
    setStep(initialStep)
    const restored = initialInteraction?.step === initialStep ? initialInteraction : null
    setRevealed(restored?.revealed ? { [initialStep]: true } : {})
    setSampleSelections({})
    setReconsidered(restored?.reconsidered ? { [initialStep]: restored.reconsidered } : {})
    setMission({ criterion: '', action: '', confirmed: false })
    setFormativeAnswers({})
    setFormativeChecked({})
    setKnown({})
  }, [summary, questions, initialInteraction]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  useEffect(() => {
    if (!onInteractionChange) return
    const activeCard = cards[step]
    const point = activeCard?.type === 'point' && typeof activeCard.point === 'object'
      ? activeCard.point
      : null
    const sourceQuestion = point && typeof point.sampleQuestion === 'object'
      ? point.sampleQuestion.sourceQuestion
      : null
    const beat = point ? engagementCopy(summary?.courseKind, Boolean(sourceQuestion?.audioText)) : null
    onInteractionChange({
      step,
      cardType: activeCard?.type || '',
      revealed: Boolean(revealed[step]),
      reconsidered: reconsidered[step] || '',
      topic: point?.topic || '',
      situation: point?.situation || '',
      evidence: point?.learn || '',
      firstPrompt: beat?.first || '',
      twist: beat?.twist || '',
    })
  }, [cards, onInteractionChange, reconsidered, revealed, step, summary?.courseKind])

  if (!summary || cards.length === 0) return null

  const card    = cards[step]
  const isOpen  = !!revealed[step]
  const open    = () => setRevealed(r => ({ ...r, [step]: true }))
  const selectSample = value => {
    setSampleSelections(current => ({ ...current, [step]: value }))
    open()
  }
  const total   = cards.length
  const next    = () => setStep(s => Math.min(total - 1, s + 1))
  const prev    = () => setStep(s => Math.max(0, s - 1))
  const restart = () => {
    setStep(0)
    setRevealed({})
    setSampleSelections({})
    setReconsidered({})
    setMission({ criterion: '', action: '', confirmed: false })
    setFormativeAnswers({})
    setFormativeChecked({})
    setKnown({})
  }
  const pointRequiresResponse = card.type === 'point'
    && typeof card.point === 'object'
    && Boolean(card.point?.sampleQuestion || card.point?.example)
  const formativeComplete = card.type === 'formative'
    && card.assessment.questions.every((_, index) => formativeChecked[index])
  const canContinue = card.type === 'mission'
    ? mission.confirmed
    : card.type === 'formative'
      ? formativeComplete
      : !pointRequiresResponse || isOpen

  // 핵심 포인트: '— 확인:' / '(확인:' 뒤(또는 두 번째 문장)를 가렸다 공개
  function splitPoint(text) {
    let m = text.match(/^(.*?)\s*[—(]\s*확인\s*[:：]\s*(.+?)\)?$/)
    if (m && m[1].trim().length > 6) return { head: m[1].trim(), tail: m[2].trim(), label: '확인할 것' }
    m = text.match(/^(.+?[.。])\s+(.+)$/)
    if (m && m[1].length > 10 && m[2].length > 6) return { head: m[1].trim(), tail: m[2].trim(), label: '이어서' }
    return { head: text, tail: '', label: '' }
  }

  return (
    <div className="study-summary">
      {/* 지금 학습 중인 단원 제목 (항상 표시 — 무엇을 공부하는지 명확히) */}
      {card.type !== 'intro' && (
        <p className="study-summary-unit-title" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
          <span style={{ flexShrink: 0 }}>📖</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </p>
      )}

      {/* 진행바 */}
      <div className="study-summary-progress" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${total > 1 ? (step + 1) / total * 100 : 100}%`, background: 'var(--primary)', borderRadius: 999, transition: 'width 0.25s' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{step + 1}/{total}</span>
      </div>

      <div className="study-summary-content" style={{ flex: 1 }}>
        {/* ── 도입 ── */}
        {card.type === 'intro' && (
          <div className="study-summary-intro" style={{ padding: '4px 0 8px' }}>
            <div className="study-summary-intro-title" style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 'clamp(15px, 4.5vw, 18px)', fontWeight: 800, lineHeight: 1.4, marginBottom: 6 }}>{title}</h2>
            </div>
            <div className="study-summary-intro-grid">
              <div className="study-summary-intro-visual">
                {summary.courseKind && (
                  <div className={`learning-course learning-course-${summary.courseKind}`}>
                    <span>{{
                      'education-certification': '교육부·대한상공회의소 인증',
                      ncs: '고용노동부·한국산업인력공단 NCS',
                      recruitment: '채용필기 심화·확장',
                      interview: '고졸 공정채용 면접',
                      personality: '정답 없는 인성검사',
                      'cover-letter': '고졸 공채 자기소개서',
                    }[summary.courseKind] || '자율학습'}</span>
                    <strong>{summary.courseKind === 'personality' ? '검사 이해 · 응답 성찰 · 실전 적응' : language.introMode}</strong>
                  </div>
                )}
                <figure className="learning-scene learning-scene-intro">
                  <img src={introVisual.src} alt={introVisual.alt} />
                  <figcaption>{language.introCaption}</figcaption>
                </figure>
              </div>
              <div className="study-summary-intro-copy">
                {intro && (
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>📌 이 단원에서 배우는 것</p>
                    <CompactText text={intro} maxItemChars={76} style={{ fontSize: 'clamp(13px, 3.85vw, 14.5px)', color: 'var(--text)' }} />
                  </div>
                )}
                <p className="study-summary-count" style={{ fontSize: 12, color: 'var(--primary)', marginTop: 14, fontWeight: 700, textAlign: 'center' }}>
                  핵심 {keyPoints.length}개 · {language.countLabel} {terms.length}개 — 한 장씩 넘기며 확인해요
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 핵심 포인트 (가렸다 공개) ── */}
        {card.type === 'point' && typeof card.point === 'object' && card.point ? (() => {
          const p = card.point
          const isMem = p.mode === '암기'
          const sourceQuestion = typeof p.sampleQuestion === 'object' ? p.sampleQuestion.sourceQuestion : null
          const isListeningPoint = !!sourceQuestion?.audioText
          const context = learningContext(p.situation, isListeningPoint)
          const beat = engagementCopy(summary.courseKind, isListeningPoint)
          const hasPrompt = Boolean(p.sampleQuestion || p.example)
          const showEvidence = isOpen || !hasPrompt
          const selectedReconsider = reconsidered[step]
          const followUp = selectedReconsider ? reconsiderFollowUp(selectedReconsider, p.topic) : null
          return (
            <div className="card study-summary-point" style={{ borderLeft: `4px solid ${isMem ? '#E65100' : 'var(--primary)'}`, padding: '14px 14px 12px' }}>
              {/* 헤더: 핵심 번호 + 모드 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>핵심 {card.n}</span>
                {p.mode && (
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: isMem ? '#FFF3E0' : '#E8EAF6', color: isMem ? '#E65100' : '#3949AB' }}>
                    {isMem ? `🧠 ${language.memoryLabel}` : `💡 ${language.understandLabel}`}
                  </span>
                )}
              </div>

              <div className="study-summary-point-grid">
                <div className="study-summary-point-context">
                  {isListeningPoint && (
                    <div className="learning-primary-media">
                      <p className="learning-block-label">먼저 듣고 상황 파악하기</p>
                      <ListeningPrompt q={sourceQuestion} mode="study" revealTranscript={showEvidence} />
                    </div>
                  )}

                  {sourceQuestion?.visual && (
                    <div className="learning-primary-media">
                      <p className="learning-block-label">먼저 자료 살펴보기</p>
                      <QuestionMedia q={sourceQuestion} />
                    </div>
                  )}

                  {p.visual && !sourceQuestion?.visual && (
                    <figure className="learning-scene">
                      <img src={p.visual.src} alt={p.visual.alt} />
                      <figcaption>이 장면에서 어떤 정보와 판단이 필요할까요?</figcaption>
                    </figure>
                  )}

                  {p.situation && (
                    <div className="learning-situation" data-learning-context={context.kind}>
                      <p className="learning-block-label">{context.label}</p>
                      {context.kind === 'misread' ? (
                        <div className="learning-context-compare">
                          <p><b>제시문</b><span>“{context.source}”</span></p>
                          <p><b>잘못 읽은 뜻</b><span>“{context.mistaken}”</span></p>
                          <small>두 문장의 행동 방향이 어떻게 달라지는지 먼저 말해 보세요.</small>
                        </div>
                      ) : (
                        <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
                          {context.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="study-summary-point-learning">
                  {/* 수행 목표: 지금 이것을 할 수 있어야 합니다 */}
                  {p.topic && (
                    <div style={{ background: isMem ? '#FFF3E0' : '#EEF2FF', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: isMem ? '#C05300' : '#4338CA', marginBottom: 3 }}>
                        {language.pointLabel}
                      </p>
                      <p style={{ fontSize: 'clamp(13px, 3.9vw, 15px)', fontWeight: 700, lineHeight: 1.5, color: isMem ? '#7C2D12' : '#1E1B4B' }}>
                        {p.topic}
                      </p>
                    </div>
                  )}

                  {hasPrompt && <div className="learning-first-judgment" data-engagement-phase="first-judgment">
                    <b>먼저 내 판단</b>
                    <p>{beat.first}</p>
                  </div>}

              {/* 외부평가 출제 예시: sampleQuestion(object/string) 또는 example(string) */}
              {p.sampleQuestion ? (
                typeof p.sampleQuestion === 'object' ? (
                  <SampleQuestionCard
                    sample={p.sampleQuestion}
                    example={p.example}
                    courseKind={summary.courseKind}
                    isOpen={isOpen}
                    selected={sampleSelections[step]}
                    onSelect={selectSample}
                    onChange={value => setSampleSelections(current => ({ ...current, [step]: value }))}
                    onOpen={open}
                  />
                ) : (
                  // 구 포맷: sampleQuestion이 string — 텍스트로 그대로 표시
                  isOpen ? (
                    <div style={{ marginTop: 10, background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 10, padding: '11px 13px' }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>📝 {language.revealedLabel}</p>
                    <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.sampleQuestion}</p>
                    </div>
                  ) : (
                    <button onClick={open}
                      style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                        border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309',
                        fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                      📝 {language.revealLabel}
                    </button>
                  )
                )
              ) : p.example ? (
                isOpen ? (
                  <div style={{ marginTop: 10, background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 10, padding: '11px 13px' }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>📝 {language.revealedLabel}</p>
                    <p style={{ fontSize: 'clamp(12.5px, 3.7vw, 14px)', lineHeight: 1.72, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.example}</p>
                  </div>
                ) : (
                  <button onClick={open}
                    style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                      border: '1.5px dashed #D97706', background: 'transparent', color: '#B45309',
                      fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    📝 {language.revealLabel}
                  </button>
                )
                  ) : null}

                  {showEvidence && (
                    <div className="learning-reveal-panel" data-engagement-phase="evidence-reveal" aria-live="polite">
                      <div>
                        <b>근거 공개</b>
                        <p>{beat.reveal}</p>
                      </div>
                      {p.learn && (
                        <section>
                          <p className="learning-block-label">{language.learnLabel}</p>
                          <LearnLines text={p.learn} />
                        </section>
                      )}
                      <section className="learning-reconsider">
                        <b>조건이 바뀌면?</b>
                        <p>{beat.twist}</p>
                        <div>
                          {['판단 유지', '판단 수정', '정보 더 필요'].map(value => (
                            <button
                              type="button"
                              key={value}
                              className={reconsidered[step] === value ? 'is-selected' : ''}
                              onClick={() => setReconsidered(current => ({ ...current, [step]: value }))}
                            >{value}</button>
                          ))}
                        </div>
                        {selectedReconsider && (
                          <small>{{
                            '판단 유지': '좋아요. 새 조건에도 판단을 유지할 결정적 근거 한 가지를 화면에서 짚어 보세요.',
                            '판단 수정': '좋아요. 판단을 바꾸게 만든 단어나 조건을 정확히 짚어 보세요.',
                            '정보 더 필요': '좋아요. 결정하려면 어떤 정보가 더 필요한지 질문 한 문장으로 만들어 보세요.',
                          }[selectedReconsider]}</small>
                        )}
                        {followUp && (
                          <div className="learning-reconsider-followup" aria-live="polite">
                            <span>선택 후 한 단계 더 · {selectedReconsider}</span>
                            <strong>{followUp.title}</strong>
                            <ol>{followUp.actions.map(action => <li key={action}>{action}</li>)}</ol>
                            <blockquote><b>말하기 틀</b><p>{followUp.frame}</p></blockquote>
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })() : card.type === 'point' && (() => {
          const { head, tail, label } = splitPoint(card.text)
          return (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>✅ 핵심 {card.n}</p>
              <CompactText text={head} maxItemChars={72} style={{ fontSize: 'clamp(13.5px, 4.05vw, 16px)', fontWeight: 600 }} />
              {tail && (
                isOpen ? (
                  <div style={{ marginTop: 12, background: 'var(--primary-light)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{label}</p>
                    <CompactText text={tail} maxItemChars={72} style={{ fontSize: 'clamp(13px, 3.85vw, 15px)', color: 'var(--text)' }} />
                  </div>
                ) : (
                  <button onClick={open}
                    style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px dashed var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    👆 먼저 떠올려본 뒤, 탭하여 「{label}」 확인
                  </button>
                )
              )}
            </div>
          )
        })()}

        {/* ── 꼭 기억할 것 ── */}
        {card.type === 'recap' && (
          <div className="card" style={{ background: '#FFF8E1', border: '1px solid #F9A825' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#E65100', marginBottom: 12 }}>📌 꼭 기억할 것</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {mustRemember.map((m, i) => (
                <li key={i} style={{ fontSize: 'clamp(13px, 3.85vw, 15px)', fontWeight: 600, color: '#7a4a00', lineHeight: 1.75 }}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 용어 플래시카드 (뜻 → 용어 역방향) ──
            뜻(핵심 내용)을 항상 노출해 콘텐츠 접촉을 보장하고, 정답(용어)은 짧은 단어라
            자가 채점이 명확하다. 생성 인출로 용어 정착을 강화한다. */}
        {card.type === 'term' && (
          <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            {language.practical ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 10 }}>{language.toolLabel}</p>
                <div style={{ background: '#E8F5E9', borderRadius: 10, padding: '12px 14px', border: '1.5px solid var(--success)' }}>
                  <p style={{ fontSize: 'clamp(16px, 4.8vw, 19px)', fontWeight: 800, lineHeight: 1.4, color: '#1b5e20', marginBottom: 7 }}>{card.term}</p>
                  <CompactText text={card.def} maxItemChars={72} style={{ fontSize: 'clamp(13px, 3.8vw, 14.5px)', color: 'var(--text)' }} />
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>용어 암기 없음 · 실제 작성과 답변에서 바로 적용</p>
              </>
            ) : <>
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 12, textAlign: 'center' }}>🧩 설명을 읽고 용어를 떠올려보세요</p>
              {/* 뜻(프롬프트) — 항상 표시 */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <CompactText text={card.def} maxItemChars={72} style={{ fontSize: 'clamp(14px, 4vw, 16px)', color: 'var(--text)' }} />
              </div>
              {isOpen ? (
              <>
                {/* 정답 용어 공개 */}
                <div style={{ marginTop: 12, background: '#E8F5E9', borderRadius: 10, padding: '12px 14px', border: '1.5px solid var(--success)', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>✅ 정답 용어</p>
                  <p style={{ fontSize: 'clamp(18px, 5.4vw, 22px)', fontWeight: 800, lineHeight: 1.35, color: '#1b5e20' }}>{card.term}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setKnown(k => ({ ...k, [step]: 'again' })); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: known[step] === 'again' ? '#fee2e2' : 'var(--card)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    🔁 다시 볼래요
                  </button>
                  <button onClick={() => { setKnown(k => ({ ...k, [step]: 'known' })); next() }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    ✓ 맞혔어요
                  </button>
                </div>
              </>
              ) : (
              <button onClick={open}
                style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 10, border: '1.5px dashed var(--success)', background: 'transparent', color: 'var(--success)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                ✅ 정답 용어 보기
              </button>
              )}
            </>}
          </div>
        )}

        {/* ── 자주 틀리는 점 ── */}
        {card.type === 'tip' && (() => {
          const mistake = card.mistake || {}
          if (!mistake.wrongChoice) return (
            <div className="card learning-mistake-card">
              <p className="learning-mistake-title">자주 틀리는 점</p>
              <CompactText className="learning-mistake-point" text={mistake.point} />
            </div>
          )
          return (
            <div className="card learning-mistake-card">
              <p className="learning-mistake-title">실제 오답으로 고쳐 보기</p>
              {mistake.stem && <p className="learning-mistake-stem">{mistake.stem}</p>}
              <div className="learning-wrong-choice">
                <span>{mistake.wrongChoice.label}</span>
                <p>{mistake.wrongChoice.text}</p>
              </div>
              <div className="learning-mistake-analysis">
                <strong>왜 틀리나</strong>
                <CompactText text={`${mistake.trap || ''}\n${mistake.whyWrong || ''}`} maxItemChars={72} />
              </div>
              {mistake.correctChoice?.length > 0 && (
                <div className="learning-correct-choice">
                  <strong>바르게 고치기</strong>
                  {mistake.correctChoice.map(choice => (
                    <p key={choice.label}><span>{choice.label}</span>{choice.text}</p>
                  ))}
                </div>
              )}
              <div className="learning-mistake-point">
                <strong>다음부터 확인할 것</strong>
                <CompactText text={mistake.point} maxItemChars={72} />
              </div>
              {mistake.checklist?.length > 0 && (
                <ol className="learning-mistake-checklist">
                  {mistake.checklist.map((item, index) => <li key={index}>{item}</li>)}
                </ol>
              )}
            </div>
          )
        })()}

        {card.type === 'mission' && (() => {
          const criteria = card.criteria?.length
            ? card.criteria
            : ['문항의 조건을 먼저 확인하기', '내 판단의 근거를 한 문장으로 설명하기', '적용 전에 빠진 정보를 다시 확인하기']
          const actionReady = !card.practical || mission.action.trim().length >= 10
          return (
            <section className="learning-exit-mission" data-learning-card="active-exit">
              <header>
                <span>마지막 1분</span>
                <h3>{card.practical ? '내 답변을 실제 제출 수준으로 바꾸기' : '다음 문제에서 바꿀 행동 정하기'}</h3>
                <p>{card.practical
                  ? '읽고 끝내지 말고, 지금 가장 먼저 고칠 기준과 실제 수정 내용을 남기세요.'
                  : '오늘 배운 것 중 다음 문제에서 가장 먼저 실행할 기준 하나를 고르세요.'}</p>
              </header>
              <div className="learning-exit-grid">
                <div>
                  <b>1. 가장 먼저 확인할 기준</b>
                  <div className="learning-exit-criteria">
                    {criteria.map((criterion, index) => (
                      <button
                        type="button"
                        key={criterion}
                        className={mission.criterion === criterion ? 'is-selected' : ''}
                        onClick={() => setMission(current => ({ ...current, criterion, confirmed: false }))}
                      >
                        <span>{index + 1}</span>
                        <CompactText text={criterion} maxItemChars={70} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  {card.practical ? (
                    <label className="learning-exit-action">
                      <b>2. 실제로 바꿀 문장 또는 답변 행동</b>
                      <textarea
                        rows={5}
                        value={mission.action}
                        onChange={event => setMission(current => ({ ...current, action: event.target.value, confirmed: false }))}
                        placeholder={summary.courseKind === 'interview'
                          ? '예: 결론 뒤에 내가 직접 한 행동과 확인 가능한 결과를 한 문장씩 덧붙인다.'
                          : '예: 추상적인 장점 문장을 지우고, 내가 맡은 행동과 수치 결과로 다시 쓴다.'}
                      />
                      <small>{[...mission.action].length}자 · 10자 이상</small>
                    </label>
                  ) : (
                    <div className="learning-exit-action is-quick">
                      <b>2. 다음 문제에서 실행</b>
                      <p>선택한 기준을 다음 문항에서 가장 먼저 적용합니다. 친구에게 이유를 한 문장으로 설명할 수 있으면 준비 완료입니다.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="learning-exit-confirm"
                    disabled={!mission.criterion || !actionReady}
                    onClick={() => setMission(current => ({ ...current, confirmed: true }))}
                  >내 실전 행동 확정</button>
                  {mission.confirmed && (
                    <div className="learning-exit-result" role="status">
                      <b>확정됨</b>
                      <p>{mission.criterion}</p>
                      {mission.action && <small>{mission.action}</small>}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        })()}

        {card.type === 'formative' && (
          <FormativeAssessmentCard
            assessment={card.assessment}
            answers={formativeAnswers}
            checked={formativeChecked}
            onSelect={(questionIndex, optionIndex) => setFormativeAnswers(current => ({ ...current, [questionIndex]: optionIndex }))}
            onCheck={questionIndex => setFormativeChecked(current => ({ ...current, [questionIndex]: true }))}
          />
        )}

        {/* ── 마무리 ── */}
        {card.type === 'end' && (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <p style={{ fontSize: 12, color: 'var(--success)', fontWeight: 900, marginBottom: 8 }}>학습에서 실제 행동까지 완료</p>
            <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>오늘 학습 정리</p>
            {effectiveFormative && (
              <section className="learning-lesson-summary">
                <header><span>형성평가</span><b>{effectiveFormative.questions.reduce((sum, question, index) => sum + (formativeChecked[index] && formativeAnswers[index] === question.answer ? 1 : 0), 0)}/{effectiveFormative.questions.length}</b></header>
                <h3>오늘 꼭 기억할 3가지</h3>
                <ol>{effectiveFormative.takeaways.map(item => <li key={item}>{item}</li>)}</ol>
              </section>
            )}
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18, textAlign: 'left' }}>
              <CompactText text={`핵심 ${keyPoints.length}개에서 먼저 판단함\n근거 공개 뒤 조건을 바꾸어 다시 생각함\n실전 행동: ${mission.criterion || '다음 문제에서 기준 적용'}`} />
            </div>
            {onStartQuiz && (
              <button className="btn btn-primary btn-full" style={{ marginBottom: 8 }} onClick={onStartQuiz}>
                {startQuizLabel || (language.practical ? '실전 작성·답변으로 적용 →' : '도움 없이 문제에 적용 →')}
              </button>
            )}
            <button className="btn btn-ghost btn-full" onClick={restart}>처음부터 다시 보기</button>
          </div>
        )}
      </div>

      {/* ── 이전/다음 ── */}
      {card.type !== 'end' && (
        <div className="study-summary-navigation" style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {step > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={prev}>← 이전</button>
          )}
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={next} disabled={!canContinue}>
            {card.type === 'intro'
                ? introStartLabel
                : !canContinue
                ? card.type === 'mission' ? '실전 행동을 확정해 주세요' : card.type === 'formative' ? '3문제 해설까지 확인해 주세요' : '먼저 판단해 주세요'
                : card.type === 'formative' ? '학습 정리 보기 →' : '다음 →'}
          </button>
        </div>
      )}
    </div>
  )
}
