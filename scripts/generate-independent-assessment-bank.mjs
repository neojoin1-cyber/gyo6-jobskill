import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import baseline from '../data/assessment-expansion-baseline.json'
import interviewStudy from '../data/interview-study.json'
import { NCS_2026_AREAS } from '../src/lib/officialStandards.js'
import { INTERVIEW_ORGANIZATIONS } from '../src/lib/interviewCareerContent.js'

const PREFIX = baseline.generatedPrefix || 'NEW26-'
const LETTERS = ['A', 'B', 'C', 'D']
const META = {
  learningLane: 'assessment',
  questionMode: 'mcq',
  answerSource: 'independent-blueprint-derived',
  sourceUse: 'structure-and-competency-only-no-source-item-text',
  alignmentStatus: 'independent-practice-aligned-to-published-framework',
  blueprintVersion: '2026.09.04-1',
  excludeFromQuiz: false,
  choiceOrderBalanced: true,
}

function hash(value) {
  let result = 2166136261
  for (const char of String(value)) {
    result ^= char.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function rotate(items, count) {
  const amount = ((count % items.length) + items.length) % items.length
  return [...items.slice(amount), ...items.slice(0, amount)]
}

function mcq({ id, correct, distractors, explanation, ...rest }) {
  const balancedDistractors = [...distractors]
  const numericSet = [correct, ...balancedDistractors].every(choice => /^[-+]?\d[\d,.]*\s*(?:%|점|개|건|명|원|만원|g|kg|일|분|시간)?$/i.test(String(choice).trim()))
  const correctLength = normalizeChoice(correct).length
  const longestWrong = Math.max(...balancedDistractors.map(choice => normalizeChoice(choice).length))
  if (!numericSet && correctLength - longestWrong > 5) {
    const target = hash(`${id}|length-balance`) % balancedDistractors.length
    const english = /^[\x00-\x7F\s.,'#-]+$/.test([correct, ...balancedDistractors].join(''))
    const tails = english
      ? [', while leaving the final verification until after completion', ', based only on the previous case without checking the new conditions', ', and record the reason only if a later problem occurs']
      : ['; 일정이 촉박하므로 세부 확인은 완료 뒤로 미룬다', '; 과거와 같은 업무라고 보고 새 조건의 확인은 생략한다', '; 처리 근거는 문제가 다시 생길 때만 기록한다']
    balancedDistractors[target] = `${balancedDistractors[target]}${tails[hash(id) % tails.length]}`
  }
  const raw = [correct, ...balancedDistractors]
  if (raw.length !== 4 || new Set(raw.map(String)).size !== 4) {
    throw new Error(`${id}: four unique choices are required`)
  }
  const choices = rotate(raw, hash(id) % 4)
  const answerIndex = choices.indexOf(correct)
  return {
    id,
    ...rest,
    choices,
    answer: LETTERS[answerIndex],
    answerText: correct,
    explanation,
    ...META,
  }
}

function normalizeChoice(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '')
}

function numericChoices(answer, deltas, suffix = '') {
  const values = [answer, ...deltas.map(delta => answer + delta)]
  if (values.some(value => !Number.isFinite(value)) || new Set(values).size !== 4) {
    throw new Error(`numeric distractor collision: ${values.join(',')}`)
  }
  return values.map(value => `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`)
}

const formatNumber = value => Number.isInteger(value) ? String(value) : Number(value).toFixed(1)

const pad = (value, size = 4) => String(value).padStart(size, '0')
const bySubject = name => baseline.subjects[name] || []
const additional = count => count * 2

const workplaces = ['물류센터', '고객지원팀', '생산관리팀', '시설운영팀', '온라인판매팀', '품질검사실', '총무팀', '구매팀']
const documents = ['작업요청서', '고객문의 기록', '납품명세서', '점검일지', '재고현황표', '회의결정문', '안전점검표', '업무인수인계서']

function makeJobKorean(index) {
  const id = `${PREFIX}JC-KO-${pad(index + 1)}`
  const place = workplaces[index % workplaces.length]
  const doc = documents[(index * 3) % documents.length]
  const quantity = 12 + (index % 29)
  const deadline = 14 + (index % 4)
  const mode = index % 4
  if (mode === 0) {
    const context = `[${place} ${doc} ${pad(index + 1, 3)}]\n요청: ${quantity}건의 기록을 확인해 오류 항목만 수정\n마감: 오늘 ${deadline}:00\n권한: 원본 변경 전 담당자 승인 필요\n보고: 수정 전·후 차이를 표로 첨부`
    return mcq({ id, area: '의사소통 국어', officialArea: '의사소통 국어', lessonId: 'NEW26-JC-KO-DOC', lessonTitle: '업무 문서 이해와 실행', level: '표준', context,
      stem: `${index + 1}차 ${place}의 ${doc} ${quantity}건을 처리할 때, 원본 변경 조건을 지키며 가장 먼저 해야 할 일은?`,
      correct: '오류 후보를 표시하고 담당자에게 원본 변경 승인을 요청한다',
      distractors: ['마감 전에 끝내기 위해 원본을 즉시 모두 수정한다', '정상 항목까지 새 양식으로 바꾼 뒤 결과만 보고한다', '수정 전후 기록 없이 오류 항목을 삭제한다'],
      explanation: '원본 변경에는 담당자 승인이 필요하다고 명시되어 있습니다. 따라서 오류 후보를 먼저 특정하고 승인받은 뒤 수정해야 하며, 변경 전후 기록도 남겨야 합니다.' })
  }
  if (mode === 1) {
    const context = `${place}에서 ${doc} ${quantity}건을 검토한 결과, ${quantity - 3}건은 일치했고 2건은 수량이 달랐으며 1건은 서명이 없었다. 담당자는 수량 불일치 2건을 오늘 ${deadline}:00까지 재확인하고, 서명 누락 1건은 내일 오전 보완하라고 지시했다.`
    return mcq({ id, area: '의사소통 국어', officialArea: '의사소통 국어', lessonId: 'NEW26-JC-KO-SUM', lessonTitle: '업무 내용 요약과 보고', level: '표준', context,
      stem: `${index + 1}차 ${doc} ${quantity}건의 검토 결과와 처리 기한을 가장 정확하게 요약한 보고 문장은?`,
      correct: `총 ${quantity}건 중 수량 불일치 2건은 오늘 ${deadline}:00까지 재확인하고, 서명 누락 1건은 내일 오전 보완한다`,
      distractors: [`총 ${quantity}건을 모두 오늘 ${deadline}:00까지 다시 작성한다`, '수량 불일치와 서명 누락을 모두 내일 오전에 확인한다', `${quantity - 3}건이 오류이므로 정상 3건만 별도로 보고한다`],
      explanation: '정확한 요약은 전체 건수, 두 오류 유형, 서로 다른 처리 기한을 모두 보존해야 합니다. 정답 문장만 이 네 정보를 빠짐없이 담고 있습니다.' })
  }
  if (mode === 2) {
    return mcq({ id, area: '의사소통 국어', officialArea: '의사소통 국어', lessonId: 'NEW26-JC-KO-WRITE', lessonTitle: '명확한 업무 문장 작성', level: '기초',
      context: `${place} 신입사원이 ${doc} 검토 결과를 다른 부서에 보내려 한다. 확인 대상은 ${quantity}건이고 회신 마감은 오늘 ${deadline}:00이다.`,
      stem: `${index + 1}차 ${doc} ${quantity}건의 회신을 요청할 때 업무 목적과 상대의 행동이 가장 분명하게 드러나는 문장은?`,
      correct: `${doc} ${quantity}건의 수량을 확인한 뒤 오늘 ${deadline}:00까지 불일치 번호를 회신해 주십시오`,
      distractors: ['전에 말씀드린 그 자료를 가능하면 빨리 잘 봐 주시면 감사하겠습니다', `${doc} 관련 건입니다. 특별한 문제가 없도록 적당히 처리해 주십시오`, '바쁘시겠지만 자료가 많으니 살펴보시고 나중에 알려 주시면 됩니다'],
      explanation: '명확한 업무 문장은 대상, 수행 행동, 회신 내용, 마감을 구체적으로 제시합니다. 정답 문장은 네 요소를 모두 담아 해석의 여지를 줄입니다.' })
  }
  const audioText = `${place} 안내입니다. ${doc} ${quantity}건 가운데 번호가 홀수인 기록만 먼저 확인해 주세요. 확인 결과는 오늘 ${deadline}:00까지 담당자에게 보내고, 원본 수정은 승인 메시지를 받은 뒤 시작하십시오.`
  return mcq({ id, area: '의사소통 국어', officialArea: '의사소통 국어', lessonId: 'NEW26-JC-KO-LISTEN', lessonTitle: '직무 한국어 듣기', level: '표준', audioText, transcript: audioText, audioLang: 'ko-KR', mediaType: 'audio', maxPlays: 1,
    stem: `${index + 1}차 ${doc} ${quantity}건 안내에 따라 원본 수정 전에 반드시 해야 하는 일은?`,
    correct: '확인 결과를 보내고 담당자의 승인 메시지를 받는다',
    distractors: ['홀수와 짝수 기록을 모두 수정한 뒤 승인받는다', '확인 결과를 보내지 않고 원본부터 수정한다', '마감 다음 날 담당자에게 수정 사실만 알린다'],
    explanation: '안내는 확인 결과를 기한 안에 보낸 뒤 승인 메시지를 받고 원본 수정을 시작하라고 했습니다. 승인 전 수정은 지시 순서를 어깁니다.' })
}

const englishWords = [
  ['invoice', '청구서'], ['shipment', '배송 물품'], ['deadline', '마감'], ['maintenance', '정비'],
  ['available', '이용 가능한'], ['confirm', '확인하다'], ['reschedule', '일정을 다시 잡다'], ['defective', '결함이 있는'],
  ['quantity', '수량'], ['refund', '환불'], ['warehouse', '창고'], ['inspection', '검사'],
]

function makeJobEnglish(index) {
  const id = `${PREFIX}JC-EN-${pad(index + 1)}`
  const order = 6100 + index
  const qty = 8 + (index % 17)
  const day = 10 + (index % 18)
  const mode = index % 3
  if (mode === 0) {
    const audioText = `Supervisor: Please inspect ${qty} boxes for Order ${order} before noon. Do not seal them until the quality team confirms the checklist. Employee: I will send the inspection result first and wait for confirmation before sealing the boxes.`
    return mcq({ id, area: '의사소통 영어', officialArea: '의사소통 영어', lessonId: 'ENG-dialog', lessonTitle: '직무 대화 듣기', kind: 'dialog', level: '표준', audioText, transcript: audioText, audioLang: 'en-US', mediaType: 'audio', maxPlays: 1,
      stem: `For Order ${order}, what must the employee do before sealing the boxes?`,
      correct: 'Send the inspection result and wait for confirmation',
      distractors: ['Seal every box before inspecting it', 'Change the order number without approval', 'Wait until the next day to inspect the boxes'],
      explanation: 'The supervisor says not to seal the boxes until the quality team confirms the checklist. The employee must therefore send the inspection result and wait for confirmation.' })
  }
  if (mode === 1) {
    const context = `Subject: Order ${order} schedule update\n\nThe original delivery date was June ${day}. Because the final inspection needs one more day, the shipment will leave on June ${day + 1} and arrive on June ${day + 3}. Please confirm whether your receiving desk is open after 3 p.m.`
    return mcq({ id, area: '의사소통 영어', officialArea: '의사소통 영어', lessonId: 'ENG-reading', lessonTitle: '직무 문서 읽기', kind: 'reading', level: '표준', context,
      stem: `According to the email about Order ${order}, what should the receiver confirm?`,
      correct: 'Whether the receiving desk is open after 3 p.m.',
      distractors: [`Whether Order ${order} should be cancelled`, `Whether the shipment arrived on June ${day}`, 'Whether the inspection can be skipped'],
      explanation: 'The final sentence directly asks the receiver to confirm whether the receiving desk is open after 3 p.m. The other choices are not requested.' })
  }
  const [word, meaning] = englishWords[index % englishWords.length]
  return mcq({ id, area: '의사소통 영어', officialArea: '의사소통 영어', lessonId: 'ENG-vocab', lessonTitle: '직무 어휘', kind: 'vocab', level: '기초',
    context: `Before processing Order ${order}, please ${word === 'confirm' ? 'confirm' : 'check'} the ${word} information in the system.`,
    stem: `Order ${order} 업무 문장에서 '${word}'의 의미로 가장 알맞은 것은?`,
    correct: meaning,
    distractors: englishWords.filter(([candidate]) => candidate !== word).slice((index + 3) % 8, (index + 3) % 8 + 3).map(([, value]) => value),
    explanation: `'${word}'는 이 업무 문맥에서 '${meaning}'의 뜻입니다. 문장의 처리 대상과 동작을 함께 보면 다른 선택지와 구별할 수 있습니다.` })
}

function makeMathQuestion({ id, index, area = '수리활용', lessonId = 'NEW26-JC-MATH', blueprint = 'job-common', seedOffset = 0, extra = {} }) {
  const seed = index + seedOffset
  const mode = seed % 5
  const cycle = Math.floor(seed / 40)
  const base = 80 + (seed % 17) * 10 + cycle
  const seriesLabel = blueprint === 'ncs' ? 'NCS 능력단위 현장 자료' : '직업기초 업무 자료'
  if (mode === 0) {
    const later = base + 20 + (seed % 4) * 10
    const answer = Math.round(((later - base) / base) * 1000) / 10
    const values = numericChoices(answer, [5, -5, 10], '%')
    return mcq({ id, area, lessonId, level: '표준', context: `[${seriesLabel} ${index + 1}] 처리 실적을 비교한다.`, visual: { type: 'table', caption: '월별 처리 실적', columns: ['구분', '지난달', '이번 달'], rows: [['처리 건수', base, later]], note: '증가율은 지난달을 기준으로 계산함' }, mediaType: 'visual',
      stem: `${index + 1}번 자료에서 지난달 대비 이번 달 처리 건수 증가율은?`, correct: values[0], distractors: values.slice(1),
      explanation: `증가량은 ${later - base}건이고 기준값은 지난달 ${base}건입니다. (${later - base}÷${base})×100=${formatNumber(answer)}%입니다.`, ...extra })
  }
  if (mode === 1) {
    const a = 20 + (seed % 7) * 5
    const b = a + 10
    const n1 = 2 + (seed % 3)
    const n2 = 6 - n1
    const answer = (a * n1 + b * n2) / (n1 + n2)
    const values = numericChoices(answer, [2.5, -2.5, 5], '점')
    return mcq({ id, area, lessonId, level: '표준', context: `[${seriesLabel} ${index + 1}] 조별 검사 결과를 합산한다.`, visual: { type: 'table', caption: '조별 검사 결과', columns: ['조', '평균 점수', '인원'], rows: [['1조', a, n1], ['2조', b, n2]] }, mediaType: 'visual',
      stem: `${index + 1}번 조별 자료에서 전체 인원의 가중평균 점수는?`, correct: values[0], distractors: values.slice(1),
      explanation: `전체 합계는 ${a}×${n1}+${b}×${n2}=${a * n1 + b * n2}점이고 인원은 ${n1 + n2}명입니다. 따라서 가중평균은 ${formatNumber(answer)}점입니다.`, ...extra })
  }
  if (mode === 2) {
    const kg = 2 + (seed % 8) * 0.5 + cycle * 0.1
    const count = 6 + (seed % 5)
    const answer = kg * count * 1000
    const values = numericChoices(answer, [500, -500, 1000], 'g')
    return mcq({ id, area, lessonId, level: '기초', context: `[${seriesLabel} ${index + 1}] 출고 부품 한 상자의 무게는 ${kg}kg이고 같은 상자 ${count}개를 보낸다.`,
      stem: `${index + 1}번 출고 자료의 전체 무게를 g으로 바르게 나타낸 것은?`, correct: values[0], distractors: values.slice(1),
      explanation: `${kg}kg×${count}=${formatNumber(kg * count)}kg이며, 1kg=1,000g이므로 ${formatNumber(answer)}g입니다.`, ...extra })
  }
  if (mode === 3) {
    const per = 6 + (seed % 5) + Math.floor(seed / 60)
    const people = 4 + (seed % 4)
    const hours = 3 + (seed % 3)
    const targetHours = hours + 2
    const answer = per * people * targetHours
    const values = numericChoices(answer, [per, -per, per * 2], '개')
    return mcq({ id, area, lessonId, level: '표준', context: `[${seriesLabel} ${index + 1}] 생산 계획에서 작업자 1명은 시간당 ${per}개를 처리한다. 작업자 ${people}명이 같은 속도로 ${targetHours}시간 일한다.`,
      stem: `${index + 1}번 생산 계획에서 총 처리 가능한 수량은?`, correct: values[0], distractors: values.slice(1),
      explanation: `시간당 전체 처리량은 ${per}×${people}=${per * people}개이고, ${targetHours}시간이면 ${per * people}×${targetHours}=${formatNumber(answer)}개입니다.`, ...extra })
  }
  const chartCycle = Math.floor(seed / 45)
  const values = [12 + seed % 9 + chartCycle, 18 + seed % 9 + chartCycle, 9 + seed % 9 + chartCycle, 15 + seed % 9 + chartCycle]
  const max = Math.max(...values)
  const labels = ['가공', '조립', '검수', '포장']
  const correctLabel = labels[values.indexOf(max)]
  return mcq({ id, area, lessonId, level: '기초', context: `[${seriesLabel} ${index + 1}] 공정 기록을 비교한다.`, visual: { type: 'bar', caption: `공정별 지연 건수 · ${index + 1}차 기록`, items: labels.map((label, i) => ({ label, value: values[i] })), note: '단위: 건' }, mediaType: 'visual',
    stem: `${index + 1}차 기록에서 지연 건수가 가장 많은 공정은?`, correct: correctLabel, distractors: labels.filter(label => label !== correctLabel),
    explanation: `네 공정의 막대값을 같은 단위로 비교하면 가장 큰 값은 ${max}건입니다. 따라서 지연 건수가 가장 많은 곳은 ${correctLabel} 공정입니다.`, ...extra })
}

const problemDomains = ['자원관리', '정보활용', '기술활용', '시스템적 사고']
const problemProcesses = ['문제인식', '대안탐색 및 선택', '전략수립 및 실행', '평가 및 성찰']

function makeJobProblem(index) {
  const id = `${PREFIX}JC-PS-${pad(index + 1)}`
  const domain = problemDomains[index % problemDomains.length]
  const process = problemProcesses[Math.floor(index / problemDomains.length) % problemProcesses.length]
  const budget = 70 + (index % 8) * 10
  const deadline = 4 + (index % 5)
  const context = `[${domain} 개선 과제 ${pad(index + 1, 3)}]\n목표: 오류를 줄이면서 ${deadline}일 안에 작업 재개\n가용 예산: ${budget}만원\n대안 A: ${budget + 20}만원·${deadline - 1}일·전체 교체\n대안 B: ${budget - 10}만원·${deadline}일·원인 구간만 교체\n대안 C: ${budget - 25}만원·${deadline + 3}일·임시 보수\n대안 D: ${budget - 5}만원·${deadline - 2}일·필수 안전검사 생략`
  const common = { id, area: '문제해결', officialArea: '문제해결', lessonId: `PS-${domain}`, lessonTitle: `${domain} · ${process}`, level: '표준', context, psDomain: domain, psProcess: process,
    teenupBlueprint: { contentDomain: domain, process, cognitiveDemand: process === '평가 및 성찰' ? '판단 및 성찰' : '직무 적용', workContext: index % 3 === 0 ? '고객 응대' : index % 3 === 1 ? '동료·상사 협업' : '개인 업무', classificationBasis: 'authored-blueprint', alignmentStatus: META.alignmentStatus } }
  if (process === '문제인식') return mcq({ ...common, stem: `${domain} 개선 과제의 해결안을 고르기 전에 확인해야 할 핵심 제약의 조합은?`, correct: `예산 ${budget}만원, ${deadline}일 기한, 안전검사 유지`, distractors: ['비용과 기한은 무시하고 교체 범위만 확인', '예산만 확인하고 안전검사는 선택 사항으로 처리', '가장 빠른 대안인지 여부만 확인'], explanation: '문제의 목표는 오류 감소뿐 아니라 예산, 기한, 안전검사를 동시에 지키는 것입니다. 세 제약을 함께 정의해야 적절한 대안을 비교할 수 있습니다.' })
  if (process === '대안탐색 및 선택') return mcq({ ...common, stem: `예산 ${budget}만원과 ${deadline}일 기한, 안전검사 유지 조건을 모두 만족하는 대안은?`, correct: '대안 B', distractors: ['대안 A', '대안 C', '대안 D'], explanation: `B는 ${budget - 10}만원으로 예산 안이고 ${deadline}일 기한을 지키며 안전검사를 생략하지 않습니다. A는 예산, C는 기한, D는 안전 조건을 어깁니다.` })
  if (process === '전략수립 및 실행') return mcq({ ...common, stem: `${domain} 과제에서 대안 B를 ${deadline}일 안에 실행할 때 가장 타당한 첫 단계는?`, correct: '원인 구간과 안전검사 기준을 확정하고 담당·일정을 배정한다', distractors: ['결과 확인 방법 없이 즉시 모든 설비를 분해한다', '예산 승인 전에 자재부터 전량 주문한다', '기한만 알리고 역할과 확인 기준은 정하지 않는다'], explanation: '실행 전에는 대상 범위와 안전 기준을 확정하고 담당자·일정을 연결해야 합니다. 그래야 누락 없이 기한과 품질을 함께 관리할 수 있습니다.' })
  return mcq({ ...common, stem: `${domain} 과제 실행 후 ${budget}만원 예산의 개선 효과를 가장 타당하게 확인하는 방법은?`, correct: '재개 전후 오류율과 중단시간을 같은 기준으로 비교하고 안전검사 결과를 함께 확인한다', distractors: ['담당자의 만족도만 묻고 오류 기록은 보지 않는다', '수리 비용만 비교하고 작업 결과는 확인하지 않는다', '재개 직후 한 번 정상 작동하면 추가 점검을 생략한다'], explanation: '목표가 오류 감소와 작업 재개이므로 전후 오류율·중단시간을 같은 기준으로 비교해야 하며, 필수 제약인 안전검사도 함께 확인해야 합니다.' })
}

function buildJobCommon() {
  const result = []
  for (const row of bySubject('job-common')) {
    const count = additional(row.count)
    if (row.key === '의사소통 국어') for (let i = 0; i < count; i++) result.push(makeJobKorean(i))
    if (row.key === '의사소통 영어') for (let i = 0; i < count; i++) result.push(makeJobEnglish(i))
    if (row.key === '수리활용') for (let i = 0; i < count; i++) result.push(makeMathQuestion({ id: `${PREFIX}JC-MA-${pad(i + 1)}`, index: i, extra: { officialArea: '수리활용', lessonTitle: '수리활용 실전 자료 해석' } }))
    if (row.key === '문제해결') for (let i = 0; i < count; i++) result.push(makeJobProblem(i))
  }
  return result
}

const NCS_BEHAVIOURS = {
  문서소통능력: ['문서의 목적·대상·기한을 표시한 뒤 필요한 행동을 정리한다', '제목만 보고 세부 조건을 추측한다', '마감과 승인 조건을 생략한다', '모든 문장을 같은 중요도로 옮겨 적는다'],
  구두소통능력: ['상대의 요구를 끝까지 듣고 핵심 내용과 기한을 다시 확인한다', '말이 끝나기 전에 예상한 답부터 제시한다', '모호한 부분을 확인하지 않고 임의로 처리한다', '요구와 무관한 자신의 경험을 길게 설명한다'],
  외국어소통능력: ['핵심 요청과 수량·일정을 확인하고 쉬운 표현으로 되묻는다', '모르는 단어가 있어도 전체 내용을 아는 척한다', '수량과 날짜를 확인하지 않고 동의한다', '상대의 질문과 관계없는 인사말만 반복한다'],
  연산능력: ['단위와 기준값을 먼저 확인한 뒤 계산하고 역산으로 검산한다', '단위를 통일하지 않고 숫자만 더한다', '기준값 대신 결과값으로 비율을 계산한다', '계산 과정 없이 가장 커 보이는 수를 고른다'],
  통계활용능력: ['자료의 모집단·표본·평균 기준을 확인하고 비교한다', '표본 수가 다른 집단의 평균을 단순히 더한다', '한 번의 결과만으로 전체 경향을 단정한다', '평균과 중앙값의 차이를 구분하지 않는다'],
  도표활용능력: ['축·단위·범례를 확인한 뒤 필요한 값을 서로 같은 기준으로 비교한다', '막대 길이만 보고 축의 시작값을 무시한다', '서로 다른 단위의 값을 그대로 비교한다', '제목만 읽고 수치를 확인하지 않는다'],
  문제분석능력: ['현상과 원인을 구분하고 확인 가능한 자료로 핵심 문제를 정의한다', '처음 들은 의견을 원인으로 확정한다', '문제 범위를 정하지 않고 해결책부터 고른다', '사실과 추측을 한 목록에 섞는다'],
  대안발굴능력: ['목표와 제약을 기준으로 여러 대안을 만들고 장단점을 비교한다', '처음 떠오른 방법 하나만 검토한다', '비용은 보지 않고 속도만 비교한다', '실행 가능성을 확인하지 않고 새로워 보이는 안을 고른다'],
  의사결정능력: ['판단 기준의 우선순위를 정하고 근거를 기록한 뒤 결과를 검토한다', '기준을 정하지 않고 다수 의견만 따른다', '결정 이유를 남기지 않는다', '결정 뒤 결과가 달라도 검토하지 않는다'],
  경력개발능력: ['현재 역량과 목표 직무의 요구를 비교해 구체적인 보완 계획을 세운다', '직무 요구를 확인하지 않고 자격증 수만 늘린다', '강점만 적고 보완할 점은 외면한다', '기한과 확인 방법이 없는 목표를 세운다'],
  적응학습능력: ['변화 이유와 필요한 역량을 파악해 학습하고 실제 과제에 적용한다', '새 방식은 익숙해질 때까지 사용하지 않는다', '자료를 읽기만 하고 적용 결과는 확인하지 않는다', '피드백을 받아도 기존 방법을 유지한다'],
  시간관리능력: ['마감·중요도·소요시간을 함께 보고 순서를 정해 진행 상황을 점검한다', '쉬운 일부터 하느라 긴급 업무를 미룬다', '예상 소요시간 없이 일정만 나열한다', '지연 가능성을 마지막 순간까지 알리지 않는다'],
  협업능력: ['공동 목표와 역할을 확인하고 필요한 정보를 제때 공유한다', '자신의 부분만 끝내고 연결 업무는 확인하지 않는다', '정보를 요청받을 때까지 보관한다', '역할 충돌이 생겨도 조정하지 않는다'],
  리더십: ['목표와 기준을 설명하고 구성원이 실행할 수 있도록 역할과 지원을 조정한다', '이유 설명 없이 지시만 반복한다', '성과는 혼자 차지하고 문제는 담당자에게 돌린다', '구성원의 상황을 보지 않고 같은 방식만 강요한다'],
  갈등관리능력: ['사실·이해관계·감정을 구분해 공통 목표에 맞는 해결안을 찾는다', '누가 잘못했는지만 먼저 가린다', '갈등을 피하려고 쟁점을 덮는다', '상대 의견을 듣지 않고 자신의 안을 통보한다'],
  디지털활용능력: ['목적에 맞는 도구를 선택하고 입력·처리·출력 결과를 검증한다', '익숙한 도구라는 이유만으로 선택한다', '자동 계산 결과를 원자료와 대조하지 않는다', '공유 권한을 확인하지 않고 링크를 공개한다'],
  '인공지능(AI)활용능력': ['AI 결과의 출처·조건·오류 가능성을 검토하고 사람이 최종 판단한다', 'AI가 만든 답을 사실 확인 없이 제출한다', '개인정보를 그대로 입력한다', '목적과 위험을 보지 않고 가장 유명한 도구를 사용한다'],
  디지털책임의식: ['필요한 최소 정보만 적법한 권한으로 처리하고 보안 절차를 지킨다', '업무 편의를 위해 공용 계정을 함께 쓴다', '출처를 지운 자료를 자신의 결과로 제출한다', '개인정보가 든 파일을 공개 링크로 공유한다'],
  근로윤리: ['약속한 기준과 기한을 지키고 오류가 있으면 사실대로 보고해 바로잡는다', '결과가 좋으면 절차 위반은 숨긴다', '동료의 성과를 자신의 성과로 기록한다', '불리한 정보는 보고에서 제외한다'],
  직장공동체의식: ['서로의 역할과 차이를 존중하며 공동 결과에 필요한 책임을 나눈다', '직급이 낮은 사람의 의견은 검토하지 않는다', '규정 대신 친분에 따라 처리한다', '공동 문제를 개인 담당자의 책임으로만 돌린다'],
  산업안전보건의식: ['작업 전 위험요인과 보호구·비상절차를 확인하고 이상 시 즉시 중지·보고한다', '경험이 있으므로 보호구를 생략한다', '작은 이상은 작업 후 한꺼번에 보고한다', '생산 일정이 급하면 안전점검을 미룬다'],
}

function makeNcs(index, areaSpec, ability, element) {
  const id = `${PREFIX}NCS-${areaSpec.code}-${pad(index + 1)}`
  if (areaSpec.id === '수리능력') {
    return makeMathQuestion({ id, index, area: areaSpec.id, lessonId: ability.id, blueprint: 'ncs', seedOffset: 911, extra: { ncsAbility: ability.id, ncsElement: element, lessonTitle: ability.id, standardId: 'moel-hrdkorea-ncs-common-26v1' } })
  }
  const actions = NCS_BEHAVIOURS[ability.id]
  if (!actions) throw new Error(`missing NCS behaviour: ${ability.id}`)
  const place = workplaces[(index + Number(areaSpec.code)) % workplaces.length]
  const doc = documents[(index * 5) % documents.length]
  const deadline = 13 + (index % 5)
  const mode = index % 4
  const contexts = [
    `${index + 1}차 ${place} 업무에서 ${doc}를 처리하던 중 '${element}'과 관련된 누락이 발견되었다. 오늘 ${deadline}:00까지 사실을 확인하고 처리 기준을 남겨야 한다.`,
    `${index + 1}차 ${place}의 새 업무 절차를 적용하는 첫날이다. 팀은 '${element}'을 지키면서 오류를 줄일 방법을 정하고 실행 근거를 기록해야 한다.`,
    `${index + 1}차 ${doc} 검토 결과가 부서마다 다르게 보고되었다. 담당자는 '${element}'을 기준으로 자료를 다시 확인해 하나의 결론을 제시해야 한다.`,
    `${index + 1}차 ${place} 업무가 예정보다 늦어지고 있다. 안전과 품질을 유지하면서 '${element}'에 맞는 조치를 선택해야 한다.`,
  ]
  const stems = [
    `${place}의 ${doc} 누락을 ${deadline}:00까지 바로잡기 위해 가장 먼저 실행할 행동은?`,
    `${place}의 '${element}' 절차를 적용할 때 업무 결과의 신뢰성을 가장 높이는 행동은?`,
    `${doc} 검토 결과를 '${element}' 기준으로 통합하는 계획은?`,
    `${place}의 ${doc} 처리 지연과 '${element}' 문제가 반복되지 않도록 할 조치는?`,
  ]
  return mcq({ id, area: areaSpec.id, ncsAbility: ability.id, ncsElement: element, lessonId: ability.id, lessonTitle: ability.id, level: index % 3 === 0 ? '기초' : index % 3 === 1 ? '표준' : '심화', standardId: 'moel-hrdkorea-ncs-common-26v1', context: contexts[mode], stem: stems[mode], correct: actions[0], distractors: actions.slice(1), explanation: `'${element}'에서는 ${actions[0]}는 원칙이 핵심입니다. 다른 선택지는 확인·공유·검증 또는 안전 조건을 생략해 업무 결과를 신뢰하기 어렵습니다.` })
}

function buildNcs() {
  const areaCounts = new Map()
  for (const row of bySubject('ncs-basic')) {
    const area = row.key.split(' > ')[0]
    areaCounts.set(area, (areaCounts.get(area) || 0) + row.count)
  }
  const result = []
  for (const areaSpec of NCS_2026_AREAS) {
    const count = additional(areaCounts.get(areaSpec.id) || 0)
    for (let index = 0; index < count; index++) {
      const ability = areaSpec.abilities[index % areaSpec.abilities.length]
      const element = ability.elements[Math.floor(index / areaSpec.abilities.length) % ability.elements.length]
      result.push(makeNcs(index, areaSpec, ability, element))
    }
  }
  return result
}

const RECRUIT_TRACK_LABEL = { public: '공공기관형', finance: '금융권형', enterprise: '대기업형' }
const RECRUIT_ACTIONS = {
  자원관리: ['필수 자원·가용량·마감을 표로 대조해 부족분부터 배분한다', '요청 순서대로 자원을 모두 배분한다', '가장 비싼 자원을 우선 구매한다', '사용 기록 없이 남은 수량만 추정한다'],
  조직이해: ['조직의 목적·권한·업무 흐름을 확인해 담당 부서와 보고 경로를 정한다', '친한 직원에게만 비공식으로 전달한다', '부서 역할을 확인하지 않고 모든 업무를 한 팀에 보낸다', '공식 규정보다 과거 관행을 우선한다'],
  기술능력: ['작동 원리와 안전 기준을 확인한 뒤 측정값으로 이상 구간을 좁힌다', '전원을 켠 채 임의로 부품을 교체한다', '측정 없이 소음이 큰 부품을 원인으로 단정한다', '안전점검보다 생산 재개를 우선한다'],
  대인관계: ['고객의 요구와 사실을 구분해 확인하고 가능한 해결 절차와 시간을 안내한다', '책임 소재를 먼저 따져 고객의 말을 중단시킨다', '확인 없이 즉시 보상을 약속한다', '담당자가 아니라는 이유로 다른 안내 없이 통화를 끝낸다'],
}

function makeRecruit(index, track, area, curriculumLessonTitle) {
  const id = `${PREFIX}RW-${track}-${String(area).replace(/[^0-9A-Za-z가-힣]/g, '')}-${pad(index + 1)}`
  const trackLabel = RECRUIT_TRACK_LABEL[track]
  const place = workplaces[(index + track.length) % workplaces.length]
  if (area === '인적성') {
    const start = 3 + index % 7
    const step = 2 + index % 5
    const answer = start + step * 5
    const values = numericChoices(answer, [step, -step, step * 2])
    return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area, lessonId: 'NEW26-RW-APTITUDE', lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: '표준', context: `${index + 1}차 설비 점검 번호가 ${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, ${start + step * 4} 순서로 부여된다.`, stem: `${start}에서 시작해 ${step}씩 커지는 설비 점검 번호의 다음 값은?`, correct: values[0], distractors: values.slice(1), explanation: `연속한 두 번호의 차는 모두 ${step}이므로 등차수열입니다. 마지막 번호 ${start + step * 4}에 ${step}을 더하면 ${formatNumber(answer)}입니다. 오답은 공차를 한 번 덜하거나 더한 값입니다.` })
  }
  if (area === '금융상식') {
    const principal = 100 + (index % 9) * 20
    const rate = 2 + index % 4
    const answer = principal * rate / 100
    const values = numericChoices(answer, [2, -2, 4], '만원')
    return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area, lessonId: 'NEW26-RW-FINANCE', lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: '표준', context: `금융 사례 ${index + 1}: 원금 ${principal}만원을 연 ${rate}% 단리 상품에 1년간 예치하며 세금과 수수료는 고려하지 않는다.`, stem: '1년 이자는?', correct: values[0], distractors: values.slice(1), explanation: `단리 1년 이자는 원금×이율이므로 ${principal}×${rate / 100}=${formatNumber(answer)}만원입니다.` })
  }
  if (area === '경제상식') {
    const context = `${index + 1}번 시장에서 다른 조건은 같고 상품 가격만 상승했다. 소비자의 소득과 선호, 대체재 가격은 변하지 않았다.`
    return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area, lessonId: 'NEW26-RW-ECONOMY', lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: '기초', context, stem: '일반적인 수요 법칙에 따른 변화는?', correct: '수요량이 감소한다', distractors: ['수요곡선 자체가 오른쪽으로 이동한다', '공급량이 반드시 감소한다', '균형가격이 항상 0이 된다'], explanation: '다른 조건이 일정할 때 상품 가격이 오르면 같은 수요곡선 위에서 수요량이 감소합니다. 소득·선호 같은 비가격 요인이 변한 것이 아니므로 수요곡선 이동으로 보지 않습니다.' })
  }
  if (area === '경영상식') {
    const fixed = 120 + (index % 8) * 10
    const margin = 4 + index % 5
    const answer = fixed / margin
    const values = numericChoices(answer, [5, -5, 10], '개')
    return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area, lessonId: 'NEW26-RW-MANAGEMENT', lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: '표준', context: `제품 ${index + 1}의 월 고정비는 ${fixed}만원이고 1개당 판매가격에서 변동비를 뺀 공헌이익은 ${margin}만원이다.`, stem: '손익분기 판매량은?', correct: values[0], distractors: values.slice(1), explanation: `손익분기 판매량은 고정비÷개당 공헌이익이므로 ${fixed}÷${margin}=${formatNumber(answer)}개입니다.` })
  }
  if (area === '일반상식') {
    return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area, lessonId: 'NEW26-RW-COMMON', lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: '표준', context: `${place}에서 고객 연락처가 포함된 ${index + 1}차 조사 파일을 외부 협력자와 공유해야 한다. 협력자는 통계 합계만 필요하다.`, stem: '개인정보 최소 처리 원칙에 가장 맞는 방법은?', correct: '개인 식별정보를 제거하고 필요한 통계만 권한이 제한된 경로로 제공한다', distractors: ['원본 파일 전체를 공개 링크로 전송한다', '이름만 남기고 전화번호와 주소도 함께 제공한다', '업무가 급하므로 개인 메신저로 원본을 보낸다'], explanation: '상대가 통계 합계만 필요하므로 개인 식별정보를 제공할 이유가 없습니다. 필요한 최소 정보만 추려 접근 권한이 제한된 경로로 공유해야 합니다.' })
  }
  const actions = RECRUIT_ACTIONS[area]
  if (!actions) throw new Error(`missing recruit blueprint: ${track}/${area}`)
  return mcq({ id, recruitmentTrack: track, recruitmentTrackLabel: trackLabel, area: area === '자원관리' ? '자원관리능력' : area === '조직이해' ? '조직이해능력' : area === '대인관계' ? '대인관계능력' : area, lessonId: `NEW26-RW-${area}`, lessonTitle: curriculumLessonTitle, curriculumLessonTitle, level: index % 2 ? '표준' : '기초', context: `${place}에서 ${documents[index % documents.length]} ${18 + index}건의 처리 방식이 바뀌었다. 오늘 ${13 + index % 5}:00까지 기준을 지키면서 결과와 근거를 남겨야 한다.`, stem: `${trackLabel}의 ${place} ${documents[index % documents.length]} ${18 + index}건 사례에서 가장 타당한 업무 판단은?`, correct: actions[0], distractors: actions.slice(1), explanation: `${actions[0]}는 목표, 제약, 확인 절차를 함께 충족합니다. 다른 선택지는 근거 확인이나 안전·기록·소통 절차를 생략합니다.` })
}

