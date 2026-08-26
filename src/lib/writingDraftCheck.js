const PERSONAL = /(저는|제가|저의|제게|나는|내가|나의|내게)/
const EXPERIENCE = /(실습|프로젝트|과제|동아리|아르바이트|봉사|수업|대회|현장|팀|고객|행사|업무|작업|정산|측정|제작|담당|경험)/
const ACTION = /(확인|비교|기록|정리|분석|분류|대조|조정|제안|설명|질문|보고|점검|수정|개선|제작|만들|적용|연습|반복|공유|측정|차단|배분|완료|도왔|해결|수행|검토|시험|확보|제시|선택|나눠|사용|활용|익혔|학습|준비|실행)/
const RESULT = /(그 결과|결과|이후|줄였|줄어|감소|향상|개선|완성|완료|달성|막았|지켰|정상화|해결|확보|높였|낮췄|단축|기한|오류|누락|피드백|수상|합의|변화|배웠|충족)/
const NUMBER = /(?:\d+[.,]?\d*\s*(?:%|퍼센트|건|회|명|분|시간|일|주|개월|개|점))|(?:이전보다|전보다|처음보다|다음에는)/
const VALUE = /(가치|기준|원칙|중요|신뢰|정확|책임|안전|고객|공공|품질|정직|협업)/
const TARGET = /(귀사|지원처|지원 기관|지원 기업|기관|기업|회사|공사|공단|은행)/
const TARGET_SOURCE = /(공식|홈페이지|채용공고|직무기술서|사업보고서|경영공시|인재상|핵심가치|설립 목적|주요 사업|고객 신뢰|고객 보호|사회적 가치)/
const CONNECTION = /(지원\s*(?:직무|업무)|직무.*(?:기여|활용|적용|연결)|업무.*(?:기여|활용|적용|이어)|귀사.*(?:기여|이어|활용|적용)|바탕으로|이어\s*가|기여하|활용하겠습니다)/
const GENERIC = /(무조건|항상|누구보다|어떤 일이든|최선을 다|열심히|성실하|잘할 수|완벽|절대 포기|유명하고 안정|도전적이고 열정적|원래 꼼꼼)/
const META = /(왜 이럴까|글\s*작성|작성\s*솜씨|능력이\s*부족|무엇을\s*써야|어떻게\s*써야|잘\s*모르|생각이\s*안|쓸\s*말이\s*없|자소서가\s*어렵|문장을\s*못)/

