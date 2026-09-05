import { useEffect, useMemo, useRef, useState } from 'react'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import CompactText from '../../components/CompactText.jsx'
import {
  JOB_ADAPTATION_SCALE,
  buildJobAdaptationItems,
  scoreJobAdaptation,
} from '../../lib/jobAdaptationTest.js'

const MODE = {
  quick: {
    title: '직무적응 자가진단',
    badge: '1·2학년 대비',
    description: '공개된 1·2학년 자가진단 규모를 반영한 80문항으로 6요인·12개 세부능력을 점검합니다.',
    minutes: 20,
  },
  full: {
    title: '직무적응 실전 모의',
    badge: '3학년 인증진단 대비',
    description: '공개된 3학년 인증진단 규모를 반영한 160문항을 40분 동안 응답합니다.',
    minutes: 40,
  },
}

export default function JobAdaptationScreen({
  mode = 'full',
  paperNo = null,
  onBack,
  onComplete,
}) {
  const meta = MODE[mode] || MODE.full
  const resolvedPaperNo = useMemo(() => {
    if (paperNo != null) return paperNo
    return Number(localStorage.getItem(`job_adaptation_${mode}_attempt`) || 0) + 1
  }, [mode, paperNo])
  const items = useMemo(() => buildJobAdaptationItems(mode, resolvedPaperNo), [mode, resolvedPaperNo])
  const [phase, setPhase] = useState('intro')
  const [responses, setResponses] = useState({})
  const [timeLeft, setTimeLeft] = useState(meta.minutes * 60)
  const [result, setResult] = useState(null)
  const topRef = useRef(null)
  const finalizeRef = useRef(null)

  const answered = Object.keys(responses).length
  const allDone = answered === items.length

  function reset() {
    setResponses({})
    setResult(null)
    setTimeLeft(meta.minutes * 60)
    setPhase('intro')
  }

  // 응답 중에는 아래 탭바를 감춘다. 40분 제한이 걸린 검사인데 탭을 잘못 누르면
  // 지금까지의 응답이 통째로 사라진다. 시험 화면(MissionScreen)과 같은 규칙이다.
  useEffect(() => {
    if (phase !== 'test') return
    document.body.classList.add('exam-mode')
    return () => document.body.classList.remove('exam-mode')
  }, [phase])

  const backRef = useRef(null)
  backRef.current = () => {
    if (phase === 'test') {
      if (window.confirm('직무적응 진단을 중단할까요? 지금까지의 응답은 저장되지 않습니다.')) reset()
      return
    }
    if (phase === 'result') {
      if (onComplete) onComplete(result)
      else reset()
      return
    }
    onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  function start() {
    if (paperNo == null) {
      try { localStorage.setItem(`job_adaptation_${mode}_attempt`, String(resolvedPaperNo)) } catch {}
    }
    setResponses({})
    setResult(null)
    setTimeLeft(meta.minutes * 60)
    setPhase('test')
    setTimeout(() => topRef.current?.scrollTo({ top: 0 }), 0)
  }

  function finalize() {
    const scored = scoreJobAdaptation(items, responses)
    setResult(scored)
    setPhase('result')
    try {
      const key = `job_adaptation_${mode}_history`
      const previous = JSON.parse(localStorage.getItem(key) || '[]')
      previous.push({ ts: Date.now(), paperNo: resolvedPaperNo, result: scored })
      localStorage.setItem(key, JSON.stringify(previous.slice(-10)))
    } catch {
      // 저장 공간이 없더라도 현재 결과 화면은 정상 제공한다.
    }
    setTimeout(() => topRef.current?.scrollTo({ top: 0 }), 0)
  }
  finalizeRef.current = finalize

  useEffect(() => {
    if (phase !== 'test') return
    if (timeLeft <= 0) {
      finalizeRef.current?.()
      return
    }
    const timer = setTimeout(() => setTimeLeft(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, timeLeft])

  function submit() {
    if (!allDone) {
      const first = items.find(item => responses[item.id] == null)
      document.getElementById(`ja-${first?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    finalize()
  }

  return (
    <div className="screen">
      <style>{CSS}</style>
      <div className="appbar">
        <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
        <span className="appbar-title">{meta.title}</span>
      </div>

      {phase === 'intro' && (
        <div className="screen-body" ref={topRef}>
          <div className="card ja-hero">
            <span className="ja-badge">{meta.badge}</span>
            <h2>{meta.title}</h2>
            <CompactText text={meta.description} maxItemChars={68} />
            <div className="ja-stats">
              <span><b>{items.length}</b>문항</span>
              <span><b>{meta.minutes}</b>분</span>
              <span><b>5점</b>척도</span>
            </div>
          </div>

          <div className="card ja-guide">
            <h3>응시 안내</h3>
            <p><b>정답은 없습니다.</b> 자신을 좋게 보이게 만들기보다 평소의 행동에 가깝게 답하세요.</p>
            <p>오래 고민하지 말고 모든 문항에 솔직하고 일관되게 응답하세요.</p>
            <p>무응답·과장·무성의 응답은 결과 신뢰도를 낮춥니다.</p>
          </div>

          <div className="ja-notice">
            이 결과는 학습용 비공식 자가진단이며 교육부·대한상공회의소의 공식 인증 결과나
            등급을 대신하지 않습니다.
          </div>
          <button className="ja-primary" onClick={start}>진단 시작</button>
        </div>
      )}

      {phase === 'test' && (
        <>
          <div className="ja-top">
            <div className="ja-progress">
              <div style={{ width: `${(answered / items.length) * 100}%` }} />
              <span>{answered}/{items.length}</span>
            </div>
            <b className={timeLeft <= 60 ? 'urgent' : ''}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </b>
          </div>
          <div className="screen-body" ref={topRef} style={{ paddingBottom: 94 }}>
            <div className="ja-scale-legend">
              1 {JOB_ADAPTATION_SCALE.labels[0]} · 5 {JOB_ADAPTATION_SCALE.labels[4]}
            </div>
            {items.map((item, index) => (
              <div
                key={item.id}
                id={`ja-${item.id}`}
                className={`card ja-item${responses[item.id] != null ? ' answered' : ''}`}
              >
                <p><span>{index + 1}</span>{item.text}</p>
                <div className="ja-scale">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      className={responses[item.id] === value ? 'selected' : ''}
                      onClick={() => setResponses(previous => ({ ...previous, [item.id]: value }))}
                      aria-label={`${value}점 ${JOB_ADAPTATION_SCALE.labels[value - 1]}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="ja-scale-labels">
                  <span>전혀 아니다</span><span>매우 그렇다</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ja-footer">
            <button className="ja-primary" onClick={submit}>
              {allDone ? '제출하고 결과 보기' : `${items.length - answered}문항 남음`}
            </button>
          </div>
        </>
      )}

      {phase === 'result' && result && (
        <div className="screen-body" ref={topRef}>
          <Reliability result={result.reliability} />

          <p className="section-title">6요인·12개 세부능력</p>
          {result.factors.map(factor => (
            <div key={factor.key} className="card ja-factor">
              <div className="ja-factor-head">
                <h3>{factor.name}</h3>
                <b className={factor.key}>{factor.label} {factor.score}</b>
              </div>
              <div className="ja-bar"><div style={{ width: `${factor.score}%` }} /></div>
              {factor.children.map(child => (
                <div key={child.key} className="ja-child">
                  <span>{child.name}</span>
                  <span>{child.label} {child.score}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="ja-notice">
            점수는 학습용 자기이해 지표입니다. 특정 응답을 정답처럼 외우지 말고 실제 인증진단에서도
            평소의 자신을 기준으로 솔직하게 응답하세요.
          </div>
          <button className="ja-primary" onClick={() => onComplete ? onComplete(result) : reset()}>
            {onComplete ? '모의고사 완료' : '다시 응시'}
          </button>
        </div>
      )}
    </div>
  )
}

function Reliability({ result }) {
  return (
    <div className={`card ja-reliability ${result.reliable ? 'ok' : 'warn'}`}>
      <h2>{result.reliable ? '응답 신뢰도 양호' : '응답 신뢰도 점검 필요'}</h2>
      <p>일관성 <b>{result.consistency}</b> · 과장 경향 <b>{result.impression}</b> · 집중 확인 이탈 <b>{result.attentionMisses}/{result.attentionTotal}</b></p>
      {!result.reliable && (
        <p className="ja-help">
          빠르게 같은 번호만 누르거나 자신을 지나치게 이상적으로 표현하지 않았는지 돌아보세요.
        </p>
      )}
    </div>
  )
}

const CSS = `
.ja-hero{text-align:center;border:2px solid #0f766e;background:linear-gradient(145deg,#ecfdf5,#f0fdfa)}
.ja-badge{display:inline-block;padding:4px 10px;border-radius:99px;background:#0f766e;color:#fff;font-size:11px;font-weight:800}
.ja-hero h2{font-size:20px;margin:10px 0 6px}.ja-hero p{font-size:13px;line-height:1.7;color:var(--text-muted)}
.ja-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.ja-stats span{padding:9px 4px;border-radius:10px;background:var(--card);font-size:12px;color:var(--text-muted)}
.ja-stats b{display:block;font-size:17px;color:#0f766e}
.ja-guide{margin-top:12px}.ja-guide h3{font-size:14px;margin-bottom:8px}.ja-guide p{font-size:12.5px;line-height:1.7;margin:4px 0;color:var(--text-muted)}
.ja-notice{margin:12px 0;padding:11px 13px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:12px;line-height:1.65}
.ja-primary{width:100%;border:0;border-radius:11px;padding:13px;background:#0f766e;color:#fff;font-size:15px;font-weight:800;cursor:pointer}
.ja-top{display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--card);border-bottom:1px solid var(--border)}
.ja-progress{position:relative;flex:1;height:18px;border-radius:99px;background:var(--border);overflow:hidden}
.ja-progress div{height:100%;background:#0f766e;transition:width .2s}.ja-progress span{position:absolute;inset:0;text-align:center;font-size:11px;font-weight:800;line-height:18px}
.ja-top>b{min-width:50px;text-align:right;font-variant-numeric:tabular-nums;color:#0f766e}.ja-top>b.urgent{color:#dc2626}
.ja-scale-legend{position:sticky;top:-16px;z-index:3;margin:-16px -16px 12px;padding:8px 16px;background:#ecfdf5;color:#065f46;text-align:center;font-size:11px;font-weight:700}
.ja-item{margin-bottom:10px;padding:14px;border:1px solid var(--border)}.ja-item.answered{border-color:#5eead4;background:#f0fdfa}
.ja-item>p{display:flex;gap:9px;font-size:14px;line-height:1.65}.ja-item>p>span{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#ccfbf1;color:#0f766e;font-size:11px;font-weight:800;flex-shrink:0}
.ja-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:12px}.ja-scale button{height:38px;border-radius:50%;border:1px solid #94a3b8;background:var(--card);color:var(--text);font-weight:800;cursor:pointer}.ja-scale button.selected{background:#0f766e;color:#fff;border-color:#0f766e;box-shadow:0 0 0 3px #99f6e4}
.ja-scale-labels{display:flex;justify-content:space-between;margin-top:5px;color:var(--text-muted);font-size:10px}
.ja-footer{position:absolute;left:0;right:0;bottom:0;padding:10px 16px calc(10px + var(--safe-bottom));background:var(--card);border-top:1px solid var(--border);box-shadow:0 -4px 12px rgba(0,0,0,.06)}
.ja-reliability{text-align:center;border:2px solid}.ja-reliability.ok{border-color:#10b981;background:#ecfdf5}.ja-reliability.warn{border-color:#f59e0b;background:#fffbeb}
.ja-reliability h2{font-size:18px;margin-bottom:6px}.ja-reliability p{font-size:12.5px;line-height:1.7;color:var(--text-muted)}.ja-help{margin-top:7px}
.ja-factor{margin-bottom:10px}.ja-factor-head{display:flex;justify-content:space-between;align-items:center}.ja-factor-head h3{font-size:15px}.ja-factor-head b{font-size:12px;color:#0f766e}
.ja-bar{height:7px;border-radius:99px;background:var(--border);overflow:hidden;margin:9px 0}.ja-bar div{height:100%;background:linear-gradient(90deg,#2dd4bf,#0f766e)}
.ja-child{display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)}
`
