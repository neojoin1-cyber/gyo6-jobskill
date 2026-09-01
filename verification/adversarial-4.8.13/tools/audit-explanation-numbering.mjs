// 해설의 보기 번호 정합 — 코워크 CNT-114(399건) 주장을 내 방식으로 독립 재검증한다.
//
// 남의 결과를 옮겨 적지 않는다. 판정 규칙을 따로 세우고, 건수와 대상 id 를 직접 센다.
//
//  E1 범위 밖 번호      보기가 4개인데 해설이 ⑤·5번·E 를 말한다
//  E2 정답 표시 불일치   해설이 정답이라고 표시한 번호가 저장된 정답과 다르다
//  E3 정답을 오답으로    오답 분석 문장이 정답 번호를 가리킨다(학생이 자기 정답을 오답으로 읽는다)
//
// 실행: npx esbuild verification/adversarial-4.8.13/tools/audit-explanation-numbering.mjs \
//         --bundle --platform=node --format=esm --loader:.json=json \
//         --outfile=.cache/audit-expl-num.mjs && node .cache/audit-expl-num.mjs

import { writeFileSync, mkdirSync } from 'node:fs'

import { jcStudyQuestions, englishStudyQuestions, jcOfficialArea } from '../../../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../../../src/lib/ncs2026.js'
import { RECRUIT_WRITTEN_TRACKS, recruitWrittenQuestions, getRecruitTrackQuestions } from '../../../src/lib/recruitWritten.js'
import { COVER_DIAGNOSTIC_QUESTIONS } from '../../../src/lib/coverAssessmentBank.js'
import interviewQuiz from '../../../data/interview-quiz.json'
import { withExtractedChoices, isOXQuestion, answerIdxOf, isMultiQuestion } from '../../../src/lib/questionNorm.js'

const t = v => (typeof v === 'string' ? v : v == null ? '' : String(v))
const CIRCLED = '①②③④⑤'

function displayChoices(q) {
  if (isOXQuestion(q)) return ['O', 'X']
  const raw = q.choices || q.options || []
  if (!raw.length) return []
  if (typeof raw[0] === 'object') return raw.map(c => t(c.text ?? c.label ?? c.value))
  return raw.map(t)
}

