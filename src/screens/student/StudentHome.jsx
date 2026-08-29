import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { supabase }            from '../../lib/supabase.js'
import { ThemeToggle }         from '../../lib/theme.jsx'
import { formatDueDate }       from '../../lib/dateUtils.js'
import { getLevelInfo }        from '../../lib/xp.js'
import { addXp }               from '../../lib/xp.js'
import { recordActivity }      from '../../lib/activity.js'
import {
  getDailyChallenge,
  completeDailyChallenge,
  getDailyStatus,
  describeMix,
  PICK_REASONS,
} from '../../lib/dailyChallenge.js'
import { getDueItems } from '../../lib/srs.js'
import { findQuestion } from '../../lib/questionIndex.js'
import { getAttendance, todaysTalk } from '../../lib/morningTalk.js'
import { getWeeklyBest } from '../../lib/speedQuiz.js'
import { isReviewReminderEnabled, setReviewReminderEnabled } from '../../lib/reminders.js'
import { lazyChunk } from '../../lib/lazyChunk.js'
import { getBootstrap, sync as syncProgress } from '../../lib/localFirst.js'
import CompactText from '../../components/CompactText.jsx'

const MISSION_STATUS_COLOR = { active: 'badge-green', closed: 'badge-gray', draft: 'badge-yellow' }
const MISSION_STATUS_LABEL = { active: '진행중', closed: '마감', draft: '대기' }

