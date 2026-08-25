import { interviewFoundationArea } from './interviewFoundationCourses.js'
import { EXTRA_COVER_QUESTIONS } from './coverLetterGuidance.js'

const learningUnit = (title, concept, example, trap, practice) => ({ title, concept, example, trap, practice })
const learningModule = (id, title, focus, lessons, completion) => ({ id, title, focus, lessons, completion })

export const INTERVIEW_TRACKS = [
  {
    id: 'finance',
    label: '금융권 면접',
    description: '고객 신뢰, 금융 윤리, 상품 이해, 디지털 서비스까지 연결함.',
    completion: '고객 상황형 질문에 보호 원칙·설명·대안을 포함해 60초 안에 답함.',
    modules: [
      learningModule('finance-role', '은행의 역할과 고객 신뢰', '예금·대출·결제의 기본 역할을 고객 관점에서 설명함.', [
        learningUnit('은행은 무엇으로 신뢰를 만드는가', '돈을 맡고 빌려주는 기능만이 아니라 정보 비대칭을 줄이고 거래를 안전하게 연결하는 역할임.', '상품을 권하기 전에 고객의 목적·기간·위험 감수 수준을 확인하고 이해 여부를 다시 묻는 행동으로 설명함.', '친절함만 강조하고 정확한 확인·기록·보호 절차를 말하지 않음.', '금융을 잘 모르는 고객에게 적금과 예금의 차이를 40초로 설명함.'),
        learningUnit('개인금융과 기업금융 구분', '개인은 생활 안정과 자산 관리, 기업은 운전자금·투자·현금흐름 지원 관점이 중심임.', '기업의 매출 시기와 자금 사용 목적을 확인한 뒤 적합한 절차를 안내한다고 답함.', '모든 고객에게 같은 상품을 빠르게 판매하는 것이 성과라고 말함.', '소상공인이 급히 자금을 문의한 상황에서 먼저 확인할 질문 3개를 말함.'),
        learningUnit('고객 신뢰를 증명하는 경험', '신뢰는 성격이 아니라 정확한 설명·재확인·기록·약속 준수 행동으로 증명함.', '교내 판매 정산에서 영수증과 거래표를 대조하고 수정 내역을 팀에 공유한 경험을 연결함.', '“저는 원래 꼼꼼합니다”로 끝내고 확인 가능한 결과를 제시하지 않음.', '내 경험에서 오류를 발견하고 다시 확인한 행동을 3문장으로 정리함.'),
      ], '지원 은행의 고객·기업 지원 역할 1개와 내 경험 근거 1개를 연결함.'),
      learningModule('finance-ethics', '금융소비자 보호와 윤리', '불완전판매, 개인정보, 내부통제 상황에서 원칙을 선택함.', [
        learningUnit('불완전판매를 막는 설명', '고객의 이해 없이 서명만 받는 것은 판매가 완료된 것이 아님. 핵심 위험·비용·중도해지 조건을 확인함.', '시간이 부족해도 핵심 위험을 쉬운 말로 설명하고 고객이 자신의 말로 다시 말하도록 확인함.', '고객이 원했으니 설명 책임도 고객에게 있다고 답함.', '고객이 “그냥 제일 수익 높은 것으로 해 달라”고 할 때 답변 순서를 말함.'),
        learningUnit('개인정보와 업무 편의 충돌', '업무가 빨라져도 본인 확인·권한·전송 경로 원칙을 생략할 수 없음.', '메신저로 고객 자료를 보내 달라는 요청에 공식 채널과 승인 절차를 안내함.', '선배의 지시이므로 그대로 처리한다고 답함.', '권한 없는 자료 요청을 받았을 때 거절·보고·대안 순서로 답함.'),
        learningUnit('실적 압박 속 내부통제', '목표 달성과 규정 준수는 선택 관계가 아님. 위반 가능성을 멈추고 사실을 남겨 보고함.', '숫자를 맞추기 위한 임의 처리 제안을 거절하고 정상 절차의 대안을 찾음.', '조직 분위기를 위해 한 번쯤 예외를 허용한다고 말함.', '친한 고객의 예외 처리를 요구받은 상황을 60초로 답함.'),
      ], '금융소비자 보호 상황 2개를 원칙→확인→설명→기록 순서로 답함.'),
      learningModule('finance-service', '창구·고객 응대 상황면접', '요구 확인 → 규정 설명 → 대안 제시 → 기록·보고 순서로 답함.', [
        learningUnit('불만 고객의 요구 분리', '큰 목소리보다 사실·감정·요구를 나누어 확인함.', '불편에 공감한 뒤 거래 시각과 요청 내용을 재확인하고 가능한 처리 기한을 안내함.', '무조건 사과하거나 규정만 반복함.', '대기 시간이 길어 화난 고객에게 첫 세 문장을 말함.'),
        learningUnit('설명은 쉬운 말과 확인으로', '전문용어를 바꾸고 한 번에 한 기준씩 설명한 뒤 이해 여부를 확인함.', '중도상환수수료를 발생 조건·기간·확인 위치 순으로 나누어 안내함.', '빠르게 모두 설명하면 충분하다고 생각함.', '금융 용어 하나를 고르고 중학생도 이해하게 30초로 설명함.'),
        learningUnit('해결 뒤 기록과 재발 방지', '응대가 끝나도 처리 내용·약속·후속 담당을 기록해야 서비스가 이어짐.', '오안내를 수정한 뒤 상담 기록과 안내 문구를 함께 보완함.', '고객이 돌아가면 문제가 끝났다고 답함.', '내 실수로 안내가 달라진 상황의 후속 조치를 4단계로 말함.'),
      ], '민원 상황 답변 1개를 녹음하고 요구 확인·대안·후속 기록이 모두 있는지 점검함.'),
      learningModule('finance-digital', '디지털 금융과 포용성', '편의성뿐 아니라 보안과 디지털 소외 고객까지 함께 고려함.', [
        learningUnit('편의성과 보안을 함께 보기', '인증 단계를 줄이는 것만이 혁신이 아님. 위험 수준에 맞는 확인과 이상거래 대응이 필요함.', '간편 이체의 편의와 고액 이체의 추가 인증을 함께 설명함.', '새 기술은 무조건 기존 방식보다 좋다고 말함.', '디지털 금융 서비스 개선안을 편의·보안 두 기준으로 제안함.'),
        learningUnit('디지털 소외 고객 지원', '앱 전환 과정에서 고령자·장애인·기기 미숙 고객의 실제 사용 장벽을 확인함.', '대신 눌러 주기보다 큰 글씨·단계별 안내·대체 채널을 제공함.', '스마트폰 사용을 배우라고만 권함.', '앱 사용이 어려운 고객에게 안전하게 도울 방법 3개를 말함.'),
        learningUnit('데이터 기반 개선', '고객 데이터는 목적·권한·보관 기준 안에서 사용하고 반복 문의나 이탈 구간을 개선 근거로 삼음.', '문의 유형을 익명 집계해 가장 많이 막히는 인증 단계를 개선함.', '개인정보를 많이 모을수록 좋은 서비스가 된다고 말함.', '반복 민원 데이터를 활용할 때 지킬 원칙과 개선 방법을 함께 말함.'),
      ], '지원 은행의 디지털 서비스 1개를 골라 고객·보안·포용 관점의 개선안을 만듦.'),
    ],
  },
  {
    id: 'public',
    label: '공공기관 면접',
    description: '기관 설립 목적, 공공가치, 안전·윤리, 직무기술서를 중심으로 준비함.',
    completion: '기관 목적·직무기술서·공공 상황 판단을 자신의 전공 경험과 연결함.',
    modules: [
      learningModule('public-purpose', '기관 목적과 공공가치', '기관이 국민에게 제공하는 서비스와 자신의 직무를 연결함.', [
        learningUnit('설립 목적에서 답 시작하기', '공공기관 지원동기는 안정성이 아니라 국민에게 제공하는 서비스와 직무의 기여에서 출발함.', '전력의 안정적 공급이라는 기관 역할을 배전설비 점검 직무와 연결함.', '기관의 규모와 복지만 길게 칭찬함.', '지원 기관의 존재 이유를 국민 관점 한 문장으로 적음.'),
        learningUnit('효율성과 형평성의 균형', '공공서비스는 속도·비용뿐 아니라 접근성·안전·취약계층 영향을 함께 고려함.', '민원 처리 순서를 임의로 바꾸지 않고 긴급성과 기준을 설명함.', '고객 만족을 위해 모든 요구를 예외 처리한다고 답함.', '한정된 자원을 배분하는 상황에서 판단 기준 3개를 말함.'),
        learningUnit('기관별 차이를 공식 자료로 확인', '유사 기관도 법정 역할·서비스 대상·사업 구조가 다르므로 공고와 공시를 교차 확인함.', '기관 소개·ALIO·최근 보도자료에서 반복되는 역할을 지원동기 근거로 씀.', '취업 카페 후기의 표현을 공식 사실처럼 사용함.', '지원 기관과 유사 기관의 역할 차이 1개를 찾아 말함.'),
      ], '기관의 설립 목적·주요 고객·지원 직무 기여를 50초로 완성함.'),
      learningModule('public-ncs', 'NCS 직무기술서 읽기', '지식·기술·태도 요구를 자신의 수업·실습 경험과 대조함.', [
        learningUnit('능력단위와 실제 업무 연결', '직무기술서의 단어를 외우지 않고 어떤 상황에서 어떤 행동으로 나타나는지 바꿈.', '설비 점검 능력을 측정기 사용·기준값 비교·이상 보고 경험으로 증명함.', '직무기술서 문장을 그대로 읽음.', '지원 직무 요구 1개를 내 실습 행동 3개로 바꿈.'),
        learningUnit('지식·기술·태도 구분', '아는 내용, 수행 방법, 일할 때 지키는 기준을 분리하면 근거가 선명해짐.', '회로 원리 지식·멀티미터 측정 기술·전원 차단 태도를 한 경험 안에서 구분함.', '자격증 이름 하나로 세 항목을 모두 증명함.', '내 전공 경험을 지식·기술·태도 한 줄씩 작성함.'),
        learningUnit('고졸 직무에서의 성장 답변', '처음부터 모든 업무를 할 수 있다고 과장하지 않고 초기 수행·학습·확장 순서를 제시함.', '초기에는 점검 절차와 기록을 정확히 익히고 이후 이상 징후 분석으로 범위를 넓힘.', '빠르게 관리자가 되겠다는 포부로 끝냄.', '입사 3개월·1년의 학습 행동을 각각 한 문장으로 말함.'),
      ], '직무기술서 요구 3개마다 내 근거·부족한 점·보완 행동을 적음.'),
      learningModule('public-safety', '안전·윤리 상황면접', '절차 준수, 위험 중지, 보고, 재발 방지 순서로 판단함.', [
        learningUnit('위험 발견 시 작업 중지', '납기보다 생명과 설비 안전이 우선이며 임의 복구보다 정해진 보고체계를 따름.', '이상 소음을 발견하면 작업을 멈추고 접근을 통제한 뒤 담당자에게 사실을 보고함.', '경험 많은 동료가 괜찮다고 하면 계속 작업함.', '작업 마감 직전 안전 이상을 발견한 상황을 답함.'),
        learningUnit('청렴과 이해충돌', '작은 편의나 선물도 업무 판단에 영향을 줄 수 있어 규정 확인과 공개가 필요함.', '거래 관계자의 선물을 받지 않고 담당 부서에 문의해 기록함.', '금액이 작으면 개인 판단으로 받는다고 답함.', '지인의 민원을 맡게 된 상황에서 조치 순서를 말함.'),
        learningUnit('실수 보고와 재발 방지', '실수를 숨기지 않고 영향 범위를 확인해 즉시 보고하며 사람 비난보다 절차 개선으로 이어감.', '입력 오류를 발견해 수정 전후 자료를 보존하고 검토 절차를 추가함.', '혼날까 봐 결과가 나올 때까지 기다림.', '내 실수로 공공서비스가 지연된 상황의 첫 10분 행동을 말함.'),
      ], '안전·청렴 상황을 각각 1개씩 사실→원칙→행동→후속조치로 녹음함.'),
      learningModule('public-collaboration', '협업·민원·갈등 대응', '감정 대응보다 사실 확인과 이해관계 조정 과정을 말함.', [
        learningUnit('민원에서 가능한 것과 어려운 것 구분', '요구를 그대로 수용하거나 거절하지 않고 권한·규정·기한을 확인해 대안을 안내함.', '처리할 수 없는 요청의 이유와 가능한 담당 부서·절차를 함께 알려 줌.', '“규정상 안 됩니다”만 반복함.', '담당 업무가 아닌 민원을 받았을 때 첫 응답을 말함.'),
        learningUnit('부서 간 갈등 조정', '누가 옳은지보다 공동 목표·자료·마감·역할을 다시 합의함.', '서로 다른 자료 기준을 표로 맞추고 최종 승인자를 정함.', '상급자에게 바로 넘겨 책임을 피함.', '두 부서의 일정 충돌을 조정하는 회의 발언을 40초로 준비함.'),
        learningUnit('인수인계와 서비스 연속성', '담당자가 바뀌어도 국민이 같은 설명을 받도록 상태·약속·다음 행동을 기록함.', '처리 단계와 남은 자료를 인수인계표에 남기고 상대가 이해했는지 확인함.', '파일만 전달하면 인수인계가 끝났다고 말함.', '하루 자리를 비우기 전 남겨야 할 정보 4개를 말함.'),
      ], '민원·협업 답변에 사실 확인과 후속 담당·기한이 포함됐는지 점검함.'),
    ],
  },
  {
    id: 'enterprise',
    label: '대기업 면접',
    description: '생산·품질·설비·고객 직무의 현장 실행력과 개선 경험을 강조함.',
    completion: '현장 문제를 안전·품질·납기 기준으로 판단하고 행동과 결과를 수치로 설명함.',
    modules: [
      learningModule('enterprise-quality', '생산·품질 기본기', '표준 준수, 불량 예방, 원인 확인, 개선 기록을 연결함.', [
        learningUnit('표준작업의 의미', '표준은 속도를 늦추는 문서가 아니라 품질 편차와 위험을 줄이는 공통 기준임.', '작업 순서와 검사 기준을 확인하고 변경이 필요하면 임의 수정 대신 승인 절차를 밟음.', '익숙해지면 표준을 생략해도 된다고 답함.', '급한 주문으로 표준을 줄이자는 제안을 받았을 때 답함.'),
        learningUnit('불량을 발견한 첫 행동', '생산량보다 영향 확산을 막는 격리·표시·보고·원인 확인이 먼저임.', '불량 의심품을 구분하고 앞뒤 생산 범위를 확인해 품질 담당자에게 알림.', '내 공정이 아니면 지나친다고 답함.', '검사 기준을 벗어난 제품 1개를 발견한 상황을 답함.'),
        learningUnit('품질 경험을 수치화', '수치는 사실을 꾸미는 장식이 아니라 전후 비교의 기준임.', '시험 가동 10회 중 오류 횟수, 재작업 시간, 검사 누락 건수를 기록함.', '팀 전체 생산량을 자신의 성과로 말함.', '내 실습 경험에서 전후 비교 가능한 수치 2개를 찾음.'),
      ], '품질 문제 1개를 발견→격리→원인 확인→재검사 순서로 답함.'),
      learningModule('enterprise-equipment', '설비·안전 대응', '이상 징후 발견 시 정지·격리·보고·복구 확인 순서를 지킴.', [
        learningUnit('이상 징후를 놓치지 않는 관찰', '소리·진동·온도·압력·냄새·제품 편차를 평소 기준과 비교함.', '설비 소음 변화와 계기값을 함께 확인하고 시간·위치를 기록함.', '고장이 멈출 때까지 기다림.', '평소와 다른 진동을 발견했을 때 확인 항목을 말함.'),
        learningUnit('에너지 차단과 접근 통제', '정비 전 전원·압력·열원 등 위험 에너지를 차단하고 재가동 방지를 확인함.', '작업 정지 후 표지·잠금·잔류 에너지 확인을 거쳐 담당자와 점검함.', '잠깐 확인할 때는 보호구만 착용하면 된다고 답함.', '설비 내부에 이물질이 보이는 상황의 행동 순서를 말함.'),
        learningUnit('복구 후 시험과 인계', '원인을 고친 뒤에도 무부하·시험 가동·품질 확인·기록이 필요함.', '수정 항목과 시험 결과를 교대자에게 전달하고 초기 생산품을 재검사함.', '설비가 움직이면 바로 정상 생산함.', '수리 완료 보고를 받았을 때 재가동 전 질문 3개를 말함.'),
      ], '설비 이상 상황 답변에 중지·통제·보고·시험·인계가 모두 있는지 확인함.'),
      learningModule('enterprise-improvement', '개선 경험 수치화', '시간, 오류, 비용, 품질 변화 중 확인 가능한 결과를 제시함.', [
        learningUnit('문제를 작게 정의하기', '“공정이 비효율적”보다 어느 단계에서 어떤 낭비가 얼마나 생기는지 정함.', '부품을 찾는 이동 시간이 작업마다 반복된다는 관찰로 범위를 좁힘.', '원인을 묻기 전에 솔루션부터 제안함.', '내 실습의 불편을 장소·횟수·영향으로 한 문장 정의함.'),
        learningUnit('원인과 현상 구분', '보이는 현상을 사람의 태도 탓으로 돌리지 않고 자료와 절차로 원인을 확인함.', '오류 발생 시간·설비·자재를 기록해 공통 조건을 찾음.', '경험상 그렇다는 말로 원인을 확정함.', '문제 원인 가설 2개와 확인 방법을 짝지어 말함.'),
        learningUnit('작은 개선의 검증', '한 번 성공보다 반복 시험과 전후 기준 비교로 효과를 확인함.', '배치 변경 전후 이동 시간과 누락 건수를 같은 조건에서 비교함.', '좋아 보였다는 팀원 반응만 성과로 제시함.', '개선 결과를 수치·완성물·피드백 중 두 가지로 증명함.'),
      ], '개선 경험을 문제 수치→내 행동→전후 비교→남은 한계로 60초 답함.'),
      learningModule('enterprise-team', '팀워크와 교대 협업', '인수인계, 역할 조정, 후속 확인까지 자신의 행동으로 말함.', [
        learningUnit('교대 인수인계의 핵심', '정상 상태뿐 아니라 이상 징후·임시 조치·다음 확인 시점을 전달함.', '설비 번호·발생 시각·관찰값·조치·남은 위험을 구두와 기록으로 함께 넘김.', '“특이사항 없음”만 적고 끝냄.', '교대자에게 30초 안에 전달할 항목 5개를 말함.'),
        learningUnit('의견 충돌을 작업 기준으로 풀기', '경력이나 목소리 크기보다 도면·표준·측정값을 공통 기준으로 삼음.', '두 방법을 안전·품질·시간 기준으로 비교하고 필요한 승인자를 확인함.', '관계를 위해 내 의견을 무조건 포기함.', '작업 방법이 다른 팀원과 합의하는 질문 3개를 만듦.'),
        learningUnit('도움을 요청하는 책임감', '모르는 것을 숨기지 않고 시도한 내용·막힌 지점·필요한 도움을 구체적으로 말함.', '도면과 매뉴얼을 확인한 뒤 판단이 어려운 수치를 표시해 선임에게 질문함.', '혼자 해결해야 능력이 있어 보인다고 생각함.', '업무 질문을 상황·확인한 것·질문으로 20초 안에 말함.'),
      ], '협업 경험에서 내 역할·조정 행동·인계 또는 후속 확인을 각각 한 문장으로 정리함.'),
    ],
  },
]

