import { COVER_LETTER_QUESTION_LIBRARY } from './coverQuestionLibrary.js'

export const PERSONALIZED_EXAMPLE_STYLES = [
  { id: 'clear', label: '담백형', lead: '', close: '이 경험을 지원 직무의 기본 행동으로 이어 가겠습니다.' },
  { id: 'logical', label: '논리형', lead: '판단의 기준과 결과를 순서대로 설명하겠습니다.', close: '같은 기준으로 업무를 확인하고 결과를 근거로 설명하겠습니다.' },
  { id: 'field', label: '현장형', lead: '제가 현장에서 직접 확인하고 움직인 경험이 있습니다.', close: '현장에서도 안전·품질·고객 기준을 놓치지 않겠습니다.' },
  { id: 'growth', label: '성장형', lead: '부족함을 확인한 뒤 행동을 바꾼 경험이 있습니다.', close: '배운 내용을 반복 적용해 더 나은 결과를 만들겠습니다.' },
]

export const PERSONALIZED_MAJOR_PROFILES = [
  {
    id: 'business', label: '상업·금융', role: '사무·금융·회계 직무', field: '거래 자료와 고객 정보를 정확히 다루는 일',
    tools: ['스프레드시트 함수', '회계 전표', '고객 안내문', '자료 대조표'], standards: ['원자료 일치', '개인정보 보호', '처리 기한', '고객 이해 여부'],
    tasks: ['거래 자료의 누락을 찾는 과제', '정산표와 증빙을 맞추는 과제', '고객 안내 절차를 정리하는 과제'],
    certificates: [
      { id: 'computer-accounting', label: '전산회계', competency: '전표와 계정과목을 구분하는 연습' },
      { id: 'computer-tax', label: '전산세무', competency: '증빙과 세무 자료를 대조하는 연습' },
      { id: 'word-processing', label: '워드프로세서', competency: '문서 구조와 검토 기준을 적용하는 연습' },
      { id: 'computer-skills', label: '컴퓨터활용능력', competency: '데이터를 분류하고 검산하는 연습' },
    ],
  },
  {
    id: 'software', label: '정보·소프트웨어', role: '개발·데이터·IT 운영 직무', field: '사용자 요구를 기능과 데이터로 바꾸는 일',
    tools: ['디버깅 기록표', '버전 관리 도구', '데이터 검증식', '테스트 시나리오'], standards: ['재현 가능성', '데이터 정확성', '접근 권한', '사용자 요구 충족'],
    tasks: ['반복 오류의 조건을 찾는 과제', '사용자 입력을 검증하는 과제', '팀 코드를 통합하는 과제'],
    certificates: [
      { id: 'information-processing', label: '정보처리기능사', competency: '프로그램 구조와 데이터 처리 절차를 익히는 연습' },
      { id: 'web-design', label: '웹디자인기능사', competency: '화면 요구와 구현 결과를 비교하는 연습' },
      { id: 'linux-master', label: '리눅스마스터', competency: '시스템 명령과 권한을 확인하는 연습' },
      { id: 'network-manager', label: '네트워크관리사', competency: '연결 상태와 장애 원인을 순서대로 점검하는 연습' },
    ],
  },
  {
    id: 'electrical', label: '전기·전자', role: '전기·전자·제어 직무', field: '회로와 설비 상태를 측정하고 안전하게 제어하는 일',
    tools: ['멀티미터', '회로도', 'PLC 모니터링 화면', '결선 점검표'], standards: ['정격 범위', '전원 차단 절차', '측정값 기록', '재가동 전 확인'],
    tasks: ['측정값이 기준을 벗어난 원인을 찾는 과제', '회로도대로 결선을 완성하는 과제', '제어 순서를 시험하는 과제'],
    certificates: [
      { id: 'electrician', label: '전기기능사', competency: '회로와 안전 절차를 기준대로 적용하는 연습' },
      { id: 'electronic-device', label: '전자기기기능사', competency: '전자 부품과 측정값을 확인하는 연습' },
      { id: 'production-automation', label: '생산자동화기능사', competency: '제어 순서와 센서 동작을 점검하는 연습' },
      { id: 'railway-electrical-signal', label: '철도전기신호기능사', competency: '신호 설비의 동작 기준과 안전을 확인하는 연습' },
    ],
  },
  {
    id: 'mechanical', label: '기계·자동차', role: '생산·정비·설비 직무', field: '도면과 작업 기준에 맞게 가공·조립·정비하는 일',
    tools: ['버니어캘리퍼스', '작업 도면', '토크 렌치', '설비 점검표'], standards: ['치수 공차', '체결 순서', '보호구 착용', '시운전 결과'],
    tasks: ['조립 오차의 원인을 찾는 과제', '도면 치수에 맞게 부품을 가공하는 과제', '설비 이상음을 점검하는 과제'],
    certificates: [
      { id: 'computer-lathe', label: '컴퓨터응용선반기능사', competency: '도면과 가공 치수를 대조하는 연습' },
      { id: 'computer-milling', label: '컴퓨터응용밀링기능사', competency: '가공 순서와 측정 결과를 확인하는 연습' },
      { id: 'automotive-maintenance', label: '자동차정비기능사', competency: '증상과 점검 결과로 정비 원인을 좁히는 연습' },
      { id: 'machine-maintenance', label: '설비보전기능사', competency: '설비 상태를 기록하고 예방 점검하는 연습' },
    ],
  },
  {
    id: 'architecture', label: '건축·토목', role: '건축·토목·시설 직무', field: '도면과 현장 조건을 대조해 공정과 품질을 관리하는 일',
    tools: ['CAD 도면', '레이저 거리 측정기', '공정표', '현장 점검표'], standards: ['도면 치수', '작업 순서', '현장 안전', '마감 품질'],
    tasks: ['도면과 현장 치수의 차이를 확인하는 과제', '제한된 자재로 공정을 계획하는 과제', '마감 상태를 검사하는 과제'],
    certificates: [
      { id: 'interior-architecture', label: '실내건축기능사', competency: '도면과 공간 요구를 연결하는 연습' },
      { id: 'architectural-painting', label: '건축도장기능사', competency: '바탕 상태와 도장 순서를 지키는 연습' },
      { id: 'surveying', label: '측량기능사', competency: '측정값을 기록하고 오차를 확인하는 연습' },
      { id: 'computer-drawing-architecture', label: '전산응용건축제도기능사', competency: '도면 요소와 작성 기준을 검토하는 연습' },
    ],
  },
  {
    id: 'food', label: '조리·식품', role: '조리·제과·식품품질 직무', field: '위생과 작업 순서를 지키며 일정한 품질을 만드는 일',
    tools: ['중심온도계', '계량 도구', '위생 점검표', '원가 계산표'], standards: ['교차오염 방지', '정확한 계량', '작업 시간', '완성 품질'],
    tasks: ['같은 조리 결과를 반복해 만드는 과제', '재료 손실을 줄이는 과제', '위생 기준에 맞게 작업대를 운영하는 과제'],
    certificates: [
      { id: 'korean-cuisine', label: '한식조리기능사', competency: '재료 손질과 조리 순서를 기준대로 수행하는 연습' },
      { id: 'western-cuisine', label: '양식조리기능사', competency: '조리 시간과 완성 상태를 함께 관리하는 연습' },
      { id: 'confectionery', label: '제과기능사', competency: '배합과 굽기 조건을 기록해 품질을 맞추는 연습' },
      { id: 'bread-making', label: '제빵기능사', competency: '발효 상태와 작업 시간을 확인하는 연습' },
    ],
  },
  {
    id: 'service', label: '관광·서비스', role: '관광·호텔·고객서비스 직무', field: '고객의 요구를 확인하고 정확한 안내와 대안을 제공하는 일',
    tools: ['예약 확인표', '고객 응대 기록', '서비스 동선표', '외국어 안내문'], standards: ['예약 정보 일치', '개인정보 보호', '고객 이해 확인', '인계 정확성'],
    tasks: ['예약 변경 요청을 처리하는 과제', '대기 고객의 불편을 줄이는 과제', '행사 동선을 안내하는 과제'],
    certificates: [
      { id: 'tourism-interpreter', label: '관광통역안내사', competency: '관광 정보를 정확하고 이해하기 쉽게 설명하는 연습' },
      { id: 'hotel-service', label: '호텔서비스사', competency: '예약과 고객 요청을 절차에 따라 처리하는 연습' },
      { id: 'domestic-travel', label: '국내여행안내사', competency: '일정과 안전 정보를 확인해 안내하는 연습' },
      { id: 'bartender', label: '조주기능사', competency: '주문과 제조 기준을 정확히 맞추는 연습' },
    ],
  },
  {
    id: 'design', label: '디자인·미용', role: '디자인·콘텐츠·미용 직무', field: '고객 요구를 시각적 결과물과 서비스로 구체화하는 일',
    tools: ['요구사항 메모', '디자인 시안', '색상·재료 표', '고객 피드백표'], standards: ['요구 반영', '도구 위생', '작업 순서', '수정 이력'],
    tasks: ['서로 다른 요구를 한 시안에 정리하는 과제', '피드백을 반영해 결과물을 수정하는 과제', '제한 시간 안에 작업을 완성하는 과제'],
    certificates: [
      { id: 'computer-graphics', label: '컴퓨터그래픽스운용기능사', competency: '시각 요소와 출력 기준을 점검하는 연습' },
      { id: 'makeup-artist', label: '미용사(메이크업)', competency: '대상과 주제에 맞는 메이크업 디자인을 수행하는 연습' },
      { id: 'hairdresser', label: '미용사(일반)', competency: '고객 요구와 작업 순서를 연결하는 연습' },
      { id: 'nail-artist', label: '미용사(네일)', competency: '위생과 세부 표현을 함께 관리하는 연습' },
    ],
  },
  {
    id: 'bio', label: '보건·바이오', role: '보건·바이오·의료지원 직무', field: '대상자 안전과 정확한 기록을 바탕으로 검사·지원하는 일',
    tools: ['위생 체크리스트', '측정 기록지', '검체 라벨', '대상자 안내문'], standards: ['감염 예방', '대상자 확인', '측정값 정확성', '기록 보안'],
    tasks: ['측정값의 이상 여부를 확인하는 과제', '검체와 기록을 정확히 연결하는 과제', '대상자에게 절차를 설명하는 과제'],
    certificates: [
      { id: 'nursing-assistant', label: '간호조무사', competency: '대상자 확인과 기본 간호 절차를 익히는 연습' },
      { id: 'laboratory-animal-technician', label: '실험동물기술원', competency: '생명윤리와 기록 기준을 적용하는 연습' },
      { id: 'industrial-hygiene', label: '산업위생관리기능 관련 과정', competency: '작업환경 유해요인과 측정 기록을 이해하는 연습' },
      { id: 'computer-skills-bio', label: '컴퓨터활용능력', competency: '측정 자료를 분류하고 오류를 확인하는 연습' },
    ],
  },
  {
    id: 'general', label: '공통·기타', role: '지원 직무', field: '맡은 역할을 기준에 맞게 끝까지 수행하는 일',
    tools: ['업무 체크리스트', '공유 일정표', '회의 기록', '결과 확인표'], standards: ['역할 명확성', '기한 준수', '정보 공유', '결과 확인'],
    tasks: ['여러 사람의 역할을 맞추는 과제', '제한된 시간에 결과물을 완성하는 과제', '반복되는 누락을 줄이는 과제'],
    certificates: [
      { id: 'korean-history', label: '한국사능력검정시험', competency: '자료의 맥락과 근거를 구분하는 연습' },
      { id: 'office-practice', label: '사무 관련 자격 과정', competency: '문서와 일정 정보를 정확히 정리하는 연습' },
      { id: 'language-score', label: '어학 자격·성적', competency: '상대와 목적에 맞게 정보를 전달하는 연습' },
      { id: 'career-course', label: '직무 관련 교육 이수', competency: '새 기준을 배우고 과제에 적용하는 연습' },
    ],
  },
]