function buildRecruit() {
  const studyUnits = new Map()
  for (const row of bySubject('recruit-written-study-units')) {
    const [track, area, lessonTitle] = row.key.split(' > ')
    const key = `${track} > ${area}`
    const values = studyUnits.get(key) || []
    if (lessonTitle && !values.includes(lessonTitle)) values.push(lessonTitle)
    studyUnits.set(key, values)
  }
  const groups = new Map()
  for (const row of bySubject('recruit-written')) {
    const [track, area, lessonTitle] = row.key.split(' > ')
    const key = `${track} > ${area}`
    const group = groups.get(key) || { count: 0, lessons: [] }
    group.count += row.count
    if (lessonTitle && !group.lessons.includes(lessonTitle)) group.lessons.push(lessonTitle)
    groups.set(key, group)
  }
  const result = []
  for (const [key, group] of groups) {
    const [track, area] = key.split(' > ')
    const lessons = studyUnits.get(key) || group.lessons
    for (let index = 0; index < additional(group.count); index++) {
      result.push(makeRecruit(index, track, area, lessons[index % lessons.length]))
    }
  }
  return result
}

const interviewLessonById = Object.fromEntries((interviewStudy.lessons || []).map(lesson => [lesson.id, lesson]))
const orgById = Object.fromEntries(INTERVIEW_ORGANIZATIONS.map(org => [org.id, org]))
const FOUNDATION_AREAS = ['오리엔테이션', '면접절차', '평가기준', '자기소개', '지원동기', '경험답변', '인성면접', '블라인드', '상황면접', 'PT/발표', '토론/그룹', '직무면접', '직장태도', '모의면접', '준비 루틴', '블라인드 안전']

