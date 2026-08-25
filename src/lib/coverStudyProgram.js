import { COVER_LETTER_QUESTION_LIBRARY } from './coverQuestionLibrary.js'
import { questionGuide } from './coverLetterGuidance.js'

function coverSummary(label, items) {
  const points = items.map(item => {
    const content = questionGuide(item.id, item)
    return {
      topic: item.label,
      mode: '적용',
      situation: item.question,
      learn: `문항 요구｜${item.purpose}\n작성 순서｜${content.structure.join(' → ')}\n반드시 넣을 사실｜${item.required.join(' · ')}`,
      sampleQuestion: {
        type: 'writing-practice',
        format: '실전 고쳐쓰기',
        context: item.question,
        draft: content.trap,
        stem: '감점 초안의 문제를 찾아 내 경험과 사실로 고쳐 쓰세요.',
        checklist: [
          ...item.required.map(value => `${value} 포함`),
          `작성 순서: ${content.structure.join(' → ')}`,
          '면접에서 다시 설명할 수 있는 사실만 사용',
        ],
        modelAnswer: content.good,
        limit: item.limit || 700,
        explanation: '개선 예시는 구조 참고용임. 경험·수치·표현은 자신의 사실로 다시 작성함.',
      },
      example: `근거 후보｜${content.evidenceHints.join(' · ')}`,
    }
  })
  return {
    title: `${label} 작성법`,
    intro: `${label} 문항의 필수 요구를 표시하고, 감점 초안을 내 사실 근거가 드러나는 문장으로 직접 고쳐 씀.`,
    courseKind: 'cover-letter',
    keyPoints: points,
    mustRemember: ['지원처 이름만 바꾼 범용 문장을 사용하지 않음', '경험·역할·수치·결과는 설명하고 증명할 수 있는 사실만 사용함', '질문의 모든 요구 요소와 글자 수를 제출 전에 다시 확인함'],
    terms: [
      { term: '문항 요구 표시', def: '지원처·직무·경험·행동·결과처럼 반드시 답할 요소에 먼저 표시함' },
      { term: '근거 재확인', def: '작성한 행동·수치·결과를 면접에서 다시 설명할 수 있는지 확인함' },
    ],
    tips: [`${label} 항목에서 추상적인 장점만 반복하면 문항이 요구한 내용과 실제 행동 근거가 빠질 수 있음.`],
  }
}

function buildCoverAreas() {
  const grouped = new Map()
  COVER_LETTER_QUESTION_LIBRARY.forEach(item => {
    const group = questionGuide(item.id, item).group
    grouped.set(group, [...(grouped.get(group) || []), item])
  })
  return [...grouped.entries()].map(([label, items], index) => ({
    id: `cover-${index + 1}`,
    label,
    description: items.map(item => item.label).join(' · '),
    lessons: [{ id: `cover-${index + 1}-lesson`, label: `${label} 작성법`, summary: coverSummary(label, items) }],
  }))
}

export const COVER_STUDY_PROGRAM = {
  subjectId: 'cover-letter',
  title: '자기소개서 자율학습',
  authority: '고졸 공채 취업서류',
  description: '문항 요구·감점 초안·직접 고쳐쓰기·근거 점검을 한 장씩 실습함.',
  challengeLabel: '실전 작성 진단으로 확인',
  areas: buildCoverAreas(),
}