const SECTOR_RESEARCH = {
  finance: {
    customer: '고객의 상황을 정확히 확인하고 금융소비자 보호와 내부 절차를 함께 지킴',
    field: '상품·업무를 쉬운 말로 설명하고 개인정보와 거래 기록을 꼼꼼히 확인함',
    result: '오류·대기·재문의가 줄어든 변화나 고객이 이해했는지 확인한 결과',
    sources: ['채용 페이지의 직무 소개', '경영공시·지배구조·소비자보호 자료', '공식 보도자료의 주요 사업'],
  },
  public: {
    customer: '국민의 안전과 공공서비스 품질을 우선하고 규정에 따라 판단함',
    field: '직무기술서의 지식·기술·태도를 전공 실습과 현장 행동으로 연결함',
    result: '위험·오류·민원이 줄었거나 절차와 협업으로 문제를 해결한 결과',
    sources: ['채용공고와 NCS 직무기술서', 'ALIO 경영공시와 기관 주요사업', '공식 보도자료·지속가능경영 자료'],
  },
  enterprise: {
    customer: '안전·품질·납기를 지키면서 팀과 함께 현장의 문제를 개선함',
    field: '표준작업, 설비·공정, 검사·기록에서 자신이 맡은 행동을 구체화함',
    result: '시간·불량·재작업·안전 위험이 줄어든 확인 가능한 변화',
    sources: ['채용 페이지의 직무·인재상', '사업보고서·지속가능경영보고서', '공식 뉴스룸의 제품·기술·사업 자료'],
  },
}

