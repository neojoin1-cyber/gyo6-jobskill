import { useState, useMemo } from 'react'
import { recordAnswer } from '../../lib/mastery.js'
import { recordQuestion } from '../../lib/subjectProgress.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { addXp } from '../../lib/xp.js'
import { recordReview } from '../../lib/srs.js'
import { noteStudied } from '../../lib/dailyChallenge.js'
import { learningModeOf } from '../../lib/learningMode.js'

/**
 * 인출 퀴즈 — 완전교재 학습 후 검증문항을 선택형으로 풀이.
 * 학습과학: 정답 가림 → 스스로 생성(선택) → 즉시 피드백(해설).
 * 정답=마스터리 기록+XP, 오답=오답노트(wrong_answers) 저장.
 *
 * props:
 *   questions: [{id, stem, context, choices[], answer('A'..), explanation}]
 *   subjectId: 'food-service'|'job-common'  (마스터리 키)
 *   courseId:  number  (오답노트 course_id: 식음료 3 / 직업공통 1)
 *   unitId:    string  (마스터리 lessonId)
 *   onClose:   () => void
 */
export default function QuizRunner({ questions, subjectId, courseId, unitId, onClose }) {
  const pool = useMemo(() => questions.filter(q => q?.choices?.length >= 2 && /^[A-E]$/.test(q.answer || '')), [questions])
  const [i, setI]           = useState(0)
  const [sel, setSel]       = useState(null)   // 선택 인덱스 | null
  const [revealed, setReveal] = useState(false)
  const [score, setScore]   = useState(0)
  const [overconf, setOverconf] = useState(0)  // 메타인지 보정: '알아요'인데 오답
  const [conf, setConf]     = useState(null)   // 사전 자신감 예측: 'high'|'mid'|'low'|null
  const [calib, setCalib]   = useState([])     // [{conf, correct}] — 보정 리포트용
  const [done, setDone]     = useState(false)

  if (pool.length === 0) {
    return (
      <div className="screen-body" style={{ textAlign: 'center', paddingTop: 50 }}>
        <p style={{ fontSize: 36 }}>🎯</p>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>이 단원은 선택형 인출 문항이 없습니다.</p>
        <button onClick={onClose} style={primaryBtn}>돌아가기</button>
      </div>
    )
  }

  const q = pool[i]
  const correctIdx = (q.answer.charCodeAt(0) - 65)
  const qUnit = q._unitId || unitId   // 복습 모드에선 문항이 여러 단원에 걸침

  function choose(idx) {
    if (revealed) return
    setSel(idx); setReveal(true)
    const correct = idx === correctIdx
    if (correct) { setScore(s => s + 1); addXp(10, 'textbook_quiz') }
    else { saveWrongAnswer(q, courseId, String.fromCharCode(65 + idx)) }
    recordAnswer(subjectId, qUnit, correct)
    recordQuestion(subjectId, q.id, correct)
    if (conf) setCalib(c => [...c, { conf, correct }])  // 사전 예측 → 실제 대조
  }

  // 자기평가(메타인지) → SRS 품질 결정 + 과신 집계 후 다음으로
  function rate(level) {
    const correct = sel === correctIdx
    const quality = level === 'know'  ? (correct ? 5 : 2)
                  : level === 'maybe' ? (correct ? 3 : 1)
                  : 1
    if (level === 'know' && !correct) setOverconf(n => n + 1)
    recordReview({ subject: subjectId, unitId: qUnit, itemId: q.id, demand: learningModeOf(q).id }, quality)
    noteStudied(subjectId, q.area ?? qUnit)    // 오늘의 도전이 "요즘 공부한 곳"을 알도록
    next()
  }

  function next() {
    if (i < pool.length - 1) { setI(i + 1); setSel(null); setReveal(false); setConf(null) }
    else setDone(true)
  }

  // ── 결과 ──
  if (done) {
    const pct = Math.round((score / pool.length) * 100)
    const good = pct >= 70
    return (
      <div className="screen-body" style={{ textAlign: 'center', paddingTop: 40 }}>
        <p style={{ fontSize: 48 }}>{good ? '🎉' : '💪'}</p>
        <p style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{score} / {pool.length} 정답</p>
        <p style={{ fontSize: 15, color: good ? '#10B981' : '#F59E0B', fontWeight: 700, marginTop: 4 }}>정답률 {pct}%</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.7, padding: '0 20px' }}>
          {good ? '잘했어요! 틀린 문항은 오답노트에서 다시 복습할 수 있어요.' : '틀린 문항은 오답노트에 저장됐어요. 개념을 다시 보고 재도전해 보세요.'}
        </p>
        {overconf > 0 && (
          <div style={{ margin: '16px 20px 0', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 12.5, color: '#c2410c', lineHeight: 1.7 }}>
              🧠 <strong>메타인지 체크:</strong> '알아요'라고 했지만 틀린 문항이 {overconf}개 있어요.
              안다고 느끼는 것과 실제로 아는 것은 다를 수 있어요 — 이 개념들을 다시 확인해 보세요.
            </p>
          </div>
        )}
        {(() => {
          // 보정 리포트: 사전 예측 vs 실제 정답
          const hi = calib.filter(c => c.conf === 'high')
          const lo = calib.filter(c => c.conf === 'low')
          if (calib.length < 3) return null
          const hiWrong = hi.filter(c => !c.correct).length
          const loRight = lo.filter(c => c.correct).length
          const rate = arr => arr.length ? Math.round(arr.filter(c => c.correct).length / arr.length * 100) : null
          let msg = null
          if (hiWrong >= 2) msg = { c: '#c2410c', bg: '#fff7ed', bd: '#fed7aa', t: `과신 주의 — '자신있음'이라 했지만 ${hiWrong}문항 틀렸어요. 확실하다고 느낀 개념일수록 근거까지 다시 확인해 보세요.` }
          else if (loRight >= 2) msg = { c: '#065f46', bg: '#ecfdf5', bd: '#a7f3d0', t: `실력 과소평가 — '모름'이라 했지만 ${loRight}문항 맞혔어요! 생각보다 잘 알고 있어요. 자신감을 가져도 좋아요.` }
          else msg = { c: '#1e40af', bg: '#eff6ff', bd: '#bfdbfe', t: `예측 정확도 좋음 — 자신감과 실제 실력이 잘 맞아요. 이 감각을 유지하세요.` }
          return (
            <div style={{ margin: '16px 20px 0', background: msg.bg, border: `1px solid ${msg.bd}`, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 12.5, color: msg.c, lineHeight: 1.7 }}>
                🎯 <strong>자신감 보정:</strong> {msg.t}
                {rate(hi) != null && <span style={{ display: 'block', marginTop: 4, opacity: .85 }}>자신있음 정답률 {rate(hi)}%{rate(lo) != null && ` · 모름 정답률 ${rate(lo)}%`}</span>}
              </p>
            </div>
          )
        })()}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>자기평가에 따라 복습 주기가 자동 조정됐어요. 🔁</p>
        <div style={{ display: 'flex', gap: 8, padding: '20px 20px 0' }}>
          <button onClick={() => { setI(0); setSel(null); setReveal(false); setScore(0); setOverconf(0); setConf(null); setCalib([]); setDone(false) }} style={{ ...outlineBtn, flex: 1 }}>다시 풀기</button>
          <button onClick={onClose} style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>학습으로</button>
        </div>
      </div>
    )
  }

  // ── 문항 ──
  return (
    <div className="screen-body">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((i) / pool.length) * 100}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}/{pool.length}</span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px 18px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, marginBottom: 8 }}>🎯 인출 문제</p>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: q.context ? 10 : 14 }}>{q.stem}</p>
        {q.context && (
          <div style={{ background: 'var(--bg)', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0', padding: '10px 13px', marginBottom: 14, fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {q.context}
          </div>
        )}

        {!revealed && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              풀기 전 — 맞힐 자신 있나요? <span style={{ fontWeight: 400 }}>(선택)</span>
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['high', '👍 자신있음', '#10B981'], ['mid', '🤔 보통', '#F59E0B'], ['low', '😅 모름', '#EF4444']].map(([k, label, color]) => (
                <button key={k} onClick={() => setConf(k)} style={confBtn(color, conf === k)}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {q.choices.map((c, idx) => {
          const isCorrect = idx === correctIdx
          const isPicked  = idx === sel
          let bg = 'var(--card)', bd = 'var(--border)', fg = 'var(--text)'
          if (revealed) {
            if (isCorrect) { bg = '#d1fae5'; bd = '#10B981'; fg = '#065f46' }
            else if (isPicked) { bg = '#fee2e2'; bd = '#EF4444'; fg = '#991b1b' }
          }
          return (
            <button key={idx} onClick={() => choose(idx)} disabled={revealed}
              style={{
                width: '100%', textAlign: 'left', background: bg,
                border: `1.5px solid ${bd}`, borderRadius: 11, color: fg,
                padding: '12px 14px', marginBottom: 9,
                fontSize: 14, lineHeight: 1.5, cursor: revealed ? 'default' : 'pointer',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
              <span style={{ fontWeight: 800, flexShrink: 0, color: revealed && isCorrect ? '#065f46' : 'var(--text-muted)' }}>
                {revealed && isCorrect ? '✓' : revealed && isPicked ? '✗' : idx + 1}
              </span>
              <span style={{ flex: 1 }}>{c}</span>
            </button>
          )
        })}

        {revealed && (
          <div style={{ marginTop: 6 }}>
            <div style={{ background: sel === correctIdx ? '#ecfdf5' : '#fff7ed', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: sel === correctIdx ? '#065f46' : '#c2410c', marginBottom: 6 }}>
                {sel === correctIdx ? '정답입니다! ✓' : `정답: ${String.fromCharCode(65 + correctIdx)}`}
              </p>
              {q.explanation && <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text)' }}>{q.explanation}</p>}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
              이 개념, 얼마나 확실했나요? <span style={{ fontWeight: 400 }}>(복습 주기가 조정돼요)</span>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => rate('again')} style={rateBtn('#EF4444')}>🔁 다시</button>
              <button onClick={() => rate('maybe')} style={rateBtn('#F59E0B')}>🤔 애매</button>
              <button onClick={() => rate('know')}  style={rateBtn('#10B981')}>✅ 알아요</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={onClose} style={{ ...outlineBtn, marginTop: 12 }}>학습으로 돌아가기</button>
    </div>
  )
}

const primaryBtn = {
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
  cursor: 'pointer', marginTop: 16,
}
const outlineBtn = {
  width: '100%', padding: '12px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
function rateBtn(color) {
  return {
    flex: 1, padding: '11px 6px', borderRadius: 11,
    border: `1.5px solid ${color}`, background: 'var(--card)', color,
    fontWeight: 800, fontSize: 13, cursor: 'pointer',
  }
}
function confBtn(color, active) {
  return {
    flex: 1, padding: '9px 4px', borderRadius: 9,
    border: `1.5px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : 'var(--card)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
  }
}
