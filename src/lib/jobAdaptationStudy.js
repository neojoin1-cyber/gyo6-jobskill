import jobAdaptStudy from '../../data/jc-job-adapt-study.json'
/**
 * 직무적응 **학습** 자료 — 검사 이해와 응답 전략.
 *
 * ### 왜 필요한가
 *
 * 교육부 인증진단 342문항 가운데 **직무적응이 160문항, 47%**다. 그런데 우리
 * 자율학습에는 직무적응 학습 단원이 하나도 없었다. 검사(5점 척도 160문항)만
 * 있고, 그 검사가 무엇을 재는지·어떻게 응답해야 하는지는 가르치지 않았다.
 *
 * "정답이 없으니 배울 것도 없다"는 오해다. 실제로 배울 것이 있다.
 *
 *   · 같은 번호만 눌러도 되는 줄 안다        → 집중 확인 문항에 걸린다
 *   · 자기를 좋게만 보이려 한다              → 과장 경향 지표가 올라간다
 *   · 문항당 15초라는 감각이 없다            → 40분 안에 160문항을 못 끝낸다
 *   · 같은 특성을 반대로 묻는 역문항을 모른다 → 앞뒤가 어긋나 일관성이 떨어진다
 *
 * 이건 요령이 아니라 **검사를 제대로 받는 법**이다. 꾸며서 좋은 점수를 받는
 * 방법이 아니라, 자기 모습이 왜곡 없이 담기게 하는 방법을 가르친다.
 *
 * 여기 문항은 자율학습 전용이다. 직무적응 시험지는 5점 척도 자가진단이므로
 * 이 지식 문항이 시험지에 섞여 들어가지 않는다.
 */

export const JOB_ADAPT_STUDY_LESSON = {
  id: 'JC26-JOB-ADAPT-STUDY',
  label: '직무적응 검사 이해와 응답 전략',
}

const L = JOB_ADAPT_STUDY_LESSON.id
const T = JOB_ADAPT_STUDY_LESSON.label

/** 자율학습 확인 문항. 모두 4지선다(공식 선택형 형식). */
// 문항 본문은 data/*.json 으로 옮겼다. src 안의 JS 배열로 두면 보기 순서
// 균형·해설 번호 맞춤·문항 게이트가 이 문항들을 보지 못한다(스크립트는
// src 가 import 하는 data/*.json 만 훑는다). 실제로 듣기 27문항과 직무적응
// 학습 8문항이 그 검사 밖에 있었다.
export const JOB_ADAPT_STUDY_QUESTIONS = (jobAdaptStudy.questions || []).map(question => ({
  ...question,
  learningLane: 'study',
}))
