// 문항 본문은 data/*.json 으로 옮겼다. src 안의 JS 배열로 두면 보기 순서
// 균형·해설 번호 맞춤·문항 게이트가 이 문항들을 보지 못한다(스크립트는
// src 가 import 하는 data/*.json 만 훑는다). 실제로 듣기 27문항과 직무적응
// 학습 8문항이 그 검사 밖에 있었다.
import listening from '../../data/jc-media-listening.json'
import visual from '../../data/jc-media-visual.json'

export const koreanListeningQuestions = listening.questions
export const mathVisualQuestions = visual.questions
export const jobCommonMediaQuestions = [...koreanListeningQuestions, ...mathVisualQuestions]