const SIGNALS = {
  goal: /(목표|달성|완수|기한|마감)/,
  role: /(역할|담당|맡은|제가\s*한|직접)/,
  disagreement: /(의견\s*(?:차이|충돌)|갈등|쟁점|서로\s*다른|반대)/,
  coordination: /(조정|합의|역할을\s*(?:나누|다시)|일정을\s*(?:맞추|공유)|의견을\s*(?:듣|확인)|공동)/,
  problem: /(문제|불편|비효율|오류|지연|누락|위험|고장|부족)/,
  cause: /(원인|이유를\s*확인|왜.*발생|분석|나눠\s*확인)/,
  improve: /(개선|수정|바꾼|새로운\s*방법|대안|보완|조정)/,
  beforeAfter: /(전후|이전보다|처음보다|다음에는|에서\s*\d+.*로|줄어|늘어|향상|감소|단축)/,
  demand: /(요구|요청|원한|필요|불편|어려움)/,
  explain: /(설명|안내|대안|쉬운\s*말|예시|순서로\s*바꿔)/,
  understand: /(이해했는지|다시\s*확인|제\s*말로|질문을\s*받|선택한\s*방법)/,
  conflict: /(충돌|급했|마감|성과|압박|지켜야|원칙)/,
  standard: /(기준|원칙|절차|규정|표준|범위|기한|정확|안전|품질)/,
  followup: /(후속|이후|다음부터|다시|재발|인계|공유|기록을\s*남)/,
  stakeholder: /(고객|이용자|참여자|팀원|동료|주민|국민|상대|다음\s*작업자|약자)/,
  public: /(공공|국민|사회적\s*가치|공동체|이용자|형평|공익)/,
  risk: /(위험|이상|기준을\s*벗어난|사고|파손|오염|누전|징후)/,
  control: /(중지|차단|통제|격리|사용을\s*멈|전원을\s*끊)/,
  report: /(보고|알렸|지도교사|담당자에게|책임자에게)/,
  recheck: /(재확인|다시\s*(?:확인|측정|시험|검토)|교차\s*확인|대조)/,
  gap: /(부족|미숙|느렸|어려웠|익숙하지|실패|틀렸)/,
  learning: /(학습|연습|질문|반복|익혔|공부|계획|매일|예제)/,
  failure: /(실패|놓쳤|얻지\s*못|미완료|늦었|오류|잘못)/,
  responsibility: /(제\s*책임|책임을\s*인정|제가.*(?:늦|놓|잘못)|핑계|돌아보)/,
  reapply: /(다음\s*(?:과제|작업|시험|실습)|재적용|다시\s*적용|이후.*(?:지켰|줄었|완료))/,
  tool: /(스프레드시트|엑셀|프로그램|도구|데이터|함수|코딩|소프트웨어|앱|장비|멀티미터)/,
  security: /(보안|개인정보|권한|정확성|원본|대조|검산|암호)/,
  strength: /(강점|잘하는|역량|장점)/,
  weakness: /(보완점|약점|부족|개선할|영향)/,
  early: /(입사\s*초기|처음\s*익힐|먼저\s*배우|초기\s*업무)/,
  longterm: /(장기|중장기|향후|이후에는|기여|개선하겠습니다)/,
  actualWork: /(실제\s*업무|담당\s*업무|하는\s*일|직무는|상담|정산|생산|검사|안내|관리)/,
  preparation: /(준비|자격|전공|실습|연습|학습|익힌|사용할\s*수)/,
  constraint: /(제한|부족|마감|기한|예산|시간|자원|조건)/,
  priority: /(우선순위|먼저|중요도|마감일|기준으로\s*순서)/,
  distribute: /(배분|나누|할당|순서를\s*정|계획표|중간\s*점검)/,
  change: /(변화|바뀌|달라진|새로운\s*환경|갑작스러운)/,
  idea: /(아이디어|대안|새로운\s*방법|방식을\s*바꾸|표지를\s*붙|위치를\s*바꾸)/,
  attitude: /(배운\s*태도|깨달|중요성을\s*배|업무\s*태도)/,
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function splitSentences(value) {
  return clean(value)
    .split(/(?<=[.!?。]|다\.|요\.)\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

function clip(value, max = 92) {
  const chars = [...clean(value)]
  return chars.length > max ? `${chars.slice(0, max).join('').trim()}...` : chars.join('')
}

function findEvidence(sentences, patterns) {
  const usable = patterns.filter(Boolean)
  return sentences
    .map(sentence => ({ sentence, hits: usable.filter(pattern => pattern.test(sentence)).length }))
    .sort((a, b) => b.hits - a.hits || b.sentence.length - a.sentence.length)[0]
}

function ruleFor(label) {
  const text = clean(label)
  if (text === '나의 업무 가치') return { patterns: [PERSONAL, VALUE], strong: value => PERSONAL.test(value) && VALUE.test(value), prompt: '업무에서 중요하게 여기는 기준과 그 이유를 첫 문장에 써 보세요.' }
  if (text === '가치가 드러난 행동') return { patterns: [EXPERIENCE, ACTION], strong: value => EXPERIENCE.test(value) && ACTION.test(value), prompt: '그 가치 때문에 실제로 선택하거나 실행한 행동을 써 보세요.' }
  if (/지원처.*(?:공식|가치)/.test(text)) return { patterns: [TARGET, TARGET_SOURCE], strong: value => TARGET.test(value) && TARGET_SOURCE.test(value), prompt: '지원처 공식 자료에서 확인한 사업·업무·가치를 출처와 함께 적어 보세요.' }
  if (/(?:지원\s*)?직무\s*연결|연결\s*근거|기여\s*방법|장기\s*기여/.test(text)) return { patterns: [CONNECTION], strong: value => CONNECTION.test(value), prompt: '이 경험을 지원 직무의 어떤 업무에 어떻게 활용할지 연결해 보세요.' }
  if (/개인\s*계기/.test(text)) return { patterns: [PERSONAL, EXPERIENCE, /(계기|관심|선택|배웠|느꼈)/], strong: value => PERSONAL.test(value) && EXPERIENCE.test(value) && /(계기|관심|선택|배웠|느꼈)/.test(value), prompt: '이 직무에 관심을 갖게 된 본인의 구체적 경험을 적어 보세요.' }
  if (/목표/.test(text)) return simpleRule('goal', '달성하려던 목표와 기한 또는 완료 기준을 적어 보세요.')
  if (/(내\s*역할|맡은\s*역할|맡은\s*책임)/.test(text)) return { patterns: [SIGNALS.role, PERSONAL], strong: value => SIGNALS.role.test(value) && (PERSONAL.test(value) || /맡은|담당/.test(value)), prompt: '팀 전체가 아니라 본인이 맡은 역할을 분명히 적어 보세요.' }
  if (/의견\s*차이|충돌\s*원인/.test(text)) return simpleRule('disagreement', '서로 달랐던 의견과 그 차이가 생긴 이유를 구체적으로 적어 보세요.')
  if (/조정|합의/.test(text)) return simpleRule('coordination', '상대 의견을 확인하고 역할·일정·기준을 조정한 행동을 적어 보세요.')
  if (/문제\s*정의|기존\s*(?:문제|불편)/.test(text)) return simpleRule('problem', '발견한 문제와 그 문제가 일으킨 영향을 적어 보세요.')
  if (/원인\s*확인/.test(text)) return simpleRule('cause', '추측하지 않고 원인을 확인한 순서나 방법을 적어 보세요.')
  if (/개선(?:\s*아이디어)?/.test(text)) return simpleRule('improve', '기존 방식과 다르게 바꾸거나 적용한 방법을 적어 보세요.')
  if (/전후\s*(?:비교|변화|결과)/.test(text)) return simpleRule('beforeAfter', '개선 전과 후가 어떻게 달라졌는지 수치나 관찰 결과로 비교해 보세요.')
  if (/요구\s*확인|상대의\s*어려움/.test(text)) return simpleRule('demand', '상대가 실제로 어려워하거나 요청한 내용을 확인한 질문을 적어 보세요.')
  if (/설명|대안/.test(text)) return simpleRule('explain', '어려운 내용을 어떤 순서·표현·대안으로 설명했는지 적어 보세요.')
  if (/이해\s*확인/.test(text)) return simpleRule('understand', '상대가 이해했는지 다시 확인한 말이나 행동을 적어 보세요.')
  if (/충돌\s*상황/.test(text)) return simpleRule('conflict', '성과·마감과 원칙이 동시에 걸린 실제 상황을 적어 보세요.')
  if (/(판단|공공|고려한|지킨|업무|점검|안전·품질)\s*기준|기준$/.test(text)) return simpleRule('standard', '판단하거나 점검할 때 사용한 구체적 기준을 적어 보세요.')
  if (/후속\s*조치/.test(text)) return simpleRule('followup', '처리 뒤 재발을 막기 위해 기록·공유·재확인한 행동을 적어 보세요.')
  if (/이해관계자|영향받는\s*사람/.test(text)) return simpleRule('stakeholder', '본인의 결정으로 영향을 받은 고객·팀원·이용자를 구체적으로 적어 보세요.')
  if (/공공\s*기준/.test(text)) return simpleRule('public', '공익·형평·이용자 보호 중 판단에 사용한 공공 기준을 적어 보세요.')
  if (/위험\s*징후/.test(text)) return simpleRule('risk', '처음 발견한 이상 신호나 기준을 벗어난 상태를 적어 보세요.')
  if (/중지·통제/.test(text)) return simpleRule('control', '위험 확산을 막기 위해 즉시 멈추거나 차단한 행동을 적어 보세요.')
  if (/보고/.test(text)) return simpleRule('report', '누구에게 어떤 사실을 보고했는지 적어 보세요.')
  if (/재확인/.test(text)) return simpleRule('recheck', '조치 후 무엇을 다시 측정·대조·시험했는지 적어 보세요.')
  if (/부족한\s*(?:점|역량)/.test(text)) return simpleRule('gap', '부족하다고 판단한 구체적 기술과 그렇게 판단한 근거를 적어 보세요.')
  if (/(학습\s*(?:행동|방법|계획)|필요한\s*학습)/.test(text)) return simpleRule('learning', '무엇을 어떤 순서와 주기로 학습했는지 적어 보세요.')
  if (/실패\s*사실/.test(text)) return simpleRule('failure', '기대한 결과와 실제 결과의 차이를 숨기지 말고 적어 보세요.')
  if (/내\s*책임/.test(text)) return simpleRule('responsibility', '결과에 영향을 준 본인의 판단이나 행동을 적어 보세요.')
  if (/재적용/.test(text)) return simpleRule('reapply', '바꾼 행동을 다음 과제에 적용해 달라진 결과를 적어 보세요.')
  if (/도구|기술/.test(text)) return simpleRule('tool', '실제로 사용한 도구·기술의 이름과 사용 방법을 적어 보세요.')
  if (/보안·정확성/.test(text)) return simpleRule('security', '원본 대조·검산·권한 관리처럼 정확성과 보안을 확인한 방법을 적어 보세요.')
  if (/강점\s*근거/.test(text)) return { patterns: [SIGNALS.strength, EXPERIENCE, ACTION], strong: value => EXPERIENCE.test(value) && ACTION.test(value), prompt: '강점 이름보다 그 강점이 드러난 행동 사례를 적어 보세요.' }
  if (/보완점\s*영향/.test(text)) return simpleRule('weakness', '보완점이 실제 과제나 업무에 준 영향을 구체적으로 적어 보세요.')
  if (/현재\s*행동/.test(text)) return { patterns: [ACTION, SIGNALS.learning], strong: value => ACTION.test(value) && SIGNALS.learning.test(value), prompt: '보완을 위해 지금 반복하고 있는 행동과 주기를 적어 보세요.' }
  if (/초기\s*업무/.test(text)) return simpleRule('early', '입사 초기에 먼저 익힐 실제 업무를 적어 보세요.')
  if (/실제\s*업무|직무\s*요구/.test(text)) return simpleRule('actualWork', '지원 직무가 실제로 하는 일과 지켜야 할 기준을 적어 보세요.')
  if (/내\s*준비|전공·실습\s*행동/.test(text)) return { patterns: [SIGNALS.preparation, EXPERIENCE, ACTION], strong: value => SIGNALS.preparation.test(value) && ACTION.test(value), prompt: '전공·실습에서 직접 수행한 준비 행동을 적어 보세요.' }
  if (/제약\s*조건/.test(text)) return simpleRule('constraint', '사용할 수 있었던 시간·인원·예산 등의 제한을 적어 보세요.')
  if (/우선순위/.test(text)) return simpleRule('priority', '무엇을 먼저 할지 정한 기준을 적어 보세요.')
  if (/배분\s*행동/.test(text)) return simpleRule('distribute', '시간·역할·자원을 어떻게 나누고 점검했는지 적어 보세요.')
  if (/변화\s*내용/.test(text)) return simpleRule('change', '갑자기 달라진 조건이나 환경을 구체적으로 적어 보세요.')
  if (/배운\s*태도/.test(text)) return simpleRule('attitude', '그 경험 뒤 업무 방식이나 태도가 어떻게 달라졌는지 적어 보세요.')
  if (/지원처\s*가치/.test(text)) return { patterns: [TARGET, VALUE, TARGET_SOURCE], strong: value => TARGET.test(value) && VALUE.test(value) && TARGET_SOURCE.test(value), prompt: '지원처 공식 자료에서 확인한 가치와 관련 사업·업무를 적어 보세요.' }
  if (/행동/.test(text)) return { patterns: [ACTION, PERSONAL, EXPERIENCE], strong: value => ACTION.test(value) && (PERSONAL.test(value) || EXPERIENCE.test(value)), prompt: '본인이 직접 한 행동을 확인·비교·기록 같은 동사로 적어 보세요.' }
  if (/결과|변화/.test(text)) return { patterns: [RESULT, NUMBER], strong: value => RESULT.test(value) && (NUMBER.test(value) || /완료|해결|정상화|합의|충족/.test(value)), prompt: '행동 뒤 달라진 결과를 수치·완성물·기한·피드백으로 적어 보세요.' }
  if (/근거/.test(text)) return { patterns: [EXPERIENCE, ACTION, NUMBER], strong: value => EXPERIENCE.test(value) && ACTION.test(value), prompt: '언제·어디서·무엇을 직접 했는지 경험 근거를 적어 보세요.' }
  return { patterns: [ACTION, EXPERIENCE], strong: value => ACTION.test(value) && EXPERIENCE.test(value), prompt: `${text}이 드러나는 본인의 구체적 사실을 한 문장 추가해 보세요.` }
}

function simpleRule(signal, prompt) {
  const pattern = SIGNALS[signal]
  return { patterns: [pattern], strong: value => pattern.test(value), prompt }
}

function checkCriterion(label, draft, sentences, offTopic) {
  const rule = ruleFor(label)
  const evidenceMatch = findEvidence(sentences, rule.patterns)
  const matched = evidenceMatch?.hits > 0
  const strong = !offTopic && rule.strong(draft)
  const status = offTopic ? 'missing' : strong ? 'met' : matched ? 'partial' : 'missing'
  return {
    label,
    status,
    evidence: status !== 'missing' && evidenceMatch?.sentence ? clip(evidenceMatch.sentence) : '',
    guidance: status === 'met' ? '입력문에서 관련 근거를 찾았습니다. 사실과 맥락이 정확한지 다시 확인하세요.' : rule.prompt,
  }
}

export function analyzeWritingDraft(value, sample = {}) {
  const draft = clean(value)
  const sentences = splitSentences(draft)
  const required = (sample.required || sample.checklist || [])
    .map(item => clean(item).replace(/\s*포함$/, ''))
    .filter(item => item && !item.startsWith('작성 순서') && !item.includes('면접에서'))
  const metaWriting = META.test(draft)
  const hasContentSignal = PERSONAL.test(draft) || EXPERIENCE.test(draft) || ACTION.test(draft) || TARGET.test(draft)
  const offTopic = draft.length < 20 || metaWriting || !hasContentSignal
  const criteria = required.map(label => checkCriterion(label, draft, sentences, offTopic))
  const metCount = criteria.filter(item => item.status === 'met').length
  const partialCount = criteria.filter(item => item.status === 'partial').length
  const total = criteria.length
  const hasAction = ACTION.test(draft) && (PERSONAL.test(draft) || EXPERIENCE.test(draft))
  const hasResult = RESULT.test(draft)
  const hasSpecificity = NUMBER.test(draft) || (EXPERIENCE.test(draft) && ACTION.test(draft))
  const needsResult = required.some(label => /(결과|변화|전후|성과|재적용|이해\s*확인|재확인)/.test(label))
  const genericOnly = GENERIC.test(draft) && !hasSpecificity
  const warnings = []

  if (metaWriting) warnings.push({ id: 'off-topic', title: '질문에 답한 내용이 아닙니다', detail: '현재 문장은 글쓰기 고민을 말하고 있습니다. 문항이 요구한 경험·행동·지원처 근거로 다시 시작하세요.' })
  else if (!hasContentSignal) warnings.push({ id: 'off-topic', title: '질문과 연결되는 근거가 보이지 않습니다', detail: '본인의 경험, 직접 한 행동, 지원 직무 중 하나를 첫 문장에 제시하세요.' })
  if (genericOnly) warnings.push({ id: 'generic', title: '추상 표현이 근거를 대신하고 있습니다', detail: '열심히·성실·무조건 같은 표현을 줄이고 확인·비교·기록처럼 관찰 가능한 행동으로 바꾸세요.' })
  if (!offTopic && !hasAction) warnings.push({ id: 'action', title: '본인이 직접 한 행동이 부족합니다', detail: '팀이나 상황 설명 뒤에 “제가 직접” 한 행동을 2개 이상 적으세요.' })
  if (!offTopic && needsResult && !hasResult) warnings.push({ id: 'result', title: '행동 뒤 결과가 보이지 않습니다', detail: '수치·완성물·기한 준수·오류 변화·받은 피드백 중 확인 가능한 결과를 추가하세요.' })
  if (!offTopic && !hasSpecificity) warnings.push({ id: 'specificity', title: '구체성이 부족합니다', detail: '언제·어디서·어떤 기준으로 무엇을 했는지 사실 단서를 추가하세요.' })

  const status = offTopic
    ? 'off-topic'
    : metCount === total && !warnings.length
      ? 'review-ready'
      : metCount + partialCount >= Math.max(1, Math.ceil(total * 0.6))
        ? 'developing'
        : 'needs-work'
  const copy = {
    'off-topic': ['질문에 답한 내용이 확인되지 않습니다', '문항의 필수 요구를 기준으로 경험과 행동부터 다시 작성하세요.'],
    'needs-work': ['핵심 근거가 많이 비어 있습니다', '아래의 보완 질문에 답하면서 초안을 구체화하세요.'],
    developing: ['일부 근거가 확인되었습니다', '확인된 문장은 유지하고, 빠진 요구와 결과를 보완하세요.'],
    'review-ready': ['문항 요구가 입력문에 드러납니다', '자동 점검을 통과했지만 사실 여부와 지원처 적합성은 본인과 교사가 최종 확인해야 합니다.'],
  }[status]

  return {
    status,
    title: copy[0],
    description: copy[1],
    criteria,
    warnings,
    metCount,
    partialCount,
    total,
  }
}