function interviewArea(area, lessonId) {
  if (area) return area
  return interviewLessonById[lessonId]?.category || FOUNDATION_AREAS[hash(lessonId) % FOUNDATION_AREAS.length]
}

function makeInterview(index, areaValue, lessonId) {
  const area = interviewArea(areaValue, lessonId)
  const orgId = lessonId.startsWith('ORG-') ? lessonId.slice(4) : null
  const org = orgById[orgId]
  const baseLessonTitle = org?.name || interviewLessonById[lessonId]?.title || area
  const lessonTitle = ({
    'COVER-questions': '자기소개서 문항의 요구 역량 해석',
    'COVER-target': '현재 공식 채용공고와 직무 정보 조사',
    'COVER-major': '전공·교과 경험의 직무 역량 전환',
    'COVER-experience': '질문에 맞는 자신의 경험 근거 선별',
    'COVER-motivation': '지원처·직무와 나의 준비를 연결한 지원 동기',
    'COVER-audit': '사실·수치·블라인드 금지정보 최종 검수',
  }[lessonId] || baseLessonTitle)
  const id = `${PREFIX}IV-${String(lessonId).replace(/[^0-9A-Za-z가-힣-]/g, '')}-${pad(index + 1)}`
  const moment = ['공고를 처음 읽는 날', '서류 합격 직후', '답변 초안을 점검할 때', '모의면접 첫 회차', '교사 피드백을 받은 뒤', '면접 일주일 전', '지원 직무를 바꾼 뒤', '추가 질문을 준비할 때', '최종 리허설 직전', '면접 당일 대기 중'][index % 10]
  const practicePass = ['첫 답변을 준비하며', '다른 사례로 다시 연습하며', '피드백을 반영한 새 답변에서'][Math.floor(index / 10) % 3]
  if (org) {
    const role = org.roles[index % org.roles.length]
    const value = typeof org.values[index % org.values.length] === 'object' ? org.values[index % org.values.length].name : org.values[index % org.values.length]
    const variants = [
      [`${org.name} ${role} 지원자가 공고의 우대조건이 지난 모집과 달라진 것을 발견했다. 가장 타당한 준비는?`, '현재 공식 채용공고와 직무 설명을 대조해 준비표의 근거와 날짜를 갱신한다', ['지난 모집 합격후기만 기준으로 유지한다', '앱의 예전 요약이 더 편하므로 차이를 무시한다', '우대조건 확인 없이 자기소개만 반복한다'], '전형 조건은 바뀔 수 있으므로 실제 지원 시점의 공식 공고가 기준입니다. 변경된 근거와 확인 날짜까지 남겨 준비 내용을 갱신해야 합니다.'],
      [`${org.name}의 '${value}'를 면접에서 증명하는 답변으로 가장 적절한 것은?`, `${role}과 연결되는 자신의 행동, 판단 기준, 확인 가능한 결과를 한 사례로 설명한다`, ['가치 단어를 여러 번 반복해 강조한다', '기관 홍보 문구를 그대로 외워 말한다', '팀의 전체 성과를 자신의 단독 성과로 말한다'], '기관 가치는 칭찬이나 암기가 아니라 지원자가 실제로 한 행동과 그 결과로 증명해야 합니다.'],
      [`${org.name} ${role} 직무 질문을 받은 학생의 답변에 사용 도구만 있고 목적과 결과가 없다. 가장 좋은 보완은?`, '도구를 선택한 이유, 직접 수행한 작업, 오류 확인 방법, 결과를 순서대로 덧붙인다', ['도구 이름을 가능한 많이 나열한다', '전공 과목명을 반복하고 수행 내용은 생략한다', '입사 후 배우겠다는 말로 현재 경험을 대신한다'], '직무역량은 도구의 개수가 아니라 선택 이유와 수행 과정, 검증 가능한 결과로 판단됩니다.'],
      [`${org.name} 면접 준비 자료의 출처가 서로 다를 때 가장 먼저 할 일은?`, '각 정보의 공식 원문·게시일·적용 전형을 확인해 현재 공고와 일치하는 것만 사용한다', ['조회 수가 가장 많은 후기 하나를 고른다', '가장 유리한 내용만 골라 사실처럼 말한다', '출처를 지우고 여러 자료를 합친다'], '지원처 정보는 공식 원문과 게시 시점, 적용 전형을 함께 확인해야 합니다. 출처가 불분명한 후기는 보조 참고 이상으로 쓰기 어렵습니다.'],
      [`${org.name} ${role} 상황면접에서 처음 보는 설비 이상을 발견했다. 가장 적절한 답변 구조는?`, '안전 확보와 보고 → 사실 확인 → 권한 내 조치 → 결과 기록과 재발 방지 순서로 설명한다', ['경험이 있다고 가정하고 혼자 즉시 수리한다', '생산량을 지키기 위해 이상을 숨긴다', '원인을 특정하지 않은 채 동료 책임으로 돌린다'], '낯선 이상 상황에서는 안전과 보고가 먼저이며, 사실 확인과 권한 범위 안의 조치, 사후 기록까지 이어져야 합니다.'],
    ]
    const selected = variants[index % variants.length]
    return mcq({ id, area, category: area, _mockArea: area, lessonId, lessonTitle, level: index % 3 === 2 ? '심화' : '표준', context: `${practicePass} ${moment}, ${org.name} 지원 준비 자료를 점검하고 있다.`, stem: selected[0], correct: selected[1], distractors: selected[2], explanation: selected[3] })
  }
  const situations = [
    '답변에 상황 설명은 길지만 지원자가 직접 한 행동과 결과가 빠져 있다',
    '질문의 핵심 요구와 관계없는 장점을 먼저 길게 설명하고 있다',
    '팀 성과와 자신의 기여가 구분되지 않고 확인 가능한 근거도 없다',
    '블라인드 금지정보가 포함될 수 있는 고유명사를 확인하지 않았다',
    '예상하지 못한 추가 질문을 받고 외운 문장을 반복하려 한다',
  ]
  const corrects = [
    '질문의 요구를 한 문장으로 확인하고 자신의 판단·행동·결과가 드러나는 사례로 다시 답한다',
    '핵심 결론을 먼저 말하고 사실 근거와 자신의 역할을 짧게 연결한다',
    '팀의 공동 결과와 자신이 맡아 수행한 행동을 분리해 설명한다',
    '출신 학교·지역·가족 등 편견정보를 제거하고 역량을 보여 주는 행동 근거는 남긴다',
    '잠시 생각할 시간을 요청한 뒤 질문 의도에 맞는 실제 경험이나 판단 기준으로 답한다',
  ]
  const mode = index % situations.length
  return mcq({ id, area, category: area, _mockArea: area, lessonId, lessonTitle, level: index % 3 === 0 ? '기초' : index % 3 === 1 ? '표준' : '심화', context: `${practicePass} ${moment}, ${lessonTitle} 연습 답변을 점검하니 ${situations[mode]}.`, stem: `${lessonTitle}을 ${practicePass} 발견한 ${area} 답변 문제를 가장 타당하게 개선하는 방법은?`, correct: corrects[mode], distractors: ['답변 분량을 늘리기 위해 기관 홍보 문구를 그대로 덧붙인다', '불리할 수 있는 사실은 빼고 하지 않은 행동을 만들어 넣는다', '질문과 관계없이 준비한 자기소개를 처음부터 다시 말한다'], explanation: `${area}에서는 질문 의도와 실제 행동 근거가 연결되어야 합니다. 정답은 사실성을 지키면서 답변의 결론·행동·결과를 선명하게 만들지만, 다른 선택지는 암기·과장·회피에 해당합니다.` })
}

