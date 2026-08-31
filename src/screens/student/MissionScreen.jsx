import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { recordActivity } from '../../lib/activity.js'
import { addXp }          from '../../lib/xp.js'
import { formatDuration } from '../../lib/dateUtils.js'
import jobQuestions         from '../../../data/questions.json'
import { ncs2026Questions as ncsQuestions } from '../../lib/ncs2026.js'
import { recruitWrittenQuestions } from '../../lib/recruitWritten.js'
import { INTERVIEW_QUESTIONS, PERSONALITY_QUESTIONS } from '../../lib/guidedSubjectContent.js'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../../lib/coverAssessmentBank.js'
import foodServiceQuestions from '../../lib/foodServiceBank.js'
import { englishStudyQuestions, jobCommonMediaQuestions } from '../../lib/jobCommonAreas.js'
import ListeningPrompt from './ListeningPrompt.jsx'
import QuestionMedia from './QuestionMedia.jsx'
import DifficultyBadge from './DifficultyBadge.jsx'
import QuestionPriorityBadge from './QuestionPriorityBadge.jsx'
import CompactText from '../../components/CompactText.jsx'
import { popBack, pushBack, triggerBack } from '../../lib/backButton.js'

// 직업공통 풀 = 기존 문항 + 영어 + 2026 듣기·시각자료 보완 문항
const QUESTION_POOLS = {
  'job-common':    [...jobQuestions, ...englishStudyQuestions, ...jobCommonMediaQuestions],
  'ncs-basic':     ncsQuestions,
  'recruit-written': recruitWrittenQuestions,
  'interview':       INTERVIEW_QUESTIONS,
  'personality':     PERSONALITY_QUESTIONS,
  'cover-letter':    COVER_DIAGNOSTIC_QUESTIONS,
  'food-service':  foodServiceQuestions,
}

import { answerIdxOf, isOXQuestion, withExtractedChoices, isMultiQuestion, answerSetOf, gradeMulti } from '../../lib/questionNorm.js'
import { recordReview } from '../../lib/srs.js'
import { learningModeOf } from '../../lib/learningMode.js'
import ExamTools from './ExamTools.jsx'
// (구) answerIdx(letter)는 O/X 정답('O'→14)을 오변환해 전면 오채점 유발 — answerIdxOf(q)로 대체

// ── 완성형/연결형/면접형 여부 분류 ──────────────────────────────────────
const WORD_TYPES     = new Set(['fill', 'complete'])         // 한 단어
const SENTENCE_TYPES = new Set(['matching', 'multi', 'interview']) // 한 문장

function selfcheckInputType(practiceType) {
  if (WORD_TYPES.has(practiceType))     return 'word'
  if (SENTENCE_TYPES.has(practiceType)) return 'sentence'
  return 'sentence'  // 그 외 selfcheck 기본
}

// 'mcq'/'ox' 외(면접·완성·연결·서술 등 선택지 없는 유형)는 모두
// 타이핑 후 교사가 채점하는 selfcheck 흐름으로 처리한다.
// (questionMode가 'interview' 등이라 입력칸이 안 떠 멈추던 버그 방지)
function isTyped(q) {
  const m = q?.questionMode
  if (m === 'mcq' || m === 'ox') return false
  if (m === 'selfcheck') return true
  if (isOXQuestion(q)) return false   // OX는 choices가 없어도 O/X 버튼 문항(타이핑 강요 금지)
  if (isMultiQuestion(q)) return false // 복수선택도 선택형
  return !(q?.choices?.length > 0)
}
function isSurvey(q) { return q?.questionMode === 'survey' || q?.type === 'survey' }
function effMode(q) {
  if (isSurvey(q)) return 'survey'
  if (isOXQuestion(q)) return 'ox'
  if (isMultiQuestion(q)) return 'multi'
  if (isTyped(q)) return 'selfcheck'
  return 'mcq'
}
// 단일(인덱스)·복수(배열) 공용 정오 판정
function isRight(q, sel) {
  if (isSurvey(q)) return false
  if (isMultiQuestion(q)) return gradeMulti(q, sel)
  return sel !== null && sel !== undefined && sel === answerIdxOf(q)
}

// ── 한국어 입력 검증 ─────────────────────────────────────────────────────
// 낱자(자음/모음만: ㄱ-ㅣ) 비율이 높으면 "아무렇게나 입력" 판정
function validateKorean(text, inputType) {
  const t = text.trim()
  if (!t) return '답을 입력해 주세요.'

  // 완성된 한글 음절 (가-힣)
  const syllables = (t.match(/[가-힣]/g) || []).length
  // 낱자 자음/모음 (ㄱ-ㅎ, ㅏ-ㅣ)
  const jamo      = (t.match(/[ㄱ-ㅣ]/g) || []).length

  if (syllables === 0 && jamo > 0)
    return '자음·모음만 입력하셨습니다. 완성된 단어를 입력해 주세요.'
  if (jamo > syllables)
    return '올바른 단어로 입력해 주세요. (자음·모음이 너무 많습니다)'

  if (inputType === 'word') {
    if (syllables < 1)
      return '최소 한 단어(한글) 이상 입력해 주세요.'
  } else {
    // sentence
    if (syllables < 4)
      return '한 문장 이상 입력해 주세요. (최소 4자 이상)'
  }
  return null  // 통과
}

