/**
 * WrongAnswerScreen — 오답노트
 * MCQ/OX: submissions.answers를 questions.json과 비교해 오답 자동 추출
 * selfcheck: typed_answers 표시 + 모범답안 비교 (자가 점검)
 */
import { useState, useEffect, useMemo } from 'react'
import { RETIRED_SUBJECT_IDS, WRONG_NOTE_FILTERS } from '../../lib/subjectCatalog.js'
import { resolveWrongAnswer, reviewWrongAnswer } from '../../lib/wrongAnswers.js'
import { buildWrongAttemptCounts, countRepeatedQuestions } from '../../lib/wrongRepeat.js'
import { supabase } from '../../lib/supabase.js'
import { formatDate } from '../../lib/dateUtils.js'
import CompactText from '../../components/CompactText.jsx'
import PriorityReviewScreen from './PriorityReviewScreen.jsx'

import jobQuestions         from '../../../data/questions.json'
import { ncs2026Questions as ncsQuestions } from '../../lib/ncs2026.js'
import { recruitWrittenQuestions } from '../../lib/recruitWritten.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'
import foodServiceQuestions from '../../lib/foodServiceBank.js'  // 통합뱅크(기출·예상·LM 포함)
import qualityPracticeData  from '../../../data/quality-mgmt-practice.json'
import { JC_AREA_MAP } from '../../lib/jobCommonAreas.js'

const qualityQuestions = qualityPracticeData.units.flatMap(u => u.questions ?? [])

// 과목별 ID → 문항 맵
const QUESTION_MAP = {
  'job-common':   Object.fromEntries(jobQuestions.map(q => [q.id, q])),
  'ncs-basic':    Object.fromEntries(ncsQuestions.map(q => [q.id, q])),
  'recruit-written': Object.fromEntries(recruitWrittenQuestions.map(q => [q.id, q])),
  'food-service': Object.fromEntries(foodServiceQuestions.map(q => [q.id, q])),
  'quality':      Object.fromEntries(qualityQuestions.map(q => [q.id, q])),
}

const SUBJECT_LABEL = {
  'job-common':   COMMON_ABILITY_COURSES['job-common'].title,
  'ncs-basic':    COMMON_ABILITY_COURSES['ncs-basic'].title,
  'recruit-written': '채용필기 심화·확장',
  'food-service': '식음료서비스',
  'quality':      '품질경영',
  'interview':    '고졸 공정채용 면접',
}

// 문항 id → { q, subjectId } 전역 인덱스(자율학습 오답을 id로 역참조)
const GLOBAL_Q_INDEX = (() => {
  const idx = {}
  for (const [subjectId, map] of Object.entries(QUESTION_MAP))
    for (const [id, q] of Object.entries(map)) if (!idx[id]) idx[id] = { q, subjectId }
  return idx
})()
// saveWrongAnswer course_id 폴백 매핑(id 미발견 시 라벨용)
const COURSE_SUBJECT = { 1: 'job-common', 2: 'quality', 3: 'food-service', 4: 'interview' }

const DEMO_WRONG_ROWS = [
  ['job-common', jobQuestions.find(question => Array.isArray(question.choices) && question.choices.length >= 4 && /^[A-E]$/.test(question.answer || ''))],
  ['ncs-basic', ncsQuestions.find(question => Array.isArray(question.choices) && question.choices.length >= 4 && /^[A-E]$/.test(question.answer || ''))],
  ['recruit-written', recruitWrittenQuestions.find(question => Array.isArray(question.choices) && question.choices.length >= 4 && /^[A-E]$/.test(question.answer || ''))],
].filter(([, question]) => question).map(([subjectId, question], index) => {
  const correctIndex = answerIdx(question.answer)
  const userIndex = (correctIndex + 1) % question.choices.length
  return {
    question_id: question.id,
    course_id: subjectId,
    question_text: question.stem,
    correct_answer: question.answer,
    user_answer: String.fromCharCode(65 + userIndex),
    status: 'open',
    created_at: new Date(Date.now() - index * 86400000).toISOString(),
    area: question.area,
    wrong_count: index + 1,
    review_streak: 0,
  }
})

