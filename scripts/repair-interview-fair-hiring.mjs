import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
const write = (file, value) => fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`)

const REPLACEMENTS = {
  'IV-A01-1': ['채용기관마다 면접 평가표가 다를 때 지원자가 가장 먼저 확인할 자료는?', ['인터넷의 임의 합격후기', '채용공고와 직무기술서', '친구가 받은 다른 회사 질문', '전국 공통 배점표'], 'B', '면접의 평가요소와 배점은 기관·직무마다 다릅니다. 채용공고와 직무기술서에서 요구 지식·기술·태도와 전형 안내를 먼저 확인해야 합니다.'],
  'IV-A03-1': ['면접 답변을 준비할 때 기관별 평가기준 차이에 대응하는 방법은?', ['모든 기관에 같은 고정 배점을 적용한다', '외모 평가 비중을 추측한다', '직무기술서의 요구역량과 자신의 실제 경험을 연결한다', '합격자의 문장을 그대로 외운다'], 'C', '전국 공통 고정 배점은 없습니다. 지원 직무의 요구역량을 확인하고 이를 입증할 실제 행동과 결과를 준비하는 것이 타당합니다.'],
  'IV-A10-1': ['STAR 답변에서 Action을 설명하는 가장 좋은 방법은?', ['결과만 한 문장으로 말한다', '팀이 한 일을 모두 자신의 행동처럼 말한다', '자신이 취한 행동과 판단 근거를 단계별로 구체화한다', '상황 설명만 길게 이어 간다'], 'C', 'Action은 지원자의 실제 역량을 보여 주는 핵심입니다. 고정 비율을 암기하기보다 자신의 역할·행동·판단 근거를 구체적으로 설명해야 합니다.'],
  'IV-A24-3': ['위기관리 상황면접에서 가장 먼저 할 판단은?', ['보기 좋은 답변 문장을 고른다', '인명·안전·법규 등 즉시 통제할 위험을 확인한다', '책임자를 공개적으로 비난한다', '결과가 나올 때까지 보고를 미룬다'], 'B', '위기 상황에서는 안전과 법규, 피해 확산 가능성을 먼저 확인하고 보고체계에 따라 통제해야 합니다. 세부 평가표는 기관별로 다릅니다.'],
  'IV-A26-3': ['PT 면접 준비에서 우선 확인할 것은?', ['유명 발표자의 제스처', '주제·청중·시간·요구 산출물', '슬라이드 장식 효과', '고정된 전국 공통 가중치'], 'B', 'PT 면접은 과제 지시와 평가표가 기관마다 다르므로 주제, 청중, 시간, 자료 조건과 요구 결과를 먼저 확인해야 합니다.'],
  'IV-A29-2': ['발표 답변의 신뢰도를 높이는 조합은?', ['내용이 약해도 큰 제스처만 사용한다', '사실과 논리, 들리는 음성, 안정된 비언어 표현을 함께 점검한다', '말의 내용보다 외모를 우선한다', '7-38-55를 면접 배점으로 적용한다'], 'B', '내용·음성·비언어 표현은 함께 작동합니다. 메라비언의 제한된 연구 수치를 면접 평가비중으로 일반화하면 안 됩니다.'],
  'IV-A35-2': ['직무역량 면접에서 직무 이해를 보여 주는 답변은?', ['회사 이름을 반복해 칭찬한다', '직무기술서의 과업과 필요역량을 자신의 준비 경험에 연결한다', '복리후생만 자세히 설명한다', '정해진 평가 비율을 암기해 말한다'], 'B', '직무기술서의 실제 과업과 지식·기술·태도를 근거로 자신의 경험을 연결해야 직무 이해를 입증할 수 있습니다.'],
  'IV-A36-2': ['전문기술 경험을 설명할 때 구체성을 높이는 방법은?', ['확인되지 않은 성과 수치를 만든다', '사용한 기준·도구·절차와 실제 결과를 설명한다', '전문용어만 많이 나열한다', '팀 성과를 자신의 성과로 바꾼다'], 'B', '구체성은 허위 수치가 아니라 실제 수행한 기준, 도구, 절차, 역할과 검증 가능한 결과에서 나옵니다.'],
  'IV-A37-2': ['창의적 아이디어를 제안하는 상황면접에서 균형 있게 설명할 내용은?', ['참신함만 강조한다', '실행가능성만 말하고 효과는 생략한다', '문제·아이디어·기대효과·자원과 위험을 함께 설명한다', '정확한 고정 배점을 추측한다'], 'C', '아이디어는 새로움뿐 아니라 문제 적합성, 효과, 자원, 위험과 실행가능성을 함께 검토해야 설득력이 있습니다.'],
  'IV-A41-2': ['면접 마무리 역질문으로 적절한 것은?', ['이미 공고에 나온 내용을 다시 묻는다', '초봉 인상 시기만 묻는다', '지원 직무의 초기 과업과 교육·피드백 방식을 묻는다', '합격 가능성을 직접 묻는다'], 'C', '역질문은 조사한 정보를 바탕으로 직무와 성장에 관한 구체적 내용을 확인해야 합니다. 기관마다 평가 방식은 다릅니다.'],
  'IV-A42-1': ['1차 모의면접에서 가장 효과적인 피드백 방식은?', ['총점만 알려 준다', '좋았다 또는 나빴다고만 말한다', '직무연결·근거·구조·전달 행동을 관찰해 한 가지씩 수정한다', '합격선을 임의로 정한다'], 'C', '모의면접은 기관별 고정 배점 암기가 아니라 관찰 가능한 답변 행동을 진단하고 재답변으로 개선하는 과정입니다.'],
  'IV-A43-2': ['2차 모의면접에서 개선 여부를 확인하는 방법은?', ['이전보다 길게 답했는지만 본다', '1차 피드백 항목을 반영한 재답변을 같은 기준으로 비교한다', '새 질문만 계속 추가한다', '임의의 전국 공통 비중을 적용한다'], 'B', '같은 관찰기준으로 1차와 재답변을 비교해야 피드백이 실제 행동 변화로 이어졌는지 확인할 수 있습니다.'],
  'IV-A44-1': ['종합 모의면접의 완성도를 판단할 때 함께 확인할 것은?', ['암기한 문장 수', '답변 내용의 근거·직무연결·전달·블라인드 준수', '출신학교의 인지도', '정해진 하나의 최고 배점 항목'], 'B', '종합 모의면접은 직무와 전형에 맞춘 평가표로 내용, 근거, 전달, 태도와 블라인드 준수를 함께 확인해야 합니다.'],
  'IV-S03-2': ['모의면접 점수를 해석하는 태도로 적절한 것은?', ['연습 점수를 실제 합격선으로 본다', '점수보다 항목별 근거와 다음 수정 행동을 확인한다', '한 번 높으면 연습을 끝낸다', '기관이 달라도 같은 합격선을 적용한다'], 'B', '수업용 루브릭 점수는 개선을 위한 연습 지표이며 실제 합격을 보장하거나 기관의 합격선을 대신하지 않습니다.'],
}

function replaceQuestion(question) {
  const value = REPLACEMENTS[question.id]
  if (!value) return question
  const [stem, choices, answer, explanation] = value
  return { ...question, type: question.type === 'ox' ? 'choice' : question.type, questionMode: 'mcq', stem, choices, answer, explanation }
}

function cleanString(text) {
  return text
    .replace(/고졸취업 면접스킬/g, '고졸 공정채용 면접')
    .replace(/면접스킬/g, '고졸 공정채용 면접')
    .replace(/면접관의 핵심 평가 포인트/g, '면접관이 확인할 수 있는 주요 관점(기관·직무별 상이)')
    .replace(/주요 평가 기준 \(가중치별\)/g, '주요 평가 관점(실제 가중치는 기관별 상이)')
    .replace(/황금비율/g, '권장 답변 흐름')
    .replace(/30-40-30/g, '간결-구체-성찰')
    .replace(/S·T\s*30%·A\s*40%·R\s*30%/g, 'S·T 간결 · A 구체 · R 성과·성찰')
    .replace(/S·T\s*짧게\(30%\)\s*\/\s*A\s*길게\(40%\)\s*\/\s*R\s*임팩트\(30%\)/g, 'S·T는 간결하게 / A는 구체적으로 / R은 성과와 성찰까지')
    .replace(/A\(Action\)(?:가|는)\s*전체 답변의\s*(?:50|60)%\s*이상(?:을 차지해야 합니다|이 할애|을 할애해야 함|을 할애하여)?/g, 'A(Action)는 답변의 핵심이므로 자신의 행동과 판단 근거를 충분히 설명')
    .replace(/모든 결과에 수치 1개 이상 넣기\s*[—-]\s*없으면 만들어서라도/g, '실제 확인 가능한 수치가 있을 때만 사용함. 수치가 없으면 역할·행동·변화를 구체적으로 설명함')
    .replace(/가능한 모든 부분을 숫자로 표현하세요\./g, '실제 확인 가능한 수치가 있다면 정확하게 표현하세요.')
    .replace(/언어적 요소\s*\(7%\)\s*:\s*실제 말의 내용/g, '언어적 요소: 답변의 사실성·논리·직무 관련성')
    .replace(/준언어적 요소\s*\(38%\)\s*:\s*/g, '준언어적 요소: ')
    .replace(/비언어적 요소\s*\(55%\)\s*:\s*/g, '비언어적 요소: ')
    .replace(/언어적 요소\s*\(Verbal\)\s*-\s*7%/g, '언어적 요소(Verbal)')
    .replace(/준언어적 요소\s*\(Vocal\)\s*-\s*38%/g, '준언어적 요소(Vocal)')
    .replace(/비언어적 요소\s*\(Visual\)\s*-\s*55%/g, '비언어적 요소(Visual)')
    .replace(/발표는 비언어적 요소가 55%\s*-\s*자세, 시선, 표정이 내용만큼 중요하다\./g, '발표는 내용·음성·자세·시선을 함께 점검함. 특정 비율을 면접 평가에 일반화하지 않음.')
    .replace(/7-38-55 법칙 활용/g, '내용·음성·비언어 표현 통합 점검')
    .replace(/합격을 가름/g, '설득력을 높임')
    .replace(/=\s*합격/g, '= 설득력 있는 답변')
    .replace(/기본 합격권/g, '수업용 기본 목표 수준')
    .replace(/안정권/g, '수업용 심화 목표 수준')
}

function cleanValue(value) {
  if (typeof value === 'string') return cleanString(value)
  if (Array.isArray(value)) {
    const result = value.map(cleanValue)
    if (result.length >= 2 && result.every(item => typeof item === 'string' && /\d+%/.test(item))) {
      return ['수업용 예시 루브릭이며 실제 항목·배점은 채용기관과 직무에 따라 달라짐', ...result]
    }
    return result
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanValue(item)]))
  }
  return value
}

const study = cleanValue(read('data/interview-study.json'))
const firstLesson = study.lessons.find(lesson => lesson.id === 'A01')
if (!firstLesson.sections.some(section => section.text?.includes('전국 공통 고정 배점 시험이 아님'))) {
  firstLesson.sections.unshift(
    { type: 'notice', text: '기준 안내: 고졸 면접은 전국 공통 고정 배점 시험이 아님. 채용공고와 직무기술서를 기준으로 능력중심·블라인드·구조화 면접을 준비함.' },
    { type: 'notice', text: '수업의 루브릭과 점수는 연습·피드백용 예시이며 실제 평가항목·배점·합격선은 채용기관과 직무에 따라 달라짐.' },
  )
}
write('data/interview-study.json', study)

const quiz = read('data/interview-quiz.json')
quiz.questions = quiz.questions.map(question => replaceQuestion(cleanValue(question)))
write('data/interview-quiz.json', quiz)

const mock = read('data/mock-interview-pool.json')
mock.pool = mock.pool.map(question => replaceQuestion(cleanValue(question)))
write('data/mock-interview-pool.json', mock)

const textbookPath = path.join(ROOT, 'data/textbook-interview.json')
const textbookBefore = fs.readFileSync(textbookPath, 'utf8')
const textbookAfter = cleanString(textbookBefore)
fs.writeFileSync(textbookPath, textbookAfter)

console.log(`Fair-hiring repair: lessons ${study.lessons.length}, quiz ${quiz.questions.length}, mock ${mock.pool.length}, replaced ${Object.keys(REPLACEMENTS).length}, textbook labels updated`)