function buildInterview() {
  const result = []
  for (const row of bySubject('interview')) {
    const [area = '', lessonId = '종합'] = row.key.split(' > ')
    for (let index = 0; index < additional(row.count); index++) result.push(makeInterview(index, area, lessonId))
  }
  return result
}

const COVER_BLUEPRINTS = {
  intent: ['문항이 묻는 역량을 한 문장으로 확인한 뒤, 그를 증명하는 자신의 행동과 결과만 선별해 답변을 다시 쓴다', ['문항의 핵심 역량은 확인하지 않고, 성실함과 책임감 등 자신의 성격 장점을 여러 개 나열해 분량을 채운다', '지원처 홈페이지의 사업 소개와 인재상을 그대로 옮긴 뒤, 마지막에 입사 의지를 한 문장 덧붙인다', '문항과 직접 관련이 없어도 좋은 평가를 받았던 수상·자격·봉사 경력을 빠짐없이 넣어 답변을 늘린다']],
  target: ['현재 공식 공고와 직무 설명서에서 실제 업무와 필요 역량을 찾고, 자신의 준비 경험과 입사 후 첫 기여를 연결해 쓴다', ['회사의 규모와 복지, 안정성을 주로 칭찬하고 자신의 준비 경험은 성실하게 일하겠다는 약속으로 대신한다', '다른 회사에 제출한 글에서 기업명만 바꾸고, 사업·직무·필요 역량이 현재 공고와 같은지는 다시 확인하지 않는다', '구체적인 지원 직무를 정하지 않고 무엇이든 시키는 대로 하겠다고 쓴 뒤, 세부 준비는 입사 후에 하겠다고 마무리한다']],
  evidence: ['자신이 직접 한 행동과 사용한 판단 기준, 남아 있는 기록, 실행 전후의 변화를 사실대로 구분해 근거로 제시한다', ['팀이 만든 결과와 동료의 역할까지 모두 자신이 한 일처럼 합쳐 쓰고, 개인의 기여는 따로 구분하지 않는다', '정확한 작업일지나 수치 기록이 없지만 성과가 작아 보이지 않도록 기억에 의존해 개선 수치를 크게 적는다', '무엇을 어떻게 했는지는 빼고, 열심히 참여했고 끝까지 최선을 다했다는 태도 표현을 여러 문장으로 반복한다']],
  structure: ['상황과 과제는 핵심 조건만 짧게 적고, 자신의 판단·행동·확인 결과와 배운 점이 인과관계로 이어지게 배열한다', ['좋은 결과부터 강조한 뒤 배경과 원인, 행동을 순서 없이 섞어 적고, 마지막에 성실함을 다시 강조한다', '읽는 사람이 상황을 자세히 알아야 한다고 보고 장소·일정·팀원 소개에 대부분의 분량을 쓰며, 자신의 행동은 줄인다', '구체적인 사실과 행동은 면접에서 설명하기로 하고, 글에는 어려웠던 감정과 배운 점, 입사 후 다짐을 중심으로 길게 적는다']],
  ethics: ['작업일지나 결과물로 확인되는 사실만 쓰고, 학교명·지역·가족 등 블라인드 금지정보는 역량 근거를 남기며 제거한다', ['자신의 성실성을 쉽게 증명하기 위해 학교명과 담임교사의 실명, 선생님에게 받은 칭찬 내용을 답변에 구체적으로 넣는다', '성과 수치가 정확히 기억나지 않아도 대략 맞을 것으로 추정하고, 숫자 앞에 ‘약’을 붙이면 사실성을 지킨 것으로 보아 그대로 쓴다', '팀 활동을 더 설득력 있게 보이기 위해 친구가 수행한 핵심 행동과 팀 성과를 자신의 개인 경험으로 바꾸어 적는다']],
  polish: ['지원처·직무·문항 요구·글자 수·맞춤법·사실 근거를 체크표로 만들고, 본문과 제출 파일명까지 순서대로 다시 대조한다', ['자동 맞춤법 검사에서 오류가 없다면 내용도 충분히 검수된 것으로 보고, 지원처와 직무 정보는 다시 읽지 않고 바로 제출한다', '다른 기관명을 발견한 한 곳만 현재 지원처로 바꾸고, 사업·직무·입사 후 기여 문장은 앞서 검토했으므로 다시 확인하지 않는다', '권장 분량이 부족하면 지원 의지와 성실함을 표현한 문장을 여러 번 반복해 넣고, 자신의 행동과 결과는 현재 수준에서 유지한다']],
}