export const DEPARTMENT_SPECIALTY_PROFILES = [
  { id: 'digital-business', pattern: /(AI.*경영|플랫폼.*비즈니스|디지털.*경영|스마트.*경영)/i, role: '디지털 사무·경영지원 직무', field: '경영 자료와 디지털 도구를 연결해 업무 흐름을 개선하는 일', tools: ['업무 대시보드', '스프레드시트 함수', '고객 데이터 표', '전자문서 양식'], standards: ['원자료 일치', '개인정보 보호', '업무 흐름', '수치 검산'], tasks: ['고객 자료를 분류하는 과제', '반복 문서 작업을 줄이는 과제', '매출 자료의 흐름을 설명하는 과제'] },
  { id: 'nursing-health', pattern: /(간호|보건|의료|치위생|재활|요양)/, role: '보건·의료지원 직무', field: '대상자 확인과 감염 예방 기준을 지키며 안전하게 지원하는 일', tools: ['활력징후 기록지', '위생 체크리스트', '대상자 확인표', '물품 준비표'], standards: ['대상자 확인', '감염 예방', '측정값 정확성', '기록 보안'], tasks: ['대상자와 기록을 정확히 연결하는 과제', '기본 측정 절차를 수행하는 과제', '물품 준비 누락을 확인하는 과제'] },
  { id: 'bio-chemical', pattern: /(바이오|생명|제약|화학|화공|화장품|건강과학|공정운전)/, role: '바이오·품질·시험지원 직무', field: '시료와 시험 조건을 통제해 재현 가능한 결과를 만드는 일', tools: ['시료 라벨', '실험 기록지', '정밀 저울', '오염 관리표'], standards: ['시료 추적성', '정확한 계량', '오염 방지', '시험 조건 기록'], tasks: ['시료와 기록을 일치시키는 과제', '시험 조건에 따른 차이를 확인하는 과제', '오염 가능성을 줄이는 과제'] },
  { id: 'electrical-energy', pattern: /(전기|에너지|신재생)/, role: '전기·에너지 설비 직무', field: '전원과 설비 상태를 측정하고 안전 절차에 따라 복구하는 일', tools: ['멀티미터', '단선 결선도', '절연 점검표', '에너지 사용 기록'], standards: ['전원 차단 절차', '정격 범위', '측정값 기록', '재가동 전 확인'], tasks: ['회로 이상 구간을 찾는 과제', '결선 상태를 도면과 대조하는 과제', '설비 사용량을 점검하는 과제'] },
  { id: 'electronics-semiconductor', pattern: /(전자|반도체|디스플레이)/, role: '전자·반도체 생산기술 직무', field: '회로와 공정 데이터를 확인해 불량 원인을 좁히는 일', tools: ['오실로스코프', '회로도', '공정 조건표', '불량 분석표'], standards: ['측정 조건 일치', '부품 극성', '정전기 방지', '공정 이력'], tasks: ['출력 파형의 차이를 찾는 과제', '부품 실장 상태를 검사하는 과제', '공정 조건별 불량을 비교하는 과제'] },
  { id: 'automation-robot', pattern: /(로봇|메카트로닉스|자동화|스마트팩토리|제어|드론)/, role: '자동화·로봇·제어 직무', field: '센서와 제어 순서를 연결해 설비가 의도대로 움직이게 하는 일', tools: ['PLC 모니터링 화면', '센서 상태표', '동작 순서도', '설비 알람 기록'], standards: ['인터록 확인', '센서 입력 일치', '동작 순서', '비상 정지 절차'], tasks: ['센서 오동작 원인을 찾는 과제', '자동 운전 순서를 시험하는 과제', '설비 알람 조건을 재현하는 과제'] },
  { id: 'automotive', pattern: /(자동차|모빌리티)/, role: '자동차 정비·생산 직무', field: '차량 증상과 측정값을 연결해 정비 원인을 좁히는 일', tools: ['자동차 진단기', '토크 렌치', '정비 작업지시서', '점검 체크리스트'], standards: ['정비 순서', '체결 토크', '시운전 결과', '안전 장치 확인'], tasks: ['차량 이상 증상의 원인을 찾는 과제', '소모 부품 상태를 점검하는 과제', '정비 뒤 재발 여부를 확인하는 과제'] },
  { id: 'mechanical-production', pattern: /(기계|금형|가공|용접|정밀|조선|산업설비|스마트설비|공정설비|폴리메카닉스|철도차량)/, role: '기계가공·생산·설비 직무', field: '도면과 측정값을 대조해 규격에 맞는 부품과 설비를 만드는 일', tools: ['버니어캘리퍼스', '가공 도면', '용접 조건표', '설비 점검표'], standards: ['치수 공차', '가공 순서', '보호구 착용', '검사 결과'], tasks: ['가공 치수 오차를 줄이는 과제', '도면 순서대로 부품을 조립하는 과제', '설비 이상 징후를 확인하는 과제'] },
  { id: 'software-ai', pattern: /(소프트웨어|정보|컴퓨터|인공지능|빅데이터|사이버|사물인터넷|임베디드|AI|SW|IoT|IT)/i, role: '개발·데이터·IT 운영 직무', field: '사용자 요구와 데이터를 기능으로 바꾸고 오류를 재현해 해결하는 일', tools: ['버전 관리 도구', '디버깅 로그', '데이터 검증식', '테스트 시나리오'], standards: ['재현 가능성', '데이터 정확성', '접근 권한', '사용자 요구 충족'], tasks: ['반복 오류 조건을 찾는 과제', '사용자 입력을 검증하는 과제', '팀 코드를 통합하는 과제'] },
  { id: 'content-media', pattern: /(게임|콘텐츠|영상|방송|미디어|애니|만화|크리에이터|3D모델링)/, role: '디지털 콘텐츠 제작 직무', field: '기획 의도와 사용 환경에 맞춰 콘텐츠를 제작하고 수정하는 일', tools: ['스토리보드', '편집 타임라인', '에셋 목록', '피드백 기록표'], standards: ['기획 의도 반영', '저작권 확인', '파일 규격', '수정 이력'], tasks: ['장면 흐름을 편집하는 과제', '피드백에 따라 시안을 수정하는 과제', '에셋 누락을 확인하는 과제'] },
  { id: 'accounting-finance', pattern: /(회계|세무|금융)/, role: '회계·세무·금융사무 직무', field: '거래 근거와 수치를 대조해 정확한 회계·금융 정보를 만드는 일', tools: ['회계 전표', '증빙 대조표', '스프레드시트 함수', '고객 확인서'], standards: ['계정과목 일치', '증빙 적정성', '수치 검산', '개인정보 보호'], tasks: ['전표와 증빙을 맞추는 과제', '정산 차이의 원인을 찾는 과제', '고객 거래 정보를 확인하는 과제'] },
  { id: 'business-office', pattern: /(경영|사무|비즈니스|상업|공공행정|국제통상)/, role: '경영지원·사무행정 직무', field: '문서와 일정, 고객 정보를 정확하게 연결해 업무를 지원하는 일', tools: ['전자문서 양식', '공유 일정표', '자료 대조표', '고객 안내문'], standards: ['원자료 일치', '처리 기한', '문서 형식', '정보 보안'], tasks: ['문서 누락을 확인하는 과제', '일정과 담당자를 연결하는 과제', '고객 안내 절차를 정리하는 과제'] },
  { id: 'commerce-logistics', pattern: /(유통|물류|무역|전자상거래|마케팅)/, role: '유통·물류·마케팅 직무', field: '상품과 주문, 재고 정보를 연결해 고객에게 정확히 전달하는 일', tools: ['재고 관리표', '바코드 기록', '주문 대조표', '판매 데이터'], standards: ['재고 일치', '입출고 순서', '고객 약속', '수치 검산'], tasks: ['재고 차이의 원인을 찾는 과제', '주문과 출고 내역을 맞추는 과제', '판매 자료를 비교하는 과제'] },
  { id: 'cooking', pattern: /(조리|외식)/, role: '조리·외식서비스 직무', field: '위생과 조리 순서를 지켜 일정한 맛과 품질을 만드는 일', tools: ['중심온도계', '조리 공정표', '위생 점검표', '원가 계산표'], standards: ['교차오염 방지', '조리 온도', '작업 시간', '완성 품질'], tasks: ['조리 결과를 일정하게 만드는 과제', '작업대 위생을 유지하는 과제', '재료 손실을 줄이는 과제'] },
  { id: 'bakery-food', pattern: /(제과|제빵|식품|베이커리|카페|디저트)/, role: '제과·제빵·식품품질 직무', field: '배합과 공정 조건을 기록해 균일하고 안전한 제품을 만드는 일', tools: ['정밀 저울', '발효 기록표', '중심온도계', '제품 검사표'], standards: ['정확한 계량', '발효·가열 조건', '식품 위생', '완성 품질'], tasks: ['배합 오차를 줄이는 과제', '발효 상태를 비교하는 과제', '제품 품질 편차를 확인하는 과제'] },
  { id: 'childcare', pattern: /(보육|유아)/, role: '보육·아동지원 직무', field: '아동의 안전과 발달 상태를 관찰해 적절한 활동을 지원하는 일', tools: ['활동 관찰 기록', '안전 점검표', '준비물 목록', '보호자 안내문'], standards: ['아동 안전', '개인차 존중', '관찰 기록', '보호자 소통'], tasks: ['연령에 맞는 활동을 준비하는 과제', '놀이 중 안전 요소를 점검하는 과제', '활동 반응을 관찰해 기록하는 과제'] },
  { id: 'sports', pattern: /(체육|스포츠|골프)/, role: '스포츠·생활체육 운영 직무', field: '참여자의 상태와 안전을 확인해 운동 프로그램을 운영하는 일', tools: ['운동 기록표', '시설 안전 점검표', '프로그램 일정표', '참여자 확인표'], standards: ['참여자 안전', '동작 정확성', '시설 상태', '진행 기록'], tasks: ['운동 동작을 단계별로 안내하는 과제', '시설 위험 요소를 점검하는 과제', '참여자별 진행 상태를 기록하는 과제'] },
  { id: 'tourism-hospitality', pattern: /(관광|호텔|항공|서비스)/, role: '관광·호텔·항공서비스 직무', field: '예약과 고객 요구를 정확히 확인해 안전하고 이해하기 쉽게 안내하는 일', tools: ['예약 확인표', '고객 응대 기록', '서비스 동선표', '외국어 안내문'], standards: ['예약 정보 일치', '고객 이해 확인', '개인정보 보호', '인계 정확성'], tasks: ['예약 변경 요청을 처리하는 과제', '대기 고객 동선을 조정하는 과제', '안전 정보를 안내하는 과제'] },
  { id: 'beauty', pattern: /(미용|뷰티|헤어|피부|네일)/, role: '미용·뷰티서비스 직무', field: '고객 상태와 요구를 확인해 위생적인 절차로 서비스를 제공하는 일', tools: ['고객 상담 기록', '도구 위생표', '시술 순서표', '색상·재료표'], standards: ['도구 위생', '고객 상태 확인', '작업 순서', '사후 안내'], tasks: ['고객 요구에 맞는 시술을 계획하는 과제', '도구 위생 상태를 점검하는 과제', '피드백에 따라 결과를 수정하는 과제'] },
  { id: 'visual-design', pattern: /(디자인|그래픽|패션|공예|주얼리|도예)/, role: '디자인·제품·패션 직무', field: '사용자 요구와 제작 조건을 시각적 결과물로 구체화하는 일', tools: ['디자인 시안', '색상·재료표', '출력 규격표', '피드백 기록'], standards: ['요구 반영', '파일 규격', '재료 특성', '수정 이력'], tasks: ['서로 다른 요구를 한 시안에 정리하는 과제', '출력 결과를 규격과 맞추는 과제', '피드백을 반영해 수정하는 과제'] },
  { id: 'architecture-interior', pattern: /(건축|인테리어|건설|도시공간)/, role: '건축·인테리어·시설 직무', field: '도면과 현장 치수를 대조해 공간과 공정을 구체화하는 일', tools: ['CAD 도면', '레이저 거리 측정기', '공정표', '마감 점검표'], standards: ['도면 치수', '작업 순서', '현장 안전', '마감 품질'], tasks: ['도면과 현장 치수 차이를 확인하는 과제', '공간 요구를 도면에 반영하는 과제', '마감 상태를 검사하는 과제'] },
  { id: 'civil-survey', pattern: /(토목|측량|공간정보)/, role: '토목·측량·공간정보 직무', field: '현장 측정값과 도면을 연결해 위치와 공정을 정확히 관리하는 일', tools: ['측량 장비', '현장 야장', '공정 도면', '안전 점검표'], standards: ['측정 오차', '기준점 확인', '현장 안전', '기록 일치'], tasks: ['측정값 오차를 확인하는 과제', '기준점과 도면을 대조하는 과제', '현장 공정 순서를 계획하는 과제'] },
  { id: 'agriculture-landscape', pattern: /(농업|원예|조경|산림|축산|식물|스마트팜)/, role: '농생명·조경·환경관리 직무', field: '생육과 환경 변화를 관찰하고 기록해 적절한 작업 시점을 정하는 일', tools: ['생육 기록표', '토양 측정기', '작업 일정표', '병해충 관찰표'], standards: ['생육 상태', '작업 시기', '도구 안전', '환경 조건'], tasks: ['생육 차이의 원인을 찾는 과제', '작업 시기를 계획하는 과제', '병해충 징후를 기록하는 과제'] },
  { id: 'animal-care', pattern: /(동물|반려|말산업)/, role: '동물보건·반려동물관리 직무', field: '동물의 상태 변화를 관찰하고 위생·복지 기준에 따라 돌보는 일', tools: ['건강 관찰표', '급여 기록', '위생 체크리스트', '행동 기록지'], standards: ['동물 복지', '위생 관리', '상태 변화 기록', '안전한 보정'], tasks: ['행동과 건강 변화를 기록하는 과제', '사육 공간 위생을 점검하는 과제', '급여량과 상태를 비교하는 과제'] },
  { id: 'marine-fisheries', pattern: /(수산|해양|항해|기관과)/, role: '해양·수산·선박 직무', field: '수질과 장비, 항해 조건을 확인해 안전하게 작업하는 일', tools: ['수질 측정기', '항해 점검표', '기관 운전 기록', '위생 관리표'], standards: ['해상 안전', '수질 기준', '장비 점검', '작업 기록'], tasks: ['수질 변화 원인을 확인하는 과제', '출항 전 장비를 점검하는 과제', '수산물 위생 상태를 관리하는 과제'] },
  { id: 'defense-safety', pattern: /(군사|부사관|국방|소방|안전)/, role: '안전·국방·재난대응 직무', field: '정해진 절차와 보고 체계를 지켜 위험을 통제하는 일', tools: ['장비 점검표', '상황 보고서', '위험 구역도', '비상 절차서'], standards: ['지휘·보고 체계', '장비 상태', '위험 통제', '보안 준수'], tasks: ['비상 절차를 순서대로 수행하는 과제', '장비 이상 상태를 보고하는 과제', '위험 구역을 통제하는 과제'] },
]

