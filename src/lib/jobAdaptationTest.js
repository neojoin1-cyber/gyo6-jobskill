// 교육부·대한상공회의소 직업공통능력 인증진단의 직무적응 평가틀을
// 연습하기 위한 비공식 자가진단. 정답을 만들거나 공식 등급을 예측하지 않는다.
import independentAssessmentBank from '../../data/assessment-banks/job-adaptation.json'

export const JOB_ADAPTATION_SCALE = {
  labels: ['전혀 그렇지 않다', '그렇지 않은 편이다', '보통이다', '그런 편이다', '매우 그렇다'],
}
export const JOB_ADAPTATION_FACTORS = [
  { key: 'work', name: '업무능력', subscales: ['problem', 'growth'] },
  { key: 'motivation', name: '업무동기', subscales: ['engagement', 'completion'] },
  { key: 'relationship', name: '관계적응', subscales: ['interpersonal', 'cooperation'] },
  { key: 'emotion', name: '정서적응', subscales: ['empathy', 'regulation'] },
  { key: 'organization', name: '조직적응', subscales: ['understanding', 'commitment'] },
  { key: 'change', name: '변화적응', subscales: ['acceptance', 'initiative'] },
]

const SUBSCALES = {
  problem: {
    name: '문제처리',
    factor: 'work',
    pairs: [
      ['문제가 생기면 원인과 영향을 먼저 정리한다.', '문제가 생기면 원인을 살피기보다 눈앞의 일부터 처리한다.'],
      ['여러 해결 방법을 비교한 뒤 가장 적절한 방법을 고른다.', '처음 떠오른 해결 방법을 다른 대안과 비교하지 않고 선택한다.'],
      ['어려운 업무도 작은 단계로 나누어 처리한다.', '업무가 복잡해지면 어디서부터 시작할지 몰라 손을 놓는 편이다.'],
      ['처리 결과를 확인하고 부족한 점을 다시 고친다.', '일을 끝낸 뒤 결과가 적절한지 다시 확인하지 않는 편이다.'],
      ['필요한 정보와 도움을 찾아 문제를 해결한다.', '모르는 일이 생겨도 정보나 도움을 찾지 않고 혼자 추측한다.'],
      ['예상하지 못한 문제가 생겨도 계획을 조정해 대응한다.', '계획과 다른 상황이 생기면 하던 일을 계속하기 어렵다.'],
    ],
  },
  growth: {
    name: '전문성추구',
    factor: 'work',
    pairs: [
      ['잘 모르는 업무는 자료를 찾아 스스로 학습한다.', '현재 아는 정도면 충분하다고 생각해 추가로 배우지 않는 편이다.'],
      ['피드백을 받으면 다음 업무에 구체적으로 반영한다.', '피드백을 들어도 기존 방식대로 계속하는 편이다.'],
      ['업무 능력을 높이기 위한 목표를 세우고 실천한다.', '업무 능력 향상을 위한 별도의 목표를 세우지 않는다.'],
      ['새로운 지식이나 기술을 익힐 기회를 적극 활용한다.', '새로운 교육이나 학습 기회가 있어도 피하는 편이다.'],
      ['내가 부족한 부분을 파악하고 보완 방법을 찾는다.', '부족한 부분을 알게 되어도 특별히 보완하려 하지 않는다.'],
      ['배운 내용을 실제 과제나 업무에 적용해 본다.', '새로 배운 내용은 실제 업무와 별개라고 생각하는 편이다.'],
    ],
  },
  engagement: {
    name: '과업몰입',
    factor: 'motivation',
    pairs: [
      ['맡은 일을 하는 동안 중요한 부분에 집중한다.', '업무를 시작해도 다른 일에 쉽게 주의가 흐트러진다.'],
      ['과업의 목적을 이해하고 필요한 노력을 기울인다.', '왜 해야 하는지 이해되지 않으면 과업에 집중하기 어렵다.'],
      ['해야 할 일의 우선순위를 정해 시간을 배분한다.', '급하지 않은 일부터 하다가 중요한 일을 늦추는 경우가 많다.'],
      ['반복되는 업무에서도 정확성을 유지하려 노력한다.', '반복되는 업무는 지루해서 대충 처리하는 편이다.'],
      ['과업을 수행할 때 필요한 준비를 미리 한다.', '업무를 시작할 때가 되어서야 필요한 준비물을 찾는 편이다.'],
      ['방해 요소가 있어도 다시 업무에 집중할 수 있다.', '한번 집중이 깨지면 다시 업무로 돌아오기 어렵다.'],
    ],
  },
  completion: {
    name: '과업완수',
    factor: 'motivation',
    pairs: [
      ['맡은 일은 정해진 기한 안에 끝내려고 한다.', '기한이 남아 있으면 해야 할 일을 자주 미루는 편이다.'],
      ['어려움이 있어도 가능한 방법을 찾아 끝까지 수행한다.', '과업이 예상보다 어려우면 쉽게 포기하는 편이다.'],
      ['진행 상황을 확인하며 완료까지 필요한 일을 조정한다.', '시작한 뒤에는 완료 시점까지 진행 상황을 잘 확인하지 않는다.'],
      ['마무리 단계에서 누락된 일이 없는지 점검한다.', '일을 거의 끝내면 마지막 점검은 생략해도 된다고 생각한다.'],
      ['약속한 결과의 품질을 지키기 위해 끝까지 노력한다.', '기한만 맞출 수 있다면 결과의 완성도는 낮아도 괜찮다고 생각한다.'],
      ['예상보다 시간이 더 필요하면 미리 알리고 대안을 제시한다.', '기한을 맞추기 어려워도 마지막 순간까지 알리지 않는 편이다.'],
    ],
  },
  interpersonal: {
    name: '대인관계',
    factor: 'relationship',
    pairs: [
      ['상대방의 말을 끝까지 듣고 의도를 확인한다.', '상대방의 말을 다 듣기 전에 내 생각부터 말하는 편이다.'],
      ['의견이 다른 사람에게도 예의를 지키며 설명한다.', '의견이 다르면 말투가 거칠어지는 편이다.'],
      ['도움이 필요한 동료에게 가능한 범위에서 지원한다.', '내 일이 아니면 동료의 어려움에 관심을 두지 않는 편이다.'],
      ['상대의 입장을 고려해 적절한 표현을 선택한다.', '내 말이 맞다면 상대가 어떻게 받아들이는지는 중요하지 않다고 생각한다.'],
      ['갈등이 생기면 사실과 감정을 구분해 대화한다.', '갈등이 생기면 대화를 피하거나 감정적으로 반응하는 편이다.'],
      ['낯선 사람과도 업무에 필요한 관계를 형성할 수 있다.', '처음 만난 사람과 업무 대화를 시작하는 것이 매우 어렵다.'],
    ],
  },
  cooperation: {
    name: '협동지향',
    factor: 'relationship',
    pairs: [
      ['공동 목표를 위해 내 역할과 책임을 분명히 한다.', '팀 과제에서는 다른 사람이 정해 주기 전까지 내 역할을 찾지 않는다.'],
      ['팀의 진행 상황에 맞춰 내 업무 방식을 조정한다.', '팀의 상황보다 내가 편한 방식대로 일하는 것이 중요하다.'],
      ['필요한 정보를 팀원들과 제때 공유한다.', '내가 가진 정보는 요청받기 전에는 공유하지 않는 편이다.'],
      ['팀원이 낸 좋은 의견을 인정하고 활용한다.', '내 의견이 채택되지 않으면 팀 활동에 의욕이 떨어진다.'],
      ['공동 결과에 문제가 생기면 함께 해결책을 찾는다.', '팀 결과의 문제는 담당한 사람만 책임져야 한다고 생각한다.'],
      ['의견을 조율해 모두가 실행할 수 있는 방법을 찾는다.', '의견 차이가 있으면 내 의견을 따르게 하는 편이 효율적이라고 생각한다.'],
    ],
  },
  empathy: {
    name: '감정이해',
    factor: 'emotion',
    pairs: [
      ['표정과 말투를 살펴 상대의 감정을 파악한다.', '상대가 직접 말하지 않으면 감정을 고려할 필요가 없다고 생각한다.'],
      ['상대가 불편해 보이면 이유를 조심스럽게 확인한다.', '상대가 불편해 보여도 업무와 관계없다면 지나치는 편이다.'],
      ['상대의 상황을 이해한 뒤 적절한 반응을 보인다.', '상대의 상황보다 사실만 정확히 전달하면 충분하다고 생각한다.'],
      ['내 말과 행동이 다른 사람에게 미칠 영향을 생각한다.', '말한 의도가 좋았다면 상대가 상처받아도 어쩔 수 없다고 생각한다.'],
      ['동료의 기쁨이나 어려움에 알맞게 공감한다.', '다른 사람의 감정에 반응하는 일이 어색해 피하는 편이다.'],
      ['감정과 요구를 구분해 상대가 원하는 바를 파악한다.', '상대가 감정적으로 말하면 내용까지 들을 필요가 없다고 생각한다.'],
    ],
  },
  regulation: {
    name: '자기조절',
    factor: 'emotion',
    pairs: [
      ['화가 나도 바로 반응하지 않고 생각할 시간을 갖는다.', '기분이 상하면 말이나 행동으로 바로 드러나는 편이다.'],
      ['긴장되는 상황에서도 해야 할 일에 집중하려 한다.', '긴장하면 알고 있던 절차도 제대로 수행하기 어렵다.'],
      ['내 감정이 생긴 원인을 돌아보고 조절한다.', '기분이 나빠지면 원인을 생각하기보다 주변 사람에게 표현한다.'],
      ['실수했을 때 자책만 하기보다 해결 방법을 찾는다.', '실수하면 오래 마음에 담아 다음 일에도 집중하기 어렵다.'],
      ['비판을 들어도 필요한 내용을 골라 받아들인다.', '비판을 받으면 내용보다 나를 싫어한다고 느끼는 편이다.'],
      ['스트레스가 높을 때 나에게 맞는 회복 방법을 사용한다.', '스트레스를 받아도 참고 버티는 것 외에는 방법이 없다고 생각한다.'],
    ],
  },
  understanding: {
    name: '조직이해',
    factor: 'organization',
    pairs: [
      ['업무를 시작하기 전에 조직의 규정과 절차를 확인한다.', '결과만 좋으면 조직의 절차는 상황에 따라 무시해도 된다고 생각한다.'],
      ['내 업무가 다른 부서와 어떻게 연결되는지 이해하려 한다.', '내가 맡은 부분만 끝내면 다른 부서의 과정은 알 필요가 없다고 생각한다.'],
      ['보고와 의사결정의 권한 범위를 확인한다.', '급한 일은 권한이나 보고 절차를 확인하지 않고 처리하는 편이다.'],
      ['조직의 목표를 내 업무 계획에 반영한다.', '조직의 목표는 관리자만 신경 쓰면 된다고 생각한다.'],
      ['공식적인 소통 경로를 활용해 필요한 내용을 전달한다.', '중요한 내용도 가까운 사람에게만 말하면 충분하다고 생각한다.'],
      ['업무 변화가 조직 전체에 미칠 영향을 고려한다.', '내 업무가 편해진다면 다른 부서에 미치는 영향은 중요하지 않다.'],
    ],
  },
  commitment: {
    name: '조직몰입',
    factor: 'organization',
    pairs: [
      ['소속된 조직의 구성원으로서 맡은 책임을 다하려 한다.', '조직의 결과보다 내게 주어진 최소한의 일만 하는 편이다.'],
      ['조직이 중요하게 여기는 가치를 이해하려 한다.', '조직의 가치나 문화는 업무 성과와 관계없다고 생각한다.'],
      ['조직의 성과에 도움이 되는 일이라면 적극 참여한다.', '직접적인 보상이 없는 조직 활동에는 참여하고 싶지 않다.'],
      ['조직의 문제를 발견하면 적절한 경로로 개선을 제안한다.', '조직의 문제를 발견해도 내 책임이 아니면 말하지 않는 편이다.'],
      ['동료와 조직에 대한 약속을 지키려고 노력한다.', '상황이 불편해지면 조직과의 약속은 바뀔 수 있다고 생각한다.'],
      ['조직의 성장을 내 성장과 연결해 생각한다.', '개인의 성장과 조직의 성장은 서로 관계가 없다고 생각한다.'],
    ],
  },
  acceptance: {
    name: '변화수용',
    factor: 'change',
    pairs: [
      ['업무 방식이 바뀌면 변화의 이유부터 이해하려 한다.', '익숙한 방식이 바뀌면 이유와 관계없이 거부감이 먼저 든다.'],
      ['새로운 규정이나 도구를 배우기 위해 필요한 노력을 한다.', '새로운 도구는 다른 사람이 익힌 뒤 알려 줄 때까지 기다리는 편이다.'],
      ['변화로 생길 수 있는 장점과 어려움을 함께 살핀다.', '변화는 대부분 문제를 만들기 때문에 피하는 것이 낫다고 생각한다.'],
      ['다른 사람의 조언을 내 성장에 활용한다.', '내 방식에 대한 조언은 간섭처럼 느껴져 받아들이기 어렵다.'],
      ['상황이 달라지면 기존 계획을 유연하게 조정한다.', '한번 정한 계획은 상황이 달라져도 그대로 따라야 마음이 편하다.'],
      ['낯선 환경에서도 필요한 정보를 찾아 적응한다.', '환경이 낯설면 누군가 자세히 알려 주기 전에는 움직이기 어렵다.'],
    ],
  },
  initiative: {
    name: '변화추구',
    factor: 'change',
    pairs: [
      ['더 나은 업무 방법이 보이면 근거를 정리해 제안한다.', '현재 방법에 큰 문제가 없다면 개선할 필요가 없다고 생각한다.'],
      ['미래에 필요한 능력을 예상하고 미리 준비한다.', '새로운 능력은 꼭 필요해진 뒤에 배워도 늦지 않다고 생각한다.'],
      ['작은 개선이라도 직접 시도하고 결과를 확인한다.', '개선 아이디어가 있어도 실패할 수 있어 시도하지 않는 편이다.'],
      ['새로운 역할이나 과제에 도전할 기회를 찾는다.', '잘해 본 적 없는 역할은 가능한 한 맡지 않으려 한다.'],
      ['변화 과정에서 얻은 교훈을 다음 업무에 적용한다.', '변화가 끝나면 이전 과정은 다시 돌아볼 필요가 없다고 생각한다.'],
      ['주변의 좋은 사례를 찾아 내 업무에 맞게 활용한다.', '다른 사람의 업무 방식은 내 상황과 다르므로 참고하지 않는 편이다.'],
    ],
  },
}

