// CNT 블라인드 문항 세트 내보내기 (적대적 검증 4.8.13)
//
// 앱이 실제로 학생에게 내보내는 런타임 산출물에서만 뽑는다. 원본 JSON을 직접
// 읽으면 앱이 걸러내거나 보강한 문항과 어긋나 검증 근거가 되지 못한다.
// 정답 판정은 앱 값을 모르는 독립 검증자가 하므로, 이 파일은 answer·explanation
// 계열을 모두 지운 상태로 내보낸다. 앱 정답은 handoff 밖(private/)에 따로 둔다.
//
// 실행: npx esbuild verification/adversarial-4.8.13/tools/export-cnt-blind.mjs \
//         --bundle --platform=node --format=esm --loader:.json=json \
//         --outfile=.cache/export-cnt-blind.mjs && node .cache/export-cnt-blind.mjs

import { writeFileSync, mkdirSync } from 'node:fs'

import { jcStudyQuestions, jcOfficialArea, JC_OFFICIAL_SPECS, englishStudyQuestions } from '../../../src/lib/jobCommonAreas.js'
import { ncs2026Questions } from '../../../src/lib/ncs2026.js'
import { NCS_2026_AREAS } from '../../../src/lib/officialStandards.js'
import { RECRUIT_WRITTEN_TRACKS, recruitWrittenQuestions, getRecruitTrackQuestions } from '../../../src/lib/recruitWritten.js'
import { COVER_DIAGNOSTIC_QUESTIONS, COVER_ASSESSMENT_AREAS } from '../../../src/lib/coverAssessmentBank.js'
import { COVER_LETTER_QUESTION_LIBRARY } from '../../../src/lib/coverQuestionLibrary.js'
import foodServiceBank from '../../../src/lib/foodServiceBank.js'
import qualityPractice from '../../../data/quality-mgmt-practice.json'
import interviewQuiz from '../../../data/interview-quiz.json'
import { withExtractedChoices, isOXQuestion, answerIdxOf, isMultiQuestion, answerSetOf } from '../../../src/lib/questionNorm.js'

const BASELINE = {
  sourceCommit: process.env.CNT_BASELINE_COMMIT || '(BASELINE.md 참조)',
  builtFrom: '앱 런타임 모듈(src/lib/*) 산출물',
  generatedFor: '적대적 검증 4.8.13 · CNT 45건 중 정답 독립 판정',
}

const t = v => (typeof v === 'string' ? v : v == null ? '' : String(v))
const stemOf = q => t(q.stem ?? q.heading ?? q.question ?? q.prompt ?? '')

// 화면에 실제로 뜨는 보기. OX는 [O, X] 순서로 렌더된다(questionNorm 규약).
function displayChoices(q) {
  if (isOXQuestion(q)) return ['O', 'X']
  const raw = q.choices || q.options || []
  if (!raw.length) return []
  if (typeof raw[0] === 'object') return raw.map(c => t(c.text ?? c.label ?? c.value))
  return raw.map(t)
}

const NEGATIVE = /(옳지\s*않은|적절하지\s*않은|알맞지\s*않은|아닌\s*것|틀린\s*것|거리가\s*먼|해당하지\s*않는|바르지\s*않은)/
const SOURCED = /^(explicit|official|ncs_learning_module|textbook)/

// 고위험 = 오답 학습으로 직결될 확률이 높은 축. 이 축에 걸린 문항은 표본이 아니라 전수로 넘긴다.
// (해설이 선택지 번호를 인용하는 경우는 해설을 볼 수 있는 내가 기계 감사하므로 여기 넣지 않는다.)
function riskFlags(q, choices) {
  const flags = []
  const src = t(q.answerSource)
  if (/^authored/.test(src)) flags.push('authored_by_app')
  else if (/variant/.test(src)) flags.push('generated_variant')
  else if (!src) flags.push('answer_source_missing')
  else if (!SOURCED.test(src)) flags.push('answer_source_other')
  if (NEGATIVE.test(stemOf(q))) flags.push('negative_stem')
  if (q.needsManualReview) flags.push('needs_manual_review')
  if (choices.length && new Set(choices.map(c => c.trim())).size !== choices.length) flags.push('duplicate_choice_text')
  return flags
}

