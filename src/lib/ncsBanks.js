/**
 * NCS 문항 은행 — 능력 문항과 상식 문항을 나눠 둔 곳.
 *
 * ── 왜 나눴나 ─────────────────────────────────────────────────────
 * `ncs-questions.json` 에 금융·경영·경제·일반상식과 인적성 240건이 섞여
 * 있었다. 이것들은 **직업기초능력 영역이 아니다.** 한 파일에 두면 영역
 * 분포 통계가 오염되고, 「우리 반 약한 영역」이 상식을 능력으로 세어
 * 엉뚱한 단원을 추천한다.
 *
 * ── 버리지는 않는다 ───────────────────────────────────────────────
 * 채용 필기 트랙(recruitWritten.js)이 실제로 쓰는 문항들이다. 파일만
 * 나누고 쓰던 곳은 그대로 쓴다.
 *
 * 근거 — docs/specs/903 §4-⑥
 */
import ability from '../../data/ncs-questions.json'
import general from '../../data/general-knowledge-questions.json'

/** 직업기초능력 10영역 문항. 영역 통계·약점 분석은 이것만 센다. */
export const ncsAbilityQuestions = ability

/** 상식·인적성. 채용 필기 트랙 전용. */
export const generalKnowledgeQuestions = general.questions ?? []

/** 둘을 합친 것. 예전 `ncs-questions.json` 한 파일과 같은 내용이다. */
export const allNcsSourceQuestions = [...ncsAbilityQuestions, ...generalKnowledgeQuestions]
