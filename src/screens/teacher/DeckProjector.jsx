/**
 * 수업 덱 투사 — 차시별 수업 자료를 앱 안에서 띄운다.
 *
 * ── 왜 앱 안으로 들여왔나 ─────────────────────────────────────────
 * 덱 531편은 teacher.gyo6.kr 에 있고, 지금까지는 링크로 새 창을 열었다.
 * 그러면 **수업의 본체를 띄우는 순간 앱을 벗어난다.** 애써 만든 가로 투사,
 * 무작위 지목, 생각 시간, 우리 반 현황이 전부 사라지고 교사는 브라우저
 * 두 개를 오간다.
 *
 * iframe 으로 끌어오는 방법도 봤는데 그 사이트는 로그인을 요구한다
 * (302 → /login). 앱 안에서 또 로그인해야 하고, 서드파티 쿠키라 대개
 * 막힌다. 그래서 **HTML 을 가져오는 대신 원본 데이터를 가져왔다.**
 *
 *   HTML 531편 63MB  →  원본 JSON 6과목 5.6MB
 *
 * 덱을 다시 만든 것이 아니다. 파이프라인이 HTML 을 만들 때 쓰는 바로 그
 * `lessons.json` 을 같이 쓴다. 자료가 갱신되면 이쪽도 같이 갱신된다.
 *
 * ── 조각(beat) ────────────────────────────────────────────────────
 * 한 차시는 조각들의 줄이다. 15종이 있고 상위 8종이 96%를 차지한다.
 * 대부분 `html` 을 들고 있어 그대로 그린다. 이 HTML 은 학생이 쓴 것이
 * 아니라 우리 파이프라인이 만든 자료다.
 *
 * ── 답은 가린다 ───────────────────────────────────────────────────
 * `ask` 와 `quiz` 는 답을 들고 있다. 띄우자마자 보이면 학생이 생각할 틈이
 * 없다. 문항 투사와 같은 규칙 — 기본은 가림, Space 로 열고, 넘기면 다시 닫힘.
 */
import { useEffect, useRef, useState } from 'react'
import useAutoFit from '../../lib/useAutoFit.js'
import { compactInstructionHtml, compactText } from '../../lib/compactCopy.js'

function useSwipe(ref, onPrev, onNext) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let startX = null
    let startY = null

    const down = event => {
      startX = event.clientX
      startY = event.clientY
    }
    const up = event => {
      if (startX == null || startY == null) return
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      startX = null
      startY = null
      if (Math.abs(dx) < 64 || Math.abs(dx) <= Math.abs(dy)) return
      if (dx < 0) onNext()
      else onPrev()
    }

    element.addEventListener('pointerdown', down)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', up)
    }
  }, [ref, onPrev, onNext])
}

/** 과목별 자료는 무겁다(최대 1.9MB). 열 때 받고, 그 뒤로는 캐시가 맡는다. */
// 식음료서비스·품질경영은 2026-08-20 앱에서 제외된 과목이다
// (subjectCatalog.js 의 RETIRED_SUBJECT_IDS). 덱도 넣지 않는다.
const LOADERS = {
  'job-common':   () => import('../../../data/decks/job-common.json'),
  'interview':    () => import('../../../data/decks/interview.json'),
  'ncs-sense':    () => import('../../../data/decks/ncs-sense.json'),
  'personality':  () => import('../../../data/decks/personality.json'),
}

export function loadDeckSubject(id) {
  const fn = LOADERS[id]
  if (!fn) return Promise.resolve(null)
  return fn().then(m => m.default ?? m)
}

const html = (s) => ({ __html: String(s ?? '') })
const compactHtml = (s) => ({ __html: compactInstructionHtml(s) })

/** 답을 들고 있는 조각. 넘길 때마다 다시 가려야 한다. */
const HAS_ANSWER = new Set(['ask', 'quiz'])

/**
 * 조각 하나.
 *
 * `reveal` 은 답을 열지 여부다. 답이 없는 조각은 이 값을 무시한다.
 */