// 결정적 표본 (mulberry32)
function seeded(seed) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
}
const hashSeed = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function sample(list, n, key) {
  if (list.length <= n) return [...list]
  const rnd = seeded(hashSeed(key))
  return list.map((v, i) => ({ v, k: rnd(), i })).sort((a, b) => a.k - b.k || a.i - b.i).slice(0, n).map(x => x.v)
}

// ---- 수집 ---------------------------------------------------------------
const entries = []     // {q, subject, subjectLabel, group, groupLabel, assessmentType}
const push = (q, meta) => entries.push({ q, ...meta })

{
  const pool = [...jcStudyQuestions(), ...englishStudyQuestions].filter(q => !q.excludeFromQuiz)
  for (const q of pool) {
    const area = jcOfficialArea(q) || t(q.area) || '미분류'
    const spec = JC_OFFICIAL_SPECS[area]
    push(q, {
      subject: 'job-common', subjectLabel: '교육부 직업공통능력', group: area,
      groupLabel: spec ? area : `${area}(공식 5영역 밖)`,
      assessmentType: spec?.assessmentType || 'objective',
    })
  }
}
for (const q of ncs2026Questions) {
  if (q.excludeFromQuiz) continue
  push(q, {
    subject: 'ncs-basic', subjectLabel: 'NCS 직업기초 26v1',
    group: t(q.ncsAbility) || `${t(q.area)}/하위능력없음`, groupLabel: t(q.ncsAbility) || `${t(q.area)}/하위능력없음`,
    assessmentType: 'objective',
  })
}
for (const track of RECRUIT_WRITTEN_TRACKS) {
  for (const q of getRecruitTrackQuestions(track.id, recruitWrittenQuestions)) {
    if (q.excludeFromQuiz) continue
    push(q, { subject: 'recruit-written', subjectLabel: '채용필기 심화·확장', group: track.id, groupLabel: track.label, assessmentType: 'objective' })
  }
}
for (const q of COVER_DIAGNOSTIC_QUESTIONS) {
  const area = t(q.area) || '미분류'
  push(q, {
    subject: 'cover-letter', subjectLabel: '자기소개서', group: area,
    groupLabel: t(COVER_ASSESSMENT_AREAS?.[area]?.label ?? COVER_ASSESSMENT_AREAS?.[area]?.title ?? area),
    assessmentType: 'objective', takeAll: true,
  })
}
for (const q of interviewQuiz.questions || []) {
  push(q, {
    subject: 'interview', subjectLabel: '고졸 공정채용 면접',
    group: t(q.category) || '미분류', groupLabel: t(q.category) || '미분류',
    assessmentType: 'objective', takeAll: true,
  })
}

// ---- 정규화 --------------------------------------------------------------
const items = []      // 블라인드 후보
const answers = {}    // 앱 정답 (인계 금지)
const openItems = []   // 연결형·단답형 블라인드
const openAnswers = {} // 연결형·단답형 앱 정답 (인계 금지)
const unusable = []   // 보기 2개 미만 등 독립 판정이 불가능한 문항
const dupIds = []
const seen = new Set()