/** 저장된 area 값을 화면에 쓸 이름으로 바꾼다. 못 바꾸면 null(집계에서 뺀다).
 *
 * 저장된 값이 세 종류로 섞여 있다.
 *   '의사소통능력'  사람이 읽는 영역명 — 그대로 쓴다
 *   'job-common'   과목 id — 과목 이름으로 바꾼다
 *   'S05'          폐지 과목의 능력단위 코드 — 뜻도 모르고 공부할 자료도 없다
 */
function areaLabel(area, subjectId) {
  const raw = String(area ?? '').trim()
  // 교육부 인증 문항은 area 에 NCS 능력 이름이 들어 있다(의사소통능력·자기개발능력 …).
  // 오답노트에 그대로 뜨면 "교육부 인증인데 왜 자기개발능력?"이 되고, 이름이
  // 비슷한 NCS 26v1 과목의 약점과도 섞여 보인다. 인증 영역으로 바꿔 준다.
  if (subjectId === 'job-common' && JC_AREA_MAP[raw]) return JC_AREA_MAP[raw]
  if (/^[A-Z]\d{2}$/.test(raw)) return null            // S05 같은 내부 코드는 버린다
  if (SUBJECT_LABEL[raw]) return SUBJECT_LABEL[raw]    // 과목 id 가 들어온 경우
  if (raw && !/^[a-z][a-z-]*$/.test(raw)) return raw   // 한글 영역명은 그대로
  // 과목 이름을 영역 자리에 넣으면 "교육부 직업공통능력 인증 62개"처럼
  // 과목 전체가 약점 1위로 뜬다. 그건 영역이 아니라 과목이고, 학생이
  // 무엇을 공부해야 할지 알려 주지 못한다. 영역을 모르면 집계에서 뺀다.
  return null
}

/** 단원 이름에 남은 NCS 능력 이름을 인증 영역 이름으로 바꾼다. */
function cleanLessonTitle(title, subjectId) {
  if (subjectId !== 'job-common' || !title) return title
  return String(title)
    .replace(/의사소통능력/g, '의사소통 국어')
    .replace(/수리능력/g, '수리활용')
    .replace(/문제해결능력/g, '문제해결')
    .replace(/(자원관리|정보|기술|조직이해|대인관계|자기개발)능력\s*연계\s*·\s*/g, '')
}

function answerIdx(letter) { return letter?.charCodeAt(0) - 65 }

// 제출 1건에서 오답 목록 추출
function extractWrongAnswers(sub, subjectId) {
  const qMap   = QUESTION_MAP[subjectId] ?? QUESTION_MAP['job-common']
  const wrong  = []

  // MCQ / OX 오답
  for (const [qId, selVal] of Object.entries(sub.answers ?? {})) {
    if (qId.startsWith('_')) continue
    const q = qMap[qId]
    if (!q || q.questionMode === 'selfcheck') continue
    const sel = typeof selVal === 'number' ? selVal : parseInt(selVal)
    if (isNaN(sel)) continue
    const correctIdx = answerIdx(q.answer)
    if (sel !== correctIdx) {
      wrong.push({
        qId,
        question: q,
        myIdx:    sel,
        correctIdx,
        type:     'mcq',
        missionId: sub.mission_id,
        submittedAt: sub.completed_at,
      })
    }
  }

  // selfcheck 답안 (모범답안 있는 것만)
  for (const [qId, typedText] of Object.entries(sub.typed_answers ?? {})) {
    const q = qMap[qId]
    if (!q) continue
    wrong.push({
      qId,
      question:    q,
      typedText,
      type:        'selfcheck',
      missionId:   sub.mission_id,
      submittedAt: sub.completed_at,
    })
  }

  return wrong
}