function buildEvidenceExamples(name, sector, roles, values) {
  const guide = SECTOR_RESEARCH[sector]
  return values.map((value, index) => ({
    value,
    examples: [
      `전공 실습에서 ${particle(roles[index % roles.length], '과', '와')} 연결되는 작업을 맡아 ${guide.field}`,
      `팀 프로젝트·동아리에서 ${objectValue(value)} 보여 주기 위해 역할을 나누고 진행 상황을 기록·공유함`,
      `${guide.customer}. 그 결과는 수치·완성물·피드백 중 하나로 확인함: ${guide.result}`,
    ],
  }))
}

function particle(word, withBatchim, withoutBatchim) {
  const last = [...String(word)].reverse().find(character => /[가-힣]/.test(character))
  const code = last?.charCodeAt(0) ?? 0
  const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
  return `${word}${hasBatchim ? withBatchim : withoutBatchim}`
}

const objectValue = word => particle(word, '을', '를')
const subjectValue = word => particle(word, '이', '가')
const quotedDefinition = word => particle(word, '이라는', '라는')

function buildQuestions(name, identity, roles, values) {
  return [
    {
      question: `왜 ${name}에 지원했으며, 같은 분야의 다른 지원처와 무엇이 다른가?`,
      answerGuide: '개인 계기 → 공식 자료에서 확인한 지원처의 역할 → 지원 직무에서의 기여',
      model: `저는 [관심을 갖게 된 실제 계기]를 통해 이 분야를 준비했습니다. ${subjectValue(name)} ${quotedDefinition(identity)} 점을 공식 자료에서 확인했고, 그 역할이 제 경험과 맞았습니다. 입사 후에는 [전공 실습에서 익힌 기술]을 ${roles[0]} 업무에 적용해 [구체적 기여]를 하겠습니다.`,
    },
    {
      question: `${roles[0]} 직무에서 가장 먼저 지켜야 할 원칙은 무엇인가?`,
      answerGuide: '원칙 한 문장 → 그렇게 판단한 이유 → 실제로 지킨 경험 → 입사 후 적용',
      model: `가장 먼저 지킬 원칙은 ${values[0]}입니다. [실습·프로젝트 상황]에서 [위험 또는 문제]를 발견했을 때 [내가 한 확인·조치·보고]를 했고, 그 결과 [수치·완성물·피드백]을 얻었습니다. ${name}에서도 같은 기준으로 정확하게 행동하겠습니다.`,
    },
    {
      question: `${objectValue(values[1])} 행동으로 보여 준 경험을 말해 달라.`,
      answerGuide: '상황 20% → 맡은 목표 10% → 내 행동 50% → 결과·배운 점 20%',
      model: `[언제·어떤 목표였는지] 상황에서 저는 [내 역할]을 맡았습니다. ${objectValue(values[1])} 보여 주기 위해 [행동 1], [행동 2], [확인 행동]을 했습니다. 결과적으로 [확인 가능한 변화]가 있었고, 이후에는 [배운 점]을 같은 방식으로 적용하고 있습니다.`,
    },
  ]
}

function buildOfficialChecks(sector) {
  const [job, business, news] = SECTOR_RESEARCH[sector].sources
  return [
    { title: job, method: '현재 공고의 지원 자격·전형 순서·우대사항을 표시하고, 직무 설명에서 반복되는 지식·기술·태도 3개를 적음.' },
    { title: business, method: '최근 자료의 기준 연도와 발행 주체를 확인한 뒤, 지원동기에 쓸 핵심 역할 1개와 면접에서 물어볼 변화 1개를 정리함.' },
    { title: news, method: '최근 1년 자료 중 지원 직무와 직접 연결되는 내용만 고르고, 제목·게시일·핵심 사실을 메모함. 홍보 문구는 자신의 경험처럼 쓰지 않음.' },
    { title: '최종 교차 점검', method: '공고·직무자료·사업자료 두 곳 이상에서 같은 표현인지 확인하고, 오래된 후기와 다르면 현재 공식 자료를 우선함.' },
  ]
}

const SAMPLE_EXPERIENCE = {
  finance: {
    setting: '교내 창업 프로젝트의 판매·정산 담당',
    action: '거래 자료를 시간순으로 분류하고 영수증과 대조했으며, 차이가 난 항목은 팀원과 수정 전후 금액을 다시 검산함',
    result: '누락된 거래 3건을 찾아 정산표를 맞추고 다음 행사부터 사용할 검산 칸을 추가함',
    growth: '상품과 규정을 정확히 익힌 뒤 고객의 이해 여부까지 확인하는 설명 역량',
  },
  public: {
    setting: '전공 실습의 설비 점검·안전 기록 담당',
    action: '측정값이 기준과 다른 것을 확인해 작업을 멈추고 전원을 차단한 뒤, 회로도와 측정 순서를 대조해 이상 구간을 표시하고 담당 교사와 재확인함',
    result: '결선 오류 1곳을 수정하고 점검표에 측정값 확인 순서를 보완함',
    growth: '현장 절차와 설비 기준을 익히고 이상 징후를 빠짐없이 기록·보고하는 역량',
  },
  enterprise: {
    setting: '자동화 실습의 센서·공정 점검 담당',
    action: '센서·배선·프로그램 순으로 원인을 나누고 팀원과 점검 구간을 분담했으며, 발견 내용을 작업일지에 남긴 뒤 시험 가동함',
    result: '센서 위치를 조정해 시험 가동 10회를 정상 완료하고 같은 오류를 찾는 점검 순서를 남김',
    growth: '표준작업과 품질 기준을 익히고 설비 이상과 불량 원인을 기록으로 개선하는 역량',
  },
}