function buildCover() {
  const result = []
  for (const row of bySubject('cover-letter')) {
    const [correct, distractors] = COVER_BLUEPRINTS[row.key]
    for (let index = 0; index < additional(row.count); index++) {
      const id = `${PREFIX}COVER-${row.key}-${pad(index + 1, 3)}`
      const question = mcq({ id, area: row.key, stem: `${documents[index % documents.length]} 경험을 활용해 자기소개서의 '${row.key}' 항목을 고치는 학생에게 가장 적절한 조언은?`, correct, distractors, explanation: '좋은 자기소개서는 문항 요구와 지원처·직무를 정확히 읽고, 학생이 실제로 한 행동과 확인 가능한 결과를 사실대로 연결해야 합니다.' })
      result.push({ ...question, isPractical: true })
    }
  }
  return result
}

const ADAPT_ACTIONS = {
  problem: ['원인과 영향을 구분해 해결 순서를 정한다', '확인 가능한 자료를 찾아 판단을 고친다', '여러 대안을 비교한 뒤 실행안을 선택한다', '처리 결과를 다시 확인해 부족한 점을 보완한다'],
  growth: ['부족한 역량을 구체적으로 찾아 학습 계획을 세운다', '새로 배운 방법을 실제 과제에 적용해 본다', '피드백을 다음 업무의 행동으로 바꾼다', '미래에 필요한 기술을 예상해 미리 익힌다'],
  engagement: ['중요한 업무에 주의를 다시 모은다', '방해 요소를 줄이고 정한 시간 동안 집중한다', '과업 목적을 확인해 필요한 노력을 이어 간다', '반복 업무에서도 정확성 기준을 유지한다'],
  completion: ['진행 상황과 남은 일을 점검해 기한 안에 마무리한다', '어려움이 생기면 가능한 대안을 찾아 끝까지 수행한다', '누락 여부를 확인한 뒤 결과를 제출한다', '지연 가능성을 미리 알리고 조정안을 제시한다'],
  interpersonal: ['상대의 말을 끝까지 듣고 의도를 확인한다', '의견이 달라도 사실과 감정을 구분해 예의를 지킨다', '상대의 입장을 고려해 표현을 조절한다', '불편해 보이는 이유를 조심스럽게 확인한다'],
  cooperation: ['공동 목표와 자신의 역할을 분명히 한다', '필요한 정보를 팀원에게 제때 공유한다', '역할 충돌을 조정해 함께 실행할 방법을 찾는다', '공동 결과의 문제를 함께 해결한다'],
  empathy: ['표정과 말투를 살펴 상대의 감정을 이해한다', '감정과 요구를 구분해 필요한 반응을 고른다', '내 말이 상대에게 미칠 영향을 생각한다', '동료의 어려움에 상황에 맞게 공감한다'],
  regulation: ['감정적으로 반응하기 전에 생각할 시간을 갖는다', '긴장해도 해야 할 절차에 다시 집중한다', '실수한 뒤 해결 방법과 회복 행동을 찾는다', '비판에서 필요한 내용을 골라 받아들인다'],
  understanding: ['규정과 권한 범위를 확인한 뒤 업무를 처리한다', '내 업무가 다른 부서와 연결되는 과정을 살핀다', '공식 소통 경로로 필요한 내용을 전달한다', '업무 변화가 조직 전체에 미칠 영향을 고려한다'],
  commitment: ['조직과 동료에게 약속한 책임을 다한다', '조직의 목표를 자신의 업무 계획에 반영한다', '발견한 문제를 적절한 경로로 개선 제안한다', '공동 성과에 필요한 일에 적극 참여한다'],
  acceptance: ['변화의 이유와 영향을 이해한 뒤 계획을 조정한다', '새 규정과 도구를 배우기 위한 노력을 시작한다', '변화의 장점과 어려움을 함께 살핀다', '낯선 환경에서 필요한 정보를 찾아 적응한다'],
  initiative: ['더 나은 방법의 근거를 정리해 제안한다', '작은 개선을 직접 시도하고 결과를 확인한다', '새로운 역할에 도전할 기회를 찾는다', '좋은 사례를 자신의 업무에 맞게 적용한다'],
}
const ADAPT_NEGATIVE_ACTIONS = {
  problem: ['원인을 확인하기 전에 눈앞의 일부터 처리한다', '자료를 찾지 않고 처음 생각한 원인을 확정한다', '다른 대안을 비교하지 않고 첫 방법을 고른다', '일을 끝낸 뒤 결과를 다시 확인하지 않는다'],
  growth: ['부족한 점을 알아도 별도 학습 계획을 세우지 않는다', '새로 배운 방법을 실제 과제에는 적용하지 않는다', '피드백을 받아도 하던 방식만 유지한다', '새 기술은 꼭 필요해진 뒤에 배우면 된다고 생각한다'],
  engagement: ['중요한 업무 중에도 다른 일에 쉽게 주의가 흐트러진다', '방해 요소를 줄이지 못해 집중 시간을 지키지 못한다', '과업 목적이 바로 이해되지 않으면 노력을 멈춘다', '반복 업무에서는 정확성 확인을 자주 생략한다'],
  completion: ['남은 일을 점검하지 않아 마감을 자주 놓친다', '어려움이 생기면 끝낼 다른 방법을 찾지 않는다', '거의 끝난 일은 누락 점검 없이 제출한다', '지연 가능성을 마지막 순간까지 알리지 않는다'],
  interpersonal: ['상대의 말이 끝나기 전에 내 생각부터 말한다', '의견이 다르면 사실보다 감정으로 반응한다', '내 말이 맞으면 상대가 받아들이는 방식은 중요하지 않다고 생각한다', '상대가 불편해 보여도 이유를 확인하지 않는다'],
  cooperation: ['다른 사람이 정해 줄 때까지 내 역할을 찾지 않는다', '중요한 정보도 요청받기 전에는 공유하지 않는다', '역할 충돌이 생기면 각자 알아서 해결해야 한다고 생각한다', '공동 결과의 문제를 담당자 개인 책임으로만 돌린다'],
  empathy: ['상대가 직접 말하지 않으면 감정을 살필 필요가 없다고 생각한다', '상대가 감정적으로 말하면 요구 내용도 듣지 않는다', '의도가 좋았다면 상대가 상처받아도 어쩔 수 없다고 생각한다', '동료의 어려움에 반응하는 일을 피한다'],
  regulation: ['기분이 상하면 바로 말과 행동으로 드러낸다', '긴장하면 알고 있던 절차도 이어가기 어렵다', '실수한 뒤 자책만 하며 해결 행동을 미룬다', '비판을 받으면 내용보다 감정에 오래 머문다'],
  understanding: ['결과만 좋으면 규정과 권한은 생략해도 된다고 생각한다', '내 업무만 끝나면 다른 부서와의 연결은 확인하지 않는다', '중요한 내용도 가까운 사람에게만 말하면 충분하다고 생각한다', '내 업무가 편해지면 다른 부서 영향은 고려하지 않는다'],
  commitment: ['조직 결과보다 나에게 주어진 최소한의 일만 한다', '조직 목표는 관리자만 신경 쓰면 된다고 생각한다', '조직의 문제를 발견해도 내 책임이 아니면 말하지 않는다', '직접 보상이 없는 공동 활동에는 참여하지 않는다'],
  acceptance: ['익숙한 방식이 바뀌면 이유와 관계없이 거부한다', '새 규정은 다른 사람이 익힌 뒤 알려 줄 때까지 기다린다', '변화는 문제만 만든다고 생각해 장점을 살피지 않는다', '낯선 환경에서는 누가 자세히 알려 주기 전까지 움직이지 않는다'],
  initiative: ['현재 방식에 큰 문제가 없으면 개선할 필요가 없다고 생각한다', '좋은 아이디어가 있어도 실패가 두려워 시도하지 않는다', '해 본 적 없는 역할은 가능한 한 피한다', '다른 사람의 좋은 사례는 내 상황과 다르다며 참고하지 않는다'],
}
const ADAPT_FACTORS = { problem: 'work', growth: 'work', engagement: 'motivation', completion: 'motivation', interpersonal: 'relationship', cooperation: 'relationship', empathy: 'emotion', regulation: 'emotion', understanding: 'organization', commitment: 'organization', acceptance: 'change', initiative: 'change' }
const adaptSituations = ['예상하지 못한 문제가 생겨도', '일정이 촉박한 업무에서도', '처음 맡은 과제를 수행할 때', '동료와 함께 일하는 동안', '결과가 기대와 다를 때', '업무 방식이 갑자기 바뀌어도']

