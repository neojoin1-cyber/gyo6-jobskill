/**
 * PersonalityTestScreen — 모의 인성검사(정답 없음).
 * 리커트 5점 응답 수집 → 신뢰도 3척도 + 6요인 프로필 + 요인별/종합 조언.
 * mode: 'quick'(진단 간이 ~48문항) | 'full'(모의 실전 ~190문항). 제한시간=문항수×SEC_PER_ITEM.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { pushBack, popBack } from '../../lib/backButton.js'
import { addXp } from '../../lib/xp.js'
import { buildPersonalityItems, scorePersonality, SCALE, DIMENSIONS, paperCount } from '../../lib/personalityTest.js'
import { savePersonalityResult } from '../../lib/personalityResults.js'
import CompactText from '../../components/CompactText.jsx'

// 제한시간 단일 기준: 리커트 5점 자기응답 1문항당 배정 시간(초).
// 진단·모의 모두 이 값 하나로 산출해 문항당 페이스가 어긋나지 않게 한다.
//   진단 48문항 → 약 13분 · 모의 190문항 → 약 51분(≈50분)
const SEC_PER_ITEM = 16

const MODE_META = {
  quick: { title: '인성검사 진단', badge: '간이 자가진단', role: '워밍업·자가진단', baseItems: 48, repeat: '반복 진단',
    desc: '핵심 문항으로 짧고 빠르게 내 응답 습관과 신뢰도를 점검합니다. 회차가 서로 전혀 겹치지 않아 매번 새로운 문항으로 반복 연습할 수 있습니다.', xp: 20 },
  full:  { title: '인성검사 모의고사', badge: '실전 모의', role: '실전 집중 훈련', baseItems: 190, repeat: '반복 검사',
    desc: '실전 규모로 응시하며 집중 지속·속도·일관성을 훈련하고 상세 프로필 분석을 받습니다. 전체 1,030문항 뱅크에서 균형 배분해, 어느 두 회차를 골라도 겹치는 문항이 약 10%뿐입니다. 모든 회차를 풀면 전 문항을 빠짐없이 접합니다.', xp: 50 },
}

export default function PersonalityTestScreen({ subjectName = '인성검사', mode = 'full', onBack }) {
  const meta = MODE_META[mode] || MODE_META.full
  const rounds = paperCount(mode)
  const [paperNo, setPaperNo] = useState(1)
  const items = useMemo(() => buildPersonalityItems(mode, paperNo), [mode, paperNo])
  const [phase, setPhase] = useState('intro')        // intro | test | result
  const [resp, setResp] = useState({})
  const [result, setResult] = useState(null)
  const topRef = useRef(null)

  const answered = Object.keys(resp).length
  const total = items.length
  const allDone = answered === total
  // 문항 수 × 단일 기준(SEC_PER_ITEM)으로 제한시간 산출. 시간 종료 시 자동 제출.
  const timeLimitSec = total * SEC_PER_ITEM
  const minutes = Math.round(timeLimitSec / 60)   // 화면 표시용(약 N분)
  const [timeLeft, setTimeLeft] = useState(null)

  const backRef = useRef(null)
  backRef.current = () => {
    if (phase === 'result') { setPhase('intro'); setResp({}); setResult(null); return }
    if (phase === 'test') {
      // 최대 190문항 응답 유실 방지 — 무경고 이탈 금지
      if (window.confirm('검사를 중단할까요? 지금까지의 응답이 사라집니다.')) { setTimeLeft(null); setPhase('intro') }
      return
    }
    onBack?.()
  }
  useEffect(() => { const id = pushBack(() => backRef.current()); return () => popBack(id) }, []) // eslint-disable-line

  function pick(id, v) { setResp(prev => ({ ...prev, [id]: v })) }

  function startTest() { setResp({}); setTimeLeft(timeLimitSec); setPhase('test') }

  // 실제 제출·채점(수동 완료 또는 시간 종료 시). 미응답은 채점에서 자동 제외.
  function finalize() {
    setTimeLeft(null)
    const r = scorePersonality(resp)
    setResult(r)
    setPhase('result')
    try { addXp(meta.xp, `인성검사 ${meta.badge}`) } catch { /* 비로그인 */ }
    savePersonalityResult({ mode, paperNo, result: r })
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }), 30)
  }
  const finalizeRef = useRef(null)
  finalizeRef.current = finalize

  function submit() {
    if (!allDone) {
      const first = items.find(i => resp[i.id] == null)
      const el = document.getElementById('ps-item-' + first.id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('ps-missing')
      setTimeout(() => el?.classList.remove('ps-missing'), 1500)
      return
    }
    finalize()
  }

  // 카운트다운: test 단계에서 1초씩 감소, 0이 되면 자동 제출
  useEffect(() => {
    if (phase !== 'test' || timeLeft == null) return
    if (timeLeft <= 0) { finalizeRef.current?.(); return }
    const t = setTimeout(() => setTimeLeft(s => (s == null ? s : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft])

  return (
    <div className="screen">
      <style>{PS_CSS}</style>
      <div className="appbar">
        <button className="appbar-back" onClick={() => backRef.current()}>←</button>
        <span className="appbar-title">🧭 {meta.title}</span>
      </div>

      {phase === 'intro' && (
        <div className="screen-body" ref={topRef}>
          <div className="card ps-intro">
            <span className="ps-badge">{meta.badge} · {meta.role}</span>
            <h3>{subjectName} · {meta.title}</h3>
            <div className="ps-stat">{total}문항 · 약 {minutes}분 · 총 {rounds}회 {meta.repeat}</div>
            <CompactText text={meta.desc} maxItemChars={68} />
            <ul>
              <li>문항 수: <b>{total}문항</b> (5점 척도)</li>
              <li><b>정답이 없습니다.</b> 평소의 나로, 솔직하고 일관되게 답하세요.</li>
              <li>한 문항에 오래 고민하지 말고 <b>첫 느낌</b>으로 답하세요.</li>
              <li>결과로 <b>응답 신뢰도(일관성·솔직성·성실성)</b>와 <b>6요인 성향 프로필·조언</b>을 받습니다.</li>
            </ul>
          </div>

          <div className="card">
            <p className="ps-round-title">회차 선택 <span>· 총 {rounds}회, 회차마다 문항이 달라 반복 연습에 좋아요</span></p>
            <div className="ps-rounds">
              {Array.from({ length: rounds }, (_, i) => i + 1).map(n => (
                <button key={n} className={'ps-round' + (paperNo === n ? ' on' : '')} onClick={() => setPaperNo(n)}>{n}회</button>
              ))}
            </div>
          </div>

          <p className="ps-timehint">⏱ 제한시간 약 {minutes}분(문항당 {SEC_PER_ITEM}초) · 시간이 끝나면 지금까지 답한 내용으로 자동 제출됩니다.</p>
          <button className="ps-primary" onClick={startTest}>{paperNo}회 시작하기 ›</button>
        </div>
      )}

      {phase === 'test' && (
        <>
          <div className="ps-topbar">
            <div className="ps-progress-bar">
              <div className="ps-progress-fill" style={{ width: `${(answered / total) * 100}%` }} />
              <span className="ps-progress-text">{answered} / {total}</span>
            </div>
            {timeLeft != null && (
              <span className={'ps-timer' + (timeLeft <= 60 ? ' urgent' : '')}>
                ⏱ {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="screen-body" ref={topRef} style={{ paddingBottom: 100 }}>
            <p className="ps-scale-legend">① {SCALE.labels[0]} · ② {SCALE.labels[1]} · ③ {SCALE.labels[2]} · ④ {SCALE.labels[3]} · ⑤ {SCALE.labels[4]}</p>
            {items.map((it, idx) => (
              <div key={it.id} id={'ps-item-' + it.id} className={'card ps-item' + (resp[it.id] != null ? ' ps-answered' : '')}>
                <p className="ps-stem"><span className="ps-num">{idx + 1}</span>{it.text}</p>
                <div className="ps-scale">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} className={'ps-dot' + (resp[it.id] === v ? ' on' : '')} onClick={() => pick(it.id, v)}>
                      <span className="ps-dot-n">{v}</span>
                    </button>
                  ))}
                </div>
                <div className="ps-scale-ends"><span>{SCALE.labels[0]}</span><span>{SCALE.labels[4]}</span></div>
              </div>
            ))}
          </div>
          <div className="ps-footer">
            <button className="ps-primary" onClick={submit}>{allDone ? '제출하고 결과 보기' : `아직 ${total - answered}문항 남음`}</button>
          </div>
        </>
      )}

      {phase === 'result' && result && (
        <div className="screen-body" ref={topRef}>
          <ResultView result={result} onRetake={() => { setPhase('intro'); setResp({}); setResult(null) }} />
        </div>
      )}
    </div>
  )
}

function Gauge({ label, value, ok, hint, invert }) {
  // invert=true: 낮을수록 좋음(사회적바람직성). 색: ok=green, else amber
  const color = ok ? '#059669' : '#D97706'
  return (
    <div className="ps-gauge">
      <div className="ps-gauge-head"><span>{label}</span><span style={{ color, fontWeight: 800 }}>{value}{invert ? '' : '점'}</span></div>
      <div className="ps-gauge-track"><div className="ps-gauge-fill" style={{ width: `${value}%`, background: color }} /></div>
      <p className="ps-gauge-hint">{hint}</p>
    </div>
  )
}

function ResultView({ result, onRetake }) {
  const { reliability: R, profile, summary } = result
  return (
    <>
      <div className={'card ps-verdict ' + (R.reliable ? 'ok' : 'warn')}>
        <span className="ps-verdict-icon">{R.reliable ? '✅' : '⚠️'}</span>
        <div>
          <p className="ps-verdict-title">{R.verdict}</p>
          <p className="ps-verdict-sub">{R.reliable ? '성향 프로필을 신뢰할 수 있습니다.' : '성향 점수 해석 전에 응답 태도부터 점검하세요.'}</p>
        </div>
      </div>

      <p className="section-title">응답 신뢰도 (실제 검사가 가장 먼저 보는 부분)</p>
      <div className="card">
        <Gauge label="일관성" value={R.consistency} ok={R.consistencyOk}
          hint={R.consistencyOk ? '비슷한 문항에 비슷한 기준으로 응답함' : '비슷한 문항의 응답 기준이 달랐음 · 평소 행동을 기준으로 다시 점검'} />
        <Gauge label="솔직성 (사회적 바람직성)" value={R.social} ok={R.socialOk} invert
          hint={R.socialOk ? '과장 경향이 크지 않음' : '이상적인 모습으로 응답한 경향이 나타남 · 실제 행동을 기준으로 다시 점검'} />
        <div className="ps-inf">
          <span>성실 응답(비전형성)</span>
          <b style={{ color: R.infrequency.ok ? '#059669' : '#D97706' }}>
            {R.infrequency.ok ? '양호' : `이탈 ${R.infrequency.deviant}/${R.infrequency.total}`}
          </b>
        </div>
      </div>

      {R.flags.length > 0 && (
        <div className="card ps-flags">
          <p className="ps-flags-title">⚠️ 개선할 점</p>
          {R.flags.map((f, i) => <p key={i} className="ps-flag">• {f}</p>)}
        </div>
      )}

      <p className="section-title">6요인 성향 프로필</p>
      <div className="card">
        {profile.map(p => (
          <div key={p.key} className="ps-dim">
            <div className="ps-dim-head">
              <span className="ps-dim-name">{p.name}<span className="ps-dim-short"> · {p.short}</span></span>
              <span className={'ps-dim-band ' + p.band}>{p.bandLabel} {p.score}</span>
            </div>
            <div className="ps-dim-track"><div className={'ps-dim-fill ' + p.band} style={{ width: `${p.score}%` }} /></div>
            <CompactText text={p.advice} maxItemChars={68} className="ps-dim-advice" />
          </div>
        ))}
      </div>

      <div className="card ps-summary">
        <p className="ps-summary-title">💡 종합 조언</p>
        <CompactText text={summary} maxItemChars={68} />
        <p className="ps-summary-note">실전 대비 핵심 · 문항 끝까지 읽기 · 평소 행동 기준 · 과장 없이 응답하기</p>
      </div>

      <button className="ps-primary" onClick={onRetake}>다시 응시</button>
    </>
  )
}

const PS_CSS = `
.ps-intro h3{font-size:16px;margin:6px 0 8px;color:var(--text)}
.ps-stat{display:inline-block;background:#ccfbf1;color:#0f5132;font-size:12.5px;font-weight:800;padding:6px 12px;border-radius:20px;margin:2px 0 10px}
.ps-intro p{font-size:13.5px;color:var(--text-muted);margin-bottom:10px}
.ps-intro ul{margin:0;padding-left:18px}
.ps-intro li{font-size:13px;margin:6px 0;color:var(--text)}
.ps-badge{display:inline-block;background:#0d9488;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.ps-primary{display:block;width:calc(100% - 32px);margin:14px 16px;padding:15px;background:var(--primary);color:#fff;border:0;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer}
.ps-round-title{font-size:13px;font-weight:800;margin-bottom:10px}
.ps-round-title span{font-size:11px;font-weight:400;color:var(--text-muted)}
.ps-rounds{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.ps-round{padding:9px 0;border:1.5px solid var(--border);background:var(--card);border-radius:9px;font-size:13px;font-weight:700;color:var(--text-muted);cursor:pointer}
.ps-round.on{background:var(--primary);border-color:var(--primary);color:#fff}
.ps-topbar{display:flex;align-items:stretch;gap:0;background:var(--card);border-bottom:1px solid var(--border)}
.ps-timer{display:flex;align-items:center;justify-content:center;min-width:82px;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;color:#0f766e;background:#ccfbf1;padding:0 12px}
.ps-timer.urgent{color:#fff;background:#dc2626;animation:pspulse 1s ease-in-out infinite}
@keyframes pspulse{50%{opacity:.6}}
.ps-timehint{font-size:12px;color:var(--text-muted);text-align:center;margin:12px 16px 0}
.ps-progress-bar{position:relative;flex:1;height:26px;background:var(--border);margin:0}
.ps-progress-fill{height:100%;background:linear-gradient(90deg,#0d9488,#14b8a6);transition:width .3s}
.ps-progress-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--text)}
.ps-scale-legend{font-size:11px;color:var(--text-muted);text-align:center;margin:10px 0}
.ps-item{margin-bottom:10px;transition:box-shadow .3s}
.ps-item.ps-answered{border-color:#99f6e4}
.ps-item.ps-missing{box-shadow:0 0 0 2px #f59e0b}
.ps-stem{font-size:14px;font-weight:600;margin:0 0 10px;line-height:1.5}
.ps-num{display:inline-block;min-width:22px;color:var(--primary);font-weight:800;margin-right:4px}
.ps-scale{display:flex;gap:6px;justify-content:space-between}
.ps-dot{flex:1;aspect-ratio:1;max-width:52px;border:1.5px solid var(--border);background:var(--card);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
.ps-dot .ps-dot-n{font-size:14px;font-weight:700;color:var(--text-muted)}
.ps-dot.on{background:var(--primary);border-color:var(--primary)}
.ps-dot.on .ps-dot-n{color:#fff}
.ps-scale-ends{display:flex;justify-content:space-between;margin-top:5px;font-size:10.5px;color:var(--text-muted)}
.ps-footer{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--border);padding:0}
.ps-footer .ps-primary{margin:10px 16px}
.ps-verdict{display:flex;align-items:center;gap:12px}
.ps-verdict.ok{background:#ecfdf5;border-color:#a7f3d0}
.ps-verdict.warn{background:#fffbeb;border-color:#fde68a}
.ps-verdict-icon{font-size:28px}
.ps-verdict-title{font-size:15px;font-weight:800}
.ps-verdict-sub{font-size:12.5px;color:var(--text-muted);margin-top:2px}
.ps-gauge{margin:12px 0}
.ps-gauge-head{display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:5px}
.ps-gauge-track{height:9px;background:var(--border);border-radius:5px;overflow:hidden}
.ps-gauge-fill{height:100%;border-radius:5px;transition:width .5s}
.ps-gauge-hint{font-size:11.5px;color:var(--text-muted);margin-top:5px}
.ps-inf{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.ps-flags{background:#fffbeb;border-color:#fde68a}
.ps-flags-title{font-size:13px;font-weight:800;color:#b45309;margin-bottom:6px}
.ps-flag{font-size:12.5px;color:#78350f;margin:5px 0;line-height:1.5}
.ps-dim{margin:12px 0;padding-bottom:12px;border-bottom:1px solid var(--border)}
.ps-dim:last-child{border-bottom:0;padding-bottom:0}
.ps-dim-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
.ps-dim-name{font-size:13.5px;font-weight:700}
.ps-dim-short{font-size:11px;color:var(--text-muted);font-weight:400}
.ps-dim-band{font-size:12px;font-weight:800;padding:1px 8px;border-radius:20px}
.ps-dim-band.high{background:#dcfce7;color:#15803d}
.ps-dim-band.mid{background:#e0e7ff;color:#4338ca}
.ps-dim-band.low{background:#fee2e2;color:#b91c1c}
.ps-dim-track{height:8px;background:var(--border);border-radius:5px;overflow:hidden}
.ps-dim-fill{height:100%;border-radius:5px}
.ps-dim-fill.high{background:#22c55e}.ps-dim-fill.mid{background:#6366f1}.ps-dim-fill.low{background:#f59e0b}
.ps-dim-advice{font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.55}
.ps-summary{background:#f0fdfa;border-color:#99f6e4}
.ps-summary-title{font-size:14px;font-weight:800;color:#0f766e;margin-bottom:6px}
.ps-summary p{font-size:13px;line-height:1.6}
.ps-summary-note{font-size:11.5px;color:var(--text-muted);margin-top:8px}
`