export const PERSONALIZED_ACTIVITY_PROFILES = [
  { id: 'major-practice', label: '전공 실습', settings: ['전공 실습 시간에', '교내 실습실에서', '학기 실습 과제에서'], issues: ['첫 결과가 기준과 달랐습니다', '작업 순서가 팀마다 달랐습니다', '완성 직전 누락이 발견됐습니다'], collaborations: ['지도교사에게 기준을 다시 확인했습니다', '팀원과 점검 순서를 나눴습니다', '서로의 결과를 교차 확인했습니다'], results: ['점검 결과와 수정 과정을 작업일지에 남겼습니다', '다음 작업에서 같은 누락이 반복되지 않았습니다', '최종 결과가 제시된 기준을 충족했습니다'] },
  { id: 'field-practice', label: '현장실습', settings: ['현장실습 첫 주에', '사업장 업무를 보조하며', '현장 인계 과정에서'], issues: ['학교에서 익힌 순서와 실제 절차가 달랐습니다', '담당자마다 인계 내용이 달랐습니다', '작은 이상 징후가 반복됐습니다'], collaborations: ['담당자에게 실제 기준과 이유를 질문했습니다', '인계 내용을 확인받아 기록했습니다', '작업을 멈추고 책임자에게 먼저 보고했습니다'], results: ['확인받은 절차대로 업무를 마쳤습니다', '다음 근무자가 같은 기록으로 이어서 처리했습니다', '이상 원인과 조치 결과를 현장 기록에 남겼습니다'] },
  { id: 'team-project', label: '팀 프로젝트', settings: ['팀 프로젝트를 진행하며', '공동 결과물을 준비하며', '팀 과제 중간 점검에서'], issues: ['역할 경계가 모호해 일이 겹쳤습니다', '진행 속도와 정확성에 대한 의견이 달랐습니다', '자료 형식이 서로 달라 통합이 어려웠습니다'], collaborations: ['할 일과 중간 마감을 다시 정했습니다', '공통 기준표를 만들고 역할을 조정했습니다', '파일 이름과 검토 순서를 통일했습니다'], results: ['모든 팀원이 맡은 부분을 기한 안에 완성했습니다', '통합 과정의 재작업을 줄였습니다', '최종 검토에서 누락 없이 제출했습니다'] },
  { id: 'certificate', label: '자격 준비', settings: ['자격 실기 연습을 하며', '자격 필기와 실기를 함께 준비하며', '모의 작업을 반복하며'], issues: ['외운 순서가 실제 작업에서 자주 끊겼습니다', '같은 유형의 실수가 반복됐습니다', '시간 안에 검토까지 마치기 어려웠습니다'], collaborations: ['오답과 작업 실패 원인을 유형별로 기록했습니다', '교사 피드백을 작업 순서표에 반영했습니다', '연습 시간을 수행과 검토로 나눴습니다'], results: ['틀린 이유를 설명하고 다시 수행할 수 있게 됐습니다', '반복 실수의 조건을 스스로 찾았습니다', '정해진 시간 안에 검토까지 마치는 습관을 만들었습니다'] },
  { id: 'club', label: '동아리', settings: ['동아리 활동에서', '동아리 행사를 준비하며', '후배와 공동 작업을 하며'], issues: ['참여 가능한 시간이 서로 달랐습니다', '처음 참여한 학생이 절차를 어려워했습니다', '준비물과 역할 안내가 누락됐습니다'], collaborations: ['가능한 시간을 먼저 조사해 일정을 나눴습니다', '전문용어를 작업 순서로 바꿔 설명했습니다', '준비물과 담당자를 한 장으로 공유했습니다'], results: ['빠진 역할 없이 행사를 진행했습니다', '처음 참여한 학생도 자신의 작업을 마쳤습니다', '다음 행사에 다시 쓸 운영 기록을 남겼습니다'] },
  { id: 'class-role', label: '학급 역할', settings: ['학급에서 맡은 역할을 수행하며', '학급 행사를 준비하며', '공용 물품을 관리하며'], issues: ['공지 확인 시점이 달라 준비가 늦어졌습니다', '일부 학생에게 역할이 몰렸습니다', '사용 후 물품 위치가 자주 달라졌습니다'], collaborations: ['핵심 일정과 확인 여부를 표로 정리했습니다', '가능한 역할을 다시 묻고 분담했습니다', '반납 위치와 상태 확인 칸을 만들었습니다'], results: ['마감 전에 준비 상태를 모두 확인했습니다', '참여 가능한 학생이 각자 역할을 맡았습니다', '다음 사용자가 바로 상태를 확인할 수 있었습니다'] },
  { id: 'part-time', label: '아르바이트', settings: ['아르바이트 근무 중', '교대 시간에', '고객 요청을 처리하며'], issues: ['주문 내용과 처리 결과가 달랐습니다', '인계되지 않은 요청이 남아 있었습니다', '고객이 안내 내용을 이해하지 못했습니다'], collaborations: ['요청을 제 말로 다시 확인했습니다', '미처리 내용과 다음 행동을 기록해 인계했습니다', '가능한 방법과 어려운 이유를 나누어 설명했습니다'], results: ['처리 오류 없이 고객 확인을 받았습니다', '다음 근무자가 중복 확인 없이 업무를 이어 갔습니다', '고객이 대안을 직접 선택할 수 있었습니다'] },
  { id: 'volunteer', label: '봉사', settings: ['봉사활동 안내를 맡으며', '지역 행사 지원 중', '이용자 접수를 도우며'], issues: ['절차를 어려워하는 이용자가 있었습니다', '이동 동선이 한곳에 겹쳤습니다', '안내문만으로는 필요한 정보를 찾기 어려웠습니다'], collaborations: ['어느 단계가 어려운지 먼저 질문했습니다', '운영자와 대기 위치를 다시 정했습니다', '안내 순서를 짧은 문장으로 바꿨습니다'], results: ['이용자가 스스로 다음 절차를 진행했습니다', '대기 동선이 분리되어 혼잡이 줄었습니다', '같은 질문에 일관된 안내를 제공했습니다'] },
  { id: 'self-study', label: '개인 학습', settings: ['개인 학습 계획을 세우며', '부족한 기능을 혼자 연습하며', '학습 결과를 점검하며'], issues: ['공부 시간만 늘고 같은 부분에서 막혔습니다', '배운 내용을 실제 과제에 적용하기 어려웠습니다', '진행 여부를 기억에만 의존했습니다'], collaborations: ['막힌 지점을 작은 단위로 나눠 기록했습니다', '작은 예제에 먼저 적용한 뒤 난도를 높였습니다', '주간 목표와 완료 근거를 함께 표시했습니다'], results: ['다음 학습 순서를 스스로 정할 수 있게 됐습니다', '새 과제에서도 같은 원리를 적용했습니다', '완료한 것과 보완할 것을 명확히 구분했습니다'] },
]