// ── 실제 시험 안내 문구 ──────────────────────────────────────────────────
const EXAM_NOTICE = {
  fill:      { title: '완성형 문항 안내', icon: '✏️', body: '실제 외부평가에서는 빈칸에 직접 단어·어구를 작성합니다.\n먼저 스스로 답을 적어본 뒤 모범답안과 비교해 보세요.' },
  complete:  { title: '완성형 문항 안내', icon: '✏️', body: '실제 외부평가에서는 빈칸에 직접 단어·어구를 작성합니다.\n먼저 스스로 답을 적어본 뒤 모범답안과 비교해 보세요.' },
  matching:  { title: '연결형 문항 안내', icon: '🔗', body: '실제 외부평가에서는 관련 개념을 직접 연결하는 문장을 작성합니다.\n먼저 스스로 한 문장으로 답해본 뒤 모범답안을 확인하세요.' },
  multi:     { title: '복수완성형 안내',  icon: '✏️', body: '실제 외부평가에서는 여러 빈칸에 직접 답을 작성합니다.\n먼저 스스로 적어본 뒤 모범답안과 비교해 보세요.' },
  interview: { title: '면접형 문항 안내', icon: '🎤', body: '실제 외부평가에서는 면접관 앞에서 구술로 답합니다.\n먼저 한 문장으로 적어본 뒤 모범답안의 핵심 키워드를 확인하세요.' },
  default:   { title: '서술형 문항 안내', icon: '📝', body: '실제 평가에서는 직접 답을 작성하거나 말하는 유형입니다.\n먼저 스스로 답해본 뒤 모범답안을 확인하세요.' },
}

// ── 학습 보조 렌더 컴포넌트 ──────────────────────────────────────────────
// 문항 위에 뜨는 주제 배지.
//
// 교육부 인증 문항은 area 필드에 **NCS 직업기초능력 10영역 이름**이 들어 있다
// (의사소통능력·자원관리능력·자기개발능력 …). 그대로 띄우면 교육부 인증
// 시험을 치르는 중에 NCS 능력 이름이 떠서, 이름이 비슷한 다른 시험과
// 헷갈린다. 인증 영역이 붙어 있으면 그것을 먼저 쓴다.
function topicOf(q) {
  return q?.officialArea || q?.area || q?.lessonTitle || q?.unitName || ''
}

// 제시문/지문 — NCS 90%·식음료 86% 문항이 보유하나 그동안 미표시되던 핵심 콘텐츠
function ContextBox({ text }) {
  if (!text || !String(text).trim()) return null
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)',
      borderRadius: 8, padding: '10px 12px', marginBottom: 12,
    }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>📄 제시문</p>
      <p style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{text}</p>
    </div>
  )
}