const VALIDITY_ITEMS = [
  { id: 'JA-L01', kind: 'impression', text: '나는 지금까지 어떤 약속도 어긴 적이 없다.' },
  { id: 'JA-L02', kind: 'impression', text: '나는 누구에게도 짜증을 낸 적이 한 번도 없다.' },
  { id: 'JA-L03', kind: 'impression', text: '나는 해야 할 일을 단 한 번도 미룬 적이 없다.' },
  { id: 'JA-L04', kind: 'impression', text: '나는 모든 사람을 언제나 똑같이 좋아한다.' },
  { id: 'JA-L05', kind: 'impression', text: '나는 실수를 한 적이 전혀 없다.' },
  { id: 'JA-L06', kind: 'impression', text: '나는 어떤 상황에서도 화가 난 적이 없다.' },
  { id: 'JA-L07', kind: 'impression', text: '나는 다른 사람을 부러워한 적이 한 번도 없다.' },
  { id: 'JA-L08', kind: 'impression', text: '나는 규칙을 사소하게라도 어긴 적이 전혀 없다.' },
  { id: 'JA-A01', kind: 'attention', expected: 5, text: '응답 확인을 위해 이 문항에는 ‘매우 그렇다’를 선택해 주세요.' },
  { id: 'JA-A02', kind: 'attention', expected: 1, text: '응답 확인을 위해 이 문항에는 ‘전혀 그렇지 않다’를 선택해 주세요.' },
  { id: 'JA-A03', kind: 'attention', expected: 5, text: '이 문항은 집중 확인 문항입니다. 가장 오른쪽 응답을 선택해 주세요.' },
  { id: 'JA-A04', kind: 'attention', expected: 1, text: '이 문항은 집중 확인 문항입니다. 가장 왼쪽 응답을 선택해 주세요.' },
  { id: 'JA-A05', kind: 'attention', expected: 5, text: '문장을 읽었다면 이 문항에는 5번을 선택해 주세요.' },
  { id: 'JA-A06', kind: 'attention', expected: 1, text: '문장을 읽었다면 이 문항에는 1번을 선택해 주세요.' },
  { id: 'JA-A07', kind: 'attention', expected: 5, text: '성실 응답 확인을 위해 ‘매우 그렇다’를 선택해 주세요.' },
  { id: 'JA-A08', kind: 'attention', expected: 1, text: '성실 응답 확인을 위해 ‘전혀 그렇지 않다’를 선택해 주세요.' },
]

