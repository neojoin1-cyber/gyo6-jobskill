// 요구 수준마다 **학습하는 방법이 달라야 한다.**
//
// ── 무엇이 문제였나 ──────────────────────────────────────────────────────
// 문항마다 `demandLevel`(확인·적용·종합)을 매겨 두고도, 정작 학습 화면은
// 1,445문항을 전부 똑같이 다뤘다. 보기를 고르고 → 채점하고 → 해설을 읽는다.
// 세 수준이 요구하는 인지 작업이 다른데 연습 방식이 하나였다.
//
//   확인  자료에서 값을 찾아 읽기      → 필요한 건 **반복**. 빨라져야 한다.
//   적용  아는 절차를 상황에 옮기기    → 필요한 건 **자기설명**. 왜 그 답인지 말해야 한다.
//   종합  여러 정보를 견줘 근거 세우기 → 필요한 건 **근거 만들기**. 답보다 근거가 학습이다.
//
// ── 왜 이 방식들인가 ────────────────────────────────────────────────────
// 셋 다 답을 보기 **전에** 학생이 무언가를 내놓게 한다. 정답을 본 뒤에는
// "나도 그렇게 생각했다"고 느끼기 쉬워서(사후 확신), 미리 적어 둔 것과
// 견줘야만 자기가 어디서 어긋났는지 보인다.
//
// 적용 수준의 이유 칩에 '확신 없이 골랐어요'를 넣은 것은 일부러다. 찍어서
// 맞힌 문항은 학생 눈에는 '아는 문항'으로 남는데, 실제로는 가장 위험한
// 문항이다. 그 경우에만 다른 마무리 문구를 보여 준다.
//
// 학생이 적은 것은 **기기에만 남긴다**(localStorage). 생각의 과정은 채점
// 대상이 아니고, 서버로 보내면 학생이 솔직하게 적지 않는다.

import { demandLevel } from './demandLevel.js'

export const LEARNING_MODES = {
  확인: {
    id: '확인', icon: '🔎', title: '찾아 읽기', method: 'repeat',
    goal: '자료에서 필요한 정보를 정확히 집어내기',
    before: '고르기 전에 자료에서 근거가 되는 부분을 눈으로 짚어 보세요.',
    after: '이런 문항은 여러 번 만날수록 빨라집니다. 짧은 간격으로 다시 물어볼게요.',
  },
  적용: {
    id: '적용', icon: '🧭', title: '상황에 옮기기', method: 'explain',
    goal: '아는 절차를 실제 업무 상황에 맞게 적용하기',
    prompt: '왜 그 답을 골랐나요?',
    // 상황 판단형 문항에서 고를 만한 이유들.
    reasons: [
      { id: 'condition', label: '자료의 조건과 맞아서' },
      { id: 'rule', label: '규정·절차에 어긋나지 않아서' },
      { id: 'elimination', label: '다른 보기를 지우고 남아서' },
      { id: 'guess', label: '확신 없이 골랐어요' },
    ],
    // 표·수치를 읽는 문항은 판단의 결이 다르다. "규정에 어긋나지 않아서"는
    // 매출표 문항에 대고 물을 말이 아니다. 자료형에는 이쪽을 쓴다.
    dataReasons: [
      { id: 'computed', label: '자료의 값을 직접 계산해서' },
      { id: 'compared', label: '다른 보기와 하나씩 견줘 보고' },
      { id: 'partial', label: '눈에 띄는 항목만 확인하고' },
      { id: 'guess', label: '확신 없이 골랐어요' },
    ],
  },
  종합: {
    id: '종합', icon: '🧩', title: '근거 세우기', method: 'evidence',
    goal: '여러 정보를 견주어 판단의 근거를 만들기',
    prompt: '무엇을 근거로 그렇게 판단했나요? 한 줄로 적어 보세요.',
    placeholder: '예) 3호점만 평균이 140명이라 나머지 보기와 어긋난다',
  },
}

/** 표·그래프나 숫자를 읽어야 하는 문항인가. */
function isDataQuestion(q) {
  if (q?.visual?.type === 'table' || q?.visual?.type === 'bar') return true
  const text = `${q?.stem || ''} ${q?.context || ''}`
  return (text.match(/\d/g) || []).length >= 12
}

/** 문항의 학습 방식. demandLevel 이 붙어 있으면 그대로, 없으면 그 자리에서 매긴다. */
export function learningModeOf(q) {
  if (!q) return LEARNING_MODES.적용
  const mode = LEARNING_MODES[q.demandLevel] ?? LEARNING_MODES[demandLevel(q)] ?? LEARNING_MODES.적용
  if (mode.method === 'explain' && isDataQuestion(q)) {
    return { ...mode, reasons: mode.dataReasons }
  }
  return mode
}

const KEY = id => `gyo6.coach.${id}`

export function readCoachNote(qid) {
  try { return JSON.parse(localStorage.getItem(KEY(qid)) ?? 'null') } catch { return null }
}
export function writeCoachNote(qid, note) {
  try { localStorage.setItem(KEY(qid), JSON.stringify(note)) } catch { /* 저장 실패는 무시 */ }
}

/**
 * 채점 뒤 무엇을 말해 줄지. 맞고 틀림보다 **어디서 어긋났는지**를 짚는다.
 */
export function coachFeedback(mode, note, correct) {
  if (mode.method === 'repeat') return mode.after

  if (mode.method === 'explain') {
    if (note?.reason === 'partial') {
      return correct
        ? '이번엔 맞았지만 일부 항목만 본 판단입니다. 도표 문항은 남은 보기도 자료와 대조해야 안전합니다.'
        : '일부 항목만 보고 판단했습니다. 보기를 하나씩 자료와 대조하면 이런 실수가 줄어듭니다.'
    }
    if (note?.reason === 'guess') {
      return correct
        ? '이번엔 맞았지만 근거 없이 고른 문항입니다. 해설의 판단 기준을 꼭 읽어 두세요.'
        : '근거 없이 고른 문항입니다. 해설에서 판단의 기준부터 확인하세요.'
    }
    if (!note?.reason) return '다음에는 고르기 전에 이유를 한 번 정해 보세요. 그래야 어디서 어긋났는지 보입니다.'
    const label = mode.reasons.find(r => r.id === note.reason)?.label ?? ''
    return correct
      ? `‘${label}’ — 해설이 말하는 근거와 같은지 견줘 보세요.`
      : `‘${label}’라고 보았는데 답이 달랐습니다. 그 판단이 어디서 어긋났는지 해설에서 찾아보세요.`
  }

  if (!note?.evidence?.trim()) return '근거를 적지 않고 넘어갔습니다. 다음 문항에서는 한 줄이라도 적어 보세요.'
  return correct
    ? '적어 둔 근거와 해설의 근거가 같은지 견줘 보세요. 답이 같아도 근거가 다르면 다음엔 틀립니다.'
    : '적어 둔 근거와 해설을 나란히 놓고, 어느 대목에서 갈라졌는지 찾아보세요.'
}