function buildOrganizationCourse(name, sector, identity, roles, values) {
  const guide = SECTOR_RESEARCH[sector]
  return [
    { id: 'identity', title: '지원처를 60초로 설명', goal: `${name}의 존재 이유와 주요 고객을 자신의 말로 정리함.`, tasks: [`공식 자료에서 ${objectValue(`“${identity}”`)} 뒷받침하는 핵심 사업 1개 찾기`, '유사 지원처와 다른 역할 1개 적기', '최근 공고의 지원 자격·전형 순서 확인하기'], output: `${name}은 누구에게 어떤 가치를 제공하며, 내가 관심을 가진 이유는 무엇인지 60초 답변` },
    { id: 'role', title: '직무 요구를 내 경험에 연결', goal: `${roles.join('·')} 중 실제 지원 직무의 지식·기술·태도를 구분함.`, tasks: [`${roles[0]} 업무에서 자주 확인할 기준 3개 찾기`, '전공 실습에서 같은 기준을 지킨 행동 2개 고르기', '아직 부족한 역량과 입사 전 보완 계획 적기'], output: '직무 요구 1개 → 전공 행동 → 확인 가능한 결과로 이어지는 50초 답변' },
    { id: 'evidence', title: '지원처 가치의 증거 만들기', goal: `${objectValue(values.join('·'))} 표어가 아니라 자신의 행동으로 증명함.`, tasks: [`${objectValue(values[0])} 보여 준 실제 상황 한 가지 선택하기`, '상황 설명을 줄이고 내가 한 행동을 세 동사로 쓰기', `${guide.result} 중 실제로 확인 가능한 결과 붙이기`], output: '후속 질문에도 사실관계가 바뀌지 않는 STAR 경험 답변' },
    { id: 'questions', title: '기관형 질문 3개 실전 답변', goal: '지원동기·직무원칙·경험 질문을 지원처 특성에 맞춰 각각 완성함.', tasks: ['첫 답변을 60초 안에 녹음하기', '지원처 이름을 다른 곳으로 바꿔도 같은 답인지 확인하기', '모범 골격과 비교해 공식 근거·내 행동·결과를 보완하기'], output: '지원처 전용 핵심 답변 3개와 예상 후속 질문 6개' },
    { id: 'simulation', title: '최종 모의면접과 서류 연결', goal: '자기소개서의 사실과 면접 답변이 서로 모순되지 않게 최종 점검함.', tasks: ['자기소개서 경험의 기간·역할·수치를 표시하기', '압박 질문에도 바뀌면 안 되는 사실 3개 정하기', '공식 자료 갱신일과 현재 채용공고를 마지막으로 확인하기'], output: `${name} 제출본·면접 답변·공식 자료 확인표가 연결된 개인 준비 파일` },
  ]
}

function buildSampleCoverLetter(name, sector, identity, roles, values) {
  const sample = SAMPLE_EXPERIENCE[sector]
  return [
    { title: '1. 지원동기', body: `${objectValue(sample.setting)} 맡으며 정확한 확인과 기록이 조직의 신뢰를 만든다는 점을 배웠습니다. 이후 공식 자료에서 ${subjectValue(name)} ${quotedDefinition(identity)} 점을 확인했습니다. 단순히 규모가 큰 지원처가 아니라 제가 익힌 확인 습관을 ${roles[0]} 업무에서 고객과 현장의 신뢰로 연결할 수 있다고 판단해 지원했습니다.` },
    { title: '2. 직무와 전공 역량', body: `${roles[0]} 직무에는 ${values[0]}의 의미를 정확히 이해하고 ${objectValue(values[1])} 실제 업무 행동으로 옮기는 힘이 필요하다고 생각합니다. 전공 과정에서 ${sample.setting}으로 활동하며 ${sample.action}. 이 경험으로 자료와 기준을 대조하고, 혼자 단정하지 않고 관련자와 재확인하는 방법을 익혔습니다.` },
    { title: '3. 경험으로 증명한 강점', body: `처음에는 문제를 빨리 끝내는 데 집중했지만 같은 오류가 다시 생길 수 있다는 점을 발견했습니다. 그래서 확인 순서를 나누고 진행 결과를 기록했습니다. 그 결과 ${sample.result}. 이를 통해 ${objectValue(values[2])} 말로 약속하는 것보다 반복 가능한 확인 방법으로 남겨야 한다는 점을 배웠습니다.` },
    { title: '4. 입사 후 기여', body: `입사 초기에는 ${objectValue(sample.growth)} 우선 익히겠습니다. 모르는 내용은 확인한 범위와 막힌 지점을 분명히 하여 질문하고, 업무 후에는 처리 내용과 다음 확인 사항을 기록하겠습니다. 이후 반복되는 오류와 문의를 자료로 정리해 ${name}의 ${roles[0]} 업무가 더 정확하고 이해하기 쉽게 이어지는 데 기여하겠습니다.` },
  ]
}

function recommendedQuestionIds(sector) {
  return sector === 'finance'
    ? ['motivation', 'job-competency', 'customer', 'ethics', 'growth']
    : sector === 'public'
      ? ['motivation', 'job-competency', 'public-value', 'safety', 'collaboration']
      : ['motivation', 'job-competency', 'problem-solving', 'quality', 'collaboration']
}

const profile = (id, name, sector, group, identity, roles, values, officialUrl) => ({
  id, name, sector, group, identity, roles, values, officialUrl,
  evidenceExamples: buildEvidenceExamples(name, sector, roles, values),
  questions: buildQuestions(name, identity, roles, values),
  officialChecks: buildOfficialChecks(sector),
  interviewCourse: buildOrganizationCourse(name, sector, identity, roles, values),
  sampleCoverLetter: buildSampleCoverLetter(name, sector, identity, roles, values),
  recommendedQuestionIds: recommendedQuestionIds(sector),
  coverLetterBridge: `${name}의 역할을 보여 주는 공식 근거 1개와 ${roles[0]} 직무에서 필요한 행동 1개를 골라 자기소개서 지원동기·직무역량 칸에 연결함.`,
  verifiedAt: '2026-08',
})

