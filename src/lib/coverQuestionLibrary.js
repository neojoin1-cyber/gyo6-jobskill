import { EXTRA_COVER_QUESTIONS } from './coverLetterGuidance.js'

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
