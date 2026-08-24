import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { Capacitor } from '@capacitor/core'
import { pushBack, popBack } from '../../lib/backButton.js'
import { loadTextbook } from '../../lib/textbooks.js'
import { getDueItemIds } from '../../lib/srs.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { addXp } from '../../lib/xp.js'
import { recordAnswer } from '../../lib/mastery.js'
import { recordQuestion } from '../../lib/subjectProgress.js'
import { lazyChunk } from '../../lib/lazyChunk.js'
import CompactText from '../../components/CompactText.jsx'

const QuizRunner = lazyChunk(() => import('./QuizRunner.jsx'), 'QuizRunner')

// 오답노트 course_id (1:직업기초/직업공통 2:품질 3:식음료 4:면접)
const COURSE_ID = { 'food-service': 3, 'quality': 2, 'interview': 4, 'ncs-basic': 1, 'job-common': 1 }
function courseIdOf(subjectId) { return COURSE_ID[subjectId] ?? 1 }

// 블록별 인라인 확인문제 로더 (과목별 lazy import)
const INLINE_LOADERS = {
  'ncs-basic':   () => import('../../../data/block-inline-ncs-basic.json'),
  'quality':     () => import('../../../data/block-inline-quality.json'),
  'food-service':() => import('../../../data/block-inline-food-service.json'),
}

/**
 * 완전교재 리더 — 10블록 표준 완전교재를 앱에서 열람.
 * 각 단원은 자기완결 HTML(자체 <style> 포함)이라 iframe(srcdoc)으로 스타일 격리 렌더.
 * 출제예시의 정답 접기(details)가 인출-우선 학습(정답 가림→생성→피드백)을 제공.
 *
 * props: subjectId, subjectName, onBack. 교육부 인증 교재(job-common)는
 * 공식 5영역 자율학습 전용이며 구형 완전교재 리더에서 열지 않는다.
 */