for (const e of entries) {
  const q = withExtractedChoices(e.q)
  const id = t(q.id)
  if (!id) { unusable.push({ id: '(id없음)', subject: e.subject, reason: 'no_id', stem: stemOf(q).slice(0, 60) }); continue }
  if (seen.has(id)) { dupIds.push({ id, subject: e.subject }); continue }
  const choices = displayChoices(q)
  if (choices.length < 2) {
    // 연결형(matching)·단답형(text)은 보기 배열이 없다. 선택지 대신 고유 형태로 블라인드 투영한다.
    const kind = t(q.type) || (Array.isArray(q.pairs) && q.pairs.length ? 'matching' : 'text')
    const h = (s) => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619) } return x >>> 0 }
    const lefts = Array.isArray(q.pairs) ? q.pairs.map(p => t(p.left)) : []
    const rights = Array.isArray(q.pairs) ? [...new Set(q.pairs.map(p => t(p.right)))].sort((a, b) => h(id + a) - h(id + b)) : []
    seen.add(id)
    openItems.push({
      questionId: id, subject: e.subject, subjectLabel: e.subjectLabel, group: e.groupLabel,
      lessonId: t(q.lessonId) || null, lessonTitle: t(q.lessonTitle) || null,
      questionMode: kind === 'matching' ? 'matching' : 'text',
      context: t(q.context) || null, stem: stemOf(q),
      leftItems: lefts.length ? lefts.map((text, i) => ({ no: i + 1, text })) : null,
      rightOptions: rights.length ? rights.map((text, i) => ({ tag: String.fromCharCode(65 + i), text })) : null,
      excludeFromQuiz: Boolean(q.excludeFromQuiz), needsManualReview: Boolean(q.needsManualReview),
      tier: 'A_고위험_전수',
    })
    openAnswers[id] = { subject: e.subject, group: e.group, questionMode: kind,
      answerRaw: q.answer ?? null, pairs: q.pairs ?? null, explanation: t(q.explanation) || null,
      answerSource: t(q.answerSource) || null }
    continue
  }
  seen.add(id)
  const multi = isMultiQuestion(q)
  const idx = multi ? -1 : answerIdxOf(q)
  const set = multi ? answerSetOf(q) : null
  items.push({
    _sort: `${e.subject}|${e.group}|${id}`,
    subject: e.subject, subjectLabel: e.subjectLabel, group: e.group, groupLabel: e.groupLabel,
    assessmentType: e.assessmentType, takeAll: Boolean(e.takeAll),
    risk: riskFlags(q, choices),
    blind: {
      questionId: id,
      subject: e.subject,
      subjectLabel: e.subjectLabel,
      group: e.groupLabel,
      lessonId: t(q.lessonId) || null,
      lessonTitle: t(q.lessonTitle) || null,
      questionMode: isOXQuestion(q) ? 'ox' : (multi ? 'multi' : 'mcq'),
      context: t(q.context) || null,
      stem: stemOf(q),
      choices: choices.map((text, i) => ({ no: i + 1, text })),
    },
  })
  answers[id] = {
    subject: e.subject, group: e.group,
    questionMode: isOXQuestion(q) ? 'ox' : (multi ? 'multi' : 'mcq'),
    answerRaw: q.answer ?? null,
    answerIndex: idx,
    answerNo: idx >= 0 ? idx + 1 : null,
    answerText: idx >= 0 ? choices[idx] ?? null : null,
    answerSet: set,
    answerSource: t(q.answerSource) || null,
    explanation: t(q.explanation) || null,
    examPriority: q.examPriority ?? null,
  }
}

// 기계 감사(audit-cnt-machine.mjs)가 짚은 문항은 표본 운에 맡기지 않고 반드시 넘긴다.
// 해설 번호와 정답이 어긋난 문항은 "정답이 틀렸는가, 해설이 틀렸는가"를
// 독립 채점 결과로만 가릴 수 있다. 라벨은 다른 문항과 같게 두어 힌트가 되지 않게 한다.
const MACHINE_FLAGGED = new Set([
  'RW-enterprise-NCS-C206-basic-1',
  'RW-enterprise-NCS-C206-basic-2',
  'RW-enterprise-NCS-C206-standard-1',
  'RW-enterprise-NCS-C206-standard-2',
  'RW-enterprise-NCS-C209-diagnosis',
])

