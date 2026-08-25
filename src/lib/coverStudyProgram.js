import { COVER_LETTER_QUESTION_LIBRARY } from './coverQuestionLibrary.js'
import { questionGuide } from './coverLetterGuidance.js'

function coverSummary(label, items) {
  const points = items.map(item => {
    const content = questionGuide(item.id, item)
    return {
      topic: item.label,
      mode: '이해',
      situation: item.question,
      learn: `질문 의도｜${item.purpose}\n구성 순서｜${content.structure.join(' → ')}\n필수 근거｜${item.required.join(' · ')}`,
      sampleQuestion: {
        type: 'choice',
        stem: `${item.label} 항목에 더 적합한 출발 문장은?`,
        choices: [content.good, content.trap],
        answer: 0,
        explanation: `좋은 예시는 ${content.structure.join(' → ')}의 흐름으로 지원자의 사실을 연결함.`,
      },
      example: `내 경험에서 찾을 것｜${content.evidenceHints.join(' · ')}`,
    }
  })
  return {
    title: `${label} 작성법`,
    intro: `${label} 질문의 의도를 구분하고, 내 근거를 평가자가 확인할 수 있는 순서로 작성함.`,
    courseKind: 'cover-letter',
    keyPoints: points,
    mustRemember: ['지원처 이름만 바꾼 범용 문장을 사용하지 않음', '경험·역할·수치·결과는 설명하고 증명할 수 있는 사실만 사용함', '질문의 모든 요구 요소와 글자 수를 제출 전에 다시 확인함'],
    terms: [{ term: '평가 의도', def: '자기소개서 질문으로 확인하려는 역량과 행동 근거' }, { term: '행동 근거', def: '지원자가 직접 수행한 행동과 확인 가능한 결과' }],
    tips: [`${label} 항목에서 추상적인 장점만 반복하면 질문의 요구와 실제 행동 근거가 빠질 수 있음.`],
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
  description: '질문 의도·답변 구조·좋은 예시·감점 예시를 한 장씩 비교하며 익힘.',
  challengeLabel: '작성 기준 진단으로 확인',
  areas: buildCoverAreas(),
}
