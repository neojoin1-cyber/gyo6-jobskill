/**
 * difficulty.js — 문항 난이도 표시(순화 3티어).
 *
 * 설계 원칙(사용자 요청): 하위 학습자 자존심을 건드리는 표현 금지.
 *  - 모든 문항에 긍정 프레이밍 배지. '하/쉬움' 같은 하향 표현 없음.
 *  - 최상위(도전)만 "만점·A등급 도전 (선택)"으로 아스피레이셔널하게 → 합격이 목표면
 *    건너뛰어도 부담 없다는 뜻을 부드럽게 전달.
 *
 * 티어 매핑(순위·등급 교재=직업공통·NCS의 level/isAGrade 기준):
 *   🏆 도전  = isAGrade(원본 A등급 심화 문제)
 *   🎯 실전  = level '심화'·'종합'
 *   🌱 기본기 = 그 외(기초·표준·진단·무표기)
 * 단, stem에 '기초 수준'·'표준 수준'이 명시된 라벨 오염 문항은 기본기로 강등.
 */
const TIERS = {
  base:      { key: 'base',      label: '기본기', icon: '🌱', color: '#0E7C5A', bg: '#E4F5EC', desc: '합격·기본기 필수' },
  practical: { key: 'practical', label: '실전',   icon: '🎯', color: '#1D4ED8', bg: '#E3ECFF', desc: '시험 실전 수준' },
  challenge: { key: 'challenge', label: '도전',   icon: '🏆', color: '#8A5A00', bg: '#FBEFD0', desc: '1등급·우수 도전 (선택)' },
}

const DOWNGRADE_RE = /기초\s*수준|표준\s*수준/

/**
 * 문항 → 난이도 티어 객체. 난이도가 태깅되지 않은 문항(식음료·품질 등 level 없음)은
 * null → 배지 미표시(자격증 과목은 🔥빈출 배지가 난이도 대신 핵심 지표). 추측으로
 * 난이도를 부여하지 않는다.
 */
export function difficultyTier(q) {
  if (!q) return null
  const stem = typeof q.stem === 'string' ? q.stem : ''
  if (q.isAGrade && !DOWNGRADE_RE.test(stem)) return TIERS.challenge
  const lv = q.level
  if ((lv === '심화' || lv === '종합') && !DOWNGRADE_RE.test(stem)) return TIERS.practical
  if (lv === '기초' || lv === '표준' || lv === '진단') return TIERS.base
  return null   // 난이도 미지정 → 표시하지 않음
}

export { TIERS as DIFFICULTY_TIERS }