export const INTERVIEW_ORGANIZATIONS = [
  profile('kdb', '한국산업은행', 'finance', '국책은행', '산업과 기업의 성장·재편을 금융으로 지원하는 정책금융기관', ['기업금융', '심사·리스크', '디지털·IT'], ['공공성', '산업 이해', '책임 있는 판단'], 'https://www.kdb.co.kr/'),
  profile('ibk', 'IBK기업은행', 'finance', '국책은행', '중소기업의 성장과 금융 접근성을 지원하는 국책은행', ['기업금융', '개인금융', '디지털·IT'], ['고객 신뢰', '중소기업 이해', '윤리'], 'https://ibk.incruit.com/'),
  profile('kexim', '한국수출입은행', 'finance', '국책은행', '수출입·해외투자·경제협력 사업을 지원하는 정책금융기관', ['여신·심사', '국제금융', '경영지원'], ['공공성', '국제 감각', '정확성'], 'https://www.koreaexim.go.kr/'),
  profile('kb', 'KB국민은행', 'finance', '시중은행', '개인·기업 고객의 생활과 사업 전반을 지원하는 종합금융 서비스 기관', ['영업·고객상담', '기업금융', '디지털·IT'], ['고객 중심', '신뢰', '협업'], 'https://careers.kbfg.com/'),
  profile('shinhan', '신한은행', 'finance', '시중은행', '고객 자산과 기업 활동을 연결하는 종합금융 서비스 기관', ['영업·고객상담', '기업금융', '디지털·IT'], ['고객 보호', '혁신', '책임'], 'https://www.shinhan.com/'),
  profile('hana', '하나은행', 'finance', '시중은행', '개인·기업·외환을 아우르는 종합금융 서비스 기관', ['영업·고객상담', '외환·기업금융', '디지털·IT'], ['고객 이해', '글로벌 감각', '정직'], 'https://www.hanabank.com/'),
  profile('woori', '우리은행', 'finance', '시중은행', '개인과 기업 고객에게 예금·대출·결제·자산관리 서비스를 제공하는 은행', ['영업·고객상담', '기업금융', '디지털·IT'], ['신뢰', '고객 중심', '실행'], 'https://www.wooribank.com/'),
  profile('nh', 'NH농협은행', 'finance', '시중은행', '금융 서비스와 농업·농촌 및 지역경제 지원을 함께 수행하는 은행', ['영업·고객상담', '기업·지역금융', '디지털·IT'], ['고객본위', '사회적 책임', '협력'], 'https://www.nhbank.com/nhmn/KO_NHMN_07.do'),
  profile('kakao-bank', '카카오뱅크', 'finance', '인터넷은행', '모바일 중심으로 금융 접근성과 사용 경험을 개선하는 인터넷전문은행', ['고객서비스', '운영', '디지털·IT'], ['사용자 관점', '보안', '빠른 개선'], 'https://recruit.kakaobank.com/'),
  profile('toss-bank', '토스뱅크', 'finance', '인터넷은행', '모바일 기반의 단순하고 투명한 금융 경험을 지향하는 인터넷전문은행', ['고객서비스', '운영', '디지털·IT'], ['고객 문제 해결', '투명성', '책임'], 'https://toss.im/career/'),
  profile('bok', '한국은행', 'finance', '중앙은행', '물가와 금융 안정을 위해 통화신용정책과 지급결제·외환 업무를 수행하는 중앙은행', ['경제조사', '지급결제', '전산·경영지원'], ['공공성', '정확성', '경제 이해'], 'https://www.bok.or.kr/portal/main/main.do'),
  profile('kdic', '예금보험공사', 'finance', '금융공공기관', '예금자 보호와 금융제도 안정에 필요한 예금보험 업무를 수행하는 기관', ['예금보험', '금융분석', '전산·경영지원'], ['예금자 보호', '원칙', '정확성'], 'https://www.kdic.or.kr/'),
  profile('hf', '한국주택금융공사', 'finance', '금융공공기관', '주택금융 상품과 보증을 통해 국민의 주거 안정을 지원하는 기관', ['주택금융', '보증·심사', '고객·전산'], ['공공성', '고객 이해', '책임'], 'https://www.hf.go.kr/'),
  profile('kodit', '신용보증기금', 'finance', '금융공공기관', '기업의 신용을 평가하고 보증을 제공해 자금 조달과 성장을 지원하는 기관', ['신용보증', '기업평가', '디지털·경영지원'], ['기업 이해', '공정한 판단', '책임'], 'https://www.kodit.co.kr/'),
  profile('kibo', '기술보증기금', 'finance', '금융공공기관', '기술기업의 기술성과 사업성을 평가하고 보증·지원하는 기관', ['기술평가', '보증·지원', '디지털·경영지원'], ['기술 이해', '공정성', '도전 지원'], 'https://www.kibo.or.kr/'),
  profile('sc', 'SC제일은행', 'finance', '시중은행', '국내 고객 서비스와 글로벌 금융 네트워크를 연결하는 은행', ['영업·고객상담', '기업금융', '디지털·운영'], ['고객 보호', '글로벌 협업', '정확성'], 'https://www.sc.co.kr/'),

  profile('kepco', '한국전력공사', 'public', '에너지', '전력 공급과 전력망 운영을 통해 국민 생활과 산업을 뒷받침하는 공기업', ['전기·송배전', '설비·안전', '사무·고객'], ['안전', '공공성', '현장 책임'], 'https://recruit.kepco.co.kr/'),
  profile('khnp', '한국수력원자력', 'public', '에너지', '원자력·수력 등 발전설비를 안전하게 운영하는 에너지 공기업', ['발전·전기', '기계·정비', '안전·품질'], ['안전 최우선', '절차 준수', '협업'], 'https://www.khnp.co.kr/recruit/'),
  profile('korail', '한국철도공사', 'public', '교통', '철도 운송과 시설 운영으로 국민의 안전한 이동을 지원하는 공기업', ['운전·차량', '전기·시설', '고객·사무'], ['안전', '정시성', '고객 책임'], 'https://info.korail.com/info/selectBbsNttList.do?bbsNo=198&key=733'),
  profile('airport', '인천국제공항공사', 'public', '교통', '공항 인프라와 여객·물류 서비스를 운영하는 공기업', ['시설·전기', '운영·안전', '고객·사무'], ['안전', '서비스', '국제 협업'], 'https://www.airport.kr/co/ko/cmm/cmmBbsList.do?FNCT_CODE=121'),
  profile('kac', '한국공항공사', 'public', '교통', '국내 공항의 시설·운항·여객 서비스를 운영하는 공기업', ['시설·전기', '운영·안전', '고객·사무'], ['안전', '서비스', '지역 연결'], 'https://www.airport.co.kr/www/cms/frCon/index.do?MENU_ID=1250'),
  profile('kwater', '한국수자원공사', 'public', '환경·인프라', '물 관리와 수도·수자원 인프라를 운영하는 공기업', ['환경·수질', '토목·기계', '전기·운영'], ['안전', '지속가능성', '현장 문제해결'], 'https://www.kwater.or.kr/recr/sub01/recruitPage.do?s_mid=1198'),
  profile('kogas', '한국가스공사', 'public', '에너지', '천연가스의 도입·공급과 관련 인프라를 운영하는 공기업', ['설비·기계', '전기·안전', '사무·공급'], ['안전', '공급 안정', '윤리'], 'https://www.kogas.or.kr/site/koGas/1040100000000'),
  profile('lh', '한국토지주택공사', 'public', '주거·도시', '주거 안정과 국토·도시 개발 사업을 수행하는 공기업', ['건축·토목', '주거복지', '사무·고객'], ['공공성', '현장 책임', '청렴'], 'https://lh.or.kr/board.es?mid=a10601020000&bid=0036'),
  profile('ex', '한국도로공사', 'public', '교통', '고속도로 건설·유지관리와 교통 서비스를 담당하는 공기업', ['토목·시설', '전기·기계', '교통·고객'], ['안전', '현장 대응', '공공서비스'], 'https://www.ex.co.kr/portal/recruit/recruitList/view.do?menuNo=800326'),
  profile('kospo', '한국남부발전', 'public', '에너지', '발전소 운영과 에너지 전환 사업을 수행하는 발전 공기업', ['발전·전기', '기계·정비', '안전·환경'], ['안전', '설비 신뢰성', '환경 책임'], 'https://www.kospo.co.kr/kospo/123/subview.do'),
  profile('nhis', '국민건강보험공단', 'public', '보건·복지', '건강보험과 장기요양보험을 운영해 국민의 의료·돌봄 안전망을 지원하는 공공기관', ['고객·보험', '전산·데이터', '행정·경영지원'], ['공공성', '개인정보 보호', '고객 배려'], 'https://www.nhis.or.kr/'),
  profile('nps', '국민연금공단', 'public', '보건·복지', '국민연금 제도를 운영하고 가입자와 수급자의 노후 소득 보장을 지원하는 공공기관', ['연금서비스', '고객상담', '전산·행정'], ['신뢰', '정확성', '공공서비스'], 'https://www.nps.or.kr/'),
  profile('hrdkorea', '한국산업인력공단', 'public', '고용·인재', '국가직무능력표준, 국가자격, 직업능력개발과 해외취업 지원을 수행하는 공공기관', ['자격운영', '능력개발', '전산·행정'], ['공정성', '전문성', '고객 책임'], 'https://www.hrdkorea.or.kr/'),
  profile('kdhec', '한국지역난방공사', 'public', '에너지', '지역 냉난방과 에너지 공급 시설을 운영해 생활과 산업의 에너지 이용을 지원하는 공기업', ['열원·기계', '전기·제어', '안전·환경'], ['안전', '공급 안정', '환경 책임'], 'https://www.kdhc.co.kr/'),
  profile('keco', '한국환경공단', 'public', '환경', '환경오염 방지와 자원순환·기후 대응 사업을 수행하는 환경 공공기관', ['환경·측정', '시설·안전', '전산·행정'], ['환경 책임', '정확성', '현장 협업'], 'https://www.keco.or.kr/'),

  profile('samsung-electronics', '삼성전자', 'enterprise', '전자·반도체', '반도체와 전자제품을 개발·생산·서비스하는 글로벌 제조기업', ['반도체 제조', '설비·품질', '전자 생산'], ['품질', '기술 학습', '협업'], 'https://www.samsungcareers.com/'),
  profile('sk-hynix', 'SK하이닉스', 'enterprise', '반도체', '메모리 반도체를 중심으로 개발·생산하는 제조기업', ['반도체 제조', '설비·유틸리티', '품질'], ['정확성', '안전', '개선'], 'https://recruit.skhynix.com/'),
  profile('hyundai', '현대자동차', 'enterprise', '자동차', '자동차와 모빌리티 서비스를 개발·생산하는 제조기업', ['생산', '품질', '설비보전'], ['안전', '고객 품질', '현장 개선'], 'https://talent.hyundai.com/'),
  profile('kia', '기아', 'enterprise', '자동차', '자동차와 모빌리티 제품을 개발·생산하는 제조기업', ['생산', '품질', '설비보전'], ['안전', '품질', '팀워크'], 'https://career.kia.com/'),
  profile('posco', '포스코', 'enterprise', '철강·소재', '철강과 소재를 생산하며 산업 현장에 기초 소재를 공급하는 제조기업', ['생산', '설비·정비', '안전·품질'], ['안전', '공정 이해', '책임'], 'https://recruit.posco.com/'),
  profile('lg-electronics', 'LG전자', 'enterprise', '전자·가전', '가전과 전자제품을 개발·생산·서비스하는 제조기업', ['생산', '품질', '설비·서비스'], ['고객 가치', '품질', '협업'], 'https://careers.lg.com/'),
  profile('mobis', '현대모비스', 'enterprise', '자동차부품', '자동차 핵심부품과 모듈을 개발·생산하는 기업', ['생산', '품질', '물류·설비'], ['품질', '안전', '공정 개선'], 'https://careers.mobis.com/'),
  profile('samsung-sdi', '삼성SDI', 'enterprise', '배터리·소재', '배터리와 전자재료를 개발·생산하는 제조기업', ['생산', '설비', '품질·안전'], ['안전', '정밀성', '기술 학습'], 'https://www.samsungcareers.com/'),
  profile('hanwha-aerospace', '한화에어로스페이스', 'enterprise', '항공·방산', '항공엔진과 방산·우주 관련 제품을 개발·생산하는 기업', ['생산·조립', '품질', '설비·정비'], ['품질', '보안·윤리', '책임'], 'https://www.hanwhain.com/'),
  profile('doosan-enerbility', '두산에너빌리티', 'enterprise', '에너지·기계', '발전·에너지 설비와 대형 기계 제품을 제작하는 기업', ['생산·용접', '기계·정비', '품질·안전'], ['안전', '기술 숙련', '협업'], 'https://career.doosan.com/'),
  profile('lg-energy-solution', 'LG에너지솔루션', 'enterprise', '배터리', '배터리 셀과 에너지 솔루션을 개발·생산하는 기업', ['생산', '설비·유틸리티', '품질·안전'], ['안전', '품질', '기술 학습'], 'https://www.lgensol.com/kr/career/index'),
  profile('samsung-electro', '삼성전기', 'enterprise', '전자부품', '전자·전기 제품에 쓰이는 핵심 부품을 개발·생산하는 기업', ['생산', '설비', '품질·검사'], ['정밀성', '품질', '협업'], 'https://www.samsungcareers.com/'),
  profile('ski', 'SK이노베이션', 'enterprise', '에너지·소재', '에너지와 화학·소재 분야의 제품과 솔루션을 개발·생산하는 기업', ['생산·공정', '설비·정비', '안전·환경'], ['안전', '공정 이해', '변화 대응'], 'https://www.skinnovation.com/company/recruit.asp'),
  profile('kai', '한국항공우주산업', 'enterprise', '항공·우주', '항공기와 우주 관련 체계를 개발·생산·정비하는 기업', ['생산·조립', '품질·검사', '설비·정비'], ['품질', '보안·윤리', '정확성'], 'https://www.koreaaero.com/KO/Recruit/RecruitIntro.aspx'),
  profile('hd-hhi', 'HD현대중공업', 'enterprise', '조선·해양', '선박과 해양·에너지 설비를 설계·제작하는 중공업 기업', ['생산·용접', '설비·정비', '품질·안전'], ['안전', '기술 숙련', '협업'], 'https://recruit.hd.com/'),
]