// ---- 선정 ----------------------------------------------------------------
const QUOTA = { 'job-common': Infinity, 'ncs-basic': Infinity, 'recruit-written': Infinity, 'cover-letter': Infinity, interview: Infinity }
const chosen = new Map()

// A층: 고위험 전수 (직무적응 likert 제외 — 정답이 존재하지 않는 성향 문항)
for (const it of items) {
  if (it.assessmentType === 'likert') continue
  if (it.risk.length || MACHINE_FLAGGED.has(it.blind.questionId)) {
    chosen.set(it.blind.questionId, { ...it, tier: 'A_고위험_전수' })
  }
}
// B층: 층화 표본 — 층별 최소 정원을 A층 포함으로 채운다
const byGroup = {}
for (const it of items) {
  if (it.assessmentType === 'likert') continue
  ;(byGroup[`${it.subject}|${it.group}`] ||= []).push(it)
}
for (const key of Object.keys(byGroup).sort()) {
  const list = byGroup[key]
  const subject = list[0].subject
  const quota = list[0].takeAll ? Infinity : (QUOTA[subject] ?? 10)
  const already = list.filter(it => chosen.has(it.blind.questionId)).length
  const need = quota === Infinity ? list.length - already : Math.max(0, quota - already)
  if (!need) continue
  const rest = list.filter(it => !chosen.has(it.blind.questionId))
  for (const it of sample(rest, need, key)) chosen.set(it.blind.questionId, { ...it, tier: 'B_층화_표본' })
}

const selected = [...chosen.values()].sort((a, b) => (a._sort < b._sort ? -1 : a._sort > b._sort ? 1 : 0))

// ---- 커버리지 --------------------------------------------------------------
const coverage = {}
for (const it of items) {
  const k = `${it.subject}|${it.groupLabel}`
  const c = (coverage[k] ||= { subject: it.subject, group: it.groupLabel, assessmentType: it.assessmentType, pool: 0, selected: 0, highRisk: 0 })
  c.pool++
  if (chosen.has(it.blind.questionId)) {
    c.selected++
    if (chosen.get(it.blind.questionId).tier.startsWith('A')) c.highRisk++
  }
}
const ncsAbilities = NCS_2026_AREAS.flatMap(a => a.abilities.map(b => ({ area: a.id, ability: b.id })))
const ncsCovered = new Set(items.filter(i => i.subject === 'ncs-basic').map(i => i.group))
const ncsZero = ncsAbilities.filter(a => !ncsCovered.has(a.ability))