function Beat({ b, reveal }) {
  switch (b._t) {
    case 'title':
      return (
        <div className="deck-title">
          <p className="deck-unit">{b.unit}{b.code ? ` · ${b.code}` : ''}</p>
          <h2>{b.ctitle}</h2>
          {b.cno && b.ctotal && <p className="deck-step">{b.cno} / {b.ctotal}차시</p>}
          {b.goals?.length > 0 && (
            <ul className="deck-goals">{b.goals.map((g, i) => <li key={i}>{compactText(g, { maxItemChars: 96 })}</li>)}</ul>
          )}
        </div>
      )

    case 'quote':
      return (
        <div className="deck-quote">
          <blockquote>{b.quote}</blockquote>
          {b.src && <cite>— {b.src}</cite>}
          {b.link && <p className="deck-link">{b.link}</p>}
        </div>
      )

    case 'objectives':
      return (
        <div className="deck-block">
          <h3>학습 목표</h3>
          <ul className="deck-goals">
            {(b.objectives ?? []).map((o, i) => <li key={i}>{compactText(o, { maxItemChars: 96 })}</li>)}
          </ul>
          {b.why && <div className="deck-why" dangerouslySetInnerHTML={compactHtml(b.why)} />}
        </div>
      )

    case 'overview':
    case 'teach':
    case 'summary':
    case 'analysis':
      return (
        <div className="deck-block">
          {b.h && <h3>{b.h}</h3>}
          <div dangerouslySetInnerHTML={compactHtml(b.html)} />
        </div>
      )

    // 발문 — 교사가 묻고 학생이 답하는 자리. 답은 눌러야 나온다.
    case 'ask':
      return (
        <div className="deck-ask">
          <div className="deck-q">
            <span className="deck-tag">발문</span>
            <h3 className="deck-ask-q">{b.ask}</h3>
            {b.thinkText && <p className="deck-think">{b.thinkText}</p>}
          </div>
          <div className="deck-a">
            {reveal ? (
              <>
                {b.answerHtml && (
                  <div className="deck-answer">
                    <b>답</b><div dangerouslySetInnerHTML={compactHtml(b.answerHtml)} />
                  </div>
                )}
                {b.trapHtml && (
                  <div className="deck-trap">
                    <b>함정</b><div dangerouslySetInnerHTML={compactHtml(b.trapHtml)} />
                  </div>
                )}
              </>
            ) : (
              <p className="deck-hidden">답은 가려져 있습니다<br /><kbd>Space</kbd></p>
            )}
          </div>
        </div>
      )

    // 판서 — 줄바꿈이 그대로 의미다.
    case 'board':
      return <div className="deck-board" dangerouslySetInnerHTML={html(
        String(b.board ?? '').split('\n').join('<br>'))} />

    case 'examtip':
      return (
        <div className="deck-block deck-tip">
          <h3>시험에 이렇게 나온다</h3>
          <div dangerouslySetInnerHTML={compactHtml(b.html)} />
          {b.example && (
            <div className="deck-example">
              <p className="deck-example-stem">{b.example.stem}</p>
              <ol>{(b.example.options ?? []).map((o, i) => <li key={i}>{o}</li>)}</ol>
            </div>
          )}
        </div>
      )

    case 'scenario':
      return (
        <div className="deck-block">
          <h3>{b.label ?? '현장 시나리오'}</h3>
          {b.docTitle && <p className="deck-doc-title">{b.docTitle}</p>}
          <div className="deck-doc" dangerouslySetInnerHTML={html(b.docHtml)} />
        </div>
      )

    case 'memorize':
      return (
        <div className="deck-memo">
          {b.keyline && <p className="deck-keyline">{b.keyline}</p>}
          <ul>{(b.memo ?? []).map((m, i) => <li key={i}>{compactText(m, { maxItemChars: 96 })}</li>)}</ul>
        </div>
      )

    // 확인 문항 — 문항 투사와 같은 규칙으로 정답을 가린다.
    case 'quiz':
      return (
        <div className="deck-quiz">
          <div className="deck-q">
            <span className="deck-tag">확인 문항</span>
            <h3 className="deck-ask-q">{b.stem}</h3>
            {b.quizDocHtml && <div className="deck-doc" dangerouslySetInnerHTML={html(b.quizDocHtml)} />}
          </div>
          <div className="deck-a">
            <ol className="classroom-choices">
              {(b.options ?? []).map((o, i) => (
                <li key={i} className={reveal && i === b.answerIndex ? 'is-answer' : ''}>
                  <span className="classroom-num">{i + 1}</span><span>{o}</span>
                </li>
              ))}
            </ol>
            {reveal && b.explHtml && (
              <div className="deck-answer"><b>해설</b>
                <div dangerouslySetInnerHTML={compactHtml(b.explHtml)} /></div>
            )}
            {reveal && b.tipHtml && (
              <div className="deck-trap"><b>짚을 것</b>
                <div dangerouslySetInnerHTML={compactHtml(b.tipHtml)} /></div>
            )}
            {!reveal && <p className="deck-hidden">정답은 가려져 있습니다<br /><kbd>Space</kbd></p>}
          </div>
        </div>
      )

    case 'oxset':
      return (
        <div className="deck-block">
          <h3>{b.h ?? 'OX 확인'}</h3>
          <div dangerouslySetInnerHTML={html(b.qHtml)} />
          {reveal
            ? <div className="deck-answer" dangerouslySetInnerHTML={compactHtml(b.aHtml)} />
            : <p className="deck-hidden">답은 가려져 있습니다 · Space</p>}
        </div>
      )

    case 'preview':
      return (
        <div className="deck-block">
          <h3>다음 시간 · {b.h}</h3>
          <ul className="deck-goals">{(b.previewList ?? []).map((p, i) => <li key={i}>{compactText(p, { maxItemChars: 96 })}</li>)}</ul>
          {b.homework && <p className="deck-why"><b>과제</b> — {b.homework}</p>}
        </div>
      )

    default:
      // 새 조각이 생겨도 화면이 비지 않게 한다.
      return b.html
        ? <div className="deck-block" dangerouslySetInnerHTML={compactHtml(b.html)} />
        : null
  }
}