export const COVER_LETTER_STEPS = [
  { id: 'target', title: '1. 지원처 선택', fields: ['targetName', 'targetEvidence'], check: '지원 분야를 고르고 공식 자료에서 확인한 지원처만의 근거를 적음.' },
  { id: 'role', title: '2. 직무 맞춤', fields: ['role', 'roleNeed'], check: '채용공고·직무기술서의 요구를 자신의 말로 바꿈.' },
  { id: 'major', title: '3. 전공 역량', fields: ['major', 'majorSkill'], check: '과목명이 아니라 수행한 작업·도구·기준을 적음.' },
  { id: 'experience', title: '4. 경험 증명', fields: ['experience', 'action', 'result'], check: '상황은 짧게, 자신의 행동과 확인 가능한 결과를 길게 적음.' },
  { id: 'motivation', title: '5. 동기와 기여', fields: ['motivation', 'contribution'], check: '개인 계기 → 지원처 선택 이유 → 입사 후 첫 기여로 연결함.' },
  { id: 'questions', title: '6. 문항 구성', fields: [], check: '지원처 문항을 골라 순서를 바꾸고, 없는 문항은 직접 추가해 항목별 답변을 작성함.' },
  { id: 'audit', title: '7. 완성·첨삭', fields: [], check: '완성본을 확인하고 PDF로 저장하거나 담당 선생님께 첨삭을 요청함.' },
]

export const COVER_LETTER_FIELDS = [
  { key: 'targetName', step: 'target', label: '지원 기관·기업', placeholder: '목록에서 고르거나 정확한 공식 명칭 입력', minLength: 2, required: ['공식 기관·기업명', '지원 분야와 일치 여부'], caution: '계열사·공사·은행 이름을 줄여 쓰지 않음.', showExample: false, examples: { finance: 'IBK기업은행', public: '한국전력공사', enterprise: '삼성전자' } },
  { key: 'targetEvidence', step: 'target', label: '공식 자료에서 찾은 지원 근거', placeholder: '공식 사업·고객·제품·공공 역할 중 나의 관심과 연결되는 사실', minLength: 35, required: ['공식 자료의 핵심 사실', '그 사실이 나와 연결되는 이유'], caution: '규모·연봉·복지만 칭찬하거나 출처 없는 최근 사업을 단정하지 않음.', examples: { finance: '중소기업 금융 접근성을 지원하는 역할을 확인함. 교내 창업 프로젝트에서 자금 흐름을 정리한 경험과 연결됨.', public: '안전한 전력 공급을 담당하는 역할을 확인함. 전기 실습에서 작업 전 점검표를 지킨 경험과 연결됨.', enterprise: '반도체 생산의 품질과 설비 안정이 중요함을 확인함. 자동화 실습에서 오차 원인을 기록한 경험과 연결됨.' } },
  { key: 'role', step: 'role', label: '지원 직무', placeholder: '채용공고에 표시된 직무명', minLength: 2, required: ['공고의 정확한 직무명', '희망 업무 범위'], caution: '지원 직무를 회사 전체의 사업과 혼동하지 않음.', examples: { finance: '금융일반·고객상담', public: '전기·송배전', enterprise: '생산·설비보전' } },
  { key: 'roleNeed', step: 'role', label: '직무의 핵심 요구', placeholder: '직무자료의 지식·기술·태도 중 가장 중요한 2~3개', minLength: 30, required: ['지식·기술·태도 중 2개 이상', '실제 업무에서 필요한 이유'], caution: '성실함·열정 같은 추상어만 나열하지 않음.', examples: { finance: '고객 요구를 정확히 듣고 규정에 맞게 안내하는 설명력과 개인정보 보호 태도', public: '도면·설비 상태를 확인하는 기술과 이상 발견 시 작업을 멈추고 보고하는 안전 태도', enterprise: '표준작업 준수, 설비 이상 징후 기록, 품질 기준에 따른 검사 능력' } },
  { key: 'major', step: 'major', label: '전공', placeholder: '학과·전공명', minLength: 2, required: ['현재 전공명', '지원 직무와 연결할 전공 분야'], caution: '학교명·지역명 등 블라인드 정보를 함께 쓰지 않음.', examples: { finance: '상업정보과·회계정보 전공', public: '전기과·전기제어 전공', enterprise: '자동화기계과·스마트팩토리 전공' } },
  { key: 'majorSkill', step: 'major', label: '전공에서 실제로 한 일', placeholder: '실습명보다 내가 사용한 도구·수행한 작업·지킨 기준을 적기', minLength: 45, required: ['사용한 도구·기술', '내가 직접 한 작업', '품질·안전·정확성 기준'], caution: '자격증 이름만 쓰거나 팀이 한 일을 모두 자신의 일처럼 쓰지 않음.', examples: { finance: '스프레드시트로 거래 자료를 분류하고 함수로 오류를 찾은 뒤 검산표를 만들어 재확인함.', public: '배선 실습 전 전원 차단과 보호구를 확인하고 회로도에 따라 결선한 뒤 측정값을 기록함.', enterprise: 'PLC 실습에서 센서 입력 오류를 단계별로 점검하고 원인과 수정 결과를 작업일지에 기록함.' } },
  { key: 'experience', step: 'experience', label: '대표 경험의 상황과 목표', placeholder: '언제, 어떤 문제 또는 목표가 있었는지 2~3문장', minLength: 35, required: ['상황·기간', '내가 맡은 역할', '해결할 목표'], caution: '배경 설명이 전체 문장의 절반을 넘지 않게 함.', examples: { finance: '교내 판매 프로젝트에서 마감 전 재고와 매출 기록이 맞지 않아, 팀의 정산 오류를 찾아야 했음.', public: '전기 배선 실습 중 측정값이 기준과 다르게 나와, 안전을 확보한 뒤 원인을 찾아야 했음.', enterprise: '자동화 실습에서 센서가 간헐적으로 작동하지 않아 정해진 시간 안에 공정을 정상화해야 했음.' } },
  { key: 'action', step: 'experience', label: '내가 한 행동', placeholder: '확인 → 판단 → 실행 → 협업·보고 순서로 3개 이상', minLength: 70, required: ['내가 직접 한 행동 3개 이상', '판단 기준', '협업·확인 과정'], caution: '‘열심히 했다’, ‘최선을 다했다’ 대신 동사와 순서를 씀.', examples: { finance: '거래 내역을 시간순으로 다시 분류하고 영수증과 대조함. 차이가 난 항목을 팀원에게 확인하고 수정 전후 금액을 함께 검산함.', public: '작업을 멈추고 전원을 차단한 뒤 회로도와 측정 순서를 대조함. 이상 구간을 표시해 담당 교사와 확인하고 다시 측정함.', enterprise: '센서·배선·프로그램 순으로 원인을 나누어 확인함. 팀원과 점검 구간을 나누고 발견 내용을 작업일지에 기록한 뒤 시험 가동함.' } },
  { key: 'result', step: 'experience', label: '결과와 배운 점', placeholder: '수치·완성물·시간·오류 변화·피드백 중 확인 가능한 결과', minLength: 40, required: ['확인 가능한 결과', '내 행동과 결과의 연결', '다음에 적용할 배운 점'], caution: '근거 없는 큰 수치나 결과를 만들어 쓰지 않음.', examples: { finance: '누락된 3건을 찾아 정산표를 맞췄고, 이후 같은 오류를 막기 위한 검산 칸을 추가함.', public: '결선 오류 1곳을 수정해 기준 범위의 측정값을 확인했고, 작업 중지와 순서 점검의 중요성을 배움.', enterprise: '센서 위치를 조정해 시험 가동 10회를 정상 완료했고, 추측보다 기록에 따른 단계 점검이 빠르다는 것을 배움.' } },
  { key: 'motivation', step: 'motivation', label: '지원동기', placeholder: '개인 계기 → 이 지원처를 고른 공식 근거 → 직무 선택 이유', minLength: 70, required: ['개인 경험 또는 관심 계기', '지원처만의 공식 근거', '지원 직무와의 연결'], caution: '‘유명해서’, ‘안정적이라서’, ‘어릴 때부터 꿈’만으로 끝내지 않음.', examples: { finance: '정산 프로젝트에서 정확한 안내가 신뢰를 만든다는 점을 배움 → 고객과 기업의 금융 접근성을 지원하는 역할 확인 → 고객상담 직무에서 정확한 설명으로 기여', public: '안전 실습에서 절차의 의미를 체감함 → 국민 생활을 지탱하는 공공서비스 역할 확인 → 설비 직무에서 점검과 보고로 기여', enterprise: '자동화 실습에서 작은 오차가 품질에 미치는 영향을 경험함 → 정밀 생산과 품질 경쟁력 확인 → 생산 직무에서 표준과 개선으로 기여' } },
  { key: 'contribution', step: 'motivation', label: '입사 후 기여와 성장', placeholder: '처음 맡을 일에서 할 행동 → 익힐 역량 → 장기 기여', minLength: 55, required: ['입사 초기의 구체적 행동', '배우고 확인할 방법', '지원처·직무에 줄 기여'], caution: '막연한 포부나 너무 먼 직급·성과를 약속하지 않음.', examples: { finance: '초기에는 상품과 규정을 정확히 익혀 고객 문의를 기록하고 재확인함. 이후 반복 문의를 분석해 더 쉬운 안내에 기여함.', public: '초기에는 작업 절차와 설비 기준을 정확히 익히고 점검 기록을 빠짐없이 남김. 이후 이상 징후를 조기에 찾는 현장 인력으로 성장함.', enterprise: '초기에는 표준작업과 품질 기준을 숙지하고 인수인계를 정확히 함. 이후 불량·정지 원인을 기록해 공정 개선에 기여함.' } },
]

