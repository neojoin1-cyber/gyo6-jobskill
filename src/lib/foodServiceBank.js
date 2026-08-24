/**
 * 식음료서비스 문항은행 — 비활성.
 *
 * 2026-08-20 사용자 결정으로 식음료서비스 과목을 앱에서 제외했다.
 * 이 모듈을 참조하는 곳이 7군데라 파일을 지우면 전부 깨지므로,
 * 인터페이스만 남기고 데이터를 비운다. 원본 JSON 임포트를 없애는 것이
 * 번들 축소의 핵심이다(약 4MB).
 *
 * 과목을 되살리려면 git 이력에서 이 파일과 data/food-service-*.json 을
 * 복원하면 된다.
 */

export const foodServiceBank = []

export function examPriority() { return 0 }

export const PRIORITY_BADGE = {}

export default foodServiceBank