// ── 일일 도전 미니 퀴즈 ─────────────────────────────────────────────────
function DailyChallengeOverlay({ challenge, onClose }) {
  const [idx,     setIdx]     = useState(0)
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState({})
  const [done,    setDone]    = useState(false)
  const [score,   setScore]   = useState(0)

  const qs   = challenge.questions
  const q    = qs[idx]
  const mode = q?.questionMode === 'ox' ? 'ox' : 'mcq'

  function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

  function pick(ci) {
    if (checked[idx]) return
    const correct = ci === answerIdx(q.answer)
    setAnswers(a => ({ ...a, [idx]: ci }))
    setChecked(c => ({ ...c, [idx]: true }))
    if (correct) setScore(s => s + 1)
  }

  function next() {
    if (idx < qs.length - 1) setIdx(i => i + 1)
    else finish()
  }

  function finish() {
    const finalScore = Object.keys(checked).reduce((acc, i) => {
      const qi = qs[i]
      return acc + (answers[i] === answerIdx(qi?.answer) ? 1 : 0)
    }, 0)
    completeDailyChallenge(finalScore)
    addXp(50, 'daily_challenge')
    recordActivity('study')
    setScore(finalScore)
    setDone(true)
  }

  const correctIdx = answerIdx(q?.answer)
  const isChecked  = checked[idx]
  const myIdx      = answers[idx]
  // 이 문항이 왜 나왔는지 알려 준다. 이유를 알아야 숙제가 아니라 자기 학습이 된다.
  const why = PICK_REASONS[q?.pickReason] ?? null

  if (done) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 340, textAlign: 'center', padding: '28px 24px' }}>
          <div style={{ fontSize: 56 }}>{score >= 4 ? '🎉' : score >= 3 ? '👏' : '📚'}</div>
          <p style={{ fontSize: 22, fontWeight: 900, marginTop: 12 }}>
            {score} / {qs.length}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, marginBottom: 4 }}>
            {score >= 4 ? '완벽해요! 오늘도 최고입니다.' : score >= 3 ? '잘했어요! 꾸준히 도전하세요.' : '다음엔 더 잘할 수 있어요!'}
          </p>
          <p style={{ fontSize: 13, color: '#F59E0B', fontWeight: 700, marginBottom: 20 }}>
            +50 XP 획득 🏆
          </p>
          <button className="btn btn-primary btn-full" onClick={onClose}>확인</button>
        </div>
      </div>
    )
  }

  if (!q) return null

  const choices = mode === 'ox'
    ? [{ text: 'O (맞다)' }, { text: 'X (틀리다)' }]
    : (q.choices ?? []).map(c => ({ text: typeof c === 'string' ? c : c.text ?? '' }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{
        background: 'var(--card)', borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 520, padding: '24px 20px 36px',
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {qs.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: 4,
                background: i < idx ? 'var(--primary)' : i === idx ? '#F59E0B' : 'var(--border)',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{idx + 1} / {qs.length}</span>
        </div>

        {/* 문제 */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>오늘의 도전 🎯</p>
        {/* 이 문항이 나온 이유. 무작위가 아니라는 것을 학생이 알아야
            "왜 이걸 또 푸나" 싶은 반복이 의미 있는 복습으로 읽힌다. */}
        {why && why.label && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
            padding: '5px 11px', borderRadius: 999,
            background: 'var(--primary-light)', border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 14 }}>{why.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{why.label}</span>
            {why.hint && (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>· {why.hint}</span>
            )}
          </div>
        )}
        {q.context && (
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 12,
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, borderLeft: '3px solid var(--primary)' }}>
            {q.context}
          </div>
        )}
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.65, marginBottom: 16 }}>{q.stem}</p>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {choices.map((c, ci) => {
            const isCorrect = ci === correctIdx
            const isMine    = ci === myIdx
            let bg = 'var(--bg)', border = 'var(--border)', color = 'var(--text)'
            if (isChecked) {
              if (isCorrect)        { bg = '#D1FAE5'; border = '#10B981'; color = '#065F46' }
              else if (isMine)      { bg = '#FEE2E2'; border = '#EF4444'; color = '#7F1D1D' }
            } else if (isMine)      { bg = 'var(--primary-light)'; border = 'var(--primary)' }
            return (
              <button key={ci} onClick={() => pick(ci)}
                disabled={isChecked}
                style={{
                  padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${border}`,
                  background: bg, color, fontSize: 14, textAlign: 'left',
                  cursor: isChecked ? 'default' : 'pointer', lineHeight: 1.5, fontWeight: isMine ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontWeight: 900, flexShrink: 0, width: 22,
                  color: isChecked && isCorrect ? '#10B981' : isChecked && isMine && !isCorrect ? '#EF4444' : 'var(--text-muted)' }}>
                  {mode === 'ox' ? (ci === 0 ? 'O' : 'X') : ci + 1}
                </span>
                {c.text}
              </button>
            )
          })}
        </div>

        {/* 해설 */}
        {isChecked && q.explanation && (
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10,
            padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#0369A1', lineHeight: 1.65 }}>
            <CompactText text={q.explanation} maxItemChars={68} />
          </div>
        )}

        {isChecked && (
          <button className="btn btn-primary btn-full" onClick={next}>
            {idx < qs.length - 1 ? '다음 문제 →' : '결과 보기 🎉'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── XP 레벨 바 ───────────────────────────────────────────────────────────
function XpBar({ xpData, weekly = null, inline = false }) {
  if (!xpData) return null
  const info = getLevelInfo(xpData.total_xp ?? 0)
  // 앱바(진한 배경) 안에서는 레벨 색이 묻힌다. 그때는 흰 계열로 바꾼다.
  const nameColor = inline ? 'rgba(255,255,255,0.95)' : info.color
  const subColor  = inline ? 'rgba(255,255,255,0.72)' : 'var(--text-muted)'
  const track     = inline ? 'rgba(255,255,255,0.25)' : 'var(--border)'
  const fill      = inline ? '#fff' : info.color
  return (
    <div style={{ marginBottom: inline ? 0 : 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: nameColor }}>
          {info.icon} {info.name}
        </span>
        <span style={{ fontSize: 11, color: subColor }}>
          {info.xp.toLocaleString()} XP
          {info.next && <span> / {info.next.minXp.toLocaleString()}</span>}
          {weekly != null && weekly > 0 && (
            <span style={{ marginLeft: 8, fontWeight: 700, color: inline ? '#fff' : 'var(--primary)' }}>
              +{weekly.toLocaleString()} 이번 주
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: track, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, background: fill,
          width: `${info.progress}%`, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
// 복습 세션은 홈에 들어올 때마다 필요한 화면이 아니다. 눌렀을 때 가져온다.
const PriorityReviewScreen = lazyChunk(() => import('./PriorityReviewScreen.jsx'), 'PriorityReviewScreen')
const AttendanceScreen     = lazyChunk(() => import('./AttendanceScreen.jsx'), 'AttendanceScreen')
const SpeedQuizScreen      = lazyChunk(() => import('./SpeedQuizScreen.jsx'), 'SpeedQuizScreen')

/** 복습 세션이 실제로 낼 수 있는 문항 수. 세션과 같은 조건으로 거른다. */
async function countDue() {
  const rows = await getDueItems(200)
  return rows.filter(r => {
    const q = findQuestion(r.itemId)
    return q && q.choices?.length >= 2 && /^[A-E]$/.test(q.answer || '')
  }).length
}

export default function StudentHome({ profile, onOpenMission, onLogout, onGoStudy, onImmersive }) {
  const [missions,     setMissions]     = useState([])
  const [submissions,  setSubmissions]  = useState({})
  const [streak,       setStreak]       = useState(null)
  const [xpData,       setXpData]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [dailyStatus,  setDailyStatus]  = useState(null)
  const [showChallenge, setShowChallenge] = useState(false)
  const [challenge,    setChallenge]    = useState(null)
  const [dueCount,     setDueCount]     = useState(0)   // SRS 오늘 복습 문항 수
  const [showReview,   setShowReview]   = useState(false) // 오늘의 복습 세션
  const [showAttend,   setShowAttend]   = useState(false) // 아침 출석
  const [showSpeed,    setShowSpeed]    = useState(false) // 스피드 퀴즈
  const [attend,       setAttend]       = useState(() => getAttendance())
  const [remindOn,     setRemindOn]     = useState(isReviewReminderEnabled())  // 복습 알림 on/off

  useEffect(() => { load() }, [])
  // 배지는 **실제로 낼 수 있는** 문항만 센다. 서버의 due 개수를 그대로 쓰면
  // "11개"라고 해 놓고 세션은 8문항만 여는 일이 생긴다(발문이 깨져 걸러지는
  // 문항이 섞여 있다). 세션과 같은 기준으로 세야 말이 어긋나지 않는다.
  // 복습할 문항 수도 부트스트랩이 준다. 따로 세러 가지 않는다.
  useEffect(() => { getBootstrap().then(b => setDueCount(b?.due_count ?? 0)) }, [])
  // 도전 구성을 미리 만들어 둔다. 카드에 "복습 2 · 지난 오답 1 …"을 띄우려면
  // 열기 전에 무엇으로 채워졌는지 알아야 하고, 하루 한 번만 계산되므로
  // 두 번째 방문부터는 서버 왕복 없이 저장된 것을 그대로 쓴다.
  useEffect(() => {
    getDailyChallenge().then(c => { setChallenge(c); setDailyStatus(getDailyStatus()) })
  }, [])

  useEffect(() => {
    setDailyStatus(getDailyStatus())
  }, [showChallenge])  // 도전 닫을 때 상태 갱신

  async function load() {
    setLoading(true)
    // 학급·스트릭·XP 는 rpc_bootstrap 한 번으로 받고 5분간 캐시에서 쓴다.
    // 예전에는 화면을 열 때마다 세 번 따로 물었다. 몇 분 지난 값이어도
    // 학생이 알아채지 못하는 것들이라 서버를 그만큼 자주 칠 이유가 없다.
    const boot = await getBootstrap()
    setStreak(boot?.streak ?? null)
    setXpData(boot?.xp ?? { total_xp: 0, weekly_xp: 0, level: 1 })
    setDailyStatus(getDailyStatus())

    const classIds = boot?.class_ids ?? []
    if (classIds.length === 0) { setLoading(false); return }

    // 미션과 제출 현황도 부트스트랩이 함께 준다(예전에는 조회 2번이 더 나갔다).
    const ms = boot?.missions ?? []
    setMissions(ms)
    const subMap = {}
    for (const m of ms) {
      if (m.completed_at || m.score != null) {
        subMap[m.id] = { mission_id: m.id, score: m.score, total_questions: m.total_questions,
                         completed_at: m.completed_at, grading_status: m.grading_status }
      }
    }
    setSubmissions(subMap)
    setLoading(false)
  }

  async function openDailyChallenge() {
    // 보통은 마운트 때 미리 만들어 둔 것이 있다. 없으면(첫 진입 직후 탭 등)
    // 여기서 기다린다 — 신호 조회가 실패해도 조용히 신호 없이 진행된다.
    const c = challenge ?? await getDailyChallenge()
    setChallenge(c)
    setShowChallenge(true)
  }

  function closeDailyChallenge() {
    setShowChallenge(false)
    setDailyStatus(getDailyStatus())
    // XP 갱신
    syncProgress().then(r => {
      if (r?.xp) setXpData(r.xp)
      if (r?.streak) setStreak(r.streak)
    })
  }

  const pending = useMemo(() => missions.filter(m => m.status === 'active' && !submissions[m.id]), [missions, submissions])
  const done    = useMemo(() => missions.filter(m => submissions[m.id]), [missions, submissions])
  const closed  = useMemo(() => missions.filter(m => m.status === 'closed' && !submissions[m.id]), [missions, submissions])

  // 출석·스피드퀴즈·복습은 홈을 통째로 덮는다. 그동안 아래 탭바가 그대로 보이면
  // 눌러도 아무 일이 없다 — 홈 탭은 이미 홈이라 상태가 안 바뀌기 때문이다.
  // 학생 눈에는 "버튼이 고장 났다"로 보이고, 실제로 스피드 퀴즈 화면에서 빠져
  // 나오지 못했다. 덮고 있는 동안에는 탭바를 감춰 ← 만 쓰게 한다.
  useEffect(() => {
    onImmersive?.(showAttend || showSpeed || showReview)
    return () => onImmersive?.(false)
  }, [showAttend, showSpeed, showReview, onImmersive])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // 복습 세션은 홈을 덮는다. 끝나고 돌아오면 남은 개수를 다시 센다 —
  // 방금 푼 문항이 그대로 배지에 남아 있으면 아무 일도 없던 것처럼 보인다.
  if (showAttend) return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <AttendanceScreen
        onBack={() => {
          setShowAttend(false)
          setAttend(getAttendance())
          // 활동을 마쳤으니 쌓인 기록을 지금 보낸다. 서버가 계산한 XP·스트릭이
          // 응답으로 돌아오므로 따로 조회하지 않는다(왕복 2회 → 1회).
          syncProgress().then(r => {
            if (r?.xp) setXpData(r.xp)
            if (r?.streak) setStreak(r.streak)
          })
        }} />
    </Suspense>
  )

  if (showSpeed) return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <SpeedQuizScreen
        onBack={() => {
          setShowSpeed(false)
          getBootstrap().then(b => b?.xp && setXpData(b.xp))
        }} />
    </Suspense>
  )

  if (showReview) return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <PriorityReviewScreen
        source="srs"
        onBack={() => {
          setShowReview(false)
          getBootstrap({ force: true }).then(b => setDueCount(b?.due_count ?? 0))
          getBootstrap().then(b => b?.xp && setXpData(b.xp))
        }} />
    </Suspense>
  )

  const todayActive = streak?.last_active_date === new Date().toISOString().slice(0, 10)
  const dailyDone   = dailyStatus?.completed === true

  return (
    <div className="screen">
      {showChallenge && challenge && (
        <DailyChallengeOverlay challenge={challenge} onClose={closeDailyChallenge} />
      )}

      {/* 이름줄과 XP 카드가 따로 있어 화면 위쪽 두 칸을 먹었다. 둘 다 '지금
          내가 누구이고 어디까지 왔나'를 말하므로 한 덩어리로 합친다.
          세로 공간이 약 90px 줄어 첫 화면에 카드가 하나 더 들어온다. */}
      <div className="appbar appbar-profile">
        <div className="appbar-row">
          <span className="appbar-title">👋 {profile.display_name}</span>
          <ThemeToggle />
          <button className="appbar-back" onClick={onLogout} style={{ fontSize: 13 }}>로그아웃</button>
        </div>
        <XpBar xpData={xpData} weekly={xpData?.weekly_xp ?? 0} inline />
      </div>

      <div className="screen-body">

        {/* ── 아침 출석 ── 하루를 여는 자리라 맨 위에 둔다 */}
        <button
          onClick={() => setShowAttend(true)}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: attend.done
              ? 'var(--card)'
              : 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: `1.5px solid ${attend.done ? 'var(--border)' : '#F59E0B'}`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{ fontSize: 34, lineHeight: 1 }}>{attend.done ? '✅' : '🌅'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: attend.done ? 'var(--text)' : '#78350F' }}>
              {attend.done ? '오늘 출석 완료' : '아침 출석하기'}
            </p>
            <p style={{
              fontSize: 12, marginTop: 3, color: attend.done ? 'var(--text-muted)' : '#92400E',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {attend.done
                ? `“${todaysTalk()?.oneLine ?? ''}”`
                : `오늘의 이야기 · ${todaysTalk()?.theme ?? ''} · 2분`}
            </p>
          </div>
          <span style={{ fontSize: 20, color: attend.done ? 'var(--text-muted)' : '#B45309' }}>›</span>
        </button>

        {/* ── 스트릭 배너 ── */}
        {streak && (
          <div style={{
            background: todayActive
              ? 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)'
              : 'linear-gradient(135deg, var(--primary) 0%, #818CF8 100%)',
            borderRadius: 16, padding: '16px 18px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 14,
            color: '#fff',
          }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>
              {streak.current_streak >= 7 ? '🔥' : streak.current_streak >= 3 ? '⚡' : '✨'}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                {streak.current_streak}일 연속
                {todayActive && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8, opacity: 0.85 }}>오늘 완료!</span>}
              </p>
              <p style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                최장 {streak.longest_streak}일 · 총 {streak.total_days}일 학습
              </p>
            </div>
            {!todayActive && (
              <div style={{ textAlign: 'right', opacity: 0.9 }}>
                <p style={{ fontSize: 12 }}>오늘 학습하면</p>
                <p style={{ fontSize: 12, fontWeight: 700 }}>{streak.current_streak + 1}일로 ↑</p>
              </div>
            )}
          </div>
        )}

        {/* ── 오늘의 도전 카드 ── */}
        <button
          onClick={dailyDone ? undefined : openDailyChallenge}
          style={{
            width: '100%', textAlign: 'left', cursor: dailyDone ? 'default' : 'pointer',
            background: dailyDone
              ? 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)'
              : 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: `1.5px solid ${dailyDone ? '#10B981' : '#F59E0B'}`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>
            {dailyDone ? '✅' : '🎯'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15,
              color: dailyDone ? '#065F46' : '#92400E', marginBottom: 3 }}>
              오늘의 도전
            </p>
            {dailyDone ? (
              <p style={{ fontSize: 12, color: '#065F46' }}>
                완료! {dailyStatus.score}/{dailyStatus.total} 정답 · +50 XP 획득
              </p>
            ) : (
              <p style={{ fontSize: 12, color: '#78350F' }}>
                {describeMix(dailyStatus?.mix)}
              </p>
            )}
          </div>
          {!dailyDone && (
            <span style={{ fontSize: 20, color: '#92400E' }}>›</span>
          )}
        </button>

        {/* ── 오늘 복습(SRS 간격 반복) 카드 ── */}
        {dueCount > 0 && (
          <button
            onClick={() => setShowReview(true)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
              border: '1.5px solid #7C3AED', borderRadius: 14,
              padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{ position: 'relative', fontSize: 36, lineHeight: 1 }}>
              🔁
              <span style={{
                position: 'absolute', top: -6, right: -10,
                background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 800,
                minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{dueCount}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#5B21B6', marginBottom: 3 }}>
                오늘 복습할 문항 {dueCount}개
              </p>
              <p style={{ fontSize: 12, color: '#6D28D9' }}>
                잊어버릴 때쯤 다시 풀면 오래 기억돼요 · 간격 반복
              </p>
            </div>
            <span style={{ fontSize: 20, color: '#7C3AED' }}>›</span>
          </button>
        )}

        {/* ── 주간 스피드 퀴즈 ── */}
        <button
          onClick={() => setShowSpeed(true)}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
            border: '1.5px solid #2563EB', borderRadius: 14,
            padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{ fontSize: 34, lineHeight: 1 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: '#1E3A8A' }}>스피드 퀴즈</p>
            <p style={{ fontSize: 12, color: '#1D4ED8', marginTop: 3 }}>
              60초 안에 최대한 많이 ·{' '}
              {getWeeklyBest() ? `이번 주 최고 ${getWeeklyBest()}점` : '이번 주 첫 도전'}
            </p>
          </div>
          <span style={{ fontSize: 20, color: '#2563EB' }}>›</span>
        </button>

        {/* ── 복습 알림 토글 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', marginBottom: 14,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <span style={{ fontSize: 17 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>복습 알림</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>매일 오후 5시, 복습할 문항을 알려드려요</p>
          </div>
          <button
            role="switch" aria-checked={remindOn}
            onClick={async () => {
              const next = !remindOn
              const enabled = await setReviewReminderEnabled(next)
              setRemindOn(enabled)
            }}
            style={{
              width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: remindOn ? '#7C3AED' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}>
            <span style={{
              position: 'absolute', top: 3, left: remindOn ? 23 : 3,
              width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,.25)',
            }} />
          </button>
        </div>

        {/* ── 미션 목록 ── */}
        {missions.length === 0 && !streak && (
          <div className="empty-state">
            <span className="empty-state-icon">📚</span>
            <span className="empty-state-title">아직 미션이 없습니다</span>
            <span>선생님이 미션을 배정하면 여기에 표시됩니다.</span>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <p className="section-title">🔥 진행 중인 미션</p>
            {pending.map(m => <MissionCard key={m.id} mission={m} sub={null} onStart={() => onOpenMission(m)} />)}
          </>
        )}

        {done.length > 0 && (
          <>
            <p className="section-title">✅ 완료한 미션</p>
            {done.map(m => <MissionCard key={m.id} mission={m} sub={submissions[m.id]} onStart={null} />)}
          </>
        )}

        {closed.length > 0 && (
          <>
            <p className="section-title">🔒 마감된 미션 (미응시)</p>
            {closed.map(m => <MissionCard key={m.id} mission={m} sub={null} onStart={null} />)}
          </>
        )}
      </div>
    </div>
  )
}

function MissionCard({ mission, sub, onStart }) {
  const isPending = mission.status === 'active' && !sub
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>{mission.title}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${
              sub?.grading_status === 'pending' ? 'badge-yellow'
              : sub ? 'badge-blue'
              : MISSION_STATUS_COLOR[mission.status]
            }`}>
              {sub?.grading_status === 'pending' ? '채점 대기' : sub ? '완료' : MISSION_STATUS_LABEL[mission.status]}
            </span>
            <span className="badge badge-blue">{mission.mission_type}</span>
            {mission.classes && <span className="badge badge-gray">{mission.classes.name}</span>}
          </div>
        </div>
        {sub && sub.grading_status === 'pending' ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e65100' }}>채점 대기</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>선택형 {sub.score}/{sub.total_questions}</p>
          </div>
        ) : sub ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
              {Math.round(sub.score / sub.total_questions * 100)}%
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.score}/{sub.total_questions}</p>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: isPending ? 12 : 0 }}>
        <span>{mission.question_count}문항{mission.time_limit_min ? ` · ${mission.time_limit_min}분` : ''}</span>
        {mission.due_at && <span>마감: {formatDueDate(mission.due_at)}</span>}
      </div>
      {isPending && (
        <button className="btn btn-primary btn-full" onClick={onStart}>
          미션 시작 →
        </button>
      )}
    </div>
  )
}