const meta = {
  purpose: '앱 정답을 모르는 독립 검증자가 각 문항의 정답을 스스로 산출하기 위한 블라인드 세트',
  baseline: BASELINE,
  generatedBy: 'verification/adversarial-4.8.13/tools/export-cnt-blind.mjs',
  removedFields: ['answer', 'explanation', 'answerSource', 'teachingNote', 'supplementaryNote', 'examPriority'],
  tiers: {
    'A_고위험_전수': '앱이 직접 만든 문항·변형 문항·출처 미표기·부정형 발문·수동검토 대상·보기 중복 — 전수 판정 대상',
    'B_층화_표본': '층별 최소 정원을 채우는 결정적 표본(시드 고정, 재현 가능)',
  },
  quota: { 'job-common': '공식영역별 30', 'ncs-basic': '하위능력별 10', 'recruit-written': '지원처 유형별 30', 'cover-letter': '전수', interview: '전수' },
  excludedSubjects: {  // 소유자 결정: 두 과목은 검증 대상이 아니다
    'food-service': `식음료서비스 — 소유자 결정으로 검증 범위에서 완전 제외(2026-09-01). 앱 데이터도 비활성 상태(런타임 문항 ${foodServiceBank.length}개, src/lib/foodServiceBank.js 주석의 2026-08-20 과목 제외 결정). 의뢰서 층화 기준의 "식음료서비스 단원별 10문항"은 이 결정에 따라 적용하지 않는다 — 결함이 아니다.`,
    quality: `품질경영 — 소유자 결정으로 검증 범위에서 완전 제외(2026-09-01). 앱 데이터도 비활성(단원 ${qualityPractice.units.length}개, data/quality-mgmt-practice.json meta._note).`,
  },
  excludedAssessment: {
    '직무적응(likert)': '교육부 직업공통 직무적응 영역은 정오가 없는 성향형(likert)이라 정답 독립 판정 대상이 아니다.',
  },
  notGraded: {
    coverLetterWritingTypes: `자기소개서 문항 유형 ${COVER_LETTER_QUESTION_LIBRARY.length}종은 서술형 작성 과제라 정답이 없다. writingPrompts 절에 원문을 함께 싣되 정답 판정 대상에서 제외한다.`,
  },
  counts: {
    poolTotal: items.length,
    selectedTotal: selected.length,
    tierA: selected.filter(s => s.tier.startsWith('A')).length,
    tierB: selected.filter(s => s.tier.startsWith('B')).length,
    unusable: unusable.length,
    duplicateIdsDropped: dupIds.length,
  },
  ncsAbilityZeroCoverage: ncsZero,
  instructions: [
    '각 항목의 stem·context·choices만 보고 정답 번호(choices[].no)를 스스로 산출한다.',
    'questionMode가 ox이면 1=O, 2=X 로 답한다. multi이면 정답 번호를 배열로 답한다.',
    '정답을 하나로 확정할 수 없으면 verdict를 unresolvable로 두고 이유를 적는다.',
    '결과 형식: [{ questionId, answerNo, confidence, reason }] — 근거는 한 줄로 충분하다.',
  ],
}

mkdirSync('verification/adversarial-4.8.13/handoff', { recursive: true })
mkdirSync('verification/adversarial-4.8.13/private', { recursive: true })

writeFileSync('verification/adversarial-4.8.13/handoff/CNT_blind_full.json',
  JSON.stringify({
    _meta: meta,
    coverage: Object.values(coverage).sort((a, b) => (a.subject + a.group < b.subject + b.group ? -1 : 1)),
    writingPrompts: COVER_LETTER_QUESTION_LIBRARY.map(x => ({ id: x.id, label: x.label, question: x.question, required: x.required ?? null, limit: x.limit ?? null })),
    items: selected.map(s => ({ ...s.blind, tier: s.tier })),
    openItems,
  }, null, 1) + '\n')

writeFileSync('verification/adversarial-4.8.13/private/CNT_app_answers_full.json',
  JSON.stringify({
    _meta: { warning: '앱 정답 원본 — 독립 검증자에게 전달 금지', baseline: BASELINE, count: Object.keys(answers).length },
    selectedIds: selected.map(s => s.blind.questionId),
    answers,
  }, null, 1) + '\n')

writeFileSync('verification/adversarial-4.8.13/private/CNT_unusable_full.json',
  JSON.stringify({ unusable, duplicateIds: dupIds, openAnswers }, null, 1) + '\n')

console.log('[CNT 블라인드] 풀', items.length, '· 선정', selected.length,
  `(A 고위험 ${meta.counts.tierA} / B 표본 ${meta.counts.tierB})`,
  '· 판정불가 제외', unusable.length, '· 중복 id', dupIds.length)
for (const c of Object.values(coverage)) {
  console.log(' ', c.subject.padEnd(16), String(c.group).padEnd(26), c.assessmentType.padEnd(9), 'pool', String(c.pool).padStart(5), 'sel', String(c.selected).padStart(5), 'risk', String(c.highRisk).padStart(5))
}
if (ncsZero.length) console.log('  ⚠️ 26v1 하위능력 문항 0개:', ncsZero.map(z => z.ability).join(', '))
