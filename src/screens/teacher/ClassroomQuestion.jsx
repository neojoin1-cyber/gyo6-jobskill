/**
 * 수업 모드의 문항 투사 — 학생 앱이 다루는 **모든 유형**을 그대로 띄운다.
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────────
 * 수업 모드는 `choices.length >= 2` 인 문항만 걸러 단순 목록으로 그렸다.
 * 그래서 학생 앱에는 있는데 교실에는 못 띄우는 것들이 있었다.
 *
 *   듣기 51건    화면엔 떴지만 **소리가 안 났다** — 의사소통영어 「직무 대화
 *                듣기」 차시를 교사가 틀어 줄 수 없었다
 *   매칭 16건    선택지가 없어 아예 제외
 *   풀다운 8건   〃
 *   서술형 44건  〃
 *
 * 다시 만들지 않는다. **학생 화면이 쓰는 바로 그 부품**을 가져다 쓴다.
 * 두 벌이 되면 한쪽만 고치는 날이 오고, 그때 교사가 칠판에 띄운 것과
 * 학생 화면이 달라진다.
 *
 * ── 교실에서만 다른 것 두 가지 ────────────────────────────────────
 * ① 듣기는 몇 번이든 다시 튼다. 실제 평가는 한 번뿐이지만 수업은 배우는
 *    자리다(`unlimited`).
 * ② 학생 부품은 「푸는」 물건이라 입력을 받는다. 교실에서는 교사가 넘기며
 *    보여 줄 뿐이므로 **읽기 전용**으로 세운다(onChange 를 주지 않는다).
 *
 * 답을 가리는 규칙은 문항이든 덱이든 같다 — 기본 가림, Space 로 열기,
 * 넘기면 다시 닫힘.
 */
import { useRef } from 'react'
import useAutoFit from '../../lib/useAutoFit.js'
import ListeningPrompt from '../student/ListeningPrompt.jsx'
import MatchingBoard from '../student/MatchingBoard.jsx'
import PulldownForm from '../student/PulldownForm.jsx'
import QuestionMedia from '../student/QuestionMedia.jsx'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function letterToIndex(a) {
  if (typeof a === 'number') return a
  const s = String(a ?? '').trim().toUpperCase()
  const i = LETTERS.indexOf(s)
  if (i >= 0) return i
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n - 1 : -1
}

/**
 * 정답이 가리키는 선택지 번호들.
 *
 * 세 가지 형태가 섞여 있다.
 *   'B'        하나
 *   'B,C' · ['B','C']   여럿 (멀티체크형)
 *   'O' · 'X'  O/X 문항 — A~E 가 아니라 **선택지 글의 첫 글자**로 맞춘다
 *              (선택지가 'O (맞다)' 처럼 설명을 달고 있다)
 */
function answerIndices(ans, choices = []) {
  const parts = Array.isArray(ans) ? ans : String(ans ?? '').split(/[,\s]+/)
  const out = []
  for (const raw of parts) {
    const t = String(raw ?? '').trim().toUpperCase()
    if (!t) continue
    const i = letterToIndex(t)
    if (i >= 0 && i < choices.length) { out.push(i); continue }
    // O/X 처럼 글자로 적힌 정답은 선택지에서 찾는다.
    const j = choices.findIndex(c => String(c).trim().toUpperCase().startsWith(t))
    if (j >= 0) out.push(j)
  }
  return out
}

/**
 * 이 문항을 교실에 띄울 수 있는가.
 *
 * 예전에는 `choices >= 2` 하나로 판단했다. 그러면 선택지가 없는 유형
 * (매칭·풀다운·서술형)이 통째로 빠진다. 유형별로 본다.
 */
export function isProjectable(q) {
  if (!q) return false
  const t = q.type
  if (t === 'matching')  return Array.isArray(q.pairs) && q.pairs.length > 0
  if (t === 'pulldown')  return Array.isArray(q.blanks) && q.blanks.length > 0
  if (t === 'text')      return !!q.answer          // 모범답안이 있으면 띄운다
  return (q.choices || []).length >= 2
}

/**
 * @param hideContext 지문을 투사 화면에서 접는다.
 *
 * 지문이 길면 자동 맞춤이 글자를 줄일 수밖에 없어 발문이 19px 까지
 * 내려간다. 교실 뒷자리에서는 못 읽는다. 그런데 **학생은 같은 지문을
 * 자기 기기에서 볼 수 있다.** 그래서 투사 화면에서는 접고, 발문과 선택지에
 * 화면을 다 준다. 어디를 읽어야 하는지는 위의 주소줄이 알려 준다.
 */
export default function ClassroomQuestion({ q, reveal, hideContext = false }) {
  // 덱과 같은 자동 맞춤. 문항마다 지문 길이가 크게 다른데 글자를 고정하면
  // 짧은 문항은 화면의 절반이 비고 교실 뒤에서 안 읽힌다.
  const stage = useRef(null)
  useAutoFit(stage, `${q?.id}:${reveal}:${hideContext}`)
  if (!q) return null
  const t = q.type
  const stem = q.stem || q.question
  const context = q.context || q.passage

  // 듣기 문항은 지문을 글로 보여 주면 듣기가 아니게 된다. 대본은 답과
  // 함께 열린다.
  const isListening = !!q.audioText

  return (
    <div ref={stage} className="quiz-stage" data-kind={t || 'mcq'}>
      <div className="classroom-main">
        {isListening && (
          <ListeningPrompt q={q} unlimited revealTranscript={reveal} />
        )}
        {context && !isListening && (
          hideContext
            ? <p className="classroom-context-folded">
                📄 지문은 각자 기기에서 읽으세요
              </p>
            : <div className="classroom-context">{context}</div>
        )}
        <QuestionMedia q={q} />
        <h2 className="classroom-stem">{stem}</h2>
      </div>

      <div className="classroom-side">
        {t === 'matching' ? (
          <div className="classroom-embed">
            {/* onChange 를 주지 않아 읽기 전용이 된다. checked 를 켜면
                학생 화면과 똑같은 방식으로 정답 짝이 드러난다. */}
            <MatchingBoard q={q} checked={reveal} value={null} />
          </div>
        ) : t === 'pulldown' ? (
          <div className="classroom-embed">
            <PulldownForm q={q} checked={reveal} value={null} />
          </div>
        ) : t === 'text' ? (
          reveal ? (
            <div className="classroom-model-answer">
              <b>모범답안</b>
              <p>{String(q.answer)}</p>
              {q.keyTerms?.length > 0 && (
                <p className="classroom-keyterms">
                  꼭 들어가야 할 말 — {q.keyTerms.join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="deck-hidden">
              서술형입니다. 학생이 답한 뒤 열어 주세요<br /><kbd>Space</kbd>
            </p>
          )
        ) : (
          <ol className="classroom-choices">
            {(q.choices || []).map((c, i) => (
              <li key={i} className={reveal && answerIndices(q.answer, q.choices).includes(i) ? 'is-answer' : ''}>
                <span className="classroom-num">{i + 1}</span>
                <span>{String(c)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