const QUESTION_FOCUS = {
  motivation: ['직무에 관심을 가진 계기', '지원처 공식 근거', '입사 후 첫 기여'],
  'job-competency': ['직무가 요구하는 기준', '준비한 기술', '적용 결과'],
  experience: ['맡은 목표', '직접 한 행동', '확인 가능한 결과'],
  collaboration: ['의견 차이', '역할 조정', '공동 결과'],
  'problem-solving': ['문제 현상', '원인 확인', '개선 검증'],
  customer: ['상대 요구', '확인 질문', '이해 확인'],
  ethics: ['성과와 원칙의 충돌', '판단 기준', '보고와 기록'],
  'public-value': ['영향받는 사람', '공공 기준', '책임 행동'],
  safety: ['위험 징후', '작업 통제', '재확인'],
  quality: ['품질 기준', '검사 방법', '전후 변화'],
  challenge: ['낯선 과제', '학습 순서', '적용 결과'],
  failure: ['부족했던 행동', '원인', '다시 적용한 변화'],
  digital: ['기존 불편', '도구 활용', '정확성 검증'],
  'strength-weakness': ['행동으로 드러난 강점', '보완점의 영향', '현재의 보완 행동'],
  growth: ['입사 초기 학습', '확인 방법', '장기 기여'],
  free: ['다른 문항에 없는 근거', '직무 관련 행동', '지원 직무 연결'],
  'role-understanding': ['직무의 실제 업무', '업무 기준', '내 준비'],
  communication: ['상대의 어려움', '설명 방식', '이해 확인'],
  conflict: ['핵심 쟁점', '공통 기준', '합의 결과'],
  leadership: ['팀에 필요했던 일', '지원·조정 행동', '공동 결과'],
  'resource-management': ['시간·자원 제약', '우선순위', '완료 결과'],
  responsibility: ['맡은 책임', '지킨 기준', '반복 행동'],
  adaptation: ['달라진 조건', '새 기준 확인', '적응 결과'],
  creativity: ['기존 불편', '작은 대안', '전후 비교'],
  'major-practice': ['사용 기술·도구', '직접 한 작업', '안전·품질 기준'],
  'school-life': ['맡은 역할', '구체적 행동', '현재 업무 태도'],
  achievement: ['목표', '점검과 수정', '전후 결과'],
  'self-development': ['부족한 역량', '학습 계획', '적용 변화'],
  'organization-fit': ['나의 업무 가치', '행동 사례', '지원처 가치와 연결'],
  'social-responsibility': ['영향받는 사람', '고려 기준', '책임 행동'],
}