const TRAIT_ITEMS = Object.entries(SUBSCALES).flatMap(([subscale, spec]) =>
  spec.pairs.flatMap(([positive, reverse], pairIndex) => {
    const base = `JA-${subscale}-${String(pairIndex + 1).padStart(2, '0')}`
    return [
      { id: `${base}P`, kind: 'trait', factor: spec.factor, subscale, direction: 1, pair: `${base}R`, text: positive },
      { id: `${base}R`, kind: 'trait', factor: spec.factor, subscale, direction: -1, pair: `${base}P`, text: reverse },
    ]
  }),
)

const GENERATED_ITEMS = independentAssessmentBank.questions || []
const ALL_ITEMS = [...TRAIT_ITEMS, ...VALIDITY_ITEMS, ...GENERATED_ITEMS]

function seeded(seed) {
  let value = seed >>> 0
  return () => (value = (value * 1664525 + 1013904223) >>> 0) / 4294967296
}

function shuffle(items, seed) {
  const out = [...items]
  const rnd = seeded(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildJobAdaptationItems(mode = 'full', paperNo = 1) {
  const traitPool = ALL_ITEMS.filter(item => item.kind === 'trait')
  const impressionPool = ALL_ITEMS.filter(item => item.kind === 'impression')
  const attentionPool = ALL_ITEMS.filter(item => item.kind === 'attention')
  const pairsFor = subscale => {
    const pairs = []
    const seen = new Set()
    for (const item of traitPool.filter(candidate => candidate.subscale === subscale)) {
      const key = [item.id, item.pair].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const mate = traitPool.find(candidate => candidate.id === item.pair)
      if (mate) pairs.push([item, mate])
    }
    return pairs
  }

  if (mode === 'full') {
    // 12개 하위척도마다 6쌍을 회차별로 순환 선발해 기존 160문항 규격을 유지한다.
    const selectedTraits = Object.keys(SUBSCALES).flatMap((subscale, subscaleIndex) => {
      const pairs = pairsFor(subscale)
      const ordered = shuffle(pairs, 260700 + subscaleIndex * 101)
      const start = ((paperNo - 1) * 6) % ordered.length
      return Array.from({ length: 6 }, (_, index) => ordered[(start + index) % ordered.length]).flat()
    })
    const impressions = shuffle(impressionPool, 260900).slice(((paperNo - 1) * 8) % impressionPool.length).concat(shuffle(impressionPool, 260900)).slice(0, 8)
    const attentions = shuffle(attentionPool, 261000).slice(((paperNo - 1) * 8) % attentionPool.length).concat(shuffle(attentionPool, 261000)).slice(0, 8)
    return shuffle([...selectedTraits, ...impressions, ...attentions], 260700 + paperNo * 31)
  }

  const quickTraits = Object.entries(SUBSCALES).flatMap(([subscale], subscaleIndex) => {
    const candidates = shuffle(pairsFor(subscale), 260800 + subscaleIndex * 53)
    const start = ((paperNo - 1) * 3) % candidates.length
    return candidates.slice(start).concat(candidates).slice(0, 3).flat()
  })
  const impressionStart = ((paperNo - 1) * 4) % impressionPool.length
  const attentionStart = ((paperNo - 1) * 4) % attentionPool.length
  const quickValidity = [
    ...impressionPool.slice(impressionStart).concat(impressionPool).slice(0, 4),
    ...attentionPool.slice(attentionStart).concat(attentionPool).slice(0, 4),
  ]
  return shuffle([...quickTraits, ...quickValidity], 260800 + paperNo * 31)
}

function scoreItems(items, responses) {
  const scored = []
  for (const item of items) {
    const response = responses[item.id]
    if (response == null || item.kind !== 'trait') continue
    const value = item.direction === -1 ? 6 - response : response
    scored.push({ ...item, value })
  }
  return scored
}

function percentage(values) {
  if (!values.length) return 50
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(((average - 1) / 4) * 100)
}

function band(score) {
  if (score >= 67) return { key: 'strong', label: '강점' }
  if (score >= 40) return { key: 'steady', label: '보통' }
  return { key: 'growth', label: '성장 필요' }
}

export function scoreJobAdaptation(items, responses) {
  const scored = scoreItems(items, responses)
  const subscales = Object.entries(SUBSCALES).map(([key, spec]) => {
    const score = percentage(scored.filter(item => item.subscale === key).map(item => item.value))
    return { key, name: spec.name, factor: spec.factor, score, ...band(score) }
  })
  const factors = JOB_ADAPTATION_FACTORS.map(factor => {
    const children = subscales.filter(item => item.factor === factor.key)
    const score = Math.round(children.reduce((sum, item) => sum + item.score, 0) / children.length)
    return { ...factor, score, children, ...band(score) }
  })

  const pairs = new Map()
  for (const item of items.filter(item => item.kind === 'trait' && item.pair)) {
    if (!pairs.has([item.id, item.pair].sort().join('|'))) {
      pairs.set([item.id, item.pair].sort().join('|'), [item.id, item.pair])
    }
  }
  let pairCount = 0
  let pairDifference = 0
  for (const [leftId, rightId] of pairs.values()) {
    const left = responses[leftId]
    const right = responses[rightId]
    if (left == null || right == null) continue
    pairDifference += Math.abs(left - (6 - right))
    pairCount++
  }
  const consistency = pairCount
    ? Math.max(0, Math.round(100 - (pairDifference / pairCount / 4) * 100))
    : 0

  const impressionItems = items.filter(item => item.kind === 'impression' && responses[item.id] != null)
  const impression = impressionItems.length
    ? percentage(impressionItems.map(item => responses[item.id]))
    : 0
  const attentionItems = items.filter(item => item.kind === 'attention' && responses[item.id] != null)
  const attentionMisses = attentionItems.filter(item => responses[item.id] !== item.expected).length
  const missing = items.filter(item => responses[item.id] == null).length
  const reliable = missing === 0 && consistency >= 60 && impression <= 65 && attentionMisses <= 1

  return {
    answered: items.length - missing,
    total: items.length,
    factors,
    subscales,
    reliability: { reliable, consistency, impression, attentionMisses, attentionTotal: attentionItems.length, missing },
  }
}
