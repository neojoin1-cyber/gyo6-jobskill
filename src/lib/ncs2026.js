// 능력 문항과 상식 문항은 파일이 나뉘어 있다(903 §4-⑥). 이 파일은
// 둘을 다 쓰므로 합친 것을 받는다.
import { allNcsSourceQuestions as rawNcsQuestions } from './ncsBanks.js'
import extractedBank from '../../data/ncs-extracted-bank.json'
import lessonAreaMap from '../../data/ncs-lesson-area-map.json'
import supForeign from '../../data/ncs26-supplement-foreign.json'
import supAdaptive from '../../data/ncs26-supplement-adaptive.json'
import supAi from '../../data/ncs26-supplement-ai.json'
import supSafety from '../../data/ncs26-supplement-safety.json'
import supStatTime from '../../data/ncs26-supplement-stat-time.json'
import supCollabLead from '../../data/ncs26-supplement-collab-lead.json'
import supConflict from '../../data/ncs26-supplement-conflict.json'
import supEthics from '../../data/ncs26-supplement-ethics.json'
import { NCS_2026, NCS_2026_AREAS } from './officialStandards.js'
import { attachDemand } from './demandLevel.js'
import { isCurrentNcsQuestion, RECRUITMENT_EXTRA_AREA_IDS } from './recruitWrittenPolicy.js'
import { applyQuestionIntegrityToPool } from './questionIntegrity.js'
import { questionContentKey } from './assessmentPartition.js'
import independentAssessmentBank from '../../data/assessment-banks/ncs-basic.json'

const RECRUITMENT_EXTRA_AREAS = new Set(RECRUITMENT_EXTRA_AREA_IDS)

const GAP_QUESTIONS = [
  {
    id: 'NCS26-COM-FOREIGN-01',
    area: '의사소통능력',
    ncsAbility: '외국어소통능력',
    ncsElement: '외국어 이해능력',
    lessonId: 'NCS26-외국어소통능력',
    lessonTitle: '직무 외국어 정보 이해와 대응',
    level: '기초',
    stem: '해외 거래처가 “Please confirm the revised delivery date by Friday.”라고 요청했다. 가장 정확한 업무 이해는?',
    choices: ['금요일까지 수정된 배송일을 확인해 달라는 요청', '금요일에 배송을 완료하겠다는 통보', '배송 수량을 금요일에 변경하겠다는 요청', '배송을 취소해 달라는 요청'],
    answer: 'A',
    explanation: 'confirm은 확인하여 회신한다는 뜻이고, revised delivery date는 수정된 배송일을 뜻합니다.',
  },
  {
    id: 'NCS26-COM-FOREIGN-02',
    area: '의사소통능력',
    ncsAbility: '외국어소통능력',
    ncsElement: '외국어 표현능력',
    lessonId: 'NCS26-외국어소통능력',
    lessonTitle: '직무 외국어 정보 이해와 대응',
    level: '표준',
    stem: '납품 지연을 알리고 새로운 일정을 정중하게 제시하는 이메일 문장으로 가장 적절한 것은?',
    choices: [
      'We apologize for the delay and can deliver the order by July 18.',
      'Your order is late because the factory is busy.',
      'Wait until we contact you again.',
      'The delivery date does not matter.',
    ],
    answer: 'A',
    explanation: '사과, 지연 사실, 대안 일정이 명확하고 정중하게 포함된 문장입니다.',
  },
  {
    id: 'NCS26-COM-FOREIGN-03',
    area: '의사소통능력',
    ncsAbility: '외국어소통능력',
    ncsElement: '외국어 상황대응능력',
    lessonId: 'NCS26-외국어소통능력',
    lessonTitle: '직무 외국어 정보 이해와 대응',
    level: '표준',
    stem: '외국인 고객의 요청을 정확히 이해하지 못했을 때 가장 적절한 대응은?',
    choices: [
      'Could you please repeat that more slowly?',
      'I already understand everything.',
      'Please ask another customer.',
      'That is not my responsibility.',
    ],
    answer: 'A',
    explanation: '이해하지 못한 내용을 정중하게 다시 확인하여 의사소통 오류를 줄이는 대응입니다.',
  },
  {
    id: 'NCS26-SELF-ADAPT-01',
    area: '자기관리능력',
    ncsAbility: '적응학습능력',
    ncsElement: '변화대응 학습인식',
    lessonId: 'NCS26-적응학습능력',
    lessonTitle: '업무 변화에 대응하는 자기주도 학습',
    level: '기초',
    stem: '부서에 새로운 재고관리 시스템이 도입되었다. 적응학습의 첫 단계로 가장 적절한 것은?',
    choices: ['현재 역량과 새 업무에 필요한 역량의 차이를 파악한다', '기존 방식만 계속 사용한다', '동료가 대신 처리할 때까지 기다린다', '평가가 끝난 뒤 학습을 시작한다'],
    answer: 'A',
    explanation: '변화에 필요한 역량을 인식하고 현재 수준과의 차이를 확인해야 학습 목표를 세울 수 있습니다.',
  },
  {
    id: 'NCS26-SELF-ADAPT-02',
    area: '자기관리능력',
    ncsAbility: '적응학습능력',
    ncsElement: '자기주도 학습실행',
    lessonId: 'NCS26-적응학습능력',
    lessonTitle: '업무 변화에 대응하는 자기주도 학습',
    level: '표준',
    stem: '새 장비 사용법을 일주일 안에 익혀야 할 때 가장 적절한 학습 실행은?',
    choices: ['매뉴얼 학습, 실습, 피드백 일정을 나누어 실행한다', '마지막 날에 매뉴얼만 읽는다', '쉬운 기능만 반복한다', '평가 결과와 관계없이 같은 방법만 유지한다'],
    answer: 'A',
    explanation: '목표 기간 안에서 지식 학습, 실제 적용, 피드백을 계획적으로 실행해야 합니다.',
  },
  {
    id: 'NCS26-SELF-ADAPT-03',
    area: '자기관리능력',
    ncsAbility: '적응학습능력',
    ncsElement: '지속적 자기개발',
    lessonId: 'NCS26-적응학습능력',
    lessonTitle: '업무 변화에 대응하는 자기주도 학습',
    level: '표준',
    stem: '교육을 마친 뒤 지속적 자기개발을 위해 가장 적절한 행동은?',
    choices: ['업무 적용 결과를 점검하고 다음 학습 목표를 보완한다', '수료증을 받은 뒤 학습 기록을 삭제한다', '실수는 숨기고 기존 목표를 유지한다', '다른 사람의 평가만 기다린다'],
    answer: 'A',
    explanation: '학습 결과를 실제 업무와 연결해 평가하고 다음 목표에 반영해야 지속적인 개발이 이루어집니다.',
  },
  {
    id: 'NCS26-DIG-AI-01',
    area: '디지털능력',
    ncsAbility: '인공지능(AI)활용능력',
    ncsElement: 'AI 기술 이해',
    lessonId: 'NCS26-인공지능활용능력',
    lessonTitle: '책임 있는 업무 AI 활용',
    level: '기초',
    stem: '생성형 AI가 업무에 제시한 답변을 사용할 때 반드시 필요한 태도는?',
    choices: ['출처와 사실을 별도로 확인한다', '자연스러운 문장이면 바로 확정한다', 'AI가 만든 내용은 항상 최신이라고 가정한다', '검토 없이 고객에게 전송한다'],
    answer: 'A',
    explanation: '생성형 AI는 사실과 다른 내용을 만들 수 있으므로 담당자가 출처와 사실을 검증해야 합니다.',
  },
  {
    id: 'NCS26-DIG-AI-02',
    area: '디지털능력',
    ncsAbility: '인공지능(AI)활용능력',
    ncsElement: 'AI 도구 선택 및 적용',
    lessonId: 'NCS26-인공지능활용능력',
    lessonTitle: '책임 있는 업무 AI 활용',
    level: '표준',
    stem: '고객 개인정보가 포함된 상담 기록을 요약해야 한다. AI 도구 선택 시 가장 먼저 확인할 것은?',
    choices: ['조직의 보안정책과 개인정보 처리 가능 여부', '화면의 색상과 디자인', '광고에 나온 사용자 수', '무료 사용 횟수'],
    answer: 'A',
    explanation: '민감한 업무정보를 처리하기 전 조직 정책, 데이터 저장·학습 여부와 접근권한을 확인해야 합니다.',
  },
  {
    id: 'NCS26-DIG-AI-03',
    area: '디지털능력',
    ncsAbility: '인공지능(AI)활용능력',
    ncsElement: 'AI를 활용한 문제해결',
    lessonId: 'NCS26-인공지능활용능력',
    lessonTitle: '책임 있는 업무 AI 활용',
    level: '표준',
    stem: 'AI로 불량 원인을 분석하려 할 때 가장 타당한 업무 절차는?',
    choices: ['목표와 데이터를 확인하고 AI 결과를 현장 증거와 대조한다', '데이터 품질을 확인하지 않고 결과를 적용한다', '가장 빠르게 나온 답만 채택한다', 'AI 결과와 다른 현장 기록은 삭제한다'],
    answer: 'A',
    explanation: '문제 정의, 데이터 품질 확인, 결과 검증과 사람의 최종 판단이 함께 이루어져야 합니다.',
  },
  {
    id: 'NCS26-ETH-SAFE-01',
    area: '직업윤리',
    ncsAbility: '산업안전보건의식',
    ncsElement: '안전보건의식 및 책임 이해',
    lessonId: 'NCS26-산업안전보건의식',
    lessonTitle: '위험을 발견하고 예방하는 안전보건 실천',
    level: '기초',
    stem: '작업 전 안전점검의 가장 중요한 목적은?',
    choices: ['위험요인을 미리 찾아 사고를 예방하는 것', '작업 속도를 무조건 높이는 것', '점검표에 서명만 남기는 것', '사고 발생 뒤 책임자를 정하는 것'],
    answer: 'A',
    explanation: '안전점검은 작업 전 위험을 확인하고 제거·통제하여 사고와 건강장해를 예방하기 위한 활동입니다.',
  },
  {
    id: 'NCS26-ETH-SAFE-02',
    area: '직업윤리',
    ncsAbility: '산업안전보건의식',
    ncsElement: '안전보건규범 준수',
    lessonId: 'NCS26-산업안전보건의식',
    lessonTitle: '위험을 발견하고 예방하는 안전보건 실천',
    level: '표준',
    stem: '기계 방호장치가 고장 난 것을 발견했을 때 가장 적절한 행동은?',
    choices: ['작업을 중지하고 정해진 절차로 보고한다', '조심해서 작업을 계속한다', '교대자에게만 구두로 알린다', '작업량을 마친 뒤 기록한다'],
    answer: 'A',
    explanation: '즉시 위험을 통제하고 보고·조치가 끝난 뒤 안전이 확인되어야 작업을 재개할 수 있습니다.',
  },
  {
    id: 'NCS26-ETH-SAFE-03',
    area: '직업윤리',
    ncsAbility: '산업안전보건의식',
    ncsElement: '위험예방 및 건강관리 실천',
    lessonId: 'NCS26-산업안전보건의식',
    lessonTitle: '위험을 발견하고 예방하는 안전보건 실천',
    level: '표준',
    stem: '반복 작업으로 손목 통증이 계속될 때 가장 적절한 대응은?',
    choices: ['증상을 보고하고 작업 자세·도구·휴식 방법을 개선한다', '통증을 숨기고 같은 속도로 작업한다', '보호구 없이 작업시간을 늘린다', '개인 문제이므로 작업환경은 점검하지 않는다'],
    answer: 'A',
    explanation: '증상 조기 보고와 인간공학적 작업 개선, 적절한 휴식은 근골격계 위험을 줄이는 기본적인 예방 행동입니다.',
  },
]