function choose(values, seed) {
  return values[Math.abs(Number(seed) || 0) % values.length]
}

function hasBatchim(value) {
  const code = String(value || '').trim().charCodeAt(String(value || '').trim().length - 1)
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
}

const object = value => `${value}${hasBatchim(value) ? '을' : '를'}`
const instrument = value => `${value}${hasBatchim(value) ? '으로' : '로'}`
const topic = value => `${value}${hasBatchim(value) ? '은' : '는'}`
const together = value => `${value}${hasBatchim(value) ? '과' : '와'}`

export function majorExampleProfile(id = 'general') {
  return PERSONALIZED_MAJOR_PROFILES.find(item => item.id === id) || PERSONALIZED_MAJOR_PROFILES.at(-1)
}

export function departmentSpecialtyProfile(name = '') {
  return DEPARTMENT_SPECIALTY_PROFILES.find(item => item.pattern.test(String(name || ''))) || null
}

export function activityExampleProfile(id = 'major-practice') {
  return PERSONALIZED_ACTIVITY_PROFILES.find(item => item.id === id)
    || PERSONALIZED_ACTIVITY_PROFILES.find(item => item.label === id)
    || PERSONALIZED_ACTIVITY_PROFILES[0]
}

export function certificateOptions(majorGroup = 'general') {
  return majorExampleProfile(majorGroup).certificates
}

