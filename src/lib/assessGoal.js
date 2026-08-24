// 교육부·대한상공회의소 직업공통능력은 학년에 따라 진단 규모가 다르다.
//   1·2학년 자가진단  215문항
//   3학년   인증진단  342문항 · 240분
// 두 규모 모두 앱에 이미 구현돼 있지만(JobCommonDiagnosticHub / MockAssessmentScreen)
// 학생 입장에서는 "나는 어느 쪽을 풀어야 하나"가 화면에 없었다.
//
// 계정의 학년 필드로 자동 분기하지 않는다. 재수강·편입·조기 대비가 있고,
// 학년 값이 비어 있는 계정도 실제로 존재한다. 잘못 분기하면 3학년이
// 215문항만 보게 되는데, 그 사실을 학생이 알아차릴 방법이 없다.
//
// 선택은 기기(localStorage)에만 저장한다. 서버 왕복이 없으므로 동시 접속이
// 수만 명이어도 이 기능 때문에 부하가 늘지 않는다. 기기를 바꾸면 다시 고르면 된다.

const KEY = 'gyo6.assessGoal.v1'

export const ASSESS_GOALS = {
  self: {
    id: 'self',
    label: '1·2학년 자가진단 대비',
    short: '자가진단',
    emoji: '🌱',
    scale: '215문항',
    desc: '지금 실력을 확인하고 약한 영역을 찾는 규모입니다.',
    recommend: 'diagnostic',
  },
  cert: {
    id: 'cert',
    label: '3학년 인증진단 대비',
    short: '인증진단',
    emoji: '🎯',
    scale: '342문항 · 240분',
    desc: '실제 인증진단과 같은 규모·제한시간으로 연습합니다.',
    recommend: 'mock',
  },
}

export const ASSESS_GOAL_LIST = [ASSESS_GOALS.self, ASSESS_GOALS.cert]

export function getAssessGoal() {
  try {
    const v = localStorage.getItem(KEY)
    return ASSESS_GOALS[v] ? v : null
  } catch {
    return null            // 사파리 프라이빗 모드 등 저장 불가 환경에서도 화면은 떠야 한다
  }
}

export function setAssessGoal(id) {
  try {
    if (ASSESS_GOALS[id]) localStorage.setItem(KEY, id)
  } catch { /* 저장 실패는 무시 — 이번 세션 동안만 선택이 유지된다 */ }
}

export function clearAssessGoal() {
  try { localStorage.removeItem(KEY) } catch { /* 무시 */ }
}