export default function WrongAnswerScreen({ profile, demo = false }) {
  const [subs,    setSubs]    = useState([])
  const [selfWrong, setSelfWrong] = useState(() => demo ? DEMO_WRONG_ROWS : [])  // 자율학습 오답(wrong_answers, 크로스기기)
  const [loading, setLoading] = useState(!demo)
  const [filter,  setFilter]  = useState('all')   // all | job-common | ncs-basic | recruit-written
  // 이 화면에서 방금 정복한 문항. 서버에는 반영했지만 목록은 제출 기록에서
  // 다시 만들어지므로, 새로 고치기 전까지는 여기서 걸러 준다.
  const [clearedIds, setClearedIds] = useState(() => new Set())
  const [repeatOnly, setRepeatOnly] = useState(false)
  const [expandedId, setExpandedId] = useState(null)  // 펼쳐진 문항 qId+missionId
  const [showReview, setShowReview] = useState(false) // 우선 복습 큐
  const [loadError, setLoadError]   = useState(false)

  useEffect(() => { if (!demo) load() }, [demo, profile?.id])

  async function load() {
    if (!profile?.id) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setLoading(true)
    const [subRes, waRes] = await Promise.all([
      supabase
        .from('submissions')
        .select('id, mission_id, answers, typed_answers, score, total_questions, completed_at, grading_status, missions(id, title, subject_id, question_count)')
        .eq('student_id', profile.id)
        .order('completed_at', { ascending: false }),
      supabase
        .from('wrong_answers')
        .select('question_id, course_id, question_text, correct_answer, user_answer, status, created_at, area, wrong_count, review_streak')
        .eq('student_id', profile.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
    ])
    if (subRes.error || waRes.error) {
      setLoadError(true)   // 네트워크 오류를 '오답 없음(축하)'으로 위장하지 않는다
    } else {
      setLoadError(false)
      setSubs(subRes.data ?? [])
      setSelfWrong(waRes.data ?? [])
    }
    setLoading(false)
  }

  // 내 약점: 영역별 미해결 오답 집계(상위 5)
  //
  // 두 가지를 걸러야 한다.
  // ① 폐지 과목(품질경영·식음료서비스)의 옛 기록. 화면에 "S05 15개"처럼
  //    능력단위 코드가 그대로 떠서 학생은 무슨 뜻인지 알 수 없고, 설령 알아도
  //    지금은 그 과목 학습 자료가 없어 고칠 방법이 없다. 고칠 수 없는 약점을
  //    약점이라 보여 주는 것은 도움이 아니라 부담이다.
  // ② 영역이 비어 course_id 로 대체될 때 'job-common' 같은 내부 id 가 노출되던 것.
  const weakAreas = useMemo(() => {
    const m = {}
    for (const r of selfWrong) {
      const hit = GLOBAL_Q_INDEX[r.question_id]
      const subject = hit?.subjectId ?? COURSE_SUBJECT[r.course_id]
      if (RETIRED_SUBJECT_IDS.has(subject)) continue
      // 저장 당시 영역이 비어 있던 기록이 많다. 문항 자체에는 영역이 있으므로
      // 인덱스에서 되찾는다 — 그러지 않으면 62건이 '영역 없음'으로 버려진다.
      if (clearedIds.has(r.question_id)) continue
      const label = areaLabel(hit?.q?.area ?? r.area, subject)
      if (!label) continue
      m[label] = (m[label] || 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [selfWrong, clearedIds])

  // 자율학습 오답(wrong_answers) → 표시 item 변환
  const selfItems = useMemo(() => selfWrong.filter(r => {
    // 약점 분석에서만 걸렀더니 목록에는 품질경영 오답 100여 건이 그대로 떴다.
    // 지금은 그 과목 학습 자료가 없어 학생이 손쓸 방법이 없는 기록이다.
    const subjectId = GLOBAL_Q_INDEX[r.question_id]?.subjectId ?? COURSE_SUBJECT[r.course_id]
    return !RETIRED_SUBJECT_IDS.has(subjectId)
  }).map(r => {
    const hit = GLOBAL_Q_INDEX[r.question_id]
    const q = hit?.q
    const subjectId = hit?.subjectId ?? COURSE_SUBJECT[r.course_id] ?? 'job-common'
    const mid = `self-${subjectId}`
    const isMcq = q && q.questionMode !== 'selfcheck' && Array.isArray(q.choices) && q.choices.length >= 2
    if (isMcq) {
      return {
        qId: r.question_id, question: q, myIdx: answerIdx(r.user_answer), correctIdx: answerIdx(q.answer),
        type: 'mcq', source: 'self', subjectId, missionId: mid, submittedAt: r.created_at, missionTitle: '🔁 자율학습 오답',
        wrongCount: r.wrong_count,
      }
    }
    return {
      qId: r.question_id, question: q, type: 'selfcheck', source: 'self', subjectId, missionId: mid,
      submittedAt: r.created_at, missionTitle: '🔁 자율학습 오답',
      typedText: r.user_answer ? `내가 고른 답: ${r.user_answer}` : '(자율학습에서 틀린 문항)',
      storedStem: r.question_text, storedCorrect: r.correct_answer,
      wrongCount: r.wrong_count,
    }
  }), [selfWrong])

  // 전체 오답 목록 계산 (미션 제출 + 자율학습)
  const allWrong = useMemo(() => {
    const list = []
    for (const sub of subs) {
      const subjectId = sub.missions?.subject_id ?? 'job-common'
      if (RETIRED_SUBJECT_IDS.has(subjectId)) continue
      const items     = extractWrongAnswers(sub, subjectId)
      for (const item of items) {
        list.push({ ...item, subjectId, missionTitle: sub.missions?.title ?? '(미션 없음)' })
      }
    }
    for (const item of selfItems) list.push(item)
    // 방금 정복한 문항은 여기서 뺀다. 목록에서만 빼면 항목은 사라지는데
    // "총 55개 오답"은 그대로라 학생이 처리했는지 아닌지 알 수 없다.
    return list.filter(w => !clearedIds.has(w.qId))
  }, [subs, selfItems, clearedIds])

  // 서버의 누적 오답 횟수가 기준이다. 서버 행이 없는 옛 미션 기록만
  // 동일 문항의 제출 횟수로 보완한다.
  const repeatCounts = useMemo(() => buildWrongAttemptCounts(allWrong), [allWrong])

  // 영역별 취약 분석 (MCQ 오답만, 누적)
  const areaStats = useMemo(() => {
    const map = {}
    for (const w of allWrong) {
      if (w.type !== 'mcq') continue
      const area = areaLabel(w.question?.area, w.subjectId)
        ?? w.question?.lessonTitle ?? '기타'
      if (!map[area]) map[area] = { area, count: 0, uniqueQIds: new Set() }
      map[area].count++
      map[area].uniqueQIds.add(w.qId)
    }
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .map(s => ({ area: s.area, count: s.count, uniqueCount: s.uniqueQIds.size }))
  }, [allWrong])

  // 필터 적용
  const filtered = useMemo(() => {
    let list = allWrong
    if (filter !== 'all') list = list.filter(w => w.subjectId === filter)
    if (repeatOnly)       list = list.filter(w => (repeatCounts[w.qId] ?? 0) >= 2)
    return list
  }, [allWrong, filter, repeatOnly, repeatCounts])

  // 미션별 그룹핑
  const grouped = useMemo(() => {
    const map = {}
    for (const item of filtered) {
      const key = item.missionId
      if (!map[key]) map[key] = { missionTitle: item.missionTitle, subjectId: item.subjectId, submittedAt: item.submittedAt, items: [] }
      map[key].items.push(item)
    }
    return Object.values(map)
  }, [filtered])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const repeatCount = countRepeatedQuestions(repeatCounts)
  const selfCheckCount = allWrong.filter(w => w.type === 'selfcheck').length

  if (showReview) {
    return (
      <PriorityReviewScreen demoRows={demo ? selfWrong : null} onBack={() => {
        setShowReview(false)
        if (!demo) load()
      }} />
    )
  }

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">📋 오답노트</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          총 {allWrong.filter(w => w.type === 'mcq').length}개 오답
        </span>
      </div>

      <div className="screen-body">
        {/* 내 약점 요약 — 영역별 미해결 오답 상위 */}
        {weakAreas.length > 0 && (
          <div className="card" style={{ marginBottom: 14, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#9a3412', marginBottom: 8 }}>📉 내가 약한 영역 (미해결 오답)</p>
            {weakAreas.map(([area, cnt]) => (
              <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <span style={{ fontSize: 13, minWidth: 96, fontWeight: 600 }}>{area}</span>
                <div style={{ flex: 1, height: 8, background: '#fde68a', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(cnt / weakAreas[0][1]) * 100}%`, background: '#f97316', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', minWidth: 34, textAlign: 'right' }}>{cnt}개</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#9a3412', marginTop: 8 }}>오답이 많은 영역부터 우선 복습으로 정복하세요.</p>
          </div>
        )}

        {/* 우선 복습 진입 */}
        <button onClick={() => setShowReview(true)}
          style={{ width: '100%', textAlign: 'left', background: '#EDE9FE', border: '2px solid #7C3AED', borderRadius: 14, padding: '14px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 26 }}>🎯</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: '#5B21B6' }}>우선 복습 시작</p>
            <p style={{ fontSize: 12, color: '#6D28D9', marginTop: 2 }}>자주 틀린 문제 × 자주 나오는 문제부터 · 3번 연속 맞히면 정복!</p>
          </div>
          <span style={{ color: '#7C3AED', fontSize: 20 }}>›</span>
        </button>

        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <StatCard label="MCQ 오답" value={allWrong.filter(w => w.type === 'mcq').length} color="var(--danger)" />

          <StatCard label="반복 오답" value={repeatCount} color="#e65100" />
          <StatCard label="서술형 답안" value={selfCheckCount} color="var(--primary)" />
        </div>

        {/* 영역별 취약 분석 */}
        {areaStats.length > 0 && (
          <div style={{ background: '#fff3e0', borderRadius: 12, padding: '14px 16px', border: '1px solid #ffcc80', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e65100', marginBottom: 12 }}>
              📊 영역별 취약 분석 (누적)
            </p>
            {areaStats.slice(0, 6).map((s, i) => {
              const pct = Math.round((s.count / areaStats[0].count) * 100)
              const isTop = i === 0
              return (
                <div key={s.area} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: isTop ? 700 : 400, color: isTop ? '#e65100' : 'var(--text)' }}>
                      {isTop && '🔴 '}{s.area}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.count}회 · {s.uniqueCount}문항
                    </span>
                  </div>
                  <div style={{ background: '#ffe0b2', borderRadius: 999, height: 7 }}>
                    <div style={{
                      background: isTop ? '#e65100' : 'var(--primary)',
                      height: '100%', borderRadius: 999,
                      width: `${pct}%`, transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
              )
            })}
            <p style={{ fontSize: 12, color: '#856404', marginTop: 10 }}>
              💡 집중 복습 필요 영역: <strong>{areaStats[0].area}</strong>
              {areaStats.length > 1 && `, ${areaStats[1].area}`}
            </p>
          </div>
        )}

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {WRONG_NOTE_FILTERS.map(f => (
            <button key={f.id}
              className={`btn ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 999 }}
              onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 반복오답 토글 */}
        {repeatCount > 0 ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={repeatOnly} onChange={e => setRepeatOnly(e.target.checked)} />
            <span style={{ fontWeight: 700, color: repeatOnly ? '#e65100' : 'var(--text-muted)' }}>
              🔴 반복 오답만 보기 ({repeatCount}개)
            </span>
          </label>
        ) : (
          <p style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 700 }}>
            반복 오답 없음 · 새로 틀린 문항부터 복습
          </p>
        )}

        {/* 조회 오류 — 빈 상태(축하)와 구분 */}
        {loadError && (
          <div className="empty-state">
            <span className="empty-state-icon">📶</span>
            <span className="empty-state-title">오답노트를 불러오지 못했습니다</span>
            <span>네트워크 확인 후 다시 시도해 주세요.</span>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>다시 시도</button>
          </div>
        )}

        {/* 결과 없음 */}
        {!loadError && grouped.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">{allWrong.length === 0 ? '🎉' : '🔍'}</span>
            <span className="empty-state-title">
              {allWrong.length === 0 ? '오답이 없습니다!' : '해당 조건의 오답이 없습니다'}
            </span>
            <span>{allWrong.length === 0 ? '모든 문제를 맞혔어요.' : '필터를 변경해 보세요.'}</span>
          </div>
        )}

        {/* 미션별 오답 목록 */}
        {grouped.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p className="section-title" style={{ margin: 0, flex: 1 }}>{group.missionTitle}</p>
              <span className="badge badge-blue">{SUBJECT_LABEL[group.subjectId] ?? group.subjectId}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formatDate(group.submittedAt)}
              </span>
            </div>

            {group.items.map((item, ii) => (
              <WrongItem
                key={`${item.qId}-${ii}`}
                item={item}
                isRepeat={(repeatCounts[item.qId] ?? 0) >= 2}
                repeatCount={repeatCounts[item.qId] ?? 1}
                expanded={expandedId === `${item.qId}-${gi}-${ii}`}
                onToggle={() => setExpandedId(
                  expandedId === `${item.qId}-${gi}-${ii}` ? null : `${item.qId}-${gi}-${ii}`
                )}
                onCleared={qId => {
                  setClearedIds(prev => new Set(prev).add(qId))
                  setRepeatOnly(false)
                }}
                onReviewed={(qId, correct) => {
                  if (correct) return
                  setSelfWrong(rows => rows.map(row => row.question_id === qId
                    ? { ...row, wrong_count: Math.max(1, Number(row.wrong_count) || 1) + 1, review_streak: 0 }
                    : row))
                }}
              />
            ))}
          </div>
        ))}

        {/* 학습 팁 */}
        {allWrong.length > 0 && (
          <div style={{
            background: 'var(--primary-light)', borderRadius: 10,
            padding: '12px 14px', marginTop: 8,
            border: '1px solid var(--primary)',
          }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 4 }}>
              💡 시험 임박 학습 팁
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {repeatCount > 0
                ? `반복 오답 ${repeatCount}개 우선\n빈출 × 오답 횟수 순으로 집중 복습`
                : '반복 오답 없음\n미해결 오답 중 빈출 문항부터 복습'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 10, padding: '10px 8px',
      textAlign: 'center', border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
    </div>
  )
}

function WrongItem({ item, isRepeat, repeatCount, expanded, onToggle, onCleared, onReviewed }) {
  const q = item.question
  // 오답노트가 '읽고 마는 목록'에 머물러 있었다. 틀린 문제를 다시 풀 수도,
  // 이해했다고 표시해 목록에서 뺄 수도 없어서 오답은 계속 쌓이기만 했다.
  const [retry, setRetry] = useState(null)      // null | {pick, correct, streakLeft}
  const [busy, setBusy]   = useState(false)
  const canRetry = item.type === 'mcq' && q?.choices?.length >= 2 && item.correctIdx >= 0

  async function submitRetry(idx) {
    if (retry?.pick != null || busy) return
    const ok = idx === item.correctIdx
    setBusy(true)
    setRetry({ pick: idx, correct: ok })
    // 3연속 정답이면 서버가 스스로 정복 처리한다. 그 결과를 그대로 따른다 —
    // 화면에서 임의로 지우면 서버와 어긋난다.
    const status = await reviewWrongAnswer(item.qId, ok)
    setBusy(false)
    if (status) onReviewed?.(item.qId, ok)
    if (ok && status === 'resolved') onCleared?.(item.qId)
  }

  async function markUnderstood() {
    if (busy) return
    setBusy(true)
    await resolveWrongAnswer(item.qId)
    setBusy(false)
    onCleared?.(item.qId)
  }

  return (
    <div className="card" style={{
      marginBottom: 8,
      borderLeft: `4px solid ${isRepeat ? '#e65100' : item.type === 'selfcheck' ? 'var(--primary)' : 'var(--danger)'}`,
    }}>
      {/* 헤더 */}
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', padding: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>
            {item.type === 'selfcheck' ? '📝' : isRepeat ? '🔴' : '❌'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {q?.stem ?? item.storedStem ?? item.qId}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {/* 교육부 인증 문항은 area·lessonTitle 에 NCS 능력 이름이 박혀 있다
                  (조직이해능력 · 조직이해능력 종합 복습 …). 인증 과목 오답에는
                  인증 영역 이름을 보여 준다. 그러지 않으면 이름이 비슷한
                  NCS 26v1 과목의 오답과 섞여 보인다. */}
              {(areaLabel(q?.area, item.subjectId) || q?.area) && (
                <span className="badge badge-gray" style={{ fontSize: 12 }}>
                  {areaLabel(q?.area, item.subjectId) || q.area}
                </span>
              )}
              {q?.lessonTitle && (
                <span className="badge badge-gray" style={{ fontSize: 12 }}>{cleanLessonTitle(q.lessonTitle, item.subjectId)}</span>
              )}
              {isRepeat && (
                <span className="badge" style={{ background: '#fff3e0', color: '#e65100', fontSize: 12 }}>
                  반복 {repeatCount}회
                </span>
              )}
              {item.type === 'selfcheck' && (
                <span className="badge badge-blue" style={{ fontSize: 12 }}>서술형</span>
              )}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* 펼쳐진 상세 */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {item.type === 'mcq' ? (
            // MCQ 오답 상세
            <>
              {q?.choices?.map((text, ci) => {
                const isCorrect  = ci === item.correctIdx
                const isSelected = ci === item.myIdx
                return (
                  <p key={ci} style={{
                    fontSize: 13, padding: '4px 0',
                    color: isCorrect ? 'var(--success)' : isSelected ? 'var(--danger)' : 'var(--text-muted)',
                    fontWeight: isCorrect || isSelected ? 700 : 400,
                  }}>
                    {isSelected ? '▶ ' : isCorrect ? '✓ ' : '　'}
                    {ci + 1}. {text}
                    {isCorrect && ' ← 정답'}
                    {isSelected && !isCorrect && ' ← 내 답 (오답)'}
                  </p>
                )
              })}
              {q?.explanation && (
                <div style={{
                  background: 'var(--primary-light)', borderRadius: 8,
                  padding: '8px 12px', marginTop: 10,
                }}>
                  <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>💡 해설</p>
                  <CompactText text={q.explanation} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text)' }} />
                </div>
              )}
            </>
          ) : (
            // selfcheck 상세
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>내가 쓴 답</p>
                <p style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  "{item.typedText}"
                </p>
              </div>
              {(q?.modelAnswer || q?.answer || item.storedCorrect) && (
                <div style={{
                  background: '#fff8df', borderRadius: 8,
                  padding: '8px 12px', border: '1px solid #ffc107',
                }}>
                  <p style={{ fontSize: 12, color: '#856404', fontWeight: 700, marginBottom: 4 }}>📖 모범답안 / 정답</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#17212b' }}>
                    {q?.modelAnswer ?? q?.answer ?? item.storedCorrect}
                  </p>
                </div>
              )}
              {q?.explanation && (
                <CompactText text={q.explanation} maxItemChars={68} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }} />
              )}
            </>
          )}

          {/* 다시 풀기 / 이해했어요 — 오답을 '처리'할 수 있어야 노트가 줄어든다 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {canRetry && retry === null && (
              <button onClick={() => setRetry({ pick: null })} style={actionBtn('#7C3AED')}>
                ✏️ 다시 풀기
              </button>
            )}
            <button onClick={markUnderstood} disabled={busy} style={actionBtn('#059669', busy)}>
              ✅ 이해했어요 · 노트에서 빼기
            </button>
          </div>

          {retry !== null && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 10,
              background: 'var(--bg)', border: '1px solid #7C3AED33',
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#6D28D9', marginBottom: 8 }}>
                정답을 보지 말고 다시 골라 보세요
              </p>
              {q.choices.map((text, ci) => {
                const picked = retry.pick === ci
                const reveal = retry.pick != null
                let bd = 'var(--border)', bg = 'var(--card)'
                if (reveal && ci === item.correctIdx) { bd = 'var(--success)'; bg = '#ECFDF5' }
                else if (reveal && picked)            { bd = 'var(--danger)';  bg = '#FEF2F2' }
                return (
                  <button key={ci} onClick={() => submitRetry(ci)} disabled={reveal}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', gap: 8,
                      padding: '9px 11px', marginBottom: 6, borderRadius: 8,
                      border: `1.5px solid ${bd}`, background: bg,
                      fontSize: 13, lineHeight: 1.6, color: 'var(--text)',
                      cursor: reveal ? 'default' : 'pointer',
                    }}>
                    <span style={{ fontWeight: 800, flexShrink: 0 }}>{ci + 1}</span>
                    <span style={{ flex: 1 }}>{text}</span>
                  </button>
                )
              })}
              {retry.pick != null && (
                <p style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 6,
                  color: retry.correct ? '#047857' : '#B91C1C', fontWeight: 700 }}>
                  {retry.correct
                    ? '정답이에요. 3번 연속 맞히면 오답노트에서 사라져요.'
                    : `아직이에요. 정답은 ${item.correctIdx + 1}번 — 위 해설을 다시 읽어 보세요.`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const actionBtn = (color, disabled = false) => ({
  flex: 1, padding: '10px 8px', borderRadius: 9, cursor: disabled ? 'default' : 'pointer',
  border: `1.5px solid ${color}`, background: 'transparent', color,
  fontSize: 12.5, fontWeight: 800, opacity: disabled ? 0.5 : 1,
})