function evidenceScene({ majorGroup, departmentName = '', sourceType, certificateId, variant = 0 }) {
  const baseMajor = majorExampleProfile(majorGroup)
  const specialty = departmentSpecialtyProfile(departmentName)
  const major = specialty ? { ...baseMajor, ...specialty, id: baseMajor.id, label: baseMajor.label, certificates: baseMajor.certificates } : baseMajor
  const activity = activityExampleProfile(sourceType)
  const certificate = major.certificates.find(item => item.id === certificateId)
  const tool = choose(major.tools, variant)
  const standard = choose(major.standards, variant + 1)
  const task = choose(major.tasks, variant + 2)
  const setting = choose(activity.settings, variant)
  const issue = choose(activity.issues, variant + 1)
  const collaboration = choose(activity.collaborations, variant + 2)
  const result = choose(activity.results, variant)
  const certificateSentence = certificate
    ? `${certificate.label} 준비에서 ${object(certificate.competency)} 반복해 이 과제의 점검 기준으로 삼았습니다.`
    : ''
  return { major, activity, certificate, tool, standard, task, setting, issue, collaboration, result, certificateSentence }
}

function questionSpecificBody(questionId, scene, context) {
  const { major, activity, tool, standard, task, setting, issue, collaboration, result, certificateSentence } = scene
  const role = context.role || major.role
  const targetName = context.targetName || '지원처'
  const department = context.departmentName ? `${context.departmentName} 학습과 ` : ''
  const evidence = `${setting} ${object(task)} 맡았고 ${issue} ${instrument(tool)} 사실을 확인한 뒤 ${object(standard)} 기준으로 순서를 다시 정했습니다. ${collaboration} 그 결과 ${result}`
  const bodies = {
    motivation: `${department}${activity.label}에서 ${major.field}의 의미를 직접 확인한 경험이 ${role}에 관심을 갖게 된 계기입니다. ${certificateSentence} ${evidence} ${targetName}의 현재 채용공고와 공식 자료에서 실제 업무와 고객을 확인한 뒤, 이 경험을 첫 업무 기여와 연결해 작성합니다.`,
    'job-competency': `${role}에 필요한 역량을 자격 이름으로만 설명하지 않고 행동으로 증명합니다. ${certificateSentence} ${evidence} 이 과정에서 ${tool} 사용 자체보다 ${object(standard)} 지키며 결과를 확인한 점을 핵심 근거로 제시합니다.`,
    experience: `대표 경험의 목표는 ${task}를 기준에 맞게 끝내는 것이었습니다. ${evidence} 팀 전체 성과와 제 행동을 구분하고, 마지막에는 ${result}라는 확인 가능한 변화로 마무리합니다.`,
    collaboration: `${setting} 진행 속도와 방법에 대한 의견이 달랐습니다. 각자의 주장을 바로 선택하지 않고 ${object(standard)} 공통 기준으로 정했습니다. ${collaboration} ${tool}에 확인 내용을 남겼고, ${result}라는 공동 결과를 만들었습니다.`,
    'problem-solving': `${issue} 이를 단순 실수로 단정하지 않고 ${instrument(tool)} 현상과 원인을 나눠 확인했습니다. ${object(standard)} 기준으로 한 가지씩 다시 시험했고 ${collaboration} 그 결과 ${result} 원인 확인과 개선 효과를 함께 제시합니다.`,
    customer: `${setting} 상대가 처음 요청한 말만 처리하지 않고 어느 단계가 어려운지 다시 물었습니다. ${instrument(tool)} 요청 내용을 정리하고 가능한 방법과 어려운 이유를 구분해 설명했습니다. ${collaboration} ${result}`,
    ethics: `${setting} 빨리 마치는 것과 ${object(standard)} 지키는 것이 충돌했습니다. 확인되지 않은 결과를 그대로 사용하지 않고 ${instrument(tool)} 원자료를 다시 대조했습니다. ${collaboration} ${result}`,
    'public-value': `${activity.label}에서 제 행동의 영향을 받는 사람을 먼저 확인했습니다. ${object(standard)} 공통 기준으로 삼고 ${instrument(tool)} 필요한 정보를 정리했습니다. ${collaboration} ${result} 이 행동을 ${targetName}의 공공 역할과 연결합니다.`,
    safety: `${setting} ${issue} 작업을 계속하기 전에 위험 구간을 통제하고 ${object(standard)} 다시 확인했습니다. ${instrument(tool)} 상태를 기록한 뒤 ${collaboration} 재확인 결과 ${result}`,
    quality: `${task}의 품질 기준을 ${instrument(standard)} 정했습니다. ${instrument(tool)} 첫 결과와 기준을 대조해 차이가 난 지점을 찾고 ${collaboration} 수정 뒤 다시 검사해 ${result}`,
    challenge: `${setting} ${task}가 익숙하지 않아 처음 결과가 기대와 달랐습니다. ${certificateSentence} 기능을 작은 단계로 나누고 ${tool}에 막힌 지점을 기록했습니다. ${collaboration} 반복 적용한 결과 ${result}`,
    failure: `${setting} 첫 시도에서는 ${issue} 제 준비와 확인이 부족했던 점을 인정하고 ${instrument(tool)} 원인을 기록했습니다. 다음 시도에는 ${object(standard)} 중간 점검 기준으로 추가했고 ${collaboration} ${result}`,
    digital: `${setting} 기억과 수작업에 의존해 ${issue} ${object(tool)} 사용해 자료를 분류했지만 자동 결과를 그대로 믿지 않고 ${together(standard)} 원자료를 다시 대조했습니다. ${collaboration} ${result}`,
    'strength-weakness': `제 강점은 ${object(standard)} 확인하고 기록하는 습관입니다. ${evidence} 반면 막힌 내용을 혼자 오래 붙드는 점은 보완이 필요해, 일정 시간이 지나면 ${tool}에 질문을 적고 확인받는 규칙을 실천하고 있습니다.`,
    growth: `입사 초기에는 ${role}의 실제 절차와 ${standard}부터 정확히 익히겠습니다. ${certificateSentence} ${activity.label}에서 ${instrument(tool)} 결과를 확인했던 방식처럼 담당자의 피드백을 기록하고 다시 적용하겠습니다. 이후 반복되는 불편을 근거로 개선해 ${targetName}에 기여하겠습니다.`,
    free: `다른 문항에서 아직 보여 주지 못한 근거는 ${activity.label}에서 만든 기록 습관입니다. ${evidence} 이 습관은 ${role}에서 진행 상태와 결과를 정확히 공유하는 데 활용할 수 있습니다.`,
    'role-understanding': `${topic(role)} ${major.field}이며 ${object(standard)} 지키는 일이 중요합니다. ${certificateSentence} ${evidence} 이 경험을 바탕으로 입사 초기에는 실제 업무 기준을 확인받고 정확한 기록부터 맡겠습니다.`,
    communication: `${setting} 상대가 ${task}의 순서를 어려워했습니다. ${instrument(tool)} 핵심 단계를 나누고 전문 표현을 실제 행동 순서로 바꿔 설명했습니다. ${collaboration} 상대가 다시 설명하도록 해 이해 여부를 확인했고 ${result}`,
    conflict: `${setting} 핵심 쟁점은 속도와 ${standard} 중 무엇을 우선할지였습니다. 상대 의견의 이유를 먼저 확인하고 ${tool}에 공통 기준과 마감 조건을 적었습니다. ${collaboration} ${result}`,
    leadership: `${setting} 팀에 가장 필요했던 것은 지시보다 진행 기준의 공유였습니다. ${instrument(tool)} 남은 일을 나누고 어려운 부분은 함께 점검했습니다. ${collaboration} ${result}`,
    'resource-management': `${setting} 사용할 수 있는 시간과 자료가 제한돼 있었습니다. 앞 작업의 완료 여부와 ${object(standard)} 우선순위 기준으로 정하고 ${instrument(tool)} 중간 상태를 확인했습니다. ${collaboration} ${result}`,
    responsibility: `${setting} 제가 끝까지 맡아야 했던 일은 ${task}였습니다. 매번 ${object(standard)} 확인하고 ${tool}에 처리 내용과 남은 일을 기록했습니다. ${collaboration} ${result}`,
    adaptation: `${setting} 기존에 익힌 방식과 새 기준이 달라 ${issue} 달라진 점을 ${tool}에 비교하고 ${object(standard)} 다시 확인했습니다. 작은 작업에 먼저 적용한 뒤 ${collaboration} ${result}`,
    creativity: `${setting} ${issue} 반복 불편을 줄이기 위해 ${tool}의 순서와 표시 방법을 바꾸는 작은 대안을 시험했습니다. ${instrument(standard)} 전후 결과를 비교했고 ${collaboration} ${result}`,
    'major-practice': `${department}${setting} ${object(tool)} 사용해 ${object(task)} 직접 수행했습니다. 작업 전 ${object(standard)} 확인하고 첫 결과가 다를 때는 ${collaboration} 수정 뒤 다시 측정해 ${result}`,
    'school-life': `${setting} 제가 맡은 역할은 ${object(task)} 끝까지 확인하는 일이었습니다. ${instrument(tool)} 진행 상태를 공유하고 ${collaboration} ${result} 이 경험으로 역할보다 기준과 인계를 지키는 태도가 중요하다는 점을 배웠습니다.`,
    achievement: `${object(task)} 이전보다 정확하게 마치는 것을 목표로 정했습니다. ${instrument(tool)} 중간 결과를 확인해 ${issue} ${object(standard)} 기준으로 방식을 수정했고 ${collaboration} ${result}`,
    'self-development': `${role} 준비에서 부족했던 부분은 ${standard}을 실제 작업에 적용하는 능력이었습니다. ${certificateSentence} ${tool}에 주간 목표와 오류를 기록하고 ${collaboration} ${result}`,
    'organization-fit': `제가 업무에서 중요하게 여기는 가치는 ${object(standard)} 지켜 신뢰를 만드는 것입니다. ${evidence} ${targetName}의 현재 공식 자료에서 같은 가치가 실제 업무에 어떻게 나타나는지 확인하고 ${role}의 행동과 연결해 설명합니다.`,
    'social-responsibility': `${setting} 제 선택으로 영향을 받는 사람과 불편을 먼저 확인했습니다. ${object(standard)} 기준으로 ${tool}에 필요한 조치를 정리하고 ${collaboration} ${result}`,
  }
  return bodies[questionId] || `${evidence} ${certificateSentence} 이 근거를 ${role}의 실제 업무와 연결합니다.`
}