function buildJobAdaptation() {
  const result = []
  for (const [subscale, actions] of Object.entries(ADAPT_ACTIONS)) {
    for (let pair = 0; pair < 12; pair++) {
      const situation = adaptSituations[pair % adaptSituations.length]
      const actionIndex = Math.floor(pair / adaptSituations.length) % actions.length
      const action = actions[actionIndex]
      const negative = ADAPT_NEGATIVE_ACTIONS[subscale][actionIndex]
      const base = `${PREFIX}JA-${subscale}-${pad(pair + 1, 2)}`
      result.push({ id: `${base}P`, kind: 'trait', factor: ADAPT_FACTORS[subscale], subscale, direction: 1, pair: `${base}R`, text: `${situation} ${action}.`, generationLane: 'independent-blueprint' })
      result.push({ id: `${base}R`, kind: 'trait', factor: ADAPT_FACTORS[subscale], subscale, direction: -1, pair: `${base}P`, text: `${situation} ${negative}.`, generationLane: 'independent-blueprint' })
    }
  }
  const impressionBehaviours = ['실수한다', '약속을 잊는다', '짜증을 낸다', '도움을 미룬다', '규칙을 잘못 이해한다', '집중이 흐트러진다', '부정적인 생각을 한다', '다른 사람을 부러워한다']
  for (let index = 0; index < 16; index++) result.push({ id: `${PREFIX}JA-IM-${pad(index + 1, 2)}`, kind: 'impression', text: `나는 ${index < 8 ? '지금까지 어떤 상황에서도' : '학습이나 업무를 하는 동안에도'} ${impressionBehaviours[index % impressionBehaviours.length]}는 일이 단 한 번도 없었다.`, generationLane: 'independent-blueprint' })
  for (let index = 0; index < 16; index++) {
    const expected = index % 2 ? 1 : 5
    result.push({ id: `${PREFIX}JA-AT-${pad(index + 1, 2)}`, kind: 'attention', expected, text: `응답 확인 문항 ${index + 1}입니다. 이 문항에는 ${expected === 5 ? '가장 오른쪽의 5번' : '가장 왼쪽의 1번'}을 선택해 주세요.`, generationLane: 'independent-blueprint' })
  }
  return result
}

