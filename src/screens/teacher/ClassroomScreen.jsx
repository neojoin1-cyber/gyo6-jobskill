/**
 * 수업 모드 — 교사가 프로젝터에 띄워 함께 푸는 화면.
 *
 * ── 왜 학생 앱을 그대로 쓰나 ───────────────────────────────────────
 * 교사용을 따로 만들면 문항 렌더러·교재·채점 규칙이 두 벌이 된다. 한쪽만
 * 고치는 날이 반드시 오고, 그때 교사가 칠판에 띄운 답과 학생 화면의 답이
 * 달라진다. 그래서 **같은 문항 데이터·같은 판정 규칙**을 쓴다.
 *
 * ── 가로가 기본이다 ───────────────────────────────────────────────
 * 교실 프로젝터·전자칠판·모니터는 거의 전부 16:9 가로다. 세로 화면을 그냥
 * 회전시키면 좌우가 텅 비고 글씨는 그대로 작다. 그래서 가로일 때는
 * **배치 자체가 다르다** — 회전이 아니라 다른 화면이다.
 *
 *   세로  자료 → 발문 → 선택지 를 위에서 아래로
 *   가로  왼쪽에 자료·발문, 오른쪽에 선택지. 교실 뒤에서도 읽히도록
 *         글자를 화면 너비(vw)에 맞춰 키운다.
 *
 * 고르는 화면들도 가로에서 2단으로 펼친다. 수업 시작부터 끝까지 한 번도
 * 세로로 돌릴 일이 없어야 한다.
 *
 * ── 무엇이 다른가 ─────────────────────────────────────────────────
 * 교실 뒤에서도 읽혀야 하므로 글자를 키우고 여백을 넓힌다. 손가락 대신
 * 리모컨·무선 마우스·키보드로 넘긴다. 그리고 **정답을 가릴 수 있어야**
 * 한다 — 띄우자마자 답이 보이면 학생이 생각할 틈이 없다.
 *
 *   ← →   이전·다음      Space 정답 보이기·감추기
 *   T     생각 시간 타이머  R 학생 무작위 지목   C 우리 반 현황
 *   F     전체 화면 + 가로 잠금   Esc 나가기
 *
 * ── 수업을 실제로 돕는 것들 ───────────────────────────────────────
 * 자료를 띄우는 것만으로는 수업이 되지 않는다. 교사가 수업 중에 실제로
 * 필요한 세 가지를 넣었다.
 *   우리 반 약한 영역   그 학급이 많이 틀린 곳으로 곧장 들어간다
 *   학생 무작위 지목    "누가 답해 볼까"를 공정하게 — 늘 같은 학생만 시키지 않게
 *   생각 시간 타이머    답을 보여 주기 전 정해진 시간을 함께 센다
 *   우리 반 현황        지금 몇 명이 하고 있고 누가 뒤처지는지 (C)
 *
 * ── 자료는 어디서 오나 ────────────────────────────────────────────
 * 문항·훈화·수업 덱이 전부 앱 안에 있다(서버 조회 0회). 수업 중 인터넷이
 * 끊겨도 진행된다. 학급 정보만 앱을 열 때 한 번 받는다.
 *
 * 덱은 다시 만든 것이 아니라 **파이프라인이 HTML 을 만들 때 쓰는 원본
 * `lessons.json` 을 같이 쓴다.** HTML 531편 63MB 대신 JSON 6과목 5.6MB 로
 * 들어왔고, 과목을 고를 때 그 과목만 받는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowsOutSimple, Books, ClipboardText, SunHorizon, Target } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../App.jsx'
import {
  buildJcOfficialAreas, jcStudyQuestions, jcLessonMatches, jcOrderInLesson,
} from '../../lib/jobCommonAreas.js'
import { buildNcs2026Areas, ncs2026Questions } from '../../lib/ncs2026.js'
import { MORNING_TALKS } from '../../lib/morningTalk.js'
import {
  isLandscape, onOrientationChange, onFullscreenChange, enterProjection, exitProjection,
} from '../../lib/orientation.js'
import { effectiveView, onViewChange } from '../../lib/teacherLayout.js'
import ClassroomQuestion, { isProjectable } from './ClassroomQuestion.jsx'
import DeckProjector, { loadDeckSubject } from './DeckProjector.jsx'
import deckIndex from '../../../data/decks/index.json'
import {
  RECRUIT_WRITTEN_TRACKS,
  buildRecruitWrittenAreas,
  recruitLessonTitle,
  recruitWrittenQuestions,
} from '../../lib/recruitWritten.js'
import {
  INTERVIEW_AREAS,
  INTERVIEW_QUESTIONS,
  PERSONALITY_CLASSROOM_AREAS,
  PERSONALITY_QUESTIONS,
  guidedLessonMatches,
} from '../../lib/guidedSubjectContent.js'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const THINK_SECONDS = 60
// 구 NCS 9영역으로 만든 job-common 덱은 교육부 인증진단 문항과 자동 연결하지
// 않는다. 출처 체계가 명확한 공식 덱으로 다시 만들기 전까지 수업 목록에서 제외한다.
const SAFE_DECK_INDEX = deckIndex.filter(subject => subject.id !== 'job-common')

const RECRUIT_CLASSROOM_AREAS = RECRUIT_WRITTEN_TRACKS.map(track => ({
  id: `recruit-${track.id}`,
  label: track.label,
  lessons: buildRecruitWrittenAreas(track.id).flatMap(area =>
    area.lessons.map(lesson => ({
      id: `${track.id}|${area.id}|${lesson.id}`,
      label: `${area.label} · ${lesson.label}`,
    }))
  ),
})).filter(area => area.lessons.length > 0)

const QUIZ_SYSTEM_META = {
  moe: {
    subject: 'job-common',
    title: '교육부 · 대한상공회의소 인증진단',
    description: '직업공통능력 인증평가 공식 영역과 문항',
  },
  ncs: {
    subject: 'ncs-basic',
    title: '고용노동부 · 한국산업인력공단 NCS',
    description: 'STEP 1 · 공공기관·금융권·대기업 필기 공통 본과정',
  },
  recruit: {
    subject: 'recruit-written',
    title: '채용필기 심화·확장',
    description: 'STEP 2 · 지원 기관·업종별 추가 출제영역',
  },
  interview: {
    subject: 'interview',
    title: '고졸 공정채용 면접',
    description: '블라인드·직무·상황·PT 면접 질문',
  },
  personality: {
    subject: 'personality',
    title: '인성검사 응답 성찰',
    description: '정답을 가르치지 않는 요인별 토의',
  },
}

function recruitLessonMatches(question, lessonId) {
  const [track, area, lesson] = String(lessonId ?? '').split('|')
  return question.recruitmentTrack === track && question.area === area && recruitLessonTitle(question) === lesson
}

function lessonMatches(question, system, lessonId) {
  if (system === 'moe') return jcLessonMatches(question, lessonId)
  if (system === 'ncs') return question.ncsAbility === lessonId
  if (system === 'recruit') return recruitLessonMatches(question, lessonId)
  return guidedLessonMatches(question, QUIZ_SYSTEM_META[system]?.subject, lessonId)
}

export default function ClassroomScreen({ onBack }) {
  const { profile } = useAuth() ?? {}
  const moeAreas = useMemo(() => buildJcOfficialAreas(), [])
  const moePool = useMemo(() => jcStudyQuestions(), [])
  const ncsAreas = useMemo(() => buildNcs2026Areas(), [])
  const ncsPool = useMemo(() => ncs2026Questions.filter(q => !q.excludeFromQuiz), [])
  const [quizSystem, setQuizSystem] = useState(null)
  const areas = quizSystem === 'ncs' ? ncsAreas
    : quizSystem === 'recruit' ? RECRUIT_CLASSROOM_AREAS
      : quizSystem === 'interview' ? INTERVIEW_AREAS
        : quizSystem === 'personality' ? PERSONALITY_CLASSROOM_AREAS
          : moeAreas
  const pool = quizSystem === 'ncs' ? ncsPool
    : quizSystem === 'recruit' ? recruitWrittenQuestions
      : quizSystem === 'interview' ? INTERVIEW_QUESTIONS
        : quizSystem === 'personality' ? PERSONALITY_QUESTIONS
          : moePool

  const [mode,     setMode]     = useState(null)   // 'quiz' | 'talk'
  const [areaId,   setAreaId]   = useState(null)
  const [lessonId, setLessonId] = useState(null)
  const [talkId,   setTalkId]   = useState(null)
  const [idx,      setIdx]      = useState(0)
  const [reveal,   setReveal]   = useState(false)
  const [showExp,  setShowExp]  = useState(false)
  const [shuffle,  setShuffle]  = useState(false)

  // 수업 덱 — 차시 자료를 앱 안에서 띄운다
  const [deckSubject, setDeckSubject] = useState(null)   // index.json 의 한 과목
  const [deckData,    setDeckData]    = useState(null)   // 'loading' | 차시 배열
  const [deckLesson,  setDeckLesson]  = useState(null)
  const [deckChapter, setDeckChapter] = useState(null)
  const [beatIdx,     setBeatIdx]     = useState(0)
  const [beatCount,   setBeatCount]   = useState(0)
  // 덱에서 문항으로 건너뛴 자리. 돌아올 때 그 장으로 되돌린다.
  const [deckReturn,  setDeckReturn]  = useState(null)
  const [hideContext, setHideContext] = useState(false)
  const focusRef = useRef({ key: null, at: 0 })   // 같은 자리를 거듭 적지 않으려고

  // 화면 방향 · 투사
  // 교사가 고른 배치를 따른다. 고르지 않았으면(auto) 기기 방향이 답이다.
  const [wide, setWide] = useState(() => effectiveView() === 'wide')
  const [full, setFull] = useState(false)
  const [hint, setHint] = useState(null)   // 가로 잠금이 막혔을 때 안내

  // 학급 · 약점 · 무작위 지목
  const [classes,  setClasses]  = useState([])
  const [classId,  setClassId]  = useState(null)
  const [weak,     setWeak]     = useState(null)
  const [roster,   setRoster]   = useState([])
  const [picked,   setPicked]   = useState(null)
  const pickedRef = useRef(new Set())

  // 수업 중 학급 현황
  const [live,      setLive]      = useState(null)   // null=닫힘 | 'loading' | 데이터
  const [liveNames, setLiveNames] = useState(false)  // 이름까지 보일지

  // 참여 상태 — 학생이 지금 앱을 보고 있는지
  const [session,  setSession]  = useState(null)   // 열린 수업 세션 id
  const [presence, setPresence] = useState(null)

  // 생각 시간
  const [left, setLeft] = useState(null)
  const rootRef = useRef(null)

  // ── 방향·전체화면을 계속 지켜본다 ───────────────────────────────
  // 교사가 Esc 로 전체 화면을 빠져나가거나 기기를 돌리면 배치가 따라와야
  // 한다. 상태를 우리가 기억하지 않고 실제 화면에서 읽는다.
  useEffect(() => onViewChange(v => setWide(v === 'wide')), [])
  useEffect(() => onOrientationChange(() => setWide(effectiveView() === 'wide')), [])
  useEffect(() => onFullscreenChange(setFull), [])

  // 수업을 떠날 때는 반드시 되돌린다. 잠근 채로 나가면 학생 화면이 가로로 묶인다.
  // 폰 프레임(데스크톱에서 480px)도 이 화면에 있는 동안만 벗는다.
  useEffect(() => {
    document.documentElement.classList.add('classroom-mode')
    return () => {
      document.documentElement.classList.remove('classroom-mode')
      exitProjection()
    }
  }, [])

  // ── 학급 목록 (앱을 열 때 한 번) ────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', profile.id)
      .then(({ data }) => {
        const list = (data ?? []).map(r => ({ id: r.class_id, name: r.classes?.name ?? '학급' }))
        setClasses(list)
        if (list.length) setClassId(list[0].id)
      })
  }, [profile?.id])

  // ── 수업이 열려 있는 동안만 참여 상태를 새로 읽는다 ─────────────
  // 30초는 교사가 "지금 누가 딴 데 갔나"를 알아채기에 충분하고,
  // 학급 하나당 30초에 한 번이라 서버에도 부담이 없다.
  useEffect(() => {
    if (!session || !live) return
    const t = setInterval(loadPresence, 30_000)
    return () => clearInterval(t)
  }, [session, live, classId])

  // ── 타이머 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (left == null) return
    if (left <= 0) { setLeft(null); return }
    const t = setTimeout(() => setLeft(v => (v == null ? null : v - 1)), 1000)
    return () => clearTimeout(t)
  }, [left])

  const questions = useMemo(() => {
    if (!lessonId) return []
    const found = pool.filter(q => {
      const matches = lessonMatches(q, quizSystem, lessonId)
      return matches && isProjectable(q)
    })
    const ordered = quizSystem === 'moe' ? jcOrderInLesson(found, lessonId) : found
    if (!shuffle) return ordered
    // 같은 반에 두 번 수업할 때 순서가 같으면 앞자리 학생만 늘 같은 문항을 만난다.
    const a = [...ordered]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [pool, lessonId, shuffle, quizSystem])

  const q = questions[idx] ?? null
  const talk = talkId ? MORNING_TALKS.find(t => t.id === talkId) : null

  /**
   * 학생 앱에서 이 자리를 뭐라고 부르는가.
   *
   * 투사 화면 위에 늘 띄운다. 뒷자리에서 본문이 안 보여도 **자기 기기에서
   * 같은 곳을 열 수 있다.** 글자 크기가 더 이상 유일한 통로가 아니게 된다.
   */
  const address = useMemo(() => {
    if (deckChapter) {
      return {
        kind: 'deck',
        subject: deckSubject?.id, lesson: deckLesson?.code, index: beatIdx,
        label: ['수업 자료', deckSubject?.label, deckLesson?.title, `${beatIdx + 1}/${beatCount}`]
                 .filter(Boolean).join(' · '),
      }
    }
    if (lessonId && q) {
      const area = areas.find(a => a.id === areaId)
      const les = area?.lessons?.find(l => l.id === lessonId)
      return {
        kind: 'question', questionId: q.id,
        subject: QUIZ_SYSTEM_META[quizSystem]?.subject ?? 'job-common', area: areaId, lesson: lessonId, index: idx,
        label: ['학습', area?.label, les?.label, `${idx + 1}/${questions.length}`]
                 .filter(Boolean).join(' · '),
      }
    }
    return null
  }, [deckChapter, deckSubject, deckLesson, beatIdx, beatCount,
      lessonId, q, areaId, areas, idx, questions.length, quizSystem])

  const go = useCallback((step) => {
    const next = Math.max(0, Math.min(questions.length - 1, idx + step))
    setIdx(next)
    const nextQuestion = questions[next]
    if (session && lessonId && nextQuestion) {
      const area = areas.find(a => a.id === areaId)
      const lesson = area?.lessons?.find(item => item.id === lessonId)
      const focus = {
        kind: 'question', questionId: nextQuestion.id,
        subject: QUIZ_SYSTEM_META[quizSystem]?.subject ?? 'job-common',
        area: areaId, lesson: lessonId, index: next,
        label: ['학습', area?.label, lesson?.label, `${next + 1}/${questions.length}`]
          .filter(Boolean).join(' · '),
      }
      focusRef.current = { key: JSON.stringify(focus), at: Date.now() }
      supabase.rpc('rpc_set_class_focus', { p_session_id: session, p_focus: focus })
        .then(({ error }) => {
          if (error) {
            focusRef.current = { key: null, at: 0 }
            setHint(`학생 화면 위치 전송 실패: ${error.message}`)
          }
        })
    }
    setReveal(false); setShowExp(false); setLeft(null); setPicked(null)
  }, [idx, questions, session, lessonId, areas, areaId, quizSystem])

  /** 큰 화면에 띄우기 — 전체 화면과 가로 잠금을 한 번에. */
  async function project() {
    if (full) { await exitProjection(); setHint(null); return }
    const r = await enterProjection(rootRef.current)
    setFull(r.full); setWide(effectiveView() === 'wide')
    setHint(r.locked ? null
      : r.full ? '이 기기는 방향을 잠그지 못합니다. 기기를 가로로 돌리거나 케이블로 연결한 화면을 쓰세요.'
               : '전체 화면이 막혀 있습니다. 브라우저 설정에서 허용해 주세요.')
  }

  /** 과목 자료를 받는다. 최대 1.9MB 라 고를 때 받고 그 뒤는 캐시가 맡는다. */
  async function openDeckSubject(sub) {
    setDeckSubject(sub); setDeckData('loading')
    setDeckLesson(null); setDeckChapter(null)
    const d = await loadDeckSubject(sub.id)
    setDeckData(d ?? [])
  }

  /** 조각을 넘긴다. 넘어갈 때 답을 다시 가리는 것이 문항 투사와 같다. */
  const goBeat = useCallback((step) => {
    setBeatIdx(i => Math.max(0, Math.min(beatCount - 1, i + step)))
    setReveal(false); setLeft(null); setPicked(null)
  }, [beatCount])

  /**
   * 지금 보는 자리를 세션에 적어 둔다 — 학생이 「따라가기」로 올 수 있게.
   *
   * ── 밀지 않고 적어 둔다 ─────────────────────────────────────
   * 화면을 넘길 때마다 학생 3만 명에게 밀어 넣으면 그 순간 3만 번의 쓰기가
   * 생긴다. 대신 **한 곳에 적어 두고 학생이 필요할 때 읽어 간다.**
   * 학급당 몇 초에 한 번의 쓰기로 끝난다.
   *
   * 같은 자리만 거듭 적지 않는다. 이 쓰기는 학생 수와 무관하게 학급당 한 번이고,
   * 빠르게 넘긴 문항도 마지막 위치를 잃으면 안 되므로 시간 제한은 두지 않는다.
   */
  const writeFocus = useCallback((focus) => {
    if (!session || !focus) return
    const key = JSON.stringify(focus)
    if (focusRef.current.key === key) return
    focusRef.current = { key, at: Date.now() }
    supabase.rpc('rpc_set_class_focus', { p_session_id: session, p_focus: focus })
      .then(({ error }) => {
        if (error) {
          focusRef.current = { key: null, at: 0 }
          setHint(`학생 화면 위치 전송 실패: ${error.message}`)
        }
      })
  }, [session])

  // 자리가 바뀌면 적어 둔다. 수업이 열려 있을 때만.
  useEffect(() => { writeFocus(address) }, [address, writeFocus])

  /** 문항을 보다가 덱의 그 장으로 되돌아간다. */
  function backToDeck() {
    if (!deckReturn) return
    setMode('deck')
    setDeckSubject(deckReturn.subject)
    setDeckLesson(deckReturn.lesson)
    setDeckChapter(deckReturn.chapter)
    setBeatIdx(deckReturn.beat)
    setLessonId(null); setAreaId(null); setReveal(false)
    setDeckReturn(null)
  }

  /**
   * 수업 중 학급 현황.
   *
   * 실시간 구독을 쓰지 않는다 — 학생 수만큼 동시 연결이 생기고, 한 학교
   * 30학급이 같은 교시에 수업하면 그것만으로 요금제 쿼터를 넘는다. 교사가
   * 필요할 때 누르는 방식이면 수업 한 시간에 몇 번이고, 그 정도는 공짜다.
   */
  async function loadLive() {
    if (!classId) return
    setLive('loading')
    const { data } = await supabase.rpc('rpc_class_live', { p_class_id: classId })
    setLive(data?.error ? { error: data.error } : (data ?? { students: [], summary: {} }))
  }

  /**
   * 수업 시작 — 참여 상태 신호를 켠다.
   *
   * 이걸 누른 동안에만 학생 앱이 신호를 보낸다. 항상 켜 두지 않는 이유는
   * 두 가지다. 하나는 비용(3만 명이 늘 신호를 보내면 감당이 안 된다),
   * 다른 하나는 **집에서 자습하는 학생까지 볼 이유가 없어서**다.
   */
  async function startSession() {
    if (!classId) return
    const { data } = await supabase.rpc('rpc_start_class_session', {
      p_class_id: classId,
      p_title: areaId ? areas.find(a => a.id === areaId)?.label : null,
    })
    if (data?.session_id) {
      setSession(data.session_id)
      if (address) {
        const { error } = await supabase.rpc('rpc_set_class_focus', {
          p_session_id: data.session_id,
          p_focus: address,
        })
        if (!error) focusRef.current = { key: JSON.stringify(address), at: Date.now() }
      }
      loadPresence()
    }
  }

  async function endSession() {
    if (!classId) return
    await supabase.rpc('rpc_end_class_session', { p_class_id: classId })
    setSession(null); setPresence(null)
  }

  /** 참여 상태를 새로 읽는다. 교사가 누를 때만 — 실시간 구독은 쓰지 않는다. */
  async function loadPresence() {
    if (!classId) return
    setPresence('loading')
    const { data } = await supabase.rpc('rpc_class_presence', { p_class_id: classId })
    if (data?.session) setSession(data.session)
    setPresence(data?.error ? { error: data.error } : (data ?? null))
  }

  /** 아직 안 걸린 학생 중에서 뽑는다. 한 바퀴 돌면 다시 채운다. */
  function pickStudent() {
    if (!roster.length) return
    let rest = roster.filter(s => !pickedRef.current.has(s.id))
    if (!rest.length) { pickedRef.current = new Set(); rest = roster }
    const one = rest[Math.floor(Math.random() * rest.length)]
    pickedRef.current.add(one.id)
    setPicked(one)
  }

  // ── 리모컨·키보드 ────────────────────────────────────────────────
  useEffect(() => {
    if (!lessonId && !talkId && !deckChapter) return
    function onKey(e) {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      // 넘기는 조작은 문항이든 덱이든 같다. 교사가 둘을 외울 이유가 없다.
      const next = deckChapter ? goBeat : go
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); if (lessonId || deckChapter) next(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (lessonId || deckChapter) next(-1) }
      else if (e.key === ' ')  { e.preventDefault(); setReveal(v => !v); setLeft(null) }
      else if (e.key === 't' || e.key === 'T') { setLeft(THINK_SECONDS) }
      else if (e.key === 'r' || e.key === 'R') { pickStudent() }
      else if (e.key === 'c' || e.key === 'C') { live ? setLive(null) : loadLive() }
      else if (e.key === 'd' || e.key === 'D') { setHideContext(v => !v) }
      else if (e.key === 'f' || e.key === 'F') { project() }
      else if (e.key === 'Escape') { setLessonId(null); setTalkId(null); setDeckChapter(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lessonId, talkId, deckChapter, go, goBeat, roster, full, live, classId])

  // ── 우리 반 약한 영역 ───────────────────────────────────────────
  async function loadWeak() {
    if (!classId) return
    setWeak('loading')
    const [{ data: w }, { data: sc }] = await Promise.all([
      supabase.rpc('rpc_class_weakness', { p_class_id: classId }),
      supabase.from('student_classes').select('student_id, profiles(display_name)').eq('class_id', classId),
    ])
    setWeak(w ?? { areas: [], students: [] })
    setRoster((sc ?? []).map(r => ({ id: r.student_id, name: r.profiles?.display_name ?? '학생' })))
    pickedRef.current = new Set()
  }

  /** 고르는 화면의 겉틀. 가로에서는 목록이 2단으로 펼쳐진다. */
  const pickCls = wide ? 'classroom-pick is-wide' : 'classroom-pick'

  // ══ ① 무엇으로 수업할지 ═════════════════════════════════════════
  if (!mode) return (
    <div className="screen">
      <header className="screen-header">
        <button className="icon-btn" onClick={onBack} aria-label="교사 홈으로"><ArrowLeft /></button>
        <div className="screen-header-copy"><span>TEACHER STUDIO</span><h1>수업 스튜디오</h1></div>
        <div style={{ flex: 1 }} />
        <button className="classroom-project-button" onClick={project}>
          <ArrowsOutSimple /> {full ? '창 화면으로' : '전체 화면'}
        </button>
      </header>
      <div className="classroom-intro">
        <b>학생 화면과 같은 자료로 수업을 이어갑니다.</b>
        <span>정답은 가린 채 시작하고, 전체 화면은 프로젝터·전자칠판에 연결할 때만 사용합니다.</span>
      </div>
      {hint && <p className="classroom-hint">{hint}</p>}

      {classes.length > 0 && (
        <div className="card" style={{ margin: '0 16px 12px', padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>학급</span>
          <select value={classId ?? ''} onChange={e => { setClassId(e.target.value); setWeak(null) }}
                  style={{ flex: 1 }}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className={pickCls}>
        <button className="card classroom-entry" onClick={() => { setQuizSystem(null); setMode('quiz') }}>
          <span className="classroom-entry-icon"><ClipboardText weight="fill" /></span>
          <span style={{ flex: 1 }}>
            <b>문항으로 수업</b>
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              공식 체계를 먼저 고른 뒤 영역·단원을 함께 풉니다
            </span>
          </span><span className="muted">›</span>
        </button>

        <button className="card classroom-entry"
                onClick={() => { setQuizSystem('moe'); setMode('weak'); loadWeak() }} disabled={!classId}>
          <span className="classroom-entry-icon"><Target weight="fill" /></span>
          <span style={{ flex: 1 }}>
            <b>우리 반 약한 영역</b>
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              많이 틀린 곳으로 바로 들어갑니다
            </span>
          </span><span className="muted">›</span>
        </button>

        <button className="card classroom-entry" onClick={() => setMode('talk')}>
          <span className="classroom-entry-icon"><SunHorizon weight="fill" /></span>
          <span style={{ flex: 1 }}>
            <b>훈화 자료</b>
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              {MORNING_TALKS.length}편 · 주제로 골라 띄웁니다
            </span>
          </span><span className="muted">›</span>
        </button>

        <button className="card classroom-entry" onClick={() => setMode('deck')}>
          <span className="classroom-entry-icon"><Books weight="fill" /></span>
          <span style={{ flex: 1 }}>
            <b>수업 덱</b>
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              출처 체계가 확인된 자료 {SAFE_DECK_INDEX.reduce((n, s2) => n + s2.lessonCount, 0)}차시
            </span>
          </span><span className="muted">›</span>
        </button>
      </div>
    </div>
  )

  // ══ ② 우리 반 약한 영역 ═════════════════════════════════════════
  if (mode === 'weak' && !lessonId) {
    const rows = weak === 'loading' ? null : (weak?.areas ?? [])
    return (
      <div className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => { setMode(null); setWeak(null) }}>←</button>
          <h1>우리 반 약한 영역</h1>
        </header>
        {rows === null ? <div className="loading-screen"><div className="spinner" /></div> : (
          <div className={pickCls}>
            {rows.length === 0 && (
              <p className="muted" style={{ padding: 24, textAlign: 'center', gridColumn: '1 / -1' }}>
                아직 오답이 쌓이지 않았습니다. 학생들이 문항을 풀면 여기에 모입니다.
              </p>
            )}
            {rows.map((r, i) => {
              const lesson = findLessonForArea(areas, r.area)
              const n = lesson ? pool.filter(x => jcLessonMatches(x, lesson.id)
                                              && isProjectable(x)).length : 0
              return (
                <button key={i} className="card classroom-entry" disabled={!lesson || !n}
                  onClick={() => { setAreaId(lesson.areaId); setLessonId(lesson.id); setIdx(0)
                                   setReveal(false); setShowExp(false) }}>
                  <span style={{ fontSize: 20 }}>{i === 0 ? '🔥' : '•'}</span>
                  <span style={{ flex: 1 }}>
                    <b>{r.area}</b>
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      오답 {r.wrong_count ?? 0}건 · 학생 {r.student_count ?? 0}명
                      {lesson ? ` · 이 영역 ${n}문항` : ' · 연결된 단원 없음'}
                    </span>
                  </span><span className="muted">›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ══ ②-2 수업 덱 — 과목 → 차시 → 꼭지 ═══════════════════════════
  if (mode === 'deck' && !deckChapter) {
    // 과목 고르기
    if (!deckSubject) return (
      <div ref={rootRef} className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => setMode(null)}>←</button>
          <h1>수업 덱</h1>
        </header>
        <p className="muted" style={{ padding: '0 16px 8px' }}>
          외부 사이트로 나가지 않습니다. 지목·타이머·우리 반 현황을 그대로 쓰면서 띄웁니다.
        </p>
        <div className={pickCls}>
          {SAFE_DECK_INDEX.map(sub2 => (
            <button key={sub2.id} className="card classroom-entry" onClick={() => openDeckSubject(sub2)}>
              <span style={{ flex: 1, fontWeight: 700 }}>{sub2.label}</span>
              <span className="muted">{sub2.lessonCount}차시 ›</span>
            </button>
          ))}
        </div>
      </div>
    )

    // 차시 고르기
    if (!deckLesson) return (
      <div ref={rootRef} className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => { setDeckSubject(null); setDeckData(null) }}>←</button>
          <h1>{deckSubject.label}</h1>
        </header>
        {deckData === 'loading'
          ? <div className="loading-screen"><div className="spinner" /></div>
          : (
            <div className={pickCls}>
              {(deckData ?? []).map((l, i) => (
                <button key={l.code ?? i} className="card classroom-entry"
                        onClick={() => setDeckLesson(l)}>
                  <span style={{ flex: 1 }}>
                    <b>{l.title}</b>
                    {l.sub && <span className="muted" style={{ display: 'block', fontSize: 12 }}>{l.sub}</span>}
                  </span>
                  <span className="muted">{l.chapters?.length ?? 0}꼭지 ›</span>
                </button>
              ))}
            </div>
          )}
      </div>
    )

    // 꼭지 고르기
    return (
      <div ref={rootRef} className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => setDeckLesson(null)}>←</button>
          <h1>{deckLesson.title}</h1>
        </header>
        <div className={pickCls}>
          {(deckLesson.chapters ?? []).map(c => (
            <button key={c.cno} className="card classroom-entry" disabled={!c.beats?.length}
                    onClick={() => { setDeckChapter(c); setBeatIdx(0); setReveal(false) }}>
              <span style={{ flex: 1 }}>{c.ctitle}</span>
              <span className="muted">{c.beats?.length ?? 0}장 ›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ══ ③ 훈화 자료 고르기 ══════════════════════════════════════════
  if (mode === 'talk' && !talkId) {
    const themes = [...new Set(MORNING_TALKS.map(t => t.theme))]
    return (
      <div className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => setMode(null)}>←</button>
          <h1>훈화 자료</h1>
        </header>
        <div style={{ padding: '0 16px 16px' }}>
          {themes.map(th => (
            <div key={th} style={{ marginBottom: 14 }}>
              <p style={{ fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>{th}</p>
              <div className={pickCls} style={{ padding: 0 }}>
                {MORNING_TALKS.filter(t => t.theme === th).map(t => (
                  <button key={t.id} className="card classroom-entry"
                          onClick={() => setTalkId(t.id)} style={{ padding: 12 }}>
                    <span style={{ flex: 1, fontSize: 14 }}>{t.title}</span>
                    <span className="muted">›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ══ ④ 영역 고르기 ═══════════════════════════════════════════════
  if (mode === 'quiz' && !quizSystem) return (
    <div className="screen">
      <header className="screen-header">
        <button className="icon-btn" onClick={() => setMode(null)}>←</button>
        <h1>공식 학습 체계 선택</h1>
      </header>
      <div className={pickCls}>
        {Object.entries(QUIZ_SYSTEM_META).map(([id, meta]) => (
          <button key={id} className="card classroom-entry" onClick={() => setQuizSystem(id)}>
            <span style={{ flex: 1 }}><b>{meta.title}</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>{meta.description}</span></span><span className="muted">›</span>
          </button>
        ))}
      </div>
    </div>
  )

  if (mode === 'quiz' && !areaId) return (
    <div className="screen">
      <header className="screen-header">
          <button className="icon-btn" onClick={() => setQuizSystem(null)}>←</button>
        <h1>{QUIZ_SYSTEM_META[quizSystem]?.title ?? '수업 영역'}</h1>
        <div style={{ flex: 1 }} />
        {deckReturn && <button className="chip" onClick={backToDeck}>↩ 덱으로</button>}
      </header>
      <div className={pickCls}>
        {areas.filter(a => a.lessons?.length).map(a => (
          <button key={a.id} className="card classroom-entry" onClick={() => setAreaId(a.id)}>
            <span style={{ flex: 1, fontWeight: 700 }}>{a.label}</span>
            <span className="muted">{a.lessons.length}단원 ›</span>
          </button>
        ))}
      </div>
    </div>
  )

  // ══ ⑤ 단원 고르기 ═══════════════════════════════════════════════
  if (mode === 'quiz' && !lessonId) {
    const area = areas.find(a => a.id === areaId)
    return (
      <div className="screen">
        <header className="screen-header">
          <button className="icon-btn" onClick={() => setAreaId(null)}>←</button>
          <h1>{area?.label}</h1>
          <div style={{ flex: 1 }} />
          {deckReturn && <button className="chip" onClick={backToDeck}>↩ 덱으로</button>}
        </header>
        <div style={{ padding: '0 16px 8px' }}>
          <label className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />
            <span style={{ flex: 1, fontSize: 14 }}>문항 순서 섞기
              <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                같은 반에 두 번 수업할 때 순서를 바꿉니다
              </span>
            </span>
          </label>
        </div>
        <div className={pickCls}>
          {area?.lessons.map(l => {
            const n = pool.filter(x => lessonMatches(x, quizSystem, l.id) && isProjectable(x)).length
            return (
              <button key={l.id} className="card classroom-entry" disabled={!n}
                onClick={() => { setLessonId(l.id); setIdx(0); setReveal(false); setShowExp(false) }}>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span className="muted">{n}문항 ›</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ══ ⑤-2 투사 화면 — 수업 덱 ════════════════════════════════════
  // 도구줄은 문항 투사와 같은 것을 쓴다. 교사가 덱으로 옮겼다고 지목·
  // 타이머·현황을 잃으면 애초에 앱 안으로 들여온 이유가 없다.
  if (deckChapter) return (
    <div ref={rootRef} className={`classroom is-deck${wide ? ' is-wide' : ''}`}>
      <div className="classroom-bar">
        <button className="classroom-btn" onClick={() => setDeckChapter(null)}>← 목록</button>
        <span className="classroom-progress">{beatIdx + 1} / {beatCount}</span>
        <div style={{ flex: 1 }} />
        {left != null && <span className="classroom-timer">{left}초</span>}
        <button className="classroom-btn" onClick={() => setLeft(THINK_SECONDS)}>⏱ 생각 <kbd>T</kbd></button>
        {roster.length > 0 && (
          <button className="classroom-btn" onClick={pickStudent}>🎲 지목 <kbd>R</kbd></button>
        )}
        {classId && (
          <button className="classroom-btn" onClick={() => live ? setLive(null) : loadLive()}>
            📊 우리 반 <kbd>C</kbd>
          </button>
        )}
        <button className="classroom-btn" onClick={() => { setReveal(v => !v); setLeft(null) }}>
          {reveal ? '🙈 감추기' : '👁 답'} <kbd>Space</kbd>
        </button>
        <button className="classroom-btn" onClick={project}>{full ? '창 화면' : '전체 화면'} <kbd>F</kbd></button>
      </div>

      {address && (
        <div className="classroom-address">
          <span className="ic">📍</span>
          <span className="tx">학생 앱에서 <b>{address.label}</b></span>
          {session && <span className="sync">학생이 「따라가기」로 올 수 있습니다</span>}
        </div>
      )}

      {hint && <p className="classroom-hint">{hint}</p>}
      {live && <LivePanel live={live} names={liveNames} onNames={setLiveNames}
                          onRefresh={() => { loadLive(); loadPresence() }}
                          onClose={() => setLive(null)}
                          presence={presence} session={session}
                          onStart={startSession} onEnd={endSession} />}

      {/* 지금 어느 차시의 어느 꼭지인지. 중간에 들어온 학생도 맥락을 잡는다. */}
      <div className="deck-crumb">
        <b>{deckLesson?.title}</b>
        {deckChapter.ctitle ? ` · ${deckChapter.ctitle}` : ''}
      </div>

      <div className="classroom-body">
        <DeckProjector chapter={deckChapter} index={beatIdx} reveal={reveal}
                       onCount={setBeatCount}
                       onPrev={() => goBeat(-1)} onNext={() => goBeat(1)} />

        {/* 화면 좌우를 툭 쳐서 넘긴다 — 발표 앱의 관례다. 교사가 태블릿을
            들고 교실을 도는데 아래쪽 작은 버튼을 겨누게 할 수는 없다.
            내용 위에 겹치되 글자 선택을 막지 않도록 가장자리만 차지한다. */}
        <button className="deck-tap is-prev" aria-label="이전 장"
                onClick={() => goBeat(-1)} disabled={beatIdx === 0} />
        <button className="deck-tap is-next" aria-label="다음 장"
                onClick={() => goBeat(1)} disabled={beatIdx >= beatCount - 1} />

        {picked && <div className="classroom-picked deck-picked">🎲 {picked.name} 학생</div>}
      </div>

      {/* 34장 중 어디인지 한눈에 보이고, 눌러서 건너뛴다. 수업 중 「아까 그
          판서 다시」가 늘 생기는데 이전을 열 번 누르게 할 수는 없다. */}
      <div className="deck-rail">
        {Array.from({ length: beatCount }, (_, i) => (
          <button key={i} aria-label={`${i + 1}번째 장`}
                  className={i === beatIdx ? 'is-now' : (i < beatIdx ? 'is-done' : '')}
                  onClick={() => { setBeatIdx(i); setReveal(false); setLeft(null); setPicked(null) }} />
        ))}
      </div>

      <div className="classroom-nav">
        <button className="classroom-btn" onClick={() => goBeat(-1)} disabled={beatIdx === 0}>← 이전</button>
        <button className="classroom-btn" onClick={() => goBeat(1)}
                disabled={beatIdx >= beatCount - 1}>다음 →</button>
      </div>
    </div>
  )

  // ══ ⑥ 투사 화면 — 훈화 ══════════════════════════════════════════
  if (talk) return (
    <div ref={rootRef} className={`classroom${wide ? ' is-wide' : ''}`}>
      <div className="classroom-bar">
        <button className="classroom-btn" onClick={() => setTalkId(null)}>← 목록</button>
        <span className="classroom-progress">{talk.theme}</span>
        <div style={{ flex: 1 }} />
        {roster.length > 0 && (
          <button className="classroom-btn" onClick={pickStudent}>🎲 지목 <kbd>R</kbd></button>
        )}
        {classId && (
          <button className="classroom-btn" onClick={() => live ? setLive(null) : loadLive()}>
            📊 우리 반 <kbd>C</kbd>
          </button>
        )}
        <button className="classroom-btn" onClick={project}>{full ? '창 화면' : '전체 화면'} <kbd>F</kbd></button>
      </div>
      {live && <LivePanel live={live} names={liveNames} onNames={setLiveNames}
                          onRefresh={() => { loadLive(); loadPresence() }}
                          onClose={() => setLive(null)}
                          presence={presence} session={session}
                          onStart={startSession} onEnd={endSession} />}
      <div className="classroom-body">
        <div className="classroom-main">
          <h2 className="classroom-stem">{talk.title}</h2>
          <div className="classroom-context">{talk.body}</div>
        </div>
        <div className="classroom-side">
          {talk.oneLine && <p className="classroom-oneline">“{talk.oneLine}”</p>}
          {talk.question && (
            <div className="classroom-exp classroom-talk-question">
              <b>함께 생각해 볼 것</b>
              <p>{talk.question.stem}</p>
              {talk.question.choices?.length > 0 && (
                <ol>{talk.question.choices.map((choice, index) => <li key={index}>{choice}</li>)}</ol>
              )}
            </div>
          )}
          {picked && <div className="classroom-picked">🎲 {picked.name} 학생</div>}
        </div>
      </div>
      {talk.teacherNote && (
        <div className="classroom-note">
          <b>교사 참고</b> · {talk.teacherNote.tip}
          {talk.teacherNote.openQuestions?.length > 0 && (
            <span> · 후속 질문: {talk.teacherNote.openQuestions.join(' / ')}</span>
          )}
        </div>
      )}
    </div>
  )

  // ══ ⑦ 투사 화면 — 문항 ══════════════════════════════════════════
  return (
    <div ref={rootRef} className={`classroom is-quiz${wide ? ' is-wide' : ''}`}>
      <div className="classroom-bar">
        <button className="classroom-btn"
                onClick={() => { setLessonId(null); if (mode === 'weak') setAreaId(null) }}>← 목록</button>
        {deckReturn && (
          <button className="classroom-btn" onClick={backToDeck}>↩ 덱으로</button>
        )}
        <span className="classroom-progress">{idx + 1} / {questions.length}</span>
        <div style={{ flex: 1 }} />
        {left != null && <span className="classroom-timer">{left}초</span>}
        <button className="classroom-btn" onClick={() => setLeft(THINK_SECONDS)}>⏱ 생각 <kbd>T</kbd></button>
        {(q?.context || q?.passage) && !q?.audioText && (
          <button className="classroom-btn" onClick={() => setHideContext(v => !v)}>
            {hideContext ? '📄 지문 펴기' : '📄 지문 접기'} <kbd>D</kbd>
          </button>
        )}
        {roster.length > 0 && (
          <button className="classroom-btn" onClick={pickStudent}>🎲 지목 <kbd>R</kbd></button>
        )}
        {classId && (
          <button className="classroom-btn" onClick={() => live ? setLive(null) : loadLive()}>
            📊 우리 반 <kbd>C</kbd>
          </button>
        )}
        {quizSystem !== 'personality' && (
          <button className="classroom-btn" onClick={() => { setReveal(v => !v); setLeft(null) }}>
            {reveal ? '감추기' : '정답 보기'} <kbd>Space</kbd>
          </button>
        )}
        <button className="classroom-btn" onClick={project}>{full ? '창 화면' : '전체 화면'} <kbd>F</kbd></button>
      </div>

      {address && (
        <div className="classroom-address">
          <span className="ic">📍</span>
          <span className="tx">학생 앱에서 <b>{address.label}</b></span>
          {session && <span className="sync">학생이 「따라가기」로 올 수 있습니다</span>}
        </div>
      )}

      {hint && <p className="classroom-hint">{hint}</p>}

      {live && <LivePanel live={live} names={liveNames} onNames={setLiveNames}
                          onRefresh={() => { loadLive(); loadPresence() }}
                          onClose={() => setLive(null)}
                          presence={presence} session={session}
                          onStart={startSession} onEnd={endSession} />}

      {!q ? (
        <p className="classroom-empty">이 단원에는 띄울 문항이 없습니다.</p>
      ) : (
        <div className="classroom-body">
          {/* 유형에 맞춰 그린다 — 듣기는 소리가 나고, 매칭·풀다운은 학생
              화면과 같은 부품을 읽기 전용으로 세운다. */}
          <ClassroomQuestion q={q} reveal={reveal} hideContext={hideContext} />

          {picked && <div className="classroom-picked">🎲 {picked.name} 학생</div>}

          {reveal && q.explanation && (
            <div className="classroom-exp">
              <button className="classroom-btn" onClick={() => setShowExp(v => !v)}>
                {showExp ? '해설 접기' : '해설 펼치기'}
              </button>
              {showExp && <p>{q.explanation}</p>}
            </div>
          )}
        </div>
      )}

      <div className="classroom-nav">
        <button className="classroom-btn" onClick={() => go(-1)} disabled={idx === 0}>← 이전</button>
        <button className="classroom-btn" onClick={() => go(1)}
                disabled={idx >= questions.length - 1}>다음 →</button>
      </div>
    </div>
  )
}

/**
 * 수업 중 학급 현황 패널.
 *
 * ── 이름을 기본으로 감추는 이유 ───────────────────────────────────
 * 이 화면은 교실 앞 큰 화면에 떠 있다. 누가 몇 문항을 풀었는지 이름과 함께
 * 띄우면 반 전체가 본다. 뒤처진 학생을 공개적으로 지목하는 셈이 되고,
 * 그 한 번으로 교사는 이 기능을 다시 쓰지 않는다. 그래서 **기본은 이름 없는
 * 숫자만**이고, 이름은 교사가 따로 켤 때만 나온다.
 */
export function LivePanel({ live, names, onNames, onRefresh, onClose,
                            presence, session, onStart, onEnd }) {
  if (live === 'loading') return <div className="classroom-live"><p>불러오는 중…</p></div>
  if (live?.error) return (
    <div className="classroom-live">
      <p>이 학급을 볼 권한이 없습니다.</p>
      <button className="classroom-btn" onClick={onClose}>닫기</button>
    </div>
  )

  const sum  = live?.summary ?? {}
  const rows = live?.students ?? []
  const idle = rows.filter(r => r.idle)

  return (
    <div className="classroom-live">
      <div className="classroom-live-head">
        <b>우리 반 현황</b>
        <div style={{ flex: 1 }} />
        <button className="classroom-btn" onClick={onRefresh}>↻ 새로고침</button>
        <button className="classroom-btn" onClick={() => onNames(!names)}>
          {names ? '🙈 이름 감추기' : '👁 이름 보기'}
        </button>
        <button className="classroom-btn" onClick={onClose}>✕ <kbd>C</kbd></button>
      </div>

      {/* ── 참여 상태 ────────────────────────────────────────────
          교사가 가장 먼저 봐야 할 것이므로 맨 위에 둔다. 실습을 지시한
          뒤 알고 싶은 건 「몇 문항 풀었나」가 아니라 「지금 보고 있나」다. */}
      <div className="classroom-presence">
        {!session ? (
          <>
            <span className="muted">수업을 시작하면 학생이 앱을 보고 있는지 확인할 수 있습니다.</span>
            <div style={{ flex: 1 }} />
            <button className="classroom-btn is-go" onClick={onStart}>▶ 수업 시작</button>
          </>
        ) : (
          <>
            <PresenceStats p={presence} />
            <div style={{ flex: 1 }} />
            <button className="classroom-btn" onClick={onRefresh}>↻</button>
            <button className="classroom-btn is-stop" onClick={onEnd}>■ 수업 종료</button>
          </>
        )}
      </div>

      {session && names && <PresenceList p={presence} />}

      {/* 숫자만 — 이 줄은 반 전체가 봐도 괜찮다 */}
      <div className="classroom-live-stats">
        <span><b>{sum.active ?? 0}</b> / {sum.total ?? 0}명 참여</span>
        <span>오늘 <b>{sum.solved ?? 0}</b>문항</span>
        <span>1인 평균 <b>{sum.avg ?? 0}</b></span>
        {(sum.idle ?? 0) > 0 && <span className="is-warn">아직 시작 안 함 <b>{sum.idle}</b>명</span>}
      </div>

      {!names ? (
        <p className="classroom-live-note">
          이름은 감춰져 있습니다. 큰 화면에 띄운 상태라면 그대로 두세요.
          {idle.length > 0 ? ` 시작하지 않은 ${idle.length}명이 있습니다.` : ''}
        </p>
      ) : (
        <ul className="classroom-live-list">
          {rows.map(r => (
            <li key={r.student_id} className={r.idle ? 'is-idle' : ''}>
              <span className="nm">{r.display_name}</span>
              <span className="n">{r.solved}문항</span>
              {r.wrong_today > 0 && <span className="w">오늘 오답 {r.wrong_today}</span>}
              {r.wrong_open  > 0 && <span className="o">미해결 {r.wrong_open}</span>}
              {r.idle && <span className="i">시작 안 함</span>}
            </li>
          ))}
          {rows.length === 0 && <li>학급에 배정된 학생이 없습니다.</li>}
        </ul>
      )}
    </div>
  )
}

/** 참여 상태 숫자만. 이름이 없으므로 큰 화면에 띄워도 된다. */
function PresenceStats({ p }) {
  if (p === 'loading' || !p) return <span className="muted">참여 상태 확인 중…</span>
  const s = p.summary ?? {}
  return (
    <div className="classroom-presence-stats">
      <span className="ok">보는 중 <b>{s.active ?? 0}</b></span>
      <span className="away">나감 <b>{s.away ?? 0}</b></span>
      <span className="lost">끊김 <b>{s.lost ?? 0}</b></span>
      <span className="off">미접속 <b>{s.offline ?? 0}</b></span>
    </div>
  )
}

const PRESENCE_LABEL = {
  active:  { t: '보는 중',  c: 'ok' },
  away:    { t: '앱 나감',  c: 'away' },
  lost:    { t: '신호 끊김', c: 'lost' },
  offline: { t: '미접속',   c: 'off' },
}

/**
 * 이름과 함께 보는 참여 명단.
 *
 * 정렬은 서버가 「문제 있는 학생 먼저」로 해서 준다. 교사가 스크롤해서
 * 찾을 필요가 없어야 이 기능이 수업 중에 쓰인다.
 */
function PresenceList({ p }) {
  if (p === 'loading' || !p?.students) return null
  return (
    <ul className="classroom-presence-list">
      {p.students.map(r => {
        const L = PRESENCE_LABEL[r.shown] ?? PRESENCE_LABEL.offline
        return (
          <li key={r.student_id} className={L.c}>
            <span className="nm">{r.display_name}</span>
            <span className="st">{L.t}</span>
            {r.away_count > 0 && <span className="ct">나간 횟수 {r.away_count}</span>}
          </li>
        )
      })}
    </ul>
  )
}


/** 약점 화면이 주는 영역 이름을 수업할 단원으로 잇는다. */
function findLessonForArea(areas, areaName) {
  if (!areaName) return null
  for (const a of areas) {
    for (const l of (a.lessons ?? [])) {
      if (l.label?.includes(areaName) || l.id?.includes(areaName)) {
        return { ...l, areaId: a.id }
      }
    }
    if (a.id === areaName && a.lessons?.length) return { ...a.lessons[0], areaId: a.id }
  }
  return null
}