function polishParagraph(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/(습니다|합니다|됩니다|입니다)(?=\s+[가-힣A-Z0-9])/g, '$1.')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

export function buildPersonalizedCoverExample(options = {}) {
  const questionId = options.questionId || 'experience'
  const style = PERSONALIZED_EXAMPLE_STYLES.find(item => item.id === options.styleId) || PERSONALIZED_EXAMPLE_STYLES[0]
  const scene = evidenceScene(options)
  const question = COVER_LETTER_QUESTION_LIBRARY.find(item => item.id === questionId)
  const focus = QUESTION_FOCUS[questionId] || question?.required || ['질문의 핵심', '내 행동', '결과']
  const questionBody = questionSpecificBody(questionId, scene, options)
  const certificateContext = scene.certificate && !questionBody.includes(scene.certificate.label) ? `${scene.certificateSentence} ` : ''
  const body = polishParagraph(`${style.lead ? `${style.lead} ` : ''}${certificateContext}${questionBody} ${style.close}`)
  return {
    id: `${questionId}-${scene.major.id}-${scene.activity.id}-${scene.certificate?.id || 'none'}-${style.id}-${Number(options.variant) || 0}`,
    title: `${options.departmentName || scene.major.label} · ${scene.activity.label} · ${question?.label || '직접 문항'}`,
    body,
    starter: body.split(/(?<=[.!?])\s/)[0],
    focus,
    certificate: scene.certificate,
    context: [options.departmentName || scene.major.label, scene.certificate?.label, scene.activity.label, style.label].filter(Boolean),
    disclaimer: '가상 학생의 구조 예시입니다. 자격·활동·수치·지원처 사실을 그대로 쓰지 말고 본인의 확인 가능한 사실로 바꾸세요.',
  }
}