/**
 * 한 차시를 조각 단위로 넘겨 가며 띄운다.
 *
 * 넘기는 조작은 문항 투사와 똑같다 — 교사가 두 가지를 외울 이유가 없다.
 */
export default function DeckProjector({ chapter, index, reveal, onCount, onPrev, onNext }) {
  const beats = chapter?.beats ?? []
  const stage = useRef(null)
  useEffect(() => { onCount?.(beats.length) }, [beats.length])
  const b = beats[index]
  // 답을 열면 내용이 늘어난다. 그때도 다시 맞춰야 한다.
  useAutoFit(stage, `${index}:${reveal}`)
  useSwipe(stage, onPrev ?? (() => {}), onNext ?? (() => {}))
  if (!b) return <p className="classroom-empty">이 차시에는 띄울 자료가 없습니다.</p>

  // 조각 종류를 CSS 에 알려 준다. 표지·인용·암기는 화면 한가운데 크게,
  // 설명은 읽기 좋은 폭으로, 발문·문항은 좌우로 나눠 배치한다.
  // 종류마다 배치가 달라야 「옆으로 늘린 세로 화면」이 아니게 된다.
  //
  // key 를 장 번호로 주면 장이 바뀔 때 React 가 새 노드를 만든다.
  // 그래야 들어오는 애니메이션이 매번 다시 돈다.
  return (
    <div ref={stage} key={index} className="deck-stage" data-kind={b._t}>
      <Beat b={b} reveal={reveal && HAS_ANSWER.has(b._t)} />
    </div>
  )
}

export { HAS_ANSWER }
