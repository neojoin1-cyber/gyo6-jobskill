import fs from 'node:fs'

const file = new URL('../data/questions.json', import.meta.url)
const questions = JSON.parse(fs.readFileSync(file, 'utf8'))

const FORMULA_EXPLANATIONS = {
  'C10-9-Q01': '정답은 3번 40%임. 구성비 = 해당 값 ÷ 전체 합계 × 100이므로 800 ÷ 2,000 × 100 = 40%임. 1번과 2번은 전체 2,000을 기준으로 계산한 값이 아님.',
  'C10-9-Q02': '정답은 3번 25%임. 증가량은 500 - 400 = 100명이고, 증감률 = 증가량 ÷ 전분기 값 × 100이므로 100 ÷ 400 × 100 = 25%임. 5번 100명은 증가량이지 증감률이 아님.',
  'C10-9-Q03': '정답은 3번 20%임. 구성비 = 80 ÷ 400 × 100 = 20%임. 전산팀 처리 건수 80건과 전체 400건을 각각 분자와 분모로 사용해야 함.',
  'C10-9-Q04': '정답은 1번 -10%임. 증감량은 270 - 300 = -30명이고, 증감률 = -30 ÷ 300 × 100 = -10%임. 2번 -30명은 증감량이며 비율이 아님.',
  'C10-9-Q05': '정답은 2번 -10%임. 증감량은 45 - 50 = -5건이고, 증감률 = -5 ÷ 50 × 100 = -10%임. 기준값은 전월인 2월 50건임.',
  'C10-9-Q06': '정답은 3번 20%임. 증가액은 240 - 200 = 40천 원이고, 증감률 = 40 ÷ 200 × 100 = 20%임. 1번 40천 원은 증가액이지 증감률이 아님.',
  'C10-9-Q07': '정답은 4번 33%임. 구성비 = 100 ÷ 300 × 100 = 33.3%이므로 보기에서는 약 33%를 선택함. B팀 값 100건을 전체 300건과 비교해야 함.',
  'C26-25-Q01': '정답은 3번 3,500만 원임. 평균 = 합계 ÷ 자료 수이므로 (3,000 + 3,200 + 3,500 + 3,800 + 4,000) ÷ 5 = 17,500 ÷ 5 = 3,500임.',
  'C26-25-Q02': '정답은 3번 100건임. 자료를 80, 90, 100, 110, 120 순으로 배열하면 자료 수 5개이므로 중앙 위치 = (5 + 1) ÷ 2 = 3번째임. 세 번째 값이 100이므로 중앙값은 100건임.',
  'C26-25-Q03': '정답은 3번 25%임. 증가량은 125 - 100 = 25개이고, 증가율 = 25 ÷ 100 × 100 = 25%임. 증가 후 값 125를 기준값으로 나누지 않도록 주의함.',
  'C26-25-Q04': '정답은 3번 25%임. A공정 불량 구성비 = 50 ÷ 200 × 100 = 25%임. 분모는 A공정 수량이 아니라 전체 불량 200건임.',
  'C26-25-Q05': '정답은 5번 80억 원임. A사 연간 매출은 150 + 180 + 160 + 190 = 680억 원, B사는 120 + 140 + 160 + 180 = 600억 원임. 따라서 차이는 680 - 600 = 80억 원임.',
  'C26-25-Q06': '정답은 2번 200명임. 작년 직원 수를 x명이라 하면 x × 1.15 = 230이므로 x = 230 ÷ 1.15 = 200명임. 현재 인원에서 15%를 단순 차감하면 안 됨.',
}

const AREA_REASON = {
  '의사소통능력': '지문의 목적·요청·기한·강조 표현을 보기와 직접 대조함',
  '수리능력': '구하려는 값과 기준값, 단위를 먼저 구분한 뒤 식을 세움',
  '문제해결능력': '원인·제약·위험도·실행 가능성을 함께 비교함',
  '자원관리능력': '긴급도와 중요도, 사용할 수 있는 자원과 제약을 함께 비교함',
  '정보능력': '목적 적합성·공식성·최신성·검증 가능성 순으로 자료를 판단함',
  '기술능력': '업무 목적을 달성하면서 안전·보안·표준 절차를 지키는지 확인함',
  '조직이해능력': '회사 목표·부서 역할·개인 업무·성과지표의 연결을 확인함',
  '대인관계능력': '상대의 요구와 공동 목표를 확인하고 존중·협업 원칙을 적용함',
  '자기개발능력': '현재 수준과 목표의 차이를 확인하고 실행·점검 가능한 계획을 선택함',
  '직업윤리': '정직·책임·공정·정보보호 원칙과 회사 규정을 함께 적용함',
}

function compact(text, max = 74) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean
}

function numberOptionReferences(text) {
  return String(text || '')
    .replace(/\b([A-E])번/g, (_, letter) => `${letter.charCodeAt(0) - 64}번`)
    .replace(/(^|[\s(])([A-E])(은|는|이|가|의|와|과|도)(?=[\s,.'"”)\]]|$)/g,
      (_, lead, letter, particle) => `${lead}${letter.charCodeAt(0) - 64}번${particle}`)
}

function buildStructuredExplanation(q) {
  const correctIndex = 'ABCDE'.indexOf(q.answer)
  if (correctIndex < 0 || !Array.isArray(q.choices) || !q.choices[correctIndex]) {
    return numberOptionReferences(q.explanation)
  }
  const correct = compact(q.choices[correctIndex], 100)
  const wrong = q.choices
    .map((choice, index) => ({ choice, index }))
    .filter(item => item.index !== correctIndex)
    .slice(0, 2)
    .map(item => `${item.index + 1}번 '${compact(item.choice)}'`)
    .join('과 ')
  const reason = AREA_REASON[q.area] || '지문의 핵심 조건을 보기와 하나씩 대조함'
  return `정답은 ${correctIndex + 1}번 '${correct}'임. 판단 근거: ${reason}. 이 기준을 지문에 적용하면 ${correctIndex + 1}번만 핵심 조건을 모두 충족함. 오답 점검: ${wrong}은 일부 단서만 반영하거나 핵심 조건과 어긋남.`
}

let templated = 0
let relabeled = 0
for (const q of questions) {
  if (FORMULA_EXPLANATIONS[q.id]) {
    q.explanation = FORMULA_EXPLANATIONS[q.id]
    templated += 1
    continue
  }
  if (/핵심 질문은|분리해 계산하면/.test(q.explanation || '')) {
    q.explanation = buildStructuredExplanation(q)
    templated += 1
    continue
  }
  const normalized = numberOptionReferences(q.explanation)
  if (normalized !== q.explanation) {
    q.explanation = normalized
    relabeled += 1
  }
}

fs.writeFileSync(file, `${JSON.stringify(questions, null, 2)}\n`)
console.log(`직업공통능력 해설 정비: 생성형 ${templated}건, 선택지 표기 ${relabeled}건`)