const PERSONALITY_ACTIONS = {
  CO: [['계획과 마감을 확인해 맡은 일을 꼼꼼히 끝낸다', '계획 없이 시작하고 마감 점검을 자주 놓친다'], ['작은 오류도 기록해 바로잡는다', '오류를 발견해도 결과에 영향이 작으면 넘긴다'], ['약속한 역할을 책임 있게 수행한다', '어려운 역할은 다른 사람이 맡기를 기다린다']],
  ES: [['긴장되는 상황에서도 감정을 조절해 해야 할 일에 집중한다', '긴장하면 감정에 휩쓸려 해야 할 일을 이어가기 어렵다'], ['비판을 들어도 필요한 내용을 골라 받아들인다', '비판을 받으면 내용보다 감정이 오래 남는다'], ['실수 뒤 해결 방법을 찾아 다시 시도한다', '실수하면 자책하느라 다음 행동을 미룬다']],
  EX: [['처음 만난 사람에게도 필요한 업무 대화를 시작한다', '처음 만난 사람과의 업무 대화를 가능한 피한다'], ['의견이 필요할 때 분명하게 표현한다', '의견이 있어도 주목받을까 봐 말하지 않는다'], ['공동 활동에 에너지를 갖고 참여한다', '여럿이 함께하는 활동에서 쉽게 지친다']],
  AG: [['상대의 입장을 듣고 함께 실행할 방법을 찾는다', '의견이 다르면 상대의 이유를 듣지 않는다'], ['동료가 어려울 때 가능한 범위에서 돕는다', '내 일이 아니면 동료의 어려움에 관여하지 않는다'], ['갈등 중에도 예의와 존중을 지킨다', '내 주장이 맞다고 생각하면 말투는 중요하지 않다']],
  OP: [['새로운 방법의 장단점을 살펴 직접 시험해 본다', '익숙하지 않은 방법은 검토하지 않고 피한다'], ['궁금한 주제의 원리와 배경을 찾아본다', '당장 필요한 내용 외에는 알아볼 필요가 없다고 생각한다'], ['다른 관점에서 문제를 다시 바라본다', '처음 정한 관점을 바꾸는 것을 불편해한다']],
  IN: [['규정과 안전 기준을 지키며 사실대로 기록한다', '결과만 좋으면 절차 위반은 숨겨도 된다고 생각한다'], ['개인정보와 조직 자산을 정해진 권한 안에서 다룬다', '업무가 편해진다면 공용 계정을 함께 써도 된다고 생각한다'], ['불리한 결과도 누락하지 않고 보고한다', '평가에 불리한 정보는 기록에서 빼는 편이 낫다고 생각한다']],
}
const personalitySituations = ['새로운 과제를 맡았을 때', '일정이 촉박할 때', '동료와 의견이 다를 때', '혼자 판단해야 할 때', '반복되는 업무를 할 때', '예상하지 못한 오류가 생겼을 때', '피드백을 받은 뒤', '공동 목표를 수행할 때', '낯선 환경에 들어갔을 때', '결과를 제출하기 직전에']
const personalityModifiers = ['차분히', '가능한 한 꾸준히', '필요한 근거를 확인하며', '다른 사람의 영향도 살피며', '정한 기준에 따라', '끝까지 책임 있게']