export default function TextbookReader({ subjectId, subjectName, onBack }) {
  const [bundle, setBundle] = useState(null)   // { subject, subjectName, units:[{unitId,title,area,html}] }
  const [loadErr, setLoadErr] = useState(false)
  const [idx, setIdx]         = useState(null) // 열람 중인 단원 인덱스 | null=목록
  const [quizOn, setQuizOn]   = useState(false) // 인출 퀴즈 모드
  const [dueQs, setDueQs]     = useState([])    // 오늘 복습할 문항(SRS due, 일일 상한 적용)
  const [dueTotal, setDueTotal] = useState(0)   // 상한 적용 전 전체 due 수
  const [reviewOn, setReviewOn] = useState(false) // 복습 세션 모드
  const [dueVer, setDueVer]   = useState(0)     // due 재조회 트리거(퀴즈 후 갱신)
  const [blockIdx, setBlockIdx] = useState(0)   // 단원 내 블록 페이지(한 화면 한 블록)
  const [fullView, setFullView] = useState(false) // 전체 스크롤 보기 토글
  const [tocOpen, setTocOpen]   = useState(false) // 전체화면 리더의 목차 패널
  const [readSet, setReadSet] = useState(() => loadRead(subjectId))
  const [progMap, setProgMap] = useState(() => loadProg(subjectId)) // 단원별 진행율 {unitId:{r,t}}
  const [inlineMap, setInlineMap] = useState(null) // {units:{unitId:{blockIdx:[qObj]}}}
  const [inlineQ, setInlineQ]   = useState(null)   // 현재 띄운 인라인 확인문제 {q, bi}
  const [answered, setAnswered] = useState(() => new Set()) // 이번 세션에 푼 블록 `${unitId}:${bi}`

  // 블록별 인라인 확인문제 데이터 로드(과목별)
  useEffect(() => {
    let alive = true
    setInlineMap(null)
    const loader = INLINE_LOADERS[subjectId]
    if (!loader) return
    loader().then(m => { if (alive) setInlineMap(m.default || m) }).catch(() => {})
    return () => { alive = false }
  }, [subjectId])

  // 완전교재 로드 (Supabase 최신 우선 → 없으면 앱 번들 폴백)
  useEffect(() => {
    let alive = true
    setBundle(null); setLoadErr(false)
    loadTextbook(subjectId)
      .then(res => { if (alive) setBundle(res) })
      .catch(() => { if (alive) setLoadErr(true) })
    return () => { alive = false }
  }, [subjectId])

  // 오늘 복습할 문항(SRS due_at <= now) 계산
  const REVIEW_DAILY_CAP = 30
  useEffect(() => {
    if (!bundle?.units?.length) { setDueQs([]); return }
    let alive = true
    getDueItemIds(subjectId).then(ids => {
      if (!alive) return
      if (!ids.length) { setDueQs([]); return }
      const idSet = new Set(ids)
      const qs = []
      for (const u of bundle.units)
        for (const q of (u.quiz || []))
          if (idSet.has(q.id)) qs.push({ ...q, _unitId: u.unitId })
      // 과부하 방지: 하루 최대 30문항(며칠 밀려도 한 세션에 몰리지 않게 — 나머지는 내일)
      setDueTotal(qs.length)
      setDueQs(qs.slice(0, REVIEW_DAILY_CAP))
    })
    return () => { alive = false }
  }, [bundle, subjectId, dueVer])

  // 퀴즈/복습 세션 종료 → 목록으로 & due 재조회
  function endSession() { setQuizOn(false); setReviewOn(false); setDueVer(v => v + 1) }

  // Android 뒤로가기: 퀴즈→열람, 열람→목록, 목록→상위
  const backRef = useRef(null)
  backRef.current = () => {
    if (inlineQ) setInlineQ(null)
    else if (reviewOn || quizOn) endSession()
    else if (idx !== null && !fullView && blockIdx > 0) setBlockIdx(b => b - 1)
    else if (idx !== null) setIdx(null)
    else onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  const units = bundle?.units ?? []

  // 영역(area)이 있으면 영역별로 그룹핑(직업공통), 없으면 단일 그룹(식음료)
  const groups = useMemo(() => {
    if (!units.some(u => u.area)) return [{ area: null, items: units.map((u, i) => ({ u, i })) }]
    const map = new Map()
    units.forEach((u, i) => {
      const a = u.area || '기타'
      if (!map.has(a)) map.set(a, [])
      map.get(a).push({ u, i })
    })
    return [...map.entries()].map(([area, items]) => ({ area, items }))
  }, [units])

  // 열람 중 단원 HTML을 블록 단위로 분해(한 화면 한 블록 페이징용)
  const parsed = useMemo(
    () => (idx != null && units[idx]) ? parseBlocks(units[idx].html) : null,
    [idx, units]
  )

  // 진행율 기록 — 현재 단원에서 도달한 블록/총 블록을 저장(가장 멀리 본 지점 유지)
  useEffect(() => {
    if (idx == null || !units[idx] || !parsed?.blocks?.length) return
    const uid = units[idx].unitId
    const total = parsed.blocks.length
    const reached = Math.min(blockIdx, total - 1) + 1
    setProgMap(prev => {
      const cur = prev[uid]
      if (cur && cur.t === total && cur.r >= reached) return prev
      const next = { ...prev, [uid]: { r: Math.max(reached, cur?.r || 0), t: total } }
      saveProg(subjectId, next)
      return next
    })
  }, [idx, blockIdx, parsed, units, subjectId])

  // 전체화면 몰입 — 단원 열람 중에는 시스템 상태바(시계·배터리)를 숨긴다
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const reading = idx !== null && !quizOn && !reviewOn
    import('@capacitor/status-bar')
      .then(m => (reading ? m.StatusBar.hide() : m.StatusBar.show()).catch(() => {}))
      .catch(() => {})
  }, [idx, quizOn, reviewOn])
  // 리더 이탈(언마운트) 시 상태바 복원
  useEffect(() => () => {
    if (Capacitor.isNativePlatform())
      import('@capacitor/status-bar').then(m => m.StatusBar.show().catch(() => {})).catch(() => {})
  }, [])

  function openUnit(i) {
    setIdx(i); setQuizOn(false); setBlockIdx(0); setFullView(false); setTocOpen(false); setInlineQ(null)
    const uid = units[i]?.unitId
    if (uid && !readSet.has(uid)) {
      const next = new Set(readSet); next.add(uid)
      setReadSet(next); saveRead(subjectId, next)
    }
  }

  // ── 로딩/에러 ──
  if (loadErr) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={onBack}>←</button>
          <span className="appbar-title">📘 {subjectName} 완전교재</span>
        </div>
        <div className="screen-body" style={{ textAlign: 'center', paddingTop: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📚</p>
          <p style={{ color: 'var(--text-muted)' }}>교재를 불러오지 못했어요.</p>
        </div>
      </div>
    )
  }
  if (!bundle) {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>완전교재 불러오는 중...</p>
      </div>
    )
  }

  // ── 복습 세션(SRS due) ──
  if (reviewOn) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={endSession}>←</button>
          <span className="appbar-title">🔁 오늘 복습 ({dueQs.length}문항{dueTotal > dueQs.length ? ` · 내일 ${dueTotal - dueQs.length}` : ''})</span>
        </div>
        <Suspense fallback={<div className="screen-body" style={{ textAlign: 'center', paddingTop: 40 }}><div className="spinner" /></div>}>
          <QuizRunner
            questions={dueQs}
            subjectId={subjectId}
            courseId={courseIdOf(subjectId)}
            unitId="review"
            onClose={endSession}
          />
        </Suspense>
      </div>
    )
  }

  // ── 인출 퀴즈 모드 ──
  if (idx !== null && quizOn) {
    const u = units[idx]
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={endSession}>←</button>
          <span className="appbar-title" style={{ fontSize: 14 }}>📝 {u.title} 단원평가</span>
        </div>
        <Suspense fallback={<div className="screen-body" style={{ textAlign: 'center', paddingTop: 40 }}><div className="spinner" /></div>}>
          <QuizRunner
            questions={u.quiz || []}
            subjectId={subjectId}
            courseId={courseIdOf(subjectId)}
            unitId={u.unitId}
            onClose={endSession}
          />
        </Suspense>
      </div>
    )
  }

  // ── 단원 열람 (전체화면 몰입 리더 — 셸 크롬 위 오버레이) ──
  if (idx !== null) {
    const u = units[idx]
    const quizCount = (u.quiz || []).length
    const blocks = parsed?.blocks || []
    const bi = Math.min(blockIdx, Math.max(0, blocks.length - 1))
    const isLast = bi >= blocks.length - 1
    const canPage = blocks.length >= 2 && !fullView

    // 이 블록의 인라인 확인문제(있으면 '다음' 시 먼저 풀기)
    const inlineForBi = !fullView ? (inlineMap?.units?.[u.unitId]?.[String(bi)]?.[0] || null) : null
    const inlineDone = answered.has(`${u.unitId}:${bi}`)
    const onNext = () => {
      if (inlineForBi && !inlineDone) setInlineQ({ q: inlineForBi, bi })
      else setBlockIdx(bi + 1)
    }
    const afterInline = (markDone) => {
      if (markDone) setAnswered(prev => new Set(prev).add(`${u.unitId}:${inlineQ.bi}`))
      const nb = inlineQ.bi + 1
      setInlineQ(null)
      if (nb < blocks.length) setBlockIdx(nb)
    }

    // 인라인 확인문제 오버레이 (읽기 → 풀기 → 계속의 티키타카 리듬)
    if (inlineQ) {
      return (
        <div style={readerOverlay}>
          <div style={readerTop}>
            <button onClick={() => setInlineQ(null)} style={iconBtn} aria-label="닫기">✕</button>
            <span style={readerTitle}>✓ 확인문제</span>
            <span style={pageInd}>{inlineQ.bi + 1}/{blocks.length}</span>
          </div>
          <InlineCheck q={inlineQ.q} mode={['quiz', 'flash', 'speed'][inlineQ.bi % 3]}
            subjectId={subjectId} courseId={courseIdOf(subjectId)}
            unitId={u.unitId} onDone={() => afterInline(true)} onSkip={() => afterInline(false)} />
        </div>
      )
    }

    const inner = blocks.length === 0 ? null
      : fullView
        ? `${parsed.header || ''}<div class="container">${blocks.map(b => b.html).join('')}</div>`
        : `${bi === 0 && parsed.header ? parsed.header : ''}<div class="container">${blocks[bi].html}</div>`
    const doc = blocks.length === 0 ? wrapDoc(u.html) : buildReaderDoc(parsed.css, inner)

    return (
      <div style={readerOverlay}>
        {/* 슬림 상단바: 닫기 · 제목 · 목차 (셸 크롬 제거) */}
        <div style={readerTop}>
          <button onClick={() => setIdx(null)} style={iconBtn} aria-label="닫기">✕</button>
          <span style={readerTitle}>{u.title}</span>
          {canPage && <span style={pageInd}>{bi + 1}/{blocks.length}</span>}
          {blocks.length >= 2 && <button onClick={() => setTocOpen(v => !v)} style={tocBtn}>☰ 목차</button>}
        </div>

        {/* 목차 패널(토글) */}
        {tocOpen && blocks.length >= 2 && (
          <div style={tocPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>목차 · 원하는 곳으로 이동</span>
              <button onClick={() => { setFullView(v => !v); setTocOpen(false) }} style={tocBtn}>{fullView ? '📄 한 화면씩' : '📜 전체 펼쳐보기'}</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {blocks.map((b, i) => (
                <button key={i} onClick={() => { setBlockIdx(i); setFullView(false); setTocOpen(false) }}
                  style={{ ...chipStyle, ...(i === bi && !fullView ? chipActive : {}) }}>{chipLabel(b.tag, i)}</button>
              ))}
            </div>
          </div>
        )}

        {/* 콘텐츠 — 화면 최대 사용 + 손가락 확대/축소 */}
        <iframe key={fullView ? 'full' : bi} title={u.title} srcDoc={doc}
          style={{ flex: 1, width: '100%', border: 'none', background: '#eef1f6' }} />

        {/* 슬림 하단: 이전 · 다음 (필수 버튼만) */}
        <div style={readerBottom}>
          {canPage ? (
            <>
              <button onClick={() => setBlockIdx(Math.max(0, bi - 1))} disabled={bi === 0} style={navBtn(bi === 0)}>← 이전</button>
              {!isLast ? (
                <button onClick={onNext} style={navPrimary}>
                  {inlineForBi && !inlineDone ? '✓ 확인문제 풀고 다음 →' : '다음 →'}
                </button>
              ) : quizCount > 0 ? (
                <button onClick={() => setQuizOn(true)} style={navPrimary}>📝 단원평가 ({quizCount})</button>
              ) : (
                <button onClick={() => idx < units.length - 1 ? openUnit(idx + 1) : setIdx(null)} style={navPrimary}>
                  {idx < units.length - 1 ? '다음 단원 →' : '목록으로'}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => idx > 0 && openUnit(idx - 1)} disabled={idx === 0} style={navBtn(idx === 0)}>← 이전 단원</button>
              {quizCount > 0 && <button onClick={() => setQuizOn(true)} style={navPrimary}>📝 단원평가 ({quizCount})</button>}
              <button onClick={() => idx < units.length - 1 ? openUnit(idx + 1) : setIdx(null)} style={navBtn(false)}>
                {idx < units.length - 1 ? '다음 단원 →' : '목록'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── 단원 목록 ──
  const readCount = units.filter(u => readSet.has(u.unitId)).length
  const pct = units.length ? Math.round((readCount / units.length) * 100) : 0

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">📘 {subjectName} 완전교재</span>
      </div>
      <div className="screen-body">
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>학습 진행</span>
            <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{readCount}/{units.length} 단원 · {pct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width .4s' }} />
          </div>
        </div>

        {dueQs.length > 0 && (
          <button onClick={() => setReviewOn(true)}
            style={{
              width: '100%', textAlign: 'left', background: '#EDE9FE',
              border: '2px solid #7C3AED', borderRadius: 14,
              padding: '14px 16px', marginBottom: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <div style={{ fontSize: 26 }}>🔁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#5B21B6' }}>오늘 복습할 문항 {dueQs.length}개</p>
              <p style={{ fontSize: 12, color: '#6D28D9', marginTop: 2 }}>간격 반복 — 잊어버릴 때쯤 다시 풀면 오래 기억돼요</p>
            </div>
            <span style={{ color: '#7C3AED', fontSize: 20 }}>›</span>
          </button>
        )}

        <p className="section-title">단원 선택 (10블록 완전교재)</p>
        {groups.map(g => (
          <div key={g.area || 'all'}>
            {g.area && (
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', letterSpacing: 1, margin: '18px 2px 8px' }}>
                📂 {g.area} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>· {g.items.length}단원</span>
              </p>
            )}
            {g.items.map(({ u, i }) => {
              const p = progMap[u.unitId]
              const upct = p && p.t ? Math.min(100, Math.round(p.r / p.t * 100)) : 0
              const done = upct >= 100
              return (
                <button key={u.unitId + i} onClick={() => openUnit(i)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'var(--card)',
                    border: '1px solid var(--border)', borderRadius: 12,
                    padding: '13px 14px', marginBottom: 9, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                  {/* 진행율 링(원형) */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 19, flexShrink: 0,
                    background: done ? '#10B981' : upct > 0 ? `conic-gradient(var(--primary) ${upct * 3.6}deg, var(--border) 0deg)` : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 15, background: 'var(--card)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: done ? '#059669' : upct > 0 ? 'var(--primary)' : 'var(--text-muted)',
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4, marginBottom: upct > 0 ? 5 : 0 }}>{u.title}</p>
                    {upct > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 130, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${upct}%`, background: done ? '#10B981' : 'var(--primary)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: done ? '#059669' : 'var(--primary)' }}>{done ? '완료' : `${upct}%`}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>시작 전</span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function navBtn(disabled) {
  return {
    flex: 1, padding: '10px', borderRadius: 10,
    border: '1px solid var(--border)',
    background: disabled ? 'var(--bg)' : 'var(--card)',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

// 교재 표시 정비(2026-07-11): pre 줄바꿈(지문 가로 잘림 방지)·목차 대비·이미지 안전 + ASCII 박스문자 정리
// (박스 프레임은 한글 혼용 시 어떤 폰트로도 정렬 불가 — 표시 단계에서 텍스트만 남긴다)
const DOC_FIX_CSS = '<style id="kbs-fix">pre{white-space:pre-wrap!important;word-break:keep-all;overflow-x:auto;max-width:100%}.toc,.toc-box{background:#fff!important}.toc li,.toc li a,.toc-box li,.toc-box li a{color:#283593!important}img,svg{max-width:100%;height:auto}.context-box,.doc-box,.exam-box{overflow-x:auto}</style>'
function sanitizeDoc(html) {
  let s = String(html || '')
  if (/[┌┐└┘├┤┬┴┼│╭╮╰╯]/.test(s)) {
    s = s.split(String.fromCharCode(10)).filter(l => !(/^[\s┌┐└┘├┤┬┴┼─╭╮╰╯]+$/.test(l) && l.trim())).join(String.fromCharCode(10))
    s = s.replace(/│/g, ' ').replace(/[┌┐└┘├┤┬┴┼╭╮╰╯]/g, '').replace(/([^-=])─+/g, '$1')
  }
  if (s.includes('id="kbs-fix"')) return s
  return s.includes('</head>') ? s.replace('</head>', DOC_FIX_CSS + '</head>') : DOC_FIX_CSS + s
}

// 자기완결 HTML을 그대로 srcdoc으로. (이미 <!DOCTYPE>~</html> 완결형)
function wrapDoc(html) {
  if (/^\s*<!DOCTYPE/i.test(html) || /<html/i.test(html)) return sanitizeDoc(html)
  return sanitizeDoc(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`)
}

// 단원 HTML을 { css, header, blocks[] }로 분해 (한 화면 한 블록 페이징용)
// 긴 블록(h3 소제목 2개+)은 소제목 단위로 더 잘게 분할 → 진짜 '한 화면 한 개념'.
function parseBlocks(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const css = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n')
    const header = doc.querySelector('.unit-header')?.outerHTML || ''
    const blocks = []
    for (const b of doc.querySelectorAll('.block')) {
      const tag = (b.querySelector('.block-tag')?.textContent || '').trim()
      const h3s = b.querySelectorAll('h3')
      if (h3s.length < 2) { blocks.push({ tag, html: b.outerHTML }); continue }

      // 소제목(h3) 단위로 분할. 각 페이지는 블록태그+h2(맥락)를 유지.
      const tagNode = b.querySelector('.block-tag')
      const h2Node  = b.querySelector('h2')
      const headHtml = (tagNode?.outerHTML || '') + (h2Node?.outerHTML || '')
      const intro = []; const sections = []; let cur = null
      for (const el of b.children) {
        if (el === tagNode || el === h2Node) continue
        if (el.tagName === 'H3') { cur = [el]; sections.push(cur) }
        else if (cur) cur.push(el)
        else intro.push(el)
      }
      sections.forEach((sec, si) => {
        const introHtml = si === 0 ? intro.map(e => e.outerHTML).join('') : ''
        const body = sec.map(e => e.outerHTML).join('')
        blocks.push({
          tag: `${tag} ${si + 1}/${sections.length}`,
          html: `<div class="block">${headHtml}${introHtml}${body}</div>`,
        })
      })
    }
    return { css, header, blocks }
  } catch { return { css: '', header: '', blocks: [] } }
}

// 블록 칩 라벨(짧게). block-tag가 "① 학습 도입" 형태면 그대로, 없으면 번호.
function chipLabel(tag, i) {
  const t = (tag || '').replace(/\s+/g, ' ').trim()
  if (!t) return `${i + 1}`
  return t.length > 9 ? t.slice(0, 9) : t
}

const miniToggle = {
  marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--primary)',
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 16,
  padding: '4px 10px', cursor: 'pointer',
}
const quizBarBtn = {
  margin: '8px 12px 0', padding: '12px', borderRadius: 12, border: 'none',
  background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

// ── 읽음 상태(로컬) ──
function readKey(subjectId) { return `tb_read_${subjectId}` }
function loadRead(subjectId) {
  try { return new Set(JSON.parse(localStorage.getItem(readKey(subjectId)) || '[]')) }
  catch { return new Set() }
}
function saveRead(subjectId, set) {
  try { localStorage.setItem(readKey(subjectId), JSON.stringify([...set])) } catch { /* ignore */ }
}

// ── 진행율 상태(로컬) — 단원별 {r:도달블록수, t:총블록수} ──
function progKey(subjectId) { return `tb_prog_${subjectId}` }
function loadProg(subjectId) {
  try { return JSON.parse(localStorage.getItem(progKey(subjectId)) || '{}') || {} } catch { return {} }
}
function saveProg(subjectId, map) {
  try { localStorage.setItem(progKey(subjectId), JSON.stringify(map)) } catch { /* ignore */ }
}

// 리더 문서 — 커스텀 핀치줌/팬(앱 전역 user-scalable=no라 WebView 기본 줌이 막혀 있어 JS로 직접 구현)
const READER_VP = 'width=device-width, initial-scale=1'
const PINCH_JS = `<script>(function(){
  var el=document.querySelector('.container')||document.body;
  el.style.transformOrigin='0 0';
  var scale=1,tx=0,ty=0,sd=0,ss=1,mx=0,my=0,ltx=0,lty=0,ps=null,lt=0;
  function ap(){el.style.transform=scale===1?'':'translate('+tx+'px,'+ty+'px) scale('+scale+')';}
  function clamp(){if(scale<=1){tx=0;ty=0;return;}var w=el.offsetWidth,h=el.offsetHeight;var mnx=Math.min(0,window.innerWidth-w*scale),mny=Math.min(0,window.innerHeight-h*scale);tx=Math.max(mnx,Math.min(0,tx));ty=Math.max(mny,Math.min(0,ty));}
  function dd(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);}
  document.addEventListener('touchstart',function(e){
    if(e.touches.length===2){sd=dd(e.touches);ss=scale;mx=(e.touches[0].clientX+e.touches[1].clientX)/2;my=(e.touches[0].clientY+e.touches[1].clientY)/2;ltx=tx;lty=ty;e.preventDefault();}
    else if(e.touches.length===1&&scale>1){ps={x:e.touches[0].clientX,y:e.touches[0].clientY};ltx=tx;lty=ty;}
  },{passive:false});
  document.addEventListener('touchmove',function(e){
    if(e.touches.length===2&&sd){var ns=Math.min(5,Math.max(1,ss*dd(e.touches)/sd));var cx=(mx-ltx)/ss,cy=(my-lty)/ss;scale=ns;tx=mx-cx*scale;ty=my-cy*scale;clamp();ap();e.preventDefault();}
    else if(e.touches.length===1&&scale>1&&ps){tx=ltx+(e.touches[0].clientX-ps.x);ty=lty+(e.touches[0].clientY-ps.y);clamp();ap();e.preventDefault();}
  },{passive:false});
  document.addEventListener('touchend',function(e){
    if(e.touches.length<2)sd=0; if(e.touches.length===0)ps=null;
    if(scale<1.05){scale=1;tx=0;ty=0;ap();}
    var n=Date.now(); if(n-lt<300&&e.changedTouches.length===1&&e.touches.length===0){scale=1;tx=0;ty=0;ap();} lt=n;
  },{passive:false});
})();<\/script>`
// 모바일 폭 정규화 — 원본 교재 CSS의 고정폭(table min-width)·grid 오용을 덮어써 가로 오버플로·글자 세로쪼개짐 방지
const READER_FIX_CSS = `
html,body{max-width:100%;overflow-x:hidden}
*{max-width:100%}
table{min-width:0!important;width:100%!important;table-layout:fixed!important}
table td,table th{word-break:break-word!important;white-space:normal!important;overflow-wrap:anywhere}
img,pre,code,video,iframe{max-width:100%!important}
pre{white-space:pre-wrap!important;word-break:break-word}
/* .section-heading이 grid(아이콘칸 38px + 본문)라, 아이콘 span 없이 텍스트만 있는 삽입 블록(영어 등)은
   텍스트가 좁은 첫 칼럼에 갇혀 한 글자씩 줄바꿈됨 → block로 정상화 */
.section-heading{display:block!important;grid-template-columns:none!important}
.section-heading>span{display:inline-flex!important;vertical-align:middle;margin-right:8px}
`
function buildReaderDoc(css, inner) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="${READER_VP}"><style>${css}\n${READER_FIX_CSS}\nbody{margin:0}.container{padding:14px 14px 30px}</style></head><body style="background:#eef1f6">${inner}${PINCH_JS}</body></html>`
}

// ── 전체화면 리더 스타일 ──
const readerOverlay = { position: 'fixed', inset: 0, zIndex: 1300, background: '#eef1f6', display: 'flex', flexDirection: 'column' }
const readerTop = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: 'calc(3px + env(safe-area-inset-top, 0px)) 8px 3px',
  background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
}
const readerTitle = { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const pageInd = { fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }
const iconBtn = {
  width: 30, height: 30, borderRadius: 8, flexShrink: 0, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}
const tocBtn = { fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 16, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }
const tocPanel = { background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '10px 12px 12px', maxHeight: '55%', overflowY: 'auto', flexShrink: 0 }
const chipStyle = { fontSize: 12.5, fontWeight: 700, padding: '6px 11px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }
const chipActive = { border: '1px solid var(--primary)', background: 'var(--primary)', color: '#fff' }
const readerBottom = {
  display: 'flex', gap: 8, alignItems: 'center',
  padding: '4px 10px calc(4px + env(safe-area-inset-bottom, 0px))',
  background: 'var(--card)', borderTop: '1px solid var(--border)', flexShrink: 0,
}
const navPrimary = { flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }

// ── 인라인 확인문제 카드 (티키타카: 읽고 → 바로 풀고 → 즉시 해설) ──
// 티키타카 모드별 안내(단조로움 방지 — 블록마다 다른 방식으로 확인)
const IC_MODES = {
  quiz:  { tag: '✓ 방금 읽은 내용, 바로 확인해요', bg: '#EDE9FE', fg: '#7C3AED' },
  flash: { tag: '🧠 개념 플래시 — 먼저 스스로 떠올려 보세요', bg: '#FEF3C7', fg: '#B45309' },
  speed: { tag: '⚡ 순간 판단! 빠르게 골라보세요', bg: '#DBEAFE', fg: '#1D4ED8' },
}

function InlineCheck({ q, mode = 'quiz', subjectId, courseId, unitId, onDone, onSkip }) {
  const [pick, setPick] = useState(null)   // 고른 보기 index (-1=시간초과)
  const [revealed, setRevealed] = useState(mode !== 'flash')  // flash: 먼저 떠올린 뒤 보기 공개
  const [timeLeft, setTimeLeft] = useState(mode === 'speed' ? 12 : null)
  const correctIdx = (q.answer || 'A').charCodeAt(0) - 65
  const answered = pick !== null
  const m = IC_MODES[mode] || IC_MODES.quiz

  function choose(idx) {
    if (answered) return
    setPick(idx)
    const correct = idx === correctIdx
    if (correct) {
      const bonus = (mode === 'speed' && (timeLeft ?? 0) > 6) ? 4 : 0
      addXp(6 + bonus, 'inline_check')
    } else {
      saveWrongAnswer(q, courseId, idx >= 0 ? String.fromCharCode(65 + idx) : '무응답')
    }
    recordAnswer(subjectId, q.lessonId || unitId, correct)
    recordQuestion(subjectId, q.id, correct)
  }

  // 순간판단 모드 카운트다운
  useEffect(() => {
    if (mode !== 'speed' || answered || !revealed) return
    if (timeLeft <= 0) { choose(-1); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, mode, answered, revealed])

  const correct = pick === correctIdx

  // 개념 플래시: 보기 공개 전 '먼저 떠올리기' 단계
  if (mode === 'flash' && !revealed) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', background: '#eef1f6' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ ...icTag, background: m.bg, color: m.fg }}>{m.tag}</div>
          {q.context && <div style={icContext}>{q.context}</div>}
          <p style={icStem}>{q.stem}</p>
          <div style={{ background: '#FFFBEB', border: '1px dashed #F59E0B', borderRadius: 12, padding: '16px', marginTop: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#92400E', fontWeight: 700 }}>정답을 머릿속에 먼저 떠올려 보세요 🤔</p>
            <p style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>스스로 떠올린 뒤 확인하면 훨씬 오래 기억돼요</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onSkip} style={icSkip}>건너뛰기</button>
            <button onClick={() => setRevealed(true)} style={icContinue}>떠올렸어요! 보기 확인 →</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', background: '#eef1f6' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ ...icTag, background: m.bg, color: m.fg, marginBottom: 0 }}>{m.tag}</div>
          {mode === 'speed' && !answered && (
            <span style={{ fontSize: 13, fontWeight: 900, color: timeLeft <= 4 ? '#DC2626' : '#1D4ED8' }}>⏱ {timeLeft}s</span>
          )}
        </div>
        {q.context && <div style={icContext}>{q.context}</div>}
        <p style={icStem}>{q.stem}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {q.choices.map((c, idx) => {
            let st = { ...icChoice }
            if (answered) {
              if (idx === correctIdx) st = { ...st, ...icRight }
              else if (idx === pick) st = { ...st, ...icWrong }
              else st = { ...st, opacity: 0.6 }
            }
            return (
              <button key={idx} onClick={() => choose(idx)} disabled={answered} style={st}>
                <span style={icLetter}>{idx + 1}</span>
                <span style={{ flex: 1 }}>{c}</span>
                {answered && idx === correctIdx && <span>✓</span>}
                {answered && idx === pick && idx !== correctIdx && <span>✗</span>}
              </button>
            )
          })}
        </div>

        {answered && (
          <div style={{ ...icFeedback, background: correct ? '#ECFDF5' : '#FEF2F2', borderColor: correct ? '#10B981' : '#EF4444' }}>
            <p style={{ fontWeight: 800, color: correct ? '#047857' : '#B91C1C', marginBottom: 6 }}>
              {correct
                ? (mode === 'speed' && (timeLeft ?? 0) > 6 ? '⚡ 빠르고 정확! (+10 XP)' : '정답이에요! (+6 XP)')
                : (pick === -1 ? `시간 초과 — 정답은 ${String.fromCharCode(65 + correctIdx)}번`
                              : `아쉬워요 — 정답은 ${String.fromCharCode(65 + correctIdx)}번`)}
            </p>
            {q.explanation && <CompactText text={q.explanation} maxItemChars={72} style={{ fontSize: 13.5, color: '#374151' }} />}
            {!correct && <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>🔖 오답노트에 담았어요 — 나중에 다시 풀 수 있어요</p>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!answered
            ? <button onClick={onSkip} style={icSkip}>건너뛰기</button>
            : <button onClick={onDone} style={icContinue}>계속 학습 →</button>}
        </div>
      </div>
    </div>
  )
}

const icTag = { display: 'inline-block', fontSize: 12.5, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '4px 10px', borderRadius: 14, marginBottom: 10 }
const icContext = { fontSize: 13, color: '#374151', background: '#fff', border: '1px solid #e3e7f3', borderRadius: 10, padding: '10px 12px', marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }
const icStem = { fontSize: 15.5, fontWeight: 700, color: '#1f2933', lineHeight: 1.6 }
const icChoice = { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7dcec', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#1f2933' }
const icLetter = { width: 22, height: 22, flexShrink: 0, borderRadius: 11, background: '#eef1f6', color: '#5c6bc0', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const icRight = { border: '2px solid #10B981', background: '#ECFDF5' }
const icWrong = { border: '2px solid #EF4444', background: '#FEF2F2' }
const icFeedback = { marginTop: 14, border: '1px solid', borderRadius: 12, padding: '12px 14px' }
const icSkip = { flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }
const icContinue = { flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