export function buildPersonalizedInterviewExample(options = {}) {
  const type = options.type || 'introduction'
  const style = PERSONALIZED_EXAMPLE_STYLES.find(item => item.id === options.styleId) || PERSONALIZED_EXAMPLE_STYLES[0]
  const scene = evidenceScene(options)
  const { major, activity, certificate, tool, standard, task, setting, collaboration, result, certificateSentence } = scene
  const role = options.role || major.role
  const targetName = options.targetName || '지원처'
  const department = options.departmentName ? `${options.departmentName}에서 ` : ''
  const certificatePart = certificate ? `${certificate.label} 준비와 ` : ''
  const verifiedEvidence = [options.evidenceAction, options.evidenceResult].map(value => String(value || '').trim()).filter(Boolean).join(' ')
  const experiencePart = verifiedEvidence || `${setting} ${object(task)} 맡았습니다. ${instrument(tool)} 진행 상태를 확인하고 ${collaboration} 그 결과 ${result}`
  const identity = {
    clear: '핵심을 분명히 말하는',
    logical: '판단 기준과 결과를 연결하는',
    field: '현장에서 직접 확인하고 움직이는',
    growth: '피드백을 행동으로 바꾸는',
  }[style.id]
  const examples = {
    introduction: `안녕하십니까. ${role}에서 ${object(standard)} 지키며 결과를 확인하고, ${identity} 지원자입니다. ${department}${certificatePart}실제 경험을 근거로 말씀드리겠습니다. ${experiencePart} ${targetName}에서도 업무 기준을 빠르게 익히고 정확한 확인과 기록으로 기여하겠습니다.`,
    motivation: `${role}에 관심을 가진 계기는 ${activity.label}에서 ${major.field}의 중요성을 직접 확인한 경험입니다. ${certificateSentence} ${experiencePart} ${targetName}의 현재 공식 자료에서 실제 업무와 고객을 확인한 뒤 이 경험을 입사 초기의 구체적인 기여로 이어 가겠습니다.`,
    closing: `오늘 답변에서 말씀드린 ${object(verifiedEvidence || `${standard} 확인과 ${tool} 기록 습관`)} ${targetName}의 ${role}에서 행동으로 보여 드리겠습니다. ${activity.label}에서 ${result}라는 점검 결과를 만든 방식과 ${certificate ? `${certificate.label} 준비에서 반복한 ${certificate.competency}` : '배운 기준'}을 실제 업무에도 적용하겠습니다. 감사합니다.`,
  }
  const body = polishParagraph(`${style.id === 'clear' || type === 'introduction' ? '' : `${style.lead} `}${examples[type] || examples.introduction}`)
  return {
    id: `${type}-${major.id}-${activity.id}-${certificate?.id || 'none'}-${style.id}-${Number(options.variant) || 0}`,
    title: `${options.departmentName || major.label} · ${activity.label} · ${type === 'introduction' ? '1분 자기소개' : type === 'motivation' ? '지원동기' : '마지막 말'}`,
    body,
    starter: body.split(/(?<=[.!?])\s/)[0],
    context: [options.departmentName || major.label, certificate?.label, activity.label, style.label].filter(Boolean),
    disclaimer: '가상 학생의 말하기 구조 예시입니다. 실제로 하지 않은 활동이나 취득하지 않은 자격은 답변에 넣지 마세요.',
  }
}

export function personalizedExampleCoverage() {
  const majors = PERSONALIZED_MAJOR_PROFILES.length
  const certificates = PERSONALIZED_MAJOR_PROFILES.reduce((sum, item) => sum + item.certificates.length, 0)
  const activities = PERSONALIZED_ACTIVITY_PROFILES.length
  const questions = COVER_LETTER_QUESTION_LIBRARY.length
  const styles = PERSONALIZED_EXAMPLE_STYLES.length
  const variants = 3
  return {
    majors,
    certificates,
    activities,
    questions,
    styles,
    variants,
    coverExamples: certificates * activities * questions * styles * variants,
    interviewExamples: certificates * activities * 3 * styles * variants,
  }
}