export const COVER_LETTER_SECTOR_CONTENT = {
  finance: { label: '금융권', headline: '신뢰를 만드는 고객·금융 업무', focus: ['고객 보호와 정확한 설명', '개인정보·규정 준수', '금융·디지털 서비스 이해'] },
  public: { label: '공공기관', headline: '국민 생활을 지키는 공공서비스', focus: ['설립 목적과 공공가치', 'NCS 직무기술서 요구', '안전·청렴·절차 준수'] },
  enterprise: { label: '대기업', headline: '현장의 품질과 실행력을 증명', focus: ['생산·품질·설비 직무 이해', '표준·안전·협업', '수치로 확인되는 개선 경험'] },
}

export const COVER_LETTER_QUESTION_LIBRARY = [
  { id: 'motivation', label: '지원동기', question: '우리 기관·기업과 지원 직무를 선택한 이유를 구체적으로 작성해 주세요.', purpose: '개인 계기와 지원처만의 공식 근거, 직무 기여가 연결되는지 확인함.', required: ['개인 계기', '지원처 공식 근거', '지원 직무 연결'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  { id: 'job-competency', label: '직무역량', question: '지원 직무를 수행하기 위해 준비한 지식·기술·태도와 적용 경험을 작성해 주세요.', purpose: '전공명이 아니라 실제 수행 행동과 직무 준비 수준을 확인함.', required: ['직무 요구', '전공·실습 행동', '확인 가능한 결과'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  { id: 'experience', label: '대표 경험', question: '목표를 세우고 자신의 행동으로 결과를 만든 경험을 작성해 주세요.', purpose: '상황보다 맡은 역할·판단·실행·결과를 구체적으로 확인함.', required: ['목표', '내 역할', '행동 3개', '결과'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  { id: 'collaboration', label: '협업·갈등', question: '의견이 다른 사람과 협업해 공동 목표를 달성한 경험을 작성해 주세요.', purpose: '양보나 친화력보다 사실 확인·역할 조정·후속 확인 과정을 봄.', required: ['의견 차이', '조정 행동', '공동 결과'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  { id: 'problem-solving', label: '문제해결', question: '문제의 원인을 확인하고 새로운 방법으로 개선한 경험을 작성해 주세요.', purpose: '현상과 원인을 구분하고 개선 효과를 검증했는지 확인함.', required: ['문제 정의', '원인 확인', '개선', '전후 비교'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  { id: 'customer', label: '고객중심', question: '고객 또는 상대의 요구를 정확히 파악하고 도움을 준 경험을 작성해 주세요.', purpose: '무조건 수용이 아니라 요구 확인·정확한 설명·대안 제시를 확인함.', required: ['요구 확인', '설명·대안', '이해 확인'], sectors: ['finance', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'ethics', label: '윤리·신뢰', question: '원칙과 성과가 충돌하는 상황에서 기준을 지킨 경험을 작성해 주세요.', purpose: '정직하다는 선언보다 실제 판단·보고·기록 행동을 확인함.', required: ['충돌 상황', '판단 기준', '행동', '후속 조치'], sectors: ['finance', 'public'], minLength: 450, limit: 650 },
  { id: 'public-value', label: '공공가치', question: '공공의 이익 또는 사회적 가치를 위해 책임 있게 행동한 경험을 작성해 주세요.', purpose: '기관 설립 목적과 자신의 구체적 행동이 연결되는지 확인함.', required: ['이해관계자', '공공 기준', '내 행동'], sectors: ['public'], minLength: 500, limit: 700 },
  { id: 'safety', label: '안전', question: '위험요인을 발견하고 안전 기준에 따라 조치한 경험을 작성해 주세요.', purpose: '작업 중지·통제·보고·재확인 순서를 실제 경험으로 확인함.', required: ['위험 징후', '중지·통제', '보고', '재확인'], sectors: ['public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'quality', label: '품질·정확성', question: '품질 또는 정확성을 높이기 위해 기준을 점검하고 개선한 경험을 작성해 주세요.', purpose: '표준·검사·기록과 결과의 전후 비교를 확인함.', required: ['기준', '확인 방법', '개선', '결과'], sectors: ['finance', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'challenge', label: '도전·학습', question: '익숙하지 않은 과제를 배우고 끝까지 완수한 경험을 작성해 주세요.', purpose: '열정보다 학습 순서·질문·반복 적용을 확인함.', required: ['부족한 점', '학습 행동', '적용 결과'], sectors: ['finance', 'public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'failure', label: '실패·보완', question: '기대한 결과를 얻지 못한 경험과 이후 바꾼 행동을 작성해 주세요.', purpose: '책임 회피 없이 원인을 돌아보고 행동이 실제로 달라졌는지 확인함.', required: ['실패 사실', '내 책임', '바꾼 행동', '재적용'], sectors: ['finance', 'public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'digital', label: '디지털 활용', question: '디지털 도구나 데이터를 활용해 업무·학습 방식을 개선한 경험을 작성해 주세요.', purpose: '도구 이름보다 문제·사용 방법·검증 결과를 확인함.', required: ['기존 문제', '도구 활용', '보안·정확성', '결과'], sectors: ['finance', 'public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'strength-weakness', label: '강점·보완점', question: '직무와 연결되는 강점과 보완 중인 점을 사례와 함께 작성해 주세요.', purpose: '성격 나열이 아니라 업무 영향과 보완 행동을 확인함.', required: ['강점 근거', '보완점 영향', '현재 행동'], sectors: ['finance', 'public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'growth', label: '입사 후 성장', question: '입사 후 처음 익힐 업무와 장기적으로 기여할 방법을 작성해 주세요.', purpose: '과장된 직급 목표보다 초기 학습·확인·기여 순서를 확인함.', required: ['초기 업무', '학습 방법', '장기 기여'], sectors: ['finance', 'public', 'enterprise'], minLength: 450, limit: 650 },
  { id: 'free', label: '자유 기술', question: '지원자가 추가로 알리고 싶은 내용을 자유롭게 작성해 주세요.', purpose: '다른 항목에서 증명하지 못한 직무 관련 근거를 보완함.', required: ['새로운 근거', '지원 직무 연결'], sectors: ['finance', 'public', 'enterprise'], minLength: 500, limit: 700 },
  ...EXTRA_COVER_QUESTIONS,
]

const FOUNDATION_AREAS = {
  '오리엔테이션': '채용공고와 직무기술서를 기준으로 준비 범위를 정함',
  '면접절차': '전형 단계별 목적과 제출 자료·일정을 확인함',
  '평가기준': '질문의 의도와 평가 근거를 행동 사례로 증명함',
  '자기소개': '전공·강점·대표 근거·기여를 짧게 연결함',
  '지원동기': '개인 계기·지원처 근거·직무 기여를 연결함',
  '경험답변': 'STAR 구조에서 자신의 행동과 결과를 구체화함',
  '인성면접': '정직성·책임·협업을 실제 행동으로 설명함',
  '블라인드': '학교명·가족·성별 등 편견정보를 배제함',
  '상황면접': '사실 확인·원칙·행동·보고·재발 방지로 답함',
  'PT/발표': '주장·근거·대안·기대효과를 시간 안에 구조화함',
  '토론/그룹': '경청·요약·근거 제시·합의 형성 과정을 보여 줌',
  '직무면접': '직무기술서와 전공 실습을 연결해 설명함',
  '직장태도': '안전·품질·시간·인수인계 원칙을 지킴',
  '모의면접': '녹화·피드백·재답변으로 행동을 수정함',
  '준비 루틴': '공고·기업·직무·경험·말하기를 순서대로 점검함',
  '블라인드 안전': '답변과 서류에서 편견정보 노출을 사전에 제거함',
}

const letters = ['A', 'B', 'C', 'D']
const makeQuestion = (id, area, lessonId, stem, choices, answerIndex, explanation, lessonTitle = area) => ({
  id, area, category: area, lessonId, lessonTitle, stem, choices, answer: letters[answerIndex], explanation,
  questionMode: 'mcq', learningLane: 'assessment', _mockArea: area,
})

export const INTERVIEW_CAREER_ASSESSMENT_QUESTIONS = [
  ...Object.entries(FOUNDATION_AREAS).flatMap(([area, principle], areaIndex) => Array.from({ length: 10 }, (_, index) => {
    const patterns = [
      [`${area} 준비에서 가장 적절한 학습 기준은?`, [principle, '합격후기의 문장을 그대로 외움', '다른 회사 답변을 회사명만 바꿔 사용함', '근거 없이 자신감만 강조함'], 0],
      [`${area} 답변을 고칠 때 먼저 확인할 것은?`, ['질문 의도와 요구 역량에 맞는 실제 행동 근거', '답변의 어려운 외래어 수', '문장의 길이', '회사 칭찬의 횟수'], 0],
      [`${area} 연습의 결과물로 가장 알맞은 것은?`, ['본인의 경험과 공식 자료를 연결한 짧은 답변', '누구에게나 적용되는 모범답안 암기', '근거 없는 장점 목록', '지원처 이름이 없는 범용 답변'], 0],
      [`${area}에서 신뢰를 떨어뜨리는 행동은?`, ['확인하지 않은 사실을 단정함', '공고의 요구를 다시 확인함', '행동과 결과를 구분함', '모르는 내용은 확인하겠다고 말함'], 0],
      [`${area} 후속 질문에 대비하는 방법은?`, ['처음 답변의 사실관계와 연결되는 추가 근거를 준비함', '처음 답변과 다른 경험을 즉석에서 만듦', '질문을 피하고 장점만 반복함', '면접관의 말을 끊고 결론부터 바꿈'], 0],
    ]
    const [stem, choices, answerIndex] = patterns[index % patterns.length]
    return makeQuestion(`IVF-${String(areaIndex + 1).padStart(2, '0')}-${index + 1}`, area, `FOUNDATION-${areaIndex + 1}`, `${stem} (${index + 1}차 점검)`, choices, answerIndex, `${area}의 핵심은 ${principle}`, interviewFoundationArea(area))
  })),
  ...INTERVIEW_ORGANIZATIONS.flatMap((org, orgIndex) => {
    const area = `${org.sector === 'finance' ? '금융권' : org.sector === 'public' ? '공공기관' : '대기업'} 기관연구`
    const lessonId = `ORG-${org.id}`
    return [
      makeQuestion(`IVO-${orgIndex + 1}-1`, area, lessonId, `${org.name} 지원 전 가장 먼저 교차 확인할 자료는?`, ['현재 채용공고와 직무 설명', '출처 없는 합격후기 하나', '다른 기관의 오래된 공고', '기업 이름만 적힌 요약문'], 0, '전형과 요구역량은 바뀔 수 있으므로 현재 공식 공고와 직무 설명을 먼저 확인해야 함.', org.name),
      makeQuestion(`IVO-${orgIndex + 1}-2`, area, lessonId, `${org.name} 지원동기로 가장 설득력 있는 구성은?`, [`개인 경험 → ${org.identity}에 대한 공식 근거 → 지원 직무 기여`, '규모와 인지도 칭찬 → 열심히 하겠다는 약속', '복지와 안정성 → 장기근속 희망', '다른 회사 답변에서 회사명만 교체'], 0, '지원동기는 개인의 계기와 기관의 역할, 자신의 직무 기여가 연결되어야 함.', org.name),
      makeQuestion(`IVO-${orgIndex + 1}-3`, area, lessonId, `${org.name} 면접 사례로 가장 적절한 것은?`, [`${objectValue(org.values[0])} 보여 주는 자신의 구체적 행동과 결과`, '가치 단어 세 개를 근거 없이 반복', '팀 성과를 전부 자신의 성과로 설명', '확인하지 않은 최신 사업을 단정'], 0, '가치는 표어가 아니라 실제 행동과 확인 가능한 결과로 증명해야 함.', org.name),
      makeQuestion(`IVO-${orgIndex + 1}-4`, area, lessonId, `${org.name}의 최근 전형 정보를 앱 내용과 다르게 발견했다면?`, ['현재 공식 채용공고를 우선하고 준비표를 갱신함', '앱의 문장을 무조건 유지함', '과거 후기만 따름', '차이를 무시하고 지원함'], 0, '앱의 기관 정보는 연구 출발점이며 실제 지원은 현재 공식 공고가 기준임.', org.name),
      makeQuestion(`IVO-${orgIndex + 1}-5`, area, lessonId, `${org.name} 직무 질문을 준비하는 올바른 방법은?`, [`${org.roles.join('·')} 중 지원 직무를 골라 요구역량과 전공 실습을 연결`, '모든 직무에 같은 답변 사용', '직무보다 회사 규모만 설명', '전공명을 말하고 실제 수행 내용은 생략'], 0, '직무를 특정하고 전공에서 수행한 작업을 요구역량과 연결해야 함.', org.name),
    ]
  }),
  ...COVER_LETTER_STEPS.flatMap((step, stepIndex) => Array.from({ length: 5 }, (_, index) => {
    const options = [
      step.check,
      '다른 사람의 완성 문장을 그대로 사용함',
      '근거보다 추상적인 장점을 늘림',
      '지원처와 직무가 달라도 같은 문장을 제출함',
    ]
    return makeQuestion(`IVC-${stepIndex + 1}-${index + 1}`, '자기소개서 완성', `COVER-${step.id}`, `${step.title} 단계에서 가장 중요한 점은? (${index + 1}차 점검)`, options, 0, step.check, step.title)
  })),
]

export const INTERVIEW_CAREER_SCOPES = [
  { key: '금융권 기관연구', name: '금융권 기관연구' },
  { key: '공공기관 기관연구', name: '공공기관 기관연구' },
  { key: '대기업 기관연구', name: '대기업 기관연구' },
  { key: '자기소개서 완성', name: '자기소개서 완성' },
]