function coverageQuestion(spec, index) {
  const correctIndex = index % 4
  const choices = [...spec.distractors]
  choices.splice(correctIndex, 0, spec.correct)
  return {
    id: `NCS26-COVER-${String(index + 1).padStart(3, '0')}`,
    area: spec.area,
    ncsAbility: spec.ability,
    ncsElement: spec.element,
    lessonId: `NCS26-${spec.ability}`,
    lessonTitle: `${spec.element} 직무 적용`,
    level: spec.level || '표준',
    stem: spec.stem,
    choices,
    answer: String.fromCharCode(65 + correctIndex),
    explanation: `정답은 '${spec.correct}'입니다. ${spec.why} 다른 선택지는 핵심 기준을 확인하지 않거나 실행·검증 단계를 빠뜨립니다.`,
  }
}

// 기존 문항을 해설 근거까지 분류한 뒤에도 2문항 미만인 공식 요소만 보완한다.
// 0문항 요소에는 서로 다른 상황 2개, 1문항 요소에는 새 상황 1개를 더한다.
const ELEMENT_COVERAGE_SPECS = [
  { area: '의사소통능력', ability: '구두소통능력', element: '의사표현능력', stem: '회의에서 작업 지연을 보고할 때 가장 적절한 표현은?', correct: '지연 원인, 영향, 새 완료 예정일을 사실 중심으로 말한다', distractors: ['원인을 생략하고 늦는다고만 말한다', '책임자를 추측하여 먼저 지목한다', '완료 가능성을 확인하지 않고 오늘 끝난다고 말한다'], why: '업무 의사표현은 상대가 판단할 수 있도록 사실·영향·요청이나 계획을 명확히 전달해야 합니다.' },
  { area: '의사소통능력', ability: '구두소통능력', element: '의사표현능력', stem: '상사에게 안전 절차 개선을 제안하는 말로 가장 적절한 것은?', correct: '현재 위험과 근거를 설명하고 실행 가능한 개선안을 요청한다', distractors: ['위험하다고 반복하되 근거는 말하지 않는다', '동료의 실수라고 단정하고 처벌을 요구한다', '결정권이 없으므로 아무 말도 하지 않는다'], why: '주장과 근거, 구체적 제안이 함께 있어야 상대가 내용을 오해 없이 검토할 수 있습니다.' },
  { area: '의사소통능력', ability: '구두소통능력', element: '대인소통능력', stem: '고객이 설명을 이해하지 못한 표정을 보일 때 가장 좋은 대응은?', correct: '이해한 내용을 질문으로 확인하고 쉬운 표현으로 다시 설명한다', distractors: ['같은 문장을 더 빠르게 반복한다', '안내문을 건네고 대화를 끝낸다', '고객이 집중하지 않았다고 지적한다'], why: '대인소통은 일방 전달이 아니라 상대의 반응을 확인하고 표현을 조정하는 상호작용입니다.' },
  { area: '의사소통능력', ability: '구두소통능력', element: '대인소통능력', stem: '부서 간 요청 내용이 서로 다를 때 소통 오류를 줄이는 방법은?', correct: '공통으로 합의한 내용과 남은 쟁점을 각 부서에 다시 확인한다', distractors: ['직급이 높은 부서의 말만 따른다', '두 요청을 임의로 섞어 처리한다', '기록 없이 비공식 대화만 이어 간다'], why: '상대별 관점을 확인하고 합의·쟁점을 명료화해야 관계 속 의사소통 오류를 줄일 수 있습니다.' },
  { area: '의사소통능력', ability: '외국어소통능력', element: '외국어 이해능력', stem: '거래처 메일의 “The order is subject to final inspection.”을 정확히 이해한 것은?', correct: '주문은 최종 검사 결과에 따라 확정될 수 있다', distractors: ['주문은 검사 없이 즉시 확정된다', '최종 검사는 이미 취소되었다', '주문 수량을 반드시 줄여야 한다'], why: 'be subject to는 어떤 조건이나 절차의 적용을 받는다는 의미이며 final inspection이 확정 전 조건입니다.' },
  { area: '의사소통능력', ability: '외국어소통능력', element: '외국어 표현능력', stem: '첨부파일 누락을 정중하게 다시 보내 달라고 요청하는 표현은?', correct: 'Could you please resend the file? It was not attached.', distractors: ['You forgot it. Send it now.', 'The file is wrong, maybe.', 'I will ignore the missing file.'], why: '문제 사실과 요청 행동을 정중하고 구체적으로 표현한 문장입니다.' },
  { area: '의사소통능력', ability: '외국어소통능력', element: '외국어 상황대응능력', stem: '외국인 고객이 알레르기 성분을 물었으나 즉시 확인할 수 없을 때 대응은?', correct: '잠시 기다려 달라고 안내하고 공식 성분표나 담당자에게 확인한다', distractors: ['아마 없을 것이라고 추측해 답한다', '질문과 관계없는 메뉴를 추천한다', '못 알아들은 척하고 주문을 진행한다'], why: '안전 관련 외국어 상황에서는 추측하지 않고 확인 절차와 대기 안내를 분명히 해야 합니다.' },
  { area: '수리능력', ability: '연산능력', element: '어림값 계산', stem: '개당 9,800원인 부품 51개의 예산을 빠르게 점검할 때 적절한 어림은?', correct: '약 10,000원 × 50개로 보아 약 50만 원으로 판단한다', distractors: ['9,800원을 1,000원으로 보아 약 5만 원으로 판단한다', '51개를 500개로 보아 약 500만 원으로 판단한다', '단위를 무시하고 9,851원으로 더한다'], why: '검산 목적의 어림은 계산하기 쉬운 가까운 수로 바꾸되 실제 값의 규모와 단위를 유지해야 합니다.' },
  { area: '수리능력', ability: '연산능력', element: '어림값 계산', stem: '하루 평균 198개를 생산하는 공정의 5일 생산량을 빠르게 예상한 값으로 가장 적절한 것은?', correct: '하루 약 200개로 보아 약 1,000개로 예상한다', distractors: ['하루 약 20개로 보아 약 100개로 예상한다', '198과 5를 더해 약 203개로 예상한다', '정확한 계산이 아니므로 전혀 예상할 수 없다'], why: '어림값은 실제 값과 가까운 계산하기 쉬운 수를 사용해 전체 규모를 빠르게 판단하되 단위와 연산 관계를 유지해야 합니다.' },
  { area: '수리능력', ability: '연산능력', element: '단위 환산', stem: '2.5kg의 원재료를 g으로 바르게 환산한 값은?', correct: '2,500g', distractors: ['25g', '250g', '25,000g'], why: '1kg은 1,000g이므로 2.5×1,000=2,500g입니다.' },
  { area: '수리능력', ability: '연산능력', element: '단위 환산', stem: '작업시간 1시간 45분을 분으로 나타내면?', correct: '105분', distractors: ['75분', '145분', '175분'], why: '1시간은 60분이므로 60+45=105분이며 시간과 분을 십진수처럼 붙이지 않습니다.' },
  { area: '수리능력', ability: '통계활용능력', element: '자료의 요약과 분포', stem: '처리시간이 8, 9, 9, 10, 34분일 때 대표값으로 중앙값을 함께 봐야 하는 이유는?', correct: '34분이라는 극단값이 평균을 크게 올리기 때문이다', distractors: ['자료 수가 홀수이면 평균을 구할 수 없기 때문이다', '중앙값은 항상 최댓값과 같기 때문이다', '모든 값이 같은 빈도로 나타나기 때문이다'], why: '분포에 극단값이 있으면 평균만으로 전형적인 처리시간을 설명하기 어려워 중앙값을 함께 확인해야 합니다.' },
  { area: '수리능력', ability: '통계활용능력', element: '자료의 요약과 분포', stem: '두 팀의 평균 생산량이 같을 때 작업 안정성을 비교하려면 추가로 볼 값은?', correct: '생산량의 범위나 표준편차 등 산포도', distractors: ['팀 이름의 글자 수', '자료를 적은 순서', '가장 최근 값 하나'], why: '평균이 같아도 값이 퍼진 정도는 다를 수 있으므로 분포와 산포를 확인해야 안정성을 비교할 수 있습니다.' },
  { area: '수리능력', ability: '통계활용능력', element: '확률과 추론', stem: '불량률을 추정하려고 첫 상자 한 개만 검사한 결과를 전체 생산품에 적용하면 곤란한 이유는?', correct: '표본이 전체 생산품을 대표하지 못할 수 있기 때문이다', distractors: ['표본에서는 비율을 계산할 수 없기 때문이다', '불량품은 확률과 관계없기 때문이다', '표본이 작을수록 항상 정확하기 때문이다'], why: '통계적 추론은 모집단을 대표하도록 표본을 선정하고 표본오차를 고려해야 합니다.' },
  { area: '수리능력', ability: '도표활용능력', element: '도표의 작성과 활용', stem: '월별 매출 변화 추세를 가장 알아보기 쉽게 표현할 도표는?', correct: '시간 순서에 따른 꺾은선그래프', distractors: ['항목 이름만 적은 목록', '비율 정보가 없는 원그래프', '축과 단위가 없는 그림'], why: '시간에 따른 연속적 증감과 추세 비교에는 순서와 축이 드러나는 꺾은선그래프가 적절합니다.' },
  { area: '수리능력', ability: '도표활용능력', element: '도표의 이해', stem: '막대그래프의 세로축에 단위가 만 원으로 표시되어 있고 막대 높이가 35일 때 바르게 이해한 값은?', correct: '35만 원', distractors: ['35원', '3,500원', '3,500만 원'], why: '도표를 이해할 때는 축의 제목과 단위를 먼저 확인해야 눈금값을 실제 수량으로 정확히 읽을 수 있습니다.' },
  { area: '수리능력', ability: '도표활용능력', element: '도표의 이해', stem: '주간 생산량 꺾은선그래프의 세로축 단위가 개이고 수요일 점이 240에 있을 때 확인할 수 있는 사실은?', correct: '수요일 생산량은 240개이다', distractors: ['수요일 불량품은 240개이다', '수요일 생산시간은 240분이다', '한 주 전체 생산량은 240개이다'], why: '점의 가로축 항목은 수요일이고 세로축이 생산량(개)이므로 두 축이 만나는 값 240개를 읽어야 합니다. 불량 수량·시간·주간 합계는 그래프에 제시되지 않았습니다.' },
  { area: '수리능력', ability: '도표활용능력', element: '도표의 작성과 활용', stem: '부서별 예산 막대그래프를 작성할 때 왜곡을 막는 기본 원칙은?', correct: '축의 단위와 눈금을 명시하고 비교 기준을 동일하게 둔다', distractors: ['차이를 크게 보이게 축을 임의로 자른다', '범례를 빼고 색만 다르게 한다', '서로 다른 단위를 한 축에 그대로 섞는다'], why: '도표는 같은 기준과 명확한 단위로 작성해야 독자가 크기 차이를 정확히 해석할 수 있습니다.' },
  { area: '문제해결능력', ability: '문제분석능력', element: '문제 인식 및 정의', stem: '고객 불만 증가 문제를 정의할 때 가장 먼저 구분할 것은?', correct: '관찰된 증상과 해결해야 할 핵심 문제', distractors: ['누가 처벌받아야 하는지', '가장 쉬운 해결책이 무엇인지', '다른 회사도 같은지 여부만'], why: '현상과 문제를 혼동하지 않아야 분석 범위와 목표를 정확히 정할 수 있습니다.' },
  { area: '문제해결능력', ability: '문제분석능력', element: '원인 분석 및 구조화', stem: '설비 정지가 반복될 때 원인을 구조화하는 방법으로 적절한 것은?', correct: '사람·설비·방법·환경 등 범주로 원인 후보와 근거를 정리한다', distractors: ['가장 최근 실수 하나를 원인으로 확정한다', '결과가 나쁠수록 원인도 하나라고 본다', '확인되지 않은 소문을 시간순으로 적는다'], why: '원인을 범주화하고 인과관계를 살펴야 복합 원인을 빠뜨리지 않고 검증할 수 있습니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '아이디어 생성 및 탐색', stem: '개선 아이디어를 충분히 탐색하는 초기 단계의 행동은?', correct: '평가를 잠시 보류하고 다양한 관점의 대안을 넓게 모은다', distractors: ['첫 아이디어를 즉시 확정한다', '기존 방식과 같은 제안만 받는다', '비판받을 가능성이 있는 의견은 제외한다'], why: '대안 탐색 단계에서는 판단과 생성을 분리하여 선택 가능한 범위를 넓히는 것이 중요합니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '아이디어 생성 및 탐색', stem: '포장 공정의 대기시간을 줄일 대안을 찾을 때 탐색 범위를 넓히는 질문은?', correct: '공정 순서·인력 배치·설비 사용시간을 각각 바꾸면 어떤 대안이 가능한가', distractors: ['기존 순서를 그대로 유지할 이유만 찾을 수 있는가', '회의 전에 한 가지 안을 확정할 수 있는가', '제안자의 직급만으로 채택할 안을 정할 수 있는가'], why: '아이디어 탐색은 문제의 구성요소를 나누고 각 요소를 바꾸거나 결합해 여러 대안을 만드는 단계입니다. 기존안 고정·성급한 확정·제안자 기준 선택은 탐색 범위를 줄입니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '대안 비교 및 평가', stem: '세 개선안을 공정하게 비교하는 방법은?', correct: '비용·효과·시간·위험 등 같은 평가기준과 가중치를 적용한다', distractors: ['제안자 직급이 높은 안을 고른다', '장점만 가장 많이 적힌 안을 고른다', '각 안에 서로 다른 기준을 적용한다'], why: '대안 비교는 공통 기준을 사전에 정하고 근거 자료로 평가해야 일관성과 설명 가능성이 생깁니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '대안 비교 및 평가', stem: '납기 단축안 두 가지의 효과가 비슷할 때 더 타당한 비교 방법은?', correct: '필요 인력·비용·품질 위험을 같은 기준으로 점수화해 비교한다', distractors: ['먼저 제시된 안을 선택한다', '설명이 짧은 안을 선택한다', '한 안은 비용만, 다른 안은 속도만 평가한다'], why: '효과가 비슷한 대안은 동일한 평가기준으로 자원과 위험까지 비교해야 선택 근거를 설명할 수 있습니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '실행가능성 검토', stem: '좋은 아이디어를 실행안으로 채택하기 전에 반드시 확인할 것은?', correct: '예산·인력·기한·법규와 예상 위험 안에서 실제 수행 가능한지', distractors: ['제안 문서의 글꼴이 보기 좋은지', '제안자가 회의에서 말을 많이 했는지', '다른 대안을 모두 삭제했는지'], why: '효과가 커 보여도 자원과 제약, 위험을 통과하지 못하면 실행 가능한 대안이 아닙니다.' },
  { area: '문제해결능력', ability: '대안발굴능력', element: '실행가능성 검토', stem: '일주일 안에 시스템을 전면 교체하자는 안의 실행가능성을 검토하는 질문은?', correct: '중단시간, 데이터 이전, 인력과 복구계획을 일주일 안에 확보할 수 있는가', distractors: ['새 화면의 색상이 유행에 맞는가', '제안서 제목이 짧은가', '누가 처음 아이디어를 냈는가'], why: '실행가능성은 실제 제약조건과 실패 시 대응능력을 구체적으로 확인해야 판단할 수 있습니다.' },
  { area: '자기관리능력', ability: '적응학습능력', element: '변화대응 학습인식', stem: '새 규정 시행 전에 학습 필요를 판단하는 올바른 방법은?', correct: '바뀐 업무 요구와 현재 수행능력의 차이를 확인한다', distractors: ['시험 날짜가 없으면 학습하지 않는다', '동료가 배우는 내용만 그대로 따른다', '예전 방식이 익숙하므로 변화가 없다고 본다'], why: '변화가 요구하는 역량과 현재 역량의 차이를 인식해야 필요한 학습을 선택할 수 있습니다.' },
  { area: '자기관리능력', ability: '경력개발능력', element: '직업세계 이해', stem: '관심 직무의 실제 업무와 성장 경로를 정확히 이해하는 방법은?', correct: '직무기술서와 현직자 정보, 채용 공고를 함께 비교한다', distractors: ['직업 이름의 느낌만으로 판단한다', '급여 정보 하나만 보고 업무를 추측한다', '친구가 선호하는 직업을 그대로 선택한다'], why: '직업세계 이해는 직무의 과업·필요 역량·근무환경·경력 경로를 신뢰할 수 있는 여러 자료로 확인하는 과정입니다.' },
  { area: '자기관리능력', ability: '경력개발능력', element: '경력개발계획 수립', stem: '설비보전 직무를 목표로 한 학생이 경력개발계획을 세우는 첫 순서로 가장 적절한 것은?', correct: '채용요건과 현재 역량을 비교해 보완할 기술·자격·경험을 정한다', distractors: ['유명한 자격증을 직무와 무관하게 모두 신청한다', '졸업 직전에 처음으로 채용요건을 확인한다', '친구의 계획을 자신의 계획으로 그대로 사용한다'], why: '경력개발계획은 목표 직무가 요구하는 역량과 자신의 현재 수준 사이의 차이를 확인한 뒤 구체적인 보완 과제를 정해야 합니다.' },
  { area: '자기관리능력', ability: '경력개발능력', element: '경력개발계획 수립', stem: '세운 경력개발계획을 실제 행동으로 이어지게 하는 방법은?', correct: '실습·자격 준비·포트폴리오 목표에 기한과 점검 기준을 정한다', distractors: ['언젠가 노력한다는 문장만 적는다', '결과를 확인하지 않고 활동 수만 늘린다', '채용요건이 바뀌어도 처음 계획을 고치지 않는다'], why: '실행 가능한 계획에는 활동별 기한과 성과 기준, 중간 점검이 있어야 하며 환경과 결과에 따라 조정할 수 있어야 합니다.' },
  { area: '자기관리능력', ability: '적응학습능력', element: '자기주도 학습실행', stem: '업무 소프트웨어 학습을 자기주도적으로 실행한 사례는?', correct: '목표를 정하고 매뉴얼 학습·실습·질문 일정을 스스로 운영한다', distractors: ['교육 공지가 올 때까지 아무것도 하지 않는다', '동료가 만든 결과만 복사한다', '어려운 기능은 목표에서 계속 제외한다'], why: '자기주도 학습은 목표·방법·실행·점검을 학습자가 능동적으로 관리하는 행동입니다.' },
  { area: '자기관리능력', ability: '적응학습능력', element: '지속적 자기개발', stem: '교육 수료 뒤 지속적 자기개발로 이어지는 행동은?', correct: '업무 적용 결과와 피드백을 기록해 다음 학습목표를 세운다', distractors: ['수료증을 받으면 관련 자료를 폐기한다', '한 번 배운 방법은 수정하지 않는다', '실수는 평가에 불리하므로 기록하지 않는다'], why: '개발은 학습·적용·성찰·새 목표 설정이 반복될 때 지속됩니다.' },
  { area: '자기관리능력', ability: '시간관리능력', element: '효율적 시간 활용', stem: '집중이 필요한 보고서와 짧은 문의가 함께 있을 때 효율적인 방법은?', correct: '집중시간을 보호하고 짧은 문의는 묶어서 정한 시간에 처리한다', distractors: ['알림이 올 때마다 모든 업무를 중단한다', '쉬운 문의만 처리하고 보고서는 미룬다', '휴식 없이 여러 작업을 동시에 계속한다'], why: '유사 업무 묶기와 집중시간 확보는 전환 손실을 줄이고 중요한 작업의 품질을 지킵니다.' },
  { area: '자기관리능력', ability: '시간관리능력', element: '효율적 시간 활용', stem: '예상보다 작업이 늦어질 때 시간 활용을 바로잡는 행동은?', correct: '남은 시간과 진척을 재평가해 범위·순서·지원 요청을 조정한다', distractors: ['원래 계획이므로 상황과 무관하게 유지한다', '마감 직전까지 지연 사실을 숨긴다', '완료되지 않은 일을 완료로 표시한다'], why: '진행상황을 점검하고 계획을 현실에 맞게 조정해야 제한된 시간을 효과적으로 사용할 수 있습니다.' },
  { area: '대인관계능력', ability: '협업능력', element: '역할 이해', stem: '협업 시작 전에 역할 이해를 확인하는 가장 좋은 방법은?', correct: '각자의 책임·권한·산출물·인계 시점을 함께 확인한다', distractors: ['직급만 보고 역할을 추측한다', '일이 생길 때마다 담당자를 정한다', '공동업무이므로 책임자를 두지 않는다'], why: '역할의 범위와 연결 지점을 명확히 해야 누락과 중복을 예방할 수 있습니다.' },
  { area: '대인관계능력', ability: '협업능력', element: '역할 이해', stem: '내 역할과 다른 팀원의 역할이 겹치는 것을 발견했을 때 먼저 할 일은?', correct: '공동목표와 업무분장표를 기준으로 책임 경계를 확인한다', distractors: ['상대 업무를 알리지 않고 가져온다', '겹치는 업무를 모두 중단한다', '성과가 큰 부분만 자신의 역할이라 주장한다'], why: '역할 이해는 개인 주장보다 합의된 목표와 분장 기준에서 책임과 협력 범위를 파악하는 것입니다.' },
  { area: '대인관계능력', ability: '리더십', element: '자기 리더십', stem: '자기 리더십을 발휘한 행동은?', correct: '목표와 기준을 스스로 점검하고 필요한 행동을 먼저 실천한다', distractors: ['지시가 없으면 중요한 일도 미룬다', '문제가 생기면 동료 결정을 기다린다', '성과만 강조하고 약속은 지키지 않는다'], why: '자기 리더십은 자신의 목표·동기·행동을 관리하며 솔선하는 데서 시작합니다.' },
  { area: '대인관계능력', ability: '리더십', element: '자기 리더십', stem: '실수 뒤 자기 리더십에 맞는 대응은?', correct: '책임을 인정하고 원인과 개선 행동을 정해 실행한다', distractors: ['평가를 피하려고 실수를 숨긴다', '다른 사람도 실수했다고 변명한다', '자신감을 위해 검토 없이 같은 방식으로 재시도한다'], why: '자기 리더십은 감정적 회피가 아니라 책임 있는 성찰과 행동 조절을 포함합니다.' },
  { area: '대인관계능력', ability: '리더십', element: '동료 리더십', stem: '직급이 없어도 동료 리더십을 발휘하는 방법은?', correct: '목표 달성에 필요한 정보를 공유하고 동료의 참여를 격려한다', distractors: ['동료 업무를 허락 없이 통제한다', '어려운 일은 능숙한 동료에게만 넘긴다', '자신의 성과가 줄 수 있어 도움을 주지 않는다'], why: '동료 리더십은 권한보다 긍정적 영향, 지원, 참여 촉진을 통해 나타납니다.' },
  { area: '대인관계능력', ability: '리더십', element: '동료 리더십', stem: '새 동료가 업무에 어려움을 겪을 때 적절한 동료 리더십은?', correct: '필요한 기준과 경험을 나누고 스스로 수행할 기회를 제공한다', distractors: ['평가가 낮아질 수 있으니 업무에서 제외한다', '모든 일을 대신 처리해 의존하게 한다', '실수를 공개적으로 지적해 긴장시킨다'], why: '지원과 피드백으로 동료의 역량과 자율성을 높이는 행동이 동료 리더십입니다.' },
  { area: '대인관계능력', ability: '갈등관리능력', element: '갈등 조정', stem: '두 부서의 일정 갈등을 조정할 때 가장 먼저 합의할 것은?', correct: '공통목표와 사실, 각 부서가 양보할 수 없는 조건', distractors: ['어느 부서가 더 힘이 센지', '누가 먼저 불만을 제기했는지', '감정을 표현하지 못하게 할지'], why: '조정은 공통 기반과 핵심 이해관계를 분명히 한 뒤 선택 가능한 조건을 교환하는 과정입니다.' },
  { area: '대인관계능력', ability: '갈등관리능력', element: '갈등 조정', stem: '회의 중 서로 말을 끊는 갈등을 조정하는 진행 방식은?', correct: '발언 순서와 판단 기준을 합의하고 각 입장을 요약해 확인한다', distractors: ['큰 목소리의 의견부터 채택한다', '갈등 주제를 다루지 않고 회의를 끝낸다', '한쪽에게만 사과를 강요한다'], why: '공정한 절차와 상호 확인이 있어야 입장 차이를 해결 가능한 쟁점으로 바꿀 수 있습니다.' },
  { area: '대인관계능력', ability: '갈등관리능력', element: '갈등 해소', stem: '합의 뒤 갈등이 실제로 해소되도록 하는 행동은?', correct: '합의 내용·담당·기한을 기록하고 이행 결과와 관계 회복을 확인한다', distractors: ['합의했으므로 후속 확인을 하지 않는다', '갈등 원인을 개인 탓으로 공지한다', '비슷한 문제가 생겨도 이전 합의를 무시한다'], why: '갈등 해소는 합의 자체뿐 아니라 실행과 재발 방지, 관계 정상화까지 확인해야 완성됩니다.' },
  { area: '대인관계능력', ability: '갈등관리능력', element: '갈등 해소', stem: '중재로 업무분장을 다시 합의한 뒤 가장 적절한 마무리는?', correct: '양측이 이해한 역할을 재확인하고 일정 후 이행 상태를 점검한다', distractors: ['회의록 없이 각자 기억에 맡긴다', '문제를 다시 말하지 못하게 금지한다', '합의와 다른 지시를 비공개로 전달한다'], why: '상호 이해와 이행 점검이 남아 있어야 갈등이 재발하지 않고 협업 관계가 회복됩니다.' },
  { area: '디지털능력', ability: '디지털활용능력', element: '디지털을 활용한 문제해결', stem: '재고 오류가 반복될 때 디지털 도구를 문제해결에 활용하는 순서는?', correct: '오류 기준을 정하고 데이터를 정제·분석한 뒤 원자료로 결과를 검증한다', distractors: ['도구가 제시한 첫 결과를 바로 확정한다', '파일 이름만 바꾸고 원인은 조사하지 않는다', '분석 전 원자료를 삭제한다'], why: '디지털 도구는 문제 정의, 올바른 데이터 처리, 결과 검증과 연결될 때 문제해결 수단이 됩니다.' },
  { area: '디지털능력', ability: '디지털활용능력', element: '디지털을 활용한 문제해결', stem: '반복 입력 오류를 줄이기 위한 디지털 개선으로 적절한 것은?', correct: '입력 규칙과 검증 기능을 적용하고 시험 데이터로 오류 감소를 확인한다', distractors: ['입력 칸을 늘리기만 한다', '오류 기록을 숨기도록 설정한다', '사용자 확인 없이 전체 데이터를 덮어쓴다'], why: '자동화나 검증 기능은 원인에 맞게 설계하고 시험·확인한 뒤 적용해야 문제를 안전하게 해결합니다.' },
  { area: '디지털능력', ability: '인공지능(AI)활용능력', element: 'AI 기술 이해', stem: '생성형 AI의 특성을 올바르게 이해한 설명은?', correct: '그럴듯하지만 사실과 다른 답을 만들 수 있어 검증이 필요하다', distractors: ['항상 최신 공식자료만 사용한다', '같은 질문에는 언제나 같은 정답만 낸다', '업무 책임을 AI가 대신 진다'], why: '생성형 AI 출력은 확률적으로 생성되므로 정확성·최신성·출처를 사람이 확인해야 합니다.' },
  { area: '디지털능력', ability: '인공지능(AI)활용능력', element: 'AI 도구 선택 및 적용', stem: 'AI로 사내 문서를 처리하기 전 도구 선택 기준은?', correct: '업무 목적, 데이터 보안, 정확도, 조직 사용정책', distractors: ['광고 문구가 화려한지', '답변 길이가 가장 긴지', '개인 계정으로 즉시 쓸 수 있는지'], why: '도구의 기능뿐 아니라 데이터 처리와 조직 규정을 함께 검토해야 안전하게 적용할 수 있습니다.' },
  { area: '디지털능력', ability: '인공지능(AI)활용능력', element: 'AI를 활용한 문제해결', stem: 'AI가 제안한 수요예측을 업무에 적용하는 올바른 절차는?', correct: '데이터 품질과 가정을 확인하고 실제 결과와 비교해 보정한다', distractors: ['예측값을 검토 없이 발주량으로 확정한다', '현장정보가 다르면 현장정보를 삭제한다', '모델 이름만 보고 정확하다고 판단한다'], why: 'AI 활용 문제해결에는 입력·가정·출력 검증과 사람의 최종 판단이 필요합니다.' },
  { area: '디지털능력', ability: '디지털책임의식', element: '디지털 시민의식 실천', stem: '업무 단체대화방에서 디지털 시민의식을 실천한 행동은?', correct: '사실을 확인하고 개인정보와 타인의 권리를 존중해 필요한 범위만 공유한다', distractors: ['확인되지 않은 소문을 빠르게 전달한다', '동료 사진을 동의 없이 게시한다', '불편한 의견은 집단적으로 공격한다'], why: '디지털 공간에서도 사실성, 개인정보, 저작권, 존중과 책임이 실제 행동으로 이어져야 합니다.' },
  { area: '디지털능력', ability: '디지털책임의식', element: '디지털 시민의식 실천', stem: '온라인에서 잘못된 업무정보를 공유한 사실을 알게 되었을 때 책임 있는 행동은?', correct: '즉시 정정하고 영향을 받은 사람에게 알린 뒤 재발 방지 절차를 따른다', distractors: ['기록이 남으므로 아무 조치도 하지 않는다', '다른 사람이 발견할 때까지 기다린다', '작성자를 숨기기 위해 대화방을 삭제한다'], why: '디지털 시민의식은 자신의 온라인 행동 결과를 책임지고 피해를 줄이는 후속조치까지 포함합니다.' },
  { area: '직업윤리', ability: '직장공동체의식', element: '준법성', stem: '업무 관행이 회사 규정과 충돌하는 것을 발견했을 때 준법 행동은?', correct: '적용 규정을 확인하고 정해진 보고·시정 절차를 따른다', distractors: ['오래된 관행이므로 계속 따른다', '성과가 좋으면 규정을 생략한다', '개인 판단으로 기록을 삭제한다'], why: '준법성은 법령과 조직 규정의 목적을 이해하고 절차에 따라 실제 업무를 바로잡는 태도입니다.' },
  { area: '직업윤리', ability: '근로윤리', element: '공정의식', stem: '협력업체 제안서를 평가할 때 공정의식을 실천한 행동은?', correct: '사전에 공개한 동일 기준으로 모든 제안서를 채점하고 이해관계를 신고한다', distractors: ['친분이 있는 업체에 평가기준을 먼저 알려 준다', '업체 규모에 따라 서로 다른 배점을 적용한다', '평가가 끝난 뒤 특정 업체에 맞게 기준을 바꾼다'], why: '공정한 평가는 같은 기준과 절차를 일관되게 적용하고 사적 이해관계가 판단에 영향을 주지 않도록 공개·회피하는 행동입니다.' },
  { area: '직업윤리', ability: '직장공동체의식', element: '준법성', stem: '상사가 개인정보를 개인 메신저로 보내라고 지시할 때 적절한 대응은?', correct: '보안 규정을 설명하고 승인된 전송수단과 절차를 사용한다', distractors: ['상사 지시이므로 규정을 무시한다', '개인 메신저로 보낸 뒤 대화를 지운다', '업무 속도를 위해 공개 대화방에 올린다'], why: '직급이나 편의보다 법과 보안 규정을 지키며 합법적인 대안을 제시하는 것이 준법 행동입니다.' },
  { area: '직업윤리', ability: '산업안전보건의식', element: '안전보건의식 및 책임 이해', stem: '작업자가 안전보건 책임을 이해한 행동은?', correct: '자신과 동료에게 영향을 주는 위험을 확인하고 즉시 보고한다', distractors: ['안전은 관리자만 책임진다고 본다', '사고가 나기 전에는 위험이 아니라고 본다', '작업량이 많으면 점검을 생략한다'], why: '안전보건은 조직과 근로자가 각자의 역할을 이해하고 위험을 함께 예방해야 하는 공동 책임입니다.' },
  { area: '직업윤리', ability: '산업안전보건의식', element: '안전보건규범 준수', stem: '보호구가 불편하다는 이유로 벗고 작업하자는 제안에 맞는 대응은?', correct: '작업을 멈추고 적합한 보호구를 확인한 뒤 규정대로 착용한다', distractors: ['짧은 작업이면 벗어도 된다고 동의한다', '감독자가 없을 때만 벗는다', '동료가 쓰면 자신은 쓰지 않아도 된다고 본다'], why: '안전보건규범은 작업시간이나 감독 여부와 관계없이 위험 통제를 위해 지켜야 합니다.' },
  { area: '직업윤리', ability: '산업안전보건의식', element: '위험예방 및 건강관리 실천', stem: '반복 작업자의 피로와 통증을 예방하는 실천은?', correct: '작업자세·도구·작업주기·휴식을 점검하고 이상을 조기에 보고한다', distractors: ['통증을 참고 작업속도를 높인다', '보호조치 없이 개인 체력만 기른다', '증상이 심해질 때까지 기록하지 않는다'], why: '건강장해 예방은 위험요인을 줄이는 작업개선과 조기 보고·관리로 이루어집니다.' },
]

const ELEMENT_COVERAGE_QUESTIONS = ELEMENT_COVERAGE_SPECS.map(coverageQuestion)

function lessonNumber(q) {
  const match = String(q?.lessonId || '').match(/^C(\d+)/)
  return match ? Number(match[1]) : null
}

function mappedTarget(q) {
  const legacyArea = q.area
  const n = lessonNumber(q)
  const text = `${q.lessonTitle || ''} ${q.stem || ''}`

  if (legacyArea === '의사소통') {
    if ((n >= 25 && n <= 28) || n === 31) return ['의사소통능력', '구두소통능력']
    return ['의사소통능력', '문서소통능력']
  }
  if (legacyArea === '수리') {
    if ([45, 46, 47, 48, 58, 59, 62, 63, 64, 73, 76, 222, 223, 224].includes(n)) return ['수리능력', '연산능력']
    if ([52, 53, 55, 56, 67, 207].includes(n)) return ['수리능력', '통계활용능력']
    return ['수리능력', '도표활용능력']
  }
  if (legacyArea === '문제해결') {
    if ((n >= 77 && n <= 84) || (n >= 93 && n <= 96) || n === 101) return ['문제해결능력', '문제분석능력']
    if ([85, 86, 88, 90, 100, 104].includes(n)) return ['문제해결능력', '대안발굴능력']
    return ['문제해결능력', '의사결정능력']
  }
  if (legacyArea === '자원관리') {
    if (n >= 105 && n <= 107) return ['자기관리능력', '시간관리능력']
    return ['문제해결능력', '의사결정능력']
  }
  if (legacyArea === '자기개발') return ['자기관리능력', '경력개발능력']
  if (legacyArea === '대인관계') {
    if (n === 136 || /리더십|팔로워/.test(text)) return ['대인관계능력', '리더십']
    if ([135, 138].includes(n) || /갈등|협상|조정/.test(text)) return ['대인관계능력', '갈등관리능력']
    return ['대인관계능력', '협업능력']
  }
  if (legacyArea === '정보능력' || legacyArea === '기술능력') {
    if (/개인정보|보안|저작권|윤리|책임/.test(text)) return ['디지털능력', '디지털책임의식']
    return ['디지털능력', '디지털활용능력']
  }
  if (legacyArea === '직업윤리') {
    if (/공동체|협력|존중|포용|규범|질서/.test(text)) return ['직업윤리', '직장공동체의식']
    return ['직업윤리', '근로윤리']
  }
  if (legacyArea === '조직이해') return ['문제해결능력', '문제분석능력']
  return null
}

const ELEMENT_PATTERNS = {
  '문서소통능력': [/이해|읽기|파악|해석|요약/, /작성|보고서|기안|문서화/, /표현|발표|시각화|전달/],
  '구두소통능력': [/경청|듣기|요지|지시/, /의사표현|설명|말하기|발언/, /대화|소통|질문|응대/],
  '외국어소통능력': [/이해|해석|번역|읽기|듣기/, /표현|작성|말하기|회신/, /상황|응대|요청|확인/],
  '연산능력': [/계산|연산|수치|비율|분수|소수/, /어림|근사|추정|개략/, /단위|환산|변환/],
  '통계활용능력': [/통계의 기초|백분율|평균|확률/, /분포|중앙값|최빈값|산포|요약/, /추론|표본|예측|신뢰/],
  '도표활용능력': [/도표.*이해|표.*읽|그래프.*읽|정보.*확인/, /도표.*해석|비교|추세|증감/, /도표.*작성|시각화|그래프.*작성|표.*작성/],
  '문제분석능력': [/문제.*인식|문제.*정의|현상|쟁점/, /정보.*수집|자료.*수집|검증|사실.*확인/, /원인.*분석|구조화|영향.*분석/],
  '대안발굴능력': [/아이디어|대안.*탐색|대안.*발굴/, /대안.*비교|장단점|대안.*평가/, /실행가능|타당성|제약.*검토/],
  '의사결정능력': [/의사결정.*기준|판단.*기준|우선순위/, /의사결정.*수행|대안.*선택|결정.*검토/, /성찰|피드백|결과.*평가|개선/],
  '경력개발능력': [/자기이해|강점|흥미|가치/, /직업세계|직무|진로정보/, /계획|경력|목표/],
  '적응학습능력': [/변화|학습필요|인식/, /자기주도|학습실행|훈련/, /지속|개발|피드백/],
  '시간관리능력': [/시간자원|소요시간|마감/, /계획|일정|우선순위/, /활용|집중|효율/],
  '협업능력': [/역할.*이해|역할.*인식|책임.*이해/, /역할.*조율|역할.*분담|업무.*조정/, /협업.*문제해결|협력|공유|지원/],
  '리더십': [/자기.*리더십|솔선|자기주도/, /동료.*리더십|동료.*격려|긍정.*영향/, /팀.*리더십|팀.*목표|구성원.*참여/],
  '갈등관리능력': [/갈등.*이해|갈등.*원인|입장.*파악/, /갈등.*조정|협상|의견.*조정/, /갈등.*해소|합의|관계.*회복/],
  '디지털활용능력': [/도구|프로그램|기기/, /정보처리|데이터|파일/, /문제해결|자동화|적용/],
  '인공지능(AI)활용능력': [/이해|원리|한계/, /선택|프롬프트|적용/, /검증|문제해결|결과/],
  '디지털책임의식': [/윤리|규범|저작권|개인정보/, /준수|보안|보호/, /시민|책임|피해예방/],
  '근로윤리': [/성실|근면|시간준수/, /책임|완수|보고/, /공정|정직|이해충돌/],
  '직장공동체의식': [/존중|배려|다양성/, /협력|공동체|상생/, /준법|규정|질서/],
  '산업안전보건의식': [/의식|책임|위험인식/, /규범|보호구|절차|준수/, /예방|건강|점검|개선/],
}

function classifyElement(areaId, abilityId, q) {
  const ability = NCS_2026_AREAS
    .find(area => area.id === areaId)?.abilities
    .find(item => item.id === abilityId)
  if (!ability) return { element: null, basis: 'invalid-ability' }
  // Choices often contain every candidate concept, including distractors.  Use the
  // authored explanation instead so element alignment is based on the reasoning
  // students are actually taught, not on a word that merely appears in an option.
  const text = `${q.lessonTitle || ''} ${q.stem || ''} ${q.context || ''} ${q.explanation || ''}`
  const patterns = ELEMENT_PATTERNS[abilityId] || []
  const index = patterns.findIndex(pattern => pattern.test(text))
  if (index >= 0 && ability.elements[index]) {
    return { element: ability.elements[index], basis: `content-keyword:${ability.elements[index]}` }
  }
  return { element: null, basis: `ability-only:${abilityId}` }
}

// 요구 수준(공식 등급기술 앵커 기준)을 모든 문항에 붙인다. 기존 level 은 유지.
function attachStandardBase(q, mappingStatus = 'mapped-practice') {
  const target = q.ncsAbility ? [q.area, q.ncsAbility] : mappedTarget(q)
  if (!target) return null
  const [area, ability] = target
  const officialAbility = NCS_2026_AREAS
    .find(item => item.id === area)?.abilities
    .find(item => item.id === ability)
  const classified = q.ncsElement && officialAbility?.elements.includes(q.ncsElement)
    ? { element: q.ncsElement, basis: 'explicit-source-metadata' }
    : classifyElement(area, ability, q)
  const element = classified.element
  return {
    ...q,
    legacyArea: q.legacyArea || q.area,
    area,
    ncsAbility: ability,
    ncsElement: element,
    classificationBasis: classified.basis,
    standardAuthority: NCS_2026.authority.id,
    standardVersion: NCS_2026.authority.version,
    alignmentStatus: mappingStatus,
    appPracticeOutcome: `${element || ability}을 직무 상황에 적용할 수 있다.`,
    appPracticeEvidence: `제시된 직무 상황에서 ${element || ability}에 맞는 판단이나 행동을 선택했는지 확인한다.`,
  }
}


// 표준 원문 쪽수까지 파일 _source 에 적어 두었다. 근거 추적이 되어야 검수가 가능하다.
const SUPPLEMENT_QUESTIONS = [
  ...supForeign.questions,
  ...supAdaptive.questions,
  ...supAi.questions,
  ...supSafety.questions,
  ...supStatTime.questions,
  ...supCollabLead.questions,
  ...supConflict.questions,
  ...supEthics.questions,
]

function attachStandard(...args) {
  const out = attachStandardBase(...args)
  return out ? attachDemand(out) : out
}

// ── 원본 교재 추출 은행 편입 ────────────────────────────────────────────────
//
// `ncs-extracted-bank.json` 은 원본 교재에서 기계로 뽑은 1,329문항이다.
// 그동안 학습 경로에 넣지 못한 이유가 두 가지 있었다.
//
//   ① 727문항의 발문 자리에 지문 조각·문서 제목이 들어가 있었다
//      → repair-question-stems.py 로 532개를 되돌렸다(정상 발문 602 → 1,141)
//   ② areaHint 가 전부 비어 있어 어느 영역인지 알 수 없었다
//      → ncs-lesson-area-map.json 이 차시(lessonId) → 영역을 224개 담고 있고,
//        이 은행의 lessonId 211종을 100% 덮는다
//
// 남은 파손 188문항은 넣지 않는다. 발문이 여전히 질문 구실을 못 한다.
const EXTRACTED_Q = /[?？]|것은|것을|무엇|어느|고르|하는가|인가|알맞은|적절한|옳은|옳지|쓰시오|하시오|골라|구하면|얼마|몇|바르게|틀린|까요|나요/
const EXTRACTED_ASCII = /[┤┴┬├┼]/
const LESSON_AREA = lessonAreaMap.map || {}

const extractedUsable = (extractedBank.questions || extractedBank || [])
  .filter(q => {
    const ch = Array.isArray(q.choices) ? q.choices : []
    if (!q.stem || ch.length < 2) return false
    if (!EXTRACTED_Q.test(q.stem)) return false                 // 아직 파손된 발문
    if (EXTRACTED_ASCII.test(`${q.stem}${q.context || ''}`)) return false  // 뭉개진 도표
    return !!LESSON_AREA[q.lessonId]
  })
  .map(q => {
    const meta = LESSON_AREA[q.lessonId]
    return {
      ...q,
      // mappedTarget 은 레거시 영역명과 차시 번호로 26v1 을 찾는다.
      area: meta.legacyArea || q.area,
      lessonTitle: q.lessonTitle || meta.title || '',
      vol: q.vol ?? meta.vol,
      subject: meta.subject,
      answerSource: q.answerSource || 'extracted-from-textbook',
    }
  })

// 채용 필기 트랙(금융·경제·경영·일반상식·인적성)은 NCS 공식 영역이 아니다.
const extractedNcs = extractedUsable.filter(q => q.subject === 'ncs-basic')
export const extractedRecruit = extractedUsable.filter(q => q.subject === 'recruit-written')

/** 발문+보기가 같은 문항을 하나만 남기는 필터를 만든다.
 *
 * ncs-questions.json 과 ncs-extracted-bank.json 은 같은 원본 교재에서 나왔다.
 * 편입하니 215묶음 220문항이 겹쳤다(NCS-C001-diagnosis = NCSX-v1-C001-Q01).
 * id 가 달라 id 기준 검사로는 안 잡힌다. 앞선 것을 남기므로 손질을 거친
 * ncs-questions.json 쪽이 우선된다.
 */
function dedupeByContent() {
  const seen = new Set()
  const flat = t => String(t ?? '').replace(/[\s'"·,.()[\]]/g, '')
  return q => {
    if (q.sourceUse === 'structure-and-competency-only-no-source-item-text') {
      const key = questionContentKey(q)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }
    const stem = flat(q.stem)
    if (stem.length < 12) return true
    const ch = Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
    // 보기를 **정렬해서** 비교한다. 순서까지 열쇠에 넣으면, 정답 위치 균형을
    // 맞추려고 보기 순서를 돌린 순간 같은 문항이 다른 문항으로 보인다.
    // 실제로 그렇게 돼서 쌍둥이 문항 한 쌍이 둘 다 출제 풀에 들어왔다.
    const key = `${stem}|${flat([...ch].map(String).sort().join('|'))}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}

export const ncs2026Questions = applyQuestionIntegrityToPool([
  ...rawNcsQuestions
    .filter(isCurrentNcsQuestion)
    .map(q => attachStandard(q))
    .filter(Boolean),
  ...GAP_QUESTIONS.map(q => attachStandard({
    ...q,
    answerSource: 'authored_from_26v1_definition',
    sourceUrl: NCS_2026.authority.sourceUrl,
    excludeFromQuiz: false,
  }, '26v1-gap-supplement')),
  ...ELEMENT_COVERAGE_QUESTIONS.map(q => attachStandard({
    ...q,
    answerSource: 'authored_from_26v1_definition',
    sourceUrl: NCS_2026.authority.standardSourceUrl,
    excludeFromQuiz: false,
  }, '26v1-element-coverage')),
  // 26v1 표준 원문의 상황(C)·지식(K)·기술(S)에 근거해 얇은 하위능력 4개를 보강했다.
  // 보강 전 각 6문항이라 시험 대비로 쓸 수 없었다(문서소통 180문항 대비).
  ...SUPPLEMENT_QUESTIONS.map(q => attachStandard({
    ...q,
    sourceUrl: NCS_2026.authority.standardSourceUrl,
    excludeFromQuiz: false,
  }, '26v1-cks-supplement')),
  // excludeFromQuiz 를 무조건 false 로 덮어쓰면, 검수에서 "이 문항은 조건이
  // 답을 결정하지 못한다"고 빼 둔 것이 도로 살아난다. 원본이 명시적으로
  // 빼 둔 것만 그대로 두고, 값이 없는 것만 출제 대상으로 올린다.
  ...extractedNcs
    .map(q => attachStandard({ ...q, excludeFromQuiz: q.excludeFromQuiz === true }, 'extracted-textbook'))
    .filter(Boolean),
  ...(independentAssessmentBank.questions || [])
    .map(q => attachStandard(q, 'independent-26v1-blueprint'))
    .filter(Boolean),
].filter(dedupeByContent()))

export const ncsLegacyQuestions = rawNcsQuestions.filter(q => !RECRUITMENT_EXTRA_AREAS.has(q.area))
export const ncsRecruitmentExtras = rawNcsQuestions.filter(q => RECRUITMENT_EXTRA_AREAS.has(q.area))

export function buildNcs2026Areas(questions = ncs2026Questions) {
  return NCS_2026_AREAS.map(area => {
    const areaQuestions = questions.filter(q => !q.excludeFromQuiz && q.area === area.id)
    return {
      id: area.id,
      label: area.id,
      displayName: area.id,
      code: area.code,
      qCount: areaQuestions.length,
      totalQuestions: areaQuestions.length,
      abilities: area.abilities.map(ability => ({
        id: ability.id,
        label: ability.id,
        title: ability.id,
        elements: ability.elements,
        questionCount: areaQuestions.filter(q => q.ncsAbility === ability.id).length,
      })),
      lessons: area.abilities.map(ability => ({
        id: ability.id,
        label: ability.id,
        title: ability.id,
        questionCount: areaQuestions.filter(q => q.ncsAbility === ability.id).length,
      })),
    }
  })
}

export function ncs2026Coverage(questions = ncs2026Questions) {
  return NCS_2026_AREAS.map(area => ({
    area: area.id,
    abilities: area.abilities.map(ability => ({
      ability: ability.id,
      count: questions.filter(q => !q.excludeFromQuiz && q.ncsAbility === ability.id).length,
      elements: ability.elements.map(element => ({
        element,
        count: questions.filter(q => !q.excludeFromQuiz && q.ncsAbility === ability.id && q.ncsElement === element).length,
      })),
      abilityOnlyCount: questions.filter(q => !q.excludeFromQuiz && q.ncsAbility === ability.id && !q.ncsElement).length,
    })),
  }))
}