// 핵심 용어 — 답 확인 시 함께 노출해 용어 암기를 강화
function KeyTerms({ terms }) {
  const list = (terms || []).filter(t => t && (typeof t === 'string' ? t.trim() : t.term))
  if (!list.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>🔑 꼭 외울 핵심 용어</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((t, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
            <b style={{ fontSize: 13, color: 'var(--text)' }}>{typeof t === 'string' ? t : t.term}</b>
            {typeof t !== 'string' && t.definition && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}> — {t.definition}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// 즉시 정답 피드백 — 학습용 퀴즈(시간제한 없음)에서 답 확인 직후 노출
function AnswerFeedback({ q, correct }) {
  const isOX = isOXQuestion(q)
  const cIdx = answerIdxOf(q)
  const correctText = isOX
    ? (cIdx === 0 ? 'O' : 'X')
    : isMultiQuestion(q)
      ? [...answerSetOf(q)].sort((a, b) => a - b).map(i => `${i + 1}. ${q.choices?.[i] ?? ''}`).join(' / ')
      : `${cIdx + 1}. ${q.choices?.[cIdx] ?? ''}`
  return (
    <div style={{
      borderRadius: 12, padding: '14px 16px', marginBottom: 24,
      background: correct ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.06)',
      border: `1.5px solid ${correct ? 'var(--success)' : 'var(--danger)'}`,
    }}>
      <p style={{ fontWeight: 800, fontSize: 15, color: correct ? 'var(--success)' : 'var(--danger)', marginBottom: correct ? 0 : 6 }}>
        {correct ? '✅ 정답이에요!' : '❌ 아쉬워요 — 정답을 기억해 두세요'}
      </p>
      {!correct && (
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
          정답: <span style={{ color: 'var(--success)' }}>{correctText}</span>
        </p>
      )}
      {q.explanation && (
        <CompactText text={q.explanation} maxItemChars={72} style={{ marginTop: 8, fontSize: 13, color: 'var(--text)' }} />
      )}
      <KeyTerms terms={q.keyTerms} />
    </div>
  )
}

export default function MissionScreen({ mission, onBack, onViewWrongAnswers }) {
  const [questions,   setQuestions]   = useState([])
  const [idx,         setIdx]         = useState(0)
  const [answers,     setAnswers]     = useState({})  // qId → number(mcq/ox) | 'O'|'X'(selfcheck)
  const [checked,     setChecked]     = useState({})  // qId → bool (즉시 피드백: 정답·해설 공개됨)
  const [typed,       setTyped]       = useState({})  // qId → string (selfcheck 타이핑)
  const [typeError,   setTypeError]   = useState({})  // qId → string | null
  const [revealed,    setRevealed]    = useState({})  // qId → bool (모범답안 공개됨)
  const [phase,       setPhase]       = useState('loading')
  const [result,      setResult]      = useState(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [examPopup,   setExamPopup]   = useState(null)  // { type, onClose }
  const [timeLeft,    setTimeLeft]    = useState(null)  // 남은 초(시간제한 있을 때)
  // 실제 인증진단 화면의 [문항체크]. 나중에 다시 볼 문항을 표시해 둔다.
  const [flags,       setFlags]       = useState({})
  const shownNotice = useRef(new Set())
  const startTime   = useRef(Date.now())
  const textareaRef = useRef(null)
  const autoSubmitted = useRef(false)
  const scrollRef = useRef(null)

  const backRef = useRef(null)
  backRef.current = () => {
    if (examPopup) {
      setExamPopup(null)
      return
    }
    if (phase === 'quiz' && idx > 0) {
      tryGoTo(idx - 1)
      return
    }
    if (phase === 'quiz' && Object.keys(answers).length > 0) {
      if (window.confirm('퀴즈를 종료할까요? 진행상황이 사라집니다.')) onBack?.()
      return
    }
    onBack?.()
  }

  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  useEffect(() => { loadQuestions() }, [])

  // 시간 제한이 걸린 실전 중에는 아래 탭바를 감춘다. 실제 시험이라면 화면을
  // 벗어날 수 없고, 잘못 누르면 지금까지 푼 답이 통째로 날아간다.
  useEffect(() => {
    if (!mission.time_limit_min) return
    document.body.classList.add('exam-mode')
    return () => document.body.classList.remove('exam-mode')
  }, [mission.time_limit_min])

  // 문항 이동 시 스크롤 맨 위로(위 문제부터 보이게)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [idx])

  // ── 시간제한 카운트다운 ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'quiz' || timeLeft == null) return
    const t = setInterval(() => setTimeLeft(s => (s == null ? s : Math.max(0, s - 1))), 1000)
    return () => clearInterval(t)
  }, [phase])

  // 시간 만료 → 자동 제출(1회)
  useEffect(() => {
    if (phase === 'quiz' && timeLeft === 0 && !autoSubmitted.current && !submitting) {
      autoSubmitted.current = true
      submitQuiz()
    }
  }, [timeLeft, phase])

  // 문항 변경 시 textarea에 포커스
  useEffect(() => {
    if (phase === 'quiz' && isTyped(questions[idx])) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [idx, phase])

  function loadQuestions() {
    // 사전 구성된 문항 객체(변형 적용 시험지·합격판정 모의 등)는 그대로 사용
    // (id로 원본 풀에서 재조회하면 변형이 사라지므로 반드시 객체 우선)
    if (Array.isArray(mission.questions) && mission.questions.length > 0) {
      let pre = mission.questions.filter(q => q && q.id).map(withExtractedChoices)
      if (mission.shuffle) pre = [...pre].sort(() => Math.random() - 0.5)
      setQuestions(pre.slice(0, mission.question_count || pre.length))
      startTime.current = Date.now()
      if (mission.time_limit_min) setTimeLeft(mission.time_limit_min * 60)
      setPhase('quiz')
      return
    }
    const subjectId   = mission.subject_id ?? 'job-common'
    // 미지원 과목이 job-common 풀로 조용히 폴백하면 학생에게 엉뚱한 과목 문제가 출제됨 — 명시적 오류로
    const poolBase = QUESTION_POOLS[subjectId]
    if (!poolBase) {
      setErrorMsg(`이 과목(${subjectId})은 미션 자동 출제를 아직 지원하지 않습니다. 선생님께 알려 주세요.`)
      setPhase('error')
      return
    }
    const allQuestions = poolBase
    const qIds        = mission.question_ids ?? []
    let pool          = []

    if (qIds.length > 0 && !qIds[0].endsWith('-Q*')) {
      const idSet = new Set(qIds)
      pool = allQuestions.filter(q => idSet.has(q.id) && !q.excludeFromQuiz)
    }
    if (pool.length === 0 && qIds.length > 0 && qIds[0].startsWith('area:')) {
      const areas = new Set(qIds.map(q => q.replace('area:', '')))
      pool = allQuestions.filter(q => areas.has(q.area) && !q.excludeFromQuiz)
    }
    if (pool.length === 0 && qIds.length > 0) {
      const prefixes = qIds.map(p => p.replace(/-Q\*$/, ''))
      pool = allQuestions.filter(q =>
        prefixes.some(p => q.lessonId === p || q.id.startsWith(p + '-Q')) &&
        !q.excludeFromQuiz
      )
    }
    if (pool.length === 0 && mission.area_ids?.length > 0) {
      pool = allQuestions.filter(q =>
        mission.area_ids.some(a =>
          q.area === a || q.lessonId?.startsWith(a.replace('a','C')) || q.id.startsWith(a)
        ) && !q.excludeFromQuiz
      )
    }
    if (pool.length === 0) pool = allQuestions.filter(q => !q.excludeFromQuiz)

    if (pool.length === 0) {
      setErrorMsg(`문항 매칭 실패. question_ids 첫 3개: ${qIds.slice(0,3).join(', ')}`)
      setPhase('error')
      return
    }

    if (mission.shuffle) pool = pool.sort(() => Math.random() - 0.5)
    setQuestions(pool.slice(0, mission.question_count))
    startTime.current = Date.now()
    if (mission.time_limit_min) setTimeLeft(mission.time_limit_min * 60)
    setPhase('quiz')
  }

  // examNotice 체크 후 이동
  function tryGoTo(nextIdx) {
    const nextQ = questions[nextIdx]
    if (!nextQ) return
    if (nextQ.examNotice === 'first' && !shownNotice.current.has(nextQ.practiceType)) {
      shownNotice.current.add(nextQ.practiceType ?? 'default')
      setExamPopup({ type: nextQ.practiceType ?? 'default', onClose: () => { setExamPopup(null); setIdx(nextIdx) } })
    } else {
      setIdx(nextIdx)
    }
  }

  useEffect(() => {
    if (phase !== 'quiz' || questions.length === 0) return
    const q = questions[0]
    if (q.examNotice === 'first' && !shownNotice.current.has(q.practiceType)) {
      shownNotice.current.add(q.practiceType ?? 'default')
      setExamPopup({ type: q.practiceType ?? 'default', onClose: () => setExamPopup(null) })
    }
  }, [phase, questions])

  // ── 자가채점 타이핑 검증 → 모범답안 공개 ────────────────────────────────
  function handleReveal(q) {
    const inputType = selfcheckInputType(q.practiceType)
    const err = validateKorean(typed[q.id] ?? '', inputType)
    if (err) {
      setTypeError(prev => ({ ...prev, [q.id]: err }))
      textareaRef.current?.focus()
      return
    }
    setTypeError(prev => ({ ...prev, [q.id]: null }))
    setRevealed(prev => ({ ...prev, [q.id]: true }))
  }

  async function submitQuiz() {
    // 자동채점(mcq/ox)과 서술형(selfcheck) 분리
    let autoScore = 0
    const mcqPayload  = {}
    const typedPayload = {}

    for (const q of questions) {
      if (isTyped(q)) {
        typedPayload[q.id] = typed[q.id] ?? ''
      } else {
        const sel = answers[q.id] ?? null
        mcqPayload[q.id] = sel
        if (!isSurvey(q)) {
          const right = isRight(q, sel)
          if (right) autoScore++
          if (sel !== null) recordReview({ subject: mission.subject_id ?? 'job-common', unitId: q.lessonId ?? q.area ?? '', itemId: q.id, demand: learningModeOf(q).id }, right ? 4 : 1)  // 간격반복 확대(미션)
        }
      }
    }

    // 합격 판정 모의 등 부모가 직접 채점하는 모드: 서버 제출 대신 콜백으로 답안 전달
    if (typeof mission.onComplete === 'function') {
      mission.onComplete({ mcqAnswers: mcqPayload, typed: typedPayload, questions })
      return
    }

    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    const autoTotal = questions.filter(q => !isTyped(q) && !isSurvey(q)).length
    setSubmitting(true)
    recordActivity('mission')

    let data, error
    if (mission.mock) {
      // 모의고사 — 별도 테이블에 저장 (rpc_submit_mock_assessment)
      ;({ data, error } = await supabase.rpc('rpc_submit_mock_assessment', {
        p_subject_id:     mission.subject_id ?? 'job-common',
        p_kind:           mission.mock.kind ?? 'area',
        p_title:          mission.title,
        p_area_ids:       mission.area_ids ?? [],
        p_question_ids:   questions.map(q => q.id),
        p_answers:        { ...mcqPayload, _score: autoScore },
        p_typed_answers:  typedPayload,
        p_auto_total:     autoTotal,
        p_time_taken_sec: timeTaken,
        p_time_limit_min: mission.time_limit_min ?? null,
      }))
    } else {
      ;({ data, error } = await supabase.rpc('rpc_submit_mission', {
        p_mission_id:     mission.id,
        p_answers:        { ...mcqPayload, _score: autoScore },
        p_time_taken_sec: timeTaken,
        p_typed_answers:  typedPayload,
      }))
    }
    setSubmitting(false)
    if (error) { alert('제출 오류: ' + error.message); return }
    // XP 지급: 자동채점 정답 1개당 10XP (면접형 제출만 해도 최소 20XP)
    const xpMission = Math.max(autoScore * 10, 20)
    addXp(xpMission, 'mission_complete')
    setResult({
      score:          data.score,
      total:          data.total,
      gradingStatus:  data.grading_status,
      timeTaken,
      questions,
      answers:        mcqPayload,
      typed,
    })
    setPhase('result')
  }

  // ── 에러 ──
  if (phase === 'error') return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">오류</span></div>
      <div className="empty-state">
        <span className="empty-state-icon">⚠️</span>
        <span className="empty-state-title">문항을 불러올 수 없습니다</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '0 16px' }}>선생님께 문의하거나 잠시 후 다시 시도해 주세요.</span>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onBack}>돌아가기</button>
      </div>
    </div>
  )

  if (phase === 'loading') return (
    <div className="screen">
      <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">{mission.title}</span></div>
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  // ── 결과 ──
  if (phase === 'result' && result) {
    const autoTotal   = result.questions.filter(q => !isTyped(q) && !isSurvey(q)).length
    const selfTotal   = result.questions.filter(q => isTyped(q)).length
    const surveyTotal = result.questions.filter(q => isSurvey(q)).length
    const pct         = autoTotal > 0 ? Math.round(result.score / autoTotal * 100) : 0
    const isPending   = result.gradingStatus === 'pending'

    return (
      <div className="screen">
        <div className="appbar"><button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button><span className="appbar-title">{mission.mock ? '모의고사 결과' : '미션 결과'}</span></div>
        <div className="screen-body">
          <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
            <div style={{ fontSize: 64 }}>{mission.mock ? '📝' : surveyTotal > 0 ? '🧭' : isPending ? '📬' : pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪'}</div>
            {surveyTotal > 0 && (
              <>
                <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginTop: 8 }}>응답을 마쳤어요</p>
                <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                  {surveyTotal}문항 · 정답과 오답이 없는 성향 점검입니다
                </p>
              </>
            )}
            {autoTotal > 0 && (
              <>
                <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>{pct}점</p>
                <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  선택형 {result.score}/{autoTotal}문항 · {formatDuration(result.timeTaken)}
                </p>
                {mission.mock ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginTop: 8 }}>
                    응답 {Object.values(result.answers).filter(v => v !== null && v !== undefined).length}/{autoTotal} · 제한 {mission.time_limit_min}분
                  </p>
                ) : (
                  <p style={{ fontSize: 14, color: '#F59E0B', fontWeight: 700, marginTop: 8 }}>🏆 +{Math.max(result.score * 10, 20)} XP 획득!</p>
                )}
              </>
            )}
            {isPending && (
              <div style={{
                margin: '12px auto 0', maxWidth: 320,
                background: '#fff8e1', borderRadius: 10, padding: '12px 16px',
                border: '1px solid #f9a825',
              }}>
                <p style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: 14 }}>
                  📝 서술형 {selfTotal}문항 — 교사 채점 대기 중
                </p>
                <p style={{ fontSize: 12, color: '#e65100', lineHeight: 1.6 }}>
                  선생님이 채점을 완료하면 최종 점수가 확정됩니다.
                </p>
              </div>
            )}
          </div>

          <p className="section-title">{mission.mock ? '문항별 채점·해설' : '문항 확인'}</p>
          {result.questions.map((q, i) => {
            const myAns   = result.answers[q.id]
            const myTyped = result.typed?.[q.id]
            const isSelf  = isTyped(q)
            const isSurveyItem = isSurvey(q)
            const isOX    = q.questionMode === 'ox'
            const isRightAns = !isSelf && isRight(q, myAns)
            const borderColor = isSelf || isSurveyItem ? 'var(--primary)' : isRightAns ? 'var(--success)' : 'var(--danger)'

            return (
              <div key={q.id} className="card" style={{ marginBottom: 10, borderLeft: `4px solid ${borderColor}` }}>
                <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                  {isSurveyItem ? '🧭' : isSelf ? '📝' : isRightAns ? '✅' : '❌'} Q{i+1}. {q.stem}
                </p>

                {isSurveyItem ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    내 응답: <b style={{ color: 'var(--primary)' }}>{q.choices?.[myAns] ?? '응답 없음'}</b>
                  </p>
                ) : isSelf ? (
                  <>
                    {myTyped && (
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>내가 작성한 답</p>
                        <p style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.6 }}>"{myTyped}"</p>
                      </div>
                    )}
                    <p style={{ fontSize: 12, color: '#e65100', fontWeight: 600 }}>⏳ 교사 채점 대기 중</p>
                  </>
                ) : isOX ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    정답: <b style={{ color: 'var(--success)' }}>{answerIdxOf(q) === 0 ? 'O' : 'X'}</b>
                    {myAns !== null && myAns !== undefined ? ` · 내 답: ${myAns === 0 ? 'O' : 'X'}` : ''}
                  </p>
                ) : (
                  q.choices?.map((text, ci) => {
                    const multi      = isMultiQuestion(q)
                    const isCorrect  = multi ? answerSetOf(q).has(ci) : ci === answerIdxOf(q)
                    const isSelected = multi ? (Array.isArray(myAns) && myAns.includes(ci)) : ci === myAns
                    return (
                      <p key={ci} style={{
                        fontSize: 13, padding: '3px 0',
                        color: isCorrect ? 'var(--success)' : (isSelected && !isCorrect) ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: isCorrect || isSelected ? 700 : 400,
                      }}>
                        {isSelected ? '▶ ' : '　'}{ci+1}. {text}{isCorrect ? ' ✓' : ''}
                      </p>
                    )
                  })
                )}

                {!isSelf && q.explanation && (
                  <CompactText text={q.explanation} maxItemChars={68} style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }} />
                )}
                <KeyTerms terms={q.keyTerms} />
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {onViewWrongAnswers && result.questions.some(q => !isTyped(q) && !isSurvey(q)) && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onViewWrongAnswers}>
                📋 오답노트
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onBack}>
              {mission.mock ? '모의고사 목록' : '홈으로'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 퀴즈 ──
  const q      = questions[idx]
  const total  = questions.length
  const isLast = idx === total - 1
  const qMode  = effMode(q)

  // 시간제한(모의고사·시간제한 시험)이 없을 때만 즉시 피드백(학습 모드).
  // 시험에서는 즉시 정답 노출이 부적절하므로 끝에 채점한다.
  const instantFeedback = !mission.time_limit_min

  // 학습에서는 모범답안 확인까지, 시간제한 시험에서는 답안 작성까지만 완료로 본다.
  function qDone(qItem) {
    if (!qItem) return false
    if (isSurvey(qItem)) return answers[qItem.id] !== undefined
    if (isTyped(qItem)) {
      return instantFeedback
        ? !!revealed[qItem.id]
        : !!String(typed[qItem.id] ?? '').trim()
    }
    if (instantFeedback)  return !!checked[qItem.id]
    const a = answers[qItem.id]
    if (isMultiQuestion(qItem)) return Array.isArray(a) && a.length > 0
    return a !== undefined
  }

  const isRevealed      = revealed[q?.id] ?? false
  const isChecked       = checked[q?.id] ?? false
  const currentAnswered = qDone(q)
  const totalAnswered   = questions.reduce((n, qItem) => n + (qDone(qItem) ? 1 : 0), 0)

  // 학습 모드: 답을 골랐으나 아직 '확인' 안 한 mcq/ox → 확인 버튼 단계
  const needCheck = instantFeedback && (qMode === 'mcq' || qMode === 'ox' || qMode === 'multi') && !isChecked
  // 학습 모드 진행 중 맞힌 개수(격려용)
  const correctSoFar = instantFeedback
    ? questions.reduce((n, qi) => n + ((!isTyped(qi) && !isSurvey(qi) && checked[qi.id] && isRight(qi, answers[qi.id])) ? 1 : 0), 0)
    : null
  const typedVal        = typed[q?.id]    ?? ''
  const inputType       = selfcheckInputType(q?.practiceType)
  const inputErr        = typeError[q?.id] ?? null

  // examNotice 안내 팝업 (전체화면)
  if (examPopup) {
    const info = EXAM_NOTICE[examPopup.type] ?? EXAM_NOTICE.default
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">{mission.title}</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid var(--primary)', maxWidth: 360 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{info.icon}</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{info.title}</p>
            <CompactText text={info.body} maxItemChars={68} style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }} />
            <button className="btn btn-primary btn-full" onClick={examPopup.onClose}>
              알겠어요, 학습 시작!
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
        <span className="appbar-title">{mission.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          {timeLeft != null && (
            <span style={{ fontWeight: 700, color: timeLeft <= 60 ? 'var(--danger)' : 'var(--primary)' }}>
              ⏱ {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          )}
          {correctSoFar != null && totalAnswered > 0 && (
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>✅ {correctSoFar}</span>
          )}
          <span>{idx+1}/{total}</span>
        </span>
      </div>

      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--primary)', width: `${(idx+1)/total*100}%`, transition: 'width 0.3s' }} />
      </div>

      {/* 실제 인증진단은 계산기·메모장·문항체크를 화면 안에서 제공한다.
          이것 없이 연습하면 시간 배분 감각이 실제와 어긋난다.
          시간 제한이 걸린 실전에서만 띄운다. */}
      {mission.time_limit_min ? (
        <ExamTools
          total={total} idx={idx} answers={answers} questions={questions} flags={flags}
          onToggleFlag={(qid) => qid && setFlags(f => ({ ...f, [qid]: !f[qid] }))}
          onJump={(i) => tryGoTo(i)} />
      ) : null}

      <div className="screen-body" ref={scrollRef}>
        {/* 서술형 배지 */}
        {qMode === 'selfcheck' && q.examNotice === 'badge' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            background: '#fff8e1', borderRadius: 8, marginBottom: 10,
            border: '1px solid #f9a825',
          }}>
            <span style={{ fontSize: 13 }}>📝</span>
            <span style={{ fontSize: 12, color: '#e65100' }}>실제 평가에서는 직접 작성·서술하는 유형</span>
          </div>
        )}

        {/* 문항 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            {q?.setId && (
              <span style={{
                fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', marginRight: 6,
              }}>🔗 세트 {q.setOrder}/{q.setTotal} · 같은 자료로 이어집니다</span>
            )}
            {topicOf(q)
              ? <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)',
                  borderRadius: 6, padding: '3px 8px', maxWidth: '75%', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>📚 {topicOf(q)}</span>
              : <span />}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <QuestionPriorityBadge q={q} subjectId={mission.subject_id} />
              <DifficultyBadge q={q} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>문항 {idx+1}</span>
            </span>
          </div>
          <ListeningPrompt
            key={q?.id}
            q={q}
            revealTranscript={instantFeedback && isChecked}
          />
          <QuestionMedia q={q} />
          <ContextBox text={q?.context} />
          <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{q?.stem}</p>
        </div>

        {/* ── MCQ / 복수선택 ── */}
        {(qMode === 'mcq' || qMode === 'multi' || qMode === 'survey') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {qMode === 'survey' && (
              <p className="mission-source-note">솔직하게 응답하세요. 특정 선택지가 정답으로 표시되지 않습니다.</p>
            )}
            {qMode === 'multi' && (
              <p style={{ fontSize: 12, fontWeight: 800, color: '#6a1b9a', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 8, padding: '6px 12px', alignSelf: 'flex-start' }}>
                ☑️ 복수선택 — 해당하는 것을 모두 고르세요
              </p>
            )}
            {q?.choices?.map((text, ci) => {
              const multi     = qMode === 'multi'
              const survey    = qMode === 'survey'
              const selected  = multi ? (Array.isArray(answers[q.id]) && answers[q.id].includes(ci)) : answers[q.id] === ci
              const reveal    = !survey && instantFeedback && isChecked   // 확인 후 정답 공개
              const isCorrect = multi ? answerSetOf(q).has(ci) : ci === answerIdxOf(q)
              let bg = 'var(--card)', bd = 'var(--border)', numBg = 'var(--border)', numFg = 'var(--text-muted)'
              if (reveal && isCorrect)        { bg = 'rgba(76,175,80,0.10)';  bd = 'var(--success)'; numBg = 'var(--success)'; numFg = '#fff' }
              else if (reveal && selected)    { bg = 'rgba(244,67,54,0.08)';  bd = 'var(--danger)';  numBg = 'var(--danger)';  numFg = '#fff' }
              else if (!reveal && selected)   { bg = 'var(--primary-light)';  bd = 'var(--primary)'; numBg = 'var(--primary)'; numFg = '#fff' }
              return (
                <button key={ci}
                  onClick={() => {
                    if (reveal) return
                    if (multi) setAnswers(prev => { const cur = Array.isArray(prev[q.id]) ? prev[q.id] : []; return { ...prev, [q.id]: cur.includes(ci) ? cur.filter(x => x !== ci) : [...cur, ci] } })
                    else setAnswers(prev => ({ ...prev, [q.id]: ci }))
                  }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: bg, border: `2px solid ${bd}`,
                    borderRadius: 12, cursor: reveal ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                    fontSize: 14, lineHeight: 1.5, color: 'var(--text)', transition: 'all 0.15s',
                  }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: numBg, color: numFg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{ci+1}</span>
                  <span style={{ flex: 1 }}>{text}</span>
                  {reveal && isCorrect && <span style={{ color: 'var(--success)', fontWeight: 800, flexShrink: 0 }}>✓</span>}
                  {reveal && selected && !isCorrect && <span style={{ color: 'var(--danger)', fontWeight: 800, flexShrink: 0 }}>✗</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* ── O/X ── */}
        {qMode === 'ox' && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[['O', 'var(--success)'], ['X', 'var(--danger)']].map(([label, color], ci) => {
              const selected  = answers[q.id] === ci
              const reveal    = instantFeedback && isChecked
              const isCorrect = ci === answerIdxOf(q)
              let bg = 'var(--card)', bd = 'var(--border)', fg = 'var(--text-muted)'
              if (reveal && isCorrect)      { bg = color;               bd = color;            fg = '#fff' }
              else if (reveal && selected)  { bg = 'var(--card)';       bd = 'var(--danger)';  fg = 'var(--danger)' }
              else if (!reveal && selected) { bg = color;               bd = color;            fg = '#fff' }
              return (
                <button key={label}
                  onClick={() => { if (reveal) return; setAnswers(prev => ({ ...prev, [q.id]: ci })) }}
                  style={{
                    flex: 1, padding: '24px 0 20px', borderRadius: 16, cursor: reveal ? 'default' : 'pointer',
                    background: bg, border: `2px solid ${bd}`,
                    fontSize: 40, fontWeight: 900, lineHeight: 1, color: fg, transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                  {label}
                  {reveal && isCorrect && <span style={{ fontSize: 12, fontWeight: 700 }}>✓ 정답</span>}
                  {reveal && selected && !isCorrect && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>✗ 내 답</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* ── 즉시 정답 피드백 (학습 모드, 확인 후) ── */}
        {instantFeedback && isChecked && (qMode === 'mcq' || qMode === 'ox') && (
          <AnswerFeedback q={q} correct={isRight(q, answers[q.id])} />
        )}

        {/* ── 자가채점 (완성형·연결형·면접형) ── */}
        {qMode === 'selfcheck' && (
          <div style={{ marginBottom: 24 }}>
            {/* 1단계: 타이핑 */}
            {!isRevealed && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {!instantFeedback
                    ? '시험 답안을 작성하세요. 모범답안과 해설은 제출 전에는 공개되지 않습니다.'
                    : inputType === 'word'
                    ? '먼저 스스로 답을 한 단어로 적어 보세요.'
                    : '먼저 스스로 답을 한 문장으로 적어 보세요.'}
                </p>
                <textarea
                  ref={textareaRef}
                  value={typedVal}
                  onChange={e => {
                    setTyped(prev => ({ ...prev, [q.id]: e.target.value }))
                    if (typeError[q.id]) setTypeError(prev => ({ ...prev, [q.id]: null }))
                  }}
                  onKeyDown={e => {
                    // 완성형(한 단어)에서 Enter → 바로 검증
                    if (instantFeedback && inputType === 'word' && e.key === 'Enter') { e.preventDefault(); handleReveal(q) }
                  }}
                  placeholder={inputType === 'word' ? '예: 고객 서비스' : '예: 고객 응대 시 밝은 표정과 친절한 말투가 중요합니다.'}
                  rows={inputType === 'word' ? 1 : 3}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: 15,
                    border: `2px solid ${inputErr ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 10, fontFamily: 'var(--font)', resize: 'none',
                    background: 'var(--card)', color: 'var(--text)', boxSizing: 'border-box',
                    lineHeight: 1.6,
                  }}
                />
                {inputErr && (
                  <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                    ⚠️ {inputErr}
                  </p>
                )}
                {instantFeedback ? (
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: 12 }}
                    onClick={() => handleReveal(q)}
                    disabled={!typedVal.trim()}>
                    📖 모범답안 확인하기
                  </button>
                ) : typedVal.trim() ? (
                  <p style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>
                    답안이 입력되었습니다. 다음 문항으로 이동할 수 있습니다.
                  </p>
                ) : null}
              </div>
            )}

            {/* 2단계: 모범답안 공개 — 교사가 채점 */}
            {instantFeedback && isRevealed && (
              <div>
                {typedVal && (
                  <div style={{
                    background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                    border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>내가 작성한 답</p>
                    <p style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.6 }}>"{typedVal}"</p>
                  </div>
                )}
                <div style={{
                  background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                  border: '1px solid var(--primary)',
                }}>
                  <p style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4, fontWeight: 700 }}>모범답안</p>
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {q.modelAnswer || (String(q.answer ?? '').length > 3 ? q.answer : (q.explanation || '해설을 참고해 주세요.'))}
                  </p>
                  {q.explanation && (
                    <CompactText text={q.explanation} maxItemChars={68} style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }} />
                  )}
                  <KeyTerms terms={q.keyTerms} />
                </div>
                <div style={{ background: '#fff8e1', borderRadius: 8, padding: '8px 12px', border: '1px solid #f9a825' }}>
                  <p style={{ fontSize: 12, color: '#e65100' }}>
                    📝 선생님이 내 답과 모범답안을 비교하여 채점합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 이전/확인/다음/제출 */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* 공식 매뉴얼은 [이전]·[다음]으로 문항 간 이동이 가능하다고 밝힌다.
              앞으로만 가게 막아 두면 '어려운 문항은 표시해 두고 넘어간 뒤
              돌아오기'라는 실전 전략을 연습할 수 없다. 시간 제한이 있는
              실전에서는 오히려 이동을 열어 준다. */}
          {idx > 0 && (!mission.lockNavigation || mission.time_limit_min) && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIdx(i => i-1)}>
              ← 이전
            </button>
          )}
          {needCheck ? (
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => setChecked(prev => ({ ...prev, [q.id]: true }))}
              disabled={qMode === 'multi' ? !(Array.isArray(answers[q?.id]) && answers[q.id].length > 0) : answers[q?.id] === undefined}>
              확인하기
            </button>
          ) : !isLast ? (
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => tryGoTo(idx + 1)}
              /* 실전에서는 답하지 않고도 다음으로 갈 수 있다. 막아 두면
                 모르는 문항 하나에 붙들려 뒤를 통째로 못 푸는 일이 생긴다. */
              disabled={!mission.time_limit_min && !currentAnswered}>
              다음 →
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}
              onClick={submitQuiz}
              disabled={
                submitting || (totalAnswered < total && timeLeft !== 0)
              }>
              {submitting ? '제출 중...' : `제출 (${totalAnswered}/${total})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