function buildPersonality() {
  const result = []
  const rows = bySubject('personality')
  for (const row of rows.filter(item => item.key.startsWith('trait > '))) {
    const dim = row.key.split(' > ')[1]
    const target = additional(row.count)
    const pairTarget = target / 2
    const actions = PERSONALITY_ACTIONS[dim]
    for (let pair = 0; pair < pairTarget; pair++) {
      const situation = personalitySituations[pair % personalitySituations.length]
      const actionIndex = Math.floor(pair / personalitySituations.length) % actions.length
      const modifierIndex = Math.floor(pair / (personalitySituations.length * actions.length)) % personalityModifiers.length
      const [positive, negative] = actions[actionIndex]
      const modifier = personalityModifiers[modifierIndex]
      const base = `${PREFIX}PS-${dim}-${pad(pair + 1)}`
      result.push({ id: `${base}P`, dim, kind: 'trait', reverse: false, pair: `${base}R`, text: `${situation} ${modifier} ${positive}.`, generationLane: 'independent-blueprint' })
      result.push({ id: `${base}R`, dim, kind: 'trait', reverse: true, pair: `${base}P`, text: `${situation} ${modifier} ${negative}.`, generationLane: 'independent-blueprint' })
    }
  }
  const lieCount = additional(rows.find(row => row.key === 'lie > LIE')?.count || 0)
  const lieActions = ['약속을 어긴', '실수한', '화를 낸', '일을 미룬', '불평한', '규칙을 잘못 이해한', '집중하지 못한', '다른 사람을 부러워한', '사실을 잘못 기억한', '도움을 거절한']
  for (let index = 0; index < lieCount; index++) result.push({ id: `${PREFIX}PS-L-${pad(index + 1)}`, dim: 'LIE', kind: 'lie', reverse: false, text: `나는 ${personalitySituations[index % personalitySituations.length]}에도 ${lieActions[Math.floor(index / personalitySituations.length) % lieActions.length]} 적이 단 한 번도 없다.`, generationLane: 'independent-blueprint' })
  const infrequencyCount = additional(rows.find(row => row.key === 'infrequency > INFREQ')?.count || 0)
  const trueStatements = ['일주일은 7일이다', '사람은 숨을 쉬어야 살아갈 수 있다', '시간이 지나면 나이를 먹는다', '물체는 공간을 차지한다', '한 시간은 60분이다', '일을 시작한 뒤에야 일을 끝낼 수 있다', '두 수를 더한 값은 더하는 순서를 바꿔도 같다', '문서를 읽으려면 글자나 대체 정보를 확인해야 한다', '물은 낮은 곳으로 흐를 수 있다', '사람은 잠을 자지 않으면 피로를 느낄 수 있다', '달력의 날짜는 하루가 지나면 바뀔 수 있다', '소리를 들으려면 귀나 보조 장치가 필요하다', '같은 물건을 두 번 세면 수량이 달라질 수 있다', '작업 결과는 확인하기 전에는 오류 여부를 단정할 수 없다', '사람마다 생각과 경험이 다를 수 있다', '기록을 남기면 나중에 내용을 다시 확인할 수 있다']
  const falseStatements = ['나는 한 번도 잠을 잔 적이 없다', '물과 음식을 전혀 먹지 않아도 계속 살 수 있다', '나는 눈을 감아도 모든 글자를 똑같이 읽을 수 있다', '하루는 언제나 100시간이다', '나는 태어난 뒤 한 번도 숨을 쉰 적이 없다', '모든 물체는 항상 위로 떨어진다', '나는 어떤 소리도 듣지 않고 모든 대화를 정확히 안다', '나는 한 번도 기억을 잊은 적이 없다', '나는 빛이 전혀 없는 곳에서도 모든 색을 정확히 구별한다', '나는 시간을 거꾸로 돌려 어제의 일을 바꿀 수 있다', '나는 어떤 도구도 없이 벽을 통과할 수 있다', '나는 물속에서 장비 없이 며칠 동안 계속 숨을 쉴 수 있다', '나는 한 번 읽은 모든 문장을 평생 한 글자도 틀리지 않고 기억한다', '나는 동시에 서로 다른 두 장소에 있을 수 있다', '나는 잠을 자는 동안에도 모든 주변 대화를 정확히 기록한다', '나는 어떤 계산이든 숫자를 보지 않고 항상 맞힐 수 있다']
  for (let index = 0; index < infrequencyCount; index++) {
    const agree = index % 2 === 0
    const statements = agree ? trueStatements : falseStatements
    result.push({ id: `${PREFIX}PS-X-${pad(index + 1)}`, dim: 'INFREQ', kind: 'infrequency', reverse: false, expected: agree ? 'agree' : 'disagree', text: `${statements[Math.floor(index / 2) % statements.length]}.`, generationLane: 'independent-blueprint' })
  }
  return result
}

const subjects = {
  'job-common': buildJobCommon(),
  'ncs-basic': buildNcs(),
  'recruit-written': buildRecruit(),
  interview: buildInterview(),
  'cover-letter': buildCover(),
  'job-adaptation': buildJobAdaptation(),
  personality: buildPersonality(),
}

const output = {
  meta: {
    schemaVersion: 1,
    generatedPrefix: PREFIX,
    generatedOn: '2026-09-04',
    blueprintVersion: META.blueprintVersion,
    target: 'add two independently authored items for every baseline item so each assessment pool reaches 300%',
    sourcePolicy: 'Only framework, competency labels, lesson labels, organization metadata, and baseline counts are inputs. Existing stems, contexts, choices, answers, and explanations are never generation inputs.',
  },
  subjects,
}

for (const [subject, questions] of Object.entries(subjects)) {
  const expected = additional(baseline[`${subject}Total`] || 0)
  if (questions.length !== expected) throw new Error(`${subject}: generated ${questions.length}, expected ${expected}`)
  const ids = new Set(questions.map(question => question.id))
  if (ids.size !== questions.length) throw new Error(`${subject}: duplicate generated ids`)
  console.log(`${subject}: baseline ${expected / 2} + new ${questions.length} = ${expected * 1.5} (300%)`)
}

const targetDir = resolve('data/assessment-banks')
await mkdir(targetDir, { recursive: true })
for (const [subject, questions] of Object.entries(subjects)) {
  const target = resolve(targetDir, `${subject}.json`)
  await writeFile(target, `${JSON.stringify({ meta: output.meta, questions }, null, 2)}\n`, 'utf8')
  console.log(`independent assessment bank written: ${target}`)
}