// 해설 안에서 "보기 N" 을 가리키는 모든 표기를 위치와 함께 뽑는다.
function markers(expl) {
  const out = []
  const re = /([①-⑤])|(?:^|[\s(,.·])([1-5])\s*번|(?:^|[\s(,.·])([A-E])[.)]\s|보기\s*([1-5A-E])/g
  let m
  while ((m = re.exec(expl))) {
    const raw = m[1] || m[2] || m[3] || m[4]
    let idx = -1
    if (m[1]) idx = CIRCLED.indexOf(m[1])
    else if (/^[1-5]$/.test(raw)) idx = Number(raw) - 1
    else if (/^[A-E]$/.test(raw)) idx = raw.charCodeAt(0) - 65
    if (idx >= 0) out.push({ raw, idx, at: m.index })
  }
  return out
}

// 판정은 '그 번호를 말하는 구절' 안에서만 한다. 뒤 문장을 끌어오면
// "정답은 1번입니다. 2번은 …" 같은 정상 해설이 통째로 오탐이 된다(실제로 걸렸다).
const WRONG_NEAR = /(오답|틀린|틀렸|틀립|아니(다|라|며|고)|적절하지\s*않|옳지\s*않|맞지\s*않|해당하지\s*않|잘못|부적절|거리가\s*멀|오해|착각)/
// '입니다' 같은 서술 종결은 옳음의 표시가 아니다. 이걸 넣었더니 설명문 대부분이 걸렸다.
// '정답이 있는 선택형', '정답이 없는 검사' 처럼 명사구로 쓰인 '정답'은 옳음 주장이 아니다.
const CORRECT_NEAR = /(정답(입니다|이다|이며|은|:)|맞다|맞습니다|맞는\s|옳다|옳습니다|적절하다|적절합니다|가장\s*적절|올바르다|올바릅니다)/
const CORRECT_FALSE_FRIEND = /정답이\s*(있는|없는|아닌)/
// 부정형 발문은 '틀린 것'이 정답이다. 여기서 E3(정답을 오답이라 함)을 적용하면 전부 오탐이다.
const NEGATIVE_STEM = /(옳지\s*않은|적절하지\s*않은|알맞지\s*않은|아닌\s*것|틀린\s*것|틀린\s*설명|거리가\s*먼|해당하지\s*않는|바르지\s*않은|부적절한|부적절하게|잘못된|잘못\s*설명|바르지\s*못한|올바르지\s*않은)/

const rows = []
const push = (q, subject, group) => rows.push({ q: withExtractedChoices(q), subject, group })

for (const q of [...jcStudyQuestions(), ...englishStudyQuestions]) {
  if (!q.excludeFromQuiz) push(q, 'job-common', jcOfficialArea(q) || t(q.area))
}
for (const q of ncs2026Questions) if (!q.excludeFromQuiz) push(q, 'ncs-basic', t(q.ncsAbility))
for (const track of RECRUIT_WRITTEN_TRACKS) {
  for (const q of getRecruitTrackQuestions(track.id, recruitWrittenQuestions)) {
    if (!q.excludeFromQuiz) push(q, 'recruit-written', track.label)
  }
}
for (const q of COVER_DIAGNOSTIC_QUESTIONS) push(q, 'cover-letter', t(q.area))
for (const q of interviewQuiz.questions || []) push(q, 'interview', t(q.category))

const seen = new Set()
const targets = rows.filter(r => r.q?.id && !seen.has(r.q.id) && seen.add(r.q.id))

const findings = []
let 검사대상 = 0

for (const r of targets) {
  const q = r.q
  const expl = t(q.explanation)
  const choices = displayChoices(q)
  // OX 문항의 해설에 나오는 번호는 보기(O/X)가 아니라 지문 항목을 가리킨다. 대상에서 뺀다.
  if (!expl || choices.length < 2 || isMultiQuestion(q) || isOXQuestion(q)) continue
  const ans = answerIdxOf(q)
  if (ans < 0) continue
  const ms = markers(expl)
  if (!ms.length) continue
  검사대상++

  const hit = (code, detail) => findings.push({
    code, questionId: q.id, subject: r.subject, group: r.group,
    answerNo: ans + 1, choiceCount: choices.length, ...detail,
  })

  // E1 — 보기 수를 넘는 번호를 말한다
  const 척도설명 = /[①-⑤]\s*(전혀|매우|보통|그렇|아니)/.test(expl) || /점\s*척도/.test(expl)
  const over = 척도설명 ? [] : ms.filter(m => m.idx >= choices.length)
  if (over.length) {
    hit('E1-범위밖번호', {
      인용번호: [...new Set(over.map(m => m.raw))],
      해설조각: expl.slice(Math.max(0, over[0].at - 40), over[0].at + 60),
    })
  }

  // 각 표기가 지배하는 구절만 본다: 그 표기부터 다음 표기 직전까지, 문장 끝을 넘지 않게.
  const negativeStem = NEGATIVE_STEM.test(t(q.stem ?? q.heading ?? ''))
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i]
    if (m.idx >= choices.length) continue
    const nextAt = i + 1 < ms.length ? ms[i + 1].at : expl.length
    let clause = expl.slice(m.at, Math.min(nextAt, m.at + 120))
    const stop = clause.search(/[.。!?\n]/)
    if (stop >= 3) clause = clause.slice(0, stop + 1)   // 표기 직후 문장부호에서 끊는다

    const isWrongClaim = WRONG_NEAR.test(clause)
    const isCorrectClaim = !isWrongClaim && CORRECT_NEAR.test(clause) && !CORRECT_FALSE_FRIEND.test(clause)

    // 부정형 발문("옳지 않은 것은?")에서는 옳고 그름이 뒤집힌다.
    //   정답 = 틀린 설명 → 해설이 정답을 '틀리다'고 말하는 것이 정상
    //   해설이 정답을 '맞다'고 말하면 그것이 어긋난 것이다
    if (negativeStem) {
      if (isCorrectClaim && m.idx === ans) {
        hit('E2-정답표시불일치', { 해설이정답이라한번호: m.idx + 1, 부정형발문: true, 해설조각: clause.slice(0, 90) })
        break
      }
      continue
    }

    // E2 — 정답이라고 말한 번호가 저장 정답과 다르다
    if (isCorrectClaim && m.idx !== ans) {
      hit('E2-정답표시불일치', { 해설이정답이라한번호: m.idx + 1, 해설조각: clause.slice(0, 90) })
      break
    }
    // E3 — 정답 번호를 오답이라고 말한다
    if (isWrongClaim && m.idx === ans) {
      hit('E3-정답을오답으로', { 해설조각: clause.slice(0, 90) })
      break
    }
  }
}

const byCode = {}
const bySubject = {}
for (const f of findings) {
  byCode[f.code] = (byCode[f.code] || 0) + 1
  bySubject[f.subject] = (bySubject[f.subject] || 0) + 1
}
const ids = [...new Set(findings.map(f => f.questionId))]

mkdirSync('verification/adversarial-4.8.13/evidence/cnt', { recursive: true })
writeFileSync('verification/adversarial-4.8.13/evidence/cnt/explanation-numbering.json',
  JSON.stringify({
    _meta: {
      baseline: '9797477fe73a (4.8.14 / b7c1b26)',
      목적: '코워크 CNT-114 주장의 독립 재검증. 판정 규칙을 따로 세워 직접 셌다',
      규칙: { E1: '보기 수를 넘는 번호 인용', E2: '해설이 정답이라 한 번호 ≠ 저장 정답', E3: '오답 분석이 정답 번호를 가리킴' },
      전체문항: targets.length, 번호를인용한문항: 검사대상,
    },
    summary: { byCode, bySubject, 고유문항수: ids.length },
    findings,
  }, null, 1) + '\n')

console.log('전체 문항', targets.length, '· 해설이 보기 번호를 인용한 문항', 검사대상)
console.log('지적 건수', findings.length, '· 고유 문항', ids.length)
console.log('코드별:', JSON.stringify(byCode))
console.log('과목별:', JSON.stringify(bySubject))
for (const f of findings.slice(0, 5)) console.log('  예:', f.code, f.questionId, JSON.stringify(f).slice(0, 200))
