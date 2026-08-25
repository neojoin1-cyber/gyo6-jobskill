/**
 * StudyScreen — 교과 학습 뷰
 * 학습 모드: 답 통합 표시 (LearnCard)
 * 게임 모드: 전체 답 선택 → 마지막에 일괄 채점 (GameCard)
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { withExtractedChoices } from '../../lib/questionNorm.js'
import { recordReview } from '../../lib/srs.js'
import { noteStudied } from '../../lib/dailyChallenge.js'
import DemandCoach, { DemandChip } from './DemandCoach.jsx'
import StudyModeToggle, { StudyModeStrip } from './StudyModeToggle.jsx'
import { learningModeOf } from '../../lib/learningMode.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import { recordActivity } from '../../lib/activity.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { addXp }           from '../../lib/xp.js'
import { recordAnswer }    from '../../lib/mastery.js'
import { recordQuestion }  from '../../lib/subjectProgress.js'
import areaMapping          from '../../../data/areaMapping.json'
import { buildJcOfficialAreas, jcStudyQuestions } from '../../lib/jobCommonAreas.js'
import { ncs2026Questions, buildNcs2026Areas } from '../../lib/ncs2026.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'
import {
  recruitWrittenQuestions,
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  getRecruitTrack,
  recruitAreaId,
  recruitLessonTitle,
} from '../../lib/recruitWritten.js'
import ncsExtras            from '../../../data/ncs-lesson-extras.json'
import { ncsTier } from '../../lib/ncsAreaPriority.js'
import { getSummary }       from '../../lib/studySummaries.js'
import { buildQuestionDrivenSummary } from '../../lib/learningExperience.js'
import StudySummary, { buildStudySummaryCards } from './StudySummary.jsx'
import DifficultyBadge      from './DifficultyBadge.jsx'
import ListeningPrompt      from './ListeningPrompt.jsx'
import QuestionMedia        from './QuestionMedia.jsx'
import JobAdaptationScreen  from './JobAdaptationScreen.jsx'
import { jcLessonMatches, jcOrderInLesson } from '../../lib/jobCommonAreas.js'
import MatchingBoard, { isMatchingCorrect } from './MatchingBoard.jsx'
import PulldownForm, { isPulldownCorrect } from './PulldownForm.jsx'
import { studyQuestions } from '../../lib/assessmentPartition.js'
import CompactText from '../../components/CompactText.jsx'

const ncsExtrasMap  = new Map(ncsExtras.map(e => [e.lessonId, e]))

function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

function summaryCardTitle(card, summary) {
  if (!card) return summary?.title || '개념 학습'
  if (card.type === 'intro') return `${summary?.title || '단원'} 요점`
  if (card.type === 'point') return card.point?.topic || card.text || `핵심 ${card.n || 1}`
  if (card.type === 'recap') return '꼭 기억할 것'
  if (card.type === 'term') return `${card.term || '핵심 용어'} 확인`
  if (card.type === 'tip') return card.mistake?.stem || '실제 오답으로 고쳐 보기'
  if (card.type === 'end') return '요점 학습 완료'
  return summary?.title || '개념 학습'
}

// 신규 type 필드 + 레거시 questionMode 통합 해석
function resolveType(q) {
  if (!q) return 'choice'
  if (q.type === 'ox' || q.questionMode === 'ox') return 'ox'
  if (q.type === 'matching') return 'matching'
  if (q.type === 'pulldown') return 'pulldown'
  if (q.type === 'multi') return 'multi'
  if (q.type === 'text') return 'text'
  if (q.questionMode === 'selfcheck') return 'selfcheck'
  return 'choice'
}
// OX 정답 표준화: 신규 'O'/'X' + 레거시 'A'/'B' 모두 처리
function isOXAnswerO(q) {
  if (q.answer === 'O') return true
  if (q.answer === 'X') return false
  return q.answer === 'A'
}

const SUBJECTS = [
  { id: 'job-common',   label: COMMON_ABILITY_COURSES['job-common'].title, icon: '📚', questions: jcStudyQuestions() },
  { id: 'ncs-basic',    label: COMMON_ABILITY_COURSES['ncs-basic'].title, icon: '🔧', questions: studyQuestions(ncs2026Questions) },
  { id: 'recruit-written', label: '채용필기 심화·확장', icon: '📝', questions: studyQuestions(recruitWrittenQuestions) },
]

// 교육부·대한상의 직업공통능력 인증 = 5개 인증영역.
const JOB_AREAS = buildJcOfficialAreas()

export default function StudyScreen({ initialSubject, initialArea, initialLesson, initialQuestionId, initialQuestionIndex, onLearningContext, onBack }) {
  const subjectId = initialSubject ?? 'job-common'
  const [trackId,          setTrackId]          = useState(null)
  // 교사가 준 링크(수업 덱의 QR)로 들어오면 과목 고르기부터 다시 하지 않고
  // 그 차시를 바로 연다. 교실에서 "학습 → NCS → 자율학습 → 영역 → 차시"를
  // 스무 명이 각자 더듬는 시간이 통째로 사라진다.
  const [areaId,           setAreaId]           = useState(initialArea ?? null)
  const [lessonId,         setLessonId]         = useState(initialLesson ?? null)
  const [learnIdx,         setLearnIdx]         = useState(0)
  const [gameIdx,          setGameIdx]          = useState(0)
  const [learnCardStep,    setLearnCardStep]    = useState(0)
  const [studyMode,        setStudyMode]        = useState(initialQuestionId ? 'game' : 'learn')
  const [gameAnswers,      setGameAnswers]      = useState({})   // { idx → ci }
  const [gameChecked,      setGameChecked]      = useState({})   // { idx → bool } 즉시 피드백 공개됨
  const [gameResult,       setGameResult]       = useState(null)
  const [showJump,         setShowJump]         = useState(false)
  const [learnRevealed,    setLearnRevealed]    = useState({})
  const scrollRef = useRef(null)

  const [ssProgress, setSsProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ss_progress') || '{}') }
    catch { return {} }
  })
  function markSSProgress(qId, status) {
    const next = { ...ssProgress, [qId]: status }
    setSsProgress(next)
    localStorage.setItem('ss_progress', JSON.stringify(next))
  }

  const questionIdx = studyMode === 'learn' ? learnIdx : gameIdx
  const subject     = SUBJECTS.find(s => s.id === subjectId)

  const areas = useMemo(() => {
    if (subjectId === 'job-common')   return JOB_AREAS
    if (subjectId === 'ncs-basic')    return buildNcs2026Areas(subject?.questions ?? [])
    if (subjectId === 'recruit-written') return buildRecruitWrittenAreas(trackId, subject?.questions ?? [])
    return []
  }, [subject, subjectId, trackId])

  const lessons = useMemo(() => {
    if (!areaId) return []
    return areas.find(a => a.id === areaId)?.lessons ?? []
  }, [areas, areaId])

  // 링크의 영역 이름이 틀렸으면 "학습 문항이 없습니다"만 뜨고 학생은 왜인지
  // 알 수 없다. 목록에 없는 값이면 조용히 무시하고 평소대로 영역 고르기를 준다.
  useEffect(() => {
    if (areaId && areas.length && !areas.some(a => a.id === areaId)) {
      setAreaId(null); setLessonId(null)
    }
  }, [areas, areaId])

  const questionPool = useMemo(() => {
    // 보기 없는 선다형(보기가 문두 ①②③ 텍스트에 붙은 뱅크)은 보기를 분리 추출해 정상 출제
    const qs = (subject?.questions ?? []).map(withExtractedChoices)
    if (!areaId) return []
    if (subjectId === 'job-common') {
      if (lessonId && lessonId !== '__all__') {
        return jcOrderInLesson(
          qs.filter(q => !q.excludeFromQuiz && jcLessonMatches(q, lessonId)),
          lessonId)
      }
      const area = JOB_AREAS.find(a => a.id === areaId)
      const lids = area?.lessons.map(l => l.id) ?? []
      return qs.filter(q => !q.excludeFromQuiz && lids.some(id => jcLessonMatches(q, id)))
    }
    if (subjectId === 'ncs-basic') {
      return qs.filter(q =>
        !q.excludeFromQuiz &&
        q.area === areaId &&
        (!lessonId || lessonId === '__all__' || q.ncsAbility === lessonId)
      )
    }
    if (subjectId === 'recruit-written') {
      return qs.filter(q =>
        !q.excludeFromQuiz &&
        q.recruitmentTrack === trackId &&
        recruitAreaId(q.area) === areaId &&
        (!lessonId || lessonId === '__all__' || recruitLessonTitle(q) === lessonId)
      )
    }
    return []
  }, [subject, subjectId, trackId, areaId, lessonId])

  // A classroom follow link opens the same item the teacher is projecting.
  // The ID is authoritative; the numeric index is only a fallback for older sessions.
  const followedQuestion = useRef(false)
  useEffect(() => {
    if (followedQuestion.current || !questionPool.length || (!initialQuestionId && !Number.isInteger(initialQuestionIndex))) return
    const byId = initialQuestionId ? questionPool.findIndex(question => question.id === initialQuestionId) : -1
    const target = byId >= 0
      ? byId
      : Math.max(0, Math.min(questionPool.length - 1, initialQuestionIndex || 0))
    followedQuestion.current = true
    setStudyMode('game')
    setLearnIdx(target)
    setGameIdx(target)
  }, [questionPool, initialQuestionId, initialQuestionIndex])

  // 이 훅은 **반드시 여기, 화면 분기(early return)보다 위**에 있어야 한다.
  // 아래쪽 본문에 두었더니 과목·영역 고르는 화면에서는 실행되지 않고 단원에
  // 들어간 뒤에만 실행되어, 리액트가 훅 개수가 달라졌다며 화면을 통째로
  // 떨어뜨렸다(React #310, '교재를 불러오지 못했어요'). 실제로 겪은 일이다.
  // ── 학습(요점정리) 모드 — 단원/영역에 요점정리가 있으면 퀴즈와 분리된 리더를 표시 ──
  // 직업공통: 단원(lessonId) 키. NCS: 영역(area:<영역명>) 키.
  // 요점정리는 두 단위로 있다 — 직업공통은 단원별, NCS 는 영역별.
  // 영역 것을 하위능력 화면에 띄울 때는 **그 사실을 밝힌다.** 그러지 않으면
  // "문서소통능력"을 골랐는데 의사소통 영역 전체 요점이 나와 학생이 어리둥절해진다.
  const lessonSummary = useMemo(() => {
    const courseKind = {
      'job-common': 'education-certification',
      'ncs-basic': 'ncs',
      'recruit-written': 'recruitment',
    }[subjectId] || 'practice'
    const lessonLabel = lessonId === '__all__'
      ? `${areas.find(area => area.id === areaId)?.label || areaId} 전체 학습`
      : lessons.find(lesson => lesson.id === lessonId)?.label
    const withCourse = summary => summary ? { ...summary, courseKind } : null
    // NCS 는 lessonId 가 하위능력 이름(문서소통능력)이다. 그 단위 요점이 있으면
    // 그대로 쓴다 — 고른 것과 배우는 것이 같아야 한다.
    const exact = lessonId && lessonId !== '__all__' ? getSummary(lessonId) : null
    if (exact) return withCourse(exact)
    if (subjectId === 'ncs-basic' && areaId) {
      const area = getSummary(`area:${areaId}`)
      if (area) return withCourse({
        ...area,
        title: `${areaId} 영역 요점`,
        intro: `${areaId} 전체에서 꼭 알아야 할 것을 모았습니다.`
          + (lessonId && lessonId !== '__all__' ? ` ${lessonId}만이 아니라 영역 전체를 다룹니다.` : '')
          + '\n무엇을 기준으로 판단하고 무엇을 기억해야 하는지 중심으로 보세요.',
      })
    }
    return buildQuestionDrivenSummary({
      title: lessonLabel || '실전 개념 학습',
      questions: questionPool,
      courseKind,
    })
  }, [subjectId, areaId, lessonId, areas, lessons, questionPool])

  const contextQuestion = questionPool[questionIdx] ?? null
  const contextSummaryCards = useMemo(
    () => lessonSummary ? buildStudySummaryCards(lessonSummary, questionPool) : [],
    [lessonSummary, questionPool],
  )
  const contextSummaryCard = contextSummaryCards[learnCardStep] ?? null
  const contextAreaLabel = areas.find(area => area.id === areaId)?.label || areaId || ''
  const contextLessonLabel = lessonId === '__all__'
    ? `${contextAreaLabel} 전체 학습`
    : lessons.find(lesson => lesson.id === lessonId)?.label || contextQuestion?.lessonTitle || lessonId || ''
  const contextRevealed = studyMode === 'learn'
    ? Boolean(learnRevealed[contextQuestion?.id ?? questionIdx])
    : Boolean(gameChecked[questionIdx])

  useEffect(() => {
    onLearningContext?.({
      subject: subjectId,
      mode: 'study',
      stage: !areaId ? 'area-choice' : !lessonId ? 'lesson-choice' : (studyMode === 'learn' && lessonSummary ? 'concept' : 'question'),
      areaId,
      areaLabel: contextAreaLabel,
      lessonId,
      lessonLabel: contextLessonLabel,
      position: studyMode === 'learn' && lessonSummary ? learnCardStep + 1 : questionIdx + 1,
      total: studyMode === 'learn' && lessonSummary ? contextSummaryCards.length : questionPool.length,
      studyMode,
      revealed: contextRevealed,
      title: studyMode === 'learn' && lessonSummary
        ? summaryCardTitle(contextSummaryCard, lessonSummary)
        : contextQuestion?.stem || contextLessonLabel,
      questionId: contextQuestion?.id || null,
      content: studyMode === 'learn' && lessonSummary
        ? { kind: 'summary', summary: lessonSummary, card: contextSummaryCard }
        : { kind: 'question', question: contextQuestion },
    })
  }, [onLearningContext, subjectId, areaId, lessonId, contextAreaLabel, contextLessonLabel, studyMode, lessonSummary, contextSummaryCards.length, contextSummaryCard, learnCardStep, questionIdx, questionPool.length, contextQuestion, contextRevealed])

  function resetGame() { setGameAnswers({}); setGameResult(null); setGameChecked({}) }

  function selectArea(id) {
    setAreaId(id); setLessonId(null)
    setLearnIdx(0); setGameIdx(0); setLearnCardStep(0); resetGame()
  }
  function selectLesson(id) {
    setLessonId(id); setLearnIdx(0); setGameIdx(0); setLearnCardStep(0); resetGame()
  }
  function goQuestion(i) {
    if (studyMode === 'learn') setLearnIdx(i)
    else setGameIdx(i)
  }
  function switchMode(m) {
    if (m === studyMode) return
    if (m === 'game') { setGameIdx(0); resetGame() }
    setStudyMode(m)
  }

  // ── 터치 스와이프 ─────────────────────────────────────────────────────
  const [touchStartX, setTouchStartX] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)

  // ⚠️ 모든 Hook은 어떤 early return 보다 위에서 호출되어야 한다 (Rules of Hooks).
  //    아래 useEffect/useCallback이 네비게이션 뷰 early return 뒤에 있으면
  //    본문 진입 시 hook 개수가 바뀌어 "Rendered more hooks" 크래시가 난다.
  // 문항 변경 시 스크롤 최상단
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [questionIdx])

  const backRef = useRef(null)
  backRef.current = () => {
    if (showJump) { setShowJump(false); return }
    handleBack()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTouchStart(e) {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
  }
  function handleTouchEnd(e) {
    if (touchStartX === null) return
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    setTouchStartX(null); setTouchStartY(null)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const total = questionPool.length
    if (dx < 0 && questionIdx < total - 1) goQuestion(questionIdx + 1)
    else if (dx > 0 && questionIdx > 0) goQuestion(questionIdx - 1)
  }

  function computeAndShowResult() {
    const courseId = 1
    const lessonKey = lessonId ?? areaId
    const wrong = []
    let score = 0
    for (let i = 0; i < questionPool.length; i++) {
      const q  = questionPool[i]
      const qt = resolveType(q)
      // 연결형은 그동안 채점에서 빠져 있었다 — 풀 수 없는 문항이었기 때문이다.
      // 이제 눌러서 이을 수 있으므로 다른 유형과 똑같이 센다.
      if (qt === 'selfcheck' || qt === 'text') continue
      const sel = gameAnswers[i]
      let correct, cIdx
      if (qt === 'ox') {
        cIdx = isOXAnswerO(q) ? 0 : 1
        correct = sel === cIdx
      } else if (qt === 'matching') {
        correct = isMatchingCorrect(q, sel)
        cIdx = null
      } else if (qt === 'pulldown') {
        correct = isPulldownCorrect(q, sel)
        cIdx = null
      } else if (qt === 'multi') {
        const correctLetters = Array.isArray(q.answer) ? q.answer : [q.answer]
        const correctSet = new Set(correctLetters.map(l => l.charCodeAt(0) - 65))
        const selSet = new Set(Array.isArray(sel) ? sel : [])
        correct = correctSet.size === selSet.size && [...correctSet].every(x => selSet.has(x))
        cIdx = correctLetters.map(l => l.charCodeAt(0) - 65)
      } else {
        cIdx = answerIdx(q.answer)
        correct = sel === cIdx
      }
      if (correct) {
        score++
      } else {
        wrong.push({ q, myIdx: Array.isArray(sel) ? sel : (sel ?? null), correctIdx: cIdx, qNum: i + 1 })
        if (sel !== undefined && qt !== 'multi' && qt !== 'matching' && qt !== 'pulldown')
          saveWrongAnswer(q, courseId, String.fromCharCode(65 + sel))
      }
      if (sel !== undefined) {
        recordAnswer(subjectId, lessonKey, correct); recordQuestion(subjectId, q.id, correct)
        recordReview({ subject: subjectId, unitId: q.lessonId ?? q.area ?? areaId, itemId: q.id, demand: learningModeOf(q).id }, correct ? 4 : 1)  // 간격반복 확대(자율학습)
        noteStudied(subjectId, q.area ?? areaId)   // 오늘의 도전이 "요즘 공부한 곳"을 알도록
      }
    }
    const skipTypes = new Set(['selfcheck', 'text'])
    const mcqTotal = questionPool.filter(q => !skipTypes.has(resolveType(q))).length
    const xpEarned = score * 10
    if (xpEarned > 0) addXp(xpEarned, 'game_correct')
    setGameResult({ score, total: mcqTotal, wrong, xpEarned })
    recordActivity('quiz')
  }

  // ── 영역 선택 ─────────────────────────────────────────────────────────
  if (!areaId) {
    const selectedTrack = getRecruitTrack(trackId)
    return (
      <div className="screen">
        <div className="appbar">
          {onBack && (
            <button className="appbar-back" onClick={() => {
              if (subjectId === 'recruit-written' && trackId) setTrackId(null)
              else onBack()
            }}>←</button>
          )}
          <span className="appbar-title">{subject?.label ?? '학습하기'}</span>
        </div>
        <div className="screen-body">
          <p className="section-title">
            {subjectId === 'recruit-written' && !trackId ? '지원 분야 선택' : '영역 선택'}
          </p>
          {subjectId === 'ncs-basic' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '11px 13px', marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', marginBottom: 4 }}>고용노동부·한국산업인력공단 NCS 26v1</p>
              <CompactText text={'현행 7개 영역·21개 능력 기준\n공식 체계 순서로 표시\n임의 출제 비중 순위 아님'} maxItemChars={68} style={{ fontSize: 12.5, color: 'var(--text)' }} />
            </div>
          )}
          {subjectId === 'recruit-written' && !trackId && (
            <>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '11px 13px', marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>NCS 공식 평가와 분리된 채용 확장 교재</p>
                <CompactText text={'지원 기관 유형별 추가 필기영역 학습\n실제 출제 범위는 채용공고에서 최종 확인'} maxItemChars={68} style={{ fontSize: 12.5, color: 'var(--text)' }} />
              </div>
              {RECRUIT_WRITTEN_TRACKS.map(track => {
                const trackAreas = buildRecruitWrittenAreas(track.id, subject?.questions ?? [])
                const count = trackAreas.reduce((sum, area) => sum + area.qCount, 0)
                return (
                  <button key={track.id} onClick={() => setTrackId(track.id)}
                    style={{
                      width: '100%', textAlign: 'left', background: track.bg,
                      border: `1px solid ${track.color}55`, borderRadius: 14,
                      padding: '14px', marginBottom: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                    <span style={{ fontSize: 25, lineHeight: 1 }}>{track.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: track.color, marginBottom: 4 }}>{track.label}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{track.summary}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 5 }}>{track.notice}</span>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: track.color, marginTop: 6 }}>{count}문항 · {trackAreas.length}개 영역</span>
                    </span>
                    <span style={{ color: track.color, fontSize: 20 }}>›</span>
                  </button>
                )
              })}
            </>
          )}
          {subjectId === 'recruit-written' && selectedTrack && (
            <>
              <div style={{ background: selectedTrack.bg, border: `1px solid ${selectedTrack.color}55`, borderRadius: 12, padding: '11px 13px', marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: selectedTrack.color, marginBottom: 4 }}>{selectedTrack.icon} {selectedTrack.label}</p>
                <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>{selectedTrack.summary}</p>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 5 }}>{selectedTrack.notice}</p>
              </div>
              {trackId === 'public' && (
                <div style={{ background: 'var(--card)', border: '1px dashed #93c5fd', borderRadius: 12, padding: '11px 13px', marginBottom: 12 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 7 }}>지원공고 맞춤 준비 영역</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {['전공기초', '한국사·법', '기관상식'].map(label => (
                      <span key={label} style={{ fontSize: 12.5, fontWeight: 700, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '4px 8px' }}>
                        {label} · 공고 확인
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 7 }}>
                    현행 NCS와 겹치는 문항은 제외했습니다. 기관·직렬에 따라 별도로 출제되는 자원배분·조직이해·기술직 기초·고객서비스 역량만 제공합니다.
                  </p>
                </div>
              )}
            </>
          )}
          {areas.map(a => {
            const t = subjectId === 'ncs-basic' ? ncsTier(a.id) : null
            return (
              <button key={a.id} onClick={() => selectArea(a.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: t?.tier === 'core' ? t.bg : 'var(--card)',
                  border: `${t?.tier === 'core' ? '1.5px' : '1px'} solid ${t?.tier === 'core' ? t.border : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {t && (
                    <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: t.color, background: t.tier === 'core' ? '#fff' : t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: '2px 7px' }}>
                      {t.label}
                    </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {a.qCount ? `${a.qCount}문항 ` : a.lessons?.length > 0 ? `${a.lessons.length}단원 ` : ''}→
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 단원·하위능력 선택 ───────────────────────────────────────────────
  const selectedArea = areas.find(a => a.id === areaId)
  // 이 과목은 **3학년 인증진단** 대비다. 공식 평가틀의 직무적응은 160문항·40분인데
  // 1·2학년 자가진단 규모(80문항·20분)를 띄우고 있었다. 학생이 실제 시험의 절반
  // 분량만 겪고 "다 해봤다"고 여기게 된다. 규모를 시험에 맞춘다.
  // 직무적응은 영역을 누르면 곧장 검사로 들어갔다. 그래서 새로 만든
  // '검사 이해와 응답 전략' 학습 단원이 학생 눈에 아예 보이지 않았다.
  // 이제 단원 목록을 먼저 보여 주고, 검사 단원을 고를 때만 검사로 간다.
  if (subjectId === 'job-common' && areaId === '직무적응' && lessonId === 'JC26-JOB-ADAPTATION') {
    return <JobAdaptationScreen mode="full" onBack={() => setLessonId(null)} />
  }

  if (!lessonId && lessons.length > 0 && ['job-common', 'ncs-basic', 'recruit-written'].includes(subjectId)) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => { setAreaId(null); setLessonId(null) }}>←</button>
          <span className="appbar-title">{selectedArea?.label}</span>
        </div>
        <div className="screen-body">
          {/* 문제해결 단원은 시험의 4대 내용영역으로 세웠고 수준 배지가 없다.
              그런데도 "기초·표준·심화·보충 중에서 고르세요" 범례를 띄우면
              있지도 않은 것을 고르라는 안내가 된다. 단원에 수준이 붙은
              영역에서만 범례를 보이고, 아니면 시험 축을 설명한다. */}
          {/* 이 안내는 문제해결 평가틀 설명이다. 수준 배지가 없다는 이유만으로
              직무적응 영역에까지 띄우면 엉뚱한 설명이 붙는다. */}
          {subjectId === 'job-common' && areaId === '문제해결' && !lessons.some(l => l.level) && (
          <div style={{ background: '#f5f3ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #ddd6fe', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#5b21b6', marginBottom: 6 }}>시험이 묻는 네 갈래</p>
            <p style={{ fontSize: 12, color: '#6d28d9', lineHeight: 1.7 }}>
              인증진단의 문제해결은 <b>자원관리 · 정보활용 · 기술활용 · 시스템적 사고</b> 네 갈래로 출제됩니다.
              단원 안에서는 <b>문제인식 → 대안탐색 → 전략수립 → 평가·성찰</b> 순으로 이어집니다.
            </p>
          </div>
          )}
          {subjectId === 'job-common' && lessons.some(l => l.level) && (
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #bfdbfe', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', marginBottom: 6 }}>자율학습 수준 선택</p>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {['기초', '표준', '심화', '보충'].map((lv, i) => (
                <span key={lv} style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                  background: ['#dbeafe','#dcfce7','#fef9c3','#f1f5f9'][i],
                  color: ['#1d4ed8','#15803d','#b45309','#64748b'][i] }}>
                  {lv}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 6 }}>
              순서가 정해진 과정이 아닙니다. 원하는 수준과 단원을 직접 선택하세요.
            </p>
          </div>
          )}
          <button className="btn btn-secondary btn-full" style={{ marginBottom: 14 }}
            onClick={() => { setLessonId('__all__'); setLearnIdx(0); setGameIdx(0); resetGame() }}>
            이 영역 전체 학습 ({questionPool.length}문항)
          </button>
          <p className="section-title">{subjectId === 'ncs-basic' ? '하위 능력 선택' : '단원 선택'}</p>
          {lessons.map(l => {
            const cnt = subjectId === 'ncs-basic'
              ? (subject?.questions ?? []).filter(q => !q.excludeFromQuiz && q.ncsAbility === l.id).length
              : subjectId === 'recruit-written'
                ? (subject?.questions ?? []).filter(q =>
                    !q.excludeFromQuiz &&
                    q.recruitmentTrack === trackId &&
                    recruitAreaId(q.area) === areaId &&
                    recruitLessonTitle(q) === l.id
                  ).length
              : (subject?.questions ?? []).filter(
                  q => !q.excludeFromQuiz && jcLessonMatches(q, l.id)
                ).length
            const levelColor = {
              '진단': '#7e22ce', '기초': '#1d4ed8', '표준': '#15803d',
              '심화': '#b45309', '종합': '#b91c1c', '보충': '#64748b',
            }[l.level] ?? 'var(--text-muted)'
            const levelBg = {
              '진단': '#f3e8ff', '기초': '#dbeafe', '표준': '#dcfce7',
              '심화': '#fef9c3', '종합': '#fee2e2', '보충': '#f1f5f9',
            }[l.level] ?? 'var(--bg)'
            return (
              <button key={l.id} onClick={() => selectLesson(l.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'var(--card)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                {l.level && (
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                    background: levelBg, color: levelColor, flexShrink: 0 }}>
                    {l.level}
                  </span>
                )}
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1, lineHeight: 1.5 }}>{l.label}</span>
                {/* 검사 단원은 문제를 푸는 곳이 아니다. '0문항'으로 보이면
                    비어 있는 단원으로 오해한다. 검사 규모를 대신 보여 준다. */}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {l.kind === 'self-report' ? '160문항 · 40분 →' : `${cnt}문항 →`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 문항 없음 ─────────────────────────────────────────────────────────
  if (questionPool.length === 0) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={() => setLessonId(null)}>←</button>
          <span className="appbar-title">학습</span>
        </div>
        <div className="screen-body">
          {/* 정답 없는 자가진단 단원은 '문항이 없는' 것이 아니라 성격이 다르다.
              같은 빈 화면을 보여 주면 학생은 고장이라고 생각한다. */}
          {lessons.find(l => l.id === lessonId)?.kind === 'self-report' ? (
            <div className="card" style={{ maxWidth: 520, margin: '0 auto', padding: '20px 18px' }}>
              <p style={{ fontSize: 34, textAlign: 'center' }}>🧭</p>
              <p style={{ fontWeight: 800, fontSize: 16, textAlign: 'center', marginTop: 6 }}>
                정답이 없는 자가진단이에요
              </p>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 10 }}>
                직무적응은 맞고 틀리는 문제가 아니라, 6가지 요인에 대해 자신이
                평소 어떤 편인지 5점 척도로 답하는 진단입니다. 채점이 아니라
                <b> 내 성향을 보는 자료</b>라서 자율학습이 아닌 <b>진단평가·모의고사</b>에 있어요.
              </p>
              <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
                onClick={() => { setLessonId(null); setAreaId(null); onBack?.() }}>
                진단평가로 가기
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">📭</span>
              <span className="empty-state-title">학습 문항이 없습니다</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 게임 결과 화면 ────────────────────────────────────────────────────
  if (studyMode === 'game' && gameResult !== null) {
    const { score, total: mcqTotal, wrong, xpEarned } = gameResult
    const pct   = mcqTotal > 0 ? Math.round(score / mcqTotal * 100) : 0
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪'
    const grade = pct >= 90 ? 'S' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D'
    const gradeColor = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--primary)' : 'var(--danger)'
    const skipped = questionPool.filter(q => q.questionMode === 'selfcheck').length
    const unanswered = mcqTotal - score - wrong.filter(w => w.myIdx !== null).length

    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={handleBack}>←</button>
          <span className="appbar-title">🏆 게임 결과</span>
        </div>
        <div className="screen-body">
          {/* 점수 */}
          <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{emoji}</div>
            <p style={{ fontSize: 48, fontWeight: 800, color: gradeColor, lineHeight: 1, marginBottom: 4 }}>
              {pct}<span style={{ fontSize: 20, fontWeight: 600 }}>점</span>
            </p>
            <span className="badge" style={{ fontSize: 14, padding: '4px 16px', background: gradeColor, color: '#fff', borderRadius: 999 }}>
              등급 {grade}
            </span>
            {xpEarned > 0 && (
              <p style={{ fontSize: 14, color: '#F59E0B', fontWeight: 700, marginTop: 10 }}>
                🏆 +{xpEarned} XP 획득!
              </p>
            )}
          </div>

          {/* 요약 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              { label: '정답', value: score,                     color: 'var(--success)' },
              { label: '오답', value: wrong.filter(w => w.myIdx !== null).length, color: 'var(--danger)'  },
              { label: '미선택', value: unanswered,              color: 'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--card)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
          {skipped > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, textAlign: 'center' }}>
              ※ 서술형 {skipped}문항은 게임 모드 채점에서 제외되었습니다.
            </p>
          )}

          {/* 약점 영역 추천 배너 */}
          {(() => {
            if (wrong.length === 0) return null
            const areaCounts = {}
            wrong.forEach(w => {
              const area = w.q?.area || w.q?.lessonTitle || '기타'
              areaCounts[area] = (areaCounts[area] || 0) + 1
            })
            const sorted = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
            return (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', marginBottom: 8 }}>📌 집중 보완 권장 영역</p>
                {sorted.map(([area, cnt]) => (
                  <div key={area} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{area}</span>
                    <span style={{ fontSize: 12, background: '#fee2e2', color: '#b91c1c', borderRadius: 20, padding: '2px 9px', fontWeight: 700 }}>
                      오답 {cnt}문항
                    </span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: '#ea580c', marginTop: 6 }}>
                  위 영역의 <strong>학습 모드</strong>로 돌아가 요점정리와 오답 문항을 복습하세요.
                </p>
              </div>
            )
          })()}

          {/* 오답 목록 */}
          {wrong.length > 0 && (
            <>
              <p className="section-title">오답 확인 ({wrong.length}문항) — 오답노트에 자동 저장됨</p>
              {wrong.map((w, i) => <WrongItemResult key={i} w={w} />)}
            </>
          )}
          {wrong.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>🏆 오답이 없습니다! 완벽합니다!</p>
            </div>
          )}

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary btn-full"
              onClick={() => { setGameIdx(0); resetGame() }}>
              🔄 다시 도전 (1번부터)
            </button>
            <button className="btn btn-secondary btn-full"
              onClick={() => { setStudyMode('learn'); resetGame() }}>
              📖 학습 모드로 오답 복습
            </button>
            <button className="btn btn-ghost btn-full"
              onClick={() => { resetGame(); setLessonId(null); setAreaId(null) }}>
              ← 단원 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 문항 뷰 ──────────────────────────────────────────────────────────
  const q          = questionPool[questionIdx]
  const total      = questionPool.length
  const qType      = resolveType(q)
  const isSelf     = qType === 'selfcheck'
  const isOX       = qType === 'ox'
  const isMatching = qType === 'matching'
  const isMulti    = qType === 'multi'
  const isPulldown = qType === 'pulldown'
  const isTextType = qType === 'text'
  // 연결형은 이제 직접 풀고 채점받는다. 보기만 하는 유형에서 뺀다.
  const isReviewOnly = isSelf || isTextType
  const isLearn    = studyMode === 'learn'
  const correctIdx = isOX ? (isOXAnswerO(q) ? 0 : 1)
    : (isMulti || isMatching || isTextType) ? null
    : answerIdx(q?.answer)

  const backTitle = lessonId && lessonId !== '__all__'
    ? lessons.find(l => l.id === lessonId)?.label ?? '학습'
    : selectedArea?.label ?? '학습'

  function handleBack() {
    setShowJump(false)
    if (gameResult) { resetGame(); return }
    if (lessonId) { setLessonId(null); return }
    if (areaId) { setAreaId(null); return }
    if (subjectId === 'recruit-written' && trackId) { setTrackId(null); return }
    onBack?.()
  }

  const currentGameAnswer = gameAnswers[questionIdx]
  // 연결형은 짝을 하나만 이어도 gameAnswers 에 값이 생긴다. 그것까지 '답함'으로
  // 세면 "3/87 답함"이 실제보다 앞서 나가 학생이 다 푼 줄 안다. 다 이었을 때만 센다.
  const answeredCount = Object.entries(gameAnswers).filter(([i, v]) => {
    const qq = questionPool[Number(i)]
    const tt = resolveType(qq)
    if (tt === 'matching') return v && Object.keys(v).length === (qq?.pairs?.length ?? 0)
    if (tt === 'pulldown') return v && (qq?.blanks ?? []).every((_, k) => v[k] != null)
    return v !== undefined
  }).length
  // 채점된 것 중 맞힌 수. "몇 개 선택"만 보여 주면 잘하고 있는지 알 수 없다.
  const gameCorrect = Object.keys(gameChecked).filter(i => {
    const qq = questionPool[i]
    if (!qq || gameAnswers[i] === undefined) return false
    return gameAnswers[i] === answerIdx(qq.answer)
  }).length
  const isLastQ           = questionIdx === total - 1
  const currentChecked    = gameChecked[questionIdx] ?? false
  // 학습(game) 모드에서 답을 골랐으나 아직 '확인' 안 한 객관식/OX/multi → 확인 단계
  const hasSelection = isMulti
    ? Array.isArray(currentGameAnswer) && currentGameAnswer.length > 0
    : isMatching
      ? currentGameAnswer && Object.keys(currentGameAnswer).length === (q?.pairs?.length ?? 0)
      : isPulldown
        ? currentGameAnswer && (q?.blanks ?? []).every((_, i) => currentGameAnswer[i] != null)
        : currentGameAnswer !== undefined
  const needCheckGame = !isLearn && !currentChecked && (isReviewOnly || hasSelection)


  if (isLearn && lessonSummary) {
    return (
      <div className="screen">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 44,
          borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
        }}>
          <button onClick={handleBack}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--primary)', padding: '0 4px', flexShrink: 0 }}>←</button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📖 {backTitle}
          </span>
          <StudyModeToggle mode={studyMode} onChange={switchMode} compact />
        </div>
        {/* 요점정리 화면에도 같은 띠를 띄운다. 한쪽에만 있으면 "두 모드가
            뭐가 다른지 모르겠다"는 말을 그대로 듣게 된다. */}
        <StudyModeStrip mode={studyMode} />
        <div className="screen-body">
          <StudySummary
            summary={lessonSummary}
            questions={questionPool}
            initialStep={learnCardStep}
            onStepChange={setLearnCardStep}
            onStartQuiz={() => switchMode('game')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ position: 'relative' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px', height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button onClick={handleBack}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--primary)', minWidth: 44, minHeight: 44, padding: 0, flexShrink: 0 }}>
          ←
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {backTitle}
        </span>
        <StudyModeToggle mode={studyMode} onChange={switchMode} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
          {questionIdx + 1}/{total}
        </span>
      </div>

      {/* 진행 바 */}
      <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{ height: '100%', background: 'var(--primary)', width: `${((questionIdx + 1) / total) * 100}%`, transition: 'width 0.2s' }} />
      </div>

      {/* 지금이 어떤 자리인지 알려 주는 띠. 익히기에도 띄운다 —
          "기록이 남지 않는다"는 사실은 게임 모드 설명만큼 중요하다. */}
      <StudyModeStrip
        mode={studyMode}
        right={isLearn ? null : `${gameCorrect}개 맞힘 · ${answeredCount}/${total}`} />

      {/* 콘텐츠 */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 8px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {q?.isAGrade && <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 12, fontWeight: 800 }}>🔥 빈출</span>}
          {/* 교육부 인증 과목에서는 인증 영역과 평가틀 단계를 보여 준다.
              원래는 문항의 area 필드를 그대로 띄웠는데, 그 값이 NCS 능력
              이름(자기개발능력·조직이해능력 …)이라 "교육부 인증인데 왜
              자기개발능력?"이 됐다. 두 시험은 이름만 비슷할 뿐 다르다. */}
          {subjectId === 'job-common'
            ? <>
                {q?.officialArea && <span className="badge badge-blue">{q.officialArea}</span>}
                {q?.teenupBlueprint?.process && (
                  <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #ddd6fe' }}>
                    {q.teenupBlueprint.process}
                  </span>
                )}
              </>
            : q?.area && <span className="badge badge-blue">{q.area}</span>}
          {q?.lessonTitle && <span className="badge badge-gray" style={{ fontSize: 12 }}>{q.lessonTitle}</span>}
          {isSelf     && <span className="badge badge-yellow">서술형</span>}
          {/* O/X 는 교육부 인증진단의 공식 문항 유형이 아니다(공식은 선택형·듣기·
              끌어다놓기·풀다운·단답형·멀티체크형). 개념을 빠르게 확인하는 데는
              쓸모가 있어 학습에는 남기되, 시험에 나온다고 오해하지 않도록
              인증 과목에서는 학습 전용임을 밝힌다. 시험지에는 들어가지 않는다. */}
          {isOX && (
            <span className="badge badge-green">
              {subjectId === 'job-common' ? 'O/X · 학습 전용' : 'O/X'}
            </span>
          )}
          {/* 세트 문항 — 같은 자료로 이어 푸는 형식임을 알려 준다. 실제
              인증진단에서는 박스로 묶여 첫 문항부터 순서대로 풀게 되어 있다. */}
          {q?.setId && (
            <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 12 }}>
              🔗 세트 {q.setOrder}/{q.setTotal}
            </span>
          )}
          {qType === 'pulldown' && <span className="badge" style={{ background: '#e0f2f1', color: '#00695c', border: '1px solid #80cbc4', fontSize: 12 }}>풀다운</span>}
          {isMatching && <span className="badge" style={{ background: '#e3f0ff', color: '#1565c0', border: '1px solid #90caf9', fontSize: 12 }}>연결형</span>}
          {isMulti    && <span className="badge" style={{ background: '#f3e5f5', color: '#6a1b9a', border: '1px solid #ce93d8', fontSize: 12 }}>복수선택</span>}
          {isTextType && <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', fontSize: 12 }}>단답형</span>}
        </div>

        {isLearn && (
          <LearnCard
            q={q}
            qType={qType}
            correctIdx={correctIdx}
            revealed={!!learnRevealed[q?.id ?? questionIdx]}
            onReveal={() => setLearnRevealed(prev => ({
              ...prev,
              [q?.id ?? questionIdx]: true,
            }))}
          />
        )}
        {isLearn && q && learnRevealed[q?.id ?? questionIdx] && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>이 문항 자기평가</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { s: 'done',    label: '✅ 알아요',  bg: '#d1fae5', color: '#065f46' },
                { s: 'partial', label: '△ 헷갈려요', bg: '#fef3c7', color: '#92400e' },
                { s: 'review',  label: '❌ 모르겠어', bg: '#fee2e2', color: '#991b1b' },
              ].map(({ s, label, bg, color }) => {
                const cur = ssProgress[q.id] === s
                return (
                  <button key={s} onClick={() => markSSProgress(q.id, s)}
                    style={{
                      padding: '8px 4px', minHeight: 44, borderRadius: 10,
                      border: `2px solid ${cur ? color : 'transparent'}`,
                      background: cur ? bg : 'var(--card)',
                      color: cur ? color : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {!isLearn && (
          <GameCard
            q={q} qType={qType}
            selectedAnswer={currentGameAnswer}
            checked={currentChecked}
            correctIdx={correctIdx}
            onSelect={ci => {
              if (currentChecked) return
              if (isMulti) {
                setGameAnswers(prev => {
                  const cur = Array.isArray(prev[questionIdx]) ? prev[questionIdx] : []
                  return { ...prev, [questionIdx]: cur.includes(ci) ? cur.filter(x => x !== ci) : [...cur, ci] }
                })
              } else {
                setGameAnswers(prev => ({ ...prev, [questionIdx]: ci }))
              }
            }}
          />
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button className="btn btn-ghost" style={{ flex: 1, minHeight: 44, padding: '10px 0' }}
          disabled={questionIdx === 0}
          onClick={() => goQuestion(questionIdx - 1)}>
          ← 이전
        </button>
        <button onClick={() => setShowJump(v => !v)}
          style={{
            minHeight: 44, padding: '10px 14px', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)',
          }}>
          {questionIdx + 1}/{total}
        </button>
        {needCheckGame ? (
          <button className="btn btn-primary" style={{ flex: 1, minHeight: 44, padding: '10px 0' }}
            onClick={() => setGameChecked(prev => ({ ...prev, [questionIdx]: true }))}>
            {isReviewOnly ? '정답·해설 확인' : '확인하기'}
          </button>
        ) : !isLearn && isLastQ ? (
          <button className="btn btn-primary" style={{ flex: 1, minHeight: 44, padding: '10px 0', background: 'var(--success)' }}
            onClick={computeAndShowResult}>
            결과 보기 🏆
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1, minHeight: 44, padding: '10px 0' }}
            disabled={isLearn ? questionIdx === total - 1 : false}
            onClick={() => {
              if (isLearn && questionIdx === total - 1) return
              if (!isLearn && isLastQ) return
              goQuestion(questionIdx + 1)
            }}>
            {isLearn && questionIdx === total - 1 ? '완료 ✅' : '다음 →'}
          </button>
        )}
      </div>

      {/* 번호 이동 바텀시트 */}
      {showJump && (
        <>
          <div onClick={() => setShowJump(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--card)', borderRadius: '18px 18px 0 0',
            border: '1px solid var(--border)', padding: '16px 14px 28px',
            zIndex: 100, maxHeight: '45vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>문항 이동 · 전체 {total}문항</span>
              <button onClick={() => setShowJump(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {questionPool.map((qq, i) => {
                const answered = !isLearn && gameAnswers[i] !== undefined
                const pStatus  = isLearn ? ssProgress[qq.id] : null
                const bg = i === questionIdx ? 'var(--primary)'
                  : answered       ? '#e8f5e9'
                  : pStatus === 'done'    ? '#d1fae5'
                  : pStatus === 'partial' ? '#fef3c7'
                  : pStatus === 'review'  ? '#fee2e2'
                  : 'var(--card)'
                const bdr = i === questionIdx ? 'var(--primary)' : answered ? 'var(--success)' : pStatus ? 'transparent' : 'var(--border)'
                return (
                  <button key={i} onClick={() => { goQuestion(i); setShowJump(false) }}
                    style={{
                      width: 42, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700,
                      border: `2px solid ${bdr}`, background: bg,
                      color: i === questionIdx ? '#fff' : 'var(--text)',
                      cursor: 'pointer',
                    }}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            {!isLearn && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                녹색 = 선택 완료 · 흰색 = 미선택
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── 게임 결과 오답 항목 ────────────────────────────────────────────────────
function WrongItemResult({ w }) {
  const [expanded, setExpanded] = useState(false)
  const { q, myIdx, correctIdx, qNum } = w
  return (
    <div className="card" style={{ marginBottom: 8, borderLeft: '4px solid var(--danger)' }}>
      <button onClick={() => setExpanded(v => !v)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{myIdx === null ? '⬜' : '❌'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>Q{qNum}. {parseStem(q.stem).question}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {q.area && <span className="badge badge-gray" style={{ fontSize: 12 }}>{q.area}</span>}
              {q.lessonTitle && <span className="badge badge-gray" style={{ fontSize: 12 }}>{q.lessonTitle}</span>}
              {myIdx === null && <span className="badge" style={{ background: '#fff3e0', color: '#e65100', fontSize: 12 }}>미선택</span>}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {q.choices?.map((text, ci) => {
            const isCorrect  = ci === correctIdx
            const isSelected = ci === myIdx
            return (
              <p key={ci} style={{
                fontSize: 13, padding: '3px 0',
                color: isCorrect ? 'var(--success)' : isSelected ? 'var(--danger)' : 'var(--text-muted)',
                fontWeight: isCorrect || isSelected ? 700 : 400,
              }}>
                {isSelected ? '▶ ' : isCorrect ? '✓ ' : '　'}{ci + 1}. {text}
                {isCorrect && ' ← 정답'}{isSelected && !isCorrect && ' ← 내 답'}
              </p>
            )
          })}
          {q.explanation && (
            <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>💡 해설</p>
              <ExplanationBullets text={q.explanation} />
            </div>
          )}
          {q.teachingNote && (
            <div style={{ background: '#f3e5f5', borderRadius: 8, padding: '8px 12px', marginTop: 8, border: '1px solid #ce93d8' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 3 }}>⭐ 학습 포인트</p>
              <CompactText text={q.teachingNote} maxItemChars={68} style={{ fontSize: 12, color: '#4a148c' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── stem 파싱: 레벨 접두사·내장 상황글·힌트 분리 ─────────────────────────────
function parseStem(stem) {
  if (!stem) return { question: '', embCtx: null, hint: null }
  let s = stem.trim()
  const levelMatch = s.match(/^(기초|표준|심화|진단|종합)\s*수준?\s*\d+번\s*/)
  if (levelMatch) s = s.slice(levelMatch[0].length).trim()
  const mjIdx = s.indexOf('문제.')
  if (mjIdx > 5) {
    const preamble = s.slice(0, mjIdx).trim()
    let rest = s.slice(mjIdx + 3).trim()
    let hint = null
    const hIdx = rest.lastIndexOf('※')
    if (hIdx >= 0) { hint = rest.slice(hIdx + 1).trim(); rest = rest.slice(0, hIdx).trim() }
    const cm = rest.match(/^([\s\S]+?\?)\s*(?:[A-E①-⑤][\.\s])/)
    if (cm) rest = cm[1].trim()
    return { question: rest, embCtx: preamble || null, hint }
  }
  const lastQ = s.lastIndexOf('?')
  if (lastQ > 0 && lastQ < s.length - 3) {
    const tail = s.slice(lastQ + 1).trim()
    if (tail.length > 0) {
      if (/^[📝📌💡🔔]|^[※]|^문제 해결|^핵심 정보|^학습 포인트|^상황 파악|^풀이 전략|^\[학습/.test(tail))
        return { question: s.slice(0, lastQ + 1).trim(), embCtx: null, hint: tail }
      if (/^[📢📋【\[]|^전 직원|^수신:|^제목:|^날짜:/.test(tail))
        return { question: s.slice(0, lastQ + 1).trim(), embCtx: tail, hint: null }
    }
  }
  return { question: s, embCtx: null, hint: null }
}

// ── 개조식 해설 렌더링 ────────────────────────────────────────────────────────
function ExplanationBullets({ text }) {
  return <CompactText text={text} maxItemChars={74} style={{ fontSize: 13 }} />
}

// ── NCS 레슨 보조 자료 ──────────────────────────────────────────────────────
function NCSLessonExtras({ extras }) {
  const [open, setOpen] = useState(false)
  if (!extras) return null
  const { studyPoints, strategy, supplement } = extras
  if (!studyPoints && !strategy && !supplement) return null
  return (
    <div style={{ border: '1px solid #c5b3e8', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: '#f3e5f5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a' }}>📌 이 레슨 학습 보조</span>
        <span style={{ fontSize: 12, color: '#6a1b9a' }}>{open ? '▲ 접기' : '▼ 열기'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', background: '#fdf7ff', borderTop: '1px solid #c5b3e8' }}>
          {studyPoints && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 }}>🔑 학습 포인트</p>
              <CompactText text={studyPoints} maxItemChars={70} style={{ fontSize: 12, color: '#4a148c' }} />
            </div>
          )}
          {strategy && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 4 }}>🏆 고득점 전략</p>
              <CompactText text={strategy} maxItemChars={70} style={{ fontSize: 12, color: '#0d47a1' }} />
            </div>
          )}
          {supplement && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>📚 수준별 보충 학습</p>
              <CompactText text={supplement} maxItemChars={70} style={{ fontSize: 12, color: '#1b5e20' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 학습 카드 (먼저 생각한 뒤 답·해설 공개) ──────────────────────────────────
function LearnCard({ q, qType, correctIdx, revealed, onReveal }) {
  const isSelf = qType === 'selfcheck'
  const isOX = qType === 'ox'
  const isMatching = qType === 'matching'
  const isMulti = qType === 'multi'
  const isTextType = qType === 'text'
  const oIsO = isOX && isOXAnswerO(q)
  const correctLetters = isMulti && Array.isArray(q?.answer) ? new Set(q.answer) : null
  const { question: stemQ, embCtx, hint: stemHint } = parseStem(q?.stem)
  const ctxText = q?.context || embCtx

  if (!revealed) {
    return (
      <div>
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: '12px 14px', border: '2px solid var(--primary)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', letterSpacing: 0.5 }}>[문제]</p>
            {/* 이 문항을 어떻게 다뤄야 하는지 — 읽기 전에 알려 준다. */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              <DemandChip q={q} /><DifficultyBadge q={q} />
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, fontWeight: 700 }}>{stemQ}</p>
        </div>
        <ListeningPrompt key={q?.id} q={q} revealTranscript={false} />
        <QuestionMedia q={q} />
        {ctxText && (
          <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #c7d7f5', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#3b5bdb', marginBottom: 6 }}>📋 지문 / 상황</p>
            <p style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#1a237e' }}>{ctxText}</p>
          </div>
        )}
        {(qType === 'choice' || isMulti) && (
          <div style={{ marginBottom: 12 }}>
            {isMulti && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>해당하는 것을 모두 생각해 보세요 (복수선택)</p>
            )}
            {q?.choices?.map((text, ci) => (
              <div key={ci} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                background: 'var(--card)', border: '2px solid var(--border)',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: isMulti ? 4 : '50%', flexShrink: 0,
                  background: 'var(--border)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                }}>{isMulti ? String.fromCharCode(65 + ci) : ci + 1}</span>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{text}</p>
              </div>
            ))}
          </div>
        )}
        {isOX && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {['O', 'X'].map(mark => (
              <div key={mark} style={{
                padding: '14px', borderRadius: 12, textAlign: 'center',
                background: 'var(--card)', border: '2px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 28, fontWeight: 800,
              }}>{mark}</div>
            ))}
          </div>
        )}
        {isMatching && q?.pairs?.length > 0 && (
          <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '11px 14px', border: '1px solid #c7d7f5', marginBottom: 12 }}>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#3b5bdb' }}>
              실제 인증진단에서는 <b>보기를 끌어다 정해진 자리에 놓는</b> 형태로 나옵니다.
              여기서는 눌러서 이어 보세요 — 도전하기에서 직접 풀 수 있습니다.
            </p>
          </div>
        )}
        {(isTextType || isSelf) && (
          <div style={{ background: '#fff8df', borderRadius: 10, padding: '11px 14px', border: '1px solid #ffc107', marginBottom: 12 }}>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#6f5700' }}>답을 먼저 생각하거나 적어 본 뒤 정답과 해설을 확인해 보세요.</p>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          aria-expanded="false"
          onClick={onReveal}
          style={{ width: '100%', padding: '12px 0', marginBottom: 8 }}
        >
          정답·해설 펼치기
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: '12px 14px', border: '2px solid var(--primary)', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 5, letterSpacing: 0.5 }}>[문제]</p>
        <p style={{ fontSize: 14, lineHeight: 1.8, fontWeight: 700 }}>{stemQ}</p>
      </div>
      <ListeningPrompt key={q?.id} q={q} revealTranscript />
      <QuestionMedia q={q} />
      {ctxText && (
        <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #c7d7f5', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#3b5bdb', marginBottom: 6 }}>📋 지문 / 상황</p>
          <p style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#1a237e' }}>{ctxText}</p>
        </div>
      )}

      {/* choice */}
      {qType === 'choice' && (
        <div style={{ marginBottom: 12 }}>
          {q?.choices?.map((text, ci) => {
            const correct = ci === correctIdx
            return (
              <div key={ci} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                background: correct ? '#e8f5e9' : 'transparent',
                border: `2px solid ${correct ? 'var(--success)' : 'var(--border)'}`,
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, flexShrink: 0, lineHeight: 1.5, color: correct ? 'var(--success)' : 'var(--text-muted)' }}>
                  {correct ? '✓' : `${ci + 1}.`}
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: correct ? '#1b5e20' : 'var(--text-muted)', fontWeight: correct ? 700 : 400 }}>
                  {text}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* OX */}
      {isOX && (
        <div style={{
          padding: '16px', marginBottom: 12, borderRadius: 12, textAlign: 'center',
          background: oIsO ? '#e8f5e9' : '#ffebee',
          border: `2px solid ${oIsO ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          <p style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: oIsO ? 'var(--success)' : 'var(--danger)' }}>
            {oIsO ? 'O' : 'X'}
          </p>
          <p style={{ fontSize: 12, marginTop: 6, color: oIsO ? '#1b5e20' : '#b71c1c' }}>
            {oIsO ? '맞다 (옳은 설명)' : '틀리다 (잘못된 설명)'}
          </p>
        </div>
      )}

      {/* 연결형 */}
      {isMatching && q?.pairs?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 8 }}>🔗 연결 관계</p>
          {q.pairs.map((pair, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '8px 12px', marginBottom: 6, borderRadius: 10,
              background: '#e3f0ff', border: '1px solid #90caf9',
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1565c0' }}>{pair.left}</span>
              <span style={{ color: '#90caf9', fontWeight: 800, flexShrink: 0 }}>→</span>
              <span style={{ flex: 1, fontSize: 13, color: '#0d47a1', textAlign: 'right' }}>{pair.right}</span>
            </div>
          ))}
        </div>
      )}

      {/* 복수선택형 */}
      {isMulti && (
        <div style={{ marginBottom: 12 }}>
          {q?.choices?.map((text, ci) => {
            const letter = String.fromCharCode(65 + ci)
            const correct = correctLetters?.has(letter)
            return (
              <div key={ci} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                background: correct ? '#e8f5e9' : 'transparent',
                border: `2px solid ${correct ? 'var(--success)' : 'var(--border)'}`,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 1,
                  background: correct ? 'var(--success)' : 'var(--border)',
                  color: correct ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                }}>{correct ? '✓' : letter}</span>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: correct ? '#1b5e20' : 'var(--text-muted)', fontWeight: correct ? 700 : 400 }}>
                  {text}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* 단답형 */}
      {isTextType && (
        <div style={{
          background: '#e8f5e9', borderRadius: 12, padding: '14px 16px',
          border: '2px solid var(--success)', marginBottom: 12, textAlign: 'center',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>정답</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{q?.answer}</p>
        </div>
      )}

      {isSelf && q?.modelAnswer && (
        <div style={{ background: '#fff8df', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffc107', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#856404', marginBottom: 6 }}>📖 모범답안</p>
          <p style={{ fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{q.modelAnswer}</p>
        </div>
      )}
      {stemHint && (
        <div style={{ background: '#fff8df', borderRadius: 10, padding: '11px 14px', border: '1px solid #ffc107', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#856404', marginBottom: 5 }}>💡 학습 포인트</p>
          <CompactText text={stemHint} maxItemChars={68} style={{ fontSize: 12, color: '#3e3422' }} />
        </div>
      )}
      {q?.explanation && !q?.teacherHints && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--primary)', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>💡 해설</p>
          <ExplanationBullets text={q.explanation} />
        </div>
      )}
      {isSelf && <FullAnswerDetails q={q} />}
      {q?.lessonId && <NCSLessonExtras extras={ncsExtrasMap.get(q.lessonId)} />}
      {q?.teachingNote && (
        <div style={{ background: '#f3e5f5', borderRadius: 10, padding: '10px 14px', border: '1px solid #ce93d8' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 }}>⭐ 학습 포인트</p>
          <CompactText text={q.teachingNote} maxItemChars={68} style={{ fontSize: 12, color: '#4a148c' }} />
        </div>
      )}
    </div>
  )
}

// ── 완전 학습 자료 ───────────────────────────────────────────────────────────
function FullAnswerDetails({ q }) {
  if (!q?.teacherHints && !q?.sourceGuidance && !q?.scoringPoints && !q?.keyTerms) return null
  return (
    <div style={{ marginTop: 8 }}>
      {q.teacherHints?.length > 0 && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--primary)', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>💡 학습 힌트</p>
          {q.teacherHints.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'var(--primary)', color: '#fff', flexShrink: 0, height: 'fit-content', marginTop: 2 }}>{h.label}</span>
              <CompactText text={h.text} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text)' }} />
            </div>
          ))}
        </div>
      )}
      {q.scoringPoints?.length > 0 && (
        <div style={{ background: '#edf9f3', borderRadius: 10, padding: '10px 14px', border: '1px solid #b9d4c2', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e6f5c', marginBottom: 6 }}>✅ 채점 포인트</p>
          {q.scoringPoints.map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#1e6f5c', fontWeight: 700, flexShrink: 0 }}>•</span>
              <CompactText text={pt} maxItemChars={68} style={{ fontSize: 12 }} />
            </div>
          ))}
        </div>
      )}
      {q.sourceGuidance && (
        <div style={{ background: '#f8f4ff', borderRadius: 10, padding: '10px 14px', border: '1px solid #c5b3e8', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 6 }}>📋 근거 수행준거</p>
          {q.sourceGuidance.criterion && (
            <CompactText text={q.sourceGuidance.criterion} maxItemChars={68} style={{ fontSize: 12, marginBottom: 8, color: '#4a148c' }} />
          )}
          {[
            { key: 'checkItems',     label: '✓ 확인할 것' },
            { key: 'reportItems',    label: '✓ 기록·보고' },
            { key: 'answerTemplate', label: '✓ 답안으로 말하기' },
          ].filter(({ key }) => q.sourceGuidance[key]).map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 2 }}>{label}</p>
              <CompactText text={q.sourceGuidance[key]} maxItemChars={68} style={{ fontSize: 12, paddingLeft: 8 }} />
            </div>
          ))}
        </div>
      )}
      {q.keyTerms?.length > 0 && (
        <div style={{ background: '#fff3e0', borderRadius: 10, padding: '10px 14px', border: '1px solid #ffcc80' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#e65100', marginBottom: 6 }}>📖 핵심 용어</p>
          {q.keyTerms.map((kt, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#bf360c' }}>{kt.term}</span>
              {kt.definition && <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>: {kt.definition}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 즉시 정답 피드백 (게임/학습 모드, 확인 후) ───────────────────────────────
/** 유형에 맞게 정오를 판정한다.
 *
 * 그동안 '고른 보기 번호 === 정답 번호'만 봤다. 번호로 답하지 않는 유형
 * (연결형은 짝 맞추기, 풀다운은 여러 칸 채우기)은 그래서 정답을 맞혀도
 * 늘 오답으로 표시되고 "정답: NaN" 이 떴다. */
function isAnswerRight(q, qType, sel, correctIdx, correctLetters) {
  if (qType === 'matching') return isMatchingCorrect(q, sel)
  if (qType === 'pulldown') return isPulldownCorrect(q, sel)
  if (qType === 'multi') {
    return !!(correctLetters && Array.isArray(sel) &&
      correctLetters.size === sel.length &&
      sel.every(ci => correctLetters.has(String.fromCharCode(65 + ci))))
  }
  return sel === correctIdx
}

function GameFeedback({ q, qType, correct }) {
  const isOX = qType === 'ox'
  const isMulti = qType === 'multi'
  const cIdx = isOX ? (isOXAnswerO(q) ? 0 : 1) : isMulti ? null : answerIdx(q.answer)
  let correctText
  if (isOX) correctText = isOXAnswerO(q) ? 'O (맞다)' : 'X (틀리다)'
  else if (isMulti) correctText = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer
  // 연결형·풀다운은 정답을 각자의 판에서 이미 표시한다. 번호로 다시 적으면
  // 존재하지 않는 보기를 가리켜 "정답: NaN" 이 된다.
  else if (qType === 'matching' || qType === 'pulldown') correctText = null
  else correctText = `${(cIdx ?? 0) + 1}. ${q.choices?.[(cIdx ?? 0)] ?? ''}`
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
        background: correct ? '#e8f5e9' : '#ffebee',
        border: `1.5px solid ${correct ? 'var(--success)' : 'var(--danger)'}`,
      }}>
        <p style={{ fontWeight: 800, fontSize: 14, color: correct ? 'var(--success)' : 'var(--danger)' }}>
          {correct ? '✅ 정답이에요!' : '❌ 아쉬워요 — 정답을 기억해 두세요'}
        </p>
        {!correct && correctText && (
          <p style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
            정답: <span style={{ color: 'var(--success)' }}>{correctText}</span>
          </p>
        )}
        {!correct && !correctText && (
          <p style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-muted)' }}>
            위 표에서 맞는 답을 확인하세요.
          </p>
        )}
      </div>
      {q.explanation && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--primary)', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>💡 해설</p>
          <ExplanationBullets text={q.explanation} />
        </div>
      )}
      {q.keyTerms?.length > 0 && (
        <div style={{ background: '#fff3e0', borderRadius: 10, padding: '10px 14px', border: '1px solid #ffcc80' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#e65100', marginBottom: 6 }}>🔑 꼭 외울 핵심 용어</p>
          {q.keyTerms.map((kt, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#bf360c' }}>{typeof kt === 'string' ? kt : kt.term}</span>
              {typeof kt !== 'string' && kt.definition && (
                <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>: {kt.definition}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 게임 카드 (선택 → 확인 시 즉시 정답·해설 공개) ───────────────────────────
function GameCard({ q, qType, selectedAnswer, checked, correctIdx, onSelect }) {
  const isSelf = qType === 'selfcheck'
  const isOX = qType === 'ox'
  const isMatching = qType === 'matching'
  const isMulti = qType === 'multi'
  const isTextType = qType === 'text'
  // 연결형은 더 이상 '보고 지나가는' 유형이 아니다. 직접 이어서 채점받는다.
  const skipType = isSelf || isTextType
  const correctLetters = isMulti && Array.isArray(q?.answer) ? new Set(q.answer) : null
  const { question: stemQ, embCtx, hint: stemHint } = parseStem(q?.stem)
  const ctxText = q?.context || embCtx

  if (skipType) {
    const label = isSelf ? '서술형' : '단답형'
    const color = isSelf ? '#856404' : '#2e7d32'
    const bg    = isSelf ? '#fff8df' : '#e8f5e9'
    const bd    = isSelf ? '#ffc107' : '#a5d6a7'
    return (
      <div>
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', border: '2px solid var(--primary)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>[문제]</p>
            {/* 두 표시는 축이 다르다 — 난이도(기본기·심화)와 다루는 방법(찾아 읽기·근거 세우기).
                모드를 바꿨다고 표시가 바뀌면 학생은 같은 문항이 달라진 줄 안다. 둘 다 늘 보인다. */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              <DemandChip q={q} /><DifficultyBadge q={q} />
            </div>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{stemQ}</p>
        </div>
        <ListeningPrompt key={q?.id} q={q} revealTranscript={checked} />
        <QuestionMedia q={q} />
        {!checked && (
          <div style={{ background: '#fff8df', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffc107' }}>
            <p style={{ fontSize: 12, color, lineHeight: 1.7 }}>
              답을 먼저 생각한 뒤 아래의 <b>정답·해설 확인</b>을 눌러 확인하세요.
            </p>
          </div>
        )}
        {checked && isMatching && q?.pairs?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {q.pairs.map((pair, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', marginBottom: 6, borderRadius: 10, background: '#e3f0ff', border: '1px solid #90caf9' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1565c0' }}>{pair.left}</span>
                <span style={{ color: '#90caf9', fontWeight: 800 }}>→</span>
                <span style={{ flex: 1, fontSize: 13, color: '#0d47a1', textAlign: 'right' }}>{pair.right}</span>
              </div>
            ))}
          </div>
        )}
        {checked && isTextType && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 16px', border: '2px solid var(--success)', marginBottom: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>정답</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{q?.answer}</p>
          </div>
        )}
        {checked && <div style={{ background: bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${bd}` }}>
          <p style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{label} 문항</p>
          <p style={{ fontSize: 12, color, lineHeight: 1.7 }}>
            {isSelf ? '게임 모드에서는 객관식 문항만 채점됩니다. 이 문항은 건너뛰어도 됩니다.'
              : '위 정답을 확인하고 다음 문항으로 이동하세요.'}
          </p>
        </div>}
        {checked && q?.explanation && (
          <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--primary)', marginTop: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>💡 해설</p>
            <ExplanationBullets text={q.explanation} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', border: '2px solid var(--primary)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>[문제]</p>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            <DemandChip q={q} /><DifficultyBadge q={q} />
          </div>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8 }}>{stemQ}</p>
      </div>
      <ListeningPrompt key={q?.id} q={q} revealTranscript={checked} />
      <QuestionMedia q={q} />
      {ctxText && (
        <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #c7d7f5', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#3b5bdb', marginBottom: 6 }}>📋 지문 / 상황</p>
          <p style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#1a237e' }}>{ctxText}</p>
        </div>
      )}

      {/* 끌어다 놓기(연결형) — 공식 인증진단의 Drag & Drop 유형.
          휴대폰에서는 끌기가 스크롤과 부딪히므로 눌러서 잇는 방식으로 낸다. */}
      {isMatching && q?.pairs?.length > 0 && (
        <MatchingBoard q={q} checked={checked} value={selectedAnswer} onChange={onSelect} />
      )}

      {/* 풀다운 — 공식 인증진단의 Pull-down 유형. 표·서식의 칸을 목록에서 고른다. */}
      {qType === 'pulldown' && q?.blanks?.length > 0 && (
        <PulldownForm q={q} checked={checked} value={selectedAnswer} onChange={onSelect} />
      )}

      {/* choice / multi */}
      {(qType === 'choice' || isMulti) && (
        <div style={{ marginBottom: 14 }}>
          {isMulti && !checked && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>해당하는 것을 모두 선택하세요 (복수선택)</p>
          )}
          {q?.choices?.map((text, ci) => {
            const letter = String.fromCharCode(65 + ci)
            const isSelected = isMulti
              ? (Array.isArray(selectedAnswer) && selectedAnswer.includes(ci))
              : selectedAnswer === ci
            const isCorrect = isMulti ? correctLetters?.has(letter) : ci === correctIdx
            let bg = 'var(--card)', bd = 'var(--border)', numBg = 'var(--border)', numFg = 'var(--text-muted)'
            if (checked && isCorrect)       { bg = '#e8f5e9';              bd = 'var(--success)'; numBg = 'var(--success)'; numFg = '#fff' }
            else if (checked && isSelected && !isCorrect) { bg = '#ffebee'; bd = 'var(--danger)'; numBg = 'var(--danger)';  numFg = '#fff' }
            else if (!checked && isSelected){ bg = 'var(--primary-light)'; bd = 'var(--primary)'; numBg = 'var(--primary)'; numFg = '#fff' }
            return (
              <button key={ci} onClick={() => onSelect(ci)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: bg, border: `2px solid ${bd}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                  cursor: checked ? 'default' : 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                  fontSize: 14, lineHeight: 1.6, color: 'var(--text)', transition: 'all 0.15s',
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: isMulti ? 4 : '50%', flexShrink: 0,
                  background: numBg, color: numFg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>{isMulti ? (isSelected ? '✓' : letter) : ci + 1}</span>
                <span style={{ flex: 1 }}>{text}</span>
                {checked && isCorrect && <span style={{ color: 'var(--success)', fontWeight: 800, flexShrink: 0 }}>✓</span>}
                {checked && isSelected && !isCorrect && <span style={{ color: 'var(--danger)', fontWeight: 800, flexShrink: 0 }}>✗</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* OX */}
      {isOX && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[['O', 'var(--success)'], ['X', 'var(--danger)']].map(([val, color], ci) => {
            const isSelected = selectedAnswer === ci
            const isCorrect  = ci === correctIdx
            let bg = 'var(--card)', bd = 'var(--border)', fg = 'var(--text-muted)'
            if (checked && isCorrect)                  { bg = color;         bd = color;           fg = '#fff' }
            else if (checked && isSelected)            { bg = 'var(--card)'; bd = 'var(--danger)'; fg = 'var(--danger)' }
            else if (!checked && isSelected)           { bg = color;         bd = color;           fg = '#fff' }
            return (
              <button key={val} onClick={() => onSelect(ci)}
                style={{
                  flex: 1, padding: '18px 0 14px', borderRadius: 12, cursor: checked ? 'default' : 'pointer',
                  background: bg, border: `2px solid ${bd}`,
                  fontSize: 28, fontWeight: 800, color: fg, transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                {val}
                {checked && isCorrect && <span style={{ fontSize: 12, fontWeight: 700 }}>✓ 정답</span>}
                {checked && isSelected && !isCorrect && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>✗ 내 답</span>}
              </button>
            )
          })}
        </div>
      )}
      {/* 요구 수준에 맞는 연습. 채점 전에는 이유·근거를 묻고, 뒤에는 해설과 견주게 한다. */}
      <DemandCoach q={q} checked={checked} correct={isMulti
        ? (correctLetters && Array.isArray(selectedAnswer) &&
            correctLetters.size === selectedAnswer.length &&
            selectedAnswer.every(ci => correctLetters.has(String.fromCharCode(65 + ci))))
        : isAnswerRight(q, qType, selectedAnswer, correctIdx, correctLetters)} />
      {checked && <GameFeedback q={q} qType={qType}
        correct={isAnswerRight(q, qType, selectedAnswer, correctIdx, correctLetters)} />}
      {checked && stemHint && (
        <div style={{ background: '#fff8df', borderRadius: 10, padding: '11px 14px', border: '1px solid #ffc107', marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#856404', marginBottom: 5 }}>💡 학습 포인트</p>
          <CompactText text={stemHint} maxItemChars={68} style={{ fontSize: 12, color: '#3e3422' }} />
        </div>
      )}
    </div>
  )
}
